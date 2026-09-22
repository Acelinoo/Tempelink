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

    it('resolves youtube-media-downloader v2 { videos: { items: [...] }, audios: { items: [...] } }', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = 'test_rapidapi_key';

      const mockV2Payload = {
        errorId: 'Success',
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        lengthSeconds: 213,
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', width: 1280, height: 720 },
        ],
        videos: {
          errorId: 'Success',
          items: [
            {
              url: 'https://rr1---sn-example.googlevideo.com/videoplayback?itag=18',
              quality: '360p',
              width: 640,
              height: 360,
              hasAudio: true,
              extension: 'mp4',
              size: 11829048,
            },
            {
              url: 'https://rr1---sn-example.googlevideo.com/videoplayback?itag=137',
              quality: '1080p',
              width: 1920,
              height: 1080,
              hasAudio: false,
              extension: 'mp4',
              size: 80911999,
            },
          ],
        },
        audios: {
          errorId: 'Success',
          items: [
            {
              url: 'https://rr1---sn-example.googlevideo.com/videoplayback?itag=140',
              extension: 'm4a',
              size: 3449447,
              mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            },
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockV2Payload,
      } as unknown as Response);

      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const res = await provider.resolve(url);

      expect(res.mediaId).toBe('dQw4w9WgXcQ');
      expect(res.title).toBe('Rick Astley - Never Gonna Give You Up');
      expect(res.durationSeconds).toBe(213);
      expect(res.thumbnailUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');

      const audio = res.capabilities.find((c) => c.type === 'audio');
      expect(audio).toBeDefined();
      expect(audio?.format).toBe('m4a');

      const video1080 = res.capabilities.find((c) => c.type === 'video' && c.label.includes('1080p'));
      expect(video1080).toBeDefined();

      serverConfig.youtube.apiKey = originalKey;
    });

    it('throws CONTENT_UNAVAILABLE when v2 errorId is not Success', () => {
      const mockError = {
        errorId: 'InvalidParam',
        reason: 'Video not found or is private.',
      };

      expect(() =>
        provider.normalizePayload(mockError, 'test', 'https://www.youtube.com/watch?v=test')
      ).toThrowError(TempelinkError);
    });

    it('resolves youtube-video-audio-downloader format with direct yqapi Cloudflare streams', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = 'test_key';

      const mockPayload = {
        status: 'success',
        data: {
          title: 'Unboxing + tes fitur baru iPhone 18 Pro & Pro Max!',
          duration: '31:51',
          thumbnail: 'https://i.ytimg.com/vi/BQIwRiMxHXc/maxresdefault.jpg',
          links: [
            {
              type: 'audio',
              download_url: 'https://yqapi.com/api/v1/download?ms=youtube&s=abc&q=bestaudio&f=mp3',
            },
            {
              type: 'video',
              resolution: '428p',
              download_url: 'https://yqapi.com/api/v1/download?ms=youtube&s=abc&q=397&f=mp4',
            },
            {
              type: 'video',
              resolution: '320p',
              download_url: 'https://rr4---sn-test.googlevideo.com/videoplayback?itag=18',
            },
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      } as unknown as Response);

      const url = new URL('https://www.youtube.com/watch?v=BQIwRiMxHXc');
      const res = await provider.resolve(url);

      expect(res.mediaId).toBe('BQIwRiMxHXc');
      expect(res.title).toBe('Unboxing + tes fitur baru iPhone 18 Pro & Pro Max!');
      expect(res.durationSeconds).toBe(1911); // 31 * 60 + 51
      expect(res.thumbnailUrl).toBe('https://i.ytimg.com/vi/BQIwRiMxHXc/maxresdefault.jpg');

      // Check capabilities
      const audioCap = res.capabilities.find((c) => c.type === 'audio');
      expect(audioCap).toBeDefined();
      expect(audioCap?.format).toBe('mp3');
      expect(audioCap?.downloadUrl).toContain('yqapi.com');

      const videoCap = res.capabilities.find((c) => c.type === 'video');
      expect(videoCap).toBeDefined();
      expect(videoCap?.downloadUrl).toContain('yqapi.com');

      serverConfig.youtube.apiKey = originalKey;
    });

    it('resolves youtube-quick-video-downloader format with 4K (2160p) and 2K (1440p) streams', async () => {
      const originalKey = serverConfig.youtube.apiKey;
      serverConfig.youtube.apiKey = 'test_key';

      const mockQuickPayload = [
        {
          resourceId: 'a9LDPn-MO4I',
          urls: [
            {
              url: 'https://rr3---sn-test.googlevideo.com/videoplayback?itag=313',
              name: 'MP4',
              subName: '2160',
              extension: 'mp4',
              quality: '2160',
              audio: false,
              filesize: 1147585264,
            },
            {
              url: 'https://rr3---sn-test.googlevideo.com/videoplayback?itag=271',
              name: 'MP4',
              subName: '1440',
              extension: 'mp4',
              quality: '1440',
              audio: false,
              filesize: 515340905,
            },
            {
              url: 'https://rr3---sn-test.googlevideo.com/videoplayback?itag=140',
              name: 'Audio M4A',
              subName: '140',
              extension: 'm4a',
              quality: '140',
              audio: true,
              filesize: 30927136,
            },
          ],
          meta: {
            title: 'UHDTV TEST 8K VIDEO.mp4',
            duration: '01:00',
          },
          pictureUrl: 'https://i.ytimg.com/vi/a9LDPn-MO4I/hqdefault.jpg',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockQuickPayload,
      } as unknown as Response);

      const url = new URL('https://www.youtube.com/watch?v=a9LDPn-MO4I');
      const res = await provider.resolve(url);

      expect(res.mediaId).toBe('a9LDPn-MO4I');
      expect(res.title).toBe('UHDTV TEST 8K VIDEO.mp4');
      expect(res.durationSeconds).toBe(60);

      // Verify 4K (2160p) capability
      const cap4k = res.capabilities.find((c) => c.resolution === '2160');
      expect(cap4k).toBeDefined();
      expect(cap4k?.label).toContain('2160');
      expect(cap4k?.fileSizeBytes).toBe(1147585264);

      // Verify 2K (1440p) capability
      const cap2k = res.capabilities.find((c) => c.resolution === '1440');
      expect(cap2k).toBeDefined();
      expect(cap2k?.label).toContain('1440');
      expect(cap2k?.fileSizeBytes).toBe(515340905);

      // Verify audio capability
      const audioCap = res.capabilities.find((c) => c.type === 'audio');
      expect(audioCap).toBeDefined();
      expect(audioCap?.format).toBe('m4a');

      serverConfig.youtube.apiKey = originalKey;
    });
  });
});
