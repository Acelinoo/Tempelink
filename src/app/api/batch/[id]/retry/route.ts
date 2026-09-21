import { NextRequest, NextResponse } from 'next/server';
import { batchQueueService } from '@/lib/queue/service';
import { TempelinkError } from '@/lib/types/errors';
import { validateApiRequest, readJsonBody } from '@/lib/security/api-guard';
import { Logger } from '@/lib/telemetry/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();

  try {
    await validateApiRequest(req);

    const { id } = await context.params;

    if (!id || typeof id !== 'string' || id.length > 64) {
      throw new TempelinkError('INVALID_URL', 'ID batch tidak valid.');
    }

    const body = await readJsonBody<{ jobId?: string }>(req);

    if (!body || !body.jobId || typeof body.jobId !== 'string') {
      throw new TempelinkError('INVALID_URL', 'Field "jobId" diperlukan.');
    }

    const updatedBatch = await batchQueueService.retryJob(id, body.jobId);

    if (!updatedBatch) {
      throw new TempelinkError(
        'BATCH_NOT_FOUND',
        `Job "${body.jobId}" pada batch "${id}" tidak ditemukan.`
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedBatch,
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

    Logger.error('[BatchRetry] Unexpected internal exception', err, {
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
