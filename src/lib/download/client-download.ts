/**
 * Client-Side Direct Download Executor
 *
 * Guarantees that media files (videos, photos, audio) are downloaded
 * directly to the user's computer/device without navigating to an external tab
 * or opening the browser's native video player.
 */

export interface DownloadOptions {
  token?: string | null;
  directUrl?: string | null;
  filename: string;
}

export async function executeImmediateDownload(options: DownloadOptions): Promise<void> {
  const { token, directUrl, filename } = options;

  // Use the server streaming endpoint with signed token if available
  const endpoint = token
    ? `/api/media/download?token=${encodeURIComponent(token)}`
    : directUrl;

  if (!endpoint) {
    throw new Error('Tautan unduhan tidak tersedia.');
  }

  // Pre-validate token / endpoint availability with a lightweight check
  if (token) {
    try {
      const preflight = await fetch(endpoint, {
        method: 'HEAD',
        headers: { Accept: '*/*' },
      });

      if (!preflight.ok && preflight.status !== 405) {
        // If HEAD failed with an error status (e.g. 403, 410, 503),
        // try to parse error details if available or provide friendly message
        let errMsg = `Unduhan tidak dapat diproses (HTTP ${preflight.status}).`;
        if (preflight.status === 403 || preflight.status === 410) {
          errMsg = 'Tautan unduhan sudah kedaluwarsa. Silakan periksa kembali tautan lalu unduh ulang.';
        } else if (preflight.status === 503) {
          errMsg = 'Gagal mengunduh media dari sumber. Silakan coba beberapa saat lagi.';
        }
        throw new Error(errMsg);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unduhan')) {
        throw err;
      }
      // If network preflight error, continue to trigger native browser anchor
    }
  }

  // Trigger native browser download directly via programmatic anchor
  // This allows the browser's download manager to stream multi-gigabyte files
  // directly to disk without running out of RAM in JavaScript blob memory.
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = endpoint;
  anchor.setAttribute('download', filename);
  anchor.setAttribute('target', '_self');
  anchor.setAttribute('rel', 'noopener noreferrer');
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
  }, 3000);
}
