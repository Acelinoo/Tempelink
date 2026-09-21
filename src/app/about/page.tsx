import type { Metadata } from 'next';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/seo/platform-seo-data';

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: 'Tentang Tempelink — Universal Media Utility',
  description:
    'Pelajari tentang Tempelink, utilitas pengunduh media universal yang membantu Anda menyimpan video, foto, dan audio dari berbagai platform secara bersih dan transparan.',
  alternates: { canonical: `${baseUrl}/about` },
  openGraph: {
    title: 'Tentang Tempelink',
    description: 'Utilitas pengunduh media universal — bersih, transparan, tanpa manipulasi resolusi.',
    url: `${baseUrl}/about`,
    siteName: 'Tempelink',
    locale: 'id_ID',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main">
      {/* Header */}
      <header className="w-full border-b border-app bg-app-surface/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-app-cta flex items-center justify-center font-black text-sm text-[var(--accent-cta-text)]">
              T
            </div>
            <span className="font-extrabold tracking-tight text-base text-app-main">Tempelink</span>
          </Link>
          <nav className="flex items-center space-x-4 text-xs text-app-muted">
            <Link href="/" className="hover:text-app-main transition-colors">Beranda</Link>
            <Link href="/contact" className="hover:text-app-main transition-colors">Kontak</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-app-main tracking-tight">
            Tentang Tempelink
          </h1>
          <p className="text-sm text-app-subtle">
            Platform utilitas media universal
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-app-main">Apa itu Tempelink?</h2>
          <p className="text-sm text-app-muted leading-relaxed">
            Tempelink adalah utilitas pengunduh media berbasis web yang membantu pengguna menyimpan
            konten publik dari berbagai platform media sosial, termasuk TikTok, Instagram, YouTube,
            X (Twitter), Facebook, dan Pinterest. Tempelink dirancang untuk penggunaan personal dan
            berfokus pada transparansi, kejujuran resolusi, dan kemudahan penggunaan.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-app-main">Masalah yang Kami Selesaikan</h2>
          <p className="text-sm text-app-muted leading-relaxed">
            Banyak alat pengunduh media yang beredar di internet memenuhi layarnya dengan iklan
            agresif, tombol unduh palsu, dan klaim resolusi yang tidak sesuai kenyataan. Tempelink
            hadir sebagai alternatif yang jujur: kami hanya menampilkan opsi unduhan yang
            benar-benar tersedia dari sumbernya, tanpa manipulasi label resolusi atau pengalihan
            yang menyesatkan.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-app-main">Cara Kerja Tempelink</h2>
          <p className="text-sm text-app-muted leading-relaxed">
            Ketika Anda menempelkan tautan media ke Tempelink, sistem kami menghubungi penyedia
            upstream yang terotorisasi untuk mengidentifikasi format dan resolusi yang tersedia
            secara aktual. Hasilnya ditampilkan apa adanya. Proses unduhan dilakukan secara
            langsung ke perangkat Anda — Tempelink tidak menyimpan file media di server kami.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {[
              { step: '1', title: 'Tempel Tautan', desc: 'Tempel URL media publik dari platform yang didukung.' },
              { step: '2', title: 'Periksa Opsi', desc: 'Sistem mendeteksi format dan resolusi yang tersedia secara aktual.' },
              { step: '3', title: 'Unduh Langsung', desc: 'File tersimpan langsung ke perangkat Anda tanpa pengalihan.' },
            ].map((s) => (
              <div key={s.step} className="p-4 rounded-xl bg-app-surface border border-app space-y-2">
                <span className="text-xs font-black text-app-cta">{s.step}</span>
                <h3 className="text-sm font-bold text-app-main">{s.title}</h3>
                <p className="text-xs text-app-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-app-main">Platform yang Didukung</h2>
          <div className="flex flex-wrap gap-2">
            {['TikTok', 'Instagram', 'YouTube', 'X / Twitter', 'Facebook', 'Pinterest'].map((p) => (
              <span key={p} className="px-3 py-1 text-xs font-semibold border-b border-app-cta text-app-main">
                {p}
              </span>
            ))}
          </div>
          <p className="text-xs text-app-subtle leading-relaxed">
            Tempelink hanya mendukung konten yang bersifat publik. Konten dari akun privat,
            konten berbayar, atau konten yang dilindungi DRM tidak dapat diproses.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-app-main">Prinsip Layanan</h2>
          <ul className="space-y-3 text-sm text-app-muted">
            <li className="flex gap-3">
              <span className="font-bold text-app-cta shrink-0">—</span>
              <span><strong className="text-app-main">Kejujuran resolusi:</strong> Kami tidak memalsukan label kualitas. Resolusi yang ditampilkan adalah resolusi aktual dari file sumber.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-app-cta shrink-0">—</span>
              <span><strong className="text-app-main">Tanpa penyimpanan media:</strong> File yang Anda unduh tidak disimpan di server Tempelink.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-app-cta shrink-0">—</span>
              <span><strong className="text-app-main">Tanpa registrasi:</strong> Tempelink dapat digunakan langsung tanpa membuat akun.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-app-cta shrink-0">—</span>
              <span><strong className="text-app-main">Riwayat lokal:</strong> Riwayat unduhan disimpan hanya di browser Anda secara lokal (localStorage), bukan di server kami.</span>
            </li>
          </ul>
        </section>

        <section className="p-5 rounded-xl bg-app-surface border border-app space-y-2">
          <h2 className="text-sm font-bold text-app-main">Hubungi Kami</h2>
          <p className="text-xs text-app-muted leading-relaxed">
            Untuk pertanyaan, laporan masalah, atau keperluan lainnya, silakan kunjungi halaman{' '}
            <Link href="/contact" className="text-app-cta hover:underline">Kontak</Link>.
            Anda juga dapat membaca{' '}
            <Link href="/privacy" className="text-app-cta hover:underline">Kebijakan Privasi</Link>{' '}
            dan{' '}
            <Link href="/terms" className="text-app-cta hover:underline">Ketentuan Layanan</Link>{' '}
            kami.
          </p>
        </section>
      </main>

      <footer className="w-full border-t border-app py-6 bg-app-surface/50">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-app-subtle">
          <span>© 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
            <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
            <Link href="/contact" className="hover:text-app-cta transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
