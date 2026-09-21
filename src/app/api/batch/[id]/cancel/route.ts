import { NextRequest, NextResponse } from 'next/server';
import { batchQueueService } from '@/lib/queue/service';
import { TempelinkError } from '@/lib/types/errors';
import { Logger } from '@/lib/telemetry/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();

  try {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      throw new TempelinkError('INVALID_URL', 'ID batch tidak valid.');
    }

    const success = await batchQueueService.cancelBatch(id);

    if (!success) {
      throw new TempelinkError(
        'BATCH_NOT_FOUND',
        `Antrean batch dengan ID "${id}" tidak ditemukan.`
      );
    }

    const updatedBatch = await batchQueueService.getBatch(id);

    return NextResponse.json(
      {
        success: true,
        data: {
          batchId: id,
          status: 'CANCELLED',
          message: 'Antrean batch berhasil dibatalkan.',
          batch: updatedBatch,
        },
      },
      {
        status: 200,
        headers: {
          'X-Correlation-ID': correlationId,
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

    Logger.error('[BatchCancel] Unexpected internal exception', err, {
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
