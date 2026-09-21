# Tempelink — Phase 7: Performance, Cache & CDN Optimization Audit

## 1. Executive Summary

This document presents a comprehensive architectural and performance audit of the Tempelink codebase prior to implementing Phase 7. The primary objective is to optimize resolution speed, eliminate redundant upstream API requests, introduce safe resolution caching and request deduplication (single-flight coalescing), ensure CDN readiness, and establish explicit HTTP caching policies without breaking download security, SSRF boundaries, or the Phase 6 batch queue.

---

## 2. Core Audit Findings & Detailed Question Analysis

### Q1: Where are provider requests performed?
Provider requests are executed strictly inside individual provider classes located in `src/lib/platforms/providers/`:
- **TikTokProvider** (`src/lib/platforms/providers/tiktok.ts`): calls RapidAPI `tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com` via `fetchWithRetry()`
- **InstagramProvider** (`src/lib/platforms/providers/instagram.ts`): calls RapidAPI `instagram-post-reels-stories-downloader-api.p.rapidapi.com`
- **YouTubeProvider** (`src/lib/platforms/providers/youtube.ts`): calls RapidAPI `youtube-video-and-shorts-downloader.p.rapidapi.com`
- **XProvider** (`src/lib/platforms/providers/twitter.ts`): calls RapidAPI `twitter-video-downloader2.p.rapidapi.com`
- **FacebookProvider** (`src/lib/platforms/providers/facebook.ts`): calls RapidAPI `facebook-reels-and-video-downloader.p.rapidapi.com`
- **PinterestProvider** (`src/lib/platforms/providers/pinterest.ts`): calls RapidAPI `pinterest-media-download1.p.rapidapi.com`

### Q2: Where does media resolution happen?
Media resolution is orchestrated centrally in `PlatformResolver.resolve()` (`src/lib/platforms/resolver.ts`). It performs:
1. URL sanitization and parsing (`normalizeAndParseUrl`)
2. SSRF perimeter boundary validation (`validateUrlSafety`)
3. Platform provider detection via `providerRegistry.findForUrl()`
4. Provider execution (`provider.resolve(parsedUrl, context)`)
5. Transformation to sanitized `PublicMediaResponse` stripping internal secrets/cookies.

Both `/api/media/resolve` (interactive user requests) and `QueueRunner` (Phase 6 batch queue) call `PlatformResolver.resolve()`.

### Q3: Which results are safe to cache?
The following results are safe to cache with a bounded TTL:
- **Platform Detection**: Deterministic regex matching on URL host and path.
- **Media Metadata**: `title`, `description`, `author`, `thumbnailUrl`, `durationSeconds`, `mediaType`, and `platform`.
- **Capability Schema**: The list of available resolutions/formats (`standard`, `hd`, `audio_only`, `image`, bitrates, codecs).
- **Media Resolution Result with Signed Download Tokens**: Safe for a short bounded TTL (e.g. 5 minutes / 300s). Since HMAC download tokens are generated with a 15-minute expiration (`tokenExpirySeconds: 900`), returning a cached token within 5 minutes ensures the client still has at least 10 minutes of active validity.
- **Platform Catalog**: `GET /api/platforms` static metadata.

### Q4: Which results MUST NOT be cached?
- Upstream API credentials, RapidAPI keys, and server environment secrets.
- HMAC signing keys (`DOWNLOAD_SIGNING_SECRET`).
- Client IP addresses and client-specific request correlation IDs.
- Rate limiting quota states (`enforceRateLimit`).
- Download execution endpoints (`/api/media/download` GET/POST): must always enforce token verification, SSRF check, and rate limits dynamically (`Cache-Control: no-store`).
- Batch creation and batch mutation routes (`/api/batch`, `/api/batch/:id/cancel`, `/api/batch/:id/retry`).
- Batch polling status (`/api/batch/:id`): must remain `no-store` while processing to avoid stale job state in the client.
- Download tokens past their cryptographic expiration.

