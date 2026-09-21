'use client';

import React from 'react';
import { DownloadHistoryItem } from '@/lib/history/local-history';
import { X, Trash2, Clock, ShieldCheck } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

interface DownloadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DownloadHistoryItem[];
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onSelectUrl: (url: string) => void;
}

export const DownloadHistoryModal: React.FC<DownloadHistoryModalProps> = ({
  isOpen,
  onClose,
  items,
  onClear,
  onRemoveItem,
  onSelectUrl,
}) => {
  const { t, language } = useApp();

  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-app-surface border border-app rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-app flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-app-cta" />
            <h3 className="font-bold text-app-main text-base">{t('historyModalTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btnClose')}
            className="p-1 text-app-subtle hover:text-app-main rounded-lg hover:bg-app-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Callout */}
        <div className="px-5 py-2.5 bg-app-elevated border-b border-app flex items-center space-x-2 text-xs text-app-muted">
          <ShieldCheck className="w-4 h-4 text-app-cta flex-shrink-0" />
          <span>{t('historyModalSubtitle')}</span>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="py-12 text-center text-app-subtle text-sm">
              {t('historyEmpty')}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-app-elevated/60 border border-app hover:border-app-cta transition-all"
              >
                <div
                  className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectUrl(item.sourceUrl);
                    onClose();
                  }}
                >
                  <div className="w-10 h-10 rounded bg-app-surface flex-shrink-0 overflow-hidden flex items-center justify-center border border-app">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-app-subtle uppercase font-bold">
                        {item.platform.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-app-main truncate group-hover:text-app-cta transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center space-x-2 text-[11px] text-app-subtle mt-0.5">
                      <span className="capitalize text-app-cta font-medium">{item.platform}</span>
                      <span>•</span>
                      <span>{item.capabilityLabel}</span>
                      <span>•</span>
                      <span>{formatDate(item.downloadedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 pl-2">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    title={t('btnClearHistory')}
                    className="p-1.5 text-app-subtle hover:text-rose-500 rounded-lg hover:bg-app-surface transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-app bg-app-elevated flex justify-between items-center">
            <span className="text-xs text-app-subtle">
              Total {items.length} {t('historyCountLabel')}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-rose-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              {t('btnClearHistory')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
