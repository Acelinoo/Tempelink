# Tempelink — Architecture Decision Records (ADR)

## ADR-001: Use PlatformProvider Abstraction

- **Status**: Accepted
- **Context**: Tempelink must support multiple distinct media platforms (TikTok, Instagram, YouTube, X, Facebook, Pinterest, etc.), each possessing unique URL patterns, authorization parameters, and response structures.
- **Decision**: Implement a unified `PlatformProvider` interface. All platforms implement `canHandle()`, `detect()`, and `resolve()`, and register in a centralized `ProviderRegistry`.
- **Alternatives Considered**:
  - Direct if-else checks in API route handlers.
  - Separate API endpoints per platform (`/api/tiktok`, `/api/youtube`).
- **Consequences**: Adds a small initial abstraction layer, but isolates failures completely—one broken platform will never disrupt other platforms, and adding new platforms requires zero changes to core routing.

---

## ADR-002: Dynamic Capability Model vs Platform-Specific UI

- **Status**: Accepted
- **Context**: Different platforms support wildly different capabilities (e.g. YouTube has 360p through 4K plus separate audio; Instagram has photo carousels and Reels; TikTok has watermark-free video and original sound).
- **Decision**: The backend returns an array of generic `Capability` objects (`type`, `qualityCategory`, `resolution`, `format`, `hasAudio`, etc.). The frontend dynamically renders capability pills/buttons purely from this array.
- **Alternatives Considered**:
  - Hardcoded frontend switch statements (`if (platform === 'tiktok') renderTikTokButtons()`).
- **Consequences**: Completely eliminates UI code bloat and drift between backend capabilities and frontend presentation. The UI automatically supports new media formats without frontend redeployment.

---

## ADR-003: Strict Server-Side SSRF Protection & URL Validation

- **Status**: Accepted
- **Context**: Allowing arbitrary user-submitted URLs into server-side resolution engines creates severe Server-Side Request Forgery (SSRF) vulnerabilities (e.g. AWS/GCP metadata theft, scanning private internal networks).
- **Decision**: All URLs must pass through `SSRFProtector` which parses the host, enforces `http`/`https`, and strictly bans private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`, `::1`), and cloud metadata (`169.254.169.254`). Generic `fetch(userUrl)` is prohibited.
- **Consequences**: Bulletproof boundary security. Malicious inputs are blocked immediately with `SSRF_BLOCKED` before network sockets open.

---

## ADR-004: In-Memory Sliding-Window Rate Limiting with Redis Pluggability

- **Status**: Accepted
- **Context**: A media utility is vulnerable to automated bot scraping and DoS attacks. Phase 1 runs in a single runtime environment without immediate Redis infrastructure.
- **Decision**: Implement an in-memory sliding window rate limiter behind a generic `RateLimiterStore` interface.
- **Consequences**: Zero external dependencies for Phase 1. When multi-instance serverless deployments are rolled out in Phase 2, the memory store is swapped for Redis/Upstash without changing route logic.

---

## ADR-005: Deferred Database Persistence for Phase 1 (Anonymous Local History)

- **Status**: Accepted
- **Context**: Media downloaders are primary utility tools used anonymously. Introducing PostgreSQL/Prisma in Phase 1 adds operational overhead, migrations, and GDPR/privacy liabilities before core product-market fit.
- **Decision**: Anonymous download history will be stored client-side via `localStorage`. Database persistence is deferred until user accounts, cross-device sync, and paid API tiers are built.
- **Consequences**: Zero database setup friction for developers, zero hosting costs for user records, maximum user privacy.

---

## ADR-006: Asynchronous Download Job Abstraction for Media Processing

- **Status**: Accepted
- **Context**: Serverless HTTP functions have short timeout windows (10–15 seconds), while streaming or muxing high-resolution 1080p/4K media can take 30–60 seconds.
- **Decision**: Architect `/api/media/download` to support both immediate URL redirection (for direct streams) and an asynchronous job pattern returning job IDs for future worker-based processing.
- **Consequences**: Prevents serverless timeout bottlenecks and establishes the foundation for background workers (BullMQ + FFmpeg) in Phase 2.

---

## ADR-007: Visual Design Identity (Utility-Focused, Anti-AI-Slop)

- **Status**: Accepted
- **Context**: Many contemporary AI SaaS templates feature gratuitous purple neon gradients, excessive glassmorphism, and low-contrast typography that distract from utility.
- **Decision**: Adopt a focused, high-contrast dark utility aesthetic. Deep neutral slate surfaces (`#090d16`, `#111827`), high-contrast text (`#f9fafb`), purposeful functional accents (Emerald for success, Indigo/Cyan for download actions, Rose for errors), and prominent URL focus.
- **Consequences**: Tempelink feels like an elite developer/media utility rather than a generic gimmick or scammy ad farm.

