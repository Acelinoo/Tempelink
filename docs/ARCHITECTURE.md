# Tempelink — System Architecture

## 1. High-Level Architecture

Tempelink is organized into decoupled layers, separating presentation, boundary security, domain orchestration, and external platform integration.

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                          │
│   Next.js 15 App Router (React Server & Client Components) │
│   - URL Input & Clipboard Paste Auto-Detection              │
│   - Dynamic Capabilities Grid (Standard / HD / Audio)       │
│   - Media Metadata Preview Card                             │
│   - Local History Drawer (Client Storage / Privacy-First)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                       │
│   Next.js Route Handlers (/api/media/resolve, download)     │
│   - Request Correlation ID Injection                        │
│   - Structured Error Mapping (Indonesian User Messages)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 SECURITY & PERIMETER LAYER                  │
│   - SSRF Guard (Private IPs, Cloud Metadata 169.254.169.254)│
│   - URL Sanitizer (Protocol Allowlist: https/http)          │
│   - Sliding Window Rate Limiter (IP-based Bucketing)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN ENGINE LAYER                     │
│   - Centralized URL & Hostname Detector                     │
│   - Standard vs HD Capability Normalizer                    │
│   - Provider Registry & Execution Dispatcher                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   PLATFORM PROVIDER LAYER                   │
│   Independent Providers (PlatformProvider Contract)         │
│   - TikTok Provider                                         │
│   - Instagram Provider                                      │
│   - YouTube Provider                                        │
│   - X (Twitter) Provider                                    │
│   - Facebook Provider                                       │
│   - Pinterest Provider                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Media Lifecycle & Resolution Pipeline

1. **Client Submission**: User submits URL through the UI or API (`POST /api/media/resolve`).
2. **Security Gate**:
   - `UrlSanitizer` verifies scheme (`http`/`https`), normalizes domain casing, and parses URL.
   - `SSRFProtector` resolves host and halts on private addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `::1`, `169.254.169.254`).
   - `RateLimiter` ensures client IP has not exceeded sliding threshold (default: 20 resolves/min).
3. **Detection**: `PlatformDetector` matches hostname and URL pattern against registered platform signatures.
4. **Resolution**: `PlatformResolver` invokes the corresponding provider's `resolve(url)` method.
5. **Capability Extraction & Normalization**:
   - Provider streams/resources are mapped to generic `Capability` objects.
   - Video streams are categorized into `standard` (<1080p) or `hd` (≥1080p).
   - Sensitive internal provider tokens, cookies, or upstream endpoints are stripped.
6. **Delivery**: The normalized `PublicMediaResponse` is sent to the client.

---

## 3. Asynchronous Download Job Architecture (Future Scale Design)

In Phase 1, media files that have direct valid download endpoints are dispatched directly or through secure stream proxies. For high-volume multi-gigabyte files or video/audio muxing, Tempelink is architected to transition into an asynchronous job worker pattern:

```
[ POST /api/media/download ]
              │
              ▼
    [ Create Job ID ] ──> [ BullMQ / Redis Queue ]
              │                         │
              ▼                         ▼
   [ Return 202 Accepted ]      [ Background Worker Node ]
   { jobId, status: "queued" }         │
                                        ├─ Stream/Fetch Media
                                        ├─ Process/Mux (FFmpeg)
                                        └─ Upload to Object Storage (S3/R2)
                                                │
                                                ▼
                                    [ Generate Signed URL ]
                                    (15-Minute Expiry)
                                                │
                                                ▼
                                    [ Status Polling / SSE ]
                                    { status: "ready", downloadUrl: "..." }
```

### When Each Component Becomes Necessary:
- **Redis Queue**: When concurrent downloads exceed serverless connection pools or require background processing (>30 seconds).
- **Worker Nodes**: When video and audio streams must be remuxed (e.g., separate 1080p video stream + audio track).
- **Object Storage (Cloudflare R2 / AWS S3)**: When temporary file hosting is needed to offload egress bandwidth and enable resumeable downloads.
- **Signed URLs**: Prevents hotlinking and ensures files expire within 10–15 minutes of generation.
