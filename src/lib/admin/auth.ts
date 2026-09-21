/**
 * Tempelink Admin — Auth utilities
 *
 * PIN verification, session cookie helpers, brute-force rate limiting.
 * PIN is stored as server-only env var ADMIN_PIN — never sent to client.
 */

import crypto from 'crypto';
import { validateAdminSession, createAdminSession, deleteAdminSession, logAdminAccess } from './db';

// ─── PIN ─────────────────────────────────────────────────────────────────────

const DEV_DEFAULT_PIN = '060103';

export function getAdminPin(): string {
  return (process.env.ADMIN_PIN || DEV_DEFAULT_PIN).trim();
}

/**
 * Timing-safe PIN comparison to prevent timing attacks.
 */
export function verifyPin(input: string): boolean {
  const expected = getAdminPin();
  if (!input || typeof input !== 'string') return false;

  // Timing-safe compare using fixed-length buffers
  try {
    const inputBuf = Buffer.alloc(64);
    const expectedBuf = Buffer.alloc(64);
    inputBuf.write(input);
    expectedBuf.write(expected);
    return crypto.timingSafeEqual(inputBuf, expectedBuf) && input === expected;
  } catch {
    return false;
  }
}

// ─── Session Cookie ───────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = 'tempelink_admin_sid';
const SESSION_TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || '8');

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function createSession(): Promise<string> {
  const sessionId = generateSessionId();
  await createAdminSession(sessionId, SESSION_TTL_HOURS);
  return sessionId;
}

export async function checkSession(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return false;
  return validateAdminSession(sessionId);
}

export async function destroySession(sessionId: string): Promise<void> {
  await deleteAdminSession(sessionId);
}

// ─── Cookie Header Builders ───────────────────────────────────────────────────

export function buildSetCookieHeader(sessionId: string): string {
  const maxAge = SESSION_TTL_HOURS * 3600;
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/admin${secure}`;
}

export function buildClearCookieHeader(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/admin${secure}`;
}

/**
 * Extracts the session ID from a Cookie header string.
 */
export function extractSessionId(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? match.slice(SESSION_COOKIE_NAME.length + 1) : undefined;
}

// ─── Brute-force Protection (In-Memory, same pattern as rate-limiter.ts) ──────

interface BruteRecord {
  attempts: number;
  lockedUntil: number;
}

const bruteMap = new Map<string, BruteRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkBruteForce(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = bruteMap.get(ip);

  if (record && now < record.lockedUntil) {
    return { allowed: false, remaining: 0 };
  }

  if (!record || now >= record.lockedUntil) {
    record = { attempts: 0, lockedUntil: 0 };
    bruteMap.set(ip, record);
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return { allowed: true, remaining };
}

export function recordFailedAttempt(ip: string): { locked: boolean } {
  const now = Date.now();
  let record = bruteMap.get(ip);

  if (!record) {
    record = { attempts: 0, lockedUntil: 0 };
    bruteMap.set(ip, record);
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    logAdminAccess('login_failed').catch(() => {});
    return { locked: true };
  }

  logAdminAccess('login_failed').catch(() => {});
  return { locked: false };
}

export function clearBruteForce(ip: string): void {
  bruteMap.delete(ip);
}
