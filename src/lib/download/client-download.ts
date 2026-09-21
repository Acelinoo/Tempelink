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

  try {
    // Strategy 1: Fetch as Blob and trigger immediate save via Object URL
    const response = await fetch(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = blobUrl;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch {
    // Strategy 2 (Fallback): Trigger invisible download anchor on streaming endpoint
    // Because the server responds with 'Content-Disposition: attachment; filename="..."',
    // modern browsers immediately trigger the file save dialog without navigating away.
    const fallbackAnchor = document.createElement('a');
    fallbackAnchor.style.display = 'none';
    fallbackAnchor.href = endpoint;
    fallbackAnchor.setAttribute('download', filename);

    document.body.appendChild(fallbackAnchor);
    fallbackAnchor.click();

    setTimeout(() => {
      document.body.removeChild(fallbackAnchor);
    }, 2000);
  }
}
