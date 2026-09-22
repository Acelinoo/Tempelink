import { BasePlatformProvider } from '../core/base-provider';
import { DetectionResult, ProviderContext } from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';
import { TempelinkError } from '../../types/errors';
import { serverConfig } from '../../config';
import {
  createVideoCapability,
  createAudioCapability,
  categorizeVideoQuality,
} from '../capabilities';
import { generateDownloadToken } from '../../security/token';
import { validateUrlSafety } from '../../security/ssrf';
import { Logger } from '../../telemetry/logger';

export interface YouTubeFormatItem {
  quality?: string;
  format?: string;
  url: string;
  hasAudio?: boolean;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
}

export class YouTubeProvider extends BasePlatformProvider {
  public readonly id = 'youtube';
  public readonly name = 'YouTube';
  public readonly supportedDomains = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'music.youtube.com',
  ];
  public readonly supportedMediaTypes: MediaType[] = ['video', 'audio'];
  public readonly exampleUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  private readonly idPattern = /^[A-Za-z0-9_-]{11}$/;

  /**
   * Cleans tracking query parameters from YouTube URLs.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      'si',
      'feature',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'pp',
      't',
      'ab_channel',
    ];
    trackingParams.forEach((param) => clean.searchParams.delete(param));
    return clean.toString();
  }

  public detect(url: URL): DetectionResult {
    const host = url.hostname.toLowerCase();
    let videoId: string | null = null;
    let isShort = false;

    if (host === 'youtu.be') {
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts[0] && this.idPattern.test(pathParts[0])) {
        videoId = pathParts[0];
      }
    } else if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        const pathParts = url.pathname.replace('/shorts/', '').split('/').filter(Boolean);
        if (pathParts[0] && this.idPattern.test(pathParts[0])) {
          videoId = pathParts[0];
          isShort = true;
        }
      } else if (url.pathname === '/watch') {
        const v = url.searchParams.get('v');
        if (v && this.idPattern.test(v)) {
          videoId = v;
        }
      } else if (url.pathname.startsWith('/embed/')) {
        const pathParts = url.pathname.replace('/embed/', '').split('/').filter(Boolean);
        if (pathParts[0] && this.idPattern.test(pathParts[0])) {
          videoId = pathParts[0];
        }
      }
    }

    if (!videoId) {
      return {
        status: 'UNSUPPORTED_MEDIA',
        platformId: this.id,
        platformName: this.name,
        errorMessage: 'Link YouTube ini bukan video atau shorts yang valid.',
      };
    }

    const canonicalUrl = isShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;

    return {
      status: 'SUPPORTED_PLATFORM',
      platformId: this.id,
      platformName: this.name,
      mediaType: 'video',
      canonicalUrl,
      mediaId: videoId,
    };
  }

  public async resolve(
    url: URL,
    context?: ProviderContext
  ): Promise<MediaResolution> {
    const correlationId = context?.correlationId;
    const detection = this.detect(url);

    if (detection.status !== 'SUPPORTED_PLATFORM' || !detection.mediaId) {
      throw new TempelinkError(
        'UNSUPPORTED_MEDIA',
        detection.errorMessage || 'Link YouTube tidak valid.'
      );
    }

    const apiKey = serverConfig.youtube.apiKey;
    if (!apiKey) {
      Logger.warn(
        '[YouTubeProvider] API key is missing in server environment',
        { correlationId }
      );
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan YouTube belum dikonfigurasi dengan API token yang valid.'
      );
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${detection.mediaId}`;
    const isNewDownloader =
      serverConfig.youtube.apiHost.includes('youtube-media-downloader') ||
      serverConfig.youtube.baseUrl.includes('youtube-media-downloader');

    const endpointPath = isNewDownloader
      ? `/v2/video/details?videoId=${encodeURIComponent(detection.mediaId)}`
      : `/download.php?id=${encodeURIComponent(detection.mediaId)}`;

    const endpointUrl = new URL(
      endpointPath,
      serverConfig.youtube.baseUrl
    ).toString();

    const maxRetries = serverConfig.youtube.maxRetries;
    let attempt = 0;
    let lastError: Error | null = null;
    let response: Response | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        response = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': serverConfig.youtube.apiHost,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(serverConfig.youtube.resolveTimeoutMs),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 404) {
          throw new TempelinkError(
            'CONTENT_UNAVAILABLE',
            'Video YouTube tidak ditemukan, bersifat privat, atau telah dihapus.'
          );
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text();
          if (bodyText.includes('not subscribed')) {
            throw new TempelinkError(
              'PROVIDER_UNAVAILABLE',
              'Gateway API YouTube memerlukan aktivasi langganan di dashboard penyedia.'
            );
          }
          throw new TempelinkError(
            'PRIVATE_CONTENT',
            'Video YouTube bersifat privat atau memerlukan autentikasi akun.'
          );
        }

        if (response.status === 429) {
          throw new TempelinkError(
            'RATE_LIMITED',
            'Batas kuota gateway YouTube tercapai. Silakan coba beberapa saat lagi.'
          );
        }

        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }

        throw new TempelinkError(
          'PROVIDER_UNAVAILABLE',
          `Penyedia YouTube merespons dengan kode kesalahan HTTP ${response.status}.`
        );
      } catch (err: unknown) {
        if (err instanceof TempelinkError) throw err;

        const isTimeout =
          err instanceof Error &&
          (err.name === 'TimeoutError' || err.name === 'AbortError');

        if (isTimeout) {
          if (attempt <= maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 400));
            continue;
          }
          throw new TempelinkError(
            'TEMPORARY_FAILURE',
            'Waktu koneksi ke gateway YouTube habis. Silakan coba kembali.'
          );
        }

        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }
      }
    }

    if (!response || !response.ok) {
      Logger.error(
        '[YouTubeProvider] Upstream exhaustion or failure',
        { error: lastError?.message, correlationId }
      );
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Gagal menghubungi server YouTube setelah beberapa kali percobaan.'
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Format respons dari gateway YouTube tidak dapat diproses.'
      );
    }

    return this.normalizePayload(payload, detection.mediaId, canonicalUrl);
  }

  /**
   * Normalizes gateway response into unified MediaResolution with signed tokens.
   */
  public normalizePayload(
    payload: Record<string, unknown>,
    mediaId: string,
    sourceUrl: string
  ): MediaResolution {
    if (
      payload.status === 'error' ||
      payload.status_code === 404 ||
      (typeof payload.errorId === 'string' && payload.errorId !== 'Success')
    ) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        (payload.message as string) ||
          (payload.reason as string) ||
          'Video YouTube tidak ditemukan, bersifat privat, atau telah dihapus.'
      );
    }

    const rawFormats: YouTubeFormatItem[] = [];

    // Format: youtube-media-downloader v2 ({ videos: { items: [...] }, audios: { items: [...] } })
    if (
      payload.videos &&
      typeof payload.videos === 'object' &&
      Array.isArray((payload.videos as { items?: unknown[] }).items)
    ) {
      const videoItems = (payload.videos as { items: Record<string, unknown>[] }).items;
      for (const item of videoItems) {
        if (item && typeof item.url === 'string') {
          rawFormats.push({
            url: item.url,
            quality: (item.quality as string) || '720p',
            format: (item.extension as string) || 'mp4',
            hasAudio: Boolean(item.hasAudio),
            fileSizeBytes: typeof item.size === 'number' ? item.size : null,
            width: typeof item.width === 'number' ? item.width : null,
            height: typeof item.height === 'number' ? item.height : null,
          });
        }
      }
    }

    if (
      payload.audios &&
      typeof payload.audios === 'object' &&
      Array.isArray((payload.audios as { items?: unknown[] }).items)
    ) {
      const audioItems = (payload.audios as { items: Record<string, unknown>[] }).items;
      for (const item of audioItems) {
        if (item && typeof item.url === 'string') {
          rawFormats.push({
            url: item.url,
            quality: 'audio',
            format: (item.extension as string) || 'm4a',
            hasAudio: true,
            fileSizeBytes: typeof item.size === 'number' ? item.size : null,
          });
        }
      }
    }

    // Format A (Verified RapidAPI): { status: "ok", results: [ { quality, mime, has_audio, url } ] }
    if (Array.isArray(payload.results)) {
      for (const item of payload.results) {
        if (item && typeof item.url === 'string') {
          rawFormats.push({
            url: item.url,
            quality: item.quality,
            format: item.mime?.startsWith('audio') ? 'm4a' : 'mp4',
            hasAudio: item.has_audio,
            fileSizeBytes: item.fileSizeBytes || null,
          });
        }
      }
    } else if (Array.isArray(payload.formats)) {
      for (const item of payload.formats) {
        if (item && typeof item.url === 'string') {
          rawFormats.push(item as YouTubeFormatItem);
        }
      }
    } else if (Array.isArray(payload.videos)) {
      for (const item of payload.videos) {
        if (item && typeof item.url === 'string') {
          rawFormats.push(item as YouTubeFormatItem);
        }
      }
    } else if (Array.isArray(payload.links)) {
      for (const item of payload.links) {
        if (item && typeof item.url === 'string') {
          rawFormats.push(item as YouTubeFormatItem);
        }
      }
    } else if (typeof payload.url === 'string') {
      rawFormats.push({
        url: payload.url as string,
        quality: (payload.quality as string) || '720p',
        format: (payload.format as string) || 'mp4',
      });
    }

    if (rawFormats.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan stream media yang dapat diunduh pada link YouTube ini.'
      );
    }

    const title = (payload.title as string) || `YouTube Video (${mediaId})`;
    let thumbnail = (payload.thumbnail as string) || '';
    if (!thumbnail && Array.isArray(payload.thumbnails) && payload.thumbnails.length > 0) {
      const thumbs = payload.thumbnails as Array<{ url?: string }>;
      thumbnail = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
    }
    if (!thumbnail) {
      thumbnail = `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg`;
    }
    const durationSeconds =
      typeof payload.lengthSeconds === 'number'
        ? payload.lengthSeconds
        : payload.duration
        ? parseInt(String(payload.duration), 10) || null
        : null;

    const capabilities = [];
    const seenQualities = new Set<string>();

    for (let i = 0; i < rawFormats.length; i++) {
      const item = rawFormats[i];

      // Validate stream URL against SSRF boundary
      try {
        const parsedStreamUrl = new URL(item.url);
        validateUrlSafety(parsedStreamUrl);
      } catch {
        continue;
      }

      const qualityRaw = (item.quality || 'standard').toLowerCase();
      const format = (item.format || 'mp4').toLowerCase();
      const isAudio =
        qualityRaw.includes('audio') ||
        qualityRaw === 'm4a' ||
        format === 'mp3' ||
        format === 'm4a' ||
        format === 'weba' ||
        (item.hasAudio === true && !qualityRaw.includes('p'));

      const key = `${isAudio ? 'audio' : 'video'}_${qualityRaw}_${format}`;
      if (seenQualities.has(key)) {
        continue;
      }
      seenQualities.add(key);

      if (isAudio) {
        const isMp3 = format === 'mp3' || qualityRaw.includes('mp3');
        const audioFormat = isMp3 ? 'mp3' : format === 'weba' ? 'weba' : 'm4a';
        const mimeType = isMp3
          ? 'audio/mpeg'
          : audioFormat === 'weba'
          ? 'audio/webm'
          : 'audio/mp4';
        const label = isMp3
          ? 'Audio (MP3)'
          : audioFormat === 'weba'
          ? 'Audio Original (WEBA)'
          : 'Audio Original (M4A)';
        const capabilityId =
          audioFormat === 'm4a' ? `yt_${mediaId}_audio` : `yt_${mediaId}_audio_${audioFormat}`;
        const filename = `youtube_${mediaId}_audio.${audioFormat}`;
        const downloadToken = generateDownloadToken({
          mediaId,
          capabilityId,
          sourceUrl,
          targetUrl: item.url,
          filename,
          mimeType,
        });

        capabilities.push(
          createAudioCapability({
            id: capabilityId,
            format: audioFormat,
            label,
            fileSizeBytes: item.fileSizeBytes || null,
            downloadUrl: item.url,
            downloadToken,
          })
        );
      } else {
        const qualityCat = categorizeVideoQuality(
          item.height,
          item.width,
          qualityRaw
        );
        const resolutionClean = qualityRaw.match(/\d{3,4}p?/)?.[0] || '720p';
        const capabilityId = `yt_${mediaId}_${qualityCat}_${i + 1}`;
        const label =
          qualityCat === 'hd'
            ? `HD ${resolutionClean} (MP4)`
            : `Standard ${resolutionClean} (MP4)`;
        const filename = `youtube_${mediaId}_${qualityCat}_${resolutionClean}.mp4`;

        const downloadToken = generateDownloadToken({
          mediaId,
          capabilityId,
          sourceUrl,
          targetUrl: item.url,
          filename,
          mimeType: 'video/mp4',
        });

        capabilities.push(
          createVideoCapability({
            id: capabilityId,
            resolution: resolutionClean,
            format: 'mp4',
            label,
            hasAudio: item.hasAudio ?? true,
            fileSizeBytes: item.fileSizeBytes || null,
            downloadUrl: item.url,
            downloadToken,
          })
        );
      }
    }

    if (capabilities.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Stream media YouTube yang ditemukan tidak memenuhi kriteria keamanan sistem.'
      );
    }

    return {
      mediaId,
      platform: 'youtube',
      mediaType: 'video',
      title,
      sourceUrl,
      thumbnailUrl: thumbnail,
      durationSeconds,
      author: null,
      capabilities,
    };
  }
}
