'use client';

import React, { useMemo, useState } from 'react';
import {
  Clipboard,
  X,
  Play,
  Loader2,
  ListOrdered,
  AlertCircle,
} from 'lucide-react';
import { PlatformDetector } from '@/lib/platforms/detector';

interface BatchInputFormProps {
  onSubmitBatch: (urls: string[]) => Promise<void>;
  isLoading: boolean;
  maxBatchSize?: number;
}

export const BatchInputForm: React.FC<BatchInputFormProps> = ({
  onSubmitBatch,
  isLoading,
  maxBatchSize = 10,
}) => {
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Live URL analysis on user input
  const analysis = useMemo(() => {
    const rawLines = text.split('\n');
    const cleaned: string[] = [];

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        cleaned.push(trimmed);
      }
    }

    const seen = new Set<string>();
    const uniqueList: string[] = [];
    let duplicateCount = 0;

    for (const url of cleaned) {
      if (seen.has(url)) {
        duplicateCount++;
      } else {
        seen.add(url);
        uniqueList.push(url);
      }
    }

    // Platform and validity check per unique URL
    const items = uniqueList.map((url) => {
      let isValid = false;
      let platform = 'unknown';
      let error: string | undefined;

      try {
        const detection = PlatformDetector.detect(url);
        if (detection.status === 'SUPPORTED_PLATFORM') {
          isValid = true;
          platform = detection.platformId || 'unknown';
        } else if (detection.status === 'UNSUPPORTED_PLATFORM') {
          isValid = false;
          error = 'Platform belum didukung';
        } else if (detection.status === 'UNSUPPORTED_MEDIA') {
          isValid = false;
          error = 'Bukan link media yang valid';
        } else {
          isValid = false;
          error = detection.errorMessage || 'URL tidak valid';
        }
      } catch {
        isValid = false;
        error = 'Format URL tidak valid';
      }

      return {
        url,
        isValid,
        platform,
        error,
      };
    });

    const validCount = items.filter((i) => i.isValid).length;
    const isOverLimit = items.length > maxBatchSize;

    return {
      rawTotal: cleaned.length,
      uniqueCount: items.length,
      duplicateCount,
      validCount,
      isOverLimit,
      items,
      uniqueList,
    };
  }, [text, maxBatchSize]);

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        setNotice('Izin clipboard tidak tersedia.');
        setTimeout(() => setNotice(null), 3000);
        return;
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText.trim()) {
        setNotice('Clipboard kosong.');
        setTimeout(() => setNotice(null), 2500);
        return;
      }

      setText((prev) => {
        const separator = prev.trim().length > 0 ? '\n' : '';
        return `${prev.trim()}${separator}${clipText.trim()}`;
      });
      setNotice('Tautan berhasil ditempel dari clipboard.');
      setTimeout(() => setNotice(null), 2500);
    } catch {
      setNotice('Gagal membaca clipboard. Silakan gunakan Ctrl+V.');
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || analysis.uniqueCount === 0 || analysis.isOverLimit) {
      return;
    }
    await onSubmitBatch(analysis.uniqueList);
  };

  const handleClear = () => {
    setText('');
    setNotice(null);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl mx-auto flex flex-col space-y-4"
    >
      {/* Notice Banner */}
      {notice && (
        <div className="w-full p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 text-xs flex items-center justify-between animate-fade-in">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-cyan-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Textarea Container */}
      <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 focus-within:border-cyan-500/80 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all duration-200 shadow-xl overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <ListOrdered className="w-4 h-4 text-cyan-400" />
            <span className="font-medium text-slate-200">
              Input Banyak Tautan (1 baris per URL)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Tempel dari Clipboard</span>
              <span className="sm:hidden">Paste</span>
            </button>

            {text.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 transition-colors text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Tempel beberapa tautan video atau postingan di sini...\nContoh:\nhttps://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/...\nhttps://www.youtube.com/watch?v=...\nhttps://x.com/.../status/...`}
          className="w-full p-4 bg-transparent text-slate-100 placeholder-slate-500 text-sm font-mono leading-relaxed focus:outline-none resize-y min-h-[140px] max-h-[360px]"
        />

        {/* Bottom Status & Counter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/70 border-t border-slate-800/80 text-xs">
          {/* Analysis Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full font-medium ${
                analysis.isOverLimit
                  ? 'bg-rose-950/80 border border-rose-800/60 text-rose-300'
                  : analysis.uniqueCount > 0
                    ? 'bg-cyan-950/60 border border-cyan-800/40 text-cyan-300'
                    : 'bg-slate-800/80 text-slate-400'
              }`}
            >
              {analysis.uniqueCount} / {maxBatchSize} Tautan
            </span>

            {analysis.duplicateCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/40 text-amber-300 font-medium">
                {analysis.duplicateCount} duplikat diabaikan
              </span>
            )}

            {analysis.uniqueCount > 0 && (
              <span className="text-slate-400 hidden sm:inline">
                • {analysis.validCount} platform terverifikasi
              </span>
            )}
          </div>

          {/* Overlimit Warning */}
          {analysis.isOverLimit && (
            <div className="flex items-center space-x-1.5 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Maksimal {maxBatchSize} URL per batch.</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <p className="text-xs text-slate-400 text-center sm:text-left">
          Proses antrean dikontrol maksimal 2 pemrosesan bersamaan untuk mencegah pembatasan penyedia.
        </p>

        <button
          type="submit"
          disabled={
            isLoading ||
            analysis.uniqueCount === 0 ||
            analysis.isOverLimit
          }
          className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 cursor-pointer ${
            isLoading ||
            analysis.uniqueCount === 0 ||
            analysis.isOverLimit
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mendaftarkan Antrean...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>
                Mulai Antrean ({analysis.uniqueCount} Tautan)
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
