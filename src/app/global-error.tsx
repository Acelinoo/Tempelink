'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error tanpa expose detail ke UI
    if (process.env.NODE_ENV === 'development') {
      console.error('[Tempelink Error]', error.message);
    }
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] text-[#F5F5F5] px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-[#005691] flex items-center justify-center font-black text-2xl text-white mx-auto">
            T
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white">Terjadi Kesalahan</h1>
            <p className="text-sm text-[#C0C0C0] leading-relaxed">
              Maaf, terjadi kesalahan yang tidak terduga. Tim kami akan segera menanganinya.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-[#005691] text-white text-sm font-bold hover:bg-[#004A7C] transition-colors"
            >
              Coba Lagi
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl border border-[#303030] bg-[#1A1A1A] text-[#F5F5F5] text-sm font-medium hover:bg-[#262626] transition-colors"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
