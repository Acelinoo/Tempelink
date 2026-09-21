# TEMPELINK — PHASE 6 ARCHITECTURAL AUDIT & SPECIFICATION
**Phase 6: Batch Download + Queue System**
**Date:** September 2026  
**Author:** Tempelink Core Architecture Team  
**Status:** AUDIT COMPLETE — READY FOR IMPLEMENTATION

---

## 1. Executive Summary

Phase 6 introduces **Batch Download & Asynchronous Queue Processing** to Tempelink. Users will be able to input multiple media URLs simultaneously (up to 10 URLs), deduplicate and validate them, monitor resolution progress through a deterministic state machine, and initiate verified downloads with controlled concurrency.

This audit evaluates the current download flow, identifies system limitations, inventories reusable core services, defines the queue state machine and persistence model, assesses architectural risks, and outlines the precise implementation plan before any code changes occur.

---

## 2. Audit of Current Download Flow & Limitations

### 2.1. Current Single-Item Resolution & Download Pipeline
Currently, Tempelink operates strictly in a synchronous 1:1 request-response mode:
1. **Client Submission:** User inputs a single URL into `UrlInputForm`.
2. **Resolve Route (`POST /api/media/resolve`):**
   - Injects correlation ID.
   - Validates client IP rate limit via `enforceRateLimit(clientIp, 'resolve')` (20 req/min).
   - Sanitizes URL via `normalizeAndParseUrl(rawUrl)` (scheme, hostname).
   - Runs SSRF boundary checks via `validateUrlSafety(parsedUrl)`.
   - Dispatches URL to registered provider via `PlatformResolver.resolve(url)`.
   - Returns normalized `PublicMediaResponse` with capability descriptors.
3. **Download Route (`POST /api/media/download` & `GET /api/media/download?token=...`):**
   - Validates HMAC-SHA256 signature in download token.
   - Verifies token expiration timestamp (15-minute window).
   - Re-checks destination stream URL against SSRF boundary.
   - Validates MIME type against whitelist.
   - Issues direct download URL descriptor (POST) or HTTP 302 redirect with safe `Content-Disposition` (GET).

### 2.2. Current Architectural Limitations
1. **Single-URL Bottleneck:** Users must manually paste, wait for resolution, review capabilities, and download each media item individually.
2. **No Batch Ingestion / Deduplication:** The UI and API do not parse multiline inputs, normalize multiple URLs, or eliminate duplicate submissions.
3. **No Asynchronous Job Management:** No abstraction exists for tracking multiple related operations (`Batch`) and individual unit tasks (`QueueJob`).
4. **Provider Flooding Risk:** If a client were to trigger 10 simultaneous resolutions via unbounded `Promise.all()`, it could overwhelm upstream RapidAPI rate limits, trigger 429 throttling, or exceed connection pools.
5. **No Persistent Job State:** The application currently relies on client-side localStorage for download history and stateless HMAC tokens. There is no server-side store to record and resume active batch jobs across server restarts or process recycles.

---

## 3. Inventory of Reusable Services & Components

Tempelink already has robust, production-verified primitives that will be reused directly without modification or duplication:

| Reusable Primitive | Location | Role in Phase 6 |
| :--- | :--- | :--- |
| `PlatformResolver` | `src/lib/platforms/resolver.ts` | Resolves each batch item using existing provider contracts, SSRF checks, and timeouts. |
| `PlatformDetector` | `src/lib/platforms/detector.ts` | Pre-validates URLs on client and server before enqueueing. |
| `providerRegistry` | `src/lib/platforms/core/registry.ts` | Dispatches jobs to verified providers (TikTok, Instagram, YouTube, X, Facebook). |
| `validateUrlSafety` | `src/lib/security/ssrf.ts` | Enforces private IP, loopback, and metadata blocking for every batch URL. |
| `generateDownloadToken` | `src/lib/security/token.ts` | Generates cryptographically signed HMAC download tokens for completed batch jobs. |
| `verifyDownloadToken` | `src/lib/security/token.ts` | Enforces token validity upon download delivery. |
| `enforceRateLimit` | `src/lib/rate-limit/rate-limiter.ts` | Sliding window rate limiter to be extended for batch creation requests. |
| Capability Engine | `src/lib/platforms/capabilities.ts` | Automatically maps authentic resolutions and selects optimal default capability. |
| Error Taxonomy | `src/lib/types/errors.ts` | Standardized `TempelinkError` codes and localized Indonesian user messages. |

