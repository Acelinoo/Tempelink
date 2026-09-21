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

export interface XMediaFormat {
  quality?: string;
  url: string;
  type?: string;
  width?: number | null;
  height?: number | null;
}

export class XProvider extends BasePlatformProvider {
  public readonly id = 'x';
  public readonly name = 'X / Twitter';
  public readonly supportedDomains = ['x.com', 'twitter.com'];
  public readonly supportedMediaTypes: MediaType[] = ['video', 'image', 'gif'];
  public readonly exampleUrl = 'https://x.com/username/status/1234567890123456789';

  private readonly statusPattern = /\/status\/(\d+)/;

  /**
   * Cleans tracking query parameters from X/Twitter URLs.
   */
  public cleanUrl(url: URL): string {
    const clean = new URL(url.toString());
    const trackingParams = [
      's',
      't',
      'ref_src',
      'ref_url',
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
    const match = url.pathname.match(this.statusPattern);
    if (match) {
      return {
        status: 'SUPPORTED_PLATFORM',
        platformId: this.id,
        platformName: this.name,
        mediaType: 'video',
        canonicalUrl: `https://x.com/i/status/${match[1]}`,
        mediaId: match[1],
      };
    }

    return {
      status: 'UNSUPPORTED_MEDIA',
      platformId: this.id,
      platformName: this.name,
      errorMessage: 'Link X/Twitter ini bukan postingan status atau video yang valid.',
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
        detection.errorMessage || 'Link X/Twitter tidak valid.'
      );
    }

    const apiKey = serverConfig.x.apiKey;
    if (!apiKey) {
      Logger.warn('[XProvider] API key is missing in server environment', {
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_NOT_CONFIGURED',
        'Layanan X/Twitter belum dikonfigurasi dengan API token yang valid.'
      );
    }

    const canonicalUrl = `https://x.com/i/status/${detection.mediaId}`;
    const endpointUrl = new URL(
      `/?url=${encodeURIComponent(canonicalUrl)}`,
      serverConfig.x.baseUrl
    ).toString();

    const maxRetries = serverConfig.x.maxRetries;
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
            'X-RapidAPI-Host': serverConfig.x.apiHost,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(serverConfig.x.resolveTimeoutMs),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 404) {
          throw new TempelinkError(
            'CONTENT_UNAVAILABLE',
            'Postingan X/Twitter tidak ditemukan atau telah dihapus.'
          );
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text();
          if (bodyText.includes('not subscribed')) {
            throw new TempelinkError(
              'PROVIDER_UNAVAILABLE',
              'Gateway API X/Twitter memerlukan aktivasi langganan di dashboard penyedia.'
            );
          }
          throw new TempelinkError(
            'PRIVATE_CONTENT',
            'Postingan X/Twitter bersifat privat atau memerlukan autentikasi akun.'
          );
        }

        if (response.status === 429) {
          throw new TempelinkError(
            'RATE_LIMITED',
            'Batas kuota gateway X/Twitter tercapai. Silakan coba beberapa saat lagi.'
          );
        }

        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          continue;
        }

