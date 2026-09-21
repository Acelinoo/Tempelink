# Tempelink — Feature Roadmap & Tiers

## 1. Feature Classification Matrix

| Feature | Classification | Rationale | Phase |
| :--- | :--- | :--- | :--- |
| **Centralized URL Detector** | **MUST HAVE** | Core foundation; prevents scattered, fragile regex logic. | Phase 1 |
| **Dynamic Capability System** | **MUST HAVE** | Essential to prevent hardcoded platform assumptions & false HD promises. | Phase 1 |
| **Provider Abstraction** | **MUST HAVE** | Enables independent platform plugins without breaking other providers. | Phase 1 |
| **SSRF & Rate Limiting Defense** | **MUST HAVE** | Critical security boundary against infrastructure compromise and DoS. | Phase 1 |
| **Standard vs HD Categorization** | **MUST HAVE** | Clean, honest presentation of 720p vs 1080p+ without upscaling. | Phase 1 |
| **Indonesian User Error Messages** | **MUST HAVE** | Friendly, localized UX for target audience while maintaining tech codes. | Phase 1 |
| **Anonymous Browser History** | **MUST HAVE** | Instant utility value via localStorage without requiring user accounts. | Phase 1 |
| **Clipboard Auto-Paste Button** | **SHOULD HAVE** | High-utility friction reduction on mobile and desktop. | Phase 1 |
| **Audio-Only Stream Extraction** | **SHOULD HAVE** | Popular user request for music, podcasts, and sound clips. | Phase 2 |
| **Carousel / Multi-Image Downloader**| **SHOULD HAVE** | Supported by Instagram & TikTok photo modes. | Phase 2 |
| **Asynchronous Job Worker (BullMQ)** | **SHOULD HAVE** | Required when dealing with heavy video muxing or >30s downloads. | Phase 2 |
| **Temporary Signed Download URLs** | **SHOULD HAVE** | Prevents direct file hotlinking and protects server egress. | Phase 2 |
| **Mobile PWA (Installable App)** | **SHOULD HAVE** | Frictionless access on iOS/Android home screens without app store hurdles. | Phase 3 |
| **Batch URL Resolution** | **COMPLETED** | Controlled concurrency queue, deduplication, retry policy, and file persistence. | Phase 6 |
| **Performance, Cache & CDN** | **COMPLETED** | In-memory resolve caching, single-flight coalescing, HTTP cache headers, and asset compression. | Phase 7 |
| **SEO & Platform Landing Pages** | **COMPLETED** | Dedicated SSG landing pages, canonical URLs, sitemap, robots, Schema.org JSON-LD, internal links. | Phase 8 |
| **Production Hardening & Abuse Defense** | **COMPLETED** | Postgres/file batch store abstraction, atomic serverless queue stepping, provider circuit breaker, IP spoofing guard, and Turnstile challenge. | Phase 9 |
| **User Accounts & Synced History** | **PLANNED** | Added value only once cloud storage and cross-device sync are needed. | Phase 10 |
| **Browser Extension / Bookmarklet** | **LATER** | Convenient one-click download while browsing social platforms. | Phase 4 |
| **Public Developer API** | **LATER** | Monetization path for third-party platforms via API keys. | Phase 4 |
| **Arbitrary Watermark Stripping** | **NOT RECOMMENDED** | High legal/TOS risk, brittle visual blur hacks, degrades quality. | Excluded |
| **DRM / Paywall Circumvention** | **NOT RECOMMENDED** | Violates anti-circumvention laws and platform security. | Excluded |
| **Permanent Copyrighted File Storage**| **NOT RECOMMENDED** | Severe copyright liability and astronomical storage costs. | Excluded |
| **Mandatory User Login for Basic Use**| **NOT RECOMMENDED** | Destroys conversion rate; utility downloaders must remain instant. | Excluded |

---

## 2. Conceptual Monetization & Service Tiers

*Note: Pricing figures are intentionally omitted at Phase 1 until operational egress costs and provider infrastructure are measured.*

### Tier 1: Free (Anonymous & Registered)
- Full access to supported platforms (TikTok, IG, YouTube, X, FB, Pinterest).
- Standard quality resolutions (360p, 480p, 720p).
- HD resolutions where available natively without server-side transcoding.
- Standard sliding-window rate limits (20 resolves/min).
- Anonymous client-side history stored locally in browser.

### Tier 2: Pro (Subscription)
- Priority processing queue for high-bitrate video/audio remuxing.
- Ultra-HD (1440p, 4K/2160p) stream aggregation.
- Batch URL processing (e.g. up to 10 URLs simultaneously).
- Cloud-synced download history across devices.
- Ad-free, dedicated high-speed CDN delivery links.

### Tier 3: Developer API (Usage-Based)
- Programmatic JSON API access via `X-API-Key`.
- High concurrency quotas and SLA uptime.
- Webhook callbacks upon completed download jobs.
- Structured usage telemetry dashboard.
