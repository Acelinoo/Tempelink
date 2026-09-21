import { serverConfig } from '../config';
import { TempelinkError } from '../types/errors';

export interface ApiGuardOptions {
  maxUrlLength?: number;
  maxBodyBytes?: number;
  requireJson?: boolean;
}

/**
 * API Guard & Abuse Prevention Middleware Helper
 * Validates URL lengths, content-type headers, and payload byte sizes to protect
 * serverless lambdas against memory exhaustion, ReDoS, and malicious inputs.
 */
export async function validateApiRequest(
  req: Request,
  options?: ApiGuardOptions
): Promise<void> {
  const maxUrlLength =
    options?.maxUrlLength || serverConfig.security.maxUrlLength;
  const maxBodyBytes =
    options?.maxBodyBytes || serverConfig.security.maxBodySizeBytes;
  const requireJson = options?.requireJson !== false;

  // 1. Enforce Maximum URL Length
  if (req.url && req.url.length > maxUrlLength) {
    throw new TempelinkError(
      'URI_TOO_LONG',
      `Panjang alamat URL melebihi batas maksimal ${maxUrlLength} karakter.`,
      { length: req.url.length, max: maxUrlLength }
    );
  }

  // 2. Validate Content-Type for mutation methods (POST, PUT, PATCH)
  if (requireJson && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new TempelinkError(
        'INVALID_URL',
        'Header "Content-Type" harus bertipe "application/json".'
      );
    }
  }

  // 3. Fast-check Content-Length header if present
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > maxBodyBytes) {
      throw new TempelinkError(
        'PAYLOAD_TOO_LARGE',
        `Ukuran data melebihi batas maksimal ${Math.round(maxBodyBytes / 1024)} KB.`,
        { bytes: contentLength, maxBytes: maxBodyBytes }
      );
    }
  }
}

/**
 * Safely reads and parses request body as JSON with strict byte-size enforcement.
 */
export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes = serverConfig.security.maxBodySizeBytes
): Promise<T> {
  let rawText = '';
  try {
    rawText = await req.text();
  } catch {
    throw new TempelinkError(
      'INVALID_URL',
      'Gagal membaca aliran data permintaan (stream error).'
    );
  }

  const byteLength = Buffer.byteLength(rawText, 'utf8');
  if (byteLength > maxBytes) {
    throw new TempelinkError(
      'PAYLOAD_TOO_LARGE',
      `Ukuran data melebihi batas maksimal ${Math.round(maxBytes / 1024)} KB.`,
      { bytes: byteLength, maxBytes }
    );
  }

  if (!rawText.trim()) {
    throw new TempelinkError(
      'INVALID_URL',
      'Isi body permintaan kosong.'
    );
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new TempelinkError(
      'INVALID_URL',
      'Format data request harus berupa JSON yang valid.'
    );
  }
}
