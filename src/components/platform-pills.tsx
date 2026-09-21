'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context/app-context';

interface PlatformPillsProps {
  activePlatformId?: string | null;
}

interface PlatformItem {
  id: string;
  slug: string;
  name: string;
}

const PLATFORMS: PlatformItem[] = [
  { id: 'tiktok',    slug: 'tiktok-downloader',    name: 'TikTok' },
  { id: 'instagram', slug: 'instagram-downloader',  name: 'Instagram' },
  { id: 'youtube',   slug: 'youtube-downloader',    name: 'YouTube' },
  { id: 'x',        slug: 'twitter-downloader',    name: 'X / Twitter' },
  { id: 'facebook',  slug: 'facebook-downloader',   name: 'Facebook' },
  { id: 'pinterest', slug: 'pinterest-downloader',  name: 'Pinterest' },
];

export const PlatformPills: React.FC<PlatformPillsProps> = ({ activePlatformId }) => {
  const { t } = useApp();

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-xs uppercase tracking-wider font-bold text-app-subtle mb-3">
        {t('supportedPlatforms')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {PLATFORMS.map((p) => {
          const isActive = activePlatformId === p.id;

          return (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              title={`${p.name} Downloader`}
              style={isActive ? { borderBottomColor: 'var(--accent-cta)' } : {}}
              className={`text-sm font-semibold pb-0.5 border-b-2 transition-all duration-200 ${
                isActive
                  ? 'text-app-main border-b-[var(--accent-cta)]'
                  : 'text-app-muted border-b-transparent hover:text-app-main hover:border-b-[var(--border-subtle)]'
              }`}
            >
              {p.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
