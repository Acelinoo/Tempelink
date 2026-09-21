'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

interface StatsState {
  status: 'loading' | 'success' | 'error';
  totalDownloads: number | null;
}

interface StatsPopupProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function formatCount(n: number): string {
  return n.toLocaleString('id-ID');
}

export const StatsPopup: React.FC<StatsPopupProps> = ({ onClose, anchorRef }) => {
  const [state, setState] = useState<StatsState>({ status: 'loading', totalDownloads: null });
  const popupRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const retryRef = useRef<(() => void) | null>(null);

  // Fetch immediately, then poll every 8 seconds while open
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/api/stats/downloads', { cache: 'no-store' });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) {
          setState({ status: 'success', totalDownloads: data.totalDownloads ?? 0 });
        }
      } catch {
        if (!cancelled) {
          setState((prev) =>
            prev.status === 'loading'
              ? { status: 'error', totalDownloads: null }
              : prev
          );
        }
      }
    };

    retryRef.current = run;
    run();
    intervalRef.current = setInterval(run, 8000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-modal="true"
      aria-label="Statistik Tempelink"
      className="absolute left-0 top-full mt-2 z-50 w-[230px] sm:w-[260px]"
    >
      {/* Card */}
      <div className="rounded-xl border border-app bg-app-surface shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-app-cta flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-app-main tracking-tight">
              Statistik Tempelink
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup statistik"
            className="p-1 rounded-md hover:bg-app-elevated transition-colors text-app-muted hover:text-app-main cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {state.status === 'loading' && (
            <div className="flex items-center gap-2 text-app-muted" aria-live="polite">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full border-2 border-app-cta border-t-transparent animate-spin"
                aria-hidden="true"
              />
              <span className="text-xs">Memuat statistik…</span>
            </div>
          )}

          {state.status === 'error' && (
            <div aria-live="assertive" className="space-y-2">
              <p className="text-xs text-app-muted">Statistik tidak tersedia.</p>
              <button
                type="button"
                onClick={() => retryRef.current?.()}
                className="text-xs text-app-cta hover:underline cursor-pointer"
              >
                Coba lagi
              </button>
            </div>
          )}

          {state.status === 'success' && state.totalDownloads !== null && (
            <div aria-live="polite" className="space-y-1">
              <p
                className="text-3xl font-black text-app-main tabular-nums leading-none"
                aria-label={`${formatCount(state.totalDownloads)} unduhan berhasil`}
              >
                {formatCount(state.totalDownloads)}
              </p>
              <p className="text-xs text-app-muted">unduhan berhasil</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-app-cta opacity-80"
            aria-hidden="true"
          />
          <span className="text-[10px] text-app-subtle">Live · diperbarui otomatis</span>
        </div>
      </div>
    </div>
  );
};
