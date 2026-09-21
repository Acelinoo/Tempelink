# Tempelink — Phase 9 Distributed Queue Architecture Decision

**Document Status**: APPROVED & SPECIFIED  
**Topic**: Queue Persistence & Multi-Instance Execution Engine  
**Deployment Target**: Vercel Serverless (Node.js 20+)  
**Date**: September 21, 2026  

---

## 1. Context & Problem Statement

In Phase 6, Tempelink introduced batch downloads using `FileBatchStore`, storing JSON files under `.data/batches/<batchId>.json`.

While this functioned cleanly in local development, deployment to Vercel/serverless environments presents fundamental architectural barriers:
1. **Read-Only Root Filesystem**: Vercel functions cannot write to `.data/` at runtime (`EROFS`).
2. **Ephemeral / Isolated Invocations**: Serverless instances do not share local filesystem state or `/tmp` across invocations or regions.
3. **No Long-Running Background Workers**: Node.js event loops freeze upon sending the HTTP response. A decoupled in-memory worker loop (`scheduleNext`) cannot guarantee job completion across stateless serverless requests.

---

## 2. Evaluation of Candidate Technologies

### Option A: Redis + BullMQ
- **Pros**: Dedicated queue semantics, atomic job popping, built-in delayed retries.
- **Cons**: Requires persistent TCP connection pooling or HTTP proxy (Upstash), heavyweight dependencies, requires running a separate dedicated worker process or container 24/7 to consume jobs from BullMQ. Running a 24/7 background consumer contradicts Vercel serverless architecture unless external worker VMs (e.g. AWS ECS / Render) are maintained.
- **Verdict**: **REJECTED FOR VERCEL SERVERLESS** (Unnecessary operational complexity and extra infrastructure costs).

### Option B: PostgreSQL-Backed Queue (`PostgresBatchStore`)
- **Pros**:
  - Relational ACID transactions (`SELECT ... FOR UPDATE SKIP LOCKED` or atomic state updates).
  - Works natively with serverless connection poolers (Neon, Supabase, Vercel Postgres).
  - Can store both batch metadata and granular queue jobs in relational tables or JSONB columns.
  - Zero additional daemon workers required: jobs can be executed incrementally during client polling cycles or via edge triggers.
- **Cons**: Requires database credentials (`DATABASE_URL`).
- **Verdict**: **RECOMMENDED PRODUCTION ARCHITECTURE**.

### Option C: FileBatchStore (Preserved for Local Development & Testing)
- **Pros**: Zero external dependencies, instant test execution in Vitest, runs locally without PostgreSQL or Docker.
- **Cons**: Not durable across multi-instance serverless deployments.
- **Verdict**: **PRESERVED AS DEFAULT LOCAL DEV STORE**.

---

## 3. Selected Architecture: Pluggable BatchStore Abstraction

We decouple the application layer completely from storage through the `BatchStore` interface:

```typescript
export interface BatchStore {
  saveBatch(batch: Batch): Promise<void>;
  getBatch(id: string): Promise<Batch | null>;
  listBatches(): Promise<Batch[]>;
  getActiveBatchesForClient(clientIp: string): Promise<Batch[]>;
  updateJob(
    batchId: string,
    jobId: string,
    updater: (job: QueueJob) => void
  ): Promise<{ batch: Batch; job: QueueJob } | null>;
  deleteBatch(id: string): Promise<boolean>;
  clearStore(): Promise<void>;
}
```

### Factory Pattern: `getBatchStore()`
```typescript
export function getBatchStore(): BatchStore {
  if (serverConfig.database.url && serverConfig.batch.driver === 'postgres') {
    return new PostgresBatchStore(serverConfig.database.url);
  }
  return new FileBatchStore();
}
```

---

## 4. Serverless Queue Execution Pattern ("Incremental Polling Step")

To guarantee queue jobs make continuous progress on Vercel without a standing background daemon:
1. **Creation**: When `POST /api/batch` is called, the batch is saved in `PENDING` state and the first job resolution is kicked off asynchronously.
2. **Client Polling Trigger**: The frontend polls `GET /api/batch/[id]` every 1.5–2 seconds. In serverless mode, each `GET` request evaluates pending jobs in that batch and executes the next pending job within the function invocation window.
3. **Concurrency & Locking**: Concurrency limit (2) is enforced atomically, preventing race conditions even if multiple browser tabs or clients poll simultaneously.

---

## 5. PostgreSQL Schema Definition

```sql
CREATE TABLE IF NOT EXISTS tempelink_batches (
  id VARCHAR(64) PRIMARY KEY,
  client_ip VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  total_jobs INT NOT NULL,
  completed_jobs INT NOT NULL DEFAULT 0,
  failed_jobs INT NOT NULL DEFAULT 0,
  cancelled_jobs INT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_client_ip_status ON tempelink_batches(client_ip, status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON tempelink_batches(created_at DESC);
```

---

## 6. Operational Environment & Migration

| Setting | Description | Local Dev | Production (Vercel) |
| :--- | :--- | :--- | :--- |
| `BATCH_STORE_DRIVER` | Storage engine selector | `file` | `postgres` |
| `DATABASE_URL` | PostgreSQL connection string | *Optional* | `postgres://user:pass@host/db?sslmode=require` |
| Fallback behavior | If DB fails / unreachable | File store | Fails gracefully with user-friendly Indonesian error |

No credentials are hardcoded. All settings are configurable via environment variables with `.env.example` guidance.
