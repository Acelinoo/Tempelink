'use client';

import React from 'react';
import Link from 'next/link';
import { Video, Film, Share2, PlaySquare, Pin } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

interface PlatformPillsProps {
  activePlatformId?: string | null;
}

// Crisp modern X logo
const XLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className || 'w-3.5 h-3.5'}
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface PlatformItem {
  id: string;
  slug: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PLATFORMS: PlatformItem[] = [
  { id: 'tiktok', slug: 'tiktok-downloader', name: 'TikTok', icon: Video, color: 'text-rose-500' },
  { id: 'instagram', slug: 'instagram-downloader', name: 'Instagram', icon: Film, color: 'text-amber-600' },
  { id: 'youtube', slug: 'youtube-downloader', name: 'YouTube', icon: PlaySquare, color: 'text-red-600' },
  { id: 'x', slug: 'twitter-downloader', name: 'X (Twitter)', icon: XLogo, color: 'text-app-main' },
  { id: 'facebook', slug: 'facebook-downloader', name: 'Facebook', icon: Share2, color: 'text-blue-600' },
  { id: 'pinterest', slug: 'pinterest-downloader', name: 'Pinterest', icon: Pin, color: 'text-rose-700' },
];

export const PlatformPills: React.FC<PlatformPillsProps> = ({ activePlatformId }) => {
  const { t } = useApp();

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-xs uppercase tracking-wider font-bold text-app-subtle mb-3">
        {t('supportedPlatforms')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = activePlatformId === p.id;

          return (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              title={`${p.name} Downloader`}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? `bg-app-cta text-[var(--accent-cta-text)] border-app-cta shadow-sm scale-105`
                  : `bg-app-surface border-app text-app-muted hover:border-app-cta hover:text-app-main hover:bg-app-elevated`
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--accent-cta-text)]' : p.color}`} />
              <span>{p.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
