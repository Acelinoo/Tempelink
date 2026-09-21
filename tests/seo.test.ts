import { describe, it, expect, vi } from 'vitest';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import {
  PLATFORM_SEO_REGISTRY,
  getAllPlatformSlugs,
  getPlatformSeoBySlug,
  getBaseUrl,
} from '../src/lib/seo/platform-seo-data';
import { generateMetadata, generateStaticParams } from '../src/app/[slug]/page';

describe('Phase 8 — SEO, Platform Landing Pages & Discoverability', () => {
  const baseUrl = getBaseUrl();
  const expectedSlugs = [
    'tiktok-downloader',
    'instagram-downloader',
    'youtube-downloader',
    'twitter-downloader',
    'facebook-downloader',
    'pinterest-downloader',
  ];

  describe('1. Platform SEO Data & Registry Integrity', () => {
    it('contains all 6 verified platform configurations', () => {
      const slugs = getAllPlatformSlugs();
      expect(slugs).toHaveLength(6);
      expect(slugs.sort()).toEqual(expectedSlugs.sort());
    });

    it('ensures each platform has distinct, non-duplicate titles and descriptions', () => {
      const titles = new Set<string>();
      const descriptions = new Set<string>();

      expectedSlugs.forEach((slug) => {
        const config = getPlatformSeoBySlug(slug);
        expect(config).toBeDefined();
        if (config) {
          expect(config.title.length).toBeGreaterThan(20);
          expect(config.description.length).toBeGreaterThan(50);
          expect(titles.has(config.title)).toBe(false);
          expect(descriptions.has(config.description)).toBe(false);
          titles.add(config.title);
          descriptions.add(config.description);
        }
      });
    });

    it('ensures honest capability disclosures (no fake 4K or upscaling claims)', () => {
      expectedSlugs.forEach((slug) => {
        const config = getPlatformSeoBySlug(slug);
        if (config) {
          const content = JSON.stringify(config).toLowerCase();
          expect(content).not.toContain('upscale 4k');
          expect(content).not.toContain('100% guaranteed private');
        }
      });
    });
  });

  describe('2. Sitemap Generation', () => {
    it('generates a valid sitemap containing all 11 canonical routes', () => {
      const sitemapEntries = sitemap();
      expect(sitemapEntries).toHaveLength(11);

      const urls = sitemapEntries.map((e) => e.url);
      expect(urls).toContain(baseUrl);
      expect(urls).toContain(`${baseUrl}/about`);
      expect(urls).toContain(`${baseUrl}/privacy`);
      expect(urls).toContain(`${baseUrl}/terms`);
      expect(urls).toContain(`${baseUrl}/contact`);
      expectedSlugs.forEach((slug) => {
        expect(urls).toContain(`${baseUrl}/${slug}`);
      });
    });

    it('strictly excludes API and dynamic user-generated routes from sitemap', () => {
      const sitemapEntries = sitemap();
      sitemapEntries.forEach((entry) => {
        expect(entry.url).not.toContain('/api/');
        expect(entry.url).not.toContain('/batch/');
        expect(entry.url).not.toContain('?url=');
      });
    });
  });

  describe('3. Robots.txt Generation', () => {
    it('allows public pages and disallows API routes', () => {
      const robotsConfig = robots();
      expect(robotsConfig.rules).toBeDefined();

      const rules = Array.isArray(robotsConfig.rules)
        ? robotsConfig.rules[0]
        : robotsConfig.rules;

      expect(rules.allow).toContain('/');
      expect(rules.disallow).toContain('/api/');
      expect(robotsConfig.sitemap).toBe(`${baseUrl}/sitemap.xml`);
    });
  });

  describe('4. Metadata & Static Params Generation', () => {
    it('generates static params for all 6 platform landing pages', () => {
      const params = generateStaticParams();
      expect(params).toHaveLength(6);
      expect(params.map((p) => p.slug).sort()).toEqual(expectedSlugs.sort());
    });

    it('generates rich metadata with canonical URL for every platform page', async () => {
      for (const slug of expectedSlugs) {
        const meta = await generateMetadata({ params: Promise.resolve({ slug }) });
        expect(meta.title).toBeDefined();
        expect(meta.description).toBeDefined();
        expect(meta.alternates?.canonical).toBe(`${baseUrl}/${slug}`);
        expect(meta.openGraph?.url).toBe(`${baseUrl}/${slug}`);
        expect((meta.twitter as Record<string, unknown>)?.card).toBe('summary_large_image');
      }
    });

    it('returns empty metadata for non-existent slugs', async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'non-existent-platform' }),
      });
      expect(meta).toEqual({});
    });
  });

  describe('5. Performance: Zero Provider Network Calls During Rendering', () => {
    it('generates static metadata and static params without invoking any external fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      generateStaticParams();
      for (const slug of expectedSlugs) {
        await generateMetadata({ params: Promise.resolve({ slug }) });
      }

      // No network calls made to RapidAPI or providers
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
