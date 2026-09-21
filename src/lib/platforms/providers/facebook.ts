import { BasePlatformProvider } from '../core/base-provider';
import { DetectionResult, ProviderContext } from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';
import { TempelinkError } from '../../types/errors';
import { serverConfig } from '../../config';
import {
  createVideoCapability,
  createAudioCapability,
} from '../capabilities';
import { generateDownloadToken } from '../../security/token';
import { validateUrlSafety } from '../../security/ssrf';
import { Logger } from '../../telemetry/logger';

export interface FacebookStreamItem {
  url: string;
  quality: string;
  isAudio?: boolean;
}

export class FacebookProvider extends BasePlatformProvider {
  public readonly id = 'facebook';
  public readonly name = 'Facebook';
  public readonly supportedDomains = [
    'facebook.com',
    'www.facebook.com',
    'm.facebook.com',
    'fb.watch',
  ];
  public readonly supportedMediaTypes: MediaType[] = ['video'];
  public readonly exampleUrl = 'https://www.facebook.com/watch/?v=1234567890';

  private readonly watchPattern = /\/watch\/?$/;
  private readonly reelPattern = /\/reel\/(\d+)/;
  private readonly videoPattern = /\/videos\/(\d+)/;

  /**
   * Cleans tracking query parameters from Facebook URLs.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      'mibextid',
      'rdid',
      'ref',
      'fs',
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

    if (host.includes('fb.watch')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) {
        return {
          status: 'SUPPORTED_PLATFORM',
          platformId: this.id,
          platformName: this.name,
          mediaType: 'video',
          canonicalUrl: cleanUrlString,
          mediaId: id,
        };
      }
    }

    if (this.watchPattern.test(url.pathname)) {
      const v = url.searchParams.get('v');
      if (v) {
        return {
          status: 'SUPPORTED_PLATFORM',
          platformId: this.id,
          platformName: this.name,
          mediaType: 'video',
          canonicalUrl: `https://www.facebook.com/watch/?v=${v}`,
          mediaId: v,
        };
      }
    }

    const reelMatch = url.pathname.match(this.reelPattern);
    if (reelMatch) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: `https://www.facebook.com/reel/${reelMatch[1]}`,
        mediaId: reelMatch[1],
      };
    }

    const videoMatch = url.pathname.match(this.videoPattern);
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

    return {
      status: 'UNSUPPORTED_MEDIA',
      platformId: this.id,
      platformName: this.name,
      errorMessage: 'Link Facebook ini bukan video atau reel publik yang valid.',
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
        detection.errorMessage || 'Link Facebook tidak valid.'
      );
    }

    const apiKey = serverConfig.facebook.apiKey;
    if (!apiKey) {
      Logger.warn('[FacebookProvider] API key is missing in server environment', {
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan Facebook belum dikonfigurasi dengan API token yang valid.'
      );
    }

    const cleanTargetUrl = this.cleanUrl(url);
    const endpointUrl = new URL(
      `/facebook?url=${encodeURIComponent(cleanTargetUrl)}`,
      serverConfig.facebook.baseUrl
    ).toString();

    const maxRetries = serverConfig.facebook.maxRetries;
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
            'X-RapidAPI-Host': serverConfig.facebook.apiHost,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(serverConfig.facebook.resolveTimeoutMs),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 404) {
          throw new TempelinkError(
            'CONTENT_UNAVAILABLE',
            'Video Facebook tidak ditemukan atau telah dihapus.'
          );
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text();
          if (bodyText.includes('not subscribed')) {
            throw new TempelinkError(
              'PROVIDER_UNAVAILABLE',
              'Gateway API Facebook memerlukan aktivasi langganan di dashboard penyedia.'
            );
          }
          throw new TempelinkError(
            'PRIVATE_CONTENT',
            'Video Facebook bersifat privat atau memerlukan autentikasi akun.'
          );
        }

        if (response.status === 429) {
          throw new TempelinkError(
            'RATE_LIMITED',
            'Batas kuota gateway Facebook tercapai. Silakan coba beberapa saat lagi.'
          );
        }

        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }

        throw new TempelinkError(
          'PROVIDER_UNAVAILABLE',
          `Penyedia Facebook merespons dengan kode kesalahan HTTP ${response.status}.`
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
            'Waktu koneksi ke gateway Facebook habis. Silakan coba kembali.'
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
      Logger.error('[FacebookProvider] Upstream failure', {
        error: lastError?.message,
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Gagal menghubungi server Facebook setelah beberapa kali percobaan.'
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Format respons dari gateway Facebook tidak dapat diproses.'
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
    if (
      payload.status === 'error' ||
      payload.status === false ||
      payload.success === false
    ) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        (payload.message as string) ||
          'Video Facebook tidak ditemukan atau tidak dapat diakses.'
      );
    }

    const rawStreams: FacebookStreamItem[] = [];
    let thumbnail: string | null =
      (payload.thumbnail as string) || (payload.thumb as string) || null;

    // Format A (Verified facebook-reels-and-video-downloader): { media: [ { hd_url, sd_url, image } ] }
    if (Array.isArray(payload.media)) {
      for (const m of payload.media) {
        if (m && typeof m === 'object') {
          const item = m as Record<string, unknown>;
          if (typeof item.hd_url === 'string') {
            rawStreams.push({ url: item.hd_url, quality: 'HD' });
          }
          if (typeof item.sd_url === 'string') {
            rawStreams.push({ url: item.sd_url, quality: 'SD' });
          }
          if (!thumbnail && typeof item.image === 'string') {
            thumbnail = item.image;
          }
        }
      }
    }

    // Format B: { links: { "Download High Quality": "...", "Download Low Quality": "..." } }
    if (payload.links && typeof payload.links === 'object') {
      const links = payload.links as Record<string, unknown>;
      for (const [key, val] of Object.entries(links)) {
        if (typeof val === 'string' && val.startsWith('http')) {
          const lowerKey = key.toLowerCase();
          const isHD =
            lowerKey.includes('high') ||
            lowerKey.includes('hd') ||
            lowerKey.includes('720') ||
            lowerKey.includes('1080');
          rawStreams.push({
            url: val,
            quality: isHD ? 'HD' : 'SD',
          });
        }
      }
    } else if (Array.isArray(payload.results)) {
      for (const item of payload.results) {
        if (item && typeof item.url === 'string') {
          rawStreams.push({
            url: item.url,
            quality: item.quality || 'SD',
          });
        }
      }
    } else if (typeof payload.hd === 'string' || typeof payload.sd === 'string') {
      if (typeof payload.hd === 'string') {
        rawStreams.push({ url: payload.hd, quality: 'HD' });
      }
      if (typeof payload.sd === 'string') {
        rawStreams.push({ url: payload.sd, quality: 'SD' });
      }
    } else if (typeof payload.url === 'string') {
      rawStreams.push({
        url: payload.url as string,
        quality: (payload.quality as string) || 'SD',
      });
    }

    if (rawStreams.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan stream video yang dapat diunduh pada link Facebook ini.'
      );
    }

    const title =
      (payload.title as string) ||
      (payload.description as string) ||
      `Facebook Video (${mediaId})`;

    const capabilities = [];
    const seenQualities = new Set<string>();

    for (let i = 0; i < rawStreams.length; i++) {
      const item = rawStreams[i];

      // Validate stream URL against SSRF boundary
      try {
        const parsedStreamUrl = new URL(item.url);
        validateUrlSafety(parsedStreamUrl);
      } catch {
        continue;
      }

      const qualityKey = item.quality.toUpperCase();
      if (seenQualities.has(qualityKey)) {
        continue;
      }
      seenQualities.add(qualityKey);

      if (item.isAudio) {
        const capabilityId = `fb_${mediaId}_audio`;
        const filename = `facebook_${mediaId}_audio.mp3`;
        const downloadToken = generateDownloadToken({
          mediaId,
          capabilityId,
          sourceUrl,
          targetUrl: item.url,
          filename,
          mimeType: 'audio/mpeg',
        });

        capabilities.push(
          createAudioCapability({
            id: capabilityId,
            format: 'mp3',
            label: 'Audio (MP3)',
            downloadUrl: item.url,
            downloadToken,
          })
        );
      } else {
        const isHD = qualityKey.includes('HD') || qualityKey.includes('1080');
        const qualityCat = isHD ? 'hd' : 'standard';
        const capabilityId = `fb_${mediaId}_${qualityCat}_${i + 1}`;
        const label = isHD ? 'HD Video (MP4)' : 'Standard Video (MP4)';
        const filename = `facebook_${mediaId}_${qualityCat}.mp4`;

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
            resolution: isHD ? '1080p' : '720p',
            format: 'mp4',
            label,
            downloadUrl: item.url,
            downloadToken,
          })
        );
      }
    }

    if (capabilities.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Stream video Facebook yang ditemukan tidak memenuhi kriteria keamanan sistem.'
      );
    }

    return {
      mediaId,
      platform: 'facebook',
      mediaType: 'video',
      title,
      sourceUrl,
      thumbnailUrl: thumbnail || capabilities[0].downloadUrl,
      author: typeof payload.author === 'string' ? { name: payload.author } : null,
      capabilities,
    };
  }
}
