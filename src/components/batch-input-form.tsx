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
import { useApp } from '@/lib/context/app-context';

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
  const { t } = useApp();
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
        setNotice(t('clipboardPermissionDenied'));
        setTimeout(() => setNotice(null), 3000);
        return;
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText.trim()) {
        setNotice(t('clipboardEmpty'));
        setTimeout(() => setNotice(null), 2500);
        return;
      }

      setText((prev) => {
        const separator = prev.trim().length > 0 ? '\n' : '';
        return `${prev.trim()}${separator}${clipText.trim()}`;
      });
      setNotice(t('clipboardDetected'));
      setTimeout(() => setNotice(null), 2500);
    } catch {
      setNotice(t('clipboardReadFailed'));
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
        <div className="w-full p-2.5 rounded-lg bg-app-elevated border border-app text-app-main text-xs flex items-center justify-between animate-fade-in">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-app-subtle hover:text-app-main cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Textarea Container */}
      <div className="relative rounded-2xl bg-app-surface border border-app focus-within:border-app-cta focus-within:ring-2 focus-within:ring-app-cta/20 transition-all duration-200 shadow-md overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-app-elevated border-b border-app text-xs text-app-muted">
          <div className="flex items-center space-x-2">
            <ListOrdered className="w-4 h-4 text-app-cta" />
            <span className="font-semibold text-app-main">
              {t('batchInputSummary')}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-surface border border-app hover:opacity-90 text-app-main transition-colors text-xs font-semibold cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5 text-app-cta" />
              <span>{t('btnPaste')}</span>
            </button>

            {text.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-surface border border-app hover:text-rose-500 text-app-muted transition-colors text-xs cursor-pointer font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('btnClear')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('batchInputPlaceholder')}
          className="w-full p-4 bg-[var(--input-bg)] text-app-main placeholder:text-app-subtle text-sm font-mono leading-relaxed focus:outline-none resize-y min-h-[140px] max-h-[360px]"
        />

        {/* Bottom Status & Counter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-app-elevated border-t border-app text-xs">
          {/* Analysis Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md font-bold ${
                analysis.isOverLimit
                  ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                  : analysis.uniqueCount > 0
                    ? 'bg-app-cta text-[var(--accent-cta-text)]'
                    : 'bg-app-surface text-app-muted border border-app'
              }`}
            >
              {analysis.uniqueCount} / {maxBatchSize}
            </span>

            {analysis.duplicateCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-700 text-amber-300 font-medium">
                {analysis.duplicateCount} {t('batchDuplicateCount')}
              </span>
            )}

            {analysis.uniqueCount > 0 && (
              <span className="text-app-muted hidden sm:inline">
                • {analysis.validCount} {t('batchValidCount')}
              </span>
            )}
          </div>

          {/* Overlimit Warning */}
          {analysis.isOverLimit && (
            <div className="flex items-center space-x-1.5 text-rose-500 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('batchOverLimit')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
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
              ? 'bg-app-surface text-app-subtle border border-app cursor-not-allowed opacity-60'
              : 'bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 active:scale-95 shadow-md'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('btnStartingBatch')}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>
                {t('btnStartBatch')} ({analysis.uniqueCount})
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
