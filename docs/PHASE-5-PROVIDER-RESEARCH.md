# TEMPELINK — PHASE 5 PROVIDER RESEARCH & CONTRACT SPECIFICATION
**Expansion Platforms: X / Twitter, Pinterest, Facebook**
**Date:** September 2026  
**Author:** Tempelink Core Architecture Team

---

## 1. Executive Summary & Legal/Security Boundaries

Phase 5 replaces previous unverified provider candidates with 3 newly acquired RapidAPI provider contracts for **X (Twitter)**, **Pinterest**, and **Facebook**.

In strict adherence to Tempelink's architecture and security rules:
- **Legitimate Gateway Integration:** Only authorized RapidAPI endpoints configured via environment variables are queried. Zero web scraping, zero session hijacking, zero anti-bot/Cloudflare bypassing, zero stolen cookies, and zero private account access.
- **Provider Isolation:** Each platform runs through its dedicated `BasePlatformProvider` implementation. Failures or limitations on one platform never degrade TikTok, Instagram, or YouTube.
- **Dynamic Capability Honesty:** Capabilities strictly mirror actual media streams returned by the upstream provider. No artificial upscaling or synthetic HD labeling (only streams >=1080p receive HD labeling).
- **Cryptographic Security Perimeter:** All media streams must pass strict SSRF validation before signed HMAC-SHA256 download tokens are minted.

---

## 2. Platform 1: X / Twitter

### 2.1. Provider Contract Specification
- **Gateway Host:** `twitter-video-downloader2.p.rapidapi.com`
- **Method:** `GET`
- **Path:** `/`
- **Query Parameter:** `url=<encoded target URL>`
- **Headers:**
  - `x-rapidapi-host: twitter-video-downloader2.p.rapidapi.com`
  - `x-rapidapi-key: process.env.X_PROVIDER_API_KEY || process.env.RAPIDAPI_KEY`
- **Test Target:** `https://twitter.com/PassengersMovie/status/821025484150423557`

### 2.2. Real Upstream Response Schema
Observed from live probing:
```json
{
  "status": "success",
  "data": {
    "username": "PassengersMovie",
    "caption": "Plan your escape aboard the Starship Avalon with #PassengersMovie - see it today! 🚀 🚀 🚀 https://t.co/dlNC50FhBu https://t.co/X0go99a4hO",
    "thumb": "https://pbs.twimg.com/media/C2S4JpQVIAAjq0b.jpg",
    "src": "https://video.twimg.com/amplify_video/821024340573425664/vid/720x720/k_rRkQYc14s49sUa.mp4"
  }
}
```

### 2.3. Normalized Capability Mapping
- `mediaId`: Extracted status ID (`821025484150423557`).
- `title`: Extracted from `data.caption`.
- `thumbnail`: Extracted from `data.thumb`.
- `author`: Extracted from `data.username`.
- `capabilities`:
  - Parses resolution dimension (`720x720` -> 720p).
  - Categorized honestly as Standard (height < 1080): `Standard 720p (MP4)`.
  - Download token signed with HMAC-SHA256 and target URL `https://video.twimg.com/...`.

### 2.4. Live Verification Results
- **Authentication:** PASS (`X-RapidAPI-Key` accepted).
- **Resolution:** PASS (HTTP 200 returned in <2000ms).
- **Media Accessibility:** PASS (Twitter CDN `video.twimg.com` returned `HTTP 206 Partial Content`, `video/mp4`).
- **Download Delivery:** PASS (Signed HMAC token verified).
- **Status:** **PASS — LIVE VERIFIED**

---

## 3. Platform 2: Facebook

### 3.1. Provider Contract Specification
- **Gateway Host:** `facebook-reels-and-video-downloader.p.rapidapi.com`
- **Method:** `GET`
- **Path:** `/facebook`
- **Query Parameter:** `url=<encoded target URL>`
- **Headers:**
  - `x-rapidapi-host: facebook-reels-and-video-downloader.p.rapidapi.com`
  - `x-rapidapi-key: process.env.FACEBOOK_PROVIDER_API_KEY || process.env.RAPIDAPI_KEY`
- **Test Target:** `https://www.facebook.com/reel/1921056328602745`

### 3.2. Real Upstream Response Schema
Observed from live probing:
```json
{
  "success": true,
  "title": "Facebook",
  "thumbnail": "https://scontent.xx.fbcdn.net/v/...",
  "links": {
    "Download High Quality": "https://video-dfw5-1.xx.fbcdn.net/v/..._n.mp4?...",
    "Download Low Quality": "https://video-dfw5-2.xx.fbcdn.net/v/..._n.mp4?..."
  },
  "media": [
    {
      "hd_url": "https://video-dfw5-1.xx.fbcdn.net/v/..._n.mp4?...",
      "sd_url": "https://video-dfw5-2.xx.fbcdn.net/v/..._n.mp4?...",
      "width": 1080,
      "height": 1920
    }
  ]
}
```

