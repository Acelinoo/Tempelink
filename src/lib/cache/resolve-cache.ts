import { PublicMediaResponse } from '../types/media';
import { TempelinkError, TempelinkErrorCode } from '../types/errors';
import { serverConfig } from '../config';
import { Logger } from '../telemetry/logger';
import { trackEvent } from '../telemetry/events';

export interface CacheEntrySuccess {
  type: 'success';
  data: PublicMediaResponse;
  expiresAt: number;
  createdAt: number;
}

export interface CacheEntryError {
  type: 'error';
  error: TempelinkError;
  expiresAt: number;
  createdAt: number;
}

export type CacheEntry = CacheEntrySuccess | CacheEntryError;

export interface ResolveCacheResult {
  data: PublicMediaResponse;
  source: 'CACHE' | 'COALESCED' | 'LIVE';
}

/**
 * Strips common tracking and analytics query parameters across social platforms
 * to construct a robust, canonical cache key.
 */
export function canonicalizeUrlForCache(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // Remove tracking query parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'igsh',
      'ig_mid',
      'img_index',
      '_r',
      '_t',
      'is_from_webapp',
      'sender_device',
      'share_app_id',
      'share_item_id',
      'fbclid',
      'gclid',
      'ref',
      'source',
    ];
    trackingParams.forEach((param) => url.searchParams.delete(param));

    // Sort remaining query params for determinism
    url.searchParams.sort();

    // Standardize trailing slash on pathname
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

export interface ResolveCacheStore {
  get(key: string): CacheEntry | null | Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): void | Promise<void>;
  delete(key: string): void | Promise<void>;
  clear(): void | Promise<void>;
  size(): number;
}

/**
 * MemoryResolveCacheStore
 * Bounded in-memory LRU cache store for serverless instances and local dev.
 */
export class MemoryResolveCacheStore implements ResolveCacheStore {
  private cache = new Map<string, CacheEntry>();

  public get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order on hit
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  public set(key: string, entry: CacheEntry): void {
    const maxEntries = serverConfig.cache.maxEntries;
    while (this.cache.size >= maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
    this.cache.set(key, entry);
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

/**
 * ResolveCache & SingleFlight Coalescer
 * Manages resolution caching across pluggable stores, transient error skipping,
 * negative caching for definitive errors, and request deduplication.
 */
export class ResolveCache {
  private store: ResolveCacheStore;
  private inFlight = new Map<string, Promise<PublicMediaResponse>>();

  constructor(store?: ResolveCacheStore) {
    this.store = store || new MemoryResolveCacheStore();
  }

  public getCacheSize(): number {
    return this.store.size();
  }

  public getInFlightCount(): number {
    return this.inFlight.size;
  }

  public clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  /**
   * Generates a stable normalized cache key.
   */
  public generateKey(platformId: string, url: string): string {
    const canonical = canonicalizeUrlForCache(url);
    return `${platformId}:${canonical}`;
  }

  /**
   * Determines whether an error is a permanent/definitive semantic error
   * suitable for short negative caching.
   */
  private isFatalSemanticError(error: unknown): boolean {
    if (error instanceof TempelinkError) {
      const negativeCacheableCodes: TempelinkErrorCode[] = [
        'UNSUPPORTED_PLATFORM',
        'INVALID_URL',
        'UNSUPPORTED_MEDIA',
        'CONTENT_UNAVAILABLE',
      ];
      return negativeCacheableCodes.includes(error.code);
    }
    return false;
  }

  /**
   * Reads from cache if entry is fresh.
   */
  public get(key: string): CacheEntry | null {
    if (!serverConfig.cache.enabled) {
      return null;
    }
    const res = this.store.get(key);
    return res instanceof Promise ? null : res;
  }

  /**
   * Stores a successful resolution result with TTL.
   */
  public setSuccess(
    key: string,
    data: PublicMediaResponse,
    ttlSeconds = serverConfig.cache.resolveTtlSeconds
  ): void {
    if (!serverConfig.cache.enabled || ttlSeconds <= 0) {
      return;
    }

    const now = Date.now();
    this.store.set(key, {
      type: 'success',
      data,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  /**
   * Stores a definitive failure result with short negative TTL.
   */
  public setError(
    key: string,
    error: TempelinkError,
    ttlSeconds = serverConfig.cache.negativeTtlSeconds
  ): void {
    if (!serverConfig.cache.enabled || ttlSeconds <= 0) {
      return;
    }

    const now = Date.now();
    this.store.set(key, {
      type: 'error',
      error,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  /**
   * Coordinates Resolution with Single-Flight Coalescing and Caching.
   * Fail-open: If cache operations fail, seamlessly falls back to resolverFn.
   */
  public async getOrResolve(
    key: string,
    correlationId: string,
    resolverFn: () => Promise<PublicMediaResponse>
  ): Promise<ResolveCacheResult> {
    // 1. Check cache
    try {
      const cached = this.get(key);
      if (cached) {
        if (cached.type === 'success') {
          trackEvent({
            correlationId,
            eventType: 'cache_hit',
            platform: cached.data.platform,
            mediaType: cached.data.mediaType,
            cacheStatus: 'HIT',
          });
          return { data: cached.data, source: 'CACHE' };
        }

        if (cached.type === 'error') {
          trackEvent({
            correlationId,
            eventType: 'cache_hit',
            errorCode: cached.error.code,
            cacheStatus: 'HIT',
          });
          throw cached.error;
        }
      }
    } catch (err) {
      if (err instanceof TempelinkError) {
        throw err;
      }
      Logger.warn('[ResolveCache] Error reading cache; failing open to live resolution', {
        error: String(err),
      });
    }

    // 2. Check in-flight single-flight coalescing
    const existingInFlight = this.inFlight.get(key);
    if (existingInFlight) {
      trackEvent({
        correlationId,
        eventType: 'cache_coalesced',
        cacheStatus: 'COALESCED',
      });
      const data = await existingInFlight;
      return { data, source: 'COALESCED' };
    }

    // 3. Execute live resolution and coalesce any simultaneous incoming requests
    trackEvent({
      correlationId,
      eventType: 'cache_miss',
      cacheStatus: 'MISS',
    });

    const executionPromise = (async () => {
      try {
        const liveResult = await resolverFn();
        this.setSuccess(key, liveResult);
        return liveResult;
      } catch (err) {
        if (this.isFatalSemanticError(err)) {
          this.setError(key, err as TempelinkError);
        }
        throw err;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, executionPromise);

    const result = await executionPromise;
    return { data: result, source: 'LIVE' };
  }
}

// Global resolve cache singleton
export const resolveCache = new ResolveCache();
