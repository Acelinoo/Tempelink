import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId, checkSession } from '@/lib/admin/auth';
import { exportDownloadsCsv, type Period } from '@/lib/admin/db';

const VALID_PERIODS: Period[] = ['today', 'week', 'month', 'year', 'all'];

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  // 1. Validate admin session
  const sessionId = extractSessionId(req.headers.get('cookie'));
  const isAdmin = await checkSession(sessionId);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse same filter params as downloads list
  const { searchParams } = req.nextUrl;
  const period = (searchParams.get('period') || 'today') as Period;
  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ success: false, error: 'Period tidak valid.' }, { status: 400 });
  }

  const platform = searchParams.get('platform') || null;
  const status = searchParams.get('status') || null;
  const downloaderType = searchParams.get('downloaderType') || null;
  const search = searchParams.get('search') || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo = searchParams.get('dateTo') || null;

  try {
    const rows = await exportDownloadsCsv({ period, platform, status, downloaderType, search, dateFrom, dateTo });

    const header = 'id,url,platform,downloaderType,status,createdAt,completedAt,errorMessage\n';
    const body = rows.map(r =>
      [
        escapeCsv(String(r.id)),
        escapeCsv(r.url),
        escapeCsv(r.platform),
        escapeCsv(r.downloader_type),
        escapeCsv(r.status),
        escapeCsv(r.created_at),
        escapeCsv(r.completed_at),
        escapeCsv(r.error_message),
      ].join(',')
    ).join('\n');

    const csv = header + body;
    const filename = `tempelink-logs-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Gagal mengekspor data.', detail: message },
      { status: 500 }
    );
  }
}
