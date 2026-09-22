import { BatchStore } from './store';
import { JobStatus, QueueJob } from '../types/queue';
import { PlatformResolver } from '../platforms/resolver';
import { TempelinkError, TempelinkErrorCode } from '../types/errors';
import { serverConfig } from '../config';
import { Capability } from '../types/capability';
import { Logger } from '../telemetry/logger';

/**
 * Valid Job State Transitions
 */
export const VALID_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['RESOLVING', 'CANCELLED'],
  RESOLVING: ['READY', 'COMPLETED', 'FAILED', 'CANCELLED'],
  READY: ['DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  DOWNLOADING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_JOB_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Checks if an error is transient and eligible for retry.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TempelinkError) {
    const retryableCodes: TempelinkErrorCode[] = [
      'TEMPORARY_FAILURE',
      'PROVIDER_UNAVAILABLE',
    ];
    return retryableCodes.includes(error.code);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    return (
      name.includes('timeout') ||
      name.includes('abort') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('fetch failed')
    );
  }

  return false;
}

/**
 * Selects the optimal authentic capability for a resolved media item.
 * Strictly honest: Never fabricates HD if < 1080p.
 */
export function selectDefaultCapability(
  capabilities: Capability[]
): Capability | undefined {
  if (!capabilities || capabilities.length === 0) return undefined;

  // 1. Prefer HD video first
  const hdVideo = capabilities.find(
    (c) => c.type === 'video' && c.qualityCategory === 'hd' && c.available
  );
  if (hdVideo) return hdVideo;

  // 2. Next prefer Standard video (e.g. 720p clean)
  const stdVideo = capabilities.find(
    (c) => c.type === 'video' && c.available
  );
  if (stdVideo) return stdVideo;

  // 3. Next prefer Image
  const img = capabilities.find((c) => c.type === 'image' && c.available);
  if (img) return img;

  // 4. Next prefer Audio
  const aud = capabilities.find((c) => c.type === 'audio' && c.available);
  if (aud) return aud;

  // Fallback to first available
  return capabilities[0];
}

/**
 * QueueRunner
 * Concurrency-bounded queue worker pool.
 * Respects `serverConfig.batch.concurrency` (default: 2).
 * Strictly forbids unbounded Promise.all().
 */
export class QueueRunner {
  private activeWorkers = 0;
  private isProcessing = false;
  private inFlightJobs = new Set<string>();
  private store: BatchStore;
  private maxConcurrency: number;

  constructor(store: BatchStore, maxConcurrency?: number) {
    this.store = store;
    this.maxConcurrency =
      maxConcurrency || serverConfig.batch.concurrency || 2;
  }

  public getActiveWorkers(): number {
    return this.activeWorkers;
  }

