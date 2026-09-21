'use client';

import React from 'react';
import { Capability } from '@/lib/types/capability';
import { Download, Sparkles, Music, Image as ImageIcon, Video, Loader2, Check, RotateCcw } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

export type CapabilityDownloadState = 'idle' | 'downloading' | 'success' | 'error';

interface CapabilitySelectorProps {
  capabilities: Capability[];
  onSelectCapability: (cap: Capability) => void;
  selectedCapabilityId?: string | null;
  downloadState?: CapabilityDownloadState;
}

export const CapabilitySelector: React.FC<CapabilitySelectorProps> = ({
  capabilities,
  onSelectCapability,
  selectedCapabilityId,
  downloadState = 'idle',
}) => {
  const { t } = useApp();

  if (!capabilities || capabilities.length === 0) {
    return (
      <div className="w-full p-4 rounded-xl bg-app-surface border border-app text-center text-app-muted text-sm">
        {t('noDownloadOptions')}
      </div>
    );
  }

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getCapabilityIcon = (type: string, qualityCategory: string) => {
    if (type === 'audio') return Music;
    if (type === 'image') return ImageIcon;
    if (qualityCategory === 'hd') return Sparkles;
    return Video;
  };

  const isDownloadingAny = downloadState === 'downloading';

  return (
    <div className="w-full flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider font-bold text-app-muted">
          {t('downloadOptionsTitle')} ({capabilities.length})
        </h4>
        <span className="text-[11px] text-app-subtle font-mono">
          {t('verifiedDirectSource')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {capabilities.map((cap) => {
          const Icon = getCapabilityIcon(cap.type, cap.qualityCategory);
          const isSelected = selectedCapabilityId === cap.id;
          const isHD = cap.qualityCategory === 'hd';
          const sizeStr = formatFileSize(cap.fileSizeBytes);

          const isCurrentDownloading = isSelected && isDownloadingAny;
          const isCurrentSuccess = isSelected && downloadState === 'success';
          const isCurrentError = isSelected && downloadState === 'error';

          return (
            <div
              key={cap.id}
              className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? isCurrentError
                    ? 'bg-rose-950/20 border-rose-700/80 shadow-sm'
                    : 'bg-app-elevated border-app-cta shadow-md ring-1 ring-app-cta/30'
                  : 'bg-app-surface border-app hover:border-[var(--border-focus)] hover:bg-app-elevated'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-center space-x-3 min-w-0 pr-2 flex-1">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-app bg-app-elevated ${
                    isHD ? 'text-app-cta' : 'text-app-main'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="font-bold text-xs sm:text-sm text-app-main leading-snug break-words">
                      {cap.label}
                    </span>
                    {isHD && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-app-cta text-[var(--accent-cta-text)] flex-shrink-0">
                        HD
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-app-subtle mt-0.5">
                    <span className="uppercase font-mono font-medium">{cap.format}</span>
                    {cap.resolution && (
                      <>
                        <span>•</span>
                        <span>{cap.resolution}</span>
                      </>
                    )}
                    {sizeStr && (
                      <>
                        <span>•</span>
                        <span>{sizeStr}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action Button */}
              <button
                type="button"
                onClick={() => onSelectCapability(cap)}
                disabled={isDownloadingAny}
                aria-label={`${t('btnDownload')} ${cap.label}`}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm cursor-pointer ${
                  isCurrentSuccess
                    ? 'bg-emerald-600 text-white'
                    : isCurrentError
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 active:scale-95'
                }`}
              >
                {isCurrentDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('btnDownloading')}</span>
                  </>
                ) : isCurrentSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('btnDownloaded')}</span>
                  </>
                ) : isCurrentError ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('btnRetry')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{isHD ? t('btnDownloadHD') : t('btnDownload')}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
