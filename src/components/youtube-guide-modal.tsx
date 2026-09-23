'use client';

import React from 'react';
import { X, PlaySquare, MoreVertical, Download, ExternalLink, Smartphone } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

interface YouTubeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaTitle?: string | null;
}

export const YouTubeGuideModal: React.FC<YouTubeGuideModalProps> = ({
  isOpen,
  onClose,
  mediaTitle,
}) => {
  const { t } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-app-surface border border-app rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-app flex items-center justify-between bg-app-elevated/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/50 border border-red-800/50 flex items-center justify-center flex-shrink-0">
              <PlaySquare className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-app-main text-base leading-tight">
                {t('ytGuideTitle')}
              </h3>
              <p className="text-[11px] text-app-subtle">
                Panduan Resmi Penyimpanan Berkas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btnClose')}
            className="p-1.5 text-app-subtle hover:text-app-main rounded-lg hover:bg-app-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {mediaTitle && (
            <div className="p-3 rounded-lg bg-app-elevated/60 border border-app">
              <span className="text-[10px] font-mono uppercase tracking-wider text-app-subtle block">
                Target Berkas:
              </span>
              <p className="text-xs font-semibold text-app-main truncate mt-0.5">
                {mediaTitle}
              </p>
            </div>
          )}

          <p className="text-xs text-app-muted leading-relaxed">
            {t('ytGuideSubtitle')}
          </p>

          {/* Steps Container */}
          <div className="space-y-2.5">
            {/* Step 1 */}
            <div className="p-3.5 rounded-lg bg-app-elevated border border-app flex items-start space-x-3 transition-colors">
              <div className="w-6 h-6 rounded-md bg-app-surface border border-app text-app-cta font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-app-cta flex-shrink-0" />
                  <h4 className="text-xs font-bold text-app-main">
                    {t('ytGuideStep1Title')}
                  </h4>
                </div>
                <p className="text-[11px] text-app-muted mt-1 leading-normal">
                  {t('ytGuideStep1Desc')}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3.5 rounded-lg bg-app-elevated border border-app flex items-start space-x-3 transition-colors">
              <div className="w-6 h-6 rounded-md bg-app-surface border border-app text-app-cta font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <MoreVertical className="w-3.5 h-3.5 text-app-cta flex-shrink-0" />
                  <h4 className="text-xs font-bold text-app-main">
                    {t('ytGuideStep2Title')}
                  </h4>
                </div>
                <p className="text-[11px] text-app-muted mt-1 leading-normal">
                  {t('ytGuideStep2Desc')}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3.5 rounded-lg bg-app-elevated border border-app flex items-start space-x-3 transition-colors">
              <div className="w-6 h-6 rounded-md bg-app-surface border border-app text-app-cta font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <Download className="w-3.5 h-3.5 text-app-cta flex-shrink-0" />
                  <h4 className="text-xs font-bold text-app-main">
                    {t('ytGuideStep3Title')}
                  </h4>
                </div>
                <p className="text-[11px] text-app-muted mt-1 leading-normal">
                  {t('ytGuideStep3Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Tips Box */}
          <div className="p-3 rounded-lg bg-app-elevated/40 border border-app flex items-start space-x-2.5">
            <Smartphone className="w-4 h-4 text-app-muted flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-app-muted leading-relaxed">
              <strong className="text-app-main">Tips Perangkat Seluler:</strong>{' '}
              {t('ytGuideMobileTip')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-app bg-app-elevated/20 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-lg bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <span>{t('ytGuideBtnUnderstood')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
