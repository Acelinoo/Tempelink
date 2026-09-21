# TEMPELINK — PHASE 4 RAPIDAPI CONTRACT SPECIFICATION
**Verified Real Upstream Gateway API Contracts**
**Date:** September 2026  
**Status:** Contracts Verified via Live Gateway Probing

---

## 1. Provider Contract Matrix

| Provider | Endpoint | Method | Purpose | Parameters | Media Response | Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Instagram** | `/instagram/` | GET | Resolve Instagram media | `url` (encoded clean Instagram post/reel link) | `result` (array of `{ url, type, size, thumb }`) | **YES** |
| **YouTube** | `/download.php` | GET | Video resolve | `id` (YouTube video ID) | `results` (array with video streams: 144p–2160p) | **YES** |
| **YouTube** | `/download.php` | GET | Audio resolve | `id` (YouTube video ID) | `results` (array with audio streams: M4A / audio/mp4) | **YES** |
| **YouTube** | `/subtitle.php` | GET | Subtitle only | `type=json3`, `id=<video-id>` | Subtitle JSON (not used for media download) | **YES** |
| **TikTok** | `/index` | GET | Resolve TikTok media | `url` (clean TikTok video link) | `video`, `music`, `author` (direct array/fields) | **YES** |

---

## 2. Instagram Contract Details

- **Host:** `instagram-post-reels-stories-downloader-api.p.rapidapi.com`
- **Method:** `GET`
- **Endpoint:** `/instagram/?url=${encodeURIComponent(url)}`
- **Headers:**
  - `x-rapidapi-host: instagram-post-reels-stories-downloader-api.p.rapidapi.com`
  - `x-rapidapi-key: <REDACTED>`
- **Query Parameter:** `url` (Required). Full canonical URL of a public post or reel.
- **Success Response Structure:**
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
- **Error Response Structure:**
  ```json
  {
    "status": false,
    "result": null,
    "message": "Invalid URL"
  }
  ```
- **Implementation Mapping:**
  - `result` array is parsed directly.
  - Items with `type === 'video/mp4'` mapped to video capability (`format: 'mp4'`).
  - Items with `type === 'image/jpeg'` or `image/png` mapped to image capability (`format: 'jpg'`).
  - `status: false` mapped to `CONTENT_UNAVAILABLE` (HTTP 404).

---

## 3. YouTube Contract Details

- **Host:** `youtube-video-and-shorts-downloader.p.rapidapi.com`
- **Method:** `GET`
- **Endpoint:** `/download.php?id=${encodeURIComponent(mediaId)}`
- **Headers:**
  - `x-rapidapi-host: youtube-video-and-shorts-downloader.p.rapidapi.com`
  - `x-rapidapi-key: <REDACTED>`
- **Query Parameter:** `id` (Required). 11-character YouTube video ID.
- **Success Response Structure:**
  ```json
  {
    "status": "ok",
    "status_code": 200,
    "version": "v6.1.0",
    "response_time": "4.5662s",
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
        "quality": "720p",
        "url": "https://rr2---sn-...googlevideo.com/videoplayback?..."
      },
      {
        "has_audio": false,
        "mime": "video/mp4",
        "quality": "1080p",
        "url": "https://rr2---sn-...googlevideo.com/videoplayback?..."
      }
    ]
  }
  ```
- **Subtitle Endpoint (`/subtitle.php`):**
  - Verified with `type=json3&id=qJle6Bki4Og` -> HTTP 200 OK.
  - Used for media download: **NO** (subtitles are transcript data, not media binaries).
- **Quality & Capability Mapping:**
  - `M4A` / audio mime -> `Audio Original (M4A)` (format: `m4a`, mime: `audio/mp4`).
  - `< 1080p` (`144p`, `240p`, `360p`, `480p`, `720p`) -> `Standard` video capability.
  - `>= 1080p` (`1080p`, `1440p`, `2160p`) -> `HD` video capability.
  - No upscaling or false HD labeling.
