import { describe, it, expect, afterEach } from 'vitest';
import { generateDownloadToken, verifyDownloadToken } from '../src/lib/security/token';
import { TempelinkError } from '../src/lib/types/errors';

describe('Download Token Security System', () => {
  const samplePayload = {
    mediaId: 'tt_123456789',
    capabilityId: 'cap_video_hd',
    sourceUrl: 'https://www.tiktok.com/@creator/video/123456789',
    targetUrl: 'https://cdn.tiktok.example/stream_1080p.mp4',
    filename: 'tiktok_123456789_1080p.mp4',
    mimeType: 'video/mp4',
  };

  it('generates a valid signed token string with two base64url segments', () => {
    const token = generateDownloadToken(samplePayload);
    expect(typeof token).toBe('string');
    const parts = token.split('.');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBeGreaterThan(10);
    expect(parts[1].length).toBeGreaterThan(10);
  });

  it('verifies a valid token and extracts original payload', () => {
    const token = generateDownloadToken(samplePayload);
    const verified = verifyDownloadToken(token);

    expect(verified.mediaId).toBe(samplePayload.mediaId);
    expect(verified.capabilityId).toBe(samplePayload.capabilityId);
    expect(verified.targetUrl).toBe(samplePayload.targetUrl);
    expect(verified.filename).toBe(samplePayload.filename);
    expect(verified.mimeType).toBe(samplePayload.mimeType);
    expect(verified.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects forged tokens with altered payload', () => {
    const token = generateDownloadToken(samplePayload);
    const [payloadBase64, signature] = token.split('.');

    // Tamper with payload to target an internal metadata service
    const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    decoded.targetUrl = 'http://169.254.169.254/latest/meta-data/';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const forgedToken = `${tamperedPayload}.${signature}`;

    expect(() => verifyDownloadToken(forgedToken)).toThrowError(TempelinkError);
    try {
      verifyDownloadToken(forgedToken);
    } catch (err: unknown) {
      expect((err as TempelinkError).code).toBe('SSRF_BLOCKED');
    }
  });

  it('rejects forged tokens with altered signature', () => {
    const token = generateDownloadToken(samplePayload);
    const [payloadBase64] = token.split('.');
    const invalidSignature = 'invalid_signature_1234567890abcdef_inval';
    const forgedToken = `${payloadBase64}.${invalidSignature}`;

    expect(() => verifyDownloadToken(forgedToken)).toThrowError(TempelinkError);
  });

  it('rejects expired tokens with MEDIA_URL_EXPIRED', () => {
    // Generate token with negative expiry (-10 seconds)
    const expiredToken = generateDownloadToken(samplePayload, -10);

    expect(() => verifyDownloadToken(expiredToken)).toThrowError(TempelinkError);
    try {
      verifyDownloadToken(expiredToken);
    } catch (err: unknown) {
      expect((err as TempelinkError).code).toBe('MEDIA_URL_EXPIRED');
      expect((err as TempelinkError).httpStatus).toBe(410);
    }
  });

  it('rejects malformed token strings', () => {
    // Missing dot
    expect(() => verifyDownloadToken('invalid-token-no-dot')).toThrowError(TempelinkError);
    // Too many dots
    expect(() => verifyDownloadToken('a.b.c')).toThrowError(TempelinkError);
    // Empty token
    expect(() => verifyDownloadToken('')).toThrowError(TempelinkError);
    // Invalid JSON payload
    const invalidJsonBase64 = Buffer.from('not a json object').toString('base64url');
    expect(() => verifyDownloadToken(`${invalidJsonBase64}.fakesignature`)).toThrowError(TempelinkError);
  });

  it('rejects tokens with missing or invalid payload fields', () => {
    const validToken = generateDownloadToken(samplePayload);
    const [payloadBase64, signature] = validToken.split('.');
    const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));

    // Test missing required field (e.g. mimeType deleted)
    const withoutMime = { ...decoded };
    delete withoutMime.mimeType;
    const tamperedPayload = Buffer.from(JSON.stringify(withoutMime)).toString('base64url');
    expect(() => verifyDownloadToken(`${tamperedPayload}.${signature}`)).toThrowError(TempelinkError);

    // Test non-number expiresAt
    const badExpiry = { ...decoded, expiresAt: 'not-a-timestamp' };
    const tamperedPayload2 = Buffer.from(JSON.stringify(badExpiry)).toString('base64url');
    expect(() => verifyDownloadToken(`${tamperedPayload2}.${signature}`)).toThrowError(TempelinkError);
  });

  it('automatically sanitizes filename during token generation', () => {
    const dirtyPayload = {
      ...samplePayload,
      filename: '../../evil\r\nName<>.mp4',
    };
    const token = generateDownloadToken(dirtyPayload);
    const verified = verifyDownloadToken(token);
    expect(verified.filename).not.toContain('../');
    expect(verified.filename).not.toContain('\r');
    expect(verified.filename).not.toContain('\n');
    expect(verified.filename).not.toContain('<');
  });

  describe('Production Secret Hardening', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.DOWNLOAD_SIGNING_SECRET;

    afterEach(() => {
      (process.env as Record<string, string | undefined>)['NODE_ENV'] = originalEnv;
      process.env.DOWNLOAD_SIGNING_SECRET = originalSecret;
    });

    it('fails closed in production if DOWNLOAD_SIGNING_SECRET is missing or default', async () => {
      const { getDownloadSigningSecret } = await import('../src/lib/config');

      (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
      delete process.env.DOWNLOAD_SIGNING_SECRET;

      expect(() => getDownloadSigningSecret()).toThrowError(TempelinkError);
      try {
        getDownloadSigningSecret();
      } catch (err: unknown) {
        expect((err as TempelinkError).code).toBe('INTERNAL_ERROR');
        expect((err as TempelinkError).message).toContain('DOWNLOAD_SIGNING_SECRET');
      }

      // If set to development default
      process.env.DOWNLOAD_SIGNING_SECRET = 'tempelink_dev_secret_signing_key_32_chars';
      expect(() => getDownloadSigningSecret()).toThrowError(TempelinkError);

      // If shorter than 32 characters
      process.env.DOWNLOAD_SIGNING_SECRET = 'too_short_key';
      expect(() => getDownloadSigningSecret()).toThrowError(TempelinkError);
    });

    it('allows secure 32+ character key in production', async () => {
      const { getDownloadSigningSecret } = await import('../src/lib/config');

      (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
      process.env.DOWNLOAD_SIGNING_SECRET = 'a_very_secure_random_production_signing_key_9999!';

      expect(getDownloadSigningSecret()).toBe(
        'a_very_secure_random_production_signing_key_9999!'
      );
    });
  });
});

