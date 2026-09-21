'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Tempelink App Error]', error);
    }
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full p-8 rounded-2xl bg-app-surface border border-app shadow-sm space-y-6">
        <div className="w-12 h-12 rounded-xl bg-app-elevated border border-app flex items-center justify-center mx-auto text-app-cta">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-app-main">
            Terjadi Kesalahan
          </h1>
          <p className="text-sm text-app-muted leading-relaxed">
            Terjadi kendala saat memuat halaman ini. Silakan coba muat ulang atau kembali ke beranda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-app-cta text-[var(--accent-cta-text)] text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl border border-app bg-app-main text-app-main text-sm font-medium hover:bg-app-elevated transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
