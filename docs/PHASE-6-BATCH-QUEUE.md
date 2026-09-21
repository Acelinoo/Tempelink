# Tempelink — Phase 6: Batch Download + Queue Specification

## 1. Executive Summary

Phase 6 introduces a high-reliability, asynchronous **Batch Processing and Queue Engine** for Tempelink. It allows users to submit multiple media URLs in a single batch, automatically sanitizes and deduplicates them, assigns persistent queue jobs, and resolves them with controlled concurrency without flooding upstream platform providers.

All downloads strictly leverage Tempelink's established Phase 3 secure download pipeline (HMAC-SHA256 signed tokens, SSRF protection, MIME validation, and stream delivery).

---

## 2. Architecture Overview

The batch queue system follows a modular architecture layered directly over existing services:

```text
User Input (Multiline URLs)
      │
      ▼
Client Validation (Deduplication, Platform Pre-detection)
      │
      ▼
POST /api/batch ──► Rate Limiting (5 batches/min, max 2 active/client)
      │
      ▼
BatchQueueService
  ├── Input normalizer & deduplication (Set<string>)
  ├── Max batch size enforcement (MAX_BATCH_SIZE=10)
  ├── Pre-creation platform detection via PlatformDetector
  └── Batch & Job instantiation
      │
      ▼
FileBatchStore (.data/batches/<batchId>.json)
  └── Per-batch in-memory mutex (withLock) preventing file race conditions
      │
      ▼
QueueRunner (Asynchronous Worker Pool)
  ├── Concurrency controller (QUEUE_CONCURRENCY=2)
  ├── In-flight job tracking (inFlightJobs Set)
  ├── Existing MediaResolver (TikTok, IG, YouTube, X, FB)
  ├── Retry policy with exponential backoff (MAX_JOB_ATTEMPTS=2)
  └── Capability selection (Authentic default capability)
      │
      ▼
Client Polling (GET /api/batch/:id) ──► Deterministic Progress UI
      │
      ▼
Individual Secure Downloads (POST /api/media/download via Signed Tokens)
```

---

## 3. Data Model

The queue data model is fully typed in `src/lib/types/queue.ts`:

### Batch Model
```typescript
interface Batch {
  id: string;                      // UUID v4
  clientIp?: string;              // Client IP for active batch quota enforcement
  status: BatchStatus;            // PENDING | RESOLVING | READY | DOWNLOADING | COMPLETED | FAILED | CANCELLED
  totalJobs: number;              // Total jobs in this batch
  completedJobs: number;          // Jobs with status COMPLETED
  failedJobs: number;             // Jobs with status FAILED
  jobs: QueueJob[];               // List of individual queue jobs
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

### Queue Job Model
```typescript
interface QueueJob {
  id: string;                      // UUID v4
  batchId: string;                 // Parent batch reference
  sourceUrl: string;               // Original input URL
  platform: PlatformId | 'unknown';// Detected platform ID
  status: JobStatus;              // PENDING | RESOLVING | READY | DOWNLOADING | COMPLETED | FAILED | CANCELLED
  capabilityId?: string;           // Selected capability ID
  media?: JobMediaMetadata;        // Resolved media details & download tokens
  attempts: number;                // Execution attempt count
  errorCode?: string;              // Normalized error code on failure
  errorMessage?: string;           // Localized user-friendly error message
  createdAt: string;              // ISO timestamp
  startedAt?: string;             // ISO timestamp
  completedAt?: string;           // ISO timestamp
}
```

---

## 4. State Machine & Transitions

### Job State Machine
```text
               ┌───────────────┐
               │    PENDING    │◄──────────┐
               └───────┬───────┘           │ Retry (attempts < maxAttempts)
                       │                   │
                       ▼                   │
               ┌───────────────┐           │
               │   RESOLVING   │───────────┤
               └───────┬───────┘           │
                       │                   │
         ┌─────────────┴─────────────┐     │
         ▼                           ▼     │
  ┌─────────────┐             ┌────────────┴┐
  │    READY    │             │   FAILED    │
  └──────┬──────┘             └─────────────┘
         │
         ▼
  ┌─────────────┐
  │ DOWNLOADING │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  COMPLETED  │
  └─────────────┘

