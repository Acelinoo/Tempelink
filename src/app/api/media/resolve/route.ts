import { NextRequest, NextResponse } from 'next/server';
import { PlatformResolver } from '@/lib/platforms/resolver';
import { TempelinkError } from '@/lib/types/errors';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit/rate-limiter';
import { validateApiRequest, readJsonBody } from '@/lib/security/api-guard';
import { verifyBotChallenge } from '@/lib/security/bot-challenge';
import { Logger } from '@/lib/telemetry/logger';
import { trackEvent } from '@/lib/telemetry/events';
import { createDownloadLog, updateDownloadLogFull, updateDownloadLog } from '@/lib/admin/db';

export async function POST(req: NextRequest) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();
  const clientIp = getClientIp(req);
  const startTime = Date.now();
  let logId: string | null = null; // outer scope so catch can update

  try {
    // 1. Enforce API request guard (URL length, Content-Type, Content-Length)
    await validateApiRequest(req);

    // 2. Enforce IP-based rate limiting
    const rl = await enforceRateLimit(clientIp, 'resolve');

    // 3. Parse request JSON body safely with byte limit
    const body = await readJsonBody<{ url?: string; botToken?: string }>(req);

    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      throw new TempelinkError('INVALID_URL', 'Field URL diperlukan.');
    }

    // 4. Verify bot challenge if configured
    await verifyBotChallenge(body.botToken, clientIp);

    trackEvent({
      correlationId,
      eventType: 'resolve_started',
    });

    // 5a. Create pending download log (non-fatal — DB failure must not break downloader)
    try {
      logId = await createDownloadLog({
        url: body.url,
        platform: null, // will be updated on success
        downloaderType: null,
      });
    } catch {
      // analytics failure is non-fatal
    }

    // 5. Coordinate resolver pipeline with caching & single-flight coalescing
    const { response: resolvedMedia, source: cacheSource } =
      await PlatformResolver.resolveWithSource(body.url, {
        correlationId,
        clientIp,
        userAgent: req.headers.get('user-agent') || undefined,
      });

    const cacheHeader =
      cacheSource === 'CACHE'
        ? 'HIT'
        : cacheSource === 'COALESCED'
          ? 'COALESCED'
          : 'MISS';

    trackEvent({
      correlationId,
      eventType: 'resolve_success',
      platform: resolvedMedia.platform,
      mediaType: resolvedMedia.mediaType,
      cacheStatus: cacheHeader,
      durationMs: Date.now() - startTime,
    });

    // Update log to success with full metadata (non-fatal)
    if (logId) {
      updateDownloadLogFull(logId, 'success', {
        platform: resolvedMedia.platform ?? null,
        downloaderType: resolvedMedia.mediaType ?? null,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        data: resolvedMedia,
      },
      {
        status: 200,
        headers: {
          'X-Correlation-ID': correlationId,
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.resetMs),
          'X-Cache': cacheHeader,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (err instanceof TempelinkError) {
      Logger.warn(`[Resolve] Handled error: ${err.code}`, {
        correlationId,
        code: err.code,
        userMessage: err.userMessage,
        clientIp,
        durationMs,
      });

      trackEvent({
        correlationId,
        eventType: 'resolve_failed',
        errorCode: err.code,
        durationMs,
      });

      // Update log to failed (non-fatal)
      if (logId) updateDownloadLog(logId, 'failed', err.code).catch(() => {});

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

    Logger.error('[Resolve] Unexpected internal exception', err, {
      correlationId,
      clientIp,
      durationMs,
    });

    // Update log to failed (non-fatal)
    if (logId) updateDownloadLog(logId, 'failed', 'INTERNAL_ERROR').catch(() => {});

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
