'use client';

import React from 'react';
import { PublicMediaResponse } from '@/lib/types/media';
import { Clock, User, ExternalLink, Film } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

interface MediaPreviewProps {
  media: PublicMediaResponse;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ media }) => {
  const { t } = useApp();

  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationStr = formatDuration(media.durationSeconds);

  return (
    <div className="w-full bg-app-surface border border-app rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-md transition-colors">
      {/* Thumbnail */}
      <div className="relative w-full sm:w-44 h-44 sm:h-28 rounded-lg overflow-hidden bg-app-elevated flex-shrink-0 border border-app flex items-center justify-center">
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-app-subtle">
            <Film className="w-8 h-8 mb-1" />
            <span className="text-[11px] font-mono">{t('noThumbnail')}</span>
          </div>
        )}

        {durationStr && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono text-white flex items-center space-x-1">
            <Clock className="w-3 h-3 text-app-cta" />
            <span>{durationStr}</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-app-elevated text-app-cta border border-app">
              {media.platform}
            </span>
            <span className="text-xs text-app-subtle uppercase font-mono font-medium">
              {media.mediaType}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-app-main tracking-tight line-clamp-2 leading-snug">
            {media.title || 'Untitled Media'}
          </h3>
        </div>

        <div className="mt-3 pt-3 border-t border-app flex items-center justify-between text-xs text-app-muted">
          <div className="flex items-center space-x-2">
            {media.author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.author.avatarUrl}
                alt={media.author.name || 'Author'}
                className="w-5 h-5 rounded-full object-cover border border-app"
              />
            ) : (
              <User className="w-4 h-4 text-app-subtle" />
            )}
            <span className="font-medium text-app-main truncate max-w-[160px]">
              {media.author?.name || media.author?.username || t('creatorAnonymous')}
            </span>
          </div>

          <a
            href={media.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-app-muted hover:text-app-cta transition-colors font-medium"
          >
            <span>{t('openOriginalSource')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
