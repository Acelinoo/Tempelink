import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FileBatchStore, getBatchStore } from '../src/lib/queue/store';
import { QueueRunner } from '../src/lib/queue/runner';
import { BatchQueueService } from '../src/lib/queue/service';
import { Batch } from '../src/lib/types/queue';
import { PlatformResolver } from '../src/lib/platforms/resolver';

describe('Phase 9 — Distributed Queue Persistence & Concurrent Polling Safety', () => {
  let testDir: string;
  let store: FileBatchStore;
  let runner: QueueRunner;
  let service: BatchQueueService;

  beforeEach(async () => {
    testDir = path.join(
      process.cwd(),
      '.data',
      `test_batches_phase9_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });
    store = new FileBatchStore(testDir);
    runner = new QueueRunner(store, 2);
    service = new BatchQueueService(store, runner);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // Ignore cleanup error on Windows
    }
    vi.restoreAllMocks();
  });

  it('preserves FileBatchStore for local development and offline testing', () => {
    expect(store.driver).toBe('file');
    const defaultStore = getBatchStore();
    expect(defaultStore.driver).toBe('file');
  });

  it('accurately reports storageDriver in BatchSummaryResponse without claiming fake distributed durability', async () => {
    const summary = await service.createBatch(
      ['https://www.tiktok.com/@user/video/7123456789012345678'],
      '127.0.0.1'
    );

    expect(summary.storageDriver).toBe('file');
  });

  it('atomically claims the next pending job and transitions state from PENDING to RESOLVING', async () => {
    const batchId = 'test_batch_atomic_1';
    const now = new Date().toISOString();
    const batch: Batch = {
      id: batchId,
      clientIp: '127.0.0.1',
      status: 'PENDING',
      totalJobs: 2,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      createdAt: now,
      updatedAt: now,
      jobs: [
        {
          id: 'job_1',
          batchId,
          sourceUrl: 'https://www.tiktok.com/@user/video/7123456789012345678',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: now,
        },
        {
          id: 'job_2',
          batchId,
          sourceUrl: 'https://www.tiktok.com/@user/video/7123456789012345679',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: now,
        },
      ],
    };

    await store.saveBatch(batch);

    // 1. Claim first job
    const claim1 = await store.claimNextPendingJob(batchId);
    expect(claim1).not.toBeNull();
    expect(claim1?.job.id).toBe('job_1');
    expect(claim1?.job.status).toBe('RESOLVING');
    expect(claim1?.job.attempts).toBe(1);

    // 2. Claim second job
    const claim2 = await store.claimNextPendingJob(batchId);
    expect(claim2).not.toBeNull();
    expect(claim2?.job.id).toBe('job_2');
    expect(claim2?.job.status).toBe('RESOLVING');

    // 3. No remaining pending jobs -> returns null
    const claim3 = await store.claimNextPendingJob(batchId);
    expect(claim3).toBeNull();
  });

  it('PREVENTS DUPLICATE JOB EXECUTION: 10 concurrent polling requests execute jobs exactly once', async () => {
    let executionCountJob1 = 0;
    let executionCountJob2 = 0;

    // Mock PlatformResolver.resolve to count how many times each URL is actually processed
    vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async (url: string) => {
      // Simulate non-trivial resolution latency
      await new Promise((r) => setTimeout(r, 40));

      if (url.includes('job1')) {
        executionCountJob1++;
      } else if (url.includes('job2')) {
        executionCountJob2++;
      }

      return {
        id: 'media_mock_id',
        platform: 'tiktok',
        mediaType: 'video',
        title: 'Mock Video',
        description: null,
        author: { username: 'tester', displayName: 'Tester' },
        thumbnailUrl: null,
        durationSeconds: 15,
        sourceUrl: url,
        capabilities: [
          {
            id: 'cap_1',
            type: 'video',
            label: 'Standard 720p (MP4)',
            qualityLabel: '720p',
            qualityCategory: 'standard',
            format: 'mp4',
            downloadToken: 'valid_token_mock',
            requiresAuth: false,
            available: true,
          },
        ],
        warnings: [],
      };
    });

    const batchId = 'test_concurrent_polling_batch';
    const now = new Date().toISOString();
    const batch: Batch = {
      id: batchId,
      clientIp: '127.0.0.1',
      status: 'PENDING',
      totalJobs: 2,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      createdAt: now,
      updatedAt: now,
      jobs: [
        {
          id: 'job_url_1',
          batchId,
          sourceUrl: 'https://www.tiktok.com/@u/video/7111111111111111111?tag=job1',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: now,
        },
        {
          id: 'job_url_2',
          batchId,
          sourceUrl: 'https://www.tiktok.com/@u/video/7222222222222222222?tag=job2',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: now,
        },
      ],
    };

    await store.saveBatch(batch);

    // Fire 10 simultaneous concurrent polling requests (simulating multiple tabs/clients polling GET /api/batch/[id])
    const concurrentPolls = Array.from({ length: 10 }, () =>
      service.getBatch(batchId)
    );

    const results = await Promise.all(concurrentPolls);

    // Verify all 10 polling requests succeeded and returned valid batch summary
    expect(results).toHaveLength(10);
    results.forEach((res) => {
      expect(res).not.toBeNull();
      expect(res?.batchId).toBe(batchId);
    });

    // Check final state
    const finalBatch = await store.getBatch(batchId);
    expect(finalBatch).not.toBeNull();

    // CRITICAL: Exactly 1 execution for job1, and exactly 1 execution for job2!
    // No duplicate execution occurred despite 10 simultaneous concurrent requests!
    expect(executionCountJob1).toBe(1);
    expect(executionCountJob2).toBe(1);
    expect(finalBatch?.completedJobs).toBe(2);
    expect(finalBatch?.status).toBe('COMPLETED');
  });
});
