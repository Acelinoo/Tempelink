import './load-env';
import { PlatformResolver } from '../src/lib/platforms/resolver';

interface LatencyResult {
  platform: string;
  url: string;
  status: 'SUCCESS' | 'BLOCKED' | 'ERROR';
  latencyMs: number;
  error?: string;
}

const TEST_URLS: Record<string, string> = {
  tiktok: 'https://www.tiktok.com/@mrbeast/video/7572245459951963423',
  instagram: 'https://www.instagram.com/reel/C-iTZ5cg08A/',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  x: 'https://twitter.com/PassengersMovie/status/821025484150423557',
  facebook: 'https://www.facebook.com/reel/1921056328602745',
  pinterest: 'https://www.pinterest.com/pin/70437488608239/',
};

async function measureOne(platform: string, url: string): Promise<LatencyResult> {
  const start = Date.now();
  try {
    const res = await PlatformResolver.resolve(url);
    const latencyMs = Date.now() - start;
    return {
      platform,
      url,
      status: 'SUCCESS',
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const isBlocked = err?.code === 'CONTENT_UNAVAILABLE' && platform === 'pinterest';
    return {
      platform,
      url,
      status: isBlocked ? 'BLOCKED' : 'ERROR',
      latencyMs,
      error: err?.code || err?.message,
    };
  }
}

async function main() {
  console.log('======================================================');
  console.log('TEMPELINK — PHASE 7 PROVIDER LATENCY BENCHMARK');
  console.log('======================================================');

  const results: LatencyResult[] = [];

  for (const [platform, url] of Object.entries(TEST_URLS)) {
    console.log(`[MEASURING] ${platform.toUpperCase()}...`);
    const result = await measureOne(platform, url);
    results.push(result);
    console.log(`  -> Status: ${result.status} | Latency: ${result.latencyMs}ms ${result.error ? `(${result.error})` : ''}`);
  }

  console.log('\n======================================================');
  console.log('SUMMARY TABLE');
  console.log('======================================================');
  console.table(results);
}

main().catch(console.error);
