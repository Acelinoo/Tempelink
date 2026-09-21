import { TempelinkError } from '../types/errors';
import { serverConfig } from '../config';

/**
 * URL Sanitizer & Normalizer
 * Cleans incoming user strings, enforces valid protocols, and normalizes hostnames.
 */
export function normalizeAndParseUrl(rawInput: string | null | undefined): URL {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new TempelinkError('INVALID_URL', 'URL tidak boleh kosong.');
  }

  const trimmed = rawInput.trim();

  // Basic sanity check on length to avoid regex DoS or memory overflow
  if (trimmed.length < 8 || trimmed.length > 2048) {
    throw new TempelinkError('INVALID_URL', 'Panjang URL tidak valid (antara 8 - 2048 karakter).');
  }

  let parsed: URL;
  try {
    // Only prepend https:// if there is no scheme present (does not contain ://)
    const urlString = trimmed.includes('://')
      ? trimmed
      : `https://${trimmed}`;

    parsed = new URL(urlString);
  } catch {
    throw new TempelinkError('INVALID_URL', 'Format URL tidak valid.');
  }

  // Enforce allowed protocols
  const protocol = parsed.protocol.replace(':', '').toLowerCase();
  if (!serverConfig.security.allowedProtocols.includes(protocol)) {
    throw new TempelinkError(
      'INVALID_URL',
      `Protokol ${parsed.protocol} tidak diizinkan. Hanya http dan https yang didukung.`
    );
  }

  // Normalize hostname to lowercase
  parsed.hostname = parsed.hostname.toLowerCase();

  return parsed;
}
