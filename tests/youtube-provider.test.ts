import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubeProvider } from '../src/lib/platforms/providers/youtube';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';
import { verifyDownloadToken } from '../src/lib/security/token';

describe('YouTubeProvider — Resolution Engine & Capabilities', () => {
  let provider: YouTubeProvider;

  beforeEach(() => {
    provider = new YouTubeProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Detection & Cleaning', () => {
    it('detects watch URLs and strips tracking parameters', () => {
      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=123456&feature=shared');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('dQw4w9WgXcQ');
      expect(detection.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('detects youtu.be short URLs', () => {
      const url = new URL('https://youtu.be/dQw4w9WgXcQ?si=abcdef');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('dQw4w9WgXcQ');
      expect(detection.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('detects shorts URLs', () => {
      const url = new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      const detection = provider.detect(url);

      expect(detection.status).toBe('SUPPORTED_PLATFORM');
      expect(detection.mediaId).toBe('dQw4w9WgXcQ');
      expect(detection.canonicalUrl).toBe('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    });

    it('rejects channel or invalid URLs', () => {
      const url = new URL('https://www.youtube.com/@RickAstleyYT');
      const detection = provider.detect(url);

      expect(detection.status).toBe('UNSUPPORTED_MEDIA');
    });
  });

  describe('Provider Configuration Guard', () => {
    it('throws PROVIDER_NOT_CONFIGURED if API key is missing', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = '';

      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      await expect(provider.resolve(url)).rejects.toThrowError(TempelinkError);

      try {
        await provider.resolve(url);
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('PROVIDER_NOT_CONFIGURED');
        expect((err as TempelinkError).httpStatus).toBe(503);
      } finally {
        serverConfig.youtube.apiKey = originalKey;
      }
    });
  });

  describe('Real Upstream Gateway Resolution Contract (/download.php)', () => {
    it('resolves RapidAPI { status: "ok", results: [...] } with M4A audio and video streams', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = 'test_rapidapi_key';

      const mockUpstreamResponse = {
        status: 'ok',
        status_code: 200,
        title: 'Rick Astley - Never Gonna Give You Up',
        duration: '213',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        results: [
          {
            quality: 'M4A',
            mime: 'audio/mp4',
            has_audio: true,
            url: 'https://rr2---sn-4g5ednss.googlevideo.com/videoplayback?audio_stream',
          },
          {
            quality: '720p',
            mime: 'video/mp4',
            has_audio: false,
            url: 'https://rr2---sn-4g5ednss.googlevideo.com/videoplayback?video_720p',
          },
          {
            quality: '1080p',
            mime: 'video/mp4',
            has_audio: false,
            url: 'https://rr2---sn-4g5ednss.googlevideo.com/videoplayback?video_1080p',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpstreamResponse,
      } as unknown as Response);

      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const resolution = await provider.resolve(url);

      expect(resolution.mediaId).toBe('dQw4w9WgXcQ');
      expect(resolution.platform).toBe('youtube');
      expect(resolution.title).toBe('Rick Astley - Never Gonna Give You Up');
      expect(resolution.durationSeconds).toBe(213);

      // Verify audio capability
      const audioCap = resolution.capabilities.find((c) => c.type === 'audio');
      expect(audioCap).toBeDefined();
      expect(audioCap?.format).toBe('m4a');
      expect(audioCap?.label).toBe('Audio Original (M4A)');

      // Verify video capabilities
      const standardCap = resolution.capabilities.find(
        (c) => c.type === 'video' && c.label.includes('720p')
      );
      expect(standardCap).toBeDefined();
      expect(standardCap?.label).toContain('Standard 720p');

      const hdCap = resolution.capabilities.find(
        (c) => c.type === 'video' && c.label.includes('1080p')
      );
      expect(hdCap).toBeDefined();
      expect(hdCap?.label).toContain('HD 1080p');

      // Verify HMAC token
      const tokenVerified = verifyDownloadToken(standardCap!.downloadToken!);
      expect(tokenVerified).toBeDefined();
      expect(tokenVerified.mediaId).toBe('dQw4w9WgXcQ');

      serverConfig.youtube.apiKey = originalKey;
    });

    it('maps error or status_code: 404 to CONTENT_UNAVAILABLE', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = 'test_rapidapi_key';

      const mockErrorResponse = {
        status: 'error',
        status_code: 404,
        message: 'Video not found or is private.',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockErrorResponse,
      } as unknown as Response);

      const url = new URL('https://www.youtube.com/watch?v=invalidid11');

      try {
        await provider.resolve(url);
        expect.unreachable('Should have thrown TempelinkError');
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('CONTENT_UNAVAILABLE');
      } finally {
        serverConfig.youtube.apiKey = originalKey;
      }
    });

    it('filters out private/SSRF stream URLs', () => {
      const mockPayload = {
        status: 'ok',
        title: 'Test',
        results: [
          {
            quality: '720p',
            mime: 'video/mp4',
            url: 'http://localhost:3000/internal',
          },
          {
            quality: '360p',
            mime: 'video/mp4',
            url: 'https://rr1---sn-example.googlevideo.com/videoplayback',
          },
        ],
      };

      const resolution = provider.normalizePayload(mockPayload, 'test_id', 'https://www.youtube.com/watch?v=test_id');
      expect(resolution.capabilities.length).toBe(1);
      expect(resolution.capabilities[0].downloadUrl).toBe('https://rr1---sn-example.googlevideo.com/videoplayback');
    });
  });
});
