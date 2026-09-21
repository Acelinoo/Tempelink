# TEMPELINK — PHASE 4 PROVIDER CONTRACT AUDIT
**Verified Real Upstream Gateway API Contracts**
**Date:** September 2026  
**Status:** Contracts Verified via Live Gateway Probing

---

## 1. Provider Contract Matrix

| Provider | Host | Endpoint | Method | Parameters | Response Media Field | Live Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TikTok** | `tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com` | `/index` | `GET` | `url` (clean TikTok link) | `video`, `music`, `author` (direct arrays/fields) | **PASS — LIVE VERIFIED** |
| **Instagram** | `instagram-post-reels-stories-downloader-api.p.rapidapi.com` | `/instagram/` | `GET` | `url` (encoded clean Instagram link) | `result` (array of items with `url`, `type`, `size`, `thumb`) | **PASS — LIVE VERIFIED** |
| **YouTube** | `youtube-video-and-shorts-downloader.p.rapidapi.com` | `/download.php` | `GET` | `id` (YouTube video ID) | `results` (array of items with `quality`, `mime`, `has_audio`, `url`) | **PASS — LIVE VERIFIED** |

---

## 2. Detailed Upstream Schemas

### 2.1. Instagram Provider

- **Host:** `instagram-post-reels-stories-downloader-api.p.rapidapi.com`
- **Endpoint:** `GET /instagram/?url=${encodeURIComponent(url)}`
- **Headers:**
  - `X-RapidAPI-Key`: `<API_KEY>`
  - `X-RapidAPI-Host`: `instagram-post-reels-stories-downloader-api.p.rapidapi.com`
- **Request Parameters:**
  - `url` (query parameter, required): Clean public post/reel URL (e.g. `https://www.instagram.com/reel/C-iTZ5cg08A/`)
- **Success Response Schema:**
  ```json
  {
    "status": true,
    "time": 2.73,
    "result": [
      {
        "url": "https://scontent-...cdninstagram.com/...",
        "type": "video/mp4",
        "size": "8947715",
        "thumb": "https://cdn.akhmadjonov.uz/thumb/?cdn=..."
      }
    ]
  }
  ```
  For multi-photo carousel posts (`/p/`):
  ```json
  {
    "status": true,
    "time": 2.73,
    "result": [
      {
        "url": "https://scontent-...cdninstagram.com/...",
        "type": "image/jpeg",
        "size": "1204929",
        "thumb": "https://cdn.akhmadjonov.uz/thumb/?cdn=..."
      },
      ...
    ]
  }
  ```
- **Error Response Schema (Invalid / Not Found / Expired):**
  ```json
  {
    "status": false,
    "result": null,
    "message": "Invalid URL"
  }
  ```
- **Normalization Mapping:**
  - Read `payload.result` as primary array (support fallback to `payload.data` / `payload.media` for resilience).
  - Item `type === 'video/mp4'` -> Video capability with format `mp4`.
  - Item `type === 'image/jpeg'` or `image/png` -> Image capability with format `jpg` / `png`.
  - Check `payload.status === false && payload.message === 'Invalid URL'` -> Map to `CONTENT_UNAVAILABLE`.

---

### 2.2. YouTube Provider

- **Host:** `youtube-video-and-shorts-downloader.p.rapidapi.com`
- **Endpoint:** `GET /download.php?id=${mediaId}`
- **Headers:**
  - `X-RapidAPI-Key`: `<API_KEY>`
  - `X-RapidAPI-Host`: `youtube-video-and-shorts-downloader.p.rapidapi.com`
- **Request Parameters:**
  - `id` (query parameter, required): YouTube video ID extracted from standard watch URL, shortlink (`youtu.be`), shorts (`/shorts/`), or embed URL.
- **Success Response Schema:**
  ```json
  {
    "status": "ok",
    "status_code": 200,
    "version": "v6.1.0",
    "response_time": "4.5662s",
    "request_id": "b8059aac14ddc006d12d901131e9fa23e8601792",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    "duration": "213",
    "thumbnail": "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp",
    "results": [
      {
        "has_audio": true,
        "mime": "audio/mp4",
        "quality": "M4A",
        "url": "https://rr2---sn-...googlevideo.com/videoplayback?..."
      },
      {
        "has_audio": false,
        "mime": "video/mp4",
        "quality": "144p",
        "url": "https://..."
      },
      {
        "has_audio": false,
        "mime": "video/mp4",
        "quality": "720p",
        "url": "https://..."
      },
      {
        "has_audio": false,
        "mime": "video/mp4",
        "quality": "1080p",
        "url": "https://..."
      }
    ]
  }
  ```
- **Error Response Schema:**
  ```json
  {
    "status": "error",
    "message": "Video not found"
  }
  ```
- **Normalization Mapping:**
  - Items with `quality === 'M4A'` or `mime.startsWith('audio/')` -> Audio capability (format: `m4a`, label: `Audio Original (M4A)`).
  - Video items (`mime.startsWith('video/')`):
    - `144p`, `240p`, `360p`, `480p`, `720p` (< 1080p) -> `Standard` video capability.
    - `1080p`, `1440p`, `2160p` (>= 1080p) -> `HD` video capability.
    - Deduplicate stream options by quality resolution so each unique resolution is cleanly selectable.
