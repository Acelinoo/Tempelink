# Tempelink — Provider Integration & Testing Guide (TikTok)

## 1. Overview

Phase 2 establishes the first real external media provider: **TikTok**. This document outlines how the provider operates, the required environment configuration, response schemas, error models, and testing strategies.

---

## 2. TikTok Provider Lifecycle

```
[ Inbound Request: TikTok URL ]
              │
              ▼
[ PlatformDetector.detect() ]
  ├─ Strips query tracking parameters (is_from_webapp, sender_device, _r, UTMs)
  ├─ Distinguishes: Web video, photo mode/carousel, shortlinks (vm.tiktok.com)
  └─ Rejects non-media pages (e.g. user profile / feed) as UNSUPPORTED_MEDIA
              │
              ▼
[ TikTokProvider.resolve() ]
  ├─ Config Guard: Checks TIKTOK_PROVIDER_API_KEY
  │    └─ If missing: Throws PROVIDER_NOT_CONFIGURED (HTTP 503)
  │
  ├─ Upstream API Fetch:
  │    ├─ Target: serverConfig.tiktok.baseUrl
  │    ├─ Timeout: AbortSignal.timeout(serverConfig.tiktok.resolveTimeoutMs) [8000ms default]
  │    └─ Bounded Retry: Retries transient network/5xx errors (up to 2 attempts)
  │
  ├─ Extraction & Honest Normalization:
  │    ├─ Standard 720p: play stream (watermark-free) -> category: 'standard'
  │    ├─ HD 1080p: hdplay stream (ONLY if distinct from standard) -> category: 'hd'
  │    ├─ Audio: music stream -> category: 'audio_only'
  │    └─ Photos: images array (photo mode) -> category: 'image'
  │
  ├─ Security Signing:
  │    └─ Generates HMAC-SHA256 downloadToken for each legitimate capability
  │
  └─ Output: Returns PublicMediaResponse with signed download tokens
```

---

## 3. Required Environment Variables

To activate live upstream TikTok resolution in your local `.env.local` or production deployment:

```bash
# Server-Side Upstream API Configuration (NEVER expose to client)
# TikTok Provider
TIKTOK_PROVIDER_API_KEY=your_authorized_rapidapi_or_gateway_key
TIKTOK_PROVIDER_API_HOST=tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com
TIKTOK_PROVIDER_BASE_URL=https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com
TIKTOK_RESOLVE_TIMEOUT_MS=8000
TIKTOK_MAX_RETRIES=2

# Instagram Provider
INSTAGRAM_PROVIDER_API_KEY=your_instagram_gateway_key
INSTAGRAM_PROVIDER_API_HOST=instagram-post-reels-stories-downloader-api.p.rapidapi.com
INSTAGRAM_PROVIDER_BASE_URL=https://instagram-post-reels-stories-downloader-api.p.rapidapi.com
INSTAGRAM_RESOLVE_TIMEOUT_MS=10000
INSTAGRAM_MAX_RETRIES=2

# YouTube Provider
YOUTUBE_PROVIDER_API_KEY=your_youtube_gateway_key
YOUTUBE_PROVIDER_API_HOST=youtube-video-and-shorts-downloader.p.rapidapi.com
YOUTUBE_PROVIDER_BASE_URL=https://youtube-video-and-shorts-downloader.p.rapidapi.com
YOUTUBE_RESOLVE_TIMEOUT_MS=10000
YOUTUBE_MAX_RETRIES=2

# Download Delivery Signing Key (Minimum 32 random characters)
DOWNLOAD_SIGNING_SECRET=your_32_character_hmac_signing_secret
DOWNLOAD_TOKEN_EXPIRY_SECONDS=900
```

---

## 4. Testing Strategies

We maintain a strict separation between **Unit Tests**, **Integration Tests**, and **Manual Tests**:

