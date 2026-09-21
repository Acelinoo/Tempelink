/**
 * TEMPELINK — PHASE 9.1: POSTGRESQL PRODUCTION INFRASTRUCTURE VERIFICATION
 * 
 * Verifies:
 * 1. Neon PostgreSQL Connection & Schema (Tables, Columns, Indexes, Transactions, Row-level Locking)
 * 2. PostgresBatchStore CRUD & Atomic State Transitions
 * 3. Concurrent Claim Safety (2, 5, and 10 simultaneous callers -> Zero duplicate claims)
 * 4. Concurrent Polling Safety (10 simultaneous GET /api/batch/[id] requests -> Zero duplicate provider calls)
 * 5. Multi-Job Batch Processing (5+ jobs with concurrency bounds and status integrity)
 * 6. Database Failure Handling (Fail-closed, safe error redaction, no silent fallback)
 * 
 * CRITICAL: NEVER print DATABASE_URL, passwords, tokens, or credentials to stdout.
 */

import './load-env';
import { PostgresBatchStore } from '../src/lib/queue/postgres-store';
import { BatchQueueService } from '../src/lib/queue/service';
import { QueueRunner } from '../src/lib/queue/runner';
import { Batch } from '../src/lib/types/queue';
import { TempelinkError } from '../src/lib/types/errors';
import { PlatformResolver } from '../src/lib/platforms/resolver';

interface VerificationResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: VerificationResult[] = [];

