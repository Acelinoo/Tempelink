import {
  PlatformProvider,
  DetectionResult,
  ProviderContext,
} from '../../types/provider';
import { MediaResolution, MediaType } from '../../types/media';

/**
 * BasePlatformProvider
 * Abstract foundation that all platform providers extend.
 */
export abstract class BasePlatformProvider implements PlatformProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly supportedDomains: string[];
  public abstract readonly supportedMediaTypes: MediaType[];
  public abstract readonly exampleUrl: string;

  /**
   * Default domain check matching the hostname or any parent domain.
   */
  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return this.supportedDomains.some((domain) => {
      const d = domain.toLowerCase();
      return host === d || host.endsWith(`.${d}`);
    });
  }

  /**
   * Platform-specific URL parsing and validation.
   */
  public abstract detect(url: URL): DetectionResult;

  /**
   * Platform-specific media resolution.
   */
  public abstract resolve(
    url: URL,
    context?: ProviderContext
  ): Promise<MediaResolution>;
}
