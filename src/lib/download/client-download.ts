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

  // Determine optimal download target URL.
  // When directUrl is an authentic external HTTPS CDN stream (e.g. Cloudflare CDN / yqapi),
  // navigate directly to it. This completely avoids Vercel serverless execution limits (10s timeout)
  // and eliminates Chrome's cross-origin download redirect security block ("Failed - Unknown server error").
  const isDirectCdn =
    typeof directUrl === 'string' &&
    /^https?:\/\//i.test(directUrl) &&
    !directUrl.includes('/api/media/download');

  const endpoint = isDirectCdn
    ? directUrl
    : token
    ? `/api/media/download?token=${encodeURIComponent(token)}`
    : directUrl;

  if (!endpoint) {
    throw new Error('Tautan unduhan tidak tersedia.');
  }

  // Pre-validate token / endpoint availability with a lightweight check if using local token endpoint
  if (!isDirectCdn && token) {
    try {
      const preflight = await fetch(endpoint, {
        method: 'HEAD',
        headers: { Accept: '*/*' },
      });

      if (!preflight.ok && preflight.status !== 405) {
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

  // Trigger native browser download directly via programmatic anchor.
  // Note: Only set the HTML5 'download' attribute for static same-origin endpoints.
  // Setting 'download' on cross-origin URLs or URLs that trigger cross-origin 307 redirects
  // is blocked by Chrome's security policy, resulting in:
  // "Failed - Unknown server error. Please try again, or contact the server administrator."
  // When 'download' is omitted, Chrome honors the server's Content-Disposition: attachment header.
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = endpoint;

  const isSameOrigin =
    endpoint.startsWith('/') ||
    (typeof window !== 'undefined' && endpoint.startsWith(window.location.origin));

  if (isSameOrigin && !endpoint.includes('token=')) {
    anchor.setAttribute('download', filename);
  }

  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
  }, 5000);
}
