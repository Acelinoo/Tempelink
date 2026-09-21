import { serverConfig } from '../config';
import { TempelinkError } from '../types/errors';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
}

export interface RateLimiterStore {
  increment(key: string, windowSeconds: number): Promise<{ count: number; resetMs: number }>;
  reset(key: string): Promise<void>;
}

/**
 * In-Memory Sliding Window Store
 * Lightweight, zero-dependency store for Phase 1.
 * Ready to be swapped with Redis in Phase 2 via RateLimiterStore interface.
 */
class MemoryRateLimiterStore implements RateLimiterStore {
  private hits: Map<string, { timestamps: number[] }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean stale entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  public async increment(
    key: string,
    windowSeconds: number
  ): Promise<{ count: number; resetMs: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    let entry = this.hits.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.hits.set(key, entry);
    }

    // Retain only timestamps within the sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    entry.timestamps.push(now);

    const oldest = entry.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + windowMs - now);

    return {
      count: entry.timestamps.length,
      resetMs,
    };
  }

  public async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = serverConfig.rateLimit.windowSeconds * 1000;
    for (const [key, entry] of this.hits.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < maxAge);
      if (entry.timestamps.length === 0) {
        this.hits.delete(key);
      }
    }
  }
}

// Singleton store instance
const memoryStore = new MemoryRateLimiterStore();

/**
 * Validates request rate limit for a client IP.
 * Throws TempelinkError('RATE_LIMITED') if exceeded.
 */
export async function enforceRateLimit(
  clientIp: string,
  action: 'resolve' | 'download' | 'batch'
): Promise<RateLimitResult> {
  let limit: number;
  if (action === 'resolve') {
    limit = serverConfig.rateLimit.resolvePerMinute;
  } else if (action === 'download') {
    limit = serverConfig.rateLimit.downloadPerMinute;
  } else {
    limit = serverConfig.rateLimit.batchPerMinute;
  }
  const windowSec = serverConfig.rateLimit.windowSeconds;

  const key = `rl:${action}:${clientIp || 'unknown'}`;
  const { count, resetMs } = await memoryStore.increment(key, windowSec);

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

  if (!allowed) {
    throw new TempelinkError(
      'RATE_LIMITED',
      'Permintaan terlalu banyak. Silakan tunggu beberapa saat.',
      {
        action,
        limit,
        resetMs,
        retryAfterSeconds,
      }
    );
  }

  return {
    allowed,
    limit,
    remaining,
    resetMs,
    retryAfterSeconds,
  };
}

/**
 * Normalizes an IP address, strips ports, and handles loopback addresses.
 */
export function normalizeIp(rawIp: string): string {
  let cleaned = rawIp.replace(/^\[|\]$/g, '').trim();

  // Strip port if present in IPv4 (e.g. 1.2.3.4:5678)
  if (cleaned.includes('.') && cleaned.includes(':')) {
    const colonIdx = cleaned.lastIndexOf(':');
    cleaned = cleaned.slice(0, colonIdx);
  }

  // Normalize IPv6 localhost
  if (cleaned === '::1' || cleaned === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  return cleaned || '127.0.0.1';
}

/**
 * Extracts and sanitizes client IP from Next.js request headers safely.
 * Prioritizes trusted edge headers (x-vercel-forwarded-for, x-real-ip) over arbitrary client headers.
 */
export function getClientIp(req: Request): string {
  // 1. Vercel edge proxy header (trusted and injected by infrastructure)
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    const primary = vercelForwarded.split(',')[0].trim();
    return normalizeIp(primary);
  }

  // 2. Real IP header
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return normalizeIp(realIp.trim());
  }

  // 3. Fallback to standard x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return normalizeIp(parts[0]);
    }
  }

  return '127.0.0.1';
}
