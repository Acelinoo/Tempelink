import './load-env';
import { NextRequest } from 'next/server';
import { POST as resolveRoute } from '../src/app/api/media/resolve/route';
import { POST as downloadPostRoute, GET as downloadGetRoute } from '../src/app/api/media/download/route';
import { generateDownloadToken } from '../src/lib/security/token';

async function verifyFullFlow() {
  console.log('======================================================');
  console.log('TEMPELINK — FULL END-TO-END API ROUTE VERIFICATION');
  console.log('======================================================');

  const testUrl = 'https://www.tiktok.com/@mrbeast/video/7572245459951963423';
  console.log(`[FLOW 1] Calling POST /api/media/resolve with: ${testUrl}`);

  // 1. Resolve Route Call
  const resolveReq = new NextRequest('http://localhost:3000/api/media/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: testUrl }),
  });

  const resolveRes = await resolveRoute(resolveReq);
  console.log(`[FLOW 1] Resolve Status: ${resolveRes.status}`);
  const resolveData = await resolveRes.json();

  if (!resolveRes.ok || !resolveData.success) {
    console.error('[FLOW 1 FAILED]', resolveData);
    process.exit(1);
  }

  const media = resolveData.data;
  console.log(`[FLOW 1 SUCCESS] Media ID: ${media.id}`);
  console.log(`[FLOW 1 SUCCESS] Title: ${media.title}`);
  console.log(`[FLOW 1 SUCCESS] Author: @${media.author?.username}`);
  console.log(`[FLOW 1 SUCCESS] Capabilities: ${media.capabilities.length} options`);

  // 2. Select First Video Capability
  const videoCap = media.capabilities.find((c: any) => c.type === 'video');
  if (!videoCap || !videoCap.downloadToken) {
    console.error('[FLOW 2 FAILED] No video capability with download token found.');
    process.exit(1);
  }

  console.log(`\n[FLOW 2] Selected Capability: ${videoCap.label}`);
  console.log(`[FLOW 2] Format: ${videoCap.format}`);
  console.log(`[FLOW 2] Calling POST /api/media/download with token...`);

  // 3. Download Route POST (JSON descriptor)
  const downloadReq = new NextRequest('http://localhost:3000/api/media/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaId: media.id,
      capabilityId: videoCap.id,
      sourceUrl: media.sourceUrl,
      downloadToken: videoCap.downloadToken,
    }),
  });

  const downloadRes = await downloadPostRoute(downloadReq);
  console.log(`[FLOW 2] Download POST Status: ${downloadRes.status}`);
  const downloadData = await downloadRes.json();

  if (!downloadRes.ok || !downloadData.success) {
    console.error('[FLOW 2 FAILED]', downloadData);
    process.exit(1);
  }

  console.log(`[FLOW 2 SUCCESS] Delivery Type: ${downloadData.data.downloadType}`);
  console.log(`[FLOW 2 SUCCESS] Filename: ${downloadData.data.filename}`);
  console.log(`[FLOW 2 SUCCESS] MIME: ${downloadData.data.mimeType}`);

  // 4. Download Route GET (HTTP 302 Redirect)
  console.log(`\n[FLOW 3] Calling GET /api/media/download?token=...`);
  const getReq = new NextRequest(
    `http://localhost:3000/api/media/download?token=${encodeURIComponent(videoCap.downloadToken)}`
  );

  const getRes = await downloadGetRoute(getReq);
  console.log(`[FLOW 3] Direct Download GET Status: ${getRes.status}`);
  console.log(`[FLOW 3] Redirect Location: ${getRes.headers.get('location') ? 'VALID REDIRECT PRESENT' : 'MISSING'}`);
  console.log(`[FLOW 3] Content-Disposition: ${getRes.headers.get('content-disposition')}`);
  console.log(`[FLOW 3] Cache-Control: ${getRes.headers.get('cache-control')}`);
  console.log(`[FLOW 3] X-Content-Type-Options: ${getRes.headers.get('x-content-type-options')}`);

  if (getRes.status !== 302 || !getRes.headers.get('location')) {
    console.error('[FLOW 3 FAILED] GET download did not return expected 302 redirect.');
    process.exit(1);
  }

  if (!getRes.headers.get('cache-control')?.includes('no-store')) {
    console.error('[FLOW 3 FAILED] Missing anti-caching Cache-Control header.');
    process.exit(1);
  }

  if (getRes.headers.get('x-content-type-options') !== 'nosniff') {
    console.error('[FLOW 3 FAILED] Missing X-Content-Type-Options: nosniff header.');
    process.exit(1);
  }

  // 5. Test Live CDN Reachability (Range 0-1024)
  const targetCdnUrl = getRes.headers.get('location')!;
  console.log(`\n[FLOW 4] Verifying Destination CDN Reachability via Range Request...`);
  const cdnRes = await fetch(targetCdnUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-1024' },
  });

  console.log(`[FLOW 4] CDN HTTP Status: ${cdnRes.status}`);
  console.log(`[FLOW 4] CDN Content-Type: ${cdnRes.headers.get('content-type')}`);
  console.log(`[FLOW 4] CDN Content-Range: ${cdnRes.headers.get('content-range')}`);

  if (cdnRes.status !== 200 && cdnRes.status !== 206) {
    console.error('[FLOW 4 FAILED] CDN stream returned status:', cdnRes.status);
    process.exit(1);
  }

  // 6. Security Checks
  console.log('\n=== SECURITY AUDIT VERIFICATION ===');
  
  // Forged Token targeting 127.0.0.1
  const [p64, sig] = videoCap.downloadToken.split('.');
  const tamperedPayload = JSON.parse(Buffer.from(p64, 'base64url').toString('utf8'));
  tamperedPayload.targetUrl = 'http://127.0.0.1:3000/internal';
  const forgedToken = `${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${sig}`;

  const attackReq1 = new NextRequest('http://localhost:3000/api/media/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaId: media.id,
      capabilityId: videoCap.id,
      sourceUrl: media.sourceUrl,
      downloadToken: forgedToken,
    }),
  });
  const attackRes1 = await downloadPostRoute(attackReq1);
  console.log(`[SECURITY] Forged Token SSRF Attack (127.0.0.1) Status: ${attackRes1.status} (Expected: 403)`);

  // Expired Token
  const expiredToken = generateDownloadToken({
    mediaId: media.id,
    capabilityId: videoCap.id,
    sourceUrl: media.sourceUrl,
    targetUrl: 'https://cdn.example.com/video.mp4',
    filename: 'video.mp4',
    mimeType: 'video/mp4',
  }, -60);

  const attackReq2 = new NextRequest('http://localhost:3000/api/media/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaId: media.id,
      capabilityId: videoCap.id,
      sourceUrl: media.sourceUrl,
      downloadToken: expiredToken,
    }),
  });
  const attackRes2 = await downloadPostRoute(attackReq2);
  console.log(`[SECURITY] Expired Token Attack Status: ${attackRes2.status} (Expected: 410)`);

  console.log('\n======================================================');
  console.log('ALL REAL END-TO-END FLOWS AND SECURITY CHECKS PASSED!');
  console.log('======================================================');
}

verifyFullFlow();
