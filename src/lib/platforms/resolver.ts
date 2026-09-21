import { normalizeAndParseUrl } from '../security/sanitizer';
import { validateUrlSafety } from '../security/ssrf';
import { providerRegistry } from './core/registry';
import { TempelinkError } from '../types/errors';
import { ProviderContext } from '../types/provider';
import { PublicMediaResponse } from '../types/media';

import { resolveCache, ResolveCacheResult } from '../cache/resolve-cache';
import { ProviderCircuitBreaker } from './core/circuit-breaker';

export interface ResolvePipelineResult {
  response: PublicMediaResponse;
  source: 'CACHE' | 'COALESCED' | 'LIVE';
}

/**
 * Central Media Resolver Pipeline
 * Normalizes input, coordinates security checks, enforces resolve caching & request coalescing,
 * protects upstream services with circuit breaking, delegates to provider, and strips sensitive internals.
 */
export class PlatformResolver {
  public static async resolveWithSource(
    rawUrl: string,
    context?: ProviderContext
  ): Promise<ResolvePipelineResult> {
    // 1. Sanitize & parse
    const parsedUrl = normalizeAndParseUrl(rawUrl);

    // 2. Validate SSRF perimeter
    validateUrlSafety(parsedUrl);

    // 3. Locate provider
    const provider = providerRegistry.findForUrl(parsedUrl);
    if (!provider) {
      throw new TempelinkError(
        'UNSUPPORTED_PLATFORM',
        `Platform '${parsedUrl.hostname}' belum didukung oleh Tempelink.`
      );
    }

    // 4. Resolve via cache or coalesce with single-flight worker + circuit breaker
    const correlationId = context?.correlationId || 'resolve_pipeline';
    const cacheKey = resolveCache.generateKey(provider.id, parsedUrl.toString());

    const cacheResult: ResolveCacheResult = await resolveCache.getOrResolve(
      cacheKey,
      correlationId,
      async () => {
        // Resolve via provider protected by Circuit Breaker
        const internalResolution = await ProviderCircuitBreaker.execute(
          provider.id,
          () => provider.resolve(parsedUrl, context)
        );

        // Convert to safe public response (strip any internal provider tokens/cookies)
        const publicResponse: PublicMediaResponse = {
          id: internalResolution.mediaId,
          platform: internalResolution.platform,
          mediaType: internalResolution.mediaType,
          title: internalResolution.title,
          description: internalResolution.description || null,
          author: internalResolution.author || null,
          thumbnailUrl: internalResolution.thumbnailUrl || null,
          durationSeconds: internalResolution.durationSeconds || null,
          sourceUrl: internalResolution.sourceUrl,
          capabilities: internalResolution.capabilities,
          warnings: internalResolution.warnings || [],
        };

        return publicResponse;
      }
    );

    return {
      response: cacheResult.data,
      source: cacheResult.source,
    };
  }

  public static async resolve(
    rawUrl: string,
    context?: ProviderContext
  ): Promise<PublicMediaResponse> {
    const { response } = await this.resolveWithSource(rawUrl, context);
    return response;
  }
}