  public getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  /**
   * Triggers worker loop if capacity exists.
   */
  public async scheduleNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeWorkers < this.maxConcurrency) {
        const nextJobInfo = await this.findNextPendingJob();
        if (!nextJobInfo) {
          break;
        }

        this.activeWorkers++;
        this.inFlightJobs.add(nextJobInfo.jobId);

        // Execute job in background worker slot and release slot upon completion
        this.processJob(nextJobInfo.batchId, nextJobInfo.jobId)
          .catch((err) => {
            Logger.error('[QueueRunner] Unhandled worker failure', {
              error: err instanceof Error ? err.message : String(err),
            });
          })
          .finally(() => {
            this.activeWorkers--;
            this.inFlightJobs.delete(nextJobInfo.jobId);
            // Recursively schedule next job as soon as slot is freed
            this.scheduleNext();
          });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async findNextPendingJob(): Promise<{
    batchId: string;
    jobId: string;
  } | null> {
    const batches = await this.store.listBatches();
    const nowMs = Date.now();
    const STALE_JOB_THRESHOLD_MS = 20000;

    for (const batch of batches) {
      if (batch.status === 'CANCELLED' || batch.status === 'FAILED') continue;

      // 1. Look for cleanly PENDING job
      let candidate = batch.jobs.find(
        (j) => j.status === 'PENDING' && !this.inFlightJobs.has(j.id)
      );

      // 2. If no PENDING job, check for abandoned / stale RESOLVING job (serverless recovery)
      if (!candidate) {
        candidate = batch.jobs.find((j) => {
          if (j.status !== 'RESOLVING' || this.inFlightJobs.has(j.id)) return false;
          if (!j.startedAt) return true;
          return (
            nowMs - new Date(j.startedAt).getTime() > STALE_JOB_THRESHOLD_MS &&
            j.attempts < (j.maxAttempts || 2)
          );
        });
      }

      if (candidate) {
        return { batchId: batch.id, jobId: candidate.id };
      }
    }
    return null;
  }

  /**
   * Atomically claims and processes exactly one pending job in the batch.
   * Safe for serverless polling triggers: exactly one job is claimed per step,
   * preventing duplicate execution even under concurrent polling requests.
   */
  public async processBatchStep(batchId: string): Promise<boolean> {
    if (this.activeWorkers >= this.maxConcurrency) {
      return false;
    }

    const claim = await this.store.claimNextPendingJob(batchId);
    if (!claim) {
      return false;
    }

    this.activeWorkers++;
    this.inFlightJobs.add(claim.job.id);

    try {
      await this.resolveClaimedJob(claim.batch.id, claim.job);
      return true;
    } catch (err) {
      Logger.error('[QueueRunner] Unexpected failure during step execution', err, {
        batchId,
        jobId: claim.job.id,
      });
      return true;
    } finally {
      this.activeWorkers--;
      this.inFlightJobs.delete(claim.job.id);
    }
  }

  private async processJob(batchId: string, jobId: string): Promise<void> {
    const batch = await this.store.getBatch(batchId);
    if (!batch || batch.status === 'CANCELLED') {
      return;
    }

    const job = batch.jobs.find((j) => j.id === jobId);
    if (!job) return;

    const isStaleResolving =
      job.status === 'RESOLVING' &&
      job.startedAt &&
      Date.now() - new Date(job.startedAt).getTime() > 20000;

    if (job.status !== 'PENDING' && !isStaleResolving) {
      return;
    }

    job.attempts = (job.attempts || 0) + 1;
    job.status = 'RESOLVING';
    job.startedAt = new Date().toISOString();

    await this.store.updateJob(batchId, jobId, (j) => {
      j.status = 'RESOLVING';
      j.startedAt = job.startedAt;
      j.attempts = job.attempts;
    });

    await this.resolveClaimedJob(batchId, job);
  }

  private async resolveClaimedJob(
    batchId: string,
    job: QueueJob
  ): Promise<void> {
    const maxAttempts = job.maxAttempts || serverConfig.batch.maxAttempts || 2;
    let success = false;
    let lastError: unknown = null;

    while (job.attempts <= maxAttempts && !success) {
      // Check if batch was cancelled during backoff
      const currentBatch = await this.store.getBatch(batchId);
      if (currentBatch?.status === 'CANCELLED') {
        await this.store.updateJob(batchId, job.id, (j) => {
          j.status = 'CANCELLED';
        });
        return;
      }

      try {
        const publicMedia = await PlatformResolver.resolve(job.sourceUrl, {
          correlationId: `batch_${batchId}_job_${job.id}_att_${job.attempts}`,
        });

        const chosenCap = selectDefaultCapability(publicMedia.capabilities);

        await this.store.updateJob(batchId, job.id, (j) => {
          j.status = 'COMPLETED';
          j.completedAt = new Date().toISOString();
          j.canonicalUrl = publicMedia.sourceUrl;
          j.platform = publicMedia.platform;
          j.capabilityId = chosenCap?.id;
          j.selectedCapability = chosenCap;
          j.mediaMetadata = {
            title: publicMedia.title,
            thumbnailUrl: publicMedia.thumbnailUrl || undefined,
            durationSeconds: publicMedia.durationSeconds,
            author: publicMedia.author,
            availableCapabilitiesCount: publicMedia.capabilities.length,
          };
          j.errorCode = undefined;
          j.errorMessage = undefined;
        });

        success = true;
      } catch (err: unknown) {
        lastError = err;
        const transient = isTransientError(err);

        if (transient && job.attempts < maxAttempts) {
          job.attempts += 1;
          await this.store.updateJob(batchId, job.id, (j) => {
            j.attempts = job.attempts;
          });
          // Exponential backoff: 1500ms * attempt
          await new Promise((resolve) =>
            setTimeout(resolve, 1500 * (job.attempts - 1))
          );
        } else {
          // Terminal failure
          break;
        }
      }
    }

    if (!success) {
      const errCode =
        lastError instanceof TempelinkError
          ? lastError.code
          : 'RESOLUTION_FAILED';
      const errMsg =
        lastError instanceof TempelinkError
          ? lastError.userMessage
          : 'Gagal memproses media dalam antrean batch.';

      await this.store.updateJob(batchId, job.id, (j) => {
        j.status = 'FAILED';
        j.completedAt = new Date().toISOString();
        j.errorCode = errCode;
        j.errorMessage = errMsg;
      });
    }
  }

  /**
   * Cancels an entire batch and marks pending/resolving jobs as CANCELLED.
   */
  public async cancelBatch(batchId: string): Promise<boolean> {
    const batch = await this.store.getBatch(batchId);
    if (!batch) return false;

    batch.status = 'CANCELLED';
    for (const job of batch.jobs) {
      if (['PENDING', 'RESOLVING', 'READY'].includes(job.status)) {
        job.status = 'CANCELLED';
        job.completedAt = new Date().toISOString();
      }
    }
    batch.cancelledJobs = batch.jobs.filter(
      (j) => j.status === 'CANCELLED'
    ).length;
    await this.store.saveBatch(batch);
    return true;
  }
}
