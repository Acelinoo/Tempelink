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

function parseDurationString(val: unknown): number | null {
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
      return parts[0] * 60 + parts[1];
    }
    const num = parseInt(trimmed, 10);
    return isNaN(num) ? null : num;
  }
  return null;
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

    if (
      serverConfig.youtube.apiHost.includes('youtube-mp4-mp3-downloader') ||
      serverConfig.youtube.baseUrl.includes('youtube-mp4-mp3-downloader')
    ) {
      return this.resolveWithMp4Mp3Downloader(detection, apiKey, canonicalUrl, correlationId);
    }

    const isQuickVideoDownloader =
      serverConfig.youtube.apiHost.includes('youtube-quick-video-downloader') ||
      serverConfig.youtube.baseUrl.includes('youtube-quick-video-downloader');

    const isVideoAudioDownloader =
      serverConfig.youtube.apiHost.includes('youtube-video-audio-downloader') ||
      serverConfig.youtube.baseUrl.includes('youtube-video-audio-downloader');

    const isMediaDownloader =
      serverConfig.youtube.apiHost.includes('youtube-media-downloader') ||
      serverConfig.youtube.baseUrl.includes('youtube-media-downloader');

    let endpointPath = `/api/v1/youtube-media/info?url=${encodeURIComponent(canonicalUrl)}`;
    if (isQuickVideoDownloader) {
      endpointPath = '/api/youtube/links';
    } else if (isMediaDownloader) {
      endpointPath = `/v2/video/details?videoId=${encodeURIComponent(detection.mediaId)}`;
    } else if (
      serverConfig.youtube.apiHost.includes('download.php') ||
      serverConfig.youtube.baseUrl.includes('download.php')
    ) {
      endpointPath = `/download.php?id=${encodeURIComponent(detection.mediaId)}`;
    }

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
        const headers: Record<string, string> = {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': serverConfig.youtube.apiHost,
          Accept: 'application/json',
        };
        if (isQuickVideoDownloader) {
          headers['Content-Type'] = 'application/json';
        }

        response = await fetch(endpointUrl, {
          method: isQuickVideoDownloader ? 'POST' : 'GET',
          headers,
          body: isQuickVideoDownloader
            ? JSON.stringify({ url: canonicalUrl })
            : undefined,
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
      !Array.isArray(payload) &&
      (payload.status === 'error' ||
        payload.status_code === 404 ||
        (typeof payload.errorId === 'string' && payload.errorId !== 'Success'))
    ) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        (payload.message as string) ||
          (payload.reason as string) ||
          'Video YouTube tidak ditemukan, bersifat privat, atau telah dihapus.'
      );
    }

    const rawFormats: YouTubeFormatItem[] = [];

    // Format: youtube-quick-video-downloader (array of items [ { urls: [...], meta: { title, duration }, pictureUrl } ])
    const firstQuickObj =
      Array.isArray(payload) && payload[0] && typeof payload[0] === 'object'
        ? (payload[0] as Record<string, unknown>)
        : null;

    if (firstQuickObj && Array.isArray(firstQuickObj.urls)) {
      for (const item of firstQuickObj.urls) {
        if (item && typeof item === 'object') {
          const rawItem = item as Record<string, unknown>;
          const linkUrl = typeof rawItem.url === 'string' ? rawItem.url : '';
          // Ignore relative converter links that 404
          if (linkUrl.startsWith('https://')) {
            const isAudio = Boolean(rawItem.audio);
            const quality = String(rawItem.quality || rawItem.subName || '720');
            const format = (rawItem.extension as string) || (isAudio ? 'm4a' : 'mp4');
            rawFormats.push({
              url: linkUrl,
              quality: isAudio ? 'audio' : quality,
              format,
              hasAudio: isAudio,
              fileSizeBytes:
                typeof rawItem.filesize === 'number'
                  ? rawItem.filesize
                  : typeof rawItem.contentLength === 'number'
                  ? rawItem.contentLength
                  : null,
            });
          }
        }
      }
    }

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
    }

    // Format: youtube-video-audio-downloader ({ status: "success", data: { title, thumbnail, duration, links: [...] } })
    const dataObj =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : null;

    const linksArray = Array.isArray(payload.links)
      ? payload.links
      : dataObj && Array.isArray(dataObj.links)
      ? dataObj.links
      : null;

    if (linksArray) {
      for (const item of linksArray) {
        if (item && typeof item === 'object') {
          const rawItem = item as Record<string, unknown>;
          const linkUrl =
            typeof rawItem.download_url === 'string'
              ? rawItem.download_url
              : typeof rawItem.url === 'string'
              ? rawItem.url
              : typeof rawItem.link === 'string'
              ? rawItem.link
              : null;

          if (linkUrl) {
            const isAudio = rawItem.type === 'audio';
            const quality =
              typeof rawItem.resolution === 'string'
                ? rawItem.resolution
                : isAudio
                ? 'audio'
                : '720p';
            const format = isAudio ? 'mp3' : 'mp4';
            rawFormats.push({
              url: linkUrl,
              quality,
              format,
              hasAudio: true,
              fileSizeBytes:
                typeof rawItem.size === 'number' ? rawItem.size : null,
            });
          }
        }
      }
    } else if (typeof payload.url === 'string') {
      rawFormats.push({
        url: payload.url as string,
        quality: (payload.quality as string) || '720p',
        format: (payload.format as string) || 'mp4',
      });
    }

    // Prioritize direct Cloudflare streams (yqapi.com) over IP-locked googlevideo.com streams
    const yqFormats = rawFormats.filter((f) => f.url.includes('yqapi.com'));
    const activeFormats = yqFormats.length > 0 ? yqFormats : rawFormats;

    // If yqapi video streams exist, enrich with standard HD quality streams if not already provided
    if (yqFormats.length > 0) {
      const sampleYq = yqFormats[0];
      const has720 = activeFormats.some((f) => f.quality?.toLowerCase().includes('720'));
      if (!has720) {
        activeFormats.push({
          url: sampleYq.url.replace(/&q=[^&]+/, '&q=720').replace(/&f=[^&]+/, '&f=mp4'),
          quality: '720p',
          format: 'mp4',
          hasAudio: true,
        });
      }
      const has1080 = activeFormats.some((f) => f.quality?.toLowerCase().includes('1080'));
      if (!has1080) {
        activeFormats.push({
          url: sampleYq.url.replace(/&q=[^&]+/, '&q=1080').replace(/&f=[^&]+/, '&f=mp4'),
          quality: '1080p',
          format: 'mp4',
          hasAudio: true,
        });
      }
    }

    // If yqapi video streams exist but no audio stream is present, synthesize an MP3 audio format option.
    const hasAudioFormat = activeFormats.some(
      (f) => f.format === 'mp3' || f.quality?.toLowerCase().includes('audio')
    );
    if (!hasAudioFormat && yqFormats.length > 0) {
      const sampleYq = yqFormats[0];
      const audioUrl = sampleYq.url
        .replace(/&q=[^&]+/, '&q=bestaudio')
        .replace(/&f=[^&]+/, '&f=mp3');
      activeFormats.push({
        url: audioUrl,
        quality: 'audio',
        format: 'mp3',
        hasAudio: true,
      });
    }

    if (activeFormats.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan stream media yang dapat diunduh pada link YouTube ini.'
      );
    }

    const quickMeta =
      firstQuickObj?.meta && typeof firstQuickObj.meta === 'object'
        ? (firstQuickObj.meta as Record<string, unknown>)
        : null;

    const title =
      (payload.title as string) ||
      (quickMeta && typeof quickMeta.title === 'string' ? quickMeta.title : '') ||
      (dataObj && typeof dataObj.title === 'string' ? dataObj.title : '') ||
      `YouTube Video (${mediaId})`;
    let thumbnail =
      (payload.thumbnail as string) ||
      (firstQuickObj && typeof firstQuickObj.pictureUrl === 'string'
        ? firstQuickObj.pictureUrl
        : '') ||
      (dataObj && typeof dataObj.thumbnail === 'string' ? dataObj.thumbnail : '') ||
      '';
    if (!thumbnail && Array.isArray(payload.thumbnails) && payload.thumbnails.length > 0) {
      const thumbs = payload.thumbnails as Array<{ url?: string }>;
      thumbnail = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
    }
    if (!thumbnail) {
      thumbnail = `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg`;
    }
    const durationSeconds =
      parseDurationString(payload.lengthSeconds) ??
      parseDurationString(payload.duration) ??
      (quickMeta ? parseDurationString(quickMeta.duration) : null) ??
      (dataObj ? parseDurationString(dataObj.duration) : null);

    const capabilities = [];
    const seenQualities = new Set<string>();

    for (let i = 0; i < activeFormats.length; i++) {
      const item = activeFormats[i];

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

  /**
   * Dedicated resolver for youtube-mp4-mp3-downloader.p.rapidapi.com gateway.
   */
  private async resolveWithMp4Mp3Downloader(
    detection: DetectionResult,
    apiKey: string,
    canonicalUrl: string,
    _correlationId?: string
  ): Promise<MediaResolution> {
    const videoId = detection.mediaId!;
    const baseUrl = serverConfig.youtube.baseUrl;
    const host = serverConfig.youtube.apiHost;

    // 1. Initial download conversion request
    const initUrl = new URL('/api/v1/download', baseUrl);
    initUrl.searchParams.set('allowExtendedDuration', 'false');
    initUrl.searchParams.set('addInfo', 'true');
    initUrl.searchParams.set('audioQuality', '128');
    initUrl.searchParams.set('format', '720');
    initUrl.searchParams.set('id', videoId);

    const initRes = await fetch(initUrl.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': host,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(serverConfig.youtube.resolveTimeoutMs),
    });

    if (!initRes.ok) {
      if (initRes.status === 404) {
        throw new TempelinkError(
          'CONTENT_UNAVAILABLE',
          'Video YouTube tidak ditemukan, bersifat privat, atau telah dihapus.'
        );
      }
      if (initRes.status === 429) {
        throw new TempelinkError(
          'RATE_LIMITED',
          'Batas kuota gateway YouTube tercapai. Silakan coba beberapa saat lagi.'
        );
      }
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        `Penyedia YouTube merespons dengan kode kesalahan HTTP ${initRes.status}.`
      );
    }

    const initData = (await initRes.json()) as Record<string, unknown>;

    // If response directly contains formats or is from standard format mock
    if (
      initData.results ||
      initData.videos ||
      initData.formats ||
      initData.status === 'ok' ||
      initData.errorId
    ) {
      return this.normalizePayload(initData, videoId, canonicalUrl);
    }

    if (!initData.progressId) {
      if (initData.status === 'error' || initData.status_code === 404) {
        throw new TempelinkError(
          'CONTENT_UNAVAILABLE',
          (initData.message as string) ||
            'Video YouTube tidak ditemukan, bersifat privat, atau telah dihapus.'
        );
      }
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Penyedia YouTube tidak mengembalikan ID pemrosesan antrean.'
      );
    }

    const title =
      typeof initData.title === 'string'
        ? initData.title
        : `YouTube Video (${videoId})`;
    const addInfo = initData.additionalInfo as
      | { thumbnail?: string; duration?: number }
      | undefined;
    const thumbnail =
      addInfo && typeof addInfo.thumbnail === 'string'
        ? addInfo.thumbnail
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const durationSeconds =
      addInfo && typeof addInfo.duration === 'number'
        ? addInfo.duration
        : null;

    // 2. Poll progress endpoint to get direct download URL
    let downloadUrl: string | null = null;
    const progressUrl = new URL('/api/v1/progress', baseUrl);
    progressUrl.searchParams.set('id', String(initData.progressId));

    for (let i = 0; i < 6; i++) {
      try {
        const progRes = await fetch(progressUrl.toString(), {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': host,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (progRes.ok) {
          const progData = (await progRes.json()) as {
            finished?: boolean;
            downloadUrl?: string;
            status?: string;
          };

          if (progData.finished && progData.downloadUrl) {
            downloadUrl = progData.downloadUrl;
            break;
          }
        }
      } catch {
        // Retry polling step
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!downloadUrl) {
      throw new TempelinkError(
        'TEMPORARY_FAILURE',
        'Proses konversi berkas media YouTube masih berjalan atau membutuhkan waktu lebih lama. Silakan coba kembali.'
      );
    }

    // SSRF verification
    const parsedTarget = new URL(downloadUrl);
    validateUrlSafety(parsedTarget);

    const capabilities = [];

    // Video HD 720p capability
    const vidCapId = `yt_${videoId}_hd_720`;
    const vidFilename = `youtube_${videoId}_hd_720p.mp4`;
    const vidToken = generateDownloadToken({
      mediaId: videoId,
      capabilityId: vidCapId,
      sourceUrl: canonicalUrl,
      targetUrl: downloadUrl,
      filename: vidFilename,
      mimeType: 'video/mp4',
    });

    capabilities.push(
      createVideoCapability({
        id: vidCapId,
        resolution: '720p',
        format: 'mp4',
        label: 'HD 720p (MP4)',
        hasAudio: true,
        downloadUrl,
        downloadToken: vidToken,
      })
    );

    // Audio MP3 capability
    const audCapId = `yt_${videoId}_audio`;
    const audFilename = `youtube_${videoId}_audio.mp3`;
    const audToken = generateDownloadToken({
      mediaId: videoId,
      capabilityId: audCapId,
      sourceUrl: canonicalUrl,
      targetUrl: downloadUrl,
      filename: audFilename,
      mimeType: 'audio/mpeg',
    });

    capabilities.push(
      createAudioCapability({
        id: audCapId,
        format: 'mp3',
        label: 'Audio (MP3)',
        downloadUrl,
        downloadToken: audToken,
      })
    );

    return {
      mediaId: videoId,
      platform: 'youtube',
      mediaType: 'video',
      title,
      sourceUrl: canonicalUrl,
      thumbnailUrl: thumbnail,
      durationSeconds,
      author: null,
      capabilities,
    };
  }
}
