/**
 * Tempelink Admin — Database Layer
 *
 * Manages all admin-related DB tables using the same raw `pg` pool pattern
 * as postgres-store.ts and analytics/db.ts.
 *
 * Tables:
 *   tempelink_download_logs      — request activity
 *   tempelink_admin_sessions     — admin session tokens
 *   tempelink_admin_access_logs  — audit log (login/logout events)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminPool: any = null;
let _schemaInitialized = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminPool(): Promise<any> {
  if (_adminPool) return _adminPool;

  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured in environment variables');

  const moduleName = 'pg';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg: any = await import(/* webpackIgnore: true */ moduleName);
  const Pool = pg.Pool || pg.default?.Pool;
  if (!Pool) throw new Error('pg Pool not found');

  _adminPool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });

  return _adminPool;
}

export async function initAdminSchema(): Promise<void> {
  if (_schemaInitialized) return;
  const pool = await getAdminPool();

  await pool.query(`
    -- Download activity log
    CREATE TABLE IF NOT EXISTS tempelink_download_logs (
      id              BIGSERIAL PRIMARY KEY,
      url             TEXT NOT NULL,
      platform        VARCHAR(64),
      downloader_type VARCHAR(32),
      status          VARCHAR(16) NOT NULL DEFAULT 'pending',
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_dl_logs_created_at
      ON tempelink_download_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dl_logs_platform
      ON tempelink_download_logs(platform);
    CREATE INDEX IF NOT EXISTS idx_dl_logs_status
      ON tempelink_download_logs(status);
    CREATE INDEX IF NOT EXISTS idx_dl_logs_composite
      ON tempelink_download_logs(platform, status, created_at DESC);

    -- Admin sessions (httpOnly cookie approach)
    CREATE TABLE IF NOT EXISTS tempelink_admin_sessions (
      id         VARCHAR(64) PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Admin access audit log
    CREATE TABLE IF NOT EXISTS tempelink_admin_access_logs (
      id         BIGSERIAL PRIMARY KEY,
      action     VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  _schemaInitialized = true;
}

// ─── Download Log ────────────────────────────────────────────────────────────

export interface DownloadLogRow {
  id: string;
  url: string;
  platform: string | null;
  downloader_type: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Creates a new pending download log entry.
 * Returns the auto-generated log ID.
 */
export async function createDownloadLog(opts: {
  url: string;
  platform?: string | null;
  downloaderType?: string | null;
}): Promise<string> {
  await initAdminSchema();
  const pool = await getAdminPool();

  const result = await pool.query(
    `INSERT INTO tempelink_download_logs (url, platform, downloader_type, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [opts.url, opts.platform ?? null, opts.downloaderType ?? null]
  );

  return String(result.rows[0].id);
}

/**
 * Updates a download log entry to success or failed with a timestamp.
 */
export async function updateDownloadLog(
  id: string,
  status: 'success' | 'failed',
  errorMessage?: string | null
): Promise<void> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();

    await pool.query(
      `UPDATE tempelink_download_logs
       SET status = $1,
           error_message = $2,
           completed_at = NOW()
       WHERE id = $3`,
      [status, errorMessage ?? null, id]
    );
  } catch {
    // Non-fatal — do not crash the downloader for analytics failure
  }
}

/**
 * Updates a download log entry with full metadata (platform, type, status).
 */
export async function updateDownloadLogFull(
  id: string,
  status: 'success' | 'failed',
  opts: {
    platform?: string | null;
    downloaderType?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();

    await pool.query(
      `UPDATE tempelink_download_logs
       SET status = $1,
           platform = COALESCE($2, platform),
           downloader_type = COALESCE($3, downloader_type),
           error_message = $4,
           completed_at = NOW()
       WHERE id = $5`,
      [status, opts.platform ?? null, opts.downloaderType ?? null, opts.errorMessage ?? null, id]
    );
  } catch {
    // Non-fatal
  }
}


// ─── Stats / Aggregation ─────────────────────────────────────────────────────

export type Period = 'today' | 'week' | 'month' | 'year' | 'all';

function periodSql(period: Period): string {
  switch (period) {
    case 'today':
      return `created_at >= NOW() AT TIME ZONE 'Asia/Jakarta' - INTERVAL '0 days'
              AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
    case 'week':
      return `created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
    case 'month':
      return `created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
    case 'year':
      return `created_at >= DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
    default:
      return '1=1';
  }
}

export interface DownloadStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}

