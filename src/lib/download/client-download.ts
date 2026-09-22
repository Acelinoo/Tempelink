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

  // Strategy 1: Fetch as Blob and trigger immediate save via Object URL
  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'GET' });
  } catch {
    // Network-level failure (offline, DNS, timeout) — fall through to Strategy 2
    const fallbackAnchor = document.createElement('a');
    fallbackAnchor.style.display = 'none';
    fallbackAnchor.href = endpoint;
    fallbackAnchor.setAttribute('download', filename);
    document.body.appendChild(fallbackAnchor);
    fallbackAnchor.click();
    setTimeout(() => { document.body.removeChild(fallbackAnchor); }, 2000);
    return;
  }

  if (!response.ok) {
    // Server returned an explicit error (4xx / 5xx).
    // Read the error message from the JSON response so the UI can display it.
    // Do NOT fall back to an anchor — the server won't produce a file for this token.
    let userMessage = `Unduhan gagal (HTTP ${response.status}).`;
    try {
      const errData = await response.json() as { error?: { message?: string } };
      if (errData?.error?.message) userMessage = errData.error.message;
    } catch { /* ignore — keep default message */ }
    throw new Error(userMessage);
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
}