### 4.1. Unit Tests (Mocked Upstream — Run on every commit/CI)
- Uses Vitest to test detection, query stripping, error throwing when unconfigured, honest capability mapping (Standard 720p vs HD 1080p), and token generation/verification without making real external network calls.
- Run via:
  ```bash
  npm run test
  ```

### 4.2. Local Manual Testing Steps

#### Test Case A: Provider Unconfigured State (Default)
1. Ensure `TIKTOK_PROVIDER_API_KEY` is empty in `.env.local`.
2. Start the dev server: `npm run dev`.
3. Paste any valid TikTok video link: `https://www.tiktok.com/@creator/video/7123456789012345678`.
4. Click **Unduh**.
5. **Expected Outcome**:
   - HTTP 503 response.
   - User-friendly message displayed: *"Layanan TikTok belum dikonfigurasi dengan API token yang valid. Hubungi administrator sistem."*
   - Error code: `PROVIDER_NOT_CONFIGURED`.
   - No fake downloads or mock UI presented.

#### Test Case B: Non-Media URL Rejection
1. Paste a user profile link: `https://www.tiktok.com/@tiktok`.
2. Click **Unduh**.
3. **Expected Outcome**:
   - HTTP 422 response.
   - User-friendly message: *"Link TikTok ini bukan link video atau foto yang dapat diunduh."*
   - Error code: `UNSUPPORTED_MEDIA`.

#### Test Case C: Live Configured Resolution
1. Insert valid `TIKTOK_PROVIDER_API_KEY` in `.env.local`.
2. Restart Next.js dev server.
3. Paste a public TikTok video URL.
4. **Expected Outcome**:
   - Media Preview card renders thumbnail, creator username, title, and duration.
   - Available Downloads displays:
     - `Standard 720p · MP4`
     - `HD 1080p · MP4` (only if the creator uploaded 1080p+)
     - `Original Audio (MP3)` (if sound is present)
   - Clicking download triggers `/api/media/download` with signed token and begins download.

---

## 5. Developer CLI Verification Utility (`scripts/verify-tiktok-provider.ts`)

For testing upstream provider configurations directly without running the full Next.js web application:

```bash
# TikTok Provider Live Verification
npx tsx scripts/verify-tiktok-provider.ts "https://www.tiktok.com/@tiktok/video/7123456789012345678"
npx tsx scripts/verify-full-api-flow.ts

# Instagram Provider Verification
npx tsx scripts/verify-instagram-provider.ts "https://www.instagram.com/reel/C3b4X9vL123/"

# YouTube Provider Verification
npx tsx scripts/verify-youtube-provider.ts "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Safety & Guardrails:
1. **Never Logs Secrets:** API keys and sensitive tokens are masked or omitted entirely. Status is reported strictly as `CONFIGURED` or `NOT CONFIGURED`.
2. **Range Request Validation:** Performs a lightweight `Range: bytes=0-1024` request to verify the resolved media stream's HTTP status (200/206) and `Content-Type: video/mp4` without downloading the entire video or consuming unnecessary bandwidth.
3. **Zero Permanent Storage:** Never saves video/audio files to local disk.
4. **Exit Codes:** Exits with code `0` on verified success, or `1` if the provider is unconfigured, unreachable, or returns invalid payloads.

---

## 6. Security & Rate Limiting Guardrails

1. **Client Cannot Forge Target URL**: The client only sends `downloadToken` to `/api/media/download`. The server decodes the token, checks the HMAC signature, ensures `expiresAt > Date.now()`, and re-verifies the SSRF perimeter before delivery.
2. **Anti-Bot / Abuse**: Both `/api/media/resolve` (20 req/min) and `/api/media/download` (10 req/min) are throttled via IP sliding-window limiters.
3. **SSRF Guard**: Target URLs are checked for private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.1`), and cloud metadata (`169.254.169.254`).
4. **Production Secret Hardening**: `DOWNLOAD_SIGNING_SECRET` must be a high-entropy key of at least 32 characters in production. If missing or left at the development default in production, the server fails closed with `INTERNAL_ERROR`.

