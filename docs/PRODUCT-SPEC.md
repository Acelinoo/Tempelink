# Tempelink — Product Specification

> "Tempelink is a universal media utility platform that lets users paste a supported media URL, automatically detects its platform and media capabilities, and presents available download options in a simple interface."

---

## 1. Product Vision & Principles

Tempelink solves the fragmented, ad-ridden, and unreliable landscape of online media downloaders. Instead of juggling single-platform websites with predatory popups and misleading "Download" buttons, Tempelink offers a clean, technical, high-speed, and trustworthy utility experience.

### Core Principles:
1. **Capability-Driven Truth**: Never fabricate resolution or audio availability. If a provider only returns 720p, show 720p. Never present fake "1080p HD" or "4K" labels without technical backing.
2. **Zero-Friction Utility**: No mandatory registration or login for core functionality. Paste, resolve, select, download.
3. **Platform Agnostic UI**: The frontend does not hardcode platform-specific rendering. Capabilities returned by the backend dictate what is rendered.
4. **Legitimacy & Integrity**: Respect platform access boundaries, public API standards, and copyright notices. No DRM circumvention or arbitrary watermark cracking.

---

## 2. Primary User Journey

```
[ USER ENTERS URL ]
         │
         ▼
[ CLIENT / SERVER URL VALIDATION ]
         │
         ▼
[ PLATFORM DETECTION ENGINE ]
         │
         ▼
[ PROVIDER RESOLUTION PIPELINE ]
         │
         ▼
[ NORMALIZATION & CAPABILITY EXTRACTION ]
         │
         ▼
[ DYNAMIC CAPABILITIES PRESENTATION ]
   (Standard, HD, Audio, Image)
         │
         ▼
[ USER SELECTS CAPABILITY ]
         │
         ▼
[ SECURE DOWNLOAD / DELIVERY FLOW ]
```

---

## 3. Supported Platforms & Capability Matrix

| Platform | Media Types Supported | Quality Tiers | Audio Extraction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **TikTok** | Video, Audio, Slideshow | Standard (SD/720p), HD (1080p when present) | Original Audio (MP3/M4A) | Excludes private accounts and region-blocked clips |
| **Instagram** | Reels, Video Posts, Photos, Carousels | Native resolution, High-Res | Audio stream if extracted | Strictly public media only |
| **YouTube** | Video, Shorts, Audio | Standard (360p, 720p), HD (1080p+) | Audio only (M4A/MP3) | Respects creator copyright & licensing restrictions |
| **X / Twitter** | Video, GIF | Multiple MP4 bitrates (Standard/HD) | Merged in video | Public tweets with attached media |
| **Facebook** | Public Videos, Reels | SD (Standard), HD | Merged audio/video | Public group/page videos only |
| **Pinterest** | Video Pins, Image Pins | Original MP4, Original JPG/PNG | N/A | High-resolution image/video pins |
| **Threads** | Video Posts, Images | Native MP4, Native Images | Native | Public Threads media |

---

## 4. Capability System & Quality Mapping

### Quality Classification:
- **Standard**: `< 1080p` (typically 360p, 480p, 720p). Fast download, lightweight file size.
- **HD (High Definition)**: `≥ 1080p` (1080p, 1440p / 2K, 2160p / 4K). Maximum visual fidelity.
- **Audio Only**: Extracted or separate audio streams (AAC, M4A, MP3) when legitimately exposed by provider.
- **Visual Stills**: JPEG, WebP, PNG for image carousels or photo pins.

---

## 5. Scope Boundaries

### What Tempelink Does:
- Detects legitimate public media links from supported platforms.
- Extracts real capabilities and media metadata (title, author, thumbnail, duration).
- Provides instant, direct download triggers for authorized media streams.
- Preserves a private, local download history in the user's browser.

### What Tempelink Explicitly Refuses To Do:
- Bypass password protection or private account barriers.
- Crack DRM (Widevine, FairPlay, PlayReady) or encrypted media streams.
- Strip digital watermarks arbitrarily.
- Store copyrighted media permanently without authorization.
