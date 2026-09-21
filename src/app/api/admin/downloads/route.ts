import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId, checkSession } from '@/lib/admin/auth';
import { listDownloadLogs, getDistinctDownloaderTypes, type Period } from '@/lib/admin/db';

const VALID_PERIODS: Period[] = ['today', 'week', 'month', 'year', 'all'];
const VALID_STATUSES = ['all', 'pending', 'success', 'failed'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  // 1. Validate admin session
  const sessionId = extractSessionId(req.headers.get('cookie'));
  const isAdmin = await checkSession(sessionId);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse query params with validation
  const { searchParams } = req.nextUrl;

  const period = (searchParams.get('period') || 'today') as Period;
  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ success: false, error: 'Period tidak valid.' }, { status: 400 });
  }

  const platform = searchParams.get('platform') || null;
  const status = searchParams.get('status') || 'all';
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, error: 'Status tidak valid.' }, { status: 400 });
  }

  const downloaderType = searchParams.get('downloaderType') || null;
  const search = searchParams.get('search') || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo = searchParams.get('dateTo') || null;

  let page = parseInt(searchParams.get('page') || '1', 10);
  let pageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  try {
    const [result, downloaderTypes] = await Promise.all([
      listDownloadLogs({ period, platform, status, downloaderType, search, dateFrom, dateTo, page, pageSize }),
      getDistinctDownloaderTypes(),
    ]);

    return NextResponse.json(
      { success: true, data: { ...result, downloaderTypes } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data.', detail: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
