'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BatchSummaryResponse,
  QueueJob,
  JobStatus,
} from '@/lib/types/queue';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  XCircle,
  Download,
  RotateCw,
  Ban,
  PlusCircle,
  Video,
  Film,
  PlaySquare,
  Share2,
  Pin,
} from 'lucide-react';
import { useApp } from '@/lib/context/app-context';
import { executeImmediateDownload } from '@/lib/download/client-download';
import { YouTubeGuideModal } from '@/components/youtube-guide-modal';

interface BatchQueueViewProps {
  initialBatch: BatchSummaryResponse;
  onNewBatch: () => void;
  onRecordHistory?: (job: QueueJob) => void;
}

const XLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className || 'w-4 h-4'}
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tiktok: Video,
  instagram: Film,
  youtube: PlaySquare,
  x: XLogo,
  facebook: Share2,
  pinterest: Pin,
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'text-rose-500 bg-app-elevated border-app',
  instagram: 'text-amber-600 bg-app-elevated border-app',
  youtube: 'text-red-600 bg-app-elevated border-app',
  x: 'text-app-main bg-app-elevated border-app',
  facebook: 'text-blue-600 bg-app-elevated border-app',
  pinterest: 'text-rose-700 bg-app-elevated border-app',
  unknown: 'text-app-subtle bg-app-elevated border-app',
};

