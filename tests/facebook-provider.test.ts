import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FacebookProvider } from '../src/lib/platforms/providers/facebook';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('FacebookProvider — Resolution Engine & Capabilities', () => {
  let provider: FacebookProvider;

  beforeEach(() => {
    provider = new FacebookProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects watch URLs and strips tracking parameters', () => {
      const url = new URL(
        'https://www.facebook.com/watch/?v=1234567890&mibextid=wwXIfr&rdid=123'
      );
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('1234567890');
      expect(detection.canonicalUrl).toBe(
        'https://www.facebook.com/watch/?v=1234567890'
      );
    });

    it('detects reel URLs', () => {
      const url = new URL('https://www.facebook.com/reel/9876543210');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('9876543210');
      expect(detection.canonicalUrl).toBe(
        'https://www.facebook.com/reel/9876543210'
      );
    });

    it('detects fb.watch shortlinks', () => {
      const url = new URL('https://fb.watch/shortid123/');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('shortid123');
    });

    it('rejects general profile or group URLs', () => {
      const url = new URL('https://www.facebook.com/groups/feed/');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is missing', async () => {
      const originalKey = serverConfig.facebook.apiKey;
      serverConfig.facebook.apiKey = '';

      const url = new URL('https://www.facebook.com/watch/?v=1234567890');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.facebook.apiKey = originalKey;
      }
    });
  });

  describe('Upstream Gateway Resolution Contract', () => {
    it('resolves SD and HD streams and signs HMAC tokens honestly', async () => {
      const originalKey = serverConfig.facebook.apiKey;
      serverConfig.facebook.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: 'success',
        title: 'Hilarious Comedy Sketch',
        thumbnail: 'https://scontent.xx.fbcdn.net/thumb.jpg',
        links: {
          'Download High Quality':
            'https://video.xx.fbcdn.net/v/t42.1790-2/hd_video.mp4',
          'Download Low Quality':
            'https://video.xx.fbcdn.net/v/t42.1790-2/sd_video.mp4',
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://www.facebook.com/watch/?v=1234567890');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('1234567890');
      expect(resolution.platform).toBe('facebook');
      expect(resolution.mediaType).toBe('video');
      expect(resolution.capabilities.length).toBe(2);

      const hdCap = resolution.capabilities.find((c) => c.label.includes('HD'));
      expect(hdCap).toBeDefined();
      expect(hdCap?.format).toBe('mp4');

      const sdCap = resolution.capabilities.find((c) =>
        c.label.includes('Standard')
      );
      expect(sdCap).toBeDefined();

      const verified = verifyDownloadToken(hdCap!.downloadToken!);
      expect(verified).toBeDefined();
      expect(verified.targetUrl).toBe(
        'https://video.xx.fbcdn.net/v/t42.1790-2/hd_video.mp4'
      );

      serverConfig.facebook.apiKey = originalKey;
    });

    it('resolves real facebook-reels-and-video-downloader schema with media dimensions', async () => {
      const originalKey = serverConfig.facebook.apiKey;
      serverConfig.facebook.apiKey = 'test_rapidapi_key';

      const mockRealResponse = {
        success: true,
        title: 'Hilarious Reel',
        thumbnail: 'https://scontent.xx.fbcdn.net/thumb.jpg',
        media: [
          {
            hd_url: 'https://video.xx.fbcdn.net/hd.mp4',
            sd_url: 'https://video.xx.fbcdn.net/sd.mp4',
            width: 1080,
            height: 1920,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRealResponse,
      } as unknown as Response);

      const url = new URL('https://www.facebook.com/reel/1921056328602745');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('1921056328602745');
      expect(resolution.platform).toBe('facebook');
      expect(resolution.mediaType).toBe('video');
      expect(resolution.capabilities.length).toBe(2);

      const hd = resolution.capabilities.find((c) => c.label.includes('HD'));
      expect(hd).toBeDefined();

      const sd = resolution.capabilities.find((c) =>
        c.label.includes('Standard')
      );
      expect(sd).toBeDefined();

      serverConfig.facebook.apiKey = originalKey;
    });

    it('maps error response to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.facebook.apiKey;
      serverConfig.facebook.apiKey = 'test_rapidapi_key';

      const mockErrorResponse = {
        status: 'error',
        message: 'Video is private or unavailable.',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorResponse,
      } as unknown as Response);

      const url = new URL('https://www.facebook.com/watch/?v=1234567890');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.facebook.apiKey = originalKey;
      }
    });

    it('filters out private/SSRF stream URLs', () => {
      const mockPayload = {
        status: 'success',
        results: [
          { quality: 'HD', url: 'http://10.0.0.1/stream.mp4' },
          { quality: 'SD', url: 'https://video.xx.fbcdn.net/valid_sd.mp4' },
        ],
      };

      const resolution = provider.normalizePayload(
        mockPayload,
        '1234567890',
        'https://www.facebook.com/watch/?v=1234567890'
      );
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].downloadUrl).toBe(
        'https://video.xx.fbcdn.net/valid_sd.mp4'
      );
    });
  });
});
