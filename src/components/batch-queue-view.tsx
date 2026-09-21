'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BatchSummaryResponse,
  JobStatus,
  QueueJob,
} from '@/lib/types/queue';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Download,
  RotateCw,
  Ban,
  Film,
  Video,
  PlaySquare,
  Share2,
  Pin,
  PlusCircle,
} from 'lucide-react';

interface BatchQueueViewProps {
  initialBatch: BatchSummaryResponse;
  onNewBatch: () => void;
  onRecordHistory?: (job: QueueJob) => void;
}

// Crisp X Logo icon
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
  tiktok: 'text-pink-400 bg-pink-950/40 border-pink-800/40',
  instagram: 'text-purple-400 bg-purple-950/40 border-purple-800/40',
  youtube: 'text-red-400 bg-red-950/40 border-red-800/40',
  x: 'text-slate-200 bg-slate-800/60 border-slate-700/50',
  facebook: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
  pinterest: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
  unknown: 'text-slate-400 bg-slate-900 border-slate-800',
};

export const BatchQueueView: React.FC<BatchQueueViewProps> = ({
  initialBatch,
  onNewBatch,
  onRecordHistory,
}) => {
  const [batch, setBatch] = useState<BatchSummaryResponse>(initialBatch);
  const [isCancelling, setIsCancelling] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
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
      // Network hiccup; will retry next interval
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

    pollingRef.current = setInterval(fetchBatchStatus, 1500);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isTerminal, fetchBatchStatus]);

  const handleCancelBatch = async () => {
    if (isCancelling || isTerminal) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/batch/${batch.batchId}/cancel`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success && json.data?.batch) {
        setBatch(json.data.batch);
      }
    } catch {
      // Ignore
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    if (retryingJobId) return;
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

    try {
      const token = job.selectedCapability.downloadToken;
      if (token) {
        // Direct download using GET route with signed token
        const downloadUrl = `/api/media/download?token=${encodeURIComponent(token)}`;
        window.open(downloadUrl, '_blank');
      } else if (job.selectedCapability.downloadUrl) {
        window.open(job.selectedCapability.downloadUrl, '_blank');
      }

      if (onRecordHistory) {
        onRecordHistory(job);
      }
    } catch {
      // Ignore
    } finally {
      setTimeout(() => setDownloadingJobId(null), 1500);
    }
  };

  // Status badge config
  const renderStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700/60">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Menunggu</span>
          </span>
        );
      case 'RESOLVING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-950/60 text-cyan-300 text-xs font-medium border border-cyan-800/60 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            <span>Memproses</span>
          </span>
        );
      case 'READY':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 text-xs font-medium border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Siap Diunduh</span>
          </span>
        );
      case 'DOWNLOADING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 text-xs font-medium border border-blue-800/60">
            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            <span>Mengunduh</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-950/60 text-rose-300 text-xs font-medium border border-rose-800/60">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Gagal</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 text-slate-500 text-xs font-medium border border-slate-800">
            <XCircle className="w-3 h-3 text-slate-500" />
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
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                Batch #{batch.batchId.slice(0, 8)}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-medium text-slate-400">
                {batch.total} Tautan Terdaftar
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              Proses Antrean Unduhan Media
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {!isTerminal && (
              <button
                type="button"
                onClick={handleCancelBatch}
                disabled={isCancelling}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-semibold transition-all cursor-pointer"
              >
                {isCancelling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>Batalkan Antrean</span>
              </button>
            )}

            <button
              type="button"
              onClick={onNewBatch}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Batch Baru</span>
            </button>
          </div>
        </div>

        {/* Deterministic Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              Progress:{' '}
              <strong className="text-white">
                {batch.completed} dari {batch.total} selesai
              </strong>
            </span>
            <span className="font-mono text-cyan-400">{progressPct}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                batch.failed > 0 && batch.completed === 0
                  ? 'bg-rose-500'
                  : batch.status === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Counts breakdown */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Selesai: {batch.completed}</span>
            </span>

            {batch.failed > 0 && (
              <span className="flex items-center space-x-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span>Gagal: {batch.failed}</span>
              </span>
            )}

            {batch.cancelled > 0 && (
              <span className="flex items-center space-x-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
                <span>Dibatalkan: {batch.cancelled}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Jobs Queue Items List */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 px-1">
          Daftar Antrean Item ({batch.jobs.length})
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
                className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
              >
                {/* Left side: Platform & Title */}
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  {/* Platform Icon Badge */}
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}
                    title={job.platform.toUpperCase()}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-slate-500">
                        #{index + 1}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        {job.platform}
                      </span>
                      {job.selectedCapability && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-cyan-300 border border-slate-700">
                          {job.selectedCapability.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-white truncate max-w-full">
                      {job.mediaMetadata?.title || job.sourceUrl}
                    </p>

                    {/* Subtext: Author or Error */}
                    {isFailed ? (
                      <p className="text-xs text-rose-400 font-medium">
                        Kesalahan: {job.errorMessage || 'Gagal memproses media'}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {job.sourceUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Status Badge & Actions */}
                <div className="flex items-center justify-between sm:justify-end space-x-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  {/* Status Badge */}
                  {renderStatusBadge(job.status)}

                  {/* Action Buttons */}
                  <div>
                    {isCompleted && job.selectedCapability && (
                      <button
                        type="button"
                        onClick={() => handleDownloadItem(job)}
                        disabled={downloadingJobId === job.id}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        {downloadingJobId === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Unduh</span>
                      </button>
                    )}

                    {isFailed && (
                      <button
                        type="button"
                        onClick={() => handleRetryJob(job.id)}
                        disabled={retryingJobId === job.id}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                      >
                        {retryingJobId === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span>Coba Lagi</span>
                      </button>
                    )}

                    {isResolving && (
                      <span className="text-xs text-slate-500 italic">
                        Menunggu resolver...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
