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
import { recordDownloadEvent } from '@/lib/analytics/db';
import { providerRegistry } from '@/lib/platforms/core/registry';

const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/webm',
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

    // Record analytics event for direct-URL downloads.
    // Idempotency key = token signature (the last segment of the signed token).
    // A valid token can only be generated server-side, so this is trustworthy.
    const tokenParts = body.downloadToken.split('.');
    const idempotencyKey = `post:${tokenParts[tokenParts.length - 1]}`;
    recordDownloadEvent({
      idempotencyKey,
      platform: body.capabilityId?.split('_')[0],
    }).catch(() => { /* non-fatal */ });

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

    // Stream media directly with attachment disposition to force immediate file download
    let upstreamStatus = 0;
    try {
      const upstreamRes = await fetch(payload.targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(30000),
      });

      upstreamStatus = upstreamRes.status;

      if (upstreamRes.ok && upstreamRes.body) {
        const streamHeaders = new Headers();
        streamHeaders.set('X-Correlation-ID', correlationId);
        streamHeaders.set(
          'Content-Disposition',
          formatContentDisposition(payload.filename)
        );
        streamHeaders.set(
          'Content-Type',
          payload.mimeType ||
            upstreamRes.headers.get('content-type') ||
            'application/octet-stream'
        );
        const contentLength = upstreamRes.headers.get('content-length');
        if (contentLength) {
          streamHeaders.set('Content-Length', contentLength);
        }
        streamHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        streamHeaders.set('Pragma', 'no-cache');
        streamHeaders.set('Expires', '0');
        streamHeaders.set('X-Content-Type-Options', 'nosniff');

        // Record analytics event for streamed downloads.
        // Idempotency key = token signature — prevents duplicate counting on retries.
        const streamTokenParts = token.split('.');
        const streamIdempotencyKey = `get:${streamTokenParts[streamTokenParts.length - 1]}`;
        recordDownloadEvent({
          idempotencyKey: streamIdempotencyKey,
          platform: payload.capabilityId?.split('_')[0],
        }).catch(() => { /* non-fatal */ });

        return new Response(upstreamRes.body, {
          status: 200,
          headers: streamHeaders,
        });
      }

      Logger.warn('[Download] Upstream returned non-OK status', {
        status: upstreamRes.status,
        correlationId,
      });
    } catch (streamErr) {
      Logger.warn('[Download] Upstream fetch failed', {
        error: streamErr instanceof Error ? streamErr.message : String(streamErr),
        correlationId,
      });
    }

    // If upstream streaming failed (e.g. HTTP 403 due to expired or IP-bound legacy token),
    // and a sourceUrl is present, attempt an on-the-fly re-resolution with the active provider.
    if ((upstreamStatus === 403 || upstreamStatus === 410) && payload.sourceUrl) {
      try {
        const parsedSource = new URL(payload.sourceUrl);
        const provider = providerRegistry.findForUrl(parsedSource);
        if (provider) {
          Logger.info('[Download] Attempting auto-refresh re-resolution for media', {
            mediaId: payload.mediaId,
            correlationId,
          });
          const freshResolution = await provider.resolve(parsedSource, { correlationId });
          const matchingCap =
            freshResolution.capabilities.find((c) => c.id === payload.capabilityId) ||
            freshResolution.capabilities.find((c) => c.type === (payload.mimeType?.startsWith('audio') ? 'audio' : 'video')) ||
            freshResolution.capabilities[0];

          if (matchingCap?.downloadUrl && matchingCap.downloadUrl !== payload.targetUrl) {
            const freshTarget = normalizeAndParseUrl(matchingCap.downloadUrl);
            validateUrlSafety(freshTarget);

            const retryRes = await fetch(matchingCap.downloadUrl, {
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: 'https://www.youtube.com/',
                Origin: 'https://www.youtube.com',
                Accept: '*/*',
              },
              signal: AbortSignal.timeout(30000),
            });

            if (retryRes.ok && retryRes.body) {
              const streamHeaders = new Headers();
              streamHeaders.set('X-Correlation-ID', correlationId);
              streamHeaders.set(
                'Content-Disposition',
                formatContentDisposition(payload.filename)
              );
              streamHeaders.set(
                'Content-Type',
                payload.mimeType ||
                  retryRes.headers.get('content-type') ||
                  'application/octet-stream'
              );
              const contentLength = retryRes.headers.get('content-length');
              if (contentLength) {
                streamHeaders.set('Content-Length', contentLength);
              }
              streamHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
              streamHeaders.set('Pragma', 'no-cache');
              streamHeaders.set('Expires', '0');
              streamHeaders.set('X-Content-Type-Options', 'nosniff');

              const streamTokenParts = token.split('.');
              const streamIdempotencyKey = `get:${streamTokenParts[streamTokenParts.length - 1]}`;
              recordDownloadEvent({
                idempotencyKey: streamIdempotencyKey,
                platform: payload.capabilityId?.split('_')[0],
              }).catch(() => { /* non-fatal */ });

              return new Response(retryRes.body, {
                status: 200,
                headers: streamHeaders,
              });
            }
          }
        }
      } catch (refreshErr) {
        Logger.warn('[Download] Fallback auto-refresh failed', {
          error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
          correlationId,
        });
      }
    }

    // Streaming failed — never redirect browser to upstream URL.
    // YouTube CDN URLs (googlevideo.com) are signed for the API server's IP;
    // redirecting exposes the IP-bound URL directly to the browser which always 403s.
    const streamError = new TempelinkError(
      upstreamStatus === 403
        ? 'PRIVATE_CONTENT'
        : 'DOWNLOAD_UNAVAILABLE',
      upstreamStatus === 403
        ? 'Tautan unduhan tidak dapat diakses. URL media sudah kedaluwarsa atau dibatasi — silakan periksa kembali tautan lalu unduh ulang.'
        : 'Gagal mengunduh media dari sumber. Silakan coba beberapa saat lagi.'
    );
    return NextResponse.json(streamError.toJSON(correlationId), {
      status: 503,
      headers: {
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store',
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

