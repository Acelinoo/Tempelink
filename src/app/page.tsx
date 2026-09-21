'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { UrlInputForm } from '@/components/url-input-form';
import { BatchInputForm } from '@/components/batch-input-form';
import { BatchQueueView } from '@/components/batch-queue-view';
import { PlatformPills } from '@/components/platform-pills';
import { MediaPreview } from '@/components/media-preview';
import {
  CapabilitySelector,
  CapabilityDownloadState,
} from '@/components/capability-selector';
import { DownloadHistoryModal } from '@/components/download-history-modal';
import { ErrorAlert } from '@/components/error-alert';
import { HowToSection } from '@/components/how-to-section';
import { FeaturesSection } from '@/components/features-section';
import { FaqSection } from '@/components/faq-section';
import { PublicMediaResponse } from '@/lib/types/media';
import { Capability } from '@/lib/types/capability';
import { BatchSummaryResponse, QueueJob } from '@/lib/types/queue';
import {
  saveLocalHistoryItem,
  removeLocalHistoryItem,
  clearLocalHistory,
  subscribeHistory,
  getHistorySnapshot,
  getServerHistorySnapshot,
  DownloadHistoryItem,
} from '@/lib/history/local-history';
import {
  CheckCircle2,
  ShieldCheck,
  EyeOff,
  Link2,
  Layers,
} from 'lucide-react';
import { useApp } from '@/lib/context/app-context';
import { executeImmediateDownload } from '@/lib/download/client-download';