---

## ADR-008: Honest Resolution Mapping (No Upscaling, Strict Standard vs HD)

- **Status**: Accepted
- **Context**: Untrustworthy downloaders often label 720p or 480p videos as "HD" or "Full HD" to mislead users.
- **Decision**: Video streams `< 1080p` are strictly categorized as `standard`. Only resolutions `≥ 1080p` are categorized as `hd`. If an HD stream does not legitimately exist in the provider response, the HD option is not rendered.
- **Consequences**: Absolute technical honesty and user trust.

---

## ADR-009: Cryptographically Signed Stateless Download Delivery Tokens

- **Status**: Accepted
- **Context**: Allowing clients to pass raw URLs to download endpoints enables SSRF, open proxying, and malicious stream ingestion. Conversely, storing download sessions in a database adds unwarranted latency and storage overhead.
- **Decision**: Sign each resolved media capability with an HMAC-SHA256 token containing `{ mediaId, capabilityId, targetUrl, expiresAt }`. The `/api/media/download` endpoint verifies the signature, enforces expiration (`MEDIA_URL_EXPIRED`), and re-checks the target against SSRF boundaries before delivery.
- **Consequences**: Complete stateless security. Clients cannot forge or tamper with target download URLs, and expired streams are rejected without requiring a database lookup.

---

## ADR-010: Strict Provider Timeouts and Bounded Exponential Backoff Retries

- **Status**: Accepted
- **Context**: Social media provider APIs can experience transient connection drops or hanging sockets, risking exhaustion of serverless execution limits.
- **Decision**: Enforce strict timeouts via `AbortSignal.timeout(TIKTOK_RESOLVE_TIMEOUT_MS)` (8000ms default) and bounded exponential backoff retries (maximum 2 retries) only for transient network drops and upstream 5xx errors. 4xx client errors are never retried.
- **Consequences**: Guarantees bounded request lifecycles, prevents serverless function timeouts, and gracefully handles temporary platform blips without infinite loops.

---

## ADR-011: Production Secret Fail-Closed Hardening

- **Status**: Accepted
- **Context**: Relying on development fallback keys (such as `tempelink_dev_secret_signing_key_32_chars`) in production creates an exploitable attack vector if an operator deploys without setting `DOWNLOAD_SIGNING_SECRET`.
- **Decision**: The server configuration layer (`src/lib/config.ts`) explicitly evaluates whether `NODE_ENV === 'production'`. If in production, accessing `serverConfig.download.signingSecret` without an explicitly set 32+ character key immediately throws a fatal `INTERNAL_ERROR`.
- **Consequences**: The system fails safely and closed in production. Compromised development secrets can never be utilized in production environments.

---

## ADR-012: Separation of Offline CI Testing and Developer Provider Verification

- **Status**: Accepted
- **Context**: Calling live third-party APIs during standard automated testing causes flakiness, rate limit depletion, credential leakage risks in CI, and test failures when credentials are absent.
- **Decision**: Standard test suites (`npm run test`) test 100% of detection, parsing, security boundaries, rate limiting, and capability mapping using deterministic mocks. Real upstream verification is sequestered into a dedicated developer-only script (`scripts/verify-tiktok-provider.ts`) that sanitizes outputs, executes lightweight range requests without storing full media, and fails closed when credentials are unconfigured.
- **Consequences**: CI remains deterministic and fast, while real-world integration can be verified on-demand when credentials are provided.