### 3.3. Normalized Capability Mapping
- `mediaId`: Extracted reel ID (`1921056328602745`).
- `title`: Extracted from `title`.
- `thumbnail`: Extracted from `thumbnail`.
- `capabilities`:
  - `hd_url` (1080x1920) -> Honest `HD Video (MP4)`.
  - `sd_url` -> Honest `Standard Video (MP4)`.
  - Each capability signed with independent HMAC download token.

### 3.4. Live Verification Results
- **Authentication:** PASS (`X-RapidAPI-Key` accepted).
- **Resolution:** PASS (HTTP 200 returned).
- **Media Accessibility:** PASS (Facebook CDN `video-dfw*.xx.fbcdn.net` returned `HTTP 206 Partial Content`, `video/mp4`).
- **Download Delivery:** PASS (Signed HMAC token verified).
- **Status:** **PASS — LIVE VERIFIED**

---

## 4. Platform 3: Pinterest

### 4.1. Provider Contract Specification
- **Gateway Host:** `pinterest-media-download1.p.rapidapi.com`
- **Method:** `GET`
- **Path:** `/`
- **Query Parameter:** `url=<encoded target URL>`
- **Headers:**
  - `x-rapidapi-host: pinterest-media-download1.p.rapidapi.com`
  - `x-rapidapi-key: process.env.PINTEREST_PROVIDER_API_KEY || process.env.RAPIDAPI_KEY`
- **Test Target:** `https://www.pinterest.com/pin/70437488608239/`

### 4.2. Upstream Response & Live Discovery
- **Authentication:** PASS (RapidAPI validates the key; remaining quota consumed: 499,984 requests).
- **Upstream Body:**
  ```json
  [
    {
      "error": true
    }
  ]
  ```
- **Analysis:** Upstream gateway endpoint is active and authenticates properly, but the provider's internal extraction logic consistently returns `[ { "error": true } ]` for pins.
- **Handling:** `PinterestProvider` safely identifies this failure pattern and maps it directly to `TempelinkError('CONTENT_UNAVAILABLE')` without crashing or returning invalid payloads.
- **Status:** **BLOCKED — PROVIDER UNAVAILABLE** (Upstream Provider Defect)

---

## 5. Unified Provider Architecture Matrix

| Platform | Provider ID | RapidAPI Host | Endpoint | Auth Header | Capabilities | Live Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TikTok** | `tiktok` | `tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com` | `GET /index?url=` | `x-rapidapi-key` | MP4 (Clean), MP3 | **PASS — LIVE VERIFIED** |
| **Instagram** | `instagram` | `instagram-post-reels-stories-downloader-api.p.rapidapi.com` | `GET /instagram/?url=` | `x-rapidapi-key` | MP4 (Reels) | **PASS — LIVE VERIFIED** |
| **YouTube** | `youtube` | `youtube-video-and-shorts-downloader.p.rapidapi.com` | `GET /download.php?id=` | `x-rapidapi-key` | MP4 (144p–4K), M4A | **PASS — LIVE VERIFIED** |
| **X / Twitter** | `x` | `twitter-video-downloader2.p.rapidapi.com` | `GET /?url=` | `x-rapidapi-key` | MP4 (720p) | **PASS — LIVE VERIFIED** |
| **Facebook** | `facebook` | `facebook-reels-and-video-downloader.p.rapidapi.com` | `GET /facebook?url=` | `x-rapidapi-key` | HD MP4 (1080p), SD MP4 | **PASS — LIVE VERIFIED** |
| **Pinterest** | `pinterest` | `pinterest-media-download1.p.rapidapi.com` | `GET /?url=` | `x-rapidapi-key` | None (Provider Error) | **BLOCKED — PROVIDER UNAVAILABLE** |

---

## 6. Security & Defense In Depth

1. **Strict SSRF Checks:** Upstream media URLs from all providers are evaluated against private IPv4/IPv6, localhost (`127.0.0.1`), loopback, link-local, and AWS metadata IP (`169.254.169.254`).
2. **HMAC-SHA256 Token Protection:** Every stream is accessible only through signed, tamper-proof download tokens expiring in 15 minutes.
3. **MIME Whitelisting:** Client downloads enforce standard media types (`video/mp4`, `image/jpeg`, `audio/mp4`).
