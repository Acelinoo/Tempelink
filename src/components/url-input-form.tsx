'use client';

import React, { useState } from 'react';
import { Clipboard, X, ArrowRight, Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

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
  const { t } = useApp();
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
        setPasteNotice(t('clipboardPermissionDenied'));
        setTimeout(() => setPasteNotice(null), 3000);
        return;
      }

      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();

      if (!trimmed) {
        setPasteNotice(t('clipboardEmpty'));
        setTimeout(() => setPasteNotice(null), 2500);
        return;
      }

      if (isSupportedUrlPattern(trimmed)) {
        if (url === trimmed) {
          setPasteNotice(t('clipboardAlreadyFilled'));
          setTimeout(() => setPasteNotice(null), 2500);
          return;
        }
        setDetectedClipboardUrl(trimmed);
      } else {
        onChangeUrl(trimmed);
      }
    } catch {
      setPasteNotice(t('clipboardReadFailed'));
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
      {/* Detected Clipboard Banner */}
      {detectedClipboardUrl && (
        <div className="w-full mb-3 p-3 rounded-xl border border-app bg-app-surface text-app-main flex items-center justify-between gap-3 text-xs animate-fade-in shadow-md">
          <div className="flex items-center space-x-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-app-cta flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-app-main">{t('clipboardDetected')} </span>
              <span className="font-mono text-app-muted truncate inline-block max-w-[200px] sm:max-w-xs align-bottom">
                {detectedClipboardUrl}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleApplyClipboardUrl}
              className="px-2.5 py-1 rounded bg-app-cta text-[var(--accent-cta-text)] font-bold transition-opacity hover:opacity-90 cursor-pointer"
            >
              {t('clipboardUse')}
            </button>
            <button
              type="button"
              onClick={() => setDetectedClipboardUrl(null)}
              className="p-1 text-app-subtle hover:text-app-main rounded transition-colors cursor-pointer"
              title={t('clipboardDismiss')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Input Box */}
      <div className="w-full relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-subtle">
          <Link2 className="w-5 h-5 text-app-subtle group-focus-within:text-app-cta transition-colors" />
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => {
            onChangeUrl(e.target.value);
            if (detectedClipboardUrl) setDetectedClipboardUrl(null);
          }}
          placeholder={t('inputPlaceholder')}
          disabled={isLoading}
          required
          autoFocus
          className="w-full pl-11 pr-28 sm:pr-36 py-4 bg-[var(--input-bg)] border border-app hover:border-[var(--border-focus)] focus:border-app-cta focus:ring-2 focus:ring-app-cta/20 rounded-xl text-app-main placeholder:text-app-subtle text-sm sm:text-base outline-none transition-all shadow-md"
        />

        <div className="absolute inset-y-0 right-1.5 flex items-center space-x-1.5">
          {url ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              title={t('btnClear')}
              className="p-2 text-app-subtle hover:text-app-main hover:bg-app-elevated rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInspectClipboard}
              disabled={isLoading}
              title={t('btnPaste')}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-app-main bg-app-elevated hover:opacity-90 rounded-lg transition-colors border border-app cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5 text-app-cta" />
              <span>{t('btnPaste')}</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center space-x-1 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">{t('btnInspecting')}</span>
              </>
            ) : (
              <>
                <span>{t('btnInspect')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {pasteNotice && (
        <p className="mt-2 text-xs text-app-cta animate-fade-in font-medium">
          {pasteNotice}
        </p>
      )}
    </form>
  );
};
