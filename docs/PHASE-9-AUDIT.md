# Tempelink — Phase 9 Production Hardening & Distributed Infrastructure Audit

**Document Status**: COMPLETED  
**Target Environment**: Vercel Serverless / AWS Lambda (Node.js 20+ Runtime)  
**Current Baseline**: Phase 1–8 Complete (Next.js 16.3.5, React 19.2.8, Tailwind 4, TypeScript 5, Vitest 5)  
**Date**: September 21, 2026  

---

## 1. Executive Summary

Tempelink is an open-access, anonymous universal media downloader supporting TikTok, Instagram, YouTube, X/Twitter, Facebook, and Pinterest. Through Phases 1–8, Tempelink achieved high single-instance stability, robust SSRF protection, HMAC download tokens, batch resolution, in-memory resolve caching, and full technical SEO discoverability.

Phase 9 focuses on **production hardening, multi-instance safety, serverless compatibility, and abuse defense** to ensure the application operates reliably and securely when deployed on Vercel or multi-container serverless infrastructure.

---

## 2. Comprehensive Risk Assessment

### A. Critical Production Risks

#### 1. Serverless Filesystem Non-Durability (`FileBatchStore`)
- **Location**: `src/lib/queue/store.ts` (`FileBatchStore`)
- **Mechanism**: Writes batch JSON files to disk at `path.join(process.cwd(), '.data', 'batches', `${id}.json`)`.
- **Vercel / Serverless Vulnerability**:
  - The root filesystem on Vercel is strictly read-only at runtime. Attempting to create `.data/batches/` will trigger an immediate `EROFS: read-only file system` runtime crash in production.
  - Even if directed to `/tmp`, each serverless invocation runs in an isolated, ephemeral container. Container A (handling `POST /api/batch`) does not share `/tmp` with Container B (handling `GET /api/batch/[id]`). Batches will randomly disappear (`BATCH_NOT_FOUND`).
  - Background asynchronous tasks (`this.runner.scheduleNext().catch(...)`) are abruptly frozen or killed by the serverless runtime once the HTTP response stream closes.
- **Severity**: **CRITICAL** (Breaks batch functionality on Vercel).

#### 2. Per-Process In-Memory Rate Limiter Bypass
- **Location**: `src/lib/rate-limit/rate-limiter.ts` (`MemoryRateLimiterStore`)
- **Mechanism**: Maintains an in-memory `Map` with an active `setInterval` background cleanup timer.
- **Vercel / Serverless Vulnerability**:
  - In a distributed or auto-scaling serverless environment, incoming requests are routed across many independent containers. Each container initializes with a counter of zero.
  - An attacker issuing 1,000 rapid requests will distribute traffic across containers, easily evading the 20 req/min resolve limit and 5 batches/min limit.
  - `setInterval` timers can cause unhandled execution state or fail to run in paused serverless instances.
- **Severity**: **CRITICAL** (Renders rate limits ineffective under distributed load).

#### 3. Client IP Header Spoofing Vulnerability
- **Location**: `src/lib/rate-limit/rate-limiter.ts` (`getClientIp`)
- **Mechanism**: Reads `req.headers.get('x-forwarded-for')?.split(',')[0].trim()`.
- **Vercel / Serverless Vulnerability**:
  - The leftmost IP in `x-forwarded-for` is completely client-controlled and easily forged (`curl -H "X-Forwarded-For: 8.8.8.8"`).
  - An attacker can cycle random IPs on every request, completely bypassing rate limits, active batch limits, and IP-based abuse tracking.
  - On Vercel, the trusted incoming client IP header provided by edge proxies is `x-vercel-forwarded-for` or `x-real-ip`.
- **Severity**: **CRITICAL** (Allows trivial rate limit bypass).

#### 4. Provider Cascading Failures & Quota Drain (Missing Circuit Breaker)
- **Location**: `src/lib/platforms/providers/*`
- **Mechanism**: Each provider retries up to 2 times with exponential backoff and timeouts up to 10 seconds.
- **Vercel / Serverless Vulnerability**:
  - When an upstream RapidAPI provider is down, experiencing 5xx errors, or rate-limiting Tempelink, every single incoming user request will wait for 2 retries (up to 20 seconds total) before failing.
  - This causes extreme latency amplification, serverless function timeout exhaustion, and RapidAPI quota exhaustion within minutes.
  - Lack of a fast-failing circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) harms overall platform availability.
- **Severity**: **CRITICAL** (Causes latency spikes and rapid API budget exhaustion).

---

### B. High-Priority Risks

#### 1. Unbounded Request Body Size
- **Location**: `src/app/api/media/resolve`, `src/app/api/media/download`, `src/app/api/batch`
- **Vulnerability**: Calls `await req.json()` without checking `Content-Length`. An attacker could send a 50MB payload to exhaust memory on serverless workers.
- **Remediation**: Enforce strict request body size limit (e.g. max 64 KB for JSON bodies) and return HTTP 413 `PAYLOAD_TOO_LARGE`.

#### 2. Missing URL Length & URI Limits
- **Location**: `src/lib/security/sanitizer.ts`, `src/lib/platforms/resolver.ts`
- **Vulnerability**: URLs of arbitrary length (e.g., 100 KB query strings) can be submitted, creating ReDoS risks in regex detectors and cache bloat.
- **Remediation**: Enforce max URL length of 2,048 characters; reject longer URLs with HTTP 414 `URI_TOO_LONG`.

