import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId, checkSession } from '@/lib/admin/auth';
import { getDownloadStats, getPlatformSummary, getDistinctPlatforms, type Period } from '@/lib/admin/db';

const VALID_PERIODS: Period[] = ['today', 'week', 'month', 'year', 'all'];

export async function GET(req: NextRequest) {
  // 1. Validate admin session
  const sessionId = extractSessionId(req.headers.get('cookie'));
  const isAdmin = await checkSession(sessionId);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse query params
  const { searchParams } = req.nextUrl;
  const period = (searchParams.get('period') || 'today') as Period;
  const platform = searchParams.get('platform') || null;

  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ success: false, error: 'Period tidak valid.' }, { status: 400 });
  }

  try {
    const [stats, platformSummary, platforms] = await Promise.all([
      getDownloadStats(period, platform),
      getPlatformSummary(period),
      getDistinctPlatforms(),
    ]);

    return NextResponse.json(
      { success: true, data: { stats, platformSummary, platforms } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Gagal memuat statistik.', detail: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
