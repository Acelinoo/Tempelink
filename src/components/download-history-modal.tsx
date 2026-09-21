'use client';

import React from 'react';
import { DownloadHistoryItem } from '@/lib/history/local-history';
import { X, Trash2, Clock, ShieldCheck } from 'lucide-react';

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
  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Riwayat Unduhan Lokal</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Callout */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center space-x-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Riwayat disimpan secara lokal di browser Anda demi privasi.</span>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Belum ada riwayat unduhan di browser ini.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div
                  className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectUrl(item.sourceUrl);
                    onClose();
                  }}
                >
                  <div className="w-10 h-10 rounded bg-slate-900 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-800">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {item.platform.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="capitalize text-cyan-400 font-medium">{item.platform}</span>
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
                    title="Hapus dari riwayat"
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
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
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Total {items.length} item tersimpan
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
            >
              Hapus Semua Riwayat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