export default function HomePage() {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single URL Mode State
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null
  );
  const [resolvedMedia, setResolvedMedia] =
    useState<PublicMediaResponse | null>(null);
  const [selectedCapId, setSelectedCapId] = useState<string | null>(null);
  const [downloadState, setDownloadState] =
    useState<CapabilityDownloadState>('idle');

  // Batch Mode State
  const [activeBatch, setActiveBatch] =
    useState<BatchSummaryResponse | null>(null);
  const [isBatchCreating, setIsBatchCreating] = useState(false);

  // History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Synchronize local anonymous history via useSyncExternalStore
  const historyRaw = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getServerHistorySnapshot
  );

  const historyItems: DownloadHistoryItem[] = useMemo(() => {
    try {
      return JSON.parse(historyRaw);
    } catch {
      return [];
    }
  }, [historyRaw]);

  // Real-time client-side platform detection for pill highlight in single mode
  const detectedPlatformId = useMemo(() => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('instagram.com') || lower.includes('instagr.am'))
      return 'instagram';
    if (lower.includes('youtube.com') || lower.includes('youtu.be'))
      return 'youtube';
    if (lower.includes('x.com') || lower.includes('twitter.com')) return 'x';
    if (lower.includes('facebook.com') || lower.includes('fb.watch'))
      return 'facebook';
    if (lower.includes('pinterest.com') || lower.includes('pin.it'))
      return 'pinterest';
    return null;
  }, [url]);

  // Single URL Submit
  const handleSingleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResolvedMedia(null);
    setSelectedCapId(null);
    setDownloadState('idle');

    try {
      const res = await fetch('/api/media/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError({
          message: data?.error?.message || t('errorDefault'),
          code: data?.error?.code || 'RESOLUTION_FAILED',
        });
        return;
      }

      setResolvedMedia(data.data);
    } catch {
      setError({
        message: t('networkError'),
        code: 'NETWORK_ERROR',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Single URL Capability Selection & Direct File Download
  const handleSelectCapability = async (cap: Capability) => {
    if (!resolvedMedia || downloadState === 'downloading') return;
    setSelectedCapId(cap.id);
    setDownloadState('downloading');
    setError(null);

    try {
      const extension =
        cap.format === 'jpg'
          ? 'jpg'
          : cap.format === 'png'
          ? 'png'
          : cap.format === 'mp3'
          ? 'mp3'
          : 'mp4';
      const cleanPlatform = resolvedMedia.platform || 'media';
      const cleanMediaId = resolvedMedia.id || 'download';
      const qualityTag = cap.qualityCategory || 'standard';
      const filename = `${cleanPlatform}_${cleanMediaId}_${qualityTag}.${extension}`;

      // Trigger immediate direct file download without opening video player tab
      await executeImmediateDownload({
        token: cap.downloadToken,
        directUrl: cap.downloadUrl,
        filename,
      });

      // Record in local anonymous history
      saveLocalHistoryItem({
        title: resolvedMedia.title,
        platform: resolvedMedia.platform,
        thumbnailUrl: resolvedMedia.thumbnailUrl,
        capabilityLabel: cap.label,
        format: cap.format,
        sourceUrl: resolvedMedia.sourceUrl,
      });

      setDownloadState('success');

      setTimeout(() => {
        setDownloadState('idle');
      }, 3500);
    } catch {
      setDownloadState('error');
      setError({
        message: t('downloadFailed'),
        code: 'DOWNLOAD_FAILED',
      });
    }
  };

  // Batch Submit Handler
  const handleCreateBatch = async (urls: string[]) => {
    setIsBatchCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError({
          message: data?.error?.message || t('batchCreateFailed'),
          code: data?.error?.code || 'BATCH_FAILED',
        });
        return;
      }

      setActiveBatch(data.data);
    } catch {
      setError({
        message: t('networkError'),
        code: 'NETWORK_ERROR',
      });
    } finally {
      setIsBatchCreating(false);
    }
  };

  // Record batch job download into local history
  const handleRecordBatchJobHistory = (job: QueueJob) => {
    saveLocalHistoryItem({
      title: job.mediaMetadata?.title || `Batch Item (${job.platform})`,
      platform: job.platform || 'unknown',
      thumbnailUrl: job.mediaMetadata?.thumbnailUrl || null,
      capabilityLabel: job.selectedCapability?.label || 'Direct Download',
      format: job.selectedCapability?.format || 'mp4',
      sourceUrl: job.sourceUrl,
    });
  };

  const handleClearHistory = () => {
    clearLocalHistory();
  };

  const handleRemoveHistoryItem = (id: string) => {
    removeLocalHistoryItem(id);
  };

  const handleSelectFromHistory = (sourceUrl: string) => {
    setActiveTab('single');
    setUrl(sourceUrl);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main transition-colors duration-200">
      <Navbar
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={historyItems.length}
      />

      <main className="flex-1 flex flex-col items-center justify-start px-3 sm:px-6 pt-10 sm:pt-16 pb-16 max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-6 sm:mb-8 space-y-3">
          <p className="text-[11px] sm:text-xs uppercase tracking-widest font-semibold text-app-subtle">
            {t('heroBadge')}
          </p>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-app-main max-w-2xl mx-auto leading-tight">
            {t('heroTitle')}
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-app-muted max-w-xl mx-auto leading-relaxed px-2">
            {t('heroDescription')}
          </p>
        </div>

        {/* Mode Navigation Tabs (Single vs Batch) */}
        <div className="w-full max-w-md mx-auto mb-6 p-1 rounded-xl bg-app-surface border border-app flex items-center justify-center gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActiveTab('single');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-app-cta text-[var(--accent-cta-text)] shadow-sm'
                : 'text-app-muted hover:text-app-main hover:bg-app-elevated'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{t('tabSingle')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('batch');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-app-cta text-[var(--accent-cta-text)] shadow-sm'
                : 'text-app-muted hover:text-app-main hover:bg-app-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('tabBatch')}</span>
          </button>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="w-full mb-6">
            <ErrorAlert
              message={error.message}
              code={error.code}
              onDismiss={() => setError(null)}
              onRetry={
                activeTab === 'single' ? handleSingleSubmit : undefined
              }
            />
          </div>
        )}

        {/* TAB 1: SINGLE URL MODE */}
        {activeTab === 'single' && (
          <div className="w-full flex flex-col items-center animate-fade-in space-y-6">
            <div className="w-full">
              <UrlInputForm
                url={url}
                onChangeUrl={setUrl}
                onSubmit={handleSingleSubmit}
                isLoading={isLoading}
              />
            </div>

            {resolvedMedia && (
              <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
                <MediaPreview media={resolvedMedia} />
                <CapabilitySelector
                  capabilities={resolvedMedia.capabilities}
                  onSelectCapability={handleSelectCapability}
                  selectedCapabilityId={selectedCapId}
                  downloadState={downloadState}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BATCH QUEUE MODE */}
        {activeTab === 'batch' && (
          <div className="w-full flex flex-col items-center animate-fade-in space-y-6">
            {!activeBatch ? (
              <BatchInputForm
                onSubmitBatch={handleCreateBatch}
                isLoading={isBatchCreating}
                maxBatchSize={10}
              />
            ) : (
              <BatchQueueView
                initialBatch={activeBatch}
                onNewBatch={() => setActiveBatch(null)}
                onRecordHistory={handleRecordBatchJobHistory}
              />
            )}
          </div>
        )}

        {/* Supported Platform Badges */}
        <div className="w-full mt-8 mb-4">
          <PlatformPills
            activePlatformId={
              activeTab === 'single' ? detectedPlatformId : null
            }
          />
        </div>

        {/* How To Use */}
        <HowToSection />

        {/* Features */}
        <FeaturesSection />

        {/* Value Proposition & Integrity Pillars */}
        <div className="w-full border-t border-app pt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-left">
          <div className="p-3 sm:p-4 rounded-xl bg-app-surface border border-app flex items-start sm:flex-col gap-3 sm:gap-0 sm:space-y-2 shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-app-elevated border border-app text-app-cta flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-app-main leading-snug">{t('pillarHonestyTitle')}</h3>
              <p className="text-[11px] sm:text-xs text-app-muted leading-relaxed mt-0.5 sm:mt-1">
                {t('pillarHonestyDesc')}
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-app-surface border border-app flex items-start sm:flex-col gap-3 sm:gap-0 sm:space-y-2 shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-app-elevated border border-app text-app-cta flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-app-main leading-snug">{t('pillarSafetyTitle')}</h3>
              <p className="text-[11px] sm:text-xs text-app-muted leading-relaxed mt-0.5 sm:mt-1">
                {t('pillarSafetyDesc')}
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-app-surface border border-app flex items-start sm:flex-col gap-3 sm:gap-0 sm:space-y-2 shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-app-elevated border border-app text-app-cta flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-app-main leading-snug">{t('pillarPrivacyTitle')}</h3>
              <p className="text-[11px] sm:text-xs text-app-muted leading-relaxed mt-0.5 sm:mt-1">
                {t('pillarPrivacyDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <FaqSection />

        {/* Platform Directory & Internal Linking */}
        <div className="w-full border-t border-app pt-10 pb-4 space-y-4 text-left">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-app-cta" />
            <h2 className="text-xs sm:text-sm font-bold text-app-main uppercase tracking-wider">
              {t('platformDirectoryTitle')}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <Link
              href="/tiktok-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">TikTok</span>
              <span className="text-[10px] text-app-subtle">Video & Audio</span>
            </Link>
            <Link
              href="/instagram-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">Instagram</span>
              <span className="text-[10px] text-app-subtle">Reels & Foto</span>
            </Link>
            <Link
              href="/youtube-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">YouTube</span>
              <span className="text-[10px] text-app-subtle">Shorts & Video</span>
            </Link>
            <Link
              href="/twitter-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">X / Twitter</span>
              <span className="text-[10px] text-app-subtle">Video & Klip</span>
            </Link>
            <Link
              href="/facebook-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">Facebook</span>
              <span className="text-[10px] text-app-subtle">Reels & HD</span>
            </Link>
            <Link
              href="/pinterest-downloader"
              className="p-3 rounded-xl bg-app-surface border border-app hover:border-app-cta hover:bg-app-elevated text-xs text-app-muted hover:text-app-main transition-all flex flex-col items-center text-center space-y-1 shadow-sm"
            >
              <span className="font-bold text-app-main">Pinterest</span>
              <span className="text-[10px] text-app-subtle">Pin & Gambar</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-app py-6 text-center text-xs text-app-subtle bg-app-surface/50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>{t('footerCopyright')}</span>
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <span className="font-mono text-[11px] text-app-cta">
                {t('footerTagline')}
              </span>
              <span className="hidden sm:inline text-app-surface">|</span>
              <span className="text-[11px]">
                {t('footerMadeBy')}{' '}
                <a
                  href="https://acelino.my.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-app-cta hover:underline transition-all"
                >
                  acelino.my.id
                </a>
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 pt-1 border-t border-app">
            <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
            <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
            <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
            <Link href="/contact" className="hover:text-app-cta transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>

      {/* History Drawer Modal */}
      <DownloadHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={historyItems}
        onClear={handleClearHistory}
        onRemoveItem={handleRemoveHistoryItem}
        onSelectUrl={handleSelectFromHistory}
      />
    </div>
  );
}
