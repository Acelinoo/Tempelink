import { serverConfig } from '../config';
import { TempelinkError } from '../types/errors';
import { Logger } from '../telemetry/logger';

export interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Bot Challenge & Cloudflare Turnstile Verification
 * Modular bot challenge engine. Fails closed only when explicitly configured via TURNSTILE_SECRET_KEY.
 * Bypasses cleanly in development or when unconfigured, ensuring zero external network dependency.
 */
export async function verifyBotChallenge(
  token?: string,
  clientIp?: string
): Promise<boolean> {
  const secretKey = serverConfig.security.turnstileSecretKey;

  // 1. Bypass cleanly if bot challenge is not configured in this environment
  if (!secretKey) {
    return true;
  }

  // 2. If configured, token must be provided
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new TempelinkError(
      'BOT_CHALLENGE_FAILED',
      'Token verifikasi bot tidak disertakan. Silakan selesaikan tantangan keamanan.'
    );
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!res.ok) {
      throw new Error(`Turnstile endpoint returned HTTP ${res.status}`);
    }

    const data: TurnstileVerifyResponse = await res.json();

    if (!data.success) {
      Logger.warn('[BotChallenge] Turnstile token verification rejected', {
        errors: data['error-codes'],
        clientIp,
      });

      throw new TempelinkError(
        'BOT_CHALLENGE_FAILED',
        'Verifikasi keamanan bot gagal atau token telah kedaluwarsa.'
      );
    }

    return true;
  } catch (err: unknown) {
    if (err instanceof TempelinkError) {
      throw err;
    }

    Logger.error('[BotChallenge] Error contacting Turnstile verify API', err, {
      clientIp,
    });

    throw new TempelinkError(
      'BOT_CHALLENGE_FAILED',
      'Terjadi kesalahan saat memverifikasi keamanan bot. Silakan coba kembali.'
    );
  }
}
