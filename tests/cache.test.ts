import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResolveCache,
  canonicalizeUrlForCache,
} from '../src/lib/cache/resolve-cache';
import { PublicMediaResponse } from '../src/lib/types/media';
import { TempelinkError } from '../src/lib/types/errors';
import { PlatformResolver } from '../src/lib/platforms/resolver';
import { serverConfig } from '../src/lib/config';

describe('Phase 7 — ResolveCache & Performance Optimization', () => {
  let cache: ResolveCache;

  const mockMediaResponse: PublicMediaResponse = {
    id: 'test_123',
    platform: 'tiktok',
    mediaType: 'video',
    title: 'Test TikTok Video',
    description: 'Test description',
    author: {
      name: 'Tester',
      username: 'tester',
      avatarUrl: null,
      profileUrl: null,
    },
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    durationSeconds: 15,
    sourceUrl: 'https://www.tiktok.com/@tester/video/1234567890123456789',
    capabilities: [
      {
        id: 'tt_test_123_std',
        type: 'video',
        qualityCategory: 'standard',
        label: 'Standard 720p',
        format: 'mp4',
        available: true,
        downloadUrl: '/api/media/download?token=valid_token',
        downloadToken: 'valid_token',
      },
    ],
    warnings: [],
  };

  beforeEach(() => {
    cache = new ResolveCache();
    cache.clear();
  });

  describe('1. URL Canonicalization', () => {
    it('strips common marketing, tracking, and platform query parameters', () => {
      const raw =
        'https://www.tiktok.com/@user/video/123456789?utm_source=twitter&utm_medium=social&_r=1&_t=8aBcDe&is_from_webapp=1';
      const canonical = canonicalizeUrlForCache(raw);
      expect(canonical).toBe('https://www.tiktok.com/@user/video/123456789');
    });

    it('removes trailing slash on pathname for consistent cache keys', () => {
      const u1 = 'https://www.instagram.com/reel/C3b4X9vL123/';
      const u2 = 'https://www.instagram.com/reel/C3b4X9vL123';
      expect(canonicalizeUrlForCache(u1)).toBe(canonicalizeUrlForCache(u2));
    });

    it('sorts remaining query parameters deterministically', () => {
      const u1 = 'https://example.com/watch?b=2&a=1';
      const u2 = 'https://example.com/watch?a=1&b=2';
      expect(canonicalizeUrlForCache(u1)).toBe(canonicalizeUrlForCache(u2));
    });
  });

  describe('2. Cache Hit & Miss', () => {
    it('returns MISS on first resolve, then HIT on subsequent resolve', async () => {
      const resolverFn = vi.fn().mockResolvedValue(mockMediaResponse);
      const key = cache.generateKey('tiktok', mockMediaResponse.sourceUrl);

      // First call -> LIVE
      const res1 = await cache.getOrResolve(key, 'c1', resolverFn);
      expect(res1.source).toBe('LIVE');
      expect(res1.data.id).toBe('test_123');
      expect(resolverFn).toHaveBeenCalledTimes(1);

      // Second call -> CACHE (HIT)
      const res2 = await cache.getOrResolve(key, 'c2', resolverFn);
      expect(res2.source).toBe('CACHE');
      expect(res2.data.id).toBe('test_123');
      expect(resolverFn).toHaveBeenCalledTimes(1); // resolver not called again!
    });

    it('matches cache key even when secondary request has tracking parameters', async () => {
      const resolverFn = vi.fn().mockResolvedValue(mockMediaResponse);
      const rawUrl1 = 'https://www.tiktok.com/@tester/video/1234567890123456789';
      const rawUrl2 =
        'https://www.tiktok.com/@tester/video/1234567890123456789?utm_source=share&igsh=123';

      const key1 = cache.generateKey('tiktok', rawUrl1);
      const key2 = cache.generateKey('tiktok', rawUrl2);
      expect(key1).toBe(key2);

      await cache.getOrResolve(key1, 'c1', resolverFn);
      const res2 = await cache.getOrResolve(key2, 'c2', resolverFn);
      expect(res2.source).toBe('CACHE');
      expect(resolverFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. TTL Expiration', () => {
    it('expires cached entry when TTL elapses', async () => {
      const resolverFn = vi.fn().mockResolvedValue(mockMediaResponse);
      const key = cache.generateKey('tiktok', mockMediaResponse.sourceUrl);

      // Set with 0.1s TTL
      cache.setSuccess(key, mockMediaResponse, 0.05);

      const entryImmediately = cache.get(key);
      expect(entryImmediately).not.toBeNull();
      expect(entryImmediately?.type).toBe('success');

      // Wait 60ms for TTL expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      const entryExpired = cache.get(key);
      expect(entryExpired).toBeNull();
    });
  });

  describe('4. Error Caching Policy', () => {
    it('caches fatal semantic errors with negative TTL', async () => {
      const fatalErr = new TempelinkError(
        'CONTENT_UNAVAILABLE',
        'Media telah dihapus.'
      );
      const resolverFn = vi.fn().mockRejectedValue(fatalErr);
      const key = cache.generateKey('tiktok', 'https://www.tiktok.com/@u/video/999');

      // First call throws fatalErr
      await expect(cache.getOrResolve(key, 'c1', resolverFn)).rejects.toThrow(
        'Media telah dihapus.'
      );
      expect(resolverFn).toHaveBeenCalledTimes(1);

      // Second call immediately throws cached error without calling resolver again
      await expect(cache.getOrResolve(key, 'c2', resolverFn)).rejects.toThrow(
        'Media telah dihapus.'
      );
      expect(resolverFn).toHaveBeenCalledTimes(1);
    });

    it('NEVER caches transient errors like timeouts or provider outages', async () => {
      const transientErr = new TempelinkError(
        'TEMPORARY_FAILURE',
        'Timeout connecting to provider.'
      );
      const resolverFn = vi
        .fn()
        .mockRejectedValueOnce(transientErr)
        .mockResolvedValueOnce(mockMediaResponse);

      const key = cache.generateKey('tiktok', mockMediaResponse.sourceUrl);

      // First call fails with transient error
      await expect(cache.getOrResolve(key, 'c1', resolverFn)).rejects.toThrow(
        'Timeout connecting to provider.'
      );
      expect(resolverFn).toHaveBeenCalledTimes(1);

      // Second call MUST retry and call resolverFn again
      const retryRes = await cache.getOrResolve(key, 'c2', resolverFn);
      expect(retryRes.source).toBe('LIVE');
      expect(retryRes.data.id).toBe('test_123');
      expect(resolverFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. Single-Flight Request Coalescing (Thundering Herd Defense)', () => {
    it('coalesces 10 simultaneous identical resolve calls into exactly 1 provider execution', async () => {
      let executionCount = 0;
      const delayedResolver = async (): Promise<PublicMediaResponse> => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return mockMediaResponse;
      };

      const key = cache.generateKey('tiktok', mockMediaResponse.sourceUrl);

      // Fire 10 simultaneous requests concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.getOrResolve(key, `corr_${i}`, delayedResolver)
      );

      const results = await Promise.all(promises);

      // Exactly 1 underlying provider execution occurred!
      expect(executionCount).toBe(1);

      // All 10 callers received valid data
      results.forEach((r) => {
        expect(r.data.id).toBe('test_123');
      });

      // 1 was LIVE, 9 were COALESCED
      const liveCount = results.filter((r) => r.source === 'LIVE').length;
      const coalescedCount = results.filter((r) => r.source === 'COALESCED').length;
      expect(liveCount).toBe(1);
      expect(coalescedCount).toBe(9);

      // In-flight map is clean after resolution
      expect(cache.getInFlightCount()).toBe(0);
    });

    it('propagates errors to all waiting coalesced callers and cleans in-flight state', async () => {
      const delayedErrorResolver = async (): Promise<PublicMediaResponse> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        throw new TempelinkError('INVALID_URL', 'Invalid format.');
      };

      const key = cache.generateKey('tiktok', 'https://www.tiktok.com/@u/video/bad');

      const promises = Array.from({ length: 5 }, (_, i) =>
        cache.getOrResolve(key, `corr_err_${i}`, delayedErrorResolver)
      );

      const settled = await Promise.allSettled(promises);

      // All 5 rejected with the same error
      settled.forEach((s) => {
        expect(s.status).toBe('rejected');
        if (s.status === 'rejected') {
          expect(s.reason.message).toContain('Invalid format.');
        }
      });

      // In-flight state was cleaned up
      expect(cache.getInFlightCount()).toBe(0);
    });
  });

  describe('6. Bounded Eviction & LRU Ordering', () => {
    it('evicts oldest entries when cache reaches capacity', () => {
      const originalMax = serverConfig.cache.maxEntries;
      serverConfig.cache.maxEntries = 3;

      try {
        cache.setSuccess('k1', mockMediaResponse, 300);
        cache.setSuccess('k2', mockMediaResponse, 300);
        cache.setSuccess('k3', mockMediaResponse, 300);

        expect(cache.getCacheSize()).toBe(3);
        expect(cache.get('k1')).not.toBeNull();

        // Access k1 to make k2 the least recently used
        cache.get('k1');

        // Add k4 -> should evict k2
        cache.setSuccess('k4', mockMediaResponse, 300);
        expect(cache.getCacheSize()).toBe(3);
        expect(cache.get('k2')).toBeNull(); // k2 evicted
        expect(cache.get('k1')).not.toBeNull(); // k1 kept
        expect(cache.get('k3')).not.toBeNull(); // k3 kept
        expect(cache.get('k4')).not.toBeNull(); // k4 kept
      } finally {
        serverConfig.cache.maxEntries = originalMax;
      }
    });
  });

  describe('7. Security & SSRF Integration Guard', () => {
    it('does NOT bypass SSRF validation when resolving through PlatformResolver', async () => {
      // PlatformResolver must check SSRF BEFORE checking cache or provider
      await expect(
        PlatformResolver.resolve('http://127.0.0.1/evil.mp4')
      ).rejects.toThrow();

      await expect(
        PlatformResolver.resolve('http://169.254.169.254/latest/meta-data')
      ).rejects.toThrow();
    });
  });
});