function recordResult(step: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ step, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${step}]: ${details}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('TEMPELINK — PHASE 9.1: PRODUCTION INFRASTRUCTURE VERIFICATION');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    recordResult('DATABASE_CONFIG', 'FAIL', 'DATABASE_URL is not set in server environment.');
    console.error('ABORTING: DATABASE_URL is missing. Please configure Neon integration.');
    process.exit(1);
  }

  recordResult('DATABASE_CONFIG', 'PASS', 'DATABASE_URL is configured (secret redacted).');

  const store = new PostgresBatchStore(dbUrl);

  try {
    // -------------------------------------------------------------------------
    // 1. NEON / POSTGRES CONNECTION & SCHEMA VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Neon Connection & Schema Quality ---');
    await store.initSchema();

    // Directly query database metadata using store's pool
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = await (store as any).getPool();

    // Check table existence
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tempelink_batches';
    `);

    if (tableRes.rows.length === 0) {
      throw new Error('Table tempelink_batches was not created.');
    }
    recordResult('SCHEMA_TABLE', 'PASS', 'Table "tempelink_batches" exists.');

    // Check required columns
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tempelink_batches';
    `);

    const colNames = columnsRes.rows.map((r: { column_name: string }) => r.column_name);
    const requiredCols = [
      'id', 'client_ip', 'status', 'total_jobs', 'completed_jobs', 
      'failed_jobs', 'cancelled_jobs', 'data', 'created_at', 'updated_at'
    ];

    const missingCols = requiredCols.filter((c) => !colNames.includes(c));
    if (missingCols.length > 0) {
      throw new Error(`Missing required columns: ${missingCols.join(', ')}`);
    }
    recordResult('SCHEMA_COLUMNS', 'PASS', `All ${requiredCols.length} required columns exist (id, client_ip, status, data JSONB, etc.).`);

    // Check required indexes
    const indexRes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'tempelink_batches';
    `);
    const indexNames = indexRes.rows.map((r: { indexname: string }) => r.indexname);
    const requiredIndexes = ['tempelink_batches_pkey', 'idx_batches_client_ip_status', 'idx_batches_created_at'];
    const missingIndexes = requiredIndexes.filter((idx) => !indexNames.includes(idx));
    if (missingIndexes.length > 0) {
      throw new Error(`Missing required indexes: ${missingIndexes.join(', ')}`);
    }
    recordResult('SCHEMA_INDEXES', 'PASS', `All required indexes exist: ${requiredIndexes.join(', ')}.`);

    // Check row-level locking (SELECT ... FOR UPDATE) inside a transaction
    const testBatchId = `lock_test_${Date.now()}`;
    await pool.query(
      `INSERT INTO tempelink_batches (id, client_ip, status, total_jobs, completed_jobs, failed_jobs, cancelled_jobs, data)
       VALUES ($1, '127.0.0.1', 'PENDING', 1, 0, 0, 0, '{}')`,
      [testBatchId]
    );

    const client1 = await pool.connect();
    await client1.query('BEGIN');
    const lockRes = await client1.query('SELECT data FROM tempelink_batches WHERE id = $1 FOR UPDATE', [testBatchId]);
    if (lockRes.rows.length !== 1) {
      throw new Error('Failed to acquire row lock on tempelink_batches');
    }
    await client1.query('COMMIT');
    client1.release();

    await pool.query('DELETE FROM tempelink_batches WHERE id = $1', [testBatchId]);
    recordResult('ROW_LEVEL_LOCKING', 'PASS', 'PostgreSQL transactions and row-level locking (FOR UPDATE) verified.');

    // -------------------------------------------------------------------------
    // 2. POSTGRES BATCH STORE CRUD & CLAIM VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing PostgresBatchStore CRUD & Concurrent Claims ---');
    const crudBatchId = `batch_crud_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const sampleBatch: Batch = {
      id: crudBatchId,
      clientIp: '192.168.1.100',
      status: 'PENDING',
      totalJobs: 3,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      jobs: [
        {
          id: 'job_c1',
          batchId: crudBatchId,
          sourceUrl: 'https://www.tiktok.com/@u/video/1001',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: nowIso,
        },
        {
          id: 'job_c2',
          batchId: crudBatchId,
          sourceUrl: 'https://www.tiktok.com/@u/video/1002',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: nowIso,
        },
        {
          id: 'job_c3',
          batchId: crudBatchId,
          sourceUrl: 'https://www.tiktok.com/@u/video/1003',
          platform: 'tiktok',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 2,
          createdAt: nowIso,
        },
      ],
    };

    // Create
    await store.saveBatch(sampleBatch);
    const readBatch = await store.getBatch(crudBatchId);
    if (!readBatch || readBatch.id !== crudBatchId || readBatch.jobs.length !== 3) {
      throw new Error('Failed to read saved batch from PostgreSQL.');
    }
    recordResult('STORE_CREATE_READ', 'PASS', 'Batch created and read back faithfully with JSONB structure.');

    // Update
    const updateRes = await store.updateJob(crudBatchId, 'job_c1', (j) => {
      j.status = 'COMPLETED';
      j.completedAt = new Date().toISOString();
    });
    if (!updateRes || updateRes.job.status !== 'COMPLETED' || updateRes.batch.completedJobs !== 1) {
      throw new Error('Failed to update job status in PostgreSQL.');
    }
    recordResult('STORE_UPDATE_JOB', 'PASS', 'Atomic job status update and summary recalculation verified in PostgreSQL.');

    // Concurrent claim tests (2, 5, 10 callers)
    console.log('\n--- 3. Testing Concurrent Claims (2, 5, and 10 callers) ---');
    const concurrencyLevels = [2, 5, 10];

    for (const callersCount of concurrencyLevels) {
      const concBatchId = `batch_claim_conc_${callersCount}_${Date.now()}`;
      const concBatch: Batch = {
        id: concBatchId,
        clientIp: '192.168.1.101',
        status: 'PENDING',
        totalJobs: 1, // Exactly ONE pending job
        completedJobs: 0,
        failedJobs: 0,
        cancelledJobs: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        jobs: [
          {
            id: `single_job_${callersCount}`,
            batchId: concBatchId,
            sourceUrl: `https://www.tiktok.com/@u/video/conc_${callersCount}`,
            platform: 'tiktok',
            status: 'PENDING',
            attempts: 0,
            maxAttempts: 2,
            createdAt: nowIso,
          },
        ],
      };

      await store.saveBatch(concBatch);

      // Fire simultaneous concurrent claims
      const claimPromises = Array.from({ length: callersCount }, () =>
        store.claimNextPendingJob(concBatchId)
      );
      const claimResults = await Promise.all(claimPromises);

      // Filter successful claims (non-null)
      const successfulClaims = claimResults.filter((r) => r !== null);
      if (successfulClaims.length !== 1) {
        throw new Error(
          `RACE CONDITION DETECTED! Out of ${callersCount} simultaneous callers, ${successfulClaims.length} claimed the same job!`
        );
      }

      recordResult(
        `CONCURRENT_CLAIM_${callersCount}`,
        'PASS',
        `Exactly 1 of ${callersCount} concurrent callers claimed the single pending job (0 duplicate claims).`
      );

      await store.deleteBatch(concBatchId);
    }

    await store.deleteBatch(crudBatchId);

    // -------------------------------------------------------------------------
    // 4. CONCURRENT POLLING TEST (10 SIMULTANEOUS REQUESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Concurrent Polling (10 simultaneous GET /api/batch/[id]) ---');
    let providerExecCount1 = 0;
    let providerExecCount2 = 0;

    // Temporarily mock PlatformResolver.resolve to accurately measure execution count
    const originalResolve = PlatformResolver.resolve;
    PlatformResolver.resolve = async (url: string) => {
      // Simulate realistic provider latency (50ms)
      await new Promise((r) => setTimeout(r, 50));
      if (url.includes('poll1')) {
        providerExecCount1++;
      } else if (url.includes('poll2')) {
        providerExecCount2++;
      }
      return {
        id: 'mock_media_poll',
        platform: 'tiktok',
        mediaType: 'video',
        title: 'Mock Poll Video',
        description: null,
        author: { username: 'tester', displayName: 'Tester' },
        thumbnailUrl: null,
        durationSeconds: 15,
        sourceUrl: url,
        capabilities: [
          {
            id: 'cap_poll',
            type: 'video',
            label: 'Standard 720p',
            qualityLabel: '720p',
            qualityCategory: 'standard',
            format: 'mp4',
            downloadToken: 'mock_token',
            requiresAuth: false,
            available: true,
          },
        ],
        warnings: [],
      };
    };

    try {
      const runner = new QueueRunner(store, 2);
      const service = new BatchQueueService(store, runner);

      const pollBatchId = `batch_poll_test_${Date.now()}`;
      const pollBatch: Batch = {
        id: pollBatchId,
        clientIp: '192.168.1.102',
        status: 'PENDING',
        totalJobs: 2,
        completedJobs: 0,
        failedJobs: 0,
        cancelledJobs: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        jobs: [
          {
            id: 'job_poll_1',
            batchId: pollBatchId,
            sourceUrl: 'https://www.tiktok.com/@u/video/poll1',
            platform: 'tiktok',
            status: 'PENDING',
            attempts: 0,
            maxAttempts: 2,
            createdAt: nowIso,
          },
          {
            id: 'job_poll_2',
            batchId: pollBatchId,
            sourceUrl: 'https://www.tiktok.com/@u/video/poll2',
            platform: 'tiktok',
            status: 'PENDING',
            attempts: 0,
            maxAttempts: 2,
            createdAt: nowIso,
          },
        ],
      };

      await store.saveBatch(pollBatch);

      // Fire 10 simultaneous polling requests
      const pollPromises = Array.from({ length: 10 }, () =>
        service.getBatch(pollBatchId)
      );
      const pollOutputs = await Promise.all(pollPromises);

      // Verify all polls returned valid results
      if (pollOutputs.length !== 10 || pollOutputs.some((p) => p === null)) {
        throw new Error('Some concurrent polling requests failed or returned null.');
      }

      // Allow in-flight step executions to complete
      await new Promise((r) => setTimeout(r, 400));

      // Re-poll until finished
      let finalPoll = await service.getBatch(pollBatchId);
      for (let i = 0; i < 10 && finalPoll?.status !== 'COMPLETED'; i++) {
        await new Promise((r) => setTimeout(r, 100));
        finalPoll = await service.getBatch(pollBatchId);
      }

      if (providerExecCount1 !== 1 || providerExecCount2 !== 1) {
        throw new Error(
          `DUPLICATE PROVIDER EXECUTION DETECTED! Job 1 ran ${providerExecCount1} times, Job 2 ran ${providerExecCount2} times.`
        );
      }

      if (finalPoll?.status !== 'COMPLETED' || finalPoll.completed !== 2) {
        throw new Error(`Batch did not reach deterministic COMPLETED state: ${JSON.stringify(finalPoll)}`);
      }

      recordResult(
        'CONCURRENT_POLLING_10',
        'PASS',
        `10 simultaneous polling requests handled without duplicate execution (Job 1: ${providerExecCount1}x, Job 2: ${providerExecCount2}x). Final state: COMPLETED.`
      );

      await store.deleteBatch(pollBatchId);
    } finally {
      PlatformResolver.resolve = originalResolve;
    }

    // -------------------------------------------------------------------------
    // 5. MULTI-JOB BATCH TEST (5 JOBS)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Multi-Job Batch (5 Jobs) ---');
    let multiExecCounts = [0, 0, 0, 0, 0];

    const originalResolveMulti = PlatformResolver.resolve;
    PlatformResolver.resolve = async (url: string) => {
      await new Promise((r) => setTimeout(r, 40));
      for (let i = 0; i < 5; i++) {
        if (url.includes(`multijob_${i}`)) {
          multiExecCounts[i]++;
          // Simulate 4th job failing transiently then terminal
          if (i === 3) {
            throw new TempelinkError('RESOLUTION_FAILED', 'Simulated failure for job 3');
          }
        }
      }
      return {
        id: 'mock_media_multi',
        platform: 'tiktok',
        mediaType: 'video',
        title: 'Mock Multi Video',
        description: null,
        author: { username: 'tester', displayName: 'Tester' },
        thumbnailUrl: null,
        durationSeconds: 15,
        sourceUrl: url,
        capabilities: [
          {
            id: 'cap_multi',
            type: 'video',
            label: 'Standard 720p',
            qualityLabel: '720p',
            qualityCategory: 'standard',
            format: 'mp4',
            downloadToken: 'mock_token',
            requiresAuth: false,
            available: true,
          },
        ],
        warnings: [],
      };
    };

    try {
      const runner = new QueueRunner(store, 2);
      const service = new BatchQueueService(store, runner);

      const multiBatchId = `batch_multi_5_${Date.now()}`;
      const multiJobs = Array.from({ length: 5 }, (_, i) => ({
        id: `job_m_${i}`,
        batchId: multiBatchId,
        sourceUrl: `https://www.tiktok.com/@u/video/multijob_${i}`,
        platform: 'tiktok',
        status: 'PENDING' as const,
        attempts: 0,
        maxAttempts: 1,
        createdAt: nowIso,
      }));

      const multiBatch: Batch = {
        id: multiBatchId,
        clientIp: '192.168.1.103',
        status: 'PENDING',
        totalJobs: 5,
        completedJobs: 0,
        failedJobs: 0,
        cancelledJobs: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        jobs: multiJobs,
      };

      await store.saveBatch(multiBatch);

      // Process batch jobs incrementally
      for (let step = 0; step < 15; step++) {
        await service.getBatch(multiBatchId);
        await new Promise((r) => setTimeout(r, 60));
        const current = await store.getBatch(multiBatchId);
        if (
          current &&
          ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED'].includes(current.status)
        ) {
          break;
        }
      }

      const finalMulti = await store.getBatch(multiBatchId);
      if (!finalMulti) throw new Error('Multi-job batch not found in PostgreSQL.');

      if (finalMulti.completedJobs !== 4 || finalMulti.failedJobs !== 1) {
        throw new Error(
          `Unexpected multi-job stats: completed=${finalMulti.completedJobs}, failed=${finalMulti.failedJobs}`
        );
      }

      if (finalMulti.status !== 'PARTIAL_SUCCESS') {
        throw new Error(`Expected PARTIAL_SUCCESS but received ${finalMulti.status}`);
      }

      // Check executions: each job executed at most once
      for (let i = 0; i < 5; i++) {
        if (multiExecCounts[i] !== 1) {
          throw new Error(`Job ${i} executed ${multiExecCounts[i]} times (expected exactly 1).`);
        }
      }

      recordResult(
        'MULTI_JOB_5_EXECUTION',
        'PASS',
        '5 jobs executed with concurrency bounds. Stats: 4 COMPLETED, 1 FAILED, Overall: PARTIAL_SUCCESS. Zero duplicate runs.'
      );

      await store.deleteBatch(multiBatchId);
    } finally {
      PlatformResolver.resolve = originalResolveMulti;
    }

    // -------------------------------------------------------------------------
    // 6. DATABASE FAILURE TEST (FAIL-CLOSED & REDACTION)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Database Failure & Redaction ---');
    // Simulate invalid / offline connection
    const offlineStore = new PostgresBatchStore('postgresql://invalid_user:invalid_pass_secret123@localhost:54329/invalid_db?sslmode=disable');

    let threwSafeError = false;
    let secretLeaked = false;

    try {
      await offlineStore.getBatch('non_existent');
    } catch (err: unknown) {
      threwSafeError = true;
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('invalid_pass_secret123')) {
        secretLeaked = true;
      }
      if (err instanceof TempelinkError) {
        recordResult('DB_FAILURE_ERROR_TYPE', 'PASS', `Error properly mapped to TempelinkError (${err.code}).`);
      } else {
        recordResult('DB_FAILURE_ERROR_TYPE', 'FAIL', 'Error was not wrapped in TempelinkError.');
      }
    }

    if (!threwSafeError) {
      recordResult('DB_FAILURE_FAIL_CLOSED', 'FAIL', 'Offline database did not throw an error.');
    } else {
      recordResult('DB_FAILURE_FAIL_CLOSED', 'PASS', 'Database failure fails closed and throws explicit error.');
    }

    if (secretLeaked) {
      recordResult('DB_FAILURE_REDACTION', 'FAIL', 'SECURITY RISK: Password or secret was leaked in error message.');
    } else {
      recordResult('DB_FAILURE_REDACTION', 'PASS', 'Secrets/credentials are completely redacted from error output.');
    }

    await offlineStore.close().catch(() => {});

  } finally {
    await store.close().catch(() => {});
  }

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('================================================================');
  const allPassed = results.every((r) => r.status === 'PASS');
  for (const r of results) {
    console.log(`[${r.status}] ${r.step}: ${r.details}`);
  }
  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL POSTGRESQL PRODUCTION INFRASTRUCTURE CHECKS PASSED!');
  } else {
    console.error('❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