### Q5: Are provider media URLs temporary?
**YES**. All verified providers return CDN URLs with signed authorization tokens and expiration timestamps:
- TikTok CDN: URLs contain signature tokens expiring within ~6–24 hours.
- Instagram CDN (`scontent...cdninstagram.com`): Query parameters include `oe=<hex_timestamp>`, typically expiring within 24 hours.
- YouTube CDN (`googlevideo.com`): Query parameters include `expire=<unix_timestamp>`, typically expiring within 6 hours.
- Facebook CDN: Query parameters include `oe=<hex_timestamp>`, typically expiring within 24–48 hours.
- X/Twitter: `video.twimg.com` streams expire after a bounded period.
- **Audit Conclusion**: Because upstream CDN URLs are temporary, long-lived caching (e.g., hours or days) is strictly unsafe as it would lead to dead download links. A short TTL of **300 seconds (5 minutes)** is optimal: long enough to prevent duplicate API hits and absorb bursts, but short enough that media URLs remain fresh.

### Q6: Which existing APIs are cacheable?
- `GET /api/platforms`: Public static metadata, cacheable at CDN edge (`Cache-Control: public, max-age=3600, stale-while-revalidate=86400`).
- `POST /api/media/resolve`: Not cacheable via HTTP `Cache-Control` because it is an HTTP `POST` accepting dynamic JSON payloads. However, its **internal resolution pipeline** is prime for application-level caching and request deduplication.

### Q7: Which APIs must remain dynamic?
- `POST /api/media/resolve`: HTTP layer must remain dynamic to return per-request rate limit headers and correlation IDs.
- `POST /api/media/download`: Must validate token and apply rate limits on every invocation.
- `GET /api/media/download`: Must validate token and perform SSRF check before issuing 302 redirect.
- `POST /api/batch`: Must validate client IP quota and create a new batch entity.
- `GET /api/batch/:id`: Must return live status while jobs progress.
- `POST /api/batch/:id/cancel`: State mutation.
- `POST /api/batch/:id/retry`: State mutation.

### Q8: Where are cache headers currently configured?
- `src/app/api/platforms/route.ts`: Has `public, max-age=3600, stale-while-revalidate=86400`.
- `src/app/api/media/download/route.ts`: Has `no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`.
- `src/app/api/batch/[id]/route.ts`: Has `no-store, max-age=0`.
- `src/app/api/media/resolve/route.ts`: Currently lacks explicit `Cache-Control: no-store` headers (Next.js defaults POST to no-store, but setting it explicitly prevents proxy anomalies).
- `next.config.ts`: Currently empty; lacks asset cache headers and security headers.

### Q9: What is currently cached by Next.js?
- Turbopack compilation artifacts.
- Static page shells (`/`, `/_not-found`).
- Immutable frontend bundles (`/_next/static/*` with `max-age=31536000, immutable`).

### Q10: What is currently cached by Vercel/CDN?
- Hashed static assets in `/_next/static/`.
- `GET /api/platforms` edge cached for 1 hour.
- All other API routes run as serverless functions with zero edge caching.

### Q11: What is currently stored only in memory?
- Sliding-window rate limit counters (`Map<string, ClientRateState>`).
- Batch execution mutexes (`locks: Map<string, Promise<void>>`).
- Worker in-flight jobs (`inFlightJobs: Set<string>`).
- Memory index of loaded batches (`memoryIndex: Map<string, Batch>`).

### Q12: What is stored on local filesystem?
- Persisted batch JSON files in `.data/batches/<batchId>.json` managed by `FileBatchStore`.

### Q13: Can FileBatchStore safely work across multiple Vercel instances?
**NO**. On Vercel:
- Serverless lambdas operate with isolated, ephemeral filesystems.
- Instances do NOT share `.data/batches/`. A batch created on instance A cannot be polled from instance B without shared storage.
- Background loops (`QueueRunner.scheduleNext()`) in serverless lambdas may freeze when the HTTP response completes.
- **Architectural Decision**: `FileBatchStore` is fully valid and persistent for single-instance Node.js deployments (e.g. Docker, VPS, standalone container). Replacing `FileBatchStore` with a distributed storage system (Redis/PostgreSQL) is an infrastructure change that belongs to Phase 9. For Phase 7, the `FileBatchStore` remains intact and this limitation is explicitly documented.

### Q14: What are the biggest current performance bottlenecks?
1. **Zero Resolution Caching**: Repeated queries for identical media URLs (viral clips, popular music) always hit upstream RapidAPI providers, incurring 1.1s to 5.4s latency each time.
2. **Thundering Herd / No Request Coalescing**: Multiple concurrent requests for the same URL execute multiple parallel upstream network calls.
3. **Batch Redundancy**: If a batch contains duplicate URLs or URLs previously resolved, each job issues an upstream network call without benefiting from a shared cache.
4. **Missing Production Next.js Optimizations**: `next.config.ts` lacks gzip/brotli compression flags, power-by header suppression, and static asset security headers.

