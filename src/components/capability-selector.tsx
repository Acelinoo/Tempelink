'use client';

import React from 'react';
import { Capability } from '@/lib/types/capability';
import { Download, Sparkles, Music, Image as ImageIcon, Video, Loader2, Check, RotateCcw } from 'lucide-react';

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
  if (!capabilities || capabilities.length === 0) {
    return (
      <div className="w-full p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-sm">
        Tidak ada opsi unduhan yang dapat diekstrak untuk media ini.
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
        <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          Opsi Unduhan Tersedia ({capabilities.length})
        </h4>
        <span className="text-[11px] text-slate-500 font-mono">
          Opsi Terverifikasi Langsung dari Sumber
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
                    ? 'bg-rose-950/20 border-rose-800/80 shadow-sm shadow-rose-500/10'
                    : 'bg-slate-800/90 border-cyan-500 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-center space-x-3 min-w-0 pr-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isHD
                      ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                      : cap.type === 'audio'
                      ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                      : 'bg-slate-800 text-cyan-400 border border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-sm text-white truncate">
                      {cap.label}
                    </span>
                    {isHD && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-black">
                        HD
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span className="uppercase font-mono font-medium">{cap.format}</span>
                    {cap.resolution && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>{cap.resolution}</span>
                      </>
                    )}
                    {sizeStr && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>{sizeStr}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action */}
              <button
                type="button"
                onClick={() => onSelectCapability(cap)}
                disabled={isDownloadingAny}
                aria-label={`Unduh ${cap.label}`}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  isCurrentSuccess
                    ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                    : isCurrentError
                    ? 'bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                    : isHD
                    ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 shadow-sm shadow-cyan-500/20'
                }`}
              >
                {isCurrentDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengunduh...</span>
                  </>
                ) : isCurrentSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Diunduh</span>
                  </>
                ) : isCurrentError ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{isHD ? 'Unduh HD' : 'Unduh'}</span>
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
