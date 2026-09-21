/**
 * Developer Verification Utility: Real TikTok Provider Verification
 *
 * Usage:
 *   npx tsx scripts/verify-tiktok-provider.ts [optional-tiktok-url]
 *
 * Requirements:
 * - Reads server-side environment variables safely
 * - NEVER prints or logs API keys, auth headers, or sensitive secrets
 * - Returns non-zero exit code on failure
 * - Never saves media files permanently to disk
 */

import './load-env';

import { TikTokProvider } from '../src/lib/platforms/providers/tiktok';
import { serverConfig } from '../src/lib/config';
import { normalizeAndParseUrl } from '../src/lib/security/sanitizer';
import { validateUrlSafety } from '../src/lib/security/ssrf';
import { verifyDownloadToken } from '../src/lib/security/token';

async function main() {
  console.log('======================================================');
  console.log('TEMPELINK — REAL TIKTOK PROVIDER VERIFICATION UTILITY');
  console.log('======================================================');

  // 1. Audit Environment & Secrets (NEVER PRINT SECRETS)
  const isKeyConfigured = Boolean(serverConfig.tiktok.apiKey && serverConfig.tiktok.apiKey.trim().length > 0);
  console.log(`[CONFIG] Provider API Key:       ${isKeyConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`[CONFIG] Provider Host:          ${serverConfig.tiktok.apiHost}`);
  console.log(`[CONFIG] Provider Base URL:      ${serverConfig.tiktok.baseUrl}`);
  console.log(`[CONFIG] Timeout (ms):           ${serverConfig.tiktok.resolveTimeoutMs}`);
  console.log(`[CONFIG] Max Retries:            ${serverConfig.tiktok.maxRetries}`);
  console.log(`[CONFIG] Signing Secret Status:  ${serverConfig.download.signingSecret ? 'CONFIGURED' : 'MISSING'}`);
  console.log('------------------------------------------------------');

  if (!isKeyConfigured) {
    console.error('\n[BLOCKED — PROVIDER NOT CONFIGURED]');
    console.error('TIKTOK_PROVIDER_API_KEY is not set in the current environment.');
    console.error('To run live external verification against the RapidAPI/TikTok gateway:');
    console.error('  1. Add TIKTOK_PROVIDER_API_KEY=<your_key> to .env.local');
    console.error('  2. Run: npx tsx scripts/verify-tiktok-provider.ts [tiktok-url]\n');
    process.exit(1);
  }

  // 2. Determine target test URL
  const rawUrl =
    process.argv[2] ||
    'https://www.tiktok.com/@tiktok/video/7123456789012345678';

  console.log(`[TARGET] Input URL: ${rawUrl}`);

  try {
    // 3. SSRF & URL Sanitization
    const parsedUrl = normalizeAndParseUrl(rawUrl);
    validateUrlSafety(parsedUrl);
    console.log(`[VALIDATION] URL Sanitization & SSRF Perimeter Check: PASS`);

    // 4. Resolve via Real Provider
    const provider = new TikTokProvider();
    console.log(`[EXECUTION] Calling upstream provider (${serverConfig.tiktok.apiHost})...`);

    const startTime = Date.now();
    const resolution = await provider.resolve(parsedUrl, {
      correlationId: `cli_verify_${Date.now()}`,
    });
    const durationMs = Date.now() - startTime;

    console.log(`[SUCCESS] Upstream resolution completed in ${durationMs}ms`);
    console.log(`[METADATA] Media ID:    ${resolution.mediaId}`);
    console.log(`[METADATA] Title:       ${resolution.title}`);
    console.log(`[METADATA] Author:      ${resolution.author?.name || resolution.author?.username || 'N/A'}`);
    console.log(`[METADATA] Duration:    ${resolution.durationSeconds ? `${resolution.durationSeconds}s` : 'N/A'}`);
    console.log(`[CAPABILITIES] Extracted ${resolution.capabilities.length} options:`);

    for (const cap of resolution.capabilities) {
      console.log(`  - [${cap.type.toUpperCase()}] ${cap.label} (${cap.format}) | Quality: ${cap.qualityCategory}`);
      
      // Verify download token integrity
      if (cap.downloadToken) {
        const tokenPayload = verifyDownloadToken(cap.downloadToken);
        console.log(`    Token Signature: VALID (Expires: ${new Date(tokenPayload.expiresAt).toISOString()})`);
      }
    }

    // 5. Test Delivery of First Playable Stream (Lightweight Range Request)
    const firstPlayable = resolution.capabilities.find((c) => c.type === 'video');
    if (firstPlayable && firstPlayable.downloadToken) {
      const payload = verifyDownloadToken(firstPlayable.downloadToken);
      console.log(`\n[DOWNLOAD TEST] Verifying reachability of stream destination...`);
      
      const streamRes = await fetch(payload.targetUrl, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-1024', // First 1KB sample to verify container without downloading full file
        },
      });

      console.log(`[DOWNLOAD TEST] HTTP Status: ${streamRes.status}`);
      console.log(`[DOWNLOAD TEST] Content-Type: ${streamRes.headers.get('content-type')}`);
      console.log(`[DOWNLOAD TEST] Content-Length: ${streamRes.headers.get('content-length')} bytes`);

      if (streamRes.status !== 200 && streamRes.status !== 206) {
        throw new Error(`Upstream CDN returned unexpected status: ${streamRes.status}`);
      }

      console.log(`[DOWNLOAD TEST] CDN Stream Delivery: VERIFIED ACCESSIBLE`);
    }

    console.log('\n======================================================');
    console.log('RESULT: REAL END-TO-END PROVIDER VERIFICATION PASSED');
    console.log('======================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('\n[ERROR] Verification failed:');
    if (err instanceof Error) {
      console.error(`  Name:    ${err.name}`);
      console.error(`  Message: ${err.message}`);
    } else {
      console.error(' ', err);
    }
    console.log('\n======================================================');
    console.log('RESULT: VERIFICATION FAILED');
    console.log('======================================================');
    process.exit(1);
  }
}

main();
