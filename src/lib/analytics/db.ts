/**
 * Tempelink Analytics — Database Layer
 *
 * Uses the same raw `pg` pool pattern as the existing postgres-store.ts.
 * No new database provider. No Prisma required.
 * Privacy-first: stores only platform + timestamp. No URLs, IPs, or tokens.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;
let _initialized = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPool(): Promise<any> {
  if (_pool) return _pool;

  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    const moduleName = 'pg';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pg: any = await import(/* webpackIgnore: true */ moduleName);
    const Pool = pg.Pool || pg.default?.Pool;
    if (!Pool) throw new Error('PostgreSQL Pool constructor not found');

    _pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    return _pool;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Analytics DB connection failed: ${msg.replace(/postgresql?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@')}`);
  }
}

export async function initAnalyticsSchema(): Promise<void> {
  if (_initialized) return;

  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tempelink_download_events (
      id          BIGSERIAL PRIMARY KEY,
      idempotency_key VARCHAR(256) UNIQUE NOT NULL,
      platform    VARCHAR(64),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_dl_events_created_at
      ON tempelink_download_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dl_events_platform
      ON tempelink_download_events(platform);
  `);

  _initialized = true;
}

/**
 * Records a successful download event exactly once.
 * Uses idempotency_key (derived from the verified token signature) to prevent
 * double-counting retries, React re-renders, and concurrent requests.
 *
 * Returns true if a new event was inserted, false if it was a duplicate.
 */
export async function recordDownloadEvent(opts: {
  idempotencyKey: string;
  platform?: string;
}): Promise<boolean> {
  await initAnalyticsSchema();
  const pool = await getPool();

  try {
    const result = await pool.query(
      `INSERT INTO tempelink_download_events (idempotency_key, platform)
       VALUES ($1, $2)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [opts.idempotencyKey, opts.platform ?? null]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    // Non-fatal: analytics failure must not break the download
    return false;
  }
}

/**
 * Returns the total number of successful download events.
 * Uses COUNT(*) — O(1) with the table's internal stats for small-to-medium datasets.
 */
export async function getTotalDownloads(): Promise<number> {
  await initAnalyticsSchema();
  const pool = await getPool();

  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM tempelink_download_events'
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}
