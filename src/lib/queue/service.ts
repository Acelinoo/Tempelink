import { randomUUID } from 'node:crypto';
import { Batch, BatchSummaryResponse, QueueJob } from '../types/queue';
import { getBatchStore, BatchStore } from './store';
import { QueueRunner } from './runner';
import { serverConfig } from '../config';
import { TempelinkError } from '../types/errors';
import { PlatformDetector } from '../platforms/detector';

export class BatchQueueService {
  private customStore?: BatchStore;
  private customRunner?: QueueRunner;

  constructor(store?: BatchStore, runner?: QueueRunner) {
    this.customStore = store;
    this.customRunner = runner;
  }

  public getRunner(): QueueRunner {
    if (this.customRunner) return this.customRunner;
    return new QueueRunner(this.getStore());
  }

  public getStore(): BatchStore {
    return this.customStore || getBatchStore();
  }

  /**
   * Parses, validates, deduplicates, and enqueues a new batch.
   */
  public async createBatch(
    rawUrls: string[],
    clientIp: string
  ): Promise<BatchSummaryResponse> {
    if (!rawUrls || !Array.isArray(rawUrls) || rawUrls.length === 0) {
      throw new TempelinkError(
        'INVALID_URL',
        'Daftar tautan batch tidak boleh kosong.'
      );
    }

    // 1. Clean, trim, ignore empty lines
    const cleanedList: string[] = [];
    for (const raw of rawUrls) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
          cleanedList.push(trimmed);
        }
      }
    }

    if (cleanedList.length === 0) {
      throw new TempelinkError(
        'INVALID_URL',
        'Tidak ada tautan URL yang valid pada input yang diberikan.'
      );
    }

    // 2. Deduplicate exact URLs while preserving order
    const deduplicatedUrls: string[] = [];
    const seen = new Set<string>();
    for (const u of cleanedList) {
      if (!seen.has(u)) {
        seen.add(u);
        deduplicatedUrls.push(u);
      }
    }

    // 3. Enforce maximum batch size limit (default: 10)
    const maxBatchSize = serverConfig.batch.maxBatchSize || 10;
    if (deduplicatedUrls.length > maxBatchSize) {
      throw new TempelinkError(
        'BATCH_TOO_LARGE',
        `Jumlah URL melebihi batas maksimal batch (maksimal ${maxBatchSize} tautan per batch). Ditemukan ${deduplicatedUrls.length} tautan.`,
        { maxBatchSize, count: deduplicatedUrls.length }
      );
    }

    // 4. Enforce client active batch quota limit (default: 2 active batches)
    const activeBatches =
      await this.getStore().getActiveBatchesForClient(clientIp);
    const maxActive = serverConfig.batch.maxActiveBatchesPerClient || 2;
    if (activeBatches.length >= maxActive) {
      throw new TempelinkError(
        'BATCH_LIMIT_EXCEEDED',
        `Batas antrean batch aktif tercapai (maksimal ${maxActive} batch aktif sekaligus). Silakan tunggu batch sebelumnya selesai.`
      );
    }

    // 5. Pre-detect platform signatures for initial UX clarity
    const batchId = randomUUID();
    const now = new Date().toISOString();

    const jobs: QueueJob[] = deduplicatedUrls.map((url) => {
      let detectedPlatform = 'unknown';
      try {
        const detection = PlatformDetector.detect(url);
        detectedPlatform = detection.platformId || 'unknown';
      } catch {
        detectedPlatform = 'unknown';
      }

      return {
        id: randomUUID(),
        batchId,
        sourceUrl: url,
        platform: detectedPlatform,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: serverConfig.batch.maxAttempts || 2,
        createdAt: now,
      };
    });

    const newBatch: Batch = {
      id: batchId,
      clientIp,
      status: 'PENDING',
      totalJobs: jobs.length,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      createdAt: now,
      updatedAt: now,
      jobs,
    };

    // 6. Persist to backing store
    await this.getStore().saveBatch(newBatch);

    // 7. Schedule background processing asynchronously
    this.getRunner().scheduleNext().catch(() => {
      // Background execution handled safely
    });

    return this.toSummaryResponse(newBatch);
  }

  /**
   * Retrieves a batch and triggers processing if there are remaining pending jobs.
   * Safe for serverless: advances an atomic job step if jobs are pending, and triggers scheduler.
   */
  public async getBatch(id: string): Promise<BatchSummaryResponse | null> {
    let batch = await this.getStore().getBatch(id);
    if (!batch) return null;

    // Trigger atomic progress step if there are pending jobs and batch is active
    if (
      batch.status === 'PENDING' ||
      batch.status === 'PROCESSING' ||
      batch.jobs.some((j) => j.status === 'PENDING')
    ) {
      // 1. Advance an atomic step if no active background workers are already running
      if (this.getRunner().getActiveWorkers() === 0) {
        await this.getRunner().processBatchStep(id).catch(() => {});
      }
      // 2. Also trigger background runner if environment supports asynchronous loops
      this.getRunner().scheduleNext().catch(() => {});

      // Refresh batch state to reflect completed step
      batch = (await this.getStore().getBatch(id)) || batch;
    }

    return this.toSummaryResponse(batch);
  }

  /**
   * Cancels an active batch.
   */
  public async cancelBatch(id: string): Promise<boolean> {
    const success = await this.getRunner().cancelBatch(id);
    return success;
  }

  /**
   * Retries an individual failed job.
   */
  public async retryJob(
    batchId: string,
    jobId: string
  ): Promise<BatchSummaryResponse | null> {
    const updated = await this.getStore().updateJob(batchId, jobId, (j) => {
      j.status = 'PENDING';
      j.attempts = 0;
      j.errorCode = undefined;
      j.errorMessage = undefined;
      j.completedAt = undefined;
    });

    if (!updated) return null;

    // Reset batch status to PROCESSING if it was finished
    if (
      updated.batch.status === 'FAILED' ||
      updated.batch.status === 'PARTIAL_SUCCESS' ||
      updated.batch.status === 'COMPLETED'
    ) {
      updated.batch.status = 'PROCESSING';
      await this.getStore().saveBatch(updated.batch);
    }

    this.getRunner().scheduleNext().catch(() => {});
    return this.toSummaryResponse(updated.batch);
  }

  private toSummaryResponse(batch: Batch): BatchSummaryResponse {
    return {
      batchId: batch.id,
      status: batch.status,
      total: batch.totalJobs,
      completed: batch.completedJobs,
      failed: batch.failedJobs,
      cancelled: batch.cancelledJobs,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      jobs: batch.jobs,
      storageDriver: this.getStore().driver,
    };
  }
}

// Global batch queue service singleton
export const batchQueueService = new BatchQueueService();
