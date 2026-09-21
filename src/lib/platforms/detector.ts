import { DetectionResult } from '../types/provider';
import { normalizeAndParseUrl } from '../security/sanitizer';
import { validateUrlSafety } from '../security/ssrf';
import { providerRegistry } from './core/registry';
import { TempelinkError } from '../types/errors';

/**
 * Centralized URL Detection Engine
 * Normalizes input, verifies SSRF safety, matches platform signatures, and checks media validity.
 */
export class PlatformDetector {
  /**
   * Analyzes an input URL string and identifies whether it belongs to a supported platform.
   */
  public static detect(rawUrl: string): DetectionResult {
    let parsedUrl: URL;

    try {
      parsedUrl = normalizeAndParseUrl(rawUrl);
    } catch (err) {
      if (err instanceof TempelinkError) {
        return {
          status: 'INVALID_URL',
          errorMessage: err.userMessage,
        };
      }
      return {
        status: 'INVALID_URL',
        errorMessage: 'Format URL tidak valid.',
      };
    }

    // Guard against SSRF & internal addresses
    try {
      validateUrlSafety(parsedUrl);
    } catch (err) {
      if (err instanceof TempelinkError) {
        return {
          status: 'INVALID_URL',
          errorMessage: err.userMessage,
        };
      }
      return {
        status: 'INVALID_URL',
        errorMessage: 'Alamat URL tidak aman atau diblokir.',
      };
    }

    // Locate matching platform provider
    const provider = providerRegistry.findForUrl(parsedUrl);
    if (!provider) {
      return {
        status: 'UNSUPPORTED_PLATFORM',
        errorMessage: `Platform '${parsedUrl.hostname}' belum didukung oleh Tempelink.`,
      };
    }

    // Delegate platform-specific media path validation
    return provider.detect(parsedUrl);
  }
}
