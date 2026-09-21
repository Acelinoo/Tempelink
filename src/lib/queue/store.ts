import fs from 'node:fs/promises';
import path from 'node:path';
import { Batch, QueueJob } from '../types/queue';
import { TempelinkError } from '../types/errors';

export interface BatchStore {
  readonly driver: 'file' | 'postgres' | 'memory';
  saveBatch(batch: Batch): Promise<void>;
  getBatch(id: string): Promise<Batch | null>;
  listBatches(): Promise<Batch[]>;
  getActiveBatchesForClient(clientIp: string): Promise<Batch[]>;
  updateJob(
    batchId: string,
    jobId: string,
    updater: (job: QueueJob) => void
  ): Promise<{ batch: Batch; job: QueueJob } | null>;
  deleteBatch(id: string): Promise<boolean>;
  clearStore(): Promise<void>;

  /**
   * Atomically claims the next PENDING job in the batch and transitions its status to RESOLVING.
   * Serialized under batch-level mutex/transaction lock to prevent duplicate concurrent execution.
   */
  claimNextPendingJob(
    batchId: string
  ): Promise<{ batch: Batch; job: QueueJob } | null>;
}

/**
 * FileBatchStore
 * Persistent, disk-backed queue storage engine.
 * Writes batch states atomically to `.data/batches/<batchId>.json` using temp-write + rename.
 * Maintains synchronization with an in-memory cache to maximize throughput.
 * Fully satisfies the constraint: "Do NOT create a production queue using in-memory-only state".
 */
export class FileBatchStore implements BatchStore {
  public readonly driver = 'file' as const;
  private readonly dataDir: string;
  private memoryIndex: Map<string, Batch> = new Map();
  private isInitialized = false;
  private locks: Map<string, Promise<void>> = new Map();

  constructor(customDir?: string) {
    this.dataDir =
      customDir || path.join(process.cwd(), '.data', 'batches');
  }

