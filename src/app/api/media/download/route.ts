import { NextRequest, NextResponse } from 'next/server';
import { TempelinkError } from '@/lib/types/errors';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit/rate-limiter';
import { normalizeAndParseUrl } from '@/lib/security/sanitizer';
import { validateUrlSafety } from '@/lib/security/ssrf';
import { verifyDownloadToken } from '@/lib/security/token';
import { formatContentDisposition } from '@/lib/security/filename';
import { validateApiRequest, readJsonBody } from '@/lib/security/api-guard';
import { Logger } from '@/lib/telemetry/logger';
import { trackEvent } from '@/lib/telemetry/events';

const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(req: NextRequest) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();
  const clientIp = getClientIp(req);
  const startTime = Date.now();

  try {
    // 1. Enforce API request guard (URL length, Content-Type, Content-Length)
    await validateApiRequest(req);

    // 2. Enforce rate limit on downloads
    const rl = await enforceRateLimit(clientIp, 'download');

    // 3. Validate request body safely with size limit
    const body = await readJsonBody<{
      mediaId?: string;
      capabilityId?: string;
      sourceUrl?: string;
      downloadToken?: string;
    }>(req);

    if (!body.capabilityId || !body.sourceUrl) {
      throw new TempelinkError(
        'INVALID_URL',
        'Parameter capabilityId dan sourceUrl wajib disertakan.'
      );
    }

    // 3. Re-verify sourceUrl safety
    const parsedSource = normalizeAndParseUrl(body.sourceUrl);
    validateUrlSafety(parsedSource);

    // 4. Validate signed download token
    if (!body.downloadToken) {
      throw new TempelinkError(
        'DOWNLOAD_UNAVAILABLE',
        'Download token tidak ditemukan atau penyedia stream belum dikonfigurasi.'
      );
    }

    const payload = verifyDownloadToken(body.downloadToken);

    // 5. Ensure targetUrl passes SSRF verification before serving
    const parsedTarget = normalizeAndParseUrl(payload.targetUrl);
    validateUrlSafety(parsedTarget);

    // 6. Ensure declared MIME type is an authorized media format
    if (!ALLOWED_MEDIA_MIME_TYPES.has(payload.mimeType.toLowerCase())) {
      throw new TempelinkError(
        'UNSUPPORTED_MEDIA',
        'Format media yang diminta tidak didukung atau tidak aman.'
      );
    }

    trackEvent({
      correlationId,
      eventType: 'download_started',
      capabilityId: body.capabilityId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          downloadType: 'direct_url',
          downloadUrl: payload.targetUrl,
          filename: payload.filename,
          mimeType: payload.mimeType,
          expiresAt: new Date(payload.expiresAt).toISOString(),
        },
      },
      {
        headers: {
          'X-Correlation-ID': correlationId,
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.resetMs),
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (err instanceof TempelinkError) {
      Logger.warn(`[Download] Handled error: ${err.code}`, {
        correlationId,
        code: err.code,
        userMessage: err.userMessage,
        clientIp,
        durationMs,
      });

      trackEvent({
        correlationId,
        eventType: 'download_failed',
        errorCode: err.code,
        durationMs,
      });

      const headers: Record<string, string> = {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      };

      if (err.code === 'RATE_LIMITED' && err.details?.retryAfterSeconds) {
        headers['Retry-After'] = String(err.details.retryAfterSeconds);
      }

      return NextResponse.json(err.toJSON(correlationId), {
        status: err.httpStatus,
        headers,
      });
    }

    Logger.error('[Download] Unexpected error', err, {
      correlationId,
      clientIp,
      durationMs,
    });

    const fallback = new TempelinkError('INTERNAL_ERROR');
    return NextResponse.json(fallback.toJSON(correlationId), {
      status: 500,
      headers: {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}

/**
 * Direct browser download route handler: GET /api/media/download?token=...
 */
export async function GET(req: NextRequest) {
  const correlationId =
    req.headers.get('x-correlation-id') || Logger.generateCorrelationId();
  const clientIp = getClientIp(req);

  try {
    await enforceRateLimit(clientIp, 'download');

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      throw new TempelinkError('INVALID_URL', 'Download token wajib disertakan.');
    }

    // Verify token integrity and expiry
    const payload = verifyDownloadToken(token);

    // Verify target URL is safe
    const parsedTarget = normalizeAndParseUrl(payload.targetUrl);
    validateUrlSafety(parsedTarget);

    // Verify MIME type
    if (!ALLOWED_MEDIA_MIME_TYPES.has(payload.mimeType.toLowerCase())) {
      throw new TempelinkError(
        'UNSUPPORTED_MEDIA',
        'Format media yang diminta tidak didukung atau tidak aman.'
      );
    }

    // Safely redirect to authorized media resource with anti-caching & RFC 6266 headers
    return NextResponse.redirect(payload.targetUrl, {
      status: 302,
      headers: {
        'X-Correlation-ID': correlationId,
        'Content-Disposition': formatContentDisposition(payload.filename),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    if (err instanceof TempelinkError) {
      return NextResponse.json(err.toJSON(correlationId), {
        status: err.httpStatus,
        headers: {
          'X-Correlation-ID': correlationId,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const fallback = new TempelinkError('INTERNAL_ERROR');
    return NextResponse.json(fallback.toJSON(correlationId), {
      status: 500,
      headers: {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}

