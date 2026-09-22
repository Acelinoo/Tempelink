import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getBaseUrl } from '@/lib/seo/platform-seo-data';

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: 'Kontak',
  description:
    'Hubungi tim Tempelink untuk pertanyaan, laporan masalah teknis, atau keperluan lainnya.',
  alternates: { canonical: `${baseUrl}/contact` },
  openGraph: {
    title: 'Kontak — Tempelink',
    description: 'Hubungi tim Tempelink untuk pertanyaan atau laporan masalah.',
    url: `${baseUrl}/contact`,
    siteName: 'Tempelink',
    locale: 'id_ID',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main">
      <header className="w-full border-b border-app bg-app-surface/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="Tempelink Logo"
              width={28}
              height={28}
              className="w-7 h-7 object-contain rounded-md shadow-sm flex-shrink-0"
              priority
            />
            <span className="font-extrabold tracking-tight text-base text-app-main">Tempelink</span>
          </Link>
          <nav className="flex items-center space-x-4 text-xs text-app-muted">
            <Link href="/" className="hover:text-app-main transition-colors">Beranda</Link>
            <Link href="/about" className="hover:text-app-main transition-colors">Tentang</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-app-main tracking-tight">
            Kontak
          </h1>
          <p className="text-sm text-app-muted leading-relaxed">
            Untuk pertanyaan, laporan masalah teknis, atau keperluan lainnya, berikut cara
            menghubungi kami.
          </p>
        </div>

        {/* Developer Contact */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-app-main">Kontak Pengembang</h2>
          <div className="p-5 rounded-xl bg-app-surface border border-app space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-app-subtle uppercase tracking-wider">Website</p>
              <a
                href="https://acelino.my.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-app-cta hover:underline"
              >
                acelino.my.id
              </a>
            </div>
            <p className="text-xs text-app-subtle leading-relaxed">
              Tempelink dikembangkan oleh Acelino. Untuk pertanyaan teknis, laporan bug, atau
              keperluan bisnis, silakan kunjungi website pengembang di atas.
            </p>
          </div>
        </section>

        {/* Common Topics */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-app-main">Pertanyaan Umum</h2>
          <p className="text-sm text-app-muted leading-relaxed">
            Sebelum menghubungi kami, pastikan Anda sudah memeriksa halaman{' '}
            <Link href="/#faq" className="text-app-cta hover:underline">FAQ di halaman utama</Link>.
            Sebagian besar pertanyaan umum telah dijawab di sana.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                topic: 'Laporan Bug Teknis',
                desc: 'Jika unduhan gagal, halaman error, atau ada fungsi yang tidak berjalan, sertakan URL yang Anda coba dan deskripsi masalahnya.',
              },
              {
                topic: 'Permintaan Platform Baru',
                desc: 'Ingin kami mendukung platform media lain? Sampaikan melalui website pengembang.',
              },
              {
                topic: 'Pertanyaan Privasi',
                desc: 'Pertanyaan terkait data dan privasi dapat juga merujuk ke Kebijakan Privasi kami.',
              },
              {
                topic: 'Kemitraan atau Bisnis',
                desc: 'Untuk keperluan kemitraan atau bisnis, silakan hubungi melalui website pengembang.',
              },
            ].map((item) => (
              <div key={item.topic} className="p-4 rounded-xl bg-app-surface border border-app space-y-1.5">
                <h3 className="text-sm font-bold text-app-main">{item.topic}</h3>
                <p className="text-xs text-app-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="p-5 rounded-xl bg-app-surface border border-app space-y-3">
          <h2 className="text-sm font-bold text-app-main">Halaman Terkait</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/about" className="text-xs text-app-cta hover:underline">Tentang Tempelink</Link>
            <span className="text-app-subtle text-xs">•</span>
            <Link href="/privacy" className="text-xs text-app-cta hover:underline">Kebijakan Privasi</Link>
            <span className="text-app-subtle text-xs">•</span>
            <Link href="/terms" className="text-xs text-app-cta hover:underline">Ketentuan Layanan</Link>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-app py-6 bg-app-surface/50">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-app-subtle">
          <span>© 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
            <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
            <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
