/**
 * Tempelink Central Configuration
 * Strictly isolates client-accessible configuration from server secrets.
 */

import { TempelinkError } from './types/errors';

export const publicConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Tempelink',
  appDescription:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    'Universal Media Downloader & Capability Platform',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};


export const DEV_DEFAULT_SIGNING_SECRET = 'tempelink_dev_secret_signing_key_32_chars';

export function getDownloadSigningSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.DOWNLOAD_SIGNING_SECRET;

  if (isProduction) {
    if (!secret || secret === DEV_DEFAULT_SIGNING_SECRET || secret.length < 32) {
      throw new TempelinkError(
        'INTERNAL_ERROR',
        'Konfigurasi server tidak aman: DOWNLOAD_SIGNING_SECRET wajib disetel ke kunci acak minimal 32 karakter pada lingkungan produksi.'
      );
    }
    return secret;
  }

  return secret || DEV_DEFAULT_SIGNING_SECRET;
}

export const serverConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Rate Limiting
  rateLimit: {
    resolvePerMinute: Number(process.env.RATE_LIMIT_RESOLVE_PER_MINUTE) || 20,
    downloadPerMinute: Number(process.env.RATE_LIMIT_DOWNLOAD_PER_MINUTE) || 10,
    batchPerMinute: Number(process.env.RATE_LIMIT_BATCH_PER_MINUTE) || 5,
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60,
  },

  // Security / SSRF Guard & Abuse Protection (Phase 9)
  security: {
    enforceStrictLocalBlock:
      process.env.SSRF_ENFORCE_STRICT_LOCAL_BLOCK !== 'false',
    allowedProtocols: (process.env.SSRF_ALLOWED_PROTOCOLS || 'http,https').split(','),
    maxBodySizeBytes: Number(process.env.MAX_BODY_SIZE_BYTES) || 65536, // 64 KB default
    maxUrlLength: Number(process.env.MAX_URL_LENGTH) || 2048,
    turnstileSecretKey: (process.env.TURNSTILE_SECRET_KEY || '').trim(),
  },

  // TikTok Upstream Provider Settings
  tiktok: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.TIKTOK_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.TIKTOK_PROVIDER_API_HOST ||
      'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com',
    baseUrl:
      process.env.TIKTOK_PROVIDER_BASE_URL ||
      'https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.TIKTOK_RESOLVE_TIMEOUT_MS) || 8000,
    maxRetries: Number(process.env.TIKTOK_MAX_RETRIES) || 2,
  },

  // Instagram Upstream Provider Settings
  instagram: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.INSTAGRAM_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.INSTAGRAM_PROVIDER_API_HOST ||
      'instagram-post-reels-stories-downloader-api.p.rapidapi.com',
    baseUrl:
      process.env.INSTAGRAM_PROVIDER_BASE_URL ||
      'https://instagram-post-reels-stories-downloader-api.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.INSTAGRAM_RESOLVE_TIMEOUT_MS) || 10000,
    maxRetries: Number(process.env.INSTAGRAM_MAX_RETRIES) || 2,
  },

  // YouTube Upstream Provider Settings
  youtube: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.YOUTUBE_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.YOUTUBE_PROVIDER_API_HOST ||
      'youtube-media-downloader.p.rapidapi.com',
    baseUrl:
      process.env.YOUTUBE_PROVIDER_BASE_URL ||
      'https://youtube-media-downloader.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.YOUTUBE_RESOLVE_TIMEOUT_MS) || 15000,
    maxRetries: Number(process.env.YOUTUBE_MAX_RETRIES) || 2,
  },

  // X / Twitter Upstream Provider Settings
  x: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.X_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.X_PROVIDER_API_HOST ||
      'twitter-video-downloader2.p.rapidapi.com',
    baseUrl:
      process.env.X_PROVIDER_BASE_URL ||
      'https://twitter-video-downloader2.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.X_RESOLVE_TIMEOUT_MS) || 10000,
    maxRetries: Number(process.env.X_MAX_RETRIES) || 2,
  },

  // Pinterest Upstream Provider Settings
  pinterest: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.PINTEREST_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.PINTEREST_PROVIDER_API_HOST ||
      'pinterest-video-and-image-downloader.p.rapidapi.com',
    baseUrl:
      process.env.PINTEREST_PROVIDER_BASE_URL ||
      'https://pinterest-video-and-image-downloader.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.PINTEREST_RESOLVE_TIMEOUT_MS) || 10000,
    maxRetries: Number(process.env.PINTEREST_MAX_RETRIES) || 2,
  },

  // Facebook Upstream Provider Settings
  facebook: {
    _customApiKey: undefined as string | undefined,
    get apiKey(): string {
      if (this._customApiKey !== undefined) {
        return this._customApiKey;
      }
      return (process.env.FACEBOOK_PROVIDER_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '');
    },
    set apiKey(val: string) {
      this._customApiKey = val;
    },
    apiHost:
      process.env.FACEBOOK_PROVIDER_API_HOST ||
      'facebook-reels-and-video-downloader.p.rapidapi.com',
    baseUrl:
      process.env.FACEBOOK_PROVIDER_BASE_URL ||
      'https://facebook-reels-and-video-downloader.p.rapidapi.com',
    resolveTimeoutMs: Number(process.env.FACEBOOK_RESOLVE_TIMEOUT_MS) || 10000,
    maxRetries: Number(process.env.FACEBOOK_MAX_RETRIES) || 2,
  },

  // Download Token & Delivery
  download: {
    _customSigningSecret: undefined as string | undefined,
    get signingSecret(): string {
      if (this._customSigningSecret !== undefined) {
        return this._customSigningSecret;
      }
      return getDownloadSigningSecret();
    },
    set signingSecret(val: string) {
      this._customSigningSecret = val;
    },
    tokenExpirySeconds: Number(process.env.DOWNLOAD_TOKEN_EXPIRY_SECONDS) || 900, // 15 mins
  },

  // Batch & Queue Configuration (Phase 6 & 9)
  batch: {
    driver: (process.env.BATCH_STORE_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'file')) as 'file' | 'postgres',
    maxBatchSize: Number(process.env.MAX_BATCH_SIZE) || 10,
    concurrency: Number(process.env.QUEUE_CONCURRENCY) || 2,
    maxAttempts: Number(process.env.MAX_JOB_ATTEMPTS) || 2,
    maxActiveBatchesPerClient:
      Number(process.env.MAX_ACTIVE_BATCHES_PER_CLIENT) || 2,
    rateLimitPerMinute: Number(process.env.RATE_LIMIT_BATCH_PER_MINUTE) || 5,
  },

  // Cache & Optimization Configuration (Phase 7)
  cache: {
    enabled: process.env.RESOLVE_CACHE_ENABLED !== 'false',
    resolveTtlSeconds: Number(process.env.RESOLVE_CACHE_TTL_SECONDS) || 300, // 5 minutes default
    negativeTtlSeconds: Number(process.env.NEGATIVE_CACHE_TTL_SECONDS) || 60, // 1 minute default
    maxEntries: Number(process.env.RESOLVE_CACHE_MAX_ENTRIES) || 1000,
  },

  // Provider Circuit Breaker (Phase 9)
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
    failureThreshold: Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 3,
    cooldownSeconds: Number(process.env.CIRCUIT_BREAKER_COOLDOWN_SECONDS) || 30,
  },

  // Database Connection (Phase 9 Production Hardening)
  database: {
    url: (process.env.DATABASE_URL || '').trim(),
    ssl: process.env.DATABASE_SSL !== 'false',
  },
};

