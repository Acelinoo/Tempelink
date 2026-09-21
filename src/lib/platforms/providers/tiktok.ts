import { BasePlatformProvider } from '../core/base-provider';
import { DetectionResult, ProviderContext } from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';
import { TempelinkError } from '../../types/errors';
import { serverConfig } from '../../config';
import {
  createVideoCapability,
  createAudioCapability,
  createImageCapability,
} from '../capabilities';
import { generateDownloadToken } from '../../security/token';
import { Logger } from '../../telemetry/logger';

export class TikTokProvider extends BasePlatformProvider {
  public readonly id = 'tiktok';
  public readonly name = 'TikTok';
  public readonly supportedDomains = [
    'tiktok.com',
    'www.tiktok.com',
    'm.tiktok.com',
    'vm.tiktok.com',
    'vt.tiktok.com',
  ];
  public readonly supportedMediaTypes: MediaType[] = ['video', 'audio', 'carousel'];
  public readonly exampleUrl = 'https://www.tiktok.com/@username/video/7123456789012345678';

  // Matches web video links: /@user/video/1234567890123456789 or /v/123456789
  private readonly videoPattern = /\/(?:video|v)\/(\d{15,22})/;
  // Matches shortlinks: vm.tiktok.com/XYZ123 or vt.tiktok.com/XYZ123
  private readonly shortlinkPattern = /^\/([A-Za-z0-9_-]{6,12})\/?$/;
  // Matches photo mode / slide mode: /@user/photo/1234567890123456789
  private readonly photoPattern = /\/photo\/(\d{15,22})/;

  /**
   * Cleans tracking query parameters from TikTok URLs to obtain canonical forms.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      'is_from_webapp',
      'sender_device',
      '_r',
      '_t',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'share_app_id',
      'share_item_id',
      'source',
    ];
    trackingParams.forEach((param) => clean.searchParams.delete(param));
    return clean.toString();
  }

  public detect(url: URL): DetectionResult {
    const pathname = url.pathname;
    const cleanUrlString = this.cleanUrl(url);

    // Check shortlinks (vm.tiktok.com / vt.tiktok.com)
    if (url.hostname.includes('vm.tiktok.com') || url.hostname.includes('vt.tiktok.com')) {
      const match = pathname.match(this.shortlinkPattern);
      if (match) {
        return {
          status: 'SUPPORTED_PLATFORM',
          platformId: this.id,
          platformName: this.name,
          mediaType: 'video',
          canonicalUrl: cleanUrlString,
          mediaId: match[1],
        };
      }
    }

    // Check photo mode
    const photoMatch = pathname.match(this.photoPattern);
    if (photoMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'carousel',
        canonicalUrl: cleanUrlString,
        mediaId: photoMatch[1],
      };
    }

    // Check video mode
    const videoMatch = pathname.match(this.videoPattern);
    if (videoMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: cleanUrlString,
        mediaId: videoMatch[1],
      };
    }

    // Non-media URL (e.g. user profile without video ID or feed)
    return {
      status: 'UNSUPPORTED_MEDIA',
      platformId: this.id,
      platformName: this.name,
      errorMessage: 'Link TikTok ini bukan link video atau foto yang dapat diunduh.',
    };
  }

  /**
   * Executes network fetch with timeout and bounded retries for transient 5xx/network errors.
   */
  private async fetchWithRetry(
    fetchUrl: string,
    options: RequestInit,
    retries = serverConfig.tiktok.maxRetries
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          serverConfig.tiktok.resolveTimeoutMs
        );

