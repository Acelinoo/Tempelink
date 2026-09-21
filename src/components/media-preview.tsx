'use client';

import React from 'react';
import { PublicMediaResponse } from '@/lib/types/media';
import { Clock, User, ExternalLink, Film } from 'lucide-react';

interface MediaPreviewProps {
  media: PublicMediaResponse;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ media }) => {
  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationStr = formatDuration(media.durationSeconds);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-lg">
      {/* Thumbnail */}
      <div className="relative w-full sm:w-44 h-44 sm:h-28 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800 flex items-center justify-center">
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600">
            <Film className="w-8 h-8 mb-1" />
            <span className="text-[11px] font-mono">No Thumbnail</span>
          </div>
        )}

        {durationStr && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono text-white flex items-center space-x-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{durationStr}</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800/40">
              {media.platform}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              {media.mediaType}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-2 leading-snug">
            {media.title || 'Untitled Media'}
          </h3>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            {media.author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.author.avatarUrl}
                alt={media.author.name || 'Author'}
                className="w-5 h-5 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <User className="w-4 h-4 text-slate-500" />
            )}
            <span className="font-medium text-slate-300 truncate max-w-[160px]">
              {media.author?.name || media.author?.username || 'Kreator Anonim'}
            </span>
          </div>

          <a
            href={media.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <span>Buka Sumber</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