        throw new TempelinkError(
          'PROVIDER_UNAVAILABLE',
          `Penyedia X/Twitter merespons dengan kode kesalahan HTTP ${response.status}.`
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
            'Waktu koneksi ke gateway X/Twitter habis. Silakan coba kembali.'
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
      Logger.error('[XProvider] Upstream failure', {
        error: lastError?.message,
        correlationId,
      });
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Gagal menghubungi server X/Twitter setelah beberapa kali percobaan.'
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Format respons dari gateway X/Twitter tidak dapat diproses.'
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
    if (payload.status === 'error' || payload.status === false) {
      throw new TempelinkError(
        'CONTENT_UNAVAILABLE',
        (payload.message as string) ||
          'Media X/Twitter tidak ditemukan atau tidak dapat diakses.'
      );
    }

    if (
      payload.messages &&
      typeof payload.messages === 'string' &&
      payload.messages.includes('unreachable')
    ) {
      throw new TempelinkError(
        'PROVIDER_UNAVAILABLE',
        'Layanan gateway X/Twitter saat ini sedang tidak dapat dihubungi penyedia.'
      );
    }

    const rawFormats: XMediaFormat[] = [];
    let title: string | null =
      (payload.title as string) || (payload.text as string) || null;
    let thumbnail: string | null =
      (payload.thumbnail as string) || (payload.thumb as string) || null;
    let author: { username?: string | null; name?: string | null } | null = null;

    // Format A (Verified twitter-video-downloader2): { status: "success", data: { src, thumb, caption, username } }
    if (payload.data && typeof payload.data === 'object') {
      const data = payload.data as Record<string, unknown>;
      if (typeof data.src === 'string' && data.src.length > 0) {
        const resMatch = data.src.match(/\/(\d{3,4})x(\d{3,4})\//);
        const height = resMatch ? parseInt(resMatch[2], 10) : null;
        const width = resMatch ? parseInt(resMatch[1], 10) : null;
        const quality = height ? `${height}p` : '720p';
        rawFormats.push({
          url: data.src,
          quality,
          type: 'mp4',
          height,
          width,
        });
      }
      if (!thumbnail && typeof data.thumb === 'string') {
        thumbnail = data.thumb;
      }
      if (!title && typeof data.caption === 'string') {
        title = data.caption;
      }
      if (typeof data.username === 'string') {
        author = { username: data.username };
      }
    }

    // Format B: formats / links array
    const candidateList =
      payload.formats || payload.links || payload.media || payload.videos;

    if (Array.isArray(candidateList)) {
      for (const item of candidateList) {
        if (item && typeof item.url === 'string') {
          rawFormats.push({
            url: item.url,
            quality: item.quality || item.resolution,
            type: item.type || item.extension || 'mp4',
            width: item.width || null,
            height: item.height || null,
          });
        }
      }
    } else if (typeof payload.url === 'string') {
      rawFormats.push({
        url: payload.url as string,
        quality: (payload.quality as string) || '720p',
        type: 'mp4',
      });
    }

    if (rawFormats.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Tidak ditemukan media yang dapat diunduh pada postingan X/Twitter ini.'
      );
    }

    title = title || `X Post (${mediaId})`;

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
      const type = (item.type || 'mp4').toLowerCase();
      const isImage =
        type === 'jpg' ||
        type === 'jpeg' ||
        type === 'png' ||
        type === 'webp' ||
        item.url.includes('.jpg') ||
        item.url.includes('.png');

      const key = `${isImage ? 'img' : 'vid'}_${qualityRaw}`;
      if (seenQualities.has(key)) {
        continue;
      }
      seenQualities.add(key);

      if (isImage) {
        const capabilityId = `x_${mediaId}_image_${i + 1}`;
        const filename = `x_${mediaId}_image_${i + 1}.jpg`;
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
            label: `Foto ${i + 1} (JPG)`,
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
        const capabilityId = `x_${mediaId}_${qualityCat}_${i + 1}`;
        const label =
          qualityCat === 'hd'
            ? `HD ${resolutionClean} (MP4)`
            : `Standard ${resolutionClean} (MP4)`;
        const filename = `x_${mediaId}_${qualityCat}_${resolutionClean}.mp4`;

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
      }
    }

    if (capabilities.length === 0) {
      throw new TempelinkError(
        'RESOLUTION_FAILED',
        'Media X/Twitter yang ditemukan tidak memenuhi kriteria keamanan sistem.'
      );
    }

    const hasVideo = capabilities.some((c) => c.type === 'video');

    return {
      mediaId,
      platform: 'x',
      mediaType: hasVideo ? 'video' : 'image',
      title,
      sourceUrl,
      thumbnailUrl: thumbnail || capabilities[0].downloadUrl,
      author: author || (typeof payload.author === 'string' ? { username: payload.author } : null),
      capabilities,
    };
  }
}
