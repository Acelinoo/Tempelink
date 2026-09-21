import { describe, it, expect } from 'vitest';
import { validateApiRequest, readJsonBody } from '../src/lib/security/api-guard';
import { getClientIp, normalizeIp } from '../src/lib/rate-limit/rate-limiter';
import { TempelinkError } from '../src/lib/types/errors';

describe('Phase 9 — API Guard & Request Security Middleware', () => {
  describe('validateApiRequest', () => {
    it('accepts valid JSON POST request within size and length limits', async () => {
      const req = new Request('https://tempelink.com/api/media/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '128',
        },
      });

      await expect(validateApiRequest(req)).resolves.not.toThrow();
    });

    it('rejects requests with URL exceeding maxUrlLength with URI_TOO_LONG (414)', async () => {
      const longUrl = 'https://tempelink.com/api/media/resolve?query=' + 'a'.repeat(2100);
      const req = new Request(longUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      await expect(validateApiRequest(req, { maxUrlLength: 2048 })).rejects.toThrow(
        TempelinkError
      );

      try {
        await validateApiRequest(req, { maxUrlLength: 2048 });
      } catch (err) {
        expect((err as TempelinkError).code).toBe('URI_TOO_LONG');
        expect((err as TempelinkError).httpStatus).toBe(414);
      }
    });

    it('rejects POST requests missing application/json content-type', async () => {
      const req = new Request('https://tempelink.com/api/media/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
        },
      });

      await expect(validateApiRequest(req)).rejects.toThrow(TempelinkError);
      try {
        await validateApiRequest(req);
      } catch (err) {
        expect((err as TempelinkError).code).toBe('INVALID_URL');
      }
    });

    it('rejects requests exceeding declared Content-Length header with PAYLOAD_TOO_LARGE (413)', async () => {
      const req = new Request('https://tempelink.com/api/media/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '100000', // 100 KB > 64 KB
        },
      });

      await expect(validateApiRequest(req, { maxBodyBytes: 65536 })).rejects.toThrow(
        TempelinkError
      );

      try {
        await validateApiRequest(req, { maxBodyBytes: 65536 });
      } catch (err) {
        expect((err as TempelinkError).code).toBe('PAYLOAD_TOO_LARGE');
        expect((err as TempelinkError).httpStatus).toBe(413);
      }
    });
  });

  describe('readJsonBody', () => {
    it('successfully parses valid JSON payload within limit', async () => {
      const req = new Request('https://tempelink.com/api/test', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://tiktok.com/@test/video/123' }),
      });

      const body = await readJsonBody<{ url: string }>(req, 1024);
      expect(body.url).toBe('https://tiktok.com/@test/video/123');
    });

    it('rejects payloads exceeding byte limit even without Content-Length header', async () => {
      const hugePayload = JSON.stringify({ data: 'x'.repeat(2000) });
      const req = new Request('https://tempelink.com/api/test', {
        method: 'POST',
        body: hugePayload,
      });

      await expect(readJsonBody(req, 1000)).rejects.toThrow(TempelinkError);
      try {
        const req2 = new Request('https://tempelink.com/api/test', {
          method: 'POST',
          body: hugePayload,
        });
        await readJsonBody(req2, 1000);
      } catch (err) {
        expect((err as TempelinkError).code).toBe('PAYLOAD_TOO_LARGE');
        expect((err as TempelinkError).httpStatus).toBe(413);
      }
    });
  });

  describe('Client IP Extraction & Spoofing Defense', () => {
    it('prioritizes trusted x-vercel-forwarded-for over spoofed x-forwarded-for', () => {
      const req = new Request('https://tempelink.com/api/test', {
        headers: {
          'x-forwarded-for': '1.1.1.1, 2.2.2.2', // Spoofed client header
          'x-vercel-forwarded-for': '203.0.113.195', // Injected by Vercel edge proxy
        },
      });

      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('prioritizes x-real-ip when x-vercel-forwarded-for is not present', () => {
      const req = new Request('https://tempelink.com/api/test', {
        headers: {
          'x-real-ip': '198.51.100.42',
        },
      });

      expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('strips port numbers from IPv4 addresses', () => {
      expect(normalizeIp('192.0.2.1:8080')).toBe('192.0.2.1');
      expect(normalizeIp('203.0.113.5:54321')).toBe('203.0.113.5');
    });

    it('normalizes IPv6 loopback addresses to 127.0.0.1', () => {
      expect(normalizeIp('::1')).toBe('127.0.0.1');
      expect(normalizeIp('0:0:0:0:0:0:0:1')).toBe('127.0.0.1');
    });
  });
});