Cancellation Path:
PENDING  ─► CANCELLED
READY    ─► CANCELLED
```

### Valid Job State Transitions
| From State | To State | Trigger / Condition |
| :--- | :--- | :--- |
| `PENDING` | `RESOLVING` | Worker claims job from queue |
| `PENDING` | `CANCELLED` | User cancels batch |
| `RESOLVING` | `READY` | Provider resolves successfully with capabilities |
| `RESOLVING` | `FAILED` | Provider returns fatal error or retries exhausted |
| `RESOLVING` | `PENDING` | Transient failure with retries remaining |
| `READY` | `DOWNLOADING`| User initiates download |
| `READY` | `CANCELLED` | User cancels batch |
| `DOWNLOADING`| `COMPLETED` | Download stream delivered successfully |
| `DOWNLOADING`| `FAILED` | Download stream failure |
| `FAILED` | `PENDING` | User explicitly triggers manual retry |

---

## 5. Controlled Concurrency

To prevent IP blacklisting, rate limiting, and resource starvation across third-party media providers:
- `QUEUE_CONCURRENCY`: Default `2` (configurable via `QUEUE_CONCURRENCY` environment variable).
- Unbounded `Promise.all()` is strictly prohibited across batches.
- Concurrency slots are managed via an asynchronous worker pool pattern in `src/lib/queue/runner.ts`.
- `inFlightJobs: Set<string>` guarantees that no pending job is claimed by multiple concurrent workers before its status is written to disk.
- Worker releases slot immediately upon job completion or failure, picking up the next pending job.

---

## 6. Retry Policy & Transient Errors

- `MAX_JOB_ATTEMPTS`: Default `2` (configurable via `MAX_JOB_ATTEMPTS`).
- Only **transient errors** are eligible for automated retry:
  - `TEMPORARY_FAILURE` / upstream timeouts
  - Network connection resets (`ECONNRESET`, `ETIMEDOUT`)
  - HTTP 502/503/504 Bad Gateway / Service Unavailable
- **Permanent errors are NEVER retried**:
  - `INVALID_URL`
  - `UNSUPPORTED_PLATFORM`
  - `PROVIDER_NOT_CONFIGURED`
  - `CONTENT_UNAVAILABLE` (e.g. private posts, removed videos, Pinterest blocker)
  - `MEDIA_UNAVAILABLE`
  - `SSRF_BLOCKED`
  - `RATE_LIMITED`
- Retries employ backoff delay (`attempt * 1000ms`) to allow upstream provider recovery.

---

## 7. Rate Limiting & Abuse Protection

Batch mode introduces increased operational load. Defense in depth is applied:
1. **Batch Submission Rate Limit**: Max 5 batch creations per minute per client IP (via sliding-window in-memory rate limiter).
2. **Active Batch Quota**: Max 2 active (`PENDING` or `RESOLVING`) batches simultaneously per client IP. Excess submissions are rejected with `BATCH_LIMIT_EXCEEDED` (HTTP 429).
3. **Maximum Batch Size**: Strict ceiling of 10 URLs (`MAX_BATCH_SIZE=10`). Over-limit submissions return `BATCH_TOO_LARGE` (HTTP 400).
4. **Underlying Download Rate Limits**: Each downloaded capability consumes standard rate-limit budget at `/api/media/download`.

---

## 8. API Contract

### 8.1 Create Batch
- **Endpoint**: `POST /api/batch`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "urls": [
      "https://www.tiktok.com/@user/video/1234567890",
      "https://www.instagram.com/reel/Cxxxxxx/"
    ]
  }
  ```
- **Response (HTTP 201 Created)**:
  ```json
  {
    "batchId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING",
    "total": 2
  }
  ```
- **Error Codes**: `BATCH_TOO_LARGE` (400), `INVALID_URL` (400), `BATCH_LIMIT_EXCEEDED` (429), `RATE_LIMITED` (429).

