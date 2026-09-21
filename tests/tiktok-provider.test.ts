import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TikTokProvider } from '../src/lib/platforms/providers/tiktok';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('TikTokProvider — Resolution Engine & Capabilities', () => {
  let provider: TikTokProvider;

  beforeEach(() => {
    provider = new TikTokProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects standard video and cleans tracking parameters', () => {
      const url = new URL(
        'https://www.tiktok.com/@creator/video/7123456789012345678?is_from_webapp=1&sender_device=pc&_r=1'
      );
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('7123456789012345678');
      expect(detection.canonicalUrl).not.toContain('is_from_webapp');
      expect(detection.canonicalUrl).not.toContain('sender_device');
      expect(detection.canonicalUrl).toContain('/@creator/video/7123456789012345678');
    });

    it('detects shortlink variants', () => {
      const url = new URL('https://vm.tiktok.com/ZM8rX1234/?_t=8W');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('ZM8rX1234');
      expect(detection.canonicalUrl).not.toContain('_t');
    });

    it('rejects user profile URLs without video ID', () => {
      const url = new URL('https://www.tiktok.com/@creator');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is not configured', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = '';

      const url = new URL('https://www.tiktok.com/@creator/video/7123456789012345678');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.tiktok.apiKey = originalKey;
      }
    });
  });

  describe('Real Upstream Mock Resolution & Honest Capabilities', () => {
    it('resolves Standard + HD + Audio and signs tokens honestly', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      const mockUpstreamResponse = {
        code: 0,
        msg: 'success',
        data: {
          id: '7123456789012345678',
          title: 'Amazing Creative Dance',
          duration: 35,
          cover: 'https://cdn.tiktok.example/cover.jpg',
          author: {
            unique_id: 'cool_dancer',
            nickname: 'Cool Dancer',
            avatar: 'https://cdn.tiktok.example/avatar.jpg',
          },
          play: 'https://cdn.tiktok.example/standard_play.mp4',
          hdplay: 'https://cdn.tiktok.example/hd_1080p_play.mp4',
          music: 'https://cdn.tiktok.example/music.mp3',
          music_info: {
            title: 'Original Sound - Cool Dancer',
          },
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as Response);

      const url = new URL('https://www.tiktok.com/@cool_dancer/video/7123456789012345678');
      const result = await provider.resolve(url);

      expect(result.mediaId).toBe('7123456789012345678');
      expect(result.title).toBe('Amazing Creative Dance');
      expect(result.author?.username).toBe('cool_dancer');
      expect(result.durationSeconds).toBe(35);

      // Exactly 3 capabilities: standard, hd, audio
      expect(result.capabilities.length).toBe(3);

      const standardCap = result.capabilities.find((c) => c.qualityCategory === 'standard');
      expect(standardCap).toBeDefined();
      expect(standardCap?.resolution).toBe('720p');
      expect(standardCap?.downloadToken).toBeDefined();

      const hdCap = result.capabilities.find((c) => c.qualityCategory === 'hd');
      expect(hdCap).toBeDefined();
      expect(hdCap?.resolution).toBe('1080p');
      expect(hdCap?.downloadToken).toBeDefined();

      const audioCap = result.capabilities.find((c) => c.type === 'audio');
      expect(audioCap).toBeDefined();
      expect(audioCap?.format).toBe('mp3');

      // Verify signed download token payload
      const verified = verifyDownloadToken(standardCap!.downloadToken!);
      expect(verified.targetUrl).toBe('https://cdn.tiktok.example/standard_play.mp4');

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('never fabricates HD if upstream returns only standard play', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      const mockUpstreamResponse = {
        code: 0,
        data: {
          id: '7123456789012345678',
          title: '720p Only Video',
          play: 'https://cdn.tiktok.example/standard_play.mp4',
          // Notice: hdplay is null / absent
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');
      const result = await provider.resolve(url);

      expect(result.capabilities.length).toBe(1);
      expect(result.capabilities[0].qualityCategory).toBe('standard');
      expect(result.capabilities.some((c) => c.qualityCategory === 'hd')).toBe(false);

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('maps 404 upstream to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');

      try {
        await provider.resolve(url);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      }

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('maps 429 upstream to RATE_LIMITED', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
      } as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');

      try {
        await provider.resolve(url);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('RATE_LIMITED');
      }

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('maps malformed upstream JSON to RESOLUTION_FAILED', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      } as unknown as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');

      try {
        await provider.resolve(url);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('RESOLUTION_FAILED');
      }

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('maps upstream AbortError timeout to TEMPORARY_FAILURE', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');

      try {
        await provider.resolve(url);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('TEMPORARY_FAILURE');
      }

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('retries transient 5xx errors and succeeds if next attempt is ok', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: {
              id: '7123456789012345678',
              title: 'Retry Succeeded Video',
              play: 'https://cdn.tiktok.example/stream.mp4',
            },
          }),
        } as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');
      const result = await provider.resolve(url);

      expect(result.mediaId).toBe('7123456789012345678');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      serverConfig.tiktok.apiKey = originalKey;
    });

    it('does not retry 4xx errors (fails immediately on first attempt)', async () => {
      const originalKey = serverConfig.tiktok.apiKey;
      serverConfig.tiktok.apiKey = 'test_key_123';

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const url = new URL('https://www.tiktok.com/@user/video/7123456789012345678');

      try {
        await provider.resolve(url);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_UNAVAILABLE');
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);

      serverConfig.tiktok.apiKey = originalKey;
    });
  });
});

