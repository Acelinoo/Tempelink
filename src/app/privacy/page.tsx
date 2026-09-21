import type { Metadata } from 'next';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/seo/platform-seo-data';

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — Tempelink',
  description:
    'Kebijakan privasi Tempelink menjelaskan data apa yang diproses, bagaimana data digunakan, hak pengguna, dan cara menghubungi kami terkait privasi.',
  alternates: { canonical: `${baseUrl}/privacy` },
  openGraph: {
    title: 'Kebijakan Privasi — Tempelink',
    description: 'Kebijakan privasi Tempelink: data yang diproses, cookies, layanan pihak ketiga, dan hak pengguna.',
    url: `${baseUrl}/privacy`,
    siteName: 'Tempelink',
    locale: 'id_ID',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '21 September 2026';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main">
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
            <Link href="/terms" className="hover:text-app-main transition-colors">Ketentuan</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-app-main tracking-tight">
            Kebijakan Privasi
          </h1>
          <p className="text-xs text-app-subtle">
            Terakhir diperbarui: {LAST_UPDATED}
          </p>
        </div>

        <p className="text-sm text-app-muted leading-relaxed">
          Kebijakan Privasi ini menjelaskan bagaimana Tempelink (<strong className="text-app-main">&quot;kami&quot;</strong>,{' '}
          <strong className="text-app-main">&quot;layanan&quot;</strong>) menangani informasi yang berkaitan dengan
          penggunaan layanan kami di <strong className="text-app-main">tempelink.vercel.app</strong>.
          Dengan menggunakan Tempelink, Anda menyatakan setuju dengan praktik yang dijelaskan
          dalam kebijakan ini.
        </p>

        {[
          {
            title: '1. Data yang Kami Proses',
            content: (
              <div className="space-y-3 text-sm text-app-muted leading-relaxed">
                <p><strong className="text-app-main">Data teknis otomatis:</strong> Ketika Anda mengakses Tempelink, server secara otomatis menerima informasi teknis standar seperti alamat IP, jenis browser, sistem operasi, waktu akses, dan URL yang diminta. Informasi ini diperlukan untuk operasional layanan dan tidak digunakan untuk mengidentifikasi Anda secara pribadi.</p>
                <p><strong className="text-app-main">Tautan yang Anda masukkan:</strong> URL yang Anda tempel ke formulir Tempelink dikirim ke server kami untuk diproses. Tautan ini diteruskan ke penyedia layanan upstream untuk mengekstrak metadata media. Tempelink tidak menyimpan tautan tersebut secara permanen setelah sesi pemrosesan selesai.</p>
                <p><strong className="text-app-main">Riwayat unduhan lokal:</strong> Riwayat unduhan Anda disimpan secara eksklusif di penyimpanan lokal browser Anda (localStorage). Data ini tidak pernah dikirim ke server Tempelink.</p>
              </div>
            ),
          },
          {
            title: '2. Cookies dan Penyimpanan Lokal',
            content: (
              <div className="space-y-2 text-sm text-app-muted leading-relaxed">
                <p>Tempelink menggunakan penyimpanan lokal browser (localStorage) untuk menyimpan preferensi tampilan (mode gelap/terang) dan pilihan bahasa. Tidak ada cookie pelacak pihak ketiga yang dipasang oleh Tempelink saat ini.</p>
                <p>Jika di masa mendatang kami mengintegrasikan layanan analytics atau periklanan pihak ketiga, kebijakan ini akan diperbarui terlebih dahulu.</p>
              </div>
            ),
          },
          {
            title: '3. Layanan Pihak Ketiga',
            content: (
              <div className="space-y-3 text-sm text-app-muted leading-relaxed">
                <p><strong className="text-app-main">Penyedia API Media (RapidAPI):</strong> Tempelink menggunakan penyedia API pihak ketiga melalui platform RapidAPI untuk mengekstrak informasi media dari platform yang didukung. Ketika Anda memasukkan tautan, metadata permintaan diteruskan ke penyedia tersebut. Kebijakan privasi penyedia berlaku untuk data yang mereka terima.</p>
                <p><strong className="text-app-main">Vercel:</strong> Tempelink di-hosting di platform Vercel. Vercel mungkin mengumpulkan data teknis standar sebagaimana diuraikan dalam kebijakan privasi Vercel.</p>
                <p><strong className="text-app-main">Google Fonts:</strong> Tempelink menggunakan font dari Google Fonts. Permintaan font mungkin melibatkan komunikasi dengan server Google.</p>
              </div>
            ),
          },
          {
            title: '4. Penggunaan Iklan',
            content: (
              <p className="text-sm text-app-muted leading-relaxed">
                Saat ini Tempelink tidak menampilkan iklan pihak ketiga. Jika kami mengintegrasikan
                jaringan periklanan di masa mendatang — termasuk Google AdSense — halaman ini akan
                diperbarui untuk mencerminkan informasi tersebut, termasuk jenis data yang mungkin
                dikumpulkan oleh jaringan periklanan untuk tujuan penargetan.
              </p>
            ),
          },
          {
            title: '5. Penyimpanan dan Retensi Data',
            content: (
              <p className="text-sm text-app-muted leading-relaxed">
                Tempelink tidak menyimpan file media yang Anda unduh. Log teknis operasional disimpan
                untuk keperluan keamanan dan pemecahan masalah dalam periode terbatas. Data antrean
                batch disimpan sementara di penyimpanan server dan dihapus secara otomatis setelah
                proses selesai atau kadaluwarsa.
              </p>
            ),
          },
          {
            title: '6. Hak Pengguna',
            content: (
              <div className="space-y-2 text-sm text-app-muted leading-relaxed">
                <p>Karena Tempelink tidak mengumpulkan data pribadi yang dapat diidentifikasi secara permanen, hak-hak seperti akses, koreksi, atau penghapusan data tidak berlaku secara langsung. Namun, Anda dapat:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Menghapus riwayat unduhan lokal kapan saja melalui tombol Hapus Riwayat di antarmuka Tempelink.</li>
                  <li>Menghapus localStorage browser Anda melalui pengaturan browser.</li>
                  <li>Menghubungi kami jika memiliki pertanyaan spesifik terkait data.</li>
                </ul>
              </div>
            ),
          },
          {
            title: '7. Keamanan',
            content: (
              <p className="text-sm text-app-muted leading-relaxed">
                Tempelink menerapkan langkah-langkah keamanan teknis termasuk enkripsi token unduhan
                dengan HMAC-SHA256, perlindungan SSRF, pembatasan laju permintaan (rate limiting),
                dan koneksi HTTPS. Namun, tidak ada sistem yang dapat menjamin keamanan absolut.
              </p>
            ),
          },
          {
            title: '8. Perubahan Kebijakan',
            content: (
              <p className="text-sm text-app-muted leading-relaxed">
                Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan signifikan
                akan diinformasikan melalui pembaruan tanggal di bagian atas halaman ini. Penggunaan
                Tempelink setelah perubahan berlaku berarti Anda menyetujui kebijakan yang diperbarui.
              </p>
            ),
          },
          {
            title: '9. Kontak',
            content: (
              <p className="text-sm text-app-muted leading-relaxed">
                Untuk pertanyaan terkait kebijakan privasi ini, silakan hubungi kami melalui{' '}
                <Link href="/contact" className="text-app-cta hover:underline">halaman Kontak</Link>.
              </p>
            ),
          },
        ].map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-app-main">{section.title}</h2>
            {section.content}
          </section>
        ))}
      </main>

      <footer className="w-full border-t border-app py-6 bg-app-surface/50">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-app-subtle">
          <span>© 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
            <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
            <Link href="/contact" className="hover:text-app-cta transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
