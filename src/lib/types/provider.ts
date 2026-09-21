import { MediaResolution, MediaType } from './media';

export type DetectionStatus =
  | 'SUPPORTED_PLATFORM'
  | 'UNSUPPORTED_PLATFORM'
  | 'INVALID_URL'
  | 'UNSUPPORTED_MEDIA';

export interface DetectionResult {
  status: DetectionStatus;
  platformId?: string;
  platformName?: string;
  mediaType?: MediaType;
  canonicalUrl?: string;
  mediaId?: string;
  errorMessage?: string;
}

export interface ProviderContext {
  correlationId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface PlatformInfo {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'maintenance';
  supportedMedia: MediaType[];
  exampleUrl: string;
}

export interface PlatformProvider {
  /**
   * Unique machine identifier (e.g. 'tiktok', 'instagram', 'youtube', 'x', 'facebook', 'pinterest')
   */
  readonly id: string;

  /**
   * Human-readable name for UI badges
   */
  readonly name: string;

  /**
   * Primary domains handled by this provider
   */
  readonly supportedDomains: string[];

  /**
   * Media types this provider can resolve
   */
  readonly supportedMediaTypes: MediaType[];

  /**
   * Example URL for testing & documentation
   */
  readonly exampleUrl: string;

  /**
   * Quick predicate to check whether this provider can handle the URL.
   */
  canHandle(url: URL): boolean;

  /**
   * Detects whether the URL points to supported media and extracts metadata.
   */
  detect(url: URL): DetectionResult;

  /**
   * Resolves the media and returns available capabilities.
   * Throws TempelinkError on failures.
   */
  resolve(url: URL, context?: ProviderContext): Promise<MediaResolution>;
}
