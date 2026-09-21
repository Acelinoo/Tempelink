import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { XProvider } from '../src/lib/platforms/providers/x';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('XProvider — Resolution Engine & Capabilities', () => {
  let provider: XProvider;

  beforeEach(() => {
    provider = new XProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects x.com status URLs and strips tracking parameters', () => {
      const url = new URL(
        'https://x.com/username/status/1234567890123456789?s=20&t=abcdef&utm_source=twitter'
      );
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('1234567890123456789');
      expect(detection.canonicalUrl).toBe('https://x.com/i/status/1234567890123456789');
    });

    it('detects twitter.com status URLs', () => {
      const url = new URL('https://twitter.com/jack/status/20');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('20');
    });

    it('rejects user profile URLs without status ID', () => {
      const url = new URL('https://x.com/username');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is not set', async () => {
      const originalKey = serverConfig.x.apiKey;
      serverConfig.x.apiKey = '';

      const url = new URL('https://x.com/username/status/1234567890123456789');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.x.apiKey = originalKey;
      }
    });
  });

  describe('Upstream Gateway Resolution Contract', () => {
    it('resolves Standard + HD video formats and signs HMAC tokens honestly', async () => {
      const originalKey = serverConfig.x.apiKey;
      serverConfig.x.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: 'success',
        title: 'Check out this awesome launch video!',
        thumbnail: 'https://pbs.twimg.com/media/thumb.jpg',
        formats: [
          {
            quality: '720p',
            url: 'https://video.twimg.com/ext_tw_video/720p.mp4',
            type: 'mp4',
            height: 720,
            width: 1280,
          },
          {
            quality: '1080p',
            url: 'https://video.twimg.com/ext_tw_video/1080p.mp4',
            type: 'mp4',
            height: 1080,
            width: 1920,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://x.com/username/status/1234567890123456789');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('1234567890123456789');
      expect(resolution.platform).toBe('x');
      expect(resolution.mediaType).toBe('video');
      expect(resolution.capabilities.length).toBe(2);

      const standardCap = resolution.capabilities.find((c) =>
        c.label.includes('Standard')
      );
      expect(standardCap).toBeDefined();
      expect(standardCap?.format).toBe('mp4');

      const hdCap = resolution.capabilities.find((c) => c.label.includes('HD'));
      expect(hdCap).toBeDefined();

      const tokenPayload = verifyDownloadToken(standardCap!.downloadToken!);
      expect(tokenPayload).toBeDefined();
      expect(tokenPayload.targetUrl).toBe(
        'https://video.twimg.com/ext_tw_video/720p.mp4'
      );

      serverConfig.x.apiKey = originalKey;
    });

    it('resolves real twitter-video-downloader2 data schema correctly', async () => {
      const originalKey = serverConfig.x.apiKey;
      serverConfig.x.apiKey = 'test_rapidapi_key';

      const mockRealResponse = {
        status: 'success',
        data: {
          username: 'PassengersMovie',
          caption: 'Plan your escape aboard the Starship Avalon',
          thumb: 'https://pbs.twimg.com/media/thumb.jpg',
          src: 'https://video.twimg.com/amplify_video/vid/720x720/k_rRkQYc.mp4',
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRealResponse,
      } as unknown as Response);

      const url = new URL(
        'https://twitter.com/PassengersMovie/status/821025484150423557'
      );
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('821025484150423557');
      expect(resolution.platform).toBe('x');
      expect(resolution.mediaType).toBe('video');
      expect(resolution.title).toBe(
        'Plan your escape aboard the Starship Avalon'
      );
      expect(resolution.thumbnailUrl).toBe(
        'https://pbs.twimg.com/media/thumb.jpg'
      );
      expect(resolution.author?.username).toBe('PassengersMovie');
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].format).toBe('mp4');

      serverConfig.x.apiKey = originalKey;
    });

    it('maps error status to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.x.apiKey;
      serverConfig.x.apiKey = 'test_rapidapi_key';

      const mockErrorResponse = {
        status: 'error',
        message: 'Tweet not found or suspended.',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorResponse,
      } as unknown as Response);

      const url = new URL('https://x.com/username/status/1234567890123456789');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.x.apiKey = originalKey;
      }
    });

    it('filters out private/SSRF target URLs', () => {
      const mockPayload = {
        status: 'success',
        formats: [
          {
            quality: '720p',
            url: 'http://169.254.169.254/latest/meta-data/',
            type: 'mp4',
          },
          {
            quality: '720p',
            url: 'https://video.twimg.com/valid.mp4',
            type: 'mp4',
          },
        ],
      };

      const resolution = provider.normalizePayload(
        mockPayload,
        '1234567890123456789',
        'https://x.com/i/status/1234567890123456789'
      );
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].downloadUrl).toBe(
        'https://video.twimg.com/valid.mp4'
      );
    });
  });
});
