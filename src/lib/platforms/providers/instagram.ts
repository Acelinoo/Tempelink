import { BasePlatformProvider } from '../core/base-provider';
import { DetectionResult, ProviderContext } from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';
import { TempelinkError } from '../../types/errors';
import { serverConfig } from '../../config';
import {
  createVideoCapability,
  createImageCapability,
} from '../capabilities';
import { generateDownloadToken } from '../../security/token';
import { validateUrlSafety } from '../../security/ssrf';
import { Logger } from '../../telemetry/logger';

export interface InstagramMediaItem {
  url: string;
  type?: 'video' | 'image' | string;
  thumbnail?: string;
  thumb?: string;
  title?: string;
  width?: number;
  height?: number;
}

export class InstagramProvider extends BasePlatformProvider {
  public readonly id = 'instagram';
  public readonly name = 'Instagram';
  public readonly supportedDomains = [
    'instagram.com',
    'www.instagram.com',
    'instagr.am',
  ];
  public readonly supportedMediaTypes: MediaType[] = ['video', 'image', 'carousel'];
  public readonly exampleUrl = 'https://www.instagram.com/reel/C3b4X9vL123/';

  private readonly reelPattern = /^\/(?:reels?|reel)\/([A-Za-z0-9_-]+)/;
  private readonly postPattern = /^\/p\/([A-Za-z0-9_-]+)/;
  private readonly tvPattern = /^\/tv\/([A-Za-z0-9_-]+)/;
  private readonly storyPattern = /^\/stories\/([A-Za-z0-9_.-]+)\/(\d+)/;

  /**
   * Strips tracking parameters from Instagram URLs.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      'igsh',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ig_mid',
      'img_index',
    ];
    trackingParams.forEach((param) => clean.searchParams.delete(param));
    return clean.toString();
  }

  public detect(url: URL): DetectionResult {
    const pathname = url.pathname;
    const cleanUrlString = this.cleanUrl(url);

    // Reel (/reel/XYZ or /reels/XYZ)
    const reelMatch = pathname.match(this.reelPattern);
    if (reelMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: cleanUrlString,
        mediaId: reelMatch[1],
      };
    }

    // Post (/p/XYZ)
    const postMatch = pathname.match(this.postPattern);
    if (postMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'carousel', // Could be video, single photo, or carousel
        canonicalUrl: cleanUrlString,
        mediaId: postMatch[1],
      };
    }

    // IGTV (/tv/XYZ)
    const tvMatch = pathname.match(this.tvPattern);
    if (tvMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: cleanUrlString,
        mediaId: tvMatch[1],
      };
    }

    // Stories (/stories/username/123456)
    const storyMatch = pathname.match(this.storyPattern);
    if (storyMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: cleanUrlString,
        mediaId: storyMatch[2],
      };
    }

    return {
      status: 'UNSUPPORTED_MEDIA',
      platformId: this.id,
      platformName: this.name,
      errorMessage: 'Link Instagram ini bukan post, reel, IGTV, atau story publik yang didukung.',
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
        detection.errorMessage || 'Link Instagram tidak valid.'
      );
    }

    const apiKey = serverConfig.instagram.apiKey;
    if (!apiKey) {
      Logger.warn(
        '[InstagramProvider] API key is missing in server environment',
        { correlationId }
      );
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan Instagram belum dikonfigurasi dengan API token yang valid.'
      );
    }

    const cleanTargetUrl = this.cleanUrl(url);
    const endpointUrl = new URL(
      `/instagram/?url=${encodeURIComponent(cleanTargetUrl)}`,
      serverConfig.instagram.baseUrl
    ).toString();

    const maxRetries = serverConfig.instagram.maxRetries;
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
            'X-RapidAPI-Host': serverConfig.instagram.apiHost,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(serverConfig.instagram.resolveTimeoutMs),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 404) {
          throw new TempelinkError(
            'CONTENT_UNAVAILABLE',
            'Konten Instagram tidak ditemukan, bersifat privat, atau telah dihapus.'
          );
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text();
          if (bodyText.includes('not subscribed')) {
            throw new TempelinkError(
              'PROVIDER_UNAVAILABLE',
              'Gateway API Instagram memerlukan aktivasi langganan di dashboard penyedia.'
            );
          }
          throw new TempelinkError(
            'PRIVATE_CONTENT',
            'Konten Instagram bersifat privat atau memerlukan autentikasi akun.'
          );
        }

        if (response.status === 429) {
          throw new TempelinkError(
            'RATE_LIMITED',
            'Batas kuota gateway Instagram tercapai. Silakan coba beberapa saat lagi.'
          );
        }

        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }

        throw new TempelinkError(
          'PROVIDER_UNAVAILABLE',
          `Penyedia Instagram merespons dengan kode kesalahan HTTP ${response.status}.`
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
            'Waktu koneksi ke gateway Instagram habis. Silakan coba kembali.'
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
        '[InstagramProvider] Upstream exhaustion or failure',
        { error: lastError?.message, correlationId }
      );
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Gagal menghubungi server Instagram setelah beberapa kali percobaan.'
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Format respons dari gateway Instagram tidak dapat diproses.'
      );
    }

    return this.normalizePayload(payload, detection.mediaId, cleanTargetUrl);
  }

  /**
   * Normalizes gateway response into unified MediaResolution with signed tokens.
   */
  public normalizePayload(
    payload: Record<string, unknown>,
    mediaId: string,
    sourceUrl: string
  ): MediaResolution {
    if (payload.status === false) {
      const msg = typeof payload.message === 'string' ? payload.message : '';
      if (
        msg.toLowerCase().includes('invalid url') ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('private')
      ) {
        throw new TempelinkError(
          'CONTENT_UNAVAILABLE',
          'Konten Instagram tidak ditemukan, bersifat privat, atau telah dihapus.'
        );
      }
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        msg || 'Tidak ditemukan media yang dapat diunduh pada link Instagram ini.'
      );
    }

