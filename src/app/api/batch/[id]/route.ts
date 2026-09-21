import { NextRequest, NextResponse } from 'next/server';
import { batchQueueService } from '@/lib/queue/service';
import { TempelinkError } from '@/lib/types/errors';
import { Logger } from '@/lib/telemetry/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();

  try {
    const { id } = await context.params;

    if (!id || typeof id !== 'string' || id.length > 64) {
      throw new TempelinkError('INVALID_URL', 'ID batch tidak valid.');
    }

    const batchSummary = await batchQueueService.getBatch(id);

    if (!batchSummary) {
      throw new TempelinkError(
        'BATCH_NOT_FOUND',
        `Antrean batch dengan ID "${id}" tidak ditemukan atau telah kedaluwarsa.`
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: batchSummary,
      },
      {
        status: 200,
        headers: {
          'X-Correlation-ID': correlationId,
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof TempelinkError) {
      return NextResponse.json(err.toJSON(correlationId), {
        status: err.httpStatus,
        headers: {
          'X-Correlation-ID': correlationId,
        },
      });
    }

    Logger.error('[BatchGet] Unexpected internal exception', err, {
      correlationId,
    });

    const fallbackError = new TempelinkError('INTERNAL_ERROR');
    return NextResponse.json(fallbackError.toJSON(correlationId), {
      status: 500,
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });
  }
}
