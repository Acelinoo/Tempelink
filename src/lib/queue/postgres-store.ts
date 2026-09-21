import { Batch, QueueJob } from '../types/queue';
import { BatchStore } from './store';
import { TempelinkError } from '../types/errors';
import { Logger } from '../telemetry/logger';

/**
 * PostgresBatchStore
 * Production-hardened PostgreSQL storage engine for distributed serverless deployments.
 * Implements row-level locking (FOR UPDATE) for atomic state transitions and race-free concurrent job claims.
 */
export class PostgresBatchStore implements BatchStore {
  public readonly driver = 'postgres' as const;
  private connectionString: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  private isInitialized = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  private async getPool() {
    if (this.pool) return this.pool;
    try {
      const moduleName = 'pg';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pg: any = await import(/* webpackIgnore: true */ moduleName);
      const Pool = pg.Pool || pg.default?.Pool;
      if (!Pool) {
        throw new Error('PostgreSQL Pool constructor not found');
      }
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      return this.pool;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError(
        'INTERNAL_ERROR',
        `Koneksi PostgreSQL gagal: ${safeMsg}`
      );
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  public async initSchema(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const pool = await this.getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tempelink_batches (
          id VARCHAR(64) PRIMARY KEY,
          client_ip VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL,
          total_jobs INT NOT NULL,
          completed_jobs INT NOT NULL DEFAULT 0,
          failed_jobs INT NOT NULL DEFAULT 0,
          cancelled_jobs INT NOT NULL DEFAULT 0,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_batches_client_ip_status ON tempelink_batches(client_ip, status);
        CREATE INDEX IF NOT EXISTS idx_batches_created_at ON tempelink_batches(created_at DESC);
      `);
      this.isInitialized = true;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      Logger.error('[PostgresBatchStore] Failed to initialize schema', safeMsg);
      throw new TempelinkError('INTERNAL_ERROR', `Inisialisasi skema PostgreSQL gagal: ${safeMsg}`);
    }
  }

  public async saveBatch(batch: Batch): Promise<void> {
    await this.initSchema();
    const pool = await this.getPool();
    const now = new Date().toISOString();
    batch.updatedAt = now;

    try {
      await pool.query(
        `
        INSERT INTO tempelink_batches (id, client_ip, status, total_jobs, completed_jobs, failed_jobs, cancelled_jobs, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          completed_jobs = EXCLUDED.completed_jobs,
          failed_jobs = EXCLUDED.failed_jobs,
          cancelled_jobs = EXCLUDED.cancelled_jobs,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
        `,
        [
          batch.id,
          batch.clientIp,
          batch.status,
          batch.totalJobs,
          batch.completedJobs,
          batch.failedJobs,
          batch.cancelledJobs,
          JSON.stringify(batch),
          batch.createdAt,
          batch.updatedAt,
        ]
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal menyimpan batch ke database: ${safeMsg}`);
    }
  }

  public async getBatch(id: string): Promise<Batch | null> {
    await this.initSchema();
    const pool = await this.getPool();
    try {
      const res = await pool.query(
        'SELECT data FROM tempelink_batches WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) return null;
      return typeof res.rows[0].data === 'string'
        ? JSON.parse(res.rows[0].data)
        : res.rows[0].data;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal membaca batch dari database: ${safeMsg}`);
    }
  }

  public async listBatches(): Promise<Batch[]> {
    await this.initSchema();
    const pool = await this.getPool();
    try {
      const res = await pool.query(
        'SELECT data FROM tempelink_batches ORDER BY created_at DESC LIMIT 100'
      );
      return res.rows.map((r: { data: string | Batch }) =>
        typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal membaca antrean batch dari database: ${safeMsg}`);
    }
  }

  public async getActiveBatchesForClient(clientIp: string): Promise<Batch[]> {
    await this.initSchema();
    const pool = await this.getPool();
    try {
      const res = await pool.query(
        `SELECT data FROM tempelink_batches
         WHERE client_ip = $1 AND status IN ('PENDING', 'PROCESSING')`,
        [clientIp]
      );
      return res.rows.map((r: { data: string | Batch }) =>
        typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal memeriksa kuota batch aktif dari database: ${safeMsg}`);
    }
  }

  public async updateJob(
    batchId: string,
    jobId: string,
    updater: (job: QueueJob) => void
  ): Promise<{ batch: Batch; job: QueueJob } | null> {
    await this.initSchema();
    const pool = await this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const selectRes = await client.query(
        'SELECT data FROM tempelink_batches WHERE id = $1 FOR UPDATE',
        [batchId]
      );
      if (selectRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const rawData = selectRes.rows[0].data;
      const batch: Batch =
        typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const job = batch.jobs.find((j) => j.id === jobId);
      if (!job) {
        await client.query('ROLLBACK');
        return null;
      }

      updater(job);

      // Recalculate summary stats
      batch.completedJobs = batch.jobs.filter((j) => j.status === 'COMPLETED').length;
      batch.failedJobs = batch.jobs.filter((j) => j.status === 'FAILED').length;
      batch.cancelledJobs = batch.jobs.filter((j) => j.status === 'CANCELLED').length;

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

      await client.query(
        `UPDATE tempelink_batches SET
           status = $1,
           completed_jobs = $2,
           failed_jobs = $3,
           cancelled_jobs = $4,
           data = $5,
           updated_at = $6
         WHERE id = $7`,
        [
          batch.status,
          batch.completedJobs,
          batch.failedJobs,
          batch.cancelledJobs,
          JSON.stringify(batch),
          batch.updatedAt,
          batch.id,
        ]
      );

      await client.query('COMMIT');
      return { batch, job };
    } catch (err: unknown) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal memperbarui status pekerjaan di database: ${safeMsg}`);
    } finally {
      client.release();
    }
  }

  public async claimNextPendingJob(
    batchId: string
  ): Promise<{ batch: Batch; job: QueueJob } | null> {
    await this.initSchema();
    const pool = await this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const selectRes = await client.query(
        'SELECT data FROM tempelink_batches WHERE id = $1 FOR UPDATE',
        [batchId]
      );
      if (selectRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const rawData = selectRes.rows[0].data;
      const batch: Batch =
        typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      if (batch.status === 'CANCELLED' || batch.status === 'FAILED') {
        await client.query('ROLLBACK');
        return null;
      }

      const pendingJob = batch.jobs.find((j) => j.status === 'PENDING');
      if (!pendingJob) {
        await client.query('ROLLBACK');
        return null;
      }

      // Atomically claim job
      pendingJob.status = 'RESOLVING';
      pendingJob.startedAt = new Date().toISOString();
      pendingJob.attempts += 1;

      if (batch.status === 'PENDING') {
        batch.status = 'PROCESSING';
      }

      batch.updatedAt = new Date().toISOString();

      await client.query(
        `UPDATE tempelink_batches SET
           status = $1,
           data = $2,
           updated_at = $3
         WHERE id = $4`,
        [batch.status, JSON.stringify(batch), batch.updatedAt, batch.id]
      );

      await client.query('COMMIT');
      return { batch, job: { ...pendingJob } };
    } catch (err: unknown) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal mengklaim pekerjaan antrean di database: ${safeMsg}`);
    } finally {
      client.release();
    }
  }

  public async deleteBatch(id: string): Promise<boolean> {
    await this.initSchema();
    const pool = await this.getPool();
    try {
      const res = await pool.query(
        'DELETE FROM tempelink_batches WHERE id = $1',
        [id]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal menghapus batch dari database: ${safeMsg}`);
    }
  }

  public async clearStore(): Promise<void> {
    await this.initSchema();
    const pool = await this.getPool();
    try {
      await pool.query('TRUNCATE TABLE tempelink_batches');
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = rawMsg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new TempelinkError('INTERNAL_ERROR', `Gagal membersihkan tabel database: ${safeMsg}`);
    }
  }
}
