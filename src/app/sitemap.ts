import type { MetadataRoute } from 'next';
import { getAllPlatformSlugs, getBaseUrl } from '@/lib/seo/platform-seo-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  // Deterministic release timestamp for search engines
  const lastModified = new Date('2026-09-21T00:00:00.000Z');

  const platformRoutes: MetadataRoute.Sitemap = getAllPlatformSlugs().map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...platformRoutes,
  ];
}
