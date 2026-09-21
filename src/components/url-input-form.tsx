'use client';

import React, { useState } from 'react';
import { Clipboard, X, ArrowRight, Loader2, Link2, Sparkles } from 'lucide-react';

interface UrlInputFormProps {
  url: string;
  onChangeUrl: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export const UrlInputForm: React.FC<UrlInputFormProps> = ({
  url,
  onChangeUrl,
  onSubmit,
  isLoading,
}) => {
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [detectedClipboardUrl, setDetectedClipboardUrl] = useState<string | null>(null);

  const isSupportedUrlPattern = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return (
      lower.includes('tiktok.com') ||
      lower.includes('instagram.com') ||
      lower.includes('instagr.am') ||
      lower.includes('youtube.com') ||
      lower.includes('youtu.be') ||
      lower.includes('x.com') ||
      lower.includes('twitter.com') ||
      lower.includes('facebook.com') ||
      lower.includes('fb.watch') ||
      lower.includes('pinterest.com') ||
      lower.includes('pin.it')
    );
  };

  const handleInspectClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        setPasteNotice('Izin clipboard tidak tersedia pada browser ini.');
        setTimeout(() => setPasteNotice(null), 3000);
        return;
      }

      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();

      if (!trimmed) {
        setPasteNotice('Clipboard kosong.');
        setTimeout(() => setPasteNotice(null), 2500);
        return;
      }

      if (isSupportedUrlPattern(trimmed)) {
        if (url === trimmed) {
          setPasteNotice('Link sudah terisi di form.');
          setTimeout(() => setPasteNotice(null), 2500);
          return;
        }
        setDetectedClipboardUrl(trimmed);
      } else {
        // If not recognized as supported platform, paste directly
        onChangeUrl(trimmed);
      }
    } catch {
      setPasteNotice('Gagal membaca clipboard. Silakan gunakan paste manual (Ctrl+V).');
      setTimeout(() => setPasteNotice(null), 3500);
    }
  };

  const handleApplyClipboardUrl = () => {
    if (detectedClipboardUrl) {
      onChangeUrl(detectedClipboardUrl);
      setDetectedClipboardUrl(null);
    }
  };

  const handleClear = () => {
    onChangeUrl('');
    setDetectedClipboardUrl(null);
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* Detected Clipboard Banner (User-Initiated) */}
      {detectedClipboardUrl && (
        <div className="w-full mb-3 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 flex items-center justify-between gap-3 text-xs animate-fade-in shadow-md shadow-cyan-950/20">
          <div className="flex items-center space-x-2 min-w-0">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-white">Link dari clipboard terdeteksi: </span>
              <span className="font-mono text-cyan-300 truncate inline-block max-w-[220px] sm:max-w-xs align-bottom">
                {detectedClipboardUrl}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleApplyClipboardUrl}
              className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
            >
              Gunakan Link
            </button>
            <button
              type="button"
              onClick={() => setDetectedClipboardUrl(null)}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              title="Abaikan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Input Box */}
      <div className="w-full relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
          <Link2 className="w-5 h-5 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => {
            onChangeUrl(e.target.value);
            if (detectedClipboardUrl) setDetectedClipboardUrl(null);
          }}
          placeholder="Tempel link TikTok, Instagram, YouTube, X, Facebook, atau Pinterest..."
          disabled={isLoading}
          required
          autoFocus
          className="w-full pl-11 pr-28 sm:pr-36 py-4 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 rounded-xl text-white placeholder-slate-500 text-sm sm:text-base outline-none transition-all shadow-lg shadow-black/20"
        />

        <div className="absolute inset-y-0 right-1.5 flex items-center space-x-1.5">
          {url ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              title="Hapus Link"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInspectClipboard}
              disabled={isLoading}
              title="Periksa Clipboard"
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors border border-slate-700/50"
            >
              <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tempel</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center space-x-1 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 transition-all shadow-md shadow-cyan-500/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Memeriksa...</span>
              </>
            ) : (
              <>
                <span>Unduh</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {pasteNotice && (
        <p className="mt-2 text-xs text-amber-400/90 animate-fade-in font-medium">
          {pasteNotice}
        </p>
      )}
    </form>
  );
};
