import { NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/platforms/core/registry';
import { Logger } from '@/lib/telemetry/logger';

export async function GET() {
  const correlationId = Logger.generateCorrelationId();

  try {
    const platforms = providerRegistry.getPlatformInfos();

    return NextResponse.json(
      {
        success: true,
        data: platforms,
      },
      {
        headers: {
          'X-Correlation-ID': correlationId,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    Logger.error('Failed to list platforms', error, { correlationId });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Gagal memuat daftar platform.',
          correlationId,
        },
      },
      { status: 500 }
    );
  }
}