export async function getDownloadStats(
  period: Period,
  platform?: string | null
): Promise<DownloadStats> {
  await initAdminSchema();
  const pool = await getAdminPool();

  const platformClause = platform && platform !== 'all'
    ? `AND platform = '${platform.replace(/'/g, "''")}'`
    : '';

  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE 1=1)::int                   AS total,
      COUNT(*) FILTER (WHERE status = 'success')::int    AS success,
      COUNT(*) FILTER (WHERE status = 'failed')::int     AS failed,
      COUNT(*) FILTER (WHERE status = 'pending')::int    AS pending
    FROM tempelink_download_logs
    WHERE ${periodSql(period)} ${platformClause}
  `);

  const row = result.rows[0];
  const total = Number(row.total);
  const success = Number(row.success);
  const failed = Number(row.failed);
  const pending = Number(row.pending);
  const completed = success + failed;
  const successRate = completed > 0 ? Math.round((success / completed) * 10000) / 100 : 0;

  return { total, success, failed, pending, successRate };
}

export interface PlatformCount {
  platform: string;
  count: number;
}

export async function getPlatformSummary(period: Period): Promise<PlatformCount[]> {
  await initAdminSchema();
  const pool = await getAdminPool();

  const result = await pool.query(`
    SELECT COALESCE(platform, 'other') AS platform, COUNT(*)::int AS count
    FROM tempelink_download_logs
    WHERE ${periodSql(period)}
    GROUP BY platform
    ORDER BY count DESC
    LIMIT 20
  `);

  return result.rows.map((r: { platform: string; count: number }) => ({
    platform: r.platform,
    count: Number(r.count),
  }));
}

// ─── Download Log List / Search / Filter ─────────────────────────────────────

export interface ListDownloadsOptions {
  period: Period;
  platform?: string | null;
  status?: string | null;
  downloaderType?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
}

export interface ListDownloadsResult {
  rows: DownloadLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listDownloadLogs(
  opts: ListDownloadsOptions
): Promise<ListDownloadsResult> {
  await initAdminSchema();
  const pool = await getAdminPool();

  const params: (string | number)[] = [];
  const conditions: string[] = [];

  // Period or custom date range
  if (opts.dateFrom && opts.dateTo) {
    params.push(opts.dateFrom, opts.dateTo);
    conditions.push(`created_at BETWEEN $${params.length - 1} AND $${params.length}`);
  } else {
    conditions.push(periodSql(opts.period));
  }

  if (opts.platform && opts.platform !== 'all') {
    params.push(opts.platform);
    conditions.push(`platform = $${params.length}`);
  }

  if (opts.status && opts.status !== 'all') {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }

  if (opts.downloaderType && opts.downloaderType !== 'all') {
    params.push(opts.downloaderType);
    conditions.push(`downloader_type = $${params.length}`);
  }

  if (opts.search && opts.search.trim()) {
    params.push(`%${opts.search.trim()}%`);
    conditions.push(`url ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tempelink_download_logs ${where}`,
    params
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  // Paginate
  const offset = (opts.page - 1) * opts.pageSize;
  params.push(opts.pageSize, offset);

  const rowsResult = await pool.query(
    `SELECT id, url, platform, downloader_type, status, error_message,
            created_at AT TIME ZONE 'Asia/Jakarta' AS created_at,
            completed_at AT TIME ZONE 'Asia/Jakarta' AS completed_at
     FROM tempelink_download_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    rows: rowsResult.rows,
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.ceil(total / opts.pageSize),
  };
}

export async function getDistinctPlatforms(): Promise<string[]> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();
    const result = await pool.query(
      `SELECT DISTINCT platform FROM tempelink_download_logs
       WHERE platform IS NOT NULL ORDER BY platform`
    );
    return result.rows.map((r: { platform: string }) => r.platform);
  } catch {
    return [];
  }
}

export async function getDistinctDownloaderTypes(): Promise<string[]> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();
    const result = await pool.query(
      `SELECT DISTINCT downloader_type FROM tempelink_download_logs
       WHERE downloader_type IS NOT NULL ORDER BY downloader_type`
    );
    return result.rows.map((r: { downloader_type: string }) => r.downloader_type);
  } catch {
    return [];
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function exportDownloadsCsv(
  opts: Omit<ListDownloadsOptions, 'page' | 'pageSize'>
): Promise<DownloadLogRow[]> {
  await initAdminSchema();
  const pool = await getAdminPool();

  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (opts.dateFrom && opts.dateTo) {
    params.push(opts.dateFrom, opts.dateTo);
    conditions.push(`created_at BETWEEN $${params.length - 1} AND $${params.length}`);
  } else {
    conditions.push(periodSql(opts.period));
  }

  if (opts.platform && opts.platform !== 'all') {
    params.push(opts.platform);
    conditions.push(`platform = $${params.length}`);
  }

  if (opts.status && opts.status !== 'all') {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }

  if (opts.downloaderType && opts.downloaderType !== 'all') {
    params.push(opts.downloaderType);
    conditions.push(`downloader_type = $${params.length}`);
  }

  if (opts.search && opts.search.trim()) {
    params.push(`%${opts.search.trim()}%`);
    conditions.push(`url ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT id, url, platform, downloader_type, status, error_message,
            (created_at AT TIME ZONE 'Asia/Jakarta')::text AS created_at,
            (completed_at AT TIME ZONE 'Asia/Jakarta')::text AS completed_at
     FROM tempelink_download_logs ${where}
     ORDER BY created_at DESC
     LIMIT 10000`,
    params
  );

  return result.rows;
}

// ─── Admin Sessions ───────────────────────────────────────────────────────────

export async function createAdminSession(sessionId: string, ttlHours = 8): Promise<void> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();

    await pool.query(
      `INSERT INTO tempelink_admin_sessions (id, expires_at)
       VALUES ($1, NOW() + INTERVAL '${ttlHours} hours')
       ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [sessionId]
    );
  } catch (err) {
    console.warn('[Admin DB] Failed to record admin session to DB:', err instanceof Error ? err.message : String(err));
  }
}

export async function validateAdminSession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    await initAdminSchema();
    const pool = await getAdminPool();

    const result = await pool.query(
      `SELECT id FROM tempelink_admin_sessions
       WHERE id = $1 AND expires_at > NOW()`,
      [sessionId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function deleteAdminSession(sessionId: string): Promise<void> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();
    await pool.query('DELETE FROM tempelink_admin_sessions WHERE id = $1', [sessionId]);
  } catch {
    // ignore
  }
}

// ─── Admin Access Log ─────────────────────────────────────────────────────────

export type AdminAction = 'login_success' | 'login_failed' | 'logout';

export async function logAdminAccess(action: AdminAction): Promise<void> {
  try {
    await initAdminSchema();
    const pool = await getAdminPool();
    await pool.query(
      'INSERT INTO tempelink_admin_access_logs (action) VALUES ($1)',
      [action]
    );
  } catch {
    // Non-fatal
  }
}
