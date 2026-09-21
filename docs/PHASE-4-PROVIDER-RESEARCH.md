# TEMPELINK — PHASE 4 PROVIDER RESEARCH
**Multi-Platform Expansion: Instagram & YouTube Integration Research**
**Date:** September 2026  
**Status:** Canonical Research & Selection Document

---

## 1. Executive Summary

Phase 4 expands Tempelink's media resolution engine from TikTok-only to a multi-provider ecosystem supporting **Instagram** and **YouTube**.

In accordance with Tempelink's core engineering principles:
1. Only legitimate, publicly accessible media and official/authorized third-party gateway APIs are considered.
2. Zero login bypass, private account cracking, CAPTCHA defeat, cookie theft, or DRM circumvention will be implemented.
3. Official APIs are evaluated first. Where official APIs strictly prohibit media downloads or require creator OAuth login, reputable third-party gateway providers on RapidAPI with documented free tiers are researched.
4. Capability honesty is strictly enforced: video resolutions and formats are extracted only from actual returned stream metadata without hallucination.

---

## 2. Instagram Provider Discovery & Evaluation

### Candidate 1: Official Instagram Graph API (Meta for Developers)
- **Official URL:** `https://developers.facebook.com/docs/instagram-api/`
- **Authentication:** OAuth 2.0 User Access Tokens via Facebook Login.
- **Cost / Free Tier:** Free for registered Meta Developers.
- **Capabilities:** Fetching user's own media, insights, publishing, comment moderation.
- **Crucial Limitation:** The official Meta Graph API only permits accessing accounts and media owned by or granted to the authenticated user. It strictly forbids querying arbitrary third-party public posts or downloading media without account credentials.
- **Verdict:** **REJECTED for Universal Downloader.** Tempelink is an anonymous public utility that does not require users to log in or manage credentials.

---

### Candidate 2: Instagram Post, Reels, Stories Downloader API (Selected)
- **Provider:** RapidAPI Gateway (`instagram-post-reels-stories-downloader-api`)
- **Host URL:** `instagram-post-reels-stories-downloader-api.p.rapidapi.com`
- **Authentication:** `X-RapidAPI-Key`, `X-RapidAPI-Host`
- **Free Tier:** Basic Plan ($0.00 / month) offering free request quota for testing and development.
- **Pricing:**
  - Basic: $0.00/mo (Free quota)
  - Pro/Ultra: $5.00 - $20.00/mo for higher volumes
- **Endpoint:** `GET /instagram/?url={encodedUrl}`
- **Request Format:** HTTP GET with query parameter `url`.
- **Response Format (JSON):**
  ```json
  {
    "status": true,
    "data": [
      {
        "url": "https://scontent.cdninstagram.com/v/t50.2886-16/...",
        "type": "video",
        "thumbnail": "https://scontent.cdninstagram.com/v/t51.2885-15/...",
        "title": "Post caption or reel description"
      }
    ]
  }
  ```
  For carousel posts, `data` contains an array of items (images and/or videos).
- **Supported Media:** Reels (`/reel/`, `/reels/`), Posts (`/p/`), Stories (`/stories/`).
- **Resolution Information:** Streams delivered from CDN; standard resolution (typically 720p or 1080p). Where resolution metadata is absent, normalized as `standard` capability honestly.
- **Audio:** Embedded in video stream; separate audio tracks extracted if returned.
- **Image / Carousel:** Supported via array of image objects with direct JPG URLs.
- **Rate Limits:** Enforced per RapidAPI subscription tier (default ~50-100 req/month on free tier).
- **Tradeoffs:** Clean RESTful GET structure, standard JSON response, direct CDN URLs compatible with SSRF validation and signed token generation. Requires activating free Basic subscription on RapidAPI.

---

### Candidate 3: Instagram Downloader51
- **Host URL:** `instagram-downloader51.p.rapidapi.com`
- **Endpoint:** `POST /download.php` (multipart/form-data)
- **Free Tier:** Limited free quota on RapidAPI.
- **Tradeoffs:** Requires `multipart/form-data` payload instead of clean query parameters; higher latency reported in developer community.
- **Verdict:** Secondary fallback.

---

## 3. YouTube Provider Discovery & Evaluation