export const BatchQueueView: React.FC<BatchQueueViewProps> = ({
  initialBatch,
  onNewBatch,
  onRecordHistory,
}) => {
  const { t } = useApp();
  const [batch, setBatch] = useState<BatchSummaryResponse>(initialBatch);
  const [isCancelling, setIsCancelling] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadErrorJobId, setDownloadErrorJobId] = useState<string | null>(null);
  const [isYouTubeGuideOpen, setIsYouTubeGuideOpen] = useState(false);
  const [guideMediaTitle, setGuideMediaTitle] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isTerminal =
    batch.status === 'COMPLETED' ||
    batch.status === 'PARTIAL_SUCCESS' ||
    batch.status === 'FAILED' ||
    batch.status === 'CANCELLED';

  const fetchBatchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/batch/${batch.batchId}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setBatch(json.data);
      }
    } catch {
      // Ignore
    }
  }, [batch.batchId]);

  useEffect(() => {
    if (isTerminal) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(fetchBatchStatus, 2000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isTerminal, fetchBatchStatus]);

  const handleCancelBatch = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/batch/${batch.batchId}/cancel`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBatch(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const res = await fetch(`/api/batch/${batch.batchId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBatch(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleDownloadItem = async (job: QueueJob) => {
    if (!job.selectedCapability) return;
    setDownloadingJobId(job.id);
    setDownloadError(null);
    setDownloadErrorJobId(null);

    try {
      const cap = job.selectedCapability;
      const filename = `${job.platform || 'media'}_${job.id.slice(0, 8)}_${cap.format || 'mp4'}.${cap.format === 'jpg' ? 'jpg' : 'mp4'}`;
      await executeImmediateDownload({
        token: cap.downloadToken,
        directUrl: cap.downloadUrl,
        filename,
      });

      if (job.platform === 'youtube') {
        setGuideMediaTitle(job.mediaMetadata?.title || null);
        setIsYouTubeGuideOpen(true);
      }

      if (onRecordHistory) {
        onRecordHistory(job);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unduhan gagal. Coba lagi.';
      setDownloadError(msg);
      setDownloadErrorJobId(job.id);
    } finally {
      setTimeout(() => setDownloadingJobId(null), 1500);
    }
  };

  const renderStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-surface text-app-subtle text-xs font-semibold border border-app">
            <Clock className="w-3 h-3" />
            <span>{t('batchStatusPending')}</span>
          </span>
        );
      case 'RESOLVING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-elevated text-app-cta text-xs font-semibold border border-app animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('batchStatusProcessing')}</span>
          </span>
        );
      case 'READY':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-400 text-xs font-semibold border border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>{t('batchStatusCompleted')}</span>
          </span>
        );
      case 'DOWNLOADING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-elevated text-app-cta text-xs font-semibold border border-app">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('btnDownloading')}</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-950/40 text-rose-400 text-xs font-semibold border border-rose-800/40">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>{t('batchStatusFailed')}</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-app-surface text-app-subtle text-xs font-semibold border border-app">
            <XCircle className="w-3 h-3" />
            <span>Dibatalkan</span>
          </span>
        );
    }
  };

  const progressPct =
    batch.total > 0
      ? Math.round(((batch.completed + batch.failed) / batch.total) * 100)
      : 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col space-y-6 animate-fade-in">
      {/* Batch Header Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-app-surface border border-app shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-app-cta bg-app-elevated px-2 py-0.5 rounded border border-app font-bold">
                Batch #{batch.batchId.slice(0, 8)}
              </span>
              <span className="text-xs text-app-subtle">•</span>
              <span className="text-xs font-semibold text-app-muted">
                {batch.total} Tautan Terdaftar
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-app-main mt-1">
              {t('batchProgress')}
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {!isTerminal && (
              <button
                type="button"
                onClick={handleCancelBatch}
                disabled={isCancelling}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-app-elevated hover:bg-rose-950/40 text-app-muted hover:text-rose-400 border border-app text-xs font-semibold transition-all cursor-pointer"
              >
                {isCancelling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span>{t('btnCancelBatch')}</span>
              </button>
            )}


            <button
              type="button"
              onClick={onNewBatch}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Batch Baru</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-app-muted font-medium">
              Progress:{' '}
              <strong className="text-app-main">
                {batch.completed} / {batch.total} {t('batchCompleted')}
              </strong>
            </span>
            <span className="font-mono text-app-cta font-bold">{progressPct}%</span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-app-elevated overflow-hidden border border-app">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                batch.failed > 0 && batch.completed === 0
                  ? 'bg-rose-500'
                  : batch.status === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : 'bg-app-cta'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Counts breakdown */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-app-subtle">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Selesai: {batch.completed}</span>
            </span>

            {batch.failed > 0 && (
              <span className="flex items-center space-x-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span>Gagal: {batch.failed}</span>
              </span>
            )}

            {batch.cancelled > 0 && (
              <span className="flex items-center space-x-1 text-app-subtle">
                <span className="w-2 h-2 rounded-full bg-app-subtle inline-block" />
                <span>Dibatalkan: {batch.cancelled}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Jobs Queue Items List */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-bold text-app-muted px-1">
          Daftar Antrean ({batch.jobs.length})
        </h3>

        <div className="space-y-2.5">
          {batch.jobs.map((job, index) => {
            const Icon = PLATFORM_ICONS[job.platform] || PLATFORM_ICONS.unknown;
            const colorClass =
              PLATFORM_COLORS[job.platform] || PLATFORM_COLORS.unknown;

            const isCompleted = job.status === 'COMPLETED';
            const isFailed = job.status === 'FAILED';
            const isResolving = job.status === 'RESOLVING';

            return (
              <div
                key={job.id}
                className="p-3.5 sm:p-4 rounded-xl bg-app-surface border border-app hover:border-app-cta transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                {/* Left side: Platform & Title */}
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}
                    title={job.platform.toUpperCase()}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-app-subtle">
                        #{index + 1}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-app-main">
                        {job.platform}
                      </span>
                      {job.selectedCapability && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-app-elevated text-app-cta border border-app">
                          {job.selectedCapability.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-app-main truncate max-w-full">
                      {job.mediaMetadata?.title || job.sourceUrl}
                    </p>

                    {isFailed ? (
                      <p className="text-xs text-rose-500 font-medium">
                        Kesalahan: {job.errorMessage || 'Gagal memproses media'}
                      </p>
                    ) : (
                      <p className="text-[11px] text-app-subtle font-mono truncate">
                        {job.sourceUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Status Badge & Actions */}
                <div className="flex items-center justify-between sm:justify-end space-x-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-app">
                  {renderStatusBadge(job.status)}

                  <div>
                    {isCompleted && job.selectedCapability && (
                      <div className="flex flex-col items-end space-y-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadItem(job)}
                          disabled={downloadingJobId === job.id}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                          {downloadingJobId === job.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{t('btnDownload')}</span>
                        </button>
                        {downloadErrorJobId === job.id && downloadError && (
                          <p className="text-[10px] text-rose-500 font-medium text-right max-w-[180px] leading-tight">
                            {downloadError}
                          </p>
                        )}
                      </div>
                    )}

                    {isFailed && (
                      <button
                        type="button"
                        onClick={() => handleRetryJob(job.id)}
                        disabled={retryingJobId === job.id}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-app-elevated hover:opacity-90 text-app-main text-xs font-semibold border border-app transition-all cursor-pointer"
                      >
                        {retryingJobId === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="w-3.5 h-3.5 text-app-cta" />
                        )}
                        <span>{t('btnRetry')}</span>
                      </button>
                    )}

                    {isResolving && (
                      <span className="text-xs text-app-subtle italic">
                        {t('batchStatusProcessing')}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* YouTube Download Guide Modal */}
      <YouTubeGuideModal
        isOpen={isYouTubeGuideOpen}
        onClose={() => setIsYouTubeGuideOpen(false)}
        mediaTitle={guideMediaTitle}
      />
    </div>
  );
};
