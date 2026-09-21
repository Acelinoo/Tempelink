# Tempelink — Phase 7 Deferred Items

The following items were identified during the Phase 7 Performance, Cache & CDN audit as outside the scope of Phase 7 and are deferred to subsequent phases as planned:

## 1. Phase 8: SEO & Platform Landing Pages
- Dedicated platform downloader landing pages (e.g. `/tiktok-downloader`, `/instagram-downloader`, `/youtube-downloader`).
- Dynamic sitemap generation (`/sitemap.xml`) and `robots.txt`.
- OpenGraph image generation and metadata tags for social sharing.
- JSON-LD Structured Data schema for software applications.

## 2. Phase 9: Production Hardening & Distributed Infrastructure
- **Distributed Redis Caching**: Replacing in-memory `ResolveCache` with Upstash Redis or AWS ElastiCache for multi-region or multi-instance serverless deployments.
- **Distributed BullMQ / PostgreSQL Queue**: Migrating `FileBatchStore` to a multi-instance queue broker to support horizontal scaling across stateless container clusters or serverless functions without shared local disks.
- **Advanced Abuse & Bot Protection**: IP reputation scoring, Cloudflare Turnstile / reCAPTCHA v3 challenge for abusive user-agents, and adaptive per-subnet rate limits.
- **Edge Media Stream Caching**: Deploying a dedicated edge storage cache (e.g., Cloudflare R2 / AWS S3) with presigned streaming URLs for frequently downloaded video/audio assets to reduce upstream provider egress.

## 3. Phase 10: Monetization & Service Tiers
- User account authentication and database synchronization.
- Pro subscription plans (higher batch limits, 4K video resolution options, priority queue).
- Developer REST API subscriptions and API key billing gateways.
- Stripe / LemonSqueezy payment webhook integrations.