### Candidate 1: Official YouTube Data API v3 (Google Cloud Platform)
- **Official URL:** `https://developers.google.com/youtube/v3`
- **Authentication:** Google API Key / OAuth 2.0.
- **Cost / Free Tier:** 10,000 free quota units per day.
- **Crucial Limitation:** The official YouTube Data API v3 is exclusively a **metadata API** (search, video details, playlists, channel stats). It **strictly does not provide video download streams or raw MP4 files**, and Google's Terms of Service explicitly forbid downloading YouTube media via Data API endpoints.
- **Verdict:** **NOT VIABLE for Media Delivery.** YouTube Data API cannot fulfill the download contract.

---

### Candidate 2: YouTube Video and Shorts Downloader API (Selected)
- **Provider:** RapidAPI Gateway (`youtube-video-and-shorts-downloader`)
- **Host URL:** `youtube-video-and-shorts-downloader.p.rapidapi.com`
- **Authentication:** `X-RapidAPI-Key`, `X-RapidAPI-Host`
- **Free Tier:** Basic Plan ($0.00 / month) offering 150 requests/month free.
- **Pricing:**
  - Basic: $0.00/mo (150 requests/month)
  - Pro: $6.99/mo (10,000 requests/month)
  - Ultra: $12.99/mo (50,000 requests/month)
- **Endpoint:** `GET /video?url={encodedUrl}` (or `GET /api/video?url=...`)
- **Request Format:** HTTP GET with query parameter `url`.
- **Response Format (JSON):**
  ```json
  {
    "status": "success",
    "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    "duration": "213",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "formats": [
      {
        "quality": "720p",
        "format": "mp4",
        "url": "https://rr3---sn-4g5ednks.googlevideo.com/videoplayback?...",
        "hasAudio": true,
        "fileSizeBytes": 18450123
      },
      {
        "quality": "1080p",
        "format": "mp4",
        "url": "https://rr3---sn-4g5ednks.googlevideo.com/videoplayback?...",
        "hasAudio": true,
        "fileSizeBytes": 45120300
      },
      {
        "quality": "audio",
        "format": "mp3",
        "url": "https://rr3---sn-4g5ednks.googlevideo.com/videoplayback?...",
        "hasAudio": true,
        "fileSizeBytes": 3412000
      }
    ]
  }
  ```
- **Supported Media:** Standard Videos (`/watch?v=`), Shorts (`/shorts/`), Shortlinks (`youtu.be/`), Embeds (`/embed/`).
- **Resolution Information:** Explicit `quality` labels (`360p`, `720p`, `1080p`). Strictly normalized: `>= 1080p` -> `HD`, `< 1080p` -> `Standard`.
- **Audio:** Dedicated audio capability with direct stream URL.
- **Tradeoffs:** Direct GoogleVideo CDN streams, clear format separation, honest resolution metadata, free Basic tier available.

---

## 4. Provider Selection & Architectural Alignment

| Platform | Selected Provider | Host | Endpoint | Free Tier |
| :--- | :--- | :--- | :--- | :--- |
| **TikTok** (Phase 2 Baseline) | TikTok Downloader Without Watermark | `tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com` | `GET /index?url=...` | Configured & Live Verified |
| **Instagram** (Phase 4 Provider #2) | Instagram Post, Reels, Stories Downloader API | `instagram-post-reels-stories-downloader-api.p.rapidapi.com` | `GET /instagram/?url=...` | Free Basic Tier ($0/mo) |
| **YouTube** (Phase 4 Provider #3) | YouTube Video and Shorts Downloader | `youtube-video-and-shorts-downloader.p.rapidapi.com` | `GET /video?url=...` | Free Basic Tier ($0/mo) |

---

## 5. Cost Control & Environment Configuration

### Rule Compliance:
1. **Free Tier Availability:** Both selected providers offer a free $0.00/month Basic tier on RapidAPI.
2. **Subscription Activation Requirement:** RapidAPI requires the user account to click "Subscribe to Free Plan" for each individual API listing before requests will be authorized.
3. **Current Subscription Status:**
   - TikTok API: **SUBSCRIBED & LIVE VERIFIED** (Passes live regression).
   - Instagram API: **NOT YET SUBSCRIBED** (Returns `403 Forbidden: You are not subscribed to this API`).
   - YouTube API: **NOT YET SUBSCRIBED** (Returns `403 Forbidden: You are not subscribed to this API`).
4. **Fail-Closed Behavior:**
   - If keys are missing: Throws `PROVIDER_NOT_CONFIGURED` (HTTP 503).
   - If key is present but unsubscribed: Returns clean `PROVIDER_UNAVAILABLE` (HTTP 503) explaining gateway subscription status without exposing keys or stack traces.
