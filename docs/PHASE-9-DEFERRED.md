# Tempelink — Phase 9 Deferred Items

The following items were audited and deliberately deferred from Phase 9 to Phase 10 or later architectures, ensuring zero scope creep and maintaining focus on production hardening and serverless safety:

## 1. Phase 10: Monetization, Service Tiers & User Accounts
- **User Accounts & Synced History**: Cross-device download history and user profile database integration.
- **Pro Tier Subscriptions**: Paid subscriptions for elevated batch concurrency (e.g. 25+ URLs), priority queue, and ad-free interfaces.
- **Payment Gateway Processing**: Stripe, LemonSqueezy, or Midtrans integration.
- **Developer REST API**: Public API key issuance (`X-API-Key`), programmatic rate quotas, and webhook delivery.

## 2. Advanced Multi-Cloud Edge Infrastructure
- **Media Chunk Edge Storage (Cloudflare R2 / AWS S3)**: Caching raw video chunks at edge CDN to reduce upstream provider bandwidth.
- **Mandatory Turnstile on Single Downloads**: Not implemented globally on `POST /api/media/resolve` to avoid adding friction to legitimate public users; preserved as an optional abuse-triggered challenge.
- **Distributed Worker Cluster (BullMQ/Redis standalone daemons)**: Deferred in favor of PostgreSQL-backed queue and serverless polling execution pattern, avoiding dedicated VM overhead.
