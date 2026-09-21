import { BasePlatformProvider } from '../core/base-provider';
import { DetectionResult, ProviderContext } from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';
import { TempelinkError } from '../../types/errors';
import { serverConfig } from '../../config';
import {
  createVideoCapability,
  createImageCapability,
  categorizeVideoQuality,
} from '../capabilities';
import { generateDownloadToken } from '../../security/token';
import { validateUrlSafety } from '../../security/ssrf';
import { Logger } from '../../telemetry/logger';

export interface PinterestFormatItem {
  url: string;
  type?: string;
  quality?: string;
  width?: number | null;
  height?: number | null;
}

export class PinterestProvider extends BasePlatformProvider {
  public readonly id = 'pinterest';
  public readonly name = 'Pinterest';
  public readonly supportedDomains = [
    'pinterest.com',
    'www.pinterest.com',
    'pin.it',
    'id.pinterest.com',
  ];
  public readonly supportedMediaTypes: MediaType[] = ['image', 'video'];
  public readonly exampleUrl = 'https://www.pinterest.com/pin/123456789012345678/';

  private readonly pinPattern = /\/pin\/(\d+)/;
  private readonly shortlinkPattern = /^\/([A-Za-z0-9_-]{5,12})\/?$/;

  /**
   * Cleans tracking query parameters from Pinterest URLs.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      'invite_code',
      'sender',
      'sfo',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ];
    trackingParams.forEach((param) => clean.searchParams.delete(param));
    return clean.toString();
  }

  public detect(url: URL): DetectionResult {
    const host = url.hostname.toLowerCase();
    const cleanUrlString = this.cleanUrl(url);

    if (host.includes('pin.it')) {
      const match = url.pathname.match(this.shortlinkPattern);
      if (match) {
        return {
          status: 'SUPPORTED_PLATFORM',
          platformId: this.id,
          platformName: this.name,
          mediaType: 'image',
          canonicalUrl: cleanUrlString,
          mediaId: match[1],
        };
      }
    }

    const pinMatch = url.pathname.match(this.pinPattern);
    if (pinMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'image',
        canonicalUrl: `https://www.pinterest.com/pin/${pinMatch[1]}/`,
        mediaId: pinMatch[1],
      };
    }

    return {
      status: 'UNSUPPORTED_MEDIA',
      platformId: this.id,
      platformName: this.name,
      errorMessage: 'Link Pinterest ini bukan pin atau tautan media publik yang valid.',
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
        detection.errorMessage || 'Link Pinterest tidak valid.'
      );
    }

    const apiKey = serverConfig.pinterest.apiKey;
    if (!apiKey) {
      Logger.warn('[PinterestProvider] API key is missing in server environment', {
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan Pinterest belum dikonfigurasi dengan API token yang valid.'
      );
    }

    const cleanTargetUrl = this.cleanUrl(url);
    const endpointUrl = new URL(
      `/?url=${encodeURIComponent(cleanTargetUrl)}`,
      serverConfig.pinterest.baseUrl
    ).toString();

    const maxRetries = serverConfig.pinterest.maxRetries;
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
            'X-RapidAPI-Host': serverConfig.pinterest.apiHost,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(serverConfig.pinterest.resolveTimeoutMs),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 404) {
          throw new TempelinkError(
            'CONTENT_UNAVAILABLE',
            'Pin Pinterest tidak ditemukan atau telah dihapus.'
          );
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text();
          if (bodyText.includes('not subscribed')) {
            throw new TempelinkError(
              'PROVIDER_UNAVAILABLE',
              'Gateway API Pinterest memerlukan aktivasi langganan di dashboard penyedia.'
            );
          }
          throw new TempelinkError(
            'PRIVATE_CONTENT',
            'Pin Pinterest bersifat privat atau memerlukan autentikasi akun.'
          );
        }

        if (response.status === 429) {
          throw new TempelinkError(
            'RATE_LIMITED',
            'Batas kuota gateway Pinterest tercapai. Silakan coba beberapa saat lagi.'
          );
        }

        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }

        throw new TempelinkError(
          'PROVIDER_UNAVAILABLE',
          `Penyedia Pinterest merespons dengan kode kesalahan HTTP ${response.status}.`
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
            'Waktu koneksi ke gateway Pinterest habis. Silakan coba kembali.'
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
      Logger.error('[PinterestProvider] Upstream failure', {
        error: lastError?.message,
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Gagal menghubungi server Pinterest setelah beberapa kali percobaan.'
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Format respons dari gateway Pinterest tidak dapat diproses.'
      );
    }

    return this.normalizePayload(payload, detection.mediaId, cleanTargetUrl);
  }

  /**
   * Normalizes gateway response into unified MediaResolution with signed tokens.
   */
  public normalizePayload(
    payload: Record<string, unknown> | unknown[],
    mediaId: string,
    sourceUrl: string
  ): MediaResolution {
    if (Array.isArray(payload)) {
      const first = payload[0] as Record<string, unknown> | undefined;
      if (first && (first.error === true || first.status === 'error')) {
        throw new TempelinkError(
          'CONTENT_UNAVAILABLE',
          (first.message as string) ||
            'Pin Pinterest tidak ditemukan atau penyedia mengembalikan kesalahan.'
        );
      }
    } else if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      if (obj.status === 'error' || obj.status === false || obj.error === true) {
        throw new TempelinkError(
          'CONTENT_UNAVAILABLE',
          (obj.message as string) ||
            'Pin Pinterest tidak ditemukan atau tidak dapat diakses.'
        );
      }
    }

