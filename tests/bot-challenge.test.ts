import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyBotChallenge } from '../src/lib/security/bot-challenge';
import { serverConfig } from '../src/lib/config';
import { TempelinkError } from '../src/lib/types/errors';

describe('Phase 9 — Bot Challenge & Turnstile Security Verification', () => {
  const originalSecret = serverConfig.security.turnstileSecretKey;

  beforeEach(() => {
    serverConfig.security.turnstileSecretKey = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    serverConfig.security.turnstileSecretKey = originalSecret;
  });

  it('bypasses cleanly and allows requests when turnstile is unconfigured', async () => {
    // Zero network calls, frictionless access for development and standard deployments
    const result = await verifyBotChallenge(undefined, '127.0.0.1');
    expect(result).toBe(true);
  });

  it('rejects missing or empty token when turnstile is configured', async () => {
    serverConfig.security.turnstileSecretKey = 'mock_secret_key_12345';

    await expect(verifyBotChallenge('', '127.0.0.1')).rejects.toThrow(TempelinkError);

    try {
      await verifyBotChallenge(undefined, '127.0.0.1');
    } catch (err) {
      expect((err as TempelinkError).code).toBe('BOT_CHALLENGE_FAILED');
      expect((err as TempelinkError).httpStatus).toBe(403);
    }
  });

  it('rejects invalid token when Turnstile siteverify returns success: false', async () => {
    serverConfig.security.turnstileSecretKey = 'mock_secret_key_12345';

    // Mock fetch to simulate Cloudflare rejection
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      verifyBotChallenge('invalid_turnstile_token', '127.0.0.1')
    ).rejects.toThrow(TempelinkError);
  });

  it('allows request when Turnstile siteverify returns success: true', async () => {
    serverConfig.security.turnstileSecretKey = 'mock_secret_key_12345';

    // Mock fetch to simulate Cloudflare approval
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, challenge_ts: '2026-09-21T12:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await verifyBotChallenge('valid_turnstile_token', '127.0.0.1');
    expect(result).toBe(true);
  });
});
