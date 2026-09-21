import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, checkBruteForce, recordFailedAttempt, clearBruteForce, createSession, destroySession, extractSessionId, buildSetCookieHeader, buildClearCookieHeader } from '@/lib/admin/auth';
import { logAdminAccess } from '@/lib/admin/db';
import { getClientIp } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/admin/auth — Login with PIN
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1. Brute-force check
  const bf = checkBruteForce(ip);
  if (!bf.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.' },
      { status: 429 }
    );
  }

  // 2. Parse body
  let pin: string = '';
  try {
    const body = await req.json();
    pin = String(body?.pin ?? '');
  } catch {
    return NextResponse.json({ success: false, error: 'Format permintaan tidak valid.' }, { status: 400 });
  }

  // 3. Verify PIN
  const valid = verifyPin(pin);
  if (!valid) {
    const lockResult = recordFailedAttempt(ip);
    const message = lockResult.locked
      ? 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.'
      : 'PIN tidak valid.';
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  // 4. Create session
  try {
    const sessionId = await createSession();
    clearBruteForce(ip);
    await logAdminAccess('login_success');

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': buildSetCookieHeader(sessionId),
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal membuat sesi.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/auth — Logout
 */
export async function DELETE(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  const sessionId = extractSessionId(cookieHeader);

  if (sessionId) {
    await destroySession(sessionId);
    await logAdminAccess('logout');
  }

  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': buildClearCookieHeader(),
        'Cache-Control': 'no-store',
      },
    }
  );
}