### 8.2 Get Batch Status
- **Endpoint**: `GET /api/batch/:id`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "READY",
    "totalJobs": 2,
    "completedJobs": 1,
    "failedJobs": 0,
    "progress": {
      "pending": 0,
      "resolving": 0,
      "ready": 1,
      "downloading": 0,
      "completed": 1,
      "failed": 0,
      "cancelled": 0
    },
    "jobs": [ ... ],
    "createdAt": "2026-09-21T09:00:00.000Z",
    "updatedAt": "2026-09-21T09:00:05.000Z"
  }
  ```

### 8.3 Cancel Batch
- **Endpoint**: `POST /api/batch/:id/cancel`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "batchId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CANCELLED"
  }
  ```
- **Semantics**: Cancels all `PENDING` and `READY` jobs. Jobs that are already `COMPLETED` are preserved.

### 8.4 Retry Job
- **Endpoint**: `POST /api/batch/:id/retry`
- **Request Body**: `{ "jobId": "..." }`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "jobId": "..."
  }
  ```

---

## 9. Security Considerations

- **No Bypass of SSRF Protection**: All upstream downloads must generate valid HMAC-SHA256 download tokens validated by `src/lib/security/ssrf.ts` and `src/lib/security/token.ts`.
- **No In-Memory-Only Queue**: Batches and jobs persist to disk (`.data/batches/<batchId>.json`). Process restarts do not corrupt running states.
- **Mutex Concurrency Protection**: Per-batch asynchronous locks ensure multiple concurrent worker threads cannot write conflicting JSON files simultaneously on Windows or POSIX filesystems.
- **No Credentials Leaked**: Upstream RapidAPI keys, hosts, and tokens are never serialized into batch job objects returned to client browsers.

---

## 10. UI & Responsive Design

- **Modes**: Tabbed navigation between "Tautan Tunggal" and "Batch & Antrean".
- **Multiline Input**: Real-time line-by-line validation, live URL deduplication pill counters, platform badge detection preview, and auto-paste support.
- **Queue Monitor**: Deterministic progress counter (`X / Y Selesai`), localized Indonesian status badges (`Menunggu`, `Memproses`, `Siap diunduh`, `Mengunduh`, `Selesai`, `Gagal`, `Dibatalkan`).
- **Responsive Layout**: Designed for mobile (`375px+`), tablet (`768px+`), and desktop (`1024px+`) with flexible wrapping, horizontal scrolling tables for job cards, and mobile-friendly tap targets.
- **Polling Discipline**: Polls every 2 seconds during active processing and automatically terminates polling when the batch reaches a terminal state (`READY`, `COMPLETED`, `FAILED`, `CANCELLED`).

---

## 11. Verification & Test Results

- **Unit & Integration Tests**: 144/144 tests PASS across 14 test suites.
- **TypeScript Type Checking**: PASS (0 errors).
- **ESLint**: PASS (0 warnings, 0 errors).
- **Production Build (`next build`)**: PASS (All 4 batch API routes compiled).
- **Live Provider Verification**:
  - TikTok: PASS (Live resolve + range download stream 206)
  - Instagram: PASS (Live resolve + range download stream 206)
  - YouTube: PASS (Live resolve + range download stream 206)
  - X / Twitter: PASS (Live resolve + range download stream 206)
  - Facebook: PASS (Live resolve + range download stream 206)
  - Pinterest: BLOCKED / `CONTENT_UNAVAILABLE` (Upstream provider defect accurately reported, not faked)

---

## 12. Known Limitations & Future Work

1. **ZIP Packaging**: Batch mode currently delivers individual secure downloads. Client-side or server-side ZIP packaging will be considered in future phases once streaming egress and memory bounds are benchmarked.
2. **External Distributed Queue**: The file-based persistent store (`FileBatchStore`) provides zero-dependency durability for single-instance deployments. Distributed setups (multi-container) in later phases may bridge this store to Redis/PostgreSQL.
