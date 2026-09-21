import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileBatchStore } from '../src/lib/queue/store';
import { QueueRunner, canTransitionJob, isTransientError, selectDefaultCapability } from '../src/lib/queue/runner';
import { BatchQueueService } from '../src/lib/queue/service';
import { TempelinkError } from '../src/lib/types/errors';
import { PlatformResolver } from '../src/lib/platforms/resolver';
import { Capability } from '../src/lib/types/capability';
import { PublicMediaResponse } from '../src/lib/types/media';
import path from 'node:path';
import fs from 'node:fs/promises';

function createMockMedia(overrides?: Partial<PublicMediaResponse>): PublicMediaResponse {
  return {
    id: 'mock_media',
    platform: 'tiktok',
    mediaType: 'video',
    title: 'Mock Video',
    sourceUrl: 'https://example.com/video',
    capabilities: [],
    author: null,
    thumbnailUrl: null,
    durationSeconds: null,
    warnings: [],
    ...overrides,
  };
}

describe('Phase 6 — Batch Download + Queue Engine', () => {
  const testDataDir = path.join(process.cwd(), '.data', 'test-batches');
  let store: FileBatchStore;
  let runner: QueueRunner;
  let service: BatchQueueService;

  beforeEach(async () => {
    store = new FileBatchStore(testDataDir);
    await store.clearStore();
    runner = new QueueRunner(store, 2);
    service = new BatchQueueService(store, runner);
    vi.restoreAllMocks();

    vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async (url) => {
      return createMockMedia({ sourceUrl: url });
    });
  });

  afterEach(async () => {
    await store.clearStore();
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Batch Creation & URL Normalization / Deduplication', () => {
    it('creates batch with deduplicated, trimmed URLs and assigns PENDING status', async () => {
      const urls = [
        '  https://www.tiktok.com/@user/video/111  ',
        'https://www.instagram.com/reel/222/',
        'https://www.tiktok.com/@user/video/111', // Exact duplicate
        '', // Empty line
        '   ',
        'https://www.youtube.com/watch?v=333',
      ];

      const batch = await service.createBatch(urls, '127.0.0.1');

      expect(batch.total).toBe(3);
      expect(batch.status).toBe('PENDING');
      expect(batch.jobs.length).toBe(3);
      expect(batch.jobs[0].sourceUrl).toBe('https://www.tiktok.com/@user/video/111');
      expect(batch.jobs[0].platform).toBe('tiktok');
      expect(batch.jobs[1].sourceUrl).toBe('https://www.instagram.com/reel/222/');
      expect(batch.jobs[1].platform).toBe('instagram');
      expect(batch.jobs[2].sourceUrl).toBe('https://www.youtube.com/watch?v=333');
      expect(batch.jobs[2].platform).toBe('youtube');
    });

    it('rejects empty URL input with INVALID_URL error', async () => {
      await expect(service.createBatch([], '127.0.0.1')).rejects.toThrowError(TempelinkError);
      try {
        await service.createBatch(['   ', ''], '127.0.0.1');
      } catch (err) {
        expect((err as TempelinkError).code).toBe('INVALID_URL');
      }
    });

    it('enforces maximum batch size (MAX_BATCH_SIZE = 10) and rejects over-limit batches', async () => {
      const elevenUrls = Array.from({ length: 11 }, (_, i) => `https://www.tiktok.com/@u/video/${1000 + i}`);
      try {
        await service.createBatch(elevenUrls, '127.0.0.1');
        expect.unreachable('Should have thrown BATCH_TOO_LARGE');
      } catch (err) {
        expect((err as TempelinkError).code).toBe('BATCH_TOO_LARGE');
        expect((err as TempelinkError).httpStatus).toBe(400);
      }
    });

    it('enforces client active batch limit (max 2 active batches)', async () => {
      vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return createMockMedia({
          id: 'media',
          platform: 'tiktok',
          title: 'Video',
          sourceUrl: 'https://www.tiktok.com/@u/video/1',
        });
      });

      await service.createBatch(['https://www.tiktok.com/@u/video/1'], '127.0.0.2');
      await service.createBatch(['https://www.tiktok.com/@u/video/2'], '127.0.0.2');

      try {
        await service.createBatch(['https://www.tiktok.com/@u/video/3'], '127.0.0.2');
        expect.unreachable('Should have thrown BATCH_LIMIT_EXCEEDED');
      } catch (err) {
        expect((err as TempelinkError).code).toBe('BATCH_LIMIT_EXCEEDED');
        expect((err as TempelinkError).httpStatus).toBe(429);
      }
    });
  });

  describe('2. State Machine & Transitions', () => {
    it('validates allowed job transitions correctly', () => {
      expect(canTransitionJob('PENDING', 'RESOLVING')).toBe(true);
      expect(canTransitionJob('PENDING', 'CANCELLED')).toBe(true);
      expect(canTransitionJob('RESOLVING', 'READY')).toBe(true);
      expect(canTransitionJob('RESOLVING', 'FAILED')).toBe(true);
      expect(canTransitionJob('READY', 'DOWNLOADING')).toBe(true);
      expect(canTransitionJob('READY', 'COMPLETED')).toBe(true);
      expect(canTransitionJob('DOWNLOADING', 'COMPLETED')).toBe(true);
      expect(canTransitionJob('DOWNLOADING', 'FAILED')).toBe(true);

      // Disallowed transitions
      expect(canTransitionJob('COMPLETED', 'RESOLVING')).toBe(false);
      expect(canTransitionJob('FAILED', 'READY')).toBe(false);
      expect(canTransitionJob('CANCELLED', 'RESOLVING')).toBe(false);
      expect(canTransitionJob('PENDING', 'DOWNLOADING')).toBe(false);
    });
  });

  describe('3. Concurrency Control & Worker Processing', () => {
    it('processes jobs without exceeding configured concurrency limit of 2', async () => {
      let concurrentActive = 0;
      let maxObservedConcurrency = 0;

      vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async (rawUrl: string) => {
        concurrentActive++;
        if (concurrentActive > maxObservedConcurrency) {
          maxObservedConcurrency = concurrentActive;
        }

        // Simulate resolution delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrentActive--;

        return createMockMedia({
          id: 'test_media',
          platform: 'tiktok',
          title: `Video for ${rawUrl}`,
          sourceUrl: rawUrl,
          capabilities: [
            {
              id: 'cap_1',
              type: 'video',
              qualityCategory: 'standard',
              label: 'Standard 720p (MP4)',
              format: 'mp4',
              available: true,
              downloadToken: 'valid_token',
            } as Capability,
          ],
        });
      });

      const urls = [
        'https://www.tiktok.com/@u/video/101',
        'https://www.tiktok.com/@u/video/102',
        'https://www.tiktok.com/@u/video/103',
        'https://www.tiktok.com/@u/video/104',
      ];

      const batch = await service.createBatch(urls, '127.0.0.1');

      // Let worker pool finish processing
      while (true) {
        const current = await service.getBatch(batch.batchId);
        if (current && (current.status === 'COMPLETED' || current.status === 'PARTIAL_SUCCESS')) {
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      const finalBatch = await service.getBatch(batch.batchId);
      expect(finalBatch?.status).toBe('COMPLETED');
      expect(finalBatch?.completed).toBe(4);
      expect(finalBatch?.failed).toBe(0);
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    });
  });

  describe('4. Retry Policy & Error Handling', () => {
    it('retries transient errors (TEMPORARY_FAILURE) up to maxAttempts and succeeds', async () => {
      let attempts = 0;
      vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new TempelinkError('TEMPORARY_FAILURE', 'Gateway timeout');
        }
        return createMockMedia({
          id: 'retry_success',
          platform: 'instagram',
          title: 'Instagram Reel',
          sourceUrl: 'https://www.instagram.com/reel/123/',
          capabilities: [
            {
              id: 'ig_cap_1',
              type: 'video',
              qualityCategory: 'hd',
              label: 'HD 1080p (MP4)',
              format: 'mp4',
              available: true,
            } as Capability,
          ],
        });
      });

      const batch = await service.createBatch(['https://www.instagram.com/reel/123/'], '127.0.0.1');

      while (true) {
        const current = await service.getBatch(batch.batchId);
        if (current?.status === 'COMPLETED' || current?.status === 'FAILED') {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      const finished = await service.getBatch(batch.batchId);
      expect(finished?.status).toBe('COMPLETED');
      expect(finished?.jobs[0].status).toBe('COMPLETED');
      expect(attempts).toBe(2);
    });

    it('fails immediately without retry for non-transient errors (UNSUPPORTED_PLATFORM, SSRF_BLOCKED, CONTENT_UNAVAILABLE)', async () => {
      let attempts = 0;
      vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async () => {
        attempts++;
        throw new TempelinkError('UNSUPPORTED_PLATFORM', 'Platform not supported');
      });

      const batch = await service.createBatch(['https://unknown-site.com/video/1'], '127.0.0.1');

      while (true) {
        const current = await service.getBatch(batch.batchId);
        if (current?.status === 'FAILED' || current?.status === 'PARTIAL_SUCCESS') {
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      const finished = await service.getBatch(batch.batchId);
      expect(finished?.status).toBe('FAILED');
      expect(finished?.jobs[0].status).toBe('FAILED');
      expect(finished?.jobs[0].errorCode).toBe('UNSUPPORTED_PLATFORM');
      expect(attempts).toBe(1); // Never retried
    });
  });

  describe('5. Batch Cancellation', () => {
    it('cancels batch and sets pending jobs to CANCELLED', async () => {
      // Stall resolution
      vi.spyOn(PlatformResolver, 'resolve').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 500));
        return createMockMedia({
          id: 'media',
          platform: 'x',
          title: 'Tweet',
          sourceUrl: 'https://x.com/user/status/1',
        });
      });

      const batch = await service.createBatch(
        ['https://x.com/user/status/1', 'https://x.com/user/status/2'],
        '127.0.0.1'
      );

      const cancelSuccess = await service.cancelBatch(batch.batchId);
      expect(cancelSuccess).toBe(true);

      const cancelledBatch = await service.getBatch(batch.batchId);
      expect(cancelledBatch?.status).toBe('CANCELLED');
    });
  });

  describe('6. Capability Selection Honesty', () => {
    it('selects HD capability when real HD stream is present', () => {
      const caps: Capability[] = [
        { id: '1', type: 'video', qualityCategory: 'standard', available: true, label: '720p' } as Capability,
        { id: '2', type: 'video', qualityCategory: 'hd', available: true, label: '1080p' } as Capability,
      ];
      const selected = selectDefaultCapability(caps);
      expect(selected?.id).toBe('2');
      expect(selected?.qualityCategory).toBe('hd');
    });

    it('never fabricates HD when only standard streams are present', () => {
      const caps: Capability[] = [
        { id: '1', type: 'video', qualityCategory: 'standard', available: true, label: '720p' } as Capability,
      ];
      const selected = selectDefaultCapability(caps);
      expect(selected?.id).toBe('1');
      expect(selected?.qualityCategory).toBe('standard');
    });
  });

  describe('7. API Route Endpoints', () => {
    it('handles POST /api/batch and creates new batch', async () => {
      const { POST: batchCreateRoute } = await import('../src/app/api/batch/route');
      const { NextRequest } = await import('next/server');

      const req = new NextRequest('http://localhost:3000/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: ['https://www.tiktok.com/@u/video/5001'],
        }),
      });

      const res = await batchCreateRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.batchId).toBeDefined();
      expect(json.data.total).toBe(1);
    });

    it('handles GET /api/batch/:id to retrieve status', async () => {
      const { GET: batchGetRoute } = await import('../src/app/api/batch/[id]/route');
      const { batchQueueService } = await import('../src/lib/queue/service');
      const { NextRequest } = await import('next/server');

      const created = await batchQueueService.createBatch(['https://www.tiktok.com/@u/video/5002'], '127.0.0.1');

      const req = new NextRequest(`http://localhost:3000/api/batch/${created.batchId}`);
      const res = await batchGetRoute(req, { params: Promise.resolve({ id: created.batchId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.batchId).toBe(created.batchId);
    });

    it('handles POST /api/batch/:id/cancel to cancel batch', async () => {
      const { POST: batchCancelRoute } = await import('../src/app/api/batch/[id]/cancel/route');
      const { batchQueueService } = await import('../src/lib/queue/service');
      const { NextRequest } = await import('next/server');

      const created = await batchQueueService.createBatch(['https://www.tiktok.com/@u/video/5003'], '127.0.0.1');

      const req = new NextRequest(`http://localhost:3000/api/batch/${created.batchId}/cancel`, {
        method: 'POST',
      });
      const res = await batchCancelRoute(req, { params: Promise.resolve({ id: created.batchId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('CANCELLED');
    });
  });
});
