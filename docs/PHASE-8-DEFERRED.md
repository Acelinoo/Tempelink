# Tempelink — Phase 8 Deferred Items

The following architectural and product enhancements were reviewed during the Phase 8 SEO and Discoverability audit and are formally deferred to subsequent phases:

## 1. Phase 9: Production Hardening, Distributed Infrastructure & Advanced Abuse Defense
- **Distributed Queue Broker**: Migration of `FileBatchStore` to Redis/BullMQ or PostgreSQL for stateless multi-instance container orchestration.
- **Distributed Cache Store**: Migration of in-memory `ResolveCache` to Redis / Upstash for multi-region serverless caching.
- **Bot Challenge & Rate Protection**: Integration of Cloudflare Turnstile or CAPTCHA defense against aggressive automated scraping of download endpoints.
- **WAF & Subnet Security**: Web Application Firewall rules, IP reputation scoring, and dynamic abuse throttling.
- **Media CDN Edge Caching**: Deploying dedicated edge storage (Cloudflare R2 / AWS S3) for caching downloaded video chunks to reduce third-party provider egress.

## 2. Phase 10: Monetization, Service Tiers & Developer API
- **User Accounts & Synced History**: Cross-device history synchronization via database authentication.
- **Pro Tier Subscriptions**: Higher batch processing limits (e.g. 25+ URLs), priority bandwidth queue, and ad-free dedicated links.
- **Developer REST API**: Programmatic API key access, usage-based metering, and webhook notifications.
- **Payment Gateway Integration**: Stripe, LemonSqueezy, or Midtrans integration for subscription management.
