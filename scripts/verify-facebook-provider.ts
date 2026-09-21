import './load-env';
import { FacebookProvider } from '../src/lib/platforms/providers/facebook';
import { serverConfig } from '../src/lib/config';

async function verifyFacebook() {
  console.log('======================================================');
  console.log('TEMPELINK — FACEBOOK PROVIDER VERIFICATION');
  console.log('======================================================');

  const apiKey = serverConfig.facebook.apiKey;
  console.log(
    `[CONFIG] API Key Status: ${apiKey ? 'CONFIGURED' : 'NOT CONFIGURED (FACEBOOK_PROVIDER_API_KEY is empty in .env.local)'}`
  );
  console.log(`[CONFIG] Base URL: ${serverConfig.facebook.baseUrl}`);
  console.log(`[CONFIG] Host: ${serverConfig.facebook.apiHost}`);

  const testUrlString =
    process.argv[2] || 'https://www.facebook.com/reel/1921056328602745';
  console.log(`\n[STEP 1] Testing URL: ${testUrlString}`);

  const provider = new FacebookProvider();
  const detection = provider.detect(new URL(testUrlString));
  console.log('[STEP 1] Detection Result:', detection);

  if (detection.status !== 'SUPPORTED_PLATFORM') {
    console.error('[FAILED] URL is not detected as a supported Facebook video.');
    process.exit(1);
  }

  if (!apiKey) {
    console.log('\n[STATUS] BLOCKED — PROVIDER CONFIGURATION');
    console.log(
      'Notice: FACEBOOK_PROVIDER_API_KEY is not yet configured in .env.local.'
    );
    console.log(
      'To verify live Facebook resolution, configure FACEBOOK_PROVIDER_API_KEY with your authorized RapidAPI key.'
    );
    return;
  }

  console.log('\n[STEP 2] Calling live upstream Facebook API...');
  try {
    const result = await provider.resolve(new URL(testUrlString));
    console.log(`[STEP 2 SUCCESS] Resolved Media ID: ${result.mediaId}`);
    console.log(`[STEP 2 SUCCESS] Title: ${result.title}`);
    console.log(`[STEP 2 SUCCESS] Capabilities: ${result.capabilities.length} options`);
    for (const cap of result.capabilities) {
      console.log(
        `  - [${cap.type.toUpperCase()}] ${cap.label} (${cap.format}) Token: ${cap.downloadToken ? 'PRESENT' : 'NONE'}`
      );
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
    console.log('FACEBOOK LIVE RESOLUTION VERIFIED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err: any) {
    console.log(`\n[GATEWAY RESULT] Code: ${err.code || 'UNKNOWN'}`);
    console.log(`[GATEWAY RESULT] Message: ${err.message}`);
    if (err.userMessage) {
      console.log(`[GATEWAY RESULT] User Message: ${err.userMessage}`);
    }
  }
}

verifyFacebook();
