# Tempelink — Phase 8: SEO, Platform Landing Pages & Search Discoverability Audit

## 1. Executive Summary

This audit assesses the current state of search engine discoverability, metadata architecture, crawlability, indexing policies, and content structure for Tempelink. While Phases 1–7 established a high-performance, secure, and multi-provider downloader engine with batch queue capabilities, the application currently lacks technical SEO primitives: only a single indexable page (`/`) exists, `robots.txt` and `sitemap.xml` are absent, canonical URLs are not configured, no platform-specific landing pages exist, and structured data (Schema.org JSON-LD) is missing.

Phase 8 will introduce a dedicated, search-optimized platform landing page architecture for the 6 supported platforms without breaking existing downloader logic, without making landing pages dependent on upstream provider calls during rendering, and without modifying API security boundaries.

---

## 2. Core Audit Findings & 19 Explicit Questions

### Q1: What pages currently exist?
Currently, only one indexable page route exists:
- `src/app/page.tsx` (`/`) — Universal Media Utility homepage.
All other application routes are backend REST API handlers under `src/app/api/`:
- `/api/media/resolve`
- `/api/media/download`
- `/api/platforms`
- `/api/batch`
- `/api/batch/[id]`
- `/api/batch/[id]/cancel`
- `/api/batch/[id]/retry`

### Q2: Which pages are indexable?
Only the homepage (`/`) is currently indexable because `src/app/layout.tsx` globally sets `robots: { index: true, follow: true }`.

### Q3: Which pages should be indexable?
The site should expose 7 canonical, indexable public pages:
1. `/` (Universal Downloader Homepage)
2. `/tiktok-downloader` (TikTok Video & Audio Downloader)
3. `/instagram-downloader` (Instagram Reels, Video & Photo Downloader)
4. `/youtube-downloader` (YouTube Shorts & Video Downloader)
5. `/twitter-downloader` (X / Twitter Video Downloader)
6. `/facebook-downloader` (Facebook Reels & Video Downloader)
7. `/pinterest-downloader` (Pinterest Media Utility)

### Q4: What metadata currently exists?
Metadata is currently defined exclusively in `src/app/layout.tsx`:
- `title.default: "Tempelink — Universal Media Utility & Downloader"`
- `title.template: "%s | Tempelink"`
- `description`: Generic Indonesian description.
- `metadataBase`: Points to internal placeholder `https://tempelink.internal`.
- Basic static Open Graph and Twitter card tags.

### Q5: Is there one global title/description?
Yes. Currently, all visits receive the exact same title and description from `RootLayout`. The homepage lacks specific metadata override, and there are no platform-specific titles or descriptions.

### Q6: Are canonical URLs implemented?
**NO**. Neither `layout.tsx` nor `page.tsx` define `alternates: { canonical: ... }`. Crawlers may observe ambiguous URLs if query parameters or protocols differ.

### Q7: Is sitemap implemented?
**NO**. There is no `src/app/sitemap.ts` or static `sitemap.xml`. Search engines must rely on manual spidering.

### Q8: Is robots implemented?
**NO**. There is no `robots.txt` or `src/app/robots.ts`. Crawlers are not instructed to stay away from sensitive API endpoints (`/api/*`).

### Q9: Are Open Graph tags implemented?
Partially. Basic static OG tags exist in `layout.tsx`, but they point to `https://tempelink.internal` rather than the configured production domain, and they lack platform-specific image/title/description customization.

### Q10: Are Twitter/X cards implemented?
Partially. Basic static `summary_large_image` tags exist in `layout.tsx`, but they are static and uncustomized per landing page.

### Q11: Is structured data implemented?
**NO**. There is no Schema.org JSON-LD structured data (`WebSite`, `SoftwareApplication`, `FAQPage`) implemented anywhere in the DOM.

### Q12: Is the site internally linkable?
Partially. The homepage links to the history drawer, but the platform badges (`PlatformPills`) are currently non-clickable static badges. The footer lacks links to specific platform downloaders.

### Q13: Which platform pages should exist?
Six dedicated, search-optimized platform landing pages:
- `/tiktok-downloader`
- `/instagram-downloader`
- `/youtube-downloader`
- `/twitter-downloader`
- `/facebook-downloader`
- `/pinterest-downloader`

### Q14: Are platform pages genuinely useful?
**YES**. Platform landing pages directly address user intent by providing:
1. Platform-specific capability breakdowns (e.g. watermark-free MP4 for TikTok, SD/HD streams for Facebook, audio M4A extraction for YouTube).
2. Supported link syntax and URL patterns (e.g. reels, shorts, posts, photo slides).
3. Realistic limitation disclaimers (e.g., private profiles cannot be resolved, Pinterest upstream defect notice).
4. Tailored platform FAQs answering concrete user questions.
5. Interactive CTA that links directly into the downloader pre-focused on that platform.

