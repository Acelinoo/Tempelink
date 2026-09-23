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
      // If network preflight error, continue to trigger download
    }
  }

  // CRITICAL FIX: Trigger direct download without opening in-browser video player tab.
  // Never use target="_blank" on video streams as it instructs Chrome to open a new tab
  // and display the HTML5 video player instead of saving the file to disk.
  //
  // 1. Same-Origin & Blob endpoints: Use HTML5 <a download="..."> without target="_blank".
  const isSameOrigin =
    endpoint.startsWith('/') ||
    (typeof window !== 'undefined' && endpoint.startsWith(window.location.origin));

  if (isSameOrigin) {
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = endpoint;
    anchor.setAttribute('download', filename);
    anchor.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
    }, 5000);
    return;
  }

  // 2. Cross-Origin Direct Streams (e.g. yqapi Cloudflare CDN with Content-Disposition: attachment):
  // Use a hidden <iframe>. When the browser navigates an iframe to an endpoint returning
  // Content-Disposition: attachment, it immediately transfers the payload to the browser's
  // native download manager (chrome://downloads) without opening a new tab or playing the video.
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.border = 'none';
    iframe.src = endpoint;
    document.body.appendChild(iframe);

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 60000);
  } catch {
    // Fallback if iframe DOM manipulation fails
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = endpoint;
    anchor.setAttribute('download', filename);
    anchor.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
    }, 5000);
  }
}
