import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Halaman Tidak Ditemukan — Tempelink',
  description: 'Halaman yang Anda cari tidak tersedia.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center space-x-2.5 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="Tempelink Logo"
            width={40}
            height={40}
            className="w-10 h-10 object-contain rounded-lg shadow-sm"
          />
          <span className="font-extrabold text-xl tracking-tight text-app-main">Tempelink</span>
        </Link>

        {/* 404 */}
        <div className="space-y-3">
          <p className="text-6xl font-black text-app-cta">404</p>
          <h1 className="text-lg font-bold text-app-main">Halaman Tidak Ditemukan</h1>
          <p className="text-sm text-app-muted leading-relaxed">
            Halaman yang Anda cari tidak ada atau telah dipindahkan.
            Gunakan tautan di bawah untuk kembali ke halaman yang tersedia.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-app-cta text-[var(--accent-cta-text)] text-sm font-bold hover:opacity-90 transition-all shadow-sm"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-xl border border-app bg-app-surface text-app-main text-sm font-medium hover:bg-app-elevated transition-colors"
          >
            Hubungi Kami
          </Link>
        </div>

        {/* Quick links */}
        <div className="flex items-center justify-center gap-4 text-xs text-app-subtle pt-2">
          <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
          <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
          <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
        </div>
      </div>
    </div>
  );
}