---

## 4. Required Queue Architecture & Data Models

### 4.1. Core Data Models

#### 4.1.1. Batch Model
```typescript
export type BatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface Batch {
  id: string;                    // UUID v4
  clientIp: string;              // Rate limit & client tracking
  status: BatchStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  jobs: QueueJob[];
}
```

#### 4.1.2. QueueJob Model
```typescript
export type JobStatus =
  | 'PENDING'
  | 'RESOLVING'
  | 'READY'
  | 'DOWNLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface QueueJob {
  id: string;                    // UUID v4
  batchId: string;
  sourceUrl: string;
  canonicalUrl?: string;
  platform: string;              // 'tiktok' | 'instagram' | 'youtube' | 'x' | 'facebook' | 'pinterest' | 'unknown'
  status: JobStatus;
  capabilityId?: string;
  selectedCapability?: Capability;
  mediaMetadata?: {
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    author?: { name?: string; username?: string };
    availableCapabilitiesCount: number;
  };
  attempts: number;
  maxAttempts: number;           // Default: 2
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### 4.2. State Machine & Transition Rules
Strict transition validation ensures jobs and batches never move backward or enter invalid states:

```
Job State Machine:
[PENDING] ─────► [RESOLVING] ─────► [READY] ─────► [COMPLETED]
    │                │                │
    ├────────────────┼────────────────┴──────────► [CANCELLED]
    │                │
    ▼                ▼
