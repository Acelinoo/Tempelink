import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../src/app/api/media/download/route';
import { generateDownloadToken } from '../src/lib/security/token';

describe('Media Download Route Handler (/api/media/download)', () => {
  const validPayload = {
    mediaId: '7123456789012345678',
    capabilityId: 'tt_7123456789012345678_standard',
    sourceUrl: 'https://www.tiktok.com/@user/video/7123456789012345678',
    targetUrl: 'https://cdn.tiktok.example/stream.mp4',
    filename: 'tiktok_stream.mp4',
    mimeType: 'video/mp4',
  };

  let validToken: string;

  beforeEach(() => {
    validToken = generateDownloadToken(validPayload);
  });

  describe('POST /api/media/download', () => {
    it('successfully delivers media download URL for a legitimate token', async () => {
      const req = new NextRequest('http://localhost:3000/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: validPayload.mediaId,
          capabilityId: validPayload.capabilityId,
          sourceUrl: validPayload.sourceUrl,
          downloadToken: validToken,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.downloadType).toBe('direct_url');
      expect(json.data.downloadUrl).toBe(validPayload.targetUrl);
      expect(json.data.filename).toBe(validPayload.filename);
    });

    it('rejects requests with missing download token', async () => {
      const req = new NextRequest('http://localhost:3000/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: validPayload.mediaId,
          capabilityId: validPayload.capabilityId,
          sourceUrl: validPayload.sourceUrl,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DOWNLOAD_UNAVAILABLE');
    });

    it('rejects forged token attempting open-proxy SSRF to localhost', async () => {
      const [payloadBase64, signature] = validToken.split('.');
      const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
      decoded.targetUrl = 'http://127.0.0.1:3000/admin';
      const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
      const forgedToken = `${forgedPayload}.${signature}`;

      const req = new NextRequest('http://localhost:3000/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: validPayload.mediaId,
          capabilityId: validPayload.capabilityId,
          sourceUrl: validPayload.sourceUrl,
          downloadToken: forgedToken,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SSRF_BLOCKED');
    });

    it('rejects forged token attempting open-proxy SSRF to AWS metadata', async () => {
      const [payloadBase64, signature] = validToken.split('.');
      const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
      decoded.targetUrl = 'http://169.254.169.254/latest/meta-data/';
      const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
      const forgedToken = `${forgedPayload}.${signature}`;

      const req = new NextRequest('http://localhost:3000/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: validPayload.mediaId,
          capabilityId: validPayload.capabilityId,
          sourceUrl: validPayload.sourceUrl,
          downloadToken: forgedToken,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SSRF_BLOCKED');
    });
  });

  describe('GET /api/media/download (Direct Redirect Route)', () => {
    it('redirects with 302 and attachment header for valid token when upstream stream fails or offline', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/media/download?token=${encodeURIComponent(validToken)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(validPayload.targetUrl);
      expect(res.headers.get('content-disposition')).toContain(validPayload.filename);
      expect(res.headers.get('cache-control')).toContain('no-store');
    });

    it('streams media directly with 200 and attachment header when upstream stream succeeds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('binary-stream-data', {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '18',
          },
        })
      );

      const req = new NextRequest(
        `http://localhost:3000/api/media/download?token=${encodeURIComponent(validToken)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain(validPayload.filename);
      expect(res.headers.get('content-type')).toBe('video/mp4');
      const text = await res.text();
      expect(text).toBe('binary-stream-data');
    });

    it('returns 400 INVALID_URL when token parameter is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/media/download');

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_URL');
    });

    it('returns 403 SSRF_BLOCKED for tampered redirect token', async () => {
      const [payloadBase64, signature] = validToken.split('.');
      const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
      decoded.targetUrl = 'http://10.0.0.1:8080/internal-data';
      const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
      const forgedToken = `${forgedPayload}.${signature}`;

      const req = new NextRequest(
        `http://localhost:3000/api/media/download?token=${encodeURIComponent(forgedToken)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SSRF_BLOCKED');
    });

    it('returns 410 MEDIA_URL_EXPIRED for expired token', async () => {
      const expiredToken = generateDownloadToken(validPayload, -60);
      const req = new NextRequest(
        `http://localhost:3000/api/media/download?token=${encodeURIComponent(expiredToken)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(410);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('MEDIA_URL_EXPIRED');
    });

    it('rejects tokens containing disallowed mime types', async () => {
      const forbiddenPayload = {
        ...validPayload,
        mimeType: 'application/x-sh',
      };
      const token = generateDownloadToken(forbiddenPayload);
      const req = new NextRequest(
        `http://localhost:3000/api/media/download?token=${encodeURIComponent(token)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNSUPPORTED_MEDIA');
    });
  });
});
