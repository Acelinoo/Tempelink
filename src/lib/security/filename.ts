/**
 * Filename Sanitization & Content-Disposition Header Engine
 *
 * Enforces:
 * 1. CRLF Injection Elimination (prevents HTTP response splitting)
 * 2. Directory Traversal Stripping (prevents ../ and \..\ attacks)
 * 3. Filesystem-Safe Character Whitelist (Windows & POSIX safe)
 * 4. Windows Reserved Names Neutralization (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 * 5. Bounded Length Capping (prevents filesystem path overflow)
 * 6. RFC 6266 / RFC 5987 Content-Disposition Formatting
 */

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const MAX_BASE_FILENAME_LENGTH = 80;

/**
 * Sanitizes an untrusted filename string into a deterministic, filesystem-safe filename.
 */
export function sanitizeDownloadFilename(
  rawFilename: string | null | undefined,
  defaultExtension = 'mp4'
): string {
  const fallback = `tempelink_media.${defaultExtension}`;

  if (!rawFilename || typeof rawFilename !== 'string') {
    return fallback;
  }

  // 1. Remove null bytes and CRLF control characters (CRLF Injection defense)
  const clean = rawFilename.replace(/[\r\n\x00-\x1f\x7f]/g, '').trim();

  if (!clean) {
    return fallback;
  }

  // 2. Separate base name and extension
  const lastDotIdx = clean.lastIndexOf('.');
  let base = lastDotIdx > 0 ? clean.substring(0, lastDotIdx) : clean;
  let ext = lastDotIdx > 0 ? clean.substring(lastDotIdx + 1).toLowerCase() : defaultExtension;

  // 3. Clean extension (alphanumeric only, max 5 chars)
  ext = ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || defaultExtension;

  // 4. Strip path traversal elements (../, ..\, /, \)
  base = base.replace(/\.\.+[/\\]?/g, '');
  base = base.replace(/[/\\]/g, '_');

  // 5. Replace illegal characters with safe underscores
  // Illegal in Windows/POSIX + shell characters: < > : " / \ | ? * ; $ ` & !
  base = base.replace(/[/\\:*?"<>|;$`&!]/g, '_');

  // Collapse multiple underscores or spaces
  base = base.replace(/[_\s]+/g, '_').trim();
  base = base.replace(/^_+|_+$/g, '');

  // 6. Neutralize Windows reserved device names
  if (WINDOWS_RESERVED_NAMES.has(base.toLowerCase())) {
    base = `file_${base}`;
  }

  // 7. Bound base length to prevent buffer/path overflow
  if (base.length > MAX_BASE_FILENAME_LENGTH) {
    base = base.substring(0, MAX_BASE_FILENAME_LENGTH);
  }

  if (!base) {
    base = 'tempelink_media';
  }

  return `${base}.${ext}`;
}

/**
 * Generates an RFC 6266 and RFC 5987 compliant Content-Disposition header.
 * Formats an ASCII-safe fallback and an explicit UTF-8 encoded filename*.
 */
export function formatContentDisposition(filename: string): string {
  const sanitized = sanitizeDownloadFilename(filename);

  // ASCII-safe fallback: replace non-ASCII characters with underscore
  const asciiFallback = sanitized.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

  // If filename is strictly ASCII and contains no special characters, simple header suffices
  if (sanitized === asciiFallback && !/[%*']/.test(sanitized)) {
    return `attachment; filename="${asciiFallback}"`;
  }

  // RFC 5987 UTF-8 encoding
  const encodedUtf8 = encodeURIComponent(sanitized).replace(/['()]/g, escape);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
}