    const rawItems: PinterestFormatItem[] = [];

    // Format A (Array of media items)
    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (item && typeof item === 'object') {
          const m = item as Record<string, unknown>;
          const mediaUrl =
            (m.url as string) ||
            (m.media_url as string) ||
            (m.image as string) ||
            (m.video as string);
          if (typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) {
            const isVid =
              mediaUrl.includes('.mp4') || (m.type as string) === 'video';
            rawItems.push({
              url: mediaUrl,
              type: isVid ? 'video' : 'image',
              quality: (m.quality as string) || 'original',
            });
          }
        }
      }
    } else if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;

      // Parse video streams if present
      if (Array.isArray(obj.videos)) {
        for (const item of obj.videos) {
          if (item && typeof item.url === 'string') {
            rawItems.push({
              url: item.url,
              type: 'video',
              quality: item.quality || '720p',
              height: item.height || null,
              width: item.width || null,
            });
          }
        }
      } else if (typeof obj.video === 'string') {
        rawItems.push({
          url: obj.video,
          type: 'video',
          quality: (obj.quality as string) || '720p',
        });
      }

      // Parse image streams
      if (Array.isArray(obj.images)) {
        for (const item of obj.images) {
          if (item && typeof item.url === 'string') {
            rawItems.push({
              url: item.url,
              type: 'image',
              quality: 'original',
            });
          }
        }
      } else if (typeof obj.image === 'string') {
        rawItems.push({
          url: obj.image,
          type: 'image',
          quality: 'original',
        });
      } else if (typeof obj.url === 'string') {
        const isVid =
          obj.url.includes('.mp4') || (obj.type as string) === 'video';
        rawItems.push({
          url: obj.url,
          type: isVid ? 'video' : 'image',
          quality: (obj.quality as string) || 'original',
        });
      }
    }

    if (rawItems.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan media yang dapat diunduh pada pin Pinterest ini.'
      );
    }

    const payloadObj =
      !Array.isArray(payload) && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};

    const title =
      (payloadObj.title as string) ||
      (payloadObj.description as string) ||
      `Pinterest Pin (${mediaId})`;
    const thumbnail =
      (payloadObj.thumbnail as string) ||
      (payloadObj.thumb as string) ||
      rawItems[0].url;

    const capabilities = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];

      // Validate stream URL against SSRF boundary
      try {
        const parsedStreamUrl = new URL(item.url);
        validateUrlSafety(parsedStreamUrl);
      } catch {
        continue;
      }

      if (seenUrls.has(item.url)) {
        continue;
      }
      seenUrls.add(item.url);

      const isVideo = item.type === 'video' || item.url.includes('.mp4');

      if (isVideo) {
        const qualityCat = categorizeVideoQuality(
          item.height,
          item.width,
          item.quality || '720p'
        );
        const resolutionClean =
          item.quality?.match(/\d{3,4}p?/)?.[0] || '720p';
        const capabilityId = `pin_${mediaId}_video_${i + 1}`;
        const label =
          qualityCat === 'hd'
            ? `HD ${resolutionClean} (MP4)`
            : `Standard ${resolutionClean} (MP4)`;
        const filename = `pinterest_${mediaId}_${qualityCat}_${resolutionClean}.mp4`;

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
            downloadUrl: item.url,
            downloadToken,
          })
        );
      } else {
        const capabilityId = `pin_${mediaId}_image_${i + 1}`;
        const filename = `pinterest_${mediaId}_image_${i + 1}.jpg`;
        const downloadToken = generateDownloadToken({
          mediaId,
          capabilityId,
          sourceUrl,
          targetUrl: item.url,
          filename,
          mimeType: 'image/jpeg',
        });

        capabilities.push(
          createImageCapability({
            id: capabilityId,
            format: 'jpg',
            label: rawItems.length > 1 ? `Foto ${i + 1} (JPG)` : 'Foto (JPG)',
            downloadUrl: item.url,
            downloadToken,
          })
        );
      }
    }

    if (capabilities.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Media Pinterest yang ditemukan tidak memenuhi kriteria keamanan sistem.'
      );
    }

    const hasVideo = capabilities.some((c) => c.type === 'video');

    return {
      mediaId,
      platform: 'pinterest',
      mediaType: hasVideo ? 'video' : 'image',
      title,
      sourceUrl,
      thumbnailUrl: thumbnail,
      author:
        typeof payloadObj.author === 'string'
          ? { name: payloadObj.author }
          : null,
      capabilities,
    };
  }
}