### Q15: What can be optimized without changing provider contracts?
1. **Application-Level Resolve Cache (`ResolveCache`)**: In-memory LRU/TTL cache keyed by canonical sanitized URL. Serves repeated resolutions in < 1ms.
2. **Single-Flight Request Coalescer (`SingleFlight`)**: Collapses concurrent identical resolve requests into a single upstream call.
3. **Negative Caching for Fatal Semantic Errors**: Short TTL (60s) for definitive errors (`UNSUPPORTED_PLATFORM`, `INVALID_URL`, `CONTENT_UNAVAILABLE`) to prevent request flooding, while transient errors (`TEMPORARY_FAILURE`, `PROVIDER_UNAVAILABLE`) have zero or negligible negative TTL.
4. **API Route Cache Headers**: Explicit `Cache-Control` on all routes.
5. **Next.js Config Optimization**: `poweredByHeader: false`, compression, and asset caching headers.

### Q16: What requires external infrastructure?
- Cross-instance distributed cache (requires Redis / Upstash).
- Cross-instance persistent queue (requires Redis/BullMQ or PostgreSQL).
- Media caching CDN proxy (requires dedicated edge egress bucket / Cloudflare R2 / AWS S3).

### Q17: What should remain deferred?
- Distributed Redis caching and distributed BullMQ workers (Phase 9).
- Media file chunk caching / proxying (Phase 9 / 10).
- SEO landing pages (Phase 8).
- Monetization and rate limit tiers (Phase 10).

---

## 3. Provider Latency & Cacheability Matrix

Measured empirically on 2026-09-21 using active media URLs:

| Provider | Upstream Host | Measured Latency | Cacheability | Upstream URL Lifetime | Strategy |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **TikTok** | `tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com` | **5,243 ms** | SAFE | ~6–24 hours (tokenized) | Cache 300s (5 min) |
| **Instagram** | `instagram-post-reels-stories-downloader-api.p.rapidapi.com` | **3,790 ms** | SAFE | ~24 hours (`oe` hex timestamp) | Cache 300s (5 min) |
| **YouTube** | `youtube-video-and-shorts-downloader.p.rapidapi.com` | **5,414 ms** | SAFE | ~6 hours (`expire` timestamp) | Cache 300s (5 min) |
| **X / Twitter** | `twitter-video-downloader2.p.rapidapi.com` | **1,167 ms** | SAFE | ~6–24 hours | Cache 300s (5 min) |
| **Facebook** | `facebook-reels-and-video-downloader.p.rapidapi.com` | **603 ms** | SAFE | ~24–48 hours | Cache 300s (5 min) |
| **Pinterest** | `pinterest-media-download1.p.rapidapi.com` | **3,098 ms** | NEGATIVE ONLY | N/A (Upstream defect) | Short negative cache (60s) |

---

## 4. Proposed Implementation Architecture

### 4.1 ResolveCache & SingleFlight Service
Create `src/lib/cache/resolve-cache.ts`:
- **Cache Key**: `hash(providerId + ":" + canonicalUrl)`.
- **TTL**:
  - Success entries: Configurable `serverConfig.cache.resolveTtlSeconds` (default: 300s / 5 minutes).
  - Negative entries: Configurable `serverConfig.cache.negativeTtlSeconds` (default: 60s for fatal errors; 0s for transient errors).
- **Eviction**: Bounded LRU-style structure (max 1,000 entries) with background/on-access expiration cleanup.
- **Fail-Open Policy**: If cache errors or throws, immediately falls back to direct provider resolution without failing the request.
- **SingleFlight Coalescer**: Map of `inFlight: Map<string, Promise<PublicMediaResponse>>` ensuring that concurrent requests for the identical key await the exact same promise. Automatically deletes in-flight promise upon completion or failure.

### 4.2 Integration into PlatformResolver
Modify `src/lib/platforms/resolver.ts` to wrap provider execution with `resolveCache.getOrResolve(...)`.

### 4.3 Next.js & Header Hardening
- Update `next.config.ts` with `poweredByHeader: false`, compression, and asset cache headers.
- Set explicit `Cache-Control: no-store, must-revalidate` on dynamic routes (`/api/media/resolve`, `/api/batch`).

### 4.4 Telemetry Metrics
Extend telemetry to record `cache_hit`, `cache_miss`, `cache_coalesced`, and resolve durations.
