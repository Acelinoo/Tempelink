import './load-env';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import {
  getAllPlatformSlugs,
  getPlatformSeoBySlug,
  getBaseUrl,
} from '../src/lib/seo/platform-seo-data';
import { generateMetadata, generateStaticParams } from '../src/app/[slug]/page';

async function verifySeo() {
  console.log('======================================================');
  console.log('TEMPELINK — PHASE 8 SEO & DISCOVERABILITY VERIFICATION');
  console.log('======================================================\n');

  const baseUrl = getBaseUrl();
  console.log(`[CONFIG] Base URL: ${baseUrl}`);

  // 1. Verify Robots.txt
  console.log('\n[CHECK 1] Verifying robots.txt configuration...');
  const robotsConfig = robots();
  const rule = Array.isArray(robotsConfig.rules)
    ? robotsConfig.rules[0]
    : robotsConfig.rules;
  console.log('  -> Allowed:', rule?.allow);
  console.log('  -> Disallowed:', rule?.disallow);
  console.log('  -> Sitemap reference:', robotsConfig.sitemap);
  if (!rule?.disallow?.includes('/api/')) {
    throw new Error('FAILED: robots.txt does not disallow /api/');
  }
  console.log('  [PASS] robots.txt is properly configured.');

  // 2. Verify Sitemap.xml
  console.log('\n[CHECK 2] Verifying sitemap.xml generation...');
  const sitemapEntries = sitemap();
  console.log(`  -> Total indexed canonical routes: ${sitemapEntries.length}`);
  sitemapEntries.forEach((entry) => {
    console.log(`     - [${entry.changeFrequency?.toUpperCase()}] Priority ${entry.priority}: ${entry.url}`);
    if (entry.url.includes('/api/')) {
      throw new Error(`FAILED: sitemap contains API route: ${entry.url}`);
    }
  });
  if (sitemapEntries.length !== 7) {
    throw new Error(`FAILED: Expected 7 canonical sitemap routes, found ${sitemapEntries.length}`);
  }
  console.log('  [PASS] sitemap.xml generated with exact canonical indexable routes.');

  // 3. Verify Platform Landing Pages & Metadata
  console.log('\n[CHECK 3] Verifying Platform Landing Pages & Metadata...');
  const slugs = getAllPlatformSlugs();
  const staticParams = generateStaticParams();
  console.log(`  -> Static params registered: ${staticParams.length} slugs`);

  for (const slug of slugs) {
    const config = getPlatformSeoBySlug(slug);
    if (!config) throw new Error(`Missing config for slug: ${slug}`);

    const meta = await generateMetadata({ params: Promise.resolve({ slug }) });
    console.log(`\n  [PLATFORM: ${config.name}]`);
    console.log(`    - Route: /${slug}`);
    console.log(`    - H1: "${config.h1}"`);
    console.log(`    - Title: "${meta.title}"`);
    console.log(`    - Canonical: ${meta.alternates?.canonical}`);
    console.log(`    - FAQs: ${config.faqs.length} items`);
    console.log(`    - Supported Formats: ${config.supportedFormats.length} options`);

    if (!meta.alternates?.canonical || !meta.title || !meta.description) {
      throw new Error(`FAILED: Incomplete metadata for ${slug}`);
    }
  }

  console.log('\n======================================================');
  console.log('ALL SEO CHECKS, CANONICALS & METADATA VERIFIED (PASS)!');
  console.log('======================================================');
}

verifySeo().catch((err) => {
  console.error('SEO Verification failed:', err);
  process.exit(1);
});
