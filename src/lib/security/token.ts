import crypto from 'crypto';
import { serverConfig } from '../config';
import { TempelinkError } from '../types/errors';
import { sanitizeDownloadFilename } from './filename';

export interface DownloadTokenPayload {
  mediaId: string;
  capabilityId: string;
  sourceUrl: string;
  targetUrl: string;
  filename: string;
  mimeType: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Creates a cryptographically signed, stateless download token.
 * Prevents clients from supplying arbitrary download URLs to the server.
 */
export function generateDownloadToken(
  payload: Omit<DownloadTokenPayload, 'expiresAt'>,
  expirySeconds?: number
): string {
  const expiresAt =
    Date.now() + (expirySeconds || serverConfig.download.tokenExpirySeconds) * 1000;

  const fullPayload: DownloadTokenPayload = {
    ...payload,
    filename: sanitizeDownloadFilename(payload.filename),
    expiresAt,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', serverConfig.download.signingSecret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies the integrity and expiration of a download token.
 * Throws TempelinkError('MEDIA_URL_EXPIRED') or TempelinkError('SSRF_BLOCKED') if invalid.
 */
export function verifyDownloadToken(token: string): DownloadTokenPayload {
  if (!token || typeof token !== 'string') {
    throw new TempelinkError('INVALID_URL', 'Download token tidak valid.');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new TempelinkError('INVALID_URL', 'Format download token tidak valid.');
  }

  const [payloadBase64, signature] = parts;

  // Verify HMAC signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', serverConfig.download.signingSecret)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new TempelinkError(
      'SSRF_BLOCKED',
      'Tanda tangan token download tidak sah (forged token).'
    );
  }

  // Parse payload
  let payload: DownloadTokenPayload;
  try {
    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    throw new TempelinkError('INVALID_URL', 'Payload download token rusak.');
  }

  // Validate strict payload schema
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.mediaId !== 'string' ||
    !payload.mediaId.trim() ||
    typeof payload.capabilityId !== 'string' ||
    !payload.capabilityId.trim() ||
    typeof payload.sourceUrl !== 'string' ||
    !payload.sourceUrl.trim() ||
    typeof payload.targetUrl !== 'string' ||
    !payload.targetUrl.trim() ||
    typeof payload.filename !== 'string' ||
    !payload.filename.trim() ||
    typeof payload.mimeType !== 'string' ||
    !payload.mimeType.trim() ||
    typeof payload.expiresAt !== 'number' ||
    !Number.isFinite(payload.expiresAt)
  ) {
    throw new TempelinkError(
      'INVALID_URL',
      'Struktur token download tidak lengkap atau tidak valid.'
    );
  }

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    throw new TempelinkError(
      'MEDIA_URL_EXPIRED',
      'Tautan unduhan media telah kedaluwarsa. Silakan periksa kembali tautan Anda.'
    );
  }

  payload.filename = sanitizeDownloadFilename(payload.filename);

  return payload;
}

