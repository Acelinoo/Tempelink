import { NextRequest, NextResponse } from 'next/server';
import { getTotalDownloads } from '@/lib/analytics/db';
import { Logger } from '@/lib/telemetry/logger';

// Lightweight server-side cache: prevents hammering the DB on every poll tick
let cachedCount: number | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds

export async function GET(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || 'stats';

  try {
    const now = Date.now();

    if (cachedCount !== null && now < cacheExpiresAt) {
      return NextResponse.json(
        { totalDownloads: cachedCount },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Cache': 'HIT',
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }

    // null = DB not configured, return 0 gracefully
    const total = await getTotalDownloads();
    const count = total ?? 0;
    cachedCount = count;
    cacheExpiresAt = now + CACHE_TTL_MS;

    return NextResponse.json(
      { totalDownloads: count },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': 'MISS',
          'X-Correlation-ID': correlationId,
        },
      }
    );
  } catch (err) {
    Logger.error('[Stats] Failed to fetch download count', err, { correlationId });

    return NextResponse.json(
      { error: 'Statistics unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Correlation-ID': correlationId,
        },
      }
    );
  }
}
