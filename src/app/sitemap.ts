import type { MetadataRoute } from 'next';
import { getAllPlatformSlugs, getBaseUrl } from '@/lib/seo/platform-seo-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date('2026-09-21T00:00:00.000Z');

  const platformRoutes: MetadataRoute.Sitemap = getAllPlatformSlugs().map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl,               lastModified, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/about`,   lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/terms`,   lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
  ];

  return [...staticRoutes, ...platformRoutes];
}
