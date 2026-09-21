'use client';

import React from 'react';
import Link from 'next/link';
import { Video, Film, Share2, PlaySquare, Pin } from 'lucide-react';

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
  { id: 'tiktok', slug: 'tiktok-downloader', name: 'TikTok', icon: Video, color: 'text-pink-400 border-pink-500/30' },
  { id: 'instagram', slug: 'instagram-downloader', name: 'Instagram', icon: Film, color: 'text-purple-400 border-purple-500/30' },
  { id: 'youtube', slug: 'youtube-downloader', name: 'YouTube', icon: PlaySquare, color: 'text-red-400 border-red-500/30' },
  { id: 'x', slug: 'twitter-downloader', name: 'X (Twitter)', icon: XLogo, color: 'text-slate-200 border-slate-700/50' },
  { id: 'facebook', slug: 'facebook-downloader', name: 'Facebook', icon: Share2, color: 'text-blue-400 border-blue-500/30' },
  { id: 'pinterest', slug: 'pinterest-downloader', name: 'Pinterest', icon: Pin, color: 'text-rose-400 border-rose-500/30' },
];

export const PlatformPills: React.FC<PlatformPillsProps> = ({ activePlatformId }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">
        Platform yang Didukung
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = activePlatformId === p.id;

          return (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              title={`Pelajari cara mengunduh media dari ${p.name}`}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? `bg-slate-800 border-cyan-500 text-white ring-2 ring-cyan-500/20 shadow-sm shadow-cyan-500/10 scale-105`
                  : `bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-800/60`
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${p.color}`} />
              <span>{p.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
