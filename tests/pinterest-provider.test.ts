import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PinterestProvider } from '../src/lib/platforms/providers/pinterest';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('PinterestProvider — Resolution Engine & Capabilities', () => {
  let provider: PinterestProvider;

  beforeEach(() => {
    provider = new PinterestProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects standard pin URLs and strips tracking parameters', () => {
      const url = new URL(
        'https://www.pinterest.com/pin/123456789012345678/?invite_code=abc&sender=123&utm_source=pin'
      );
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('123456789012345678');
      expect(detection.canonicalUrl).toBe(
        'https://www.pinterest.com/pin/123456789012345678/'
      );
    });

    it('detects pin.it shortlinks', () => {
      const url = new URL('https://pin.it/abc1234');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('abc1234');
    });

    it('rejects general explore or search URLs', () => {
      const url = new URL('https://www.pinterest.com/ideas/architecture/');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is missing', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = '';

      const url = new URL('https://www.pinterest.com/pin/123456789012345678/');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.pinterest.apiKey = originalKey;
      }
    });
  });

  describe('Upstream Gateway Resolution Contract', () => {
    it('resolves image pin and signs download token', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: 'success',
        title: 'Modern Minimalist Villa',
        image: 'https://i.pinimg.com/originals/villa_hq.jpg',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://www.pinterest.com/pin/123456789012345678/');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('123456789012345678');
      expect(resolution.platform).toBe('pinterest');
      expect(resolution.mediaType).toBe('image');
      expect(resolution.capabilities.length).toBe(1);

      const cap = resolution.capabilities[0];
      expect(cap.type).toBe('image');
      expect(cap.format).toBe('jpg');

      const verified = verifyDownloadToken(cap.downloadToken!);
      expect(verified).toBeDefined();
      expect(verified.targetUrl).toBe(
        'https://i.pinimg.com/originals/villa_hq.jpg'
      );

      serverConfig.pinterest.apiKey = originalKey;
    });

    it('resolves video pin and maps video capability', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: 'success',
        title: 'Delicious Pasta Recipe',
        videos: [
          {
            url: 'https://v.pinimg.com/videos/pasta_720p.mp4',
            quality: '720p',
            height: 720,
            width: 1280,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://www.pinterest.com/pin/123456789012345678/');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaType).toBe('video');
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].type).toBe('video');
      expect(resolution.capabilities[0].format).toBe('mp4');

      serverConfig.pinterest.apiKey = originalKey;
    });

    it('handles Pinterest error array response correctly by throwing CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = 'test_rapidapi_key';

      const mockErrorArray = [{ error: true }];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorArray,
      } as unknown as Response);

      const url = new URL('https://www.pinterest.com/pin/70437488608239/');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.pinterest.apiKey = originalKey;
      }
    });

    it('resolves Pinterest array format with image items', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = 'test_rapidapi_key';

      const mockArrayPayload = [
        {
          url: 'https://i.pinimg.com/originals/photo1.jpg',
          type: 'image',
          quality: 'original',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockArrayPayload,
      } as unknown as Response);

      const url = new URL('https://www.pinterest.com/pin/70437488608239/');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('70437488608239');
      expect(resolution.platform).toBe('pinterest');
      expect(resolution.mediaType).toBe('image');
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].format).toBe('jpg');

      serverConfig.pinterest.apiKey = originalKey;
    });

    it('maps error response to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.pinterest.apiKey;
      serverConfig.pinterest.apiKey = 'test_rapidapi_key';

      const mockErrorResponse = {
        status: 'error',
        message: 'Pin not found or private.',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorResponse,
      } as unknown as Response);

      const url = new URL('https://www.pinterest.com/pin/123456789012345678/');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.pinterest.apiKey = originalKey;
      }
    });

    it('filters out private/SSRF target URLs', () => {
      const mockPayload = {
        status: 'success',
        images: [
          { url: 'http://127.0.0.1:8080/admin.png' },
          { url: 'https://i.pinimg.com/valid.jpg' },
        ],
      };

      const resolution = provider.normalizePayload(
        mockPayload,
        '123456789012345678',
        'https://www.pinterest.com/pin/123456789012345678/'
      );
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].downloadUrl).toBe(
        'https://i.pinimg.com/valid.jpg'
      );
    });
  });
});