---

## ADR-013: Live RapidAPI Contract Alignment & Dual Schema Tolerance

- **Status**: Accepted
- **Context**: During live verification against the active RapidAPI TikTok gateway, the actual endpoint path was discovered to be `/index?url=...` (rather than root `/`) and the payload format returns direct top-level arrays (`video: [url]`, `OriginalWatermarkedVideo: [url]`, `music: [url]`, `author: [handle]`) rather than wrapped objects (`data: { play }`).
- **Decision**: Update `TikTokProvider` adapter to resolve against `/index` and seamlessly tolerate both direct array payloads and wrapped object schemas. If no explicit 1080p stream is returned, the adapter strictly classifies the video as `Standard` without fabricating false HD badges.
- **Consequences**: Ensures 100% compatibility with real production RapidAPI responses without breaking existing mocked unit tests or altering provider abstractions.

---

## ADR-014: Download Delivery Hardening, Filename Sanitization & RFC 6266 Compliance

- **Status**: Accepted
- **Context**: Delivering direct downloads or redirecting to media CDNs risks CRLF header injection, directory traversal attacks in client save dialogs, proxy caching of ephemeral signed URLs, and open-proxy abuse with unauthorized file types.
- **Decision**:
  1. Implement deterministic `sanitizeDownloadFilename` removing null bytes, CRLF characters, path traversal sequences (`../`, `..\`), illegal filesystem/shell characters, and Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`), truncating base names to 80 characters.
  2. Format RFC 6266 and RFC 5987 compliant `Content-Disposition` headers with ASCII-safe fallbacks and explicit `filename*=UTF-8''` parameters.
  3. Mandate anti-caching headers (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`) and `X-Content-Type-Options: nosniff` on all `/api/media/download` responses.
  4. Enforce strict token payload schema validation and an authorized media MIME whitelist (`video/mp4`, `video/webm`, `audio/mpeg`, etc.), rejecting executable, script, or HTML payloads.
  5. Provide client-side duplicate click guards and distinct retry states without fabricated progress indicators.
- **Consequences**: Fully hardened download delivery. Eliminates CRLF injection, prevents directory traversal in save prompts, guarantees ephemeral tokens are never cached by intermediaries, and locks down the download pipeline against arbitrary file proxying.

---

## ADR-015: Multi-Provider Ecosystem & Independent Provider Isolation (Phase 4)

- **Status**: Accepted
- **Context**: Moving beyond TikTok to integrate Instagram and YouTube requires multi-provider routing without introducing fragile dependencies or cross-platform cascade failures.
- **Decision**:
  1. Leverage the Phase 1 `BasePlatformProvider` and `ProviderRegistry` without modifying their core contracts.
  2. Implement `InstagramProvider` and `YouTubeProvider` with independent environment configuration (`INSTAGRAM_PROVIDER_*`, `YOUTUBE_PROVIDER_*`).
  3. Enforce strict isolation: missing API keys throw `PROVIDER_NOT_CONFIGURED` (HTTP 503) for that specific platform only, leaving all other configured providers fully functional.
  4. Enforce capability honesty: resolutions are categorized strictly into `standard` vs `hd` using `categorizeVideoQuality()`, rejecting fabricated 1080p, 4K, or fake audio labels.
- **Consequences**: Pure modularity. Any platform can be configured, degraded, or updated independently without affecting the availability of other ecosystem platforms.

---

## ADR-016: Rejection of Official YouTube Data API v3 for Download Delivery

- **Status**: Accepted
- **Context**: The official YouTube Data API v3 was considered for the YouTube integration.
- **Decision**: The official YouTube Data API v3 is rejected for media download functionality. Google Cloud Terms of Service and API design explicitly restrict Data API v3 to metadata management and prohibit streaming or downloading video binaries. Using third-party gateway providers (`youtube-video-and-shorts-downloader`) that return direct GoogleVideo CDN streams is the only compliant mechanism that does not require reverse-engineering or scraping hacks.
- **Consequences**: Clear legal and technical boundary. Tempelink does not implement fake download promises on top of metadata-only APIs.