        const res = await fetch(fetchUrl, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If upstream returns 5xx and we have retries left, retry
        if (res.status >= 500 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 300));
          continue;
        }

        return res;
      } catch (err: unknown) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 300));
          continue;
        }
      }
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
      throw new TempelinkError(
        'TEMPORARY_FAILURE',
        'Koneksi ke penyedia TikTok melampaui batas waktu (timeout).'
      );
    }

    throw new TempelinkError(
      'PROVIDER_UNAVAILABLE',
      'Gagal menghubungi upstream server TikTok setelah beberapa percobaan.'
    );
  }

  public async resolve(url: URL, context?: ProviderContext): Promise<MediaResolution> {
    const detection = this.detect(url);
    if (detection.status !== 'SUPPORTED_PLATFORM') {
      throw new TempelinkError(
        detection.status === 'UNSUPPORTED_MEDIA' ? 'UNSUPPORTED_MEDIA' : 'INVALID_URL',
        detection.errorMessage || 'Link TikTok tidak valid atau tidak didukung.'
      );
    }

    // 1. Check if upstream credentials are configured
    const apiKey = serverConfig.tiktok.apiKey;
    if (!apiKey) {
      Logger.warn('[TikTokProvider] API key is missing in server environment', {
        correlationId: context?.correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan TikTok belum dikonfigurasi dengan API token yang valid. Hubungi administrator sistem.'
      );
    }

    const cleanUrlString = detection.canonicalUrl || url.toString();
    const mediaId = detection.mediaId || `tt_${Date.now()}`;

    // 2. Query upstream authorized API gateway
    const baseUrl = serverConfig.tiktok.baseUrl.replace(/\/+$/, '');
    const apiEndpoint = baseUrl.endsWith('/index')
      ? `${baseUrl}?url=${encodeURIComponent(cleanUrlString)}&hd=1`
      : `${baseUrl}/index?url=${encodeURIComponent(cleanUrlString)}&hd=1`;

    const res = await this.fetchWithRetry(apiEndpoint, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': serverConfig.tiktok.apiHost,
      },
    });

    if (res.status === 404) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        'Video TikTok tidak ditemukan atau telah dihapus.'
      );
    }

    if (res.status === 429) {
      throw new TempelinkError(
        'RATE_LIMITED',
        'Batas kuota layanan penyedia TikTok telah tercapai. Coba beberapa saat lagi.'
      );
    }

    if (!res.ok) {
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        `Penyedia TikTok mengembalikan status HTTP ${res.status}.`
      );
    }

    let payload: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      payload = await res.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Gagal membaca format data dari penyedia TikTok.'
      );
    }

    // Check upstream logical error codes / error messages
    if (payload.error) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        typeof payload.error === 'string'
          ? payload.error
          : 'Media TikTok tidak dapat diakses atau telah dihapus.'
      );
    }

    const upstreamData = payload.data || payload;
    if (payload.code === -1) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        payload.msg || 'Media TikTok tidak dapat diakses atau bersifat privat.'
      );
    }

    // 3. Extract metadata (support both raw RapidAPI direct format and legacy wrapper format)
    const title =
      (Array.isArray(upstreamData.description) ? upstreamData.description[0] : upstreamData.description) ||
      upstreamData.title ||
      upstreamData.desc ||
      'Video TikTok';

    const authorUsername =
      (Array.isArray(upstreamData.author) ? upstreamData.author[0] : null) ||
      (typeof upstreamData.author === 'string' ? upstreamData.author : null) ||
      upstreamData.author?.unique_id ||
      null;

    const authorName =
      upstreamData.author?.nickname ||
      authorUsername ||
      null;

    const avatarUrl =
      (Array.isArray(upstreamData.avatar_thumb) ? upstreamData.avatar_thumb[0] : upstreamData.avatar_thumb) ||
      upstreamData.author?.avatar ||
      null;

    const thumbnailUrl =
      (Array.isArray(upstreamData.cover) ? upstreamData.cover[0] : upstreamData.cover) ||
      (Array.isArray(upstreamData.dynamic_cover) ? upstreamData.dynamic_cover[0] : upstreamData.dynamic_cover) ||
      upstreamData.origin_cover ||
      null;

    const durationSeconds = upstreamData.duration ? Number(upstreamData.duration) : null;

    // 4. Extract capabilities (Strictly Honest: Standard vs HD)
    const capabilities = [];

    // Standard Video (watermark-free normal playback)
    const playUrl =
      (Array.isArray(upstreamData.video) ? upstreamData.video[0] : upstreamData.video) ||
      upstreamData.play ||
      upstreamData.wmplay;

    if (playUrl && typeof playUrl === 'string') {
      const capId = `tt_${mediaId}_standard`;
      const token = generateDownloadToken({
        mediaId,
        capabilityId: capId,
        sourceUrl: cleanUrlString,
        targetUrl: playUrl,
        filename: `tiktok_${mediaId}_standard.mp4`,
        mimeType: 'video/mp4',
      });

      capabilities.push(
        createVideoCapability({
          id: capId,
          resolution: '720p',
          height: 720,
          format: 'mp4',
          label: 'Standard 720p (Tanpa Watermark)',
          downloadToken: token,
          downloadUrl: `/api/media/download?token=${encodeURIComponent(token)}`,
          available: true,
          isWatermarkFree: true,
        })
      );
    }

    // Watermarked Video (if available and distinct)
    const wmPlayUrl = Array.isArray(upstreamData.OriginalWatermarkedVideo)
      ? upstreamData.OriginalWatermarkedVideo[0]
      : upstreamData.OriginalWatermarkedVideo;

    if (wmPlayUrl && typeof wmPlayUrl === 'string' && wmPlayUrl !== playUrl) {
      const capId = `tt_${mediaId}_watermarked`;
      const token = generateDownloadToken({
        mediaId,
        capabilityId: capId,
        sourceUrl: cleanUrlString,
        targetUrl: wmPlayUrl,
        filename: `tiktok_${mediaId}_watermarked.mp4`,
        mimeType: 'video/mp4',
      });

      capabilities.push(
        createVideoCapability({
          id: capId,
          resolution: null,
          format: 'mp4',
          label: 'Video MP4 (Watermark Asli)',
          downloadToken: token,
          downloadUrl: `/api/media/download?token=${encodeURIComponent(token)}`,
          available: true,
          isWatermarkFree: false,
        })
      );
    }

    // HD Video (only if upstream exposes a distinct hdplay resource or secondary 1080p stream!)
    const hdPlayUrl =
      upstreamData.hdplay ||
      (Array.isArray(upstreamData.video) && upstreamData.video.length > 1 ? upstreamData.video[1] : null);

    if (hdPlayUrl && typeof hdPlayUrl === 'string' && hdPlayUrl !== playUrl) {
      const capId = `tt_${mediaId}_hd`;
      const token = generateDownloadToken({
        mediaId,
        capabilityId: capId,
        sourceUrl: cleanUrlString,
        targetUrl: hdPlayUrl,
        filename: `tiktok_${mediaId}_1080p.mp4`,
        mimeType: 'video/mp4',
      });

      capabilities.push(
        createVideoCapability({
          id: capId,
          resolution: '1080p',
          height: 1080,
          format: 'mp4',
          label: 'HD 1080p',
          downloadToken: token,
          downloadUrl: `/api/media/download?token=${encodeURIComponent(token)}`,
          available: true,
          isWatermarkFree: true,
        })
      );
    }

    // Audio extraction (if music resource exists)
    const musicUrl =
      (Array.isArray(upstreamData.music) ? upstreamData.music[0] : upstreamData.music) ||
      upstreamData.music_info?.play_url;

    if (musicUrl && typeof musicUrl === 'string') {
      const capId = `tt_${mediaId}_audio`;
      const token = generateDownloadToken({
        mediaId,
        capabilityId: capId,
        sourceUrl: cleanUrlString,
        targetUrl: musicUrl,
        filename: `tiktok_${mediaId}_audio.mp3`,
        mimeType: 'audio/mpeg',
      });

      capabilities.push(
        createAudioCapability({
          id: capId,
          label: upstreamData.music_info?.title
            ? `Audio (${upstreamData.music_info.title})`
            : 'Original Audio (MP3)',
          format: 'mp3',
          bitrateKbps: 128,
          downloadToken: token,
          downloadUrl: `/api/media/download?token=${encodeURIComponent(token)}`,
          available: true,
        })
      );
    }

    // Photo/Carousel images (if photo mode)
    const imagesArray = Array.isArray(upstreamData.images) && upstreamData.images.length > 0
      ? upstreamData.images
      : [];

    if (imagesArray.length > 0) {
      imagesArray.forEach((imgUrl: string, idx: number) => {
        const capId = `tt_${mediaId}_img_${idx + 1}`;
        const token = generateDownloadToken({
          mediaId,
          capabilityId: capId,
          sourceUrl: cleanUrlString,
          targetUrl: imgUrl,
          filename: `tiktok_${mediaId}_photo_${idx + 1}.jpg`,
          mimeType: 'image/jpeg',
        });

        capabilities.push(
          createImageCapability({
            id: capId,
            label: `Foto ${idx + 1}`,
            format: 'jpg',
            downloadToken: token,
            downloadUrl: `/api/media/download?token=${encodeURIComponent(token)}`,
            available: true,
          })
        );
      });
    }

    if (capabilities.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Penyedia tidak mengembalikan opsi unduhan yang dapat diproses.'
      );
    }

    return {
      mediaId,
      platform: this.id,
      mediaType: detection.mediaType || 'video',
      title,
      description: upstreamData.title || null,
      author: {
        name: authorName,
        username: authorUsername,
        avatarUrl,
        profileUrl: authorUsername ? `https://www.tiktok.com/@${authorUsername}` : null,
      },
      thumbnailUrl,
      durationSeconds,
      sourceUrl: cleanUrlString,
      capabilities,
      providerMetadata: {
        upstreamId: upstreamData.id || mediaId,
      },
    };
  }
}
