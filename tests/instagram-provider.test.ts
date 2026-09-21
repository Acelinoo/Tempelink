import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstagramProvider } from '../src/lib/platforms/providers/instagram';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('InstagramProvider — Resolution Engine & Capabilities', () => {
  let provider: InstagramProvider;

  beforeEach(() => {
    provider = new InstagramProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects reels and strips tracking parameters', () => {
      const url = new URL('https://www.instagram.com/reel/C-iTZ5cg08A/?igsh=MWQ4...&utm_source=qr');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('C-iTZ5cg08A');
      expect(detection.canonicalUrl).not.toContain('igsh');
      expect(detection.canonicalUrl).not.toContain('utm_source');
      expect(detection.canonicalUrl).toContain('/reel/C-iTZ5cg08A');
    });

    it('detects posts (/p/)', () => {
      const url = new URL('https://www.instagram.com/p/DB12345XYZ/');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('DB12345XYZ');
      expect(detection.mediaType).toBe('carousel');
    });

    it('rejects general profile URLs', () => {
      const url = new URL('https://www.instagram.com/instagram/');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is not configured', async () => {
      const originalKey = serverConfig.instagram.apiKey;
      serverConfig.instagram.apiKey = '';

      const url = new URL('https://www.instagram.com/reel/C-iTZ5cg08A/');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.instagram.apiKey = originalKey;
      }
    });
  });

  describe('Real Upstream Gateway Resolution Contract', () => {
    it('resolves RapidAPI { status: true, result: [...] } schema with verified video', async () => {
      const originalKey = serverConfig.instagram.apiKey;
      serverConfig.instagram.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: true,
        time: 1.25,
        result: [
          {
            url: 'https://scontent-iad3-1.cdninstagram.com/v/t50.2886-16/vid.mp4',
            type: 'video/mp4',
            size: '8947715',
            thumb: 'https://cdn.example.com/thumb.jpg',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://www.instagram.com/reel/C-iTZ5cg08A/');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('C-iTZ5cg08A');
      expect(resolution.platform).toBe('instagram');
      expect(resolution.capabilities.length).toBe(1);

      const cap = resolution.capabilities[0];
      expect(cap.type).toBe('video');
      expect(cap.format).toBe('mp4');
      expect(cap.downloadToken).toBeDefined();

      const verified = verifyDownloadToken(cap.downloadToken!);
      expect(verified).toBeDefined();
      expect(verified.targetUrl).toBe('https://scontent-iad3-1.cdninstagram.com/v/t50.2886-16/vid.mp4');

      serverConfig.instagram.apiKey = originalKey;
    });

    it('maps { status: false, message: "Invalid URL" } to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.instagram.apiKey;
      serverConfig.instagram.apiKey = 'test_rapidapi_key';

      const mockErrorResponse = {
        status: false,
        result: null,
        message: 'Invalid URL',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorResponse,
      } as unknown as Response);

      const url = new URL('https://www.instagram.com/reel/nonexistent123/');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.instagram.apiKey = originalKey;
      }
    });

    it('handles image carousel posts properly', () => {
      const mockPayload = {
        status: true,
        result: [
          {
            url: 'https://scontent.cdninstagram.com/img1.jpg',
            type: 'image/jpeg',
            thumb: 'https://scontent.cdninstagram.com/thumb1.jpg',
          },
          {
            url: 'https://scontent.cdninstagram.com/img2.jpg',
            type: 'image/jpeg',
            thumb: 'https://scontent.cdninstagram.com/thumb2.jpg',
          },
        ],
      };

      const resolution = provider.normalizePayload(mockPayload, 'post123', 'https://www.instagram.com/p/post123/');
      expect(resolution.mediaType).toBe('carousel');
      expect(resolution.capabilities.length).toBe(2);
      expect(resolution.capabilities[0].type).toBe('image');
      expect(resolution.capabilities[1].type).toBe('image');
    });

    it('filters out private/SSRF URLs in result items', () => {
      const mockPayload = {
        status: true,
        result: [
          {
            url: 'http://169.254.169.254/latest/meta-data/',
            type: 'video/mp4',
          },
          {
            url: 'https://scontent.cdninstagram.com/valid.mp4',
            type: 'video/mp4',
          },
        ],
      };

      const resolution = provider.normalizePayload(mockPayload, 'post456', 'https://www.instagram.com/reel/post456/');
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].downloadUrl).toBe('https://scontent.cdninstagram.com/valid.mp4');
    });
  });
});