### Q15: Are any pages duplicate/thin content?
Currently no duplicate pages exist. To prevent future "thin content" or doorway page penalties from Google, each platform page must contain:
- Unique platform copy explaining that specific ecosystem.
- Platform-specific URL formats and examples.
- Distinct FAQs addressing that platform's real capabilities and limitations.
- Honest capability disclosures (never duplicating text verbatim across pages).

### Q16: Are dynamic downloader URLs accidentally indexable?
No. There are currently no dynamic `/download?url=...` query routes. Resolution is done dynamically via POST `/api/media/resolve`. We must ensure user-inputted URLs never become indexed routes.

### Q17: Are API routes exposed to search engines?
Without `robots.txt`, crawlers could attempt to crawl `/api/platforms` or discover internal API paths. `robots.txt` must explicitly include `Disallow: /api/`.

### Q18: Is the site configured correctly for Vercel?
Yes. Next.js 16 App Router metadata, `sitemap.ts`, and `robots.ts` generate static or dynamic edge responses natively supported by Vercel deployment without additional server configuration.

### Q19: What SEO work is safe to implement in this phase?
1. Centralized SEO data configuration in `src/lib/seo/platform-seo-data.ts`.
2. Dynamic platform landing pages using Next.js App Router: `src/app/[platform]-downloader/page.tsx` (or route segment `src/app/[slug]/page.tsx` with `generateStaticParams`).
3. Dedicated `src/app/sitemap.ts` generating canonical URLs for `/` and all 6 platform landing pages.
4. Dedicated `src/app/robots.ts` permitting public pages while disallowing `/api/`.
5. JSON-LD structured data schemas for `WebSite`, `SoftwareApplication`, and `FAQPage`.
6. Homepage semantic enhancement: clear single `<h1>`, refined meta tags, and internal link grid.
7. Clickable `PlatformPills` navigating to platform landing pages.
8. Footer navigation linking all platform landing pages.
9. **Zero-API-call guarantee**: Platform landing pages must render completely statically without calling RapidAPI.

---

## 3. Architecture Plan

```text
               User / Crawler
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    robots.txt               sitemap.xml
(Disallow: /api/)     (7 Canonical Routes)
         │                       │
         └───────────┬───────────┘
                     ▼
             Next.js App Router
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
   Homepage (/)           Platform Pages (/*-downloader)
  - Canonical /          - Canonical /*-downloader
  - Single <h1>          - Unique H1, H2, H3
  - WebSite Schema       - SoftwareApplication Schema
  - SoftwareApp Schema   - FAQPage Schema
  - Links to platforms   - Backlink to /
                         - Cross-links to other platforms
                         - Pre-filled interactive CTA
                         - 100% Static (0 RapidAPI calls)
```

---

## 4. Honest Capability Matrix for SEO Content

| Platform | Real Supported Capabilities | Prohibited False Claims | Special Limitations |
| :--- | :--- | :--- | :--- |
| **TikTok** | Standard 720p (No Watermark), Watermarked MP4, HD 1080p (if provided upstream), Audio MP3, Photo slides | Do NOT claim 4K or universal HD upscaling | Only public videos; depends on author privacy |
| **Instagram** | Video MP4 (Reels, Posts, IGTV), Photo JPG, Carousel items | Do NOT claim private story/profile downloading | Requires public post/reel URL |
| **YouTube** | Video MP4 (144p up to native resolution), Audio M4A | Do NOT claim MP3 320kbps conversion if provider delivers M4A | Age-restricted or private videos unavailable |
| **X / Twitter** | Standard Video MP4 (single stream) | Do NOT claim multi-resolution selector if upstream has only 1 resolution | Only public tweets containing video |
| **Facebook** | HD Video MP4, Standard SD Video MP4 | Do NOT claim 4K 60fps unless upstream provides it | Private group or restricted videos unavailable |
| **Pinterest** | Image JPG (Pins), Video MP4 where available | Do NOT claim guaranteed success | Currently affected by upstream provider defect (`CONTENT_UNAVAILABLE`) |

---

## 5. Audit Conclusion

The plan satisfies all requirements of Phase 8:
- No changes to provider contracts.
- No changes to Phase 6 queue or Phase 7 cache.
- Complete search discoverability, clean metadata, and rich Schema.org structured data.
- 100% Indonesian language consistency.
