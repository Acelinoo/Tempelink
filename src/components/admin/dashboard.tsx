'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, LogOut, Download, TrendingUp, XCircle, Clock, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatAdminTimestamp, formatAdminTimestampShort, formatNumber, formatPercent } from '@/lib/admin/format';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'all';

interface Stats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}

interface PlatformCount { platform: string; count: number; }

interface DownloadLogRow {
  id: string;
  url: string;
  platform: string | null;
  downloader_type: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ListResult {
  rows: DownloadLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  downloaderTypes: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', year: 'Tahun Ini', all: 'Semua',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    success: { backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' },
    failed: { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
    pending: { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' },
  };
  const labels: Record<string, string> = { success: 'Berhasil', failed: 'Gagal', pending: 'Menunggu' };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={styles[status] ?? { backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
      {labels[status] ?? status}
    </span>
  );
}

function truncateUrl(url: string, maxLength = 48): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + '...';
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ row, onClose }: { row: DownloadLogRow; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl border p-6 relative"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--card-shadow)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-subtle)' }}
          aria-label="Tutup">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text-main)' }}>Detail Download</h2>

        <dl className="space-y-3 text-sm">
          {[
            { label: 'ID', value: String(row.id) },
            { label: 'Status', value: <StatusBadge status={row.status} /> },
            { label: 'Platform', value: row.platform ?? '—' },
            { label: 'Tipe', value: row.downloader_type ?? '—' },
            { label: 'Dibuat', value: formatAdminTimestamp(row.created_at) },
            { label: 'Selesai', value: row.completed_at ? formatAdminTimestamp(row.completed_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</dt>
              <dd style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{value}</dd>
            </div>
          ))}

          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-medium" style={{ color: 'var(--text-subtle)' }}>URL</dt>
            <dd style={{ color: 'var(--text-main)', wordBreak: 'break-all', fontSize: '0.75rem' }}>
              {row.url}
            </dd>
          </div>

          {row.error_message && (
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium" style={{ color: '#EF4444' }}>Error</dt>
              <dd style={{ color: '#EF4444', wordBreak: 'break-word' }}>{row.error_message}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [period, setPeriod] = useState<Period>('today');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [downloaderType, setDownloaderType] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [stats, setStats] = useState<Stats | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformCount[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [listResult, setListResult] = useState<ListResult | null>(null);
  const [downloaderTypes, setDownloaderTypes] = useState<string[]>([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedRow, setSelectedRow] = useState<DownloadLogRow | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch Stats ───────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const params = new URLSearchParams({ period });
      if (platform !== 'all') params.set('platform', platform);
      const res = await fetch(`/api/admin/stats?${params}`, { credentials: 'include' });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      if (data.success) {
        setStats(data.data.stats);
        setPlatformSummary(data.data.platformSummary);
        setPlatforms(data.data.platforms);
        setLastRefresh(new Date());
      } else {
        setStatsError(data.error || 'Gagal memuat statistik.');
      }
    } catch {
      setStatsError('Gagal memuat statistik.');
    } finally {
      setLoadingStats(false);
    }
  }, [period, platform, onLogout]);

  // ─── Fetch List ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async (currentPage = page) => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ period, page: String(currentPage), pageSize: '20' });
      if (platform !== 'all') params.set('platform', platform);
      if (status !== 'all') params.set('status', status);
      if (downloaderType !== 'all') params.set('downloaderType', downloaderType);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/downloads?${params}`, { credentials: 'include' });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      if (data.success) {
        setListResult(data.data);
        setDownloaderTypes(data.data.downloaderTypes || []);
        setLastRefresh(new Date());
      } else {
        setListError(data.error || 'Gagal memuat data.');
      }
    } catch {
      setListError('Gagal memuat data.');
    } finally {
      setLoadingList(false);
    }
  }, [period, platform, status, downloaderType, search, dateFrom, dateTo, page, onLogout]);

  // ─── Initial Load & Filters ────────────────────────────────────────────────

  useEffect(() => {
    const run = async () => { await fetchStats(); };
    run();
  }, [fetchStats]);

  useEffect(() => {
    const run = async () => {
      setPage(1);
      await fetchList(1);
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, platform, status, downloaderType, dateFrom, dateTo]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchList(1);
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Auto-refresh every 30s
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      if (!document.hidden) {
        fetchStats();
        fetchList(page);
      }
    }, 30000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, platform, page]);

  // ─── Pagination ────────────────────────────────────────────────────────────

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchList(newPage);
  };

  // ─── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE', credentials: 'include' });
    } finally {
      onLogout();
    }
  };

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ period });
      if (platform !== 'all') params.set('platform', platform);
      if (status !== 'all') params.set('status', status);
      if (downloaderType !== 'all') params.set('downloaderType', downloaderType);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `tempelink-logs-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail — user sees nothing changed
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
              TEMPELINK
            </span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-subtle)', border: '1px solid var(--border-subtle)' }}>
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs hidden sm:block" style={{ color: 'var(--text-subtle)' }}>
              Diperbarui: {formatAdminTimestampShort(lastRefresh)}
            </span>
            <button onClick={() => { fetchStats(); fetchList(page); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
              title="Refresh" aria-label="Refresh data">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kunci</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
            Download Monitoring
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            Aktivitas downloader Tempelink secara real-time
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: period === p ? 'var(--accent-cta)' : 'var(--bg-surface-elevated)',
                color: period === p ? 'var(--accent-cta-text)' : 'var(--text-muted)',
                border: `1px solid ${period === p ? 'var(--accent-cta)' : 'var(--border-subtle)'}`,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        {statsError ? (
          <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: '#EF4444' }}>
            {statsError} <button onClick={fetchStats} className="underline ml-2" style={{ color: 'var(--accent-cta)' }}>Coba lagi</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: stats?.total, icon: <Download className="w-4 h-4" />, color: 'var(--text-main)' },
              { label: 'Berhasil', value: stats?.success, icon: <TrendingUp className="w-4 h-4" />, color: '#059669' },
              { label: 'Gagal', value: stats?.failed, icon: <XCircle className="w-4 h-4" />, color: '#DC2626' },
              { label: 'Menunggu', value: stats?.pending, icon: <Clock className="w-4 h-4" />, color: '#D97706' },
              { label: 'Success Rate', value: stats ? formatPercent(stats.successRate) : null, icon: <TrendingUp className="w-4 h-4" />, color: '#2563EB', isText: true },
            ].map(({ label, value, icon, color, isText }) => (
              <div key={label} className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color }}>
                  {icon}
                  <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</span>
                </div>
                {loadingStats ? (
                  <div className="h-7 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface-elevated)' }} />
                ) : (
                  <p className="text-2xl font-bold tabular-nums" style={{ color }}>
                    {isText ? value : (value != null ? formatNumber(value as number) : '—')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Platform Summary */}
        {!loadingStats && platformSummary.length > 0 && (
          <div className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
              Penggunaan Platform
            </h2>
            <div className="space-y-2">
              {platformSummary.map(({ platform: p, count }) => {
                const maxCount = platformSummary[0]?.count || 1;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={p} className="flex items-center gap-3">
                    <span className="w-20 text-xs capitalize shrink-0" style={{ color: 'var(--text-muted)' }}>{p}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--accent-cta)' }} />
                    </div>
                    <span className="text-xs tabular-nums w-10 text-right" style={{ color: 'var(--text-subtle)' }}>
                      {formatNumber(count)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border p-4 space-y-3"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>Filter &amp; Cari</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Cari URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none"
              style={{
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          {/* Filter selects */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                label: 'Platform', value: platform, onChange: setPlatform,
                options: [{ value: 'all', label: 'Semua Platform' }, ...platforms.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))],
              },
              {
                label: 'Status', value: status, onChange: setStatus,
                options: [{ value: 'all', label: 'Semua Status' }, { value: 'success', label: 'Berhasil' }, { value: 'failed', label: 'Gagal' }, { value: 'pending', label: 'Menunggu' }],
              },
              {
                label: 'Tipe', value: downloaderType, onChange: setDownloaderType,
                options: [{ value: 'all', label: 'Semua Tipe' }, ...downloaderTypes.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))],
              },
            ].map(({ label, value: val, onChange, options }) => (
              <select key={label} value={val} onChange={(e) => onChange(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                }}
                aria-label={label}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}

            <button onClick={handleExport} disabled={exporting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{exporting ? 'Mengekspor...' : 'Export CSV'}</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>

          {/* Custom Date Range */}
          <div className="flex gap-2 flex-wrap">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
              aria-label="Dari tanggal" />
            <span className="text-xs self-center" style={{ color: 'var(--text-subtle)' }}>→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
              aria-label="Sampai tanggal" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-2 py-1.5 text-xs rounded-lg"
                style={{ color: 'var(--text-subtle)', border: '1px solid var(--border-subtle)' }}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Activity Table */}
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
              Aktivitas Download
            </h2>
            {listResult && (
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {formatNumber(listResult.total)} total
              </span>
            )}
          </div>

          {/* Table scroll container */}
          <div className="overflow-x-auto">
            {listError ? (
              <div className="p-6 text-center">
                <p className="text-sm mb-2" style={{ color: 'var(--text-subtle)' }}>{listError}</p>
                <button onClick={() => fetchList(page)} className="text-xs underline" style={{ color: 'var(--accent-cta)' }}>
                  Coba lagi
                </button>
              </div>
            ) : loadingList ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface-elevated)' }} />
                ))}
              </div>
            ) : !listResult || listResult.rows.length === 0 ? (
              <div className="p-10 text-center">
                <Download className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--border-subtle)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {search || status !== 'all' || platform !== 'all'
                    ? 'Tidak ada aktivitas yang cocok dengan filter ini.'
                    : 'Belum ada aktivitas downloader.'}
                </p>
                {!search && status === 'all' && platform === 'all' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                    Aktivitas baru akan muncul di sini ketika pengguna menggunakan downloader Tempelink.
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Waktu', 'Platform', 'Tipe', 'URL', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold"
                        style={{ color: 'var(--text-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listResult.rows.map((row) => (
                    <tr key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {formatAdminTimestampShort(row.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs capitalize font-medium" style={{ color: 'var(--text-main)' }}>
                          {row.platform ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                          {row.downloader_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}
                          title={row.url}>
                          {truncateUrl(row.url)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {listResult && listResult.totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                Halaman {formatNumber(page)} dari {formatNumber(listResult.totalPages)}
              </span>
              <button onClick={() => handlePageChange(page + 1)} disabled={page >= listResult.totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Last Activity */}
        <div className="text-xs pb-6" style={{ color: 'var(--text-subtle)' }}>
          {listResult && listResult.rows.length > 0 ? (
            <span>Aktivitas terbaru: {formatAdminTimestamp(listResult.rows[0].created_at)}</span>
          ) : (
            <span>Belum ada aktivitas.</span>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
};