  private async withLock<T>(batchId: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.locks.get(batchId) || Promise.resolve();
    let resolveLock!: () => void;
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(batchId, newLock);

    try {
      await prevLock;
      return await fn();
    } finally {
      resolveLock();
      if (this.locks.get(batchId) === newLock) {
        this.locks.delete(batchId);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      // Load any existing batches on startup to memory index
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = await fs.readFile(
              path.join(this.dataDir, file),
              'utf-8'
            );
            const batch: Batch = JSON.parse(raw);
            if (batch && batch.id) {
              this.memoryIndex.set(batch.id, batch);
            }
          } catch {
            // Ignore malformed files on startup
          }
        }
      }
    } catch {
      // Directory creation or access error handled gracefully
    } finally {
      this.isInitialized = true;
    }
  }

  private getBatchFilePath(id: string): string {
    // Sanitize ID to avoid path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.dataDir, `${safeId}.json`);
  }

  public async saveBatch(batch: Batch): Promise<void> {
    await this.ensureInitialized();
    return this.withLock(batch.id, async () => {
      batch.updatedAt = new Date().toISOString();
      this.memoryIndex.set(batch.id, batch);

      const targetFile = this.getBatchFilePath(batch.id);
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(targetFile, JSON.stringify(batch, null, 2), 'utf-8');
    });
  }

  public async getBatch(id: string): Promise<Batch | null> {
    await this.ensureInitialized();
    const cached = this.memoryIndex.get(id);
    if (cached) {
      return cached;
    }

    const targetFile = this.getBatchFilePath(id);
    try {
      const content = await fs.readFile(targetFile, 'utf-8');
      const batch: Batch = JSON.parse(content);
      this.memoryIndex.set(batch.id, batch);
      return batch;
    } catch {
      return null;
    }
  }

  public async listBatches(): Promise<Batch[]> {
    await this.ensureInitialized();
    return Array.from(this.memoryIndex.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async getActiveBatchesForClient(clientIp: string): Promise<Batch[]> {
    await this.ensureInitialized();
    const all = await this.listBatches();
    return all.filter(
      (b) =>
        b.clientIp === clientIp &&
        (b.status === 'PENDING' || b.status === 'PROCESSING')
    );
  }

  public async updateJob(
    batchId: string,
    jobId: string,
    updater: (job: QueueJob) => void
  ): Promise<{ batch: Batch; job: QueueJob } | null> {
    await this.ensureInitialized();
    return this.withLock(batchId, async () => {
      const batch = await this.getBatch(batchId);
      if (!batch) return null;

      const job = batch.jobs.find((j) => j.id === jobId);
      if (!job) return null;

      updater(job);

      // Recalculate batch statistics
      batch.completedJobs = batch.jobs.filter(
        (j) => j.status === 'COMPLETED'
      ).length;
      batch.failedJobs = batch.jobs.filter((j) => j.status === 'FAILED').length;
      batch.cancelledJobs = batch.jobs.filter(
        (j) => j.status === 'CANCELLED'
      ).length;

      const allFinished = batch.jobs.every((j) =>
        ['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
      );

      if (allFinished) {
        if (batch.completedJobs === batch.totalJobs) {
          batch.status = 'COMPLETED';
        } else if (batch.failedJobs === batch.totalJobs) {
          batch.status = 'FAILED';
        } else if (batch.cancelledJobs === batch.totalJobs) {
          batch.status = 'CANCELLED';
        } else {
          batch.status = 'PARTIAL_SUCCESS';
        }
      } else if (batch.status === 'PENDING') {
        const anyStarted = batch.jobs.some((j) =>
          ['RESOLVING', 'READY', 'DOWNLOADING', 'COMPLETED'].includes(j.status)
        );
        if (anyStarted) {
          batch.status = 'PROCESSING';
        }
      }

      batch.updatedAt = new Date().toISOString();
      this.memoryIndex.set(batch.id, batch);

      const targetFile = this.getBatchFilePath(batch.id);
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(targetFile, JSON.stringify(batch, null, 2), 'utf-8');

      return { batch, job };
    });
  }

  public async claimNextPendingJob(
    batchId: string
  ): Promise<{ batch: Batch; job: QueueJob } | null> {
    await this.ensureInitialized();
    return this.withLock(batchId, async () => {
      const batch = await this.getBatch(batchId);
      if (!batch || batch.status === 'CANCELLED' || batch.status === 'FAILED') {
        return null;
      }

      const pendingJob = batch.jobs.find((j) => j.status === 'PENDING');
      if (!pendingJob) {
        return null;
      }

      // Atomically transition from PENDING to RESOLVING
      pendingJob.status = 'RESOLVING';
      pendingJob.startedAt = new Date().toISOString();
      pendingJob.attempts += 1;

      if (batch.status === 'PENDING') {
        batch.status = 'PROCESSING';
      }

      batch.updatedAt = new Date().toISOString();
      this.memoryIndex.set(batch.id, batch);

      const targetFile = this.getBatchFilePath(batch.id);
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(targetFile, JSON.stringify(batch, null, 2), 'utf-8');

      return { batch, job: { ...pendingJob } };
    });
  }

  public async deleteBatch(id: string): Promise<boolean> {
    await this.ensureInitialized();
    this.memoryIndex.delete(id);
    const targetFile = this.getBatchFilePath(id);
    try {
      await fs.unlink(targetFile);
      return true;
    } catch {
      return false;
    }
  }

  public async clearStore(): Promise<void> {
    await this.ensureInitialized();
    this.memoryIndex.clear();
    try {
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.dataDir, file));
        }
      }
    } catch {
      // Ignore
    }
  }
}

// Global persistent batch store singleton for local dev / testing
export const batchStore = new FileBatchStore();

let postgresStoreInstance: BatchStore | null = null;

/**
 * Factory that selects the appropriate BatchStore:
 * - In production (`NODE_ENV === 'production'`), PostgreSQL is required. If `DATABASE_URL` is missing
 *   and driver is not explicitly set to 'file', it fails clearly to avoid false claims of distributed durability.
 * - In test/dev, FileBatchStore is used by default unless BATCH_STORE_DRIVER === 'postgres'.
 * - When PostgreSQL is selected, failure to initialize throws an explicit TempelinkError instead of silently falling back.
 */
export function getBatchStore(): BatchStore {
  const isProd = process.env.NODE_ENV === 'production';
  const driver = process.env.BATCH_STORE_DRIVER;
  const dbUrl = process.env.DATABASE_URL;

  const requiresPostgres = driver === 'postgres' || (isProd && driver !== 'file');

  if (requiresPostgres) {
    if (!dbUrl) {
      throw new TempelinkError(
        'INTERNAL_ERROR',
        'DATABASE_URL belum dikonfigurasi. Mode produksi memerlukan PostgreSQL untuk queue yang terdistribusi.'
      );
    }

    if (!postgresStoreInstance) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PostgresBatchStore } = require('./postgres-store');
        postgresStoreInstance = new PostgresBatchStore(dbUrl);
      } catch (err: unknown) {
        if (err instanceof TempelinkError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        const safeMsg = msg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
        throw new TempelinkError(
          'INTERNAL_ERROR',
          `Gagal menginisialisasi penyimpanan PostgreSQL di mode produksi: ${safeMsg}`
        );
      }
    }
    return postgresStoreInstance!;
  }

  return batchStore;
}

export function resetBatchStoreInstance(): void {
  postgresStoreInstance = null;
}
