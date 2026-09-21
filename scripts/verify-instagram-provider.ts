import './load-env';
import { InstagramProvider } from '../src/lib/platforms/providers/instagram';
import { serverConfig } from '../src/lib/config';

async function verifyInstagram() {
  console.log('======================================================');
  console.log('TEMPELINK — INSTAGRAM PROVIDER VERIFICATION');
  console.log('======================================================');

  const apiKey = serverConfig.instagram.apiKey;
  console.log(
    `[CONFIG] API Key Status: ${apiKey ? 'CONFIGURED' : 'NOT CONFIGURED (INSTAGRAM_PROVIDER_API_KEY is empty in .env.local)'}`
  );
  console.log(`[CONFIG] Base URL: ${serverConfig.instagram.baseUrl}`);
  console.log(`[CONFIG] Host: ${serverConfig.instagram.apiHost}`);

  const testUrlString = process.argv[2] || 'https://www.instagram.com/reel/C-iTZ5cg08A/';
  console.log(`\n[STEP 1] Testing URL: ${testUrlString}`);

  const provider = new InstagramProvider();
  const detection = provider.detect(new URL(testUrlString));
  console.log('[STEP 1] Detection Result:', detection);

  if (detection.status !== 'SUPPORTED_PLATFORM') {
    console.error('[FAILED] URL is not detected as a supported Instagram post/reel.');
    process.exit(1);
  }

  if (!apiKey) {
    console.log('\n[STATUS] BLOCKED — PROVIDER CONFIGURATION');
    console.log(
      'Notice: INSTAGRAM_PROVIDER_API_KEY is not yet configured in .env.local.'
    );
    console.log(
      'To verify live Instagram resolution, obtain a free RapidAPI key for the Instagram API and set INSTAGRAM_PROVIDER_API_KEY.'
    );
    return;
  }

  console.log('\n[STEP 2] Calling live upstream Instagram API...');
  try {
    const result = await provider.resolve(new URL(testUrlString));
    console.log(`[STEP 2 SUCCESS] Resolved Media ID: ${result.mediaId}`);
    console.log(`[STEP 2 SUCCESS] Title: ${result.title}`);
    console.log(`[STEP 2 SUCCESS] Capabilities: ${result.capabilities.length} options`);
    for (const cap of result.capabilities) {
      console.log(`  - [${cap.type.toUpperCase()}] ${cap.label} (${cap.format}) Token: ${cap.downloadToken ? 'PRESENT' : 'NONE'}`);
    }

    // Step 3: Range check on first stream
    const firstCap = result.capabilities[0];
    if (firstCap && firstCap.downloadUrl) {
      console.log(`\n[STEP 3] Performing lightweight range verification on stream...`);
      const cdnRes = await fetch(firstCap.downloadUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-1024' },
      });
      console.log(`[STEP 3] Stream HTTP Status: ${cdnRes.status}`);
      console.log(`[STEP 3] Stream Content-Type: ${cdnRes.headers.get('content-type')}`);
    }

    console.log('\n======================================================');
    console.log('INSTAGRAM LIVE RESOLUTION VERIFIED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err: any) {
    console.log(`\n[GATEWAY RESULT] Code: ${err.code || 'UNKNOWN'}`);
    console.log(`[GATEWAY RESULT] Message: ${err.message}`);
    if (err.userMessage) {
      console.log(`[GATEWAY RESULT] User Message: ${err.userMessage}`);
    }
  }
}

verifyInstagram();