    const rawItems: InstagramMediaItem[] = [];

    // Format A (Verified RapidAPI): { status: true, result: [ { url, type, thumb, size } ] }
    if (Array.isArray(payload.result)) {
      for (const item of payload.result) {
        if (item && typeof item.url === 'string') {
          rawItems.push(item as InstagramMediaItem);
        }
      }
    } else if (
      payload.result &&
      typeof (payload.result as Record<string, unknown>).url === 'string'
    ) {
      rawItems.push(payload.result as unknown as InstagramMediaItem);
    } else if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        if (item && typeof item.url === 'string') {
          rawItems.push(item as InstagramMediaItem);
        }
      }
    } else if (
      payload.data &&
      typeof (payload.data as Record<string, unknown>).url === 'string'
    ) {
      rawItems.push(payload.data as unknown as InstagramMediaItem);
    } else if (Array.isArray(payload.media)) {
      for (const item of payload.media) {
        if (item && typeof item.url === 'string') {
          rawItems.push(item as InstagramMediaItem);
        }
      }
    } else if (typeof payload.url === 'string') {
      rawItems.push(payload as unknown as InstagramMediaItem);
    }

    if (rawItems.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan media yang dapat diunduh pada link Instagram ini.'
      );
    }

    const capabilities = [];
    let detectedType: MediaType = 'video';
    let thumbnail: string | null = null;
    let title: string | null = null;

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (!thumbnail) {
        thumbnail = item.thumbnail || item.thumb || null;
      }
      if (!title && item.title) {
        title = item.title;
      }

      // Check URL safety
      try {
        const parsedItemUrl = new URL(item.url);
        validateUrlSafety(parsedItemUrl);
      } catch {
        continue;
      }

      const rawType = (item.type || '').toLowerCase();
      const isVideo =
        rawType.startsWith('video') ||
        rawType === 'video/mp4' ||
        item.url.includes('.mp4') ||
        (!rawType.startsWith('image') &&
          !item.url.includes('.jpg') &&
          !item.url.includes('.png') &&
          !item.url.includes('.webp'));
      const ext = isVideo ? 'mp4' : 'jpg';
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
      const capSuffix = rawItems.length > 1 ? `item_${i + 1}` : (isVideo ? 'video' : 'photo');
      const capabilityId = `ig_${mediaId}_${capSuffix}`;
      const filename = `instagram_${mediaId}_${capSuffix}.${ext}`;

      const downloadToken = generateDownloadToken({
        mediaId,
        capabilityId,
        sourceUrl,
        targetUrl: item.url,
        filename,
        mimeType,
      });

      if (isVideo) {
        capabilities.push(
          createVideoCapability({
            id: capabilityId,
            resolution: item.height ? `${item.height}p` : '720p',
            height: item.height || null,
            width: item.width || null,
            format: 'mp4',
            label: rawItems.length > 1 ? `Video ${i + 1} (MP4)` : 'Video (MP4)',
            downloadUrl: item.url,
            downloadToken,
          })
        );
      } else {
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
        'Media yang ditemukan tidak memenuhi kriteria keamanan sistem.'
      );
    }

    if (rawItems.length > 1) {
      detectedType = 'carousel';
    } else if (capabilities[0].type === 'image') {
      detectedType = 'image';
    } else {
      detectedType = 'video';
    }

    return {
      mediaId,
      platform: 'instagram',
      mediaType: detectedType,
      title: title || `Instagram Post (${mediaId})`,
      sourceUrl,
      thumbnailUrl: thumbnail || capabilities[0].downloadUrl,
      author: null,
      capabilities,
    };
  }
}