#### 3. Strict Content-Type Validation
- **Location**: API routes handling POST requests
- **Vulnerability**: Sending multipart or raw octet streams could trigger parsing anomalies or misleading error logs.
- **Remediation**: Require `content-type: application/json` on all POST endpoints.

#### 4. Distributed Resolve Cache Inconsistency
- **Location**: `src/lib/cache/resolve-cache.ts`
- **Vulnerability**: `ResolveCache` is in-memory only. Cache hit rate across Vercel lambdas is low without a centralized or shared KV/database layer.
- **Remediation**: Provide a `ResolveCacheStore` abstraction supporting `MemoryResolveCacheStore` with seamless upgrade path to persistent KV/database storage while preserving single-flight request coalescing locally.

---

### C. Medium-Priority Risks

#### 1. Batch Job Execution in Serverless Lifecycle
- **Location**: `src/lib/queue/runner.ts`
- **Vulnerability**: Because long-running background workers cannot exist indefinitely in serverless functions, batch progress must be driven incrementally.
- **Remediation**: In addition to asynchronous scheduling, allow `GET /api/batch/[id]` polling requests to trigger next pending jobs (serverless tick pattern), ensuring batches always complete even across cold/recycled containers.

#### 2. Bot & Automated Flooding Defense
- **Vulnerability**: Automated bots scraping or probing resolve endpoints can degrade service for human users.
- **Remediation**: Implement a modular Bot Challenge / Cloudflare Turnstile verification module that can be selectively enabled for high-risk operations without adding friction to legitimate users.

---

### D. Existing Controls That Are Already Sufficient

1. **SSRF Guard (`src/lib/security/ssrf.ts`)**:
   - Loopback (`127.0.0.1`, `localhost`, `::1`), private IPv4 (`10/8`, `172.16/12`, `192.168/16`), link-local/cloud metadata (`169.254.169.254`), carrier-grade NAT, private IPv6, IPv4-mapped IPv6, and non-standard ports are blocked unconditionally.
2. **HMAC Download Token Security (`src/lib/security/token.ts`)**:
   - Timing-safe HMAC-SHA256 signature verification.
   - Enforces 32-character minimum secret in production.
   - Automatic 15-minute token expiration.
   - Download endpoint binds strictly to verified provider streams; prevents open proxy abuse.
3. **MIME Allowlist & Header Security (`src/app/api/media/download/route.ts`)**:
   - Restricts downloads to safe video/audio/image MIME types.
   - Sanitizes filenames against path traversal.
   - Employs `no-store, no-cache`, `X-Content-Type-Options: nosniff`, and RFC 6266 headers.
4. **Static SEO & Discoverability (`src/app/[slug]/page.tsx`)**:
   - All 6 platform landing pages are pre-rendered at build time with 0 upstream API calls.

---

### E. Items That Should NOT Be Changed

1. **Provider Contracts**: Keep TikTok, Instagram, YouTube, X, Facebook, and Pinterest logic intact.
2. **Honest Capability Model**: Never claim fabricated 4K resolutions or bypass platform restrictions.
3. **Stateless HMAC Download Tokens**: Do not replace HMAC tokens with stateful session IDs that require DB lookups for every byte stream download.
4. **Phase 7 Caching Discipline**: Maintain URL canonicalization, TTL negative caching for fatal semantic errors, and single-flight coalescing.
5. **Phase 8 SEO Architecture**: Preserve all canonical URLs, sitemap, robots, and JSON-LD schemas.

---

### F. Items to Defer (Phase 10)

- User accounts, authentication, and cross-device synced download history.
- Subscription billing, Stripe/payment gateways, and monetization tiers.
- Public developer API keys with custom rate quotas.
- Edge blob storage / dedicated media caching CDN (Cloudflare R2).

---

## 3. Recommended Phase 9 Architecture

### 1. Storage Abstraction Layer (`BatchStore`)
- Maintain `BatchStore` interface.
- Keep `FileBatchStore` for local development, unit tests, and single-instance environments.
- Provide `PostgresBatchStore` implementing `BatchStore` using standard relational schema when `DATABASE_URL` is configured.
- Provide automatic store selection via `getBatchStore()`.

### 2. Provider Circuit Breaker Engine
- Create `src/lib/platforms/core/circuit-breaker.ts`.
- States: `CLOSED` (normal operation), `OPEN` (fast-fail for cooldown duration), `HALF_OPEN` (single probe request).
- Protects each provider independently with bounded memory, failure count thresholds, and auto-reset cooldown.

### 3. Distributed Rate Limiter & Trusted IP Resolver
- Harden `getClientIp` to prioritize Vercel edge headers (`x-vercel-forwarded-for`, `x-real-ip`) over arbitrary client `x-forwarded-for`.
- Standardize HTTP 429 response with `Retry-After` header.
- Provide `RateLimiterStore` interface supporting memory and database-backed distributed sliding windows.

### 4. API Request Guard & Middleware
- Create `src/lib/security/api-guard.ts` for uniform payload inspection:
  - Max body size enforcement (64 KB).
  - Max URL length enforcement (2,048 chars).
  - Content-Type enforcement (`application/json` for POST).
  - Return standardized error responses (`PAYLOAD_TOO_LARGE`, `URI_TOO_LONG`).

### 5. Bot Challenge & Turnstile Integration
- Create `src/lib/security/bot-challenge.ts`.
- Supports optional Cloudflare Turnstile token validation via `TURNSTILE_SECRET_KEY`.
- Bypasses cleanly when unconfigured to prevent local dev blockers.
