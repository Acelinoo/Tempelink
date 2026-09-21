import { NextRequest, NextResponse } from 'next/server';
import { batchQueueService } from '@/lib/queue/service';
import { TempelinkError } from '@/lib/types/errors';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit/rate-limiter';
import { validateApiRequest, readJsonBody } from '@/lib/security/api-guard';
import { Logger } from '@/lib/telemetry/logger';
import { trackEvent } from '@/lib/telemetry/events';

export async function POST(req: NextRequest) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();
  const clientIp = getClientIp(req);
  const startTime = Date.now();

  try {
    // 1. Enforce API request guard (URL length, Content-Type, Content-Length)
    await validateApiRequest(req);

    // 2. Enforce IP-based rate limiting on batch creation (5 batches / minute)
    const rl = await enforceRateLimit(clientIp, 'batch');

    // 3. Parse request JSON body safely with byte limit
    const body = await readJsonBody<{ urls?: string[] }>(req);

    if (!body || !Array.isArray(body.urls)) {
      throw new TempelinkError(
        'INVALID_URL',
        'Field "urls" bertipe array string diperlukan.'
      );
    }

    trackEvent({
      correlationId,
      eventType: 'batch_created',
      urlCount: body.urls.length,
    });

    // 3. Create, validate, deduplicate and enqueue batch
    const batchSummary = await batchQueueService.createBatch(
      body.urls,
      clientIp
    );

    return NextResponse.json(
      {
        success: true,
        data: batchSummary,
      },
      {
        status: 201,
        headers: {
          'X-Correlation-ID': correlationId,
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.resetMs),
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (err instanceof TempelinkError) {
      Logger.warn(`[BatchCreate] Handled error: ${err.code}`, {
        correlationId,
        code: err.code,
        userMessage: err.userMessage,
        clientIp,
        durationMs,
      });

      const headers: Record<string, string> = {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store, must-revalidate',
      };

      if (err.code === 'RATE_LIMITED' && err.details?.retryAfterSeconds) {
        headers['Retry-After'] = String(err.details.retryAfterSeconds);
      }

      return NextResponse.json(err.toJSON(correlationId), {
        status: err.httpStatus,
        headers,
      });
    }

    Logger.error('[BatchCreate] Unexpected internal exception', err, {
      correlationId,
      clientIp,
      durationMs,
    });

    const fallbackError = new TempelinkError('INTERNAL_ERROR');
    return NextResponse.json(fallbackError.toJSON(correlationId), {
      status: 500,
      headers: {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  }
}
