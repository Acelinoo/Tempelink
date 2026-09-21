import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/seo/platform-seo-data';

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: 'Ketentuan Layanan — Tempelink',
  description:
    'Ketentuan layanan Tempelink mengatur penggunaan yang diizinkan, larangan, batasan tanggung jawab, dan kebijakan platform.',
  alternates: { canonical: `${baseUrl}/terms` },
  openGraph: {
    title: 'Ketentuan Layanan — Tempelink',
    description: 'Ketentuan layanan Tempelink: penggunaan yang diizinkan, larangan, dan batasan tanggung jawab.',
    url: `${baseUrl}/terms`,
    siteName: 'Tempelink',
    locale: 'id_ID',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '21 September 2026';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main">
      <header className="w-full border-b border-app bg-app-surface/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <Image src="/logo.png" alt="Tempelink" width={28} height={28} className="rounded-lg" />
            <span className="font-extrabold tracking-tight text-base text-app-main">Tempelink</span>
          </Link>
          <nav className="flex items-center space-x-4 text-xs text-app-muted">
            <Link href="/" className="hover:text-app-main transition-colors">Beranda</Link>
            <Link href="/privacy" className="hover:text-app-main transition-colors">Privasi</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-app-main tracking-tight">
            Ketentuan Layanan
          </h1>
          <p className="text-xs text-app-subtle">
            Terakhir diperbarui: {LAST_UPDATED}
          </p>
        </div>

        <p className="text-sm text-app-muted leading-relaxed">
          Dengan mengakses atau menggunakan layanan Tempelink, Anda menyatakan telah membaca,
          memahami, dan menyetujui Ketentuan Layanan ini. Jika Anda tidak setuju dengan ketentuan
          ini, harap tidak menggunakan layanan kami.
        </p>

        {[
          {
            title: '1. Deskripsi Layanan',
            body: 'Tempelink adalah utilitas pengunduh media berbasis web yang membantu pengguna mengunduh konten publik dari platform media sosial yang didukung. Layanan ini disediakan "sebagaimana adanya" tanpa jaminan ketersediaan yang tidak terputus.',
          },
          {
            title: '2. Penggunaan yang Diizinkan',
            body: 'Anda diizinkan menggunakan Tempelink untuk keperluan pribadi dan non-komersial dalam mengunduh konten publik yang Anda miliki hak untuk mengaksesnya, atau konten yang secara eksplisit diizinkan untuk diunduh oleh pemilik hak ciptanya.',
          },
          {
            title: '3. Penggunaan yang Dilarang',
            body: null,
            list: [
              'Mengunduh konten yang dilindungi hak cipta tanpa izin dari pemilik hak.',
              'Menggunakan layanan ini untuk mendistribusikan ulang konten hasil unduhan secara komersial tanpa izin.',
              'Mencoba mengakses, mengunduh, atau mendistribusikan konten dari akun privat tanpa otorisasi.',
              'Melakukan scraping atau penggunaan otomatis dalam skala besar yang membebani infrastruktur layanan.',
              'Menggunakan layanan untuk tujuan yang melanggar hukum yang berlaku.',
              'Memodifikasi, mendistribusikan ulang, atau menjual akses ke layanan Tempelink.',
            ],
          },
          {
            title: '4. Hak Kekayaan Intelektual',
            body: 'Tempelink hanya memfasilitasi akses ke konten yang sudah tersedia secara publik. Seluruh konten yang diunduh melalui Tempelink tetap menjadi milik pencipta asli dan/atau platform yang bersangkutan. Tempelink tidak mengklaim kepemilikan atas konten tersebut. Pengguna bertanggung jawab penuh atas penggunaan konten yang mereka unduh.',
          },
          {
            title: '5. Disclaimer Platform Pihak Ketiga',
            body: 'Tempelink adalah layanan independen dan tidak berafiliasi, tidak disponsori, atau didukung oleh TikTok, Instagram, YouTube, X Corp, Meta (Facebook), Pinterest, atau platform lainnya. Nama merek dan logo platform tersebut adalah milik masing-masing pemiliknya.',
          },
          {
            title: '6. Batasan Tanggung Jawab',
            body: 'Tempelink tidak bertanggung jawab atas: (a) konten yang diunduh pengguna melalui layanan; (b) pelanggaran hak cipta yang dilakukan pengguna; (c) kerusakan atau kerugian yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan; (d) perubahan atau penghentian layanan sewaktu-waktu. Layanan disediakan tanpa garansi apapun, baik tersurat maupun tersirat.',
          },
          {
            title: '7. Ketersediaan Layanan',
            body: 'Kami tidak menjamin bahwa layanan akan selalu tersedia tanpa gangguan. Kami berhak memodifikasi, menangguhkan, atau menghentikan layanan kapan saja dengan atau tanpa pemberitahuan sebelumnya.',
          },
          {
            title: '8. Batasan Usia',
            body: 'Layanan ini ditujukan untuk pengguna berusia 13 tahun ke atas. Dengan menggunakan Tempelink, Anda menyatakan bahwa Anda memenuhi persyaratan usia minimum tersebut.',
          },
          {
            title: '9. Perubahan Ketentuan',
            body: 'Kami dapat memperbarui Ketentuan Layanan ini dari waktu ke waktu. Perubahan signifikan akan ditandai dengan pembaruan tanggal di bagian atas halaman ini. Penggunaan Tempelink setelah perubahan berlaku berarti Anda menyetujui ketentuan yang diperbarui.',
          },
          {
            title: '10. Penghentian Akses',
            body: 'Kami berhak membatasi atau menghentikan akses Anda ke layanan jika kami memiliki alasan yang wajar untuk meyakini bahwa Anda telah melanggar Ketentuan Layanan ini.',
          },
          {
            title: '11. Kontak',
            body: null,
            jsx: (
              <p className="text-sm text-app-muted leading-relaxed">
                Untuk pertanyaan atau laporan terkait Ketentuan Layanan ini, silakan hubungi kami
                melalui{' '}
                <Link href="/contact" className="text-app-cta hover:underline">
                  halaman Kontak
                </Link>
                .
              </p>
            ),
          },
        ].map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-app-main">{section.title}</h2>
            {section.body && (
              <p className="text-sm text-app-muted leading-relaxed">{section.body}</p>
            )}
            {section.list && (
              <ul className="list-disc list-inside space-y-1 text-sm text-app-muted pl-2">
                {section.list.map((item, i) => (
                  <li key={i} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            )}
            {section.jsx && section.jsx}
          </section>
        ))}
      </main>

      <footer className="w-full border-t border-app py-6 bg-app-surface/50">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-app-subtle">
          <span>© 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
            <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
            <Link href="/contact" className="hover:text-app-cta transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