[FAILED] (Terminal)  [FAILED] (If attempts >= maxAttempts)
```

- **Valid Transitions for Jobs:**
  - `PENDING` -> `RESOLVING`, `CANCELLED`
  - `RESOLVING` -> `READY`, `FAILED`, `CANCELLED`
  - `READY` -> `DOWNLOADING`, `COMPLETED`, `CANCELLED`
  - `DOWNLOADING` -> `COMPLETED`, `FAILED`
  - `COMPLETED`, `FAILED`, `CANCELLED` are terminal states.
- **Valid Transitions for Batches:**
  - `PENDING` -> `PROCESSING`, `CANCELLED`
  - `PROCESSING` -> `COMPLETED`, `PARTIAL_SUCCESS`, `FAILED`, `CANCELLED`
  - Terminal conditions:
    - If all jobs completed successfully: `COMPLETED`
    - If some jobs completed and some failed/cancelled: `PARTIAL_SUCCESS`
    - If all jobs failed: `FAILED`
    - If cancelled by user: `CANCELLED`

### 4.3. Persistence Architecture
- **Compliance Rule:** The project explicitly forbids in-memory-only production queues (`const queue = new Map()`). Furthermore, no unnecessary external services (e.g. Redis, BullMQ) will be introduced without need.
- **Implementation:** A persistent disk-backed storage engine (`FileBatchStore`) located at `.data/batches/<batchId>.json`.
  - Atomicity is guaranteed via write-to-temporary file followed by `fs.promises.rename` (atomic POSIX/Windows filesystem rename).
  - Directory `.data/batches/` is created on demand.
  - In-memory cache is maintained for fast read operations, backed 100% by persistent disk storage.
  - On application startup, stale `RESOLVING` or `PROCESSING` jobs from interrupted processes are cleanly recovered or flagged as `FAILED`.

### 4.4. Concurrency Control & Worker Pool
- **Initial Concurrency Limit:** `QUEUE_CONCURRENCY=2` (configurable via environment variable).
- **Processing Mechanism:** A cooperative worker loop (`QueueRunner`) that acquires slots up to `QUEUE_CONCURRENCY`.
- **Slot Release:** As soon as a job finishes (either reaching `READY` or `FAILED`), the runner immediately releases the concurrency slot and pulls the next `PENDING` job.
- **Provider Protection:** No more than 2 upstream requests will ever execute concurrently across all active batch jobs on the instance.

### 4.5. Retry Policy & Exponential Backoff
- **Maximum Attempts:** `MAX_JOB_ATTEMPTS=2`.
- **Retryable Transient Errors:**
  - `TEMPORARY_FAILURE` (upstream gateway connection reset)
  - `PROVIDER_UNAVAILABLE` (transient 5xx from gateway)
  - `TIMEOUT` / `AbortError`
- **Non-Retryable Errors (Immediate Failure):**
  - `INVALID_URL`
  - `UNSUPPORTED_PLATFORM`
  - `UNSUPPORTED_MEDIA`
  - `PRIVATE_CONTENT`
  - `AUTH_REQUIRED`
  - `CONTENT_UNAVAILABLE`
  - `SSRF_BLOCKED`
  - `PROVIDER_NOT_CONFIGURED`
- **Backoff:** 1st attempt is immediate; 2nd attempt waits 1500ms before retrying.

---

## 5. Risk Assessment & Mitigations

| Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Provider Quota Depletion / Throttling** | HIGH | Bound concurrency to 2; limit batch creation to 5/min per client IP; maximum 10 URLs per batch. |
| **Process Crash / Server Restart Data Loss** | HIGH | Disk-backed atomic persistence (`.data/batches/`) ensures jobs survive process recycling. |
| **SSRF / Malicious URL Smuggling in Batch** | HIGH | Every URL undergoes individual `validateUrlSafety` and hostname sanitization prior to queuing. |
| **Client UI Hanging on Long Batches** | MEDIUM | Deterministic polling endpoint (`GET /api/batch/:id`) with exponential backoff stopping on terminal state. |
| **Mobile & Tablet Layout Degradation** | MEDIUM | Build fluid responsive layouts using Tailwind container queries and responsive breakpoints (`sm:`, `md:`, `lg:`). |
| **Fake Capabilities in Batch Mode** | MEDIUM | Automatically select the highest-quality authentic capability returned by the provider without upscaling. |

---

## 6. Proposed Implementation Plan & Files Expected to Change

### 6.1. Files to Create
1. `docs/PHASE-6-AUDIT.md` (this audit document)
2. `src/lib/types/queue.ts`: Type definitions for `Batch`, `QueueJob`, states, and inputs.
3. `src/lib/queue/store.ts`: `FileBatchStore` persistent atomic disk storage.
4. `src/lib/queue/runner.ts`: `QueueRunner` concurrency controller, retry dispatcher, and state machine validator.
5. `src/lib/queue/service.ts`: `BatchQueueService` high-level facade for API routes and UI.
6. `src/app/api/batch/route.ts`: Handler for `POST /api/batch` (batch creation).
7. `src/app/api/batch/[id]/route.ts`: Handler for `GET /api/batch/:id` (polling progress).
8. `src/app/api/batch/[id]/cancel/route.ts`: Handler for `POST /api/batch/:id/cancel` (user cancellation).
9. `src/components/batch-input-form.tsx`: Responsive multiline URL input, live line counter, deduplication, URL validator.
10. `src/components/batch-queue-view.tsx`: Responsive queue progress monitor, job list, status badges, download triggers, retry buttons.
11. `tests/batch-queue.test.ts`: Vitest suite covering validation, concurrency limits, state transitions, retries, and cancellation.
12. `docs/PHASE-6-BATCH-QUEUE.md`: Comprehensive engineering documentation.
13. `docs/PHASE-6-FINAL-REPORT.md`: Final completion report with metrics.

### 6.2. Files to Modify
1. `src/lib/config.ts`: Add `batch` configuration section (`maxBatchSize`, `concurrency`, `maxAttempts`, `rateLimit`).
2. `src/lib/types/errors.ts`: Add `BATCH_TOO_LARGE`, `BATCH_NOT_FOUND`, `BATCH_CANCELLED` error definitions.
3. `src/lib/rate-limit/rate-limiter.ts`: Add support for `'batch'` rate limiting action.
4. `src/app/page.tsx`: Add Mode Toggle (Single URL vs Batch Mode), embed responsive batch components, ensure seamless mobile/tablet/desktop experience.
5. `docs/FEATURE-ROADMAP.md`: Update Phase 6 status from LATER to COMPLETED.

---

## 7. Audit Sign-Off
This audit confirms that Phase 6 will be built cleanly on top of existing architecture without regressions, using persistent disk storage, strict concurrency controls, and full cryptographic security. Implementation may now proceed.
