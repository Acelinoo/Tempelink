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
  Zap,
  CheckCircle2,
  Shield,
  EyeOff,
  Link2,
  Layers,
} from 'lucide-react';

export default function HomePage() {
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

  // Synchronize local anonymous history via useSyncExternalStore (React 19 / SSR friendly)
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
          message: data?.error?.message || 'Gagal memproses URL.',
          code: data?.error?.code || 'RESOLUTION_FAILED',
        });
        return;
      }

      setResolvedMedia(data.data);
    } catch {
      setError({
        message:
          'Koneksi jaringan gagal. Pastikan koneksi internet Anda aktif.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Single URL Capability Selection & Download
  const handleSelectCapability = async (cap: Capability) => {
    if (!resolvedMedia || downloadState === 'downloading') return;
    setSelectedCapId(cap.id);
    setDownloadState('downloading');
    setError(null);

    try {
      const res = await fetch('/api/media/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: resolvedMedia.id,
          capabilityId: cap.id,
          sourceUrl: resolvedMedia.sourceUrl,
          downloadToken: cap.downloadToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setDownloadState('error');
        setError({
          message:
            data?.error?.message || 'Opsi unduhan sedang tidak tersedia.',
          code: data?.error?.code || 'DOWNLOAD_UNAVAILABLE',
        });
        return;
      }

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

      if (data.data?.downloadUrl) {
        window.open(data.data.downloadUrl, '_blank');
      }

      setTimeout(() => {
        setDownloadState('idle');
      }, 3000);
    } catch {
      setDownloadState('error');
      setError({
        message: 'Gagal menginisiasi unduhan media.',
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
          message: data?.error?.message || 'Gagal mendaftarkan antrean batch.',
          code: data?.error?.code || 'BATCH_FAILED',
        });
        return;
      }

      setActiveBatch(data.data);
    } catch {
      setError({
        message:
          'Koneksi gagal saat mendaftarkan batch. Pastikan koneksi internet aktif.',
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
    <div className="flex flex-col min-h-screen">
      <Navbar
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={historyItems.length}
      />

      <main className="flex-1 flex flex-col items-center justify-start px-3 sm:px-6 pt-10 sm:pt-16 pb-16 max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-6 sm:mb-8 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-cyan-400">
            <Zap className="w-3.5 h-3.5" />
            <span>Deteksi Otomatis & Resolusi Asli</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Universal Media Utility Platform
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
            Tempel tautan video atau media untuk memeriksa kapabilitas dan resolusi yang benar-benar tersedia secara langsung.
          </p>
        </div>

        {/* Mode Navigation Tabs (Single vs Batch) */}
        <div className="w-full max-w-md mx-auto mb-6 p-1 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('single');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Tautan Tunggal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('batch');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch & Antrean (Max 10)</span>
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
        <div className="w-full mt-8 mb-12">
          <PlatformPills
            activePlatformId={
              activeTab === 'single' ? detectedPlatformId : null
            }
          />
        </div>

        {/* Value Proposition & Integrity Pillars */}
        <div className="w-full border-t border-slate-800/80 pt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col space-y-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Kejujuran Resolusi</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kami tidak pernah memalsukan label HD atau melakukan upscaling palsu. Opsi yang tampil adalah opsi nyata dari sumber.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Bebas Iklan & Jebakan</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tidak ada tombol unduh palsu, redirect malware, ataupun popup mengganggu. Tempelink berfokus murni pada utilitas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-800/40 flex items-center justify-center">
              <EyeOff className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Privasi Pengguna</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gunakan langsung tanpa registrasi. Riwayat disimpan secara lokal di browser perangkat Anda dan tidak dikirim ke server.
            </p>
          </div>
        </div>

        {/* Platform Directory & Internal Linking */}
        <div className="w-full border-t border-slate-800/80 pt-10 pb-4 space-y-4 text-left">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
              Pengunduh Berdasarkan Platform
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <Link
              href="/tiktok-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">TikTok</span>
              <span className="text-[10px] text-slate-500">Video & Audio</span>
            </Link>
            <Link
              href="/instagram-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">Instagram</span>
              <span className="text-[10px] text-slate-500">Reels & Foto</span>
            </Link>
            <Link
              href="/youtube-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">YouTube</span>
              <span className="text-[10px] text-slate-500">Shorts & Video</span>
            </Link>
            <Link
              href="/twitter-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">X / Twitter</span>
              <span className="text-[10px] text-slate-500">Video & Klip</span>
            </Link>
            <Link
              href="/facebook-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">Facebook</span>
              <span className="text-[10px] text-slate-500">Reels & HD</span>
            </Link>
            <Link
              href="/pinterest-downloader"
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs text-slate-300 hover:text-white transition-all flex flex-col items-center text-center space-y-1"
            >
              <span className="font-semibold text-white">Pinterest</span>
              <span className="text-[10px] text-slate-500">Pin & Gambar</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <span className="font-mono text-[11px] text-cyan-400">
            Phase 8 • SEO, Platform Pages & Discoverability
          </span>
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
