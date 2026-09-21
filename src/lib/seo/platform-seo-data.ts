/**
 * Centralized Platform SEO Configuration & Data Model
 * Provides honest, platform-specific content, capability matrices,
 * URL patterns, limitations, and FAQs for search discoverability.
 */

export interface SupportedFormat {
  type: 'video' | 'audio' | 'image' | 'carousel';
  label: string;
  quality: string;
  description: string;
}

export interface HowToStep {
  step: number;
  title: string;
  description: string;
}

export interface PlatformFaq {
  question: string;
  answer: string;
}

export interface PlatformSeoConfig {
  slug: string;
  platformId: string;
  name: string;
  badge: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  h2Sub: string;
  aboutText: string;
  supportedFormats: SupportedFormat[];
  supportedUrlExamples: string[];
  howToSteps: HowToStep[];
  limitations: string[];
  faqs: PlatformFaq[];
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export const PLATFORM_SEO_REGISTRY: Record<string, PlatformSeoConfig> = {
  'tiktok-downloader': {
    slug: 'tiktok-downloader',
    platformId: 'tiktok',
    name: 'TikTok',
    badge: 'Tanpa Watermark & Audio Asli',
    title: 'TikTok Downloader — Unduh Video TikTok Tanpa Watermark | Tempelink',
    description:
      'Unduh video TikTok tanpa watermark, audio MP3 asli, dan foto carousel dengan resolusi terverifikasi. Cepat, aman, dan tanpa iklan jebakan.',
    keywords: [
      'tiktok downloader',
      'download video tiktok tanpa watermark',
      'unduh audio tiktok mp3',
      'tiktok photo slide downloader',
      'tiktok hd downloader',
    ],
    h1: 'Download Video TikTok Tanpa Watermark',
    h2Sub:
      'Simpan video TikTok tanpa watermark, musik sound MP3, atau foto slide langsung dari tautan publik.',
    aboutText:
      'Tempelink menyediakan utilitas pengunduhan video TikTok yang bersih dan terverifikasi. Kami secara otomatis mendeteksi apakah video memiliki opsi tanpa watermark, file audio musik asli, atau mode foto carousel slide, lalu menyajikannya secara transparan tanpa upscaling palsu.',
    supportedFormats: [
      {
        type: 'video',
        label: 'Video MP4 (Tanpa Watermark)',
        quality: 'Standard 720p / HD Asli',
        description: 'Aliran video murni tanpa overlay logo TikTok dari pembuat konten.',
      },
      {
        type: 'video',
        label: 'Video MP4 (Watermark Asli)',
        quality: 'Standard',
        description: 'Tersedia jika Anda membutuhkan kredit visual asli dari kreator.',
      },
      {
        type: 'audio',
        label: 'Audio Musik Asli (MP3/M4A)',
        quality: 'Audio 128 kbps',
        description: 'Ekstraksi sound atau lagu latar dari konten video TikTok.',
      },
      {
        type: 'carousel',
        label: 'Foto Slide Carousel (JPG)',
        quality: 'Resolusi Penuh',
        description: 'Daftar gambar individual untuk konten TikTok Photo Mode.',
      },
    ],
    supportedUrlExamples: [
      'https://www.tiktok.com/@username/video/7123456789012345678',
      'https://vt.tiktok.com/ZSxxxxxxx/',
      'https://vm.tiktok.com/ZMxxxxxxx/',
      'https://www.tiktok.com/@username/photo/7123456789012345678',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan TikTok',
        description: 'Buka aplikasi atau web TikTok, pilih Bagikan (Share), lalu salin tautan video.',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Masukkan tautan ke formulir pencarian Tempelink di halaman pengunduh.',
      },
      {
        step: 3,
        title: 'Pilih Format & Unduh',
        description: 'Pilih opsi Tanpa Watermark atau Audio MP3, lalu klik Unduh untuk menyimpan file.',
      },
    ],
    limitations: [
      'Hanya mendukung akun dan konten publik (video akun privat tidak dapat diakses).',
      'Ketersediaan opsi 1080p bergantung sepenuhnya pada file sumber yang diunggah kreator ke TikTok.',
      'Video yang telah dihapus atau dibatasi secara geografis tidak dapat diproses.',
    ],
    faqs: [
      {
        question: 'Apakah pengunduh TikTok di Tempelink gratis dan tanpa watermark?',
        answer:
          'Ya, Tempelink sepenuhnya gratis dan memprioritaskan penyediaan opsi video tanpa watermark secara langsung.',
      },
      {
        question: 'Apakah Tempelink menyimpan video atau data riwayat saya di server?',
        answer:
          'Tidak. Tempelink tidak menyimpan file video di server. Riwayat unduhan hanya disimpan secara lokal di browser Anda (localStorage) untuk kenyamanan pribadi.',
      },
      {
        question: 'Mengapa sebagian video tidak memiliki opsi 1080p?',
        answer:
          'Tempelink menerapkan prinsip kejujuran resolusi. Jika server TikTok hanya menyediakan resolusi 720p untuk video tersebut, kami tidak akan memalsukan label menjadi 1080p.',
      },
    ],
  },

  'instagram-downloader': {
    slug: 'instagram-downloader',
    platformId: 'instagram',
    name: 'Instagram',
    badge: 'Reels, Video & Foto Publik',
    title: 'Instagram Downloader — Unduh Reels, Video & Foto | Tempelink',
    description:
      'Unduh Instagram Reels, video postingan, dan foto carousel berkualitas tinggi. Cepat, aman, tanpa registrasi, dan tanpa iklan jebakan.',
    keywords: [
      'instagram downloader',
      'download reels instagram',
      'unduh video ig mp4',
      'instagram carousel downloader',
      'download foto instagram',
    ],
    h1: 'Download Instagram Reels, Video & Foto',
    h2Sub:
      'Simpan video Reels, postingan IG feed, dan foto carousel langsung dalam format MP4 dan JPG asli.',
    aboutText:
      'Tempelink Instagram Downloader memudahkan Anda menyimpan konten publik dari Instagram baik berupa Reels, video feed, maupun album carousel foto. Setiap media disajikan dengan format asli tanpa kompresi tambahan.',
    supportedFormats: [
      {
        type: 'video',
        label: 'Video Reels & Feed (MP4)',
        quality: 'Kualitas Asli Instagram',
        description: 'Video resolusi penuh dengan audio tersinkronisasi.',
      },
      {
        type: 'image',
        label: 'Foto Feed & Carousel (JPG)',
        quality: 'Resolusi Tinggi',
        description: 'Unduhan gambar beresolusi tajam sesuai aset asli server Instagram.',
      },
    ],
    supportedUrlExamples: [
      'https://www.instagram.com/reel/C3b4X9vL123/',
      'https://www.instagram.com/p/C3b4X9vL123/',
      'https://www.instagram.com/tv/C3b4X9vL123/',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan Instagram',
        description: 'Klik titik tiga pada postingan atau Reel Instagram, lalu pilih Salin Tautan (Copy Link).',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Tempel URL ke dalam input formulir pengunduh Tempelink.',
      },
      {
        step: 3,
        title: 'Unduh Media',
        description: 'Periksa preview judul serta thumbnail, lalu tekan tombol Unduh untuk menyimpan MP4 atau JPG.',
      },
    ],
    limitations: [
      'Hanya mendukung akun publik. Postingan dari akun privat (gembok) tidak didukung untuk menghormati privasi pengguna.',
      'Tautan Instagram Story kadaluwarsa setelah 24 jam dan mungkin tidak dapat diakses jika sudah hilang dari server.',
    ],
    faqs: [
      {
        question: 'Apakah saya perlu login akun Instagram untuk mengunduh?',
        answer:
          'Sama sekali tidak. Tempelink tidak pernah meminta kata sandi atau otentikasi akun Instagram Anda.',
      },
      {
        question: 'Apakah bisa mengunduh postingan carousel berisi banyak foto?',
        answer:
          'Ya, Tempelink mendeteksi seluruh item media dalam album carousel dan menyediakan tautan unduh untuk masing-masing item.',
      },
    ],
  },

  'youtube-downloader': {
    slug: 'youtube-downloader',
    platformId: 'youtube',
    name: 'YouTube',
    badge: 'Shorts, Video MP4 & Audio M4A',
    title: 'YouTube Downloader — Unduh Video & Shorts YouTube | Tempelink',
    description:
      'Unduh YouTube Shorts dan video publik dalam format MP4 serta ekstraksi audio M4A asli. Bebas iklan popup dan malware.',
    keywords: [
      'youtube downloader',
      'download youtube shorts',
      'unduh video youtube mp4',
      'youtube audio extractor',
      'youtube shorts downloader',
    ],
    h1: 'Download YouTube Shorts & Video Publik',
    h2Sub:
      'Unduh video YouTube biasa, video Shorts pendek, dan audio murni secara cepat dan jujur.',
    aboutText:
      'Tempelink mendukung pengunduhan YouTube Shorts dan video publik dengan daftar resolusi bertingkat (360p, 720p, 1080p, dan opsi audio M4A). Kami menyajikan informasi bitrate dan resolusi aktual yang benar-benar disediakan.',
    supportedFormats: [
      {
        type: 'video',
        label: 'Video YouTube & Shorts (MP4)',
        quality: '360p, 720p, 1080p+',
        description: 'Video MP4 dengan audio lengkap sesuai ketersediaan pada video sumber.',
      },
      {
        type: 'audio',
        label: 'Audio Asli (M4A)',
        quality: 'Audio Bitrate Asli',
        description: 'Ekstraksi trek audio murni untuk musik, podcast, atau rekaman suara.',
      },
    ],
    supportedUrlExamples: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/abcdefghijk',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan Video/Shorts',
        description: 'Salin URL video YouTube dari address bar atau tombol Share.',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Masukkan tautan ke Tempelink untuk memeriksa daftar resolusi yang tersedia.',
      },
      {
        step: 3,
        title: 'Pilih Resolusi & Unduh',
        description: 'Pilih antara MP4 Standard, HD, atau Audio M4A, lalu klik Unduh.',
      },
    ],
    limitations: [
      'Hanya video publik yang dapat diunduh. Video privat, berbayar (Pay-per-view), atau dibatasi usia tidak didukung.',
      'Kami tidak mendukung pembobolan DRM atau streaming berbayar.',
    ],
    faqs: [
      {
        question: 'Apakah Tempelink bisa mengunduh YouTube Shorts?',
        answer:
          'Ya, tautan YouTube Shorts (youtube.com/shorts/...) didukung penuh dengan resolusi vertikal asli.',
      },
      {
        question: 'Mengapa ada opsi audio M4A dan bukan MP3?',
        answer:
          'Format audio asli yang disajikan YouTube adalah M4A (AAC). Kami menyajikannya secara murni tanpa konversi lossy yang dapat menurunkan kualitas audio.',
      },
    ],
  },

  'twitter-downloader': {
    slug: 'twitter-downloader',
    platformId: 'x',
    name: 'X (Twitter)',
    badge: 'Video MP4 & Klip Publik',
    title: 'X / Twitter Video Downloader — Unduh Video X | Tempelink',
    description:
      'Unduh video dan klip dari X (Twitter) langsung dalam format MP4 berkualitas jernih. Cepat, aman, dan tanpa iklan mengganggu.',
    keywords: [
      'twitter video downloader',
      'x video downloader',
      'download video twitter mp4',
      'unduh video tweet',
    ],
    h1: 'Download Video X (Twitter) Publik',
    h2Sub:
      'Simpan video dan klip dari postingan X/Twitter secara instan dalam format MP4.',
    aboutText:
      'Tempelink X (Twitter) Downloader memproses tautan tweet publik yang memuat media video, mengekstrak aliran MP4 berkualitas optimal, dan menyediakannya dengan tautan unduh berkecepatan tinggi.',
    supportedFormats: [
      {
        type: 'video',
        label: 'Video MP4 (Standard / HD)',
        quality: 'Resolusi Optimal Tweet',
        description: 'File video MP4 terverifikasi yang siap diputar di perangkat apa pun.',
      },
    ],
    supportedUrlExamples: [
      'https://x.com/username/status/1234567890123456789',
      'https://twitter.com/username/status/1234567890123456789',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan Postingan X',
        description: 'Buka postingan tweet yang memuat video, klik tombol Bagikan, lalu salin tautan.',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Tempel URL ke dalam formulir Tempelink untuk mendeteksi video.',
      },
      {
        step: 3,
        title: 'Unduh Video MP4',
        description: 'Klik tombol Unduh untuk menyimpan file video ke galeri atau penyimpanan lokal.',
      },
    ],
    limitations: [
      'Hanya tweet dari akun publik yang dapat diproses. Tweet terlindungi (protected tweets) tidak didukung.',
      'Postingan teks murni tanpa media video atau GIF tidak memiliki opsi unduhan.',
    ],
    faqs: [
      {
        question: 'Apakah tautan domain x.com dan twitter.com sama-sama didukung?',
        answer:
          'Ya, Tempelink secara otomatis mengenali dan menormalisasi baik domain x.com maupun twitter.com secara identik.',
      },
      {
        question: 'Apakah kualitas video Twitter berkurang saat diunduh?',
        answer:
          'Tidak. Tempelink mengunduh langsung aliran video terbaik yang disimpan di CDN resmi X/Twitter.',
      },
    ],
  },

  'facebook-downloader': {
    slug: 'facebook-downloader',
    platformId: 'facebook',
    name: 'Facebook',
    badge: 'Reels, Video HD & SD',
    title: 'Facebook Video Downloader — Unduh Reels & Video FB | Tempelink',
    description:
      'Unduh video Facebook publik dan Facebook Reels dalam kualitas HD atau SD. Bersih, cepat, tanpa registrasi, dan aman.',
    keywords: [
      'facebook downloader',
      'download video facebook hd',
      'unduh facebook reels',
      'download fb video mp4',
    ],
    h1: 'Download Facebook Reels & Video Publik',
    h2Sub:
      'Simpan video Facebook publik dan tayangan Reels dalam pilihan kualitas HD atau Standard SD.',
    aboutText:
      'Tempelink Facebook Downloader mendeteksi resolusi video Facebook dan menyajikan pilihan kualitas HD serta SD yang nyata tanpa manipulasi resolusi.',
    supportedFormats: [
      {
        type: 'video',
        label: 'Video HD (MP4)',
        quality: 'High Definition',
        description: 'Opsi kualitas tinggi jika disediakan oleh video sumber.',
      },
      {
        type: 'video',
        label: 'Video SD (MP4)',
        quality: 'Standard Definition',
        description: 'Ukuran file lebih hemat untuk koneksi terbatas.',
      },
    ],
    supportedUrlExamples: [
      'https://www.facebook.com/reel/1921056328602745',
      'https://www.facebook.com/watch/?v=1234567890',
      'https://fb.watch/abcdefghij/',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan Video Facebook',
        description: 'Klik Bagikan pada video atau Reel Facebook publik, lalu pilih Salin Tautan.',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Tempelkan tautan ke kolom Tempelink untuk mengecek kapabilitas unduhan.',
      },
      {
        step: 3,
        title: 'Pilih HD atau SD',
        description: 'Pilih resolusi yang diinginkan lalu klik Unduh.',
      },
    ],
    limitations: [
      'Hanya video publik yang didukung. Video dari grup privat atau postingan teman terbatas tidak dapat diunduh.',
    ],
    faqs: [
      {
        question: 'Apakah bisa mengunduh video dari Facebook Watch?',
        answer:
          'Ya, tautan fb.watch dan tautan facebook.com/watch didukung sepenuhnya.',
      },
      {
        question: 'Mengapa opsi HD kadang tidak muncul?',
        answer:
          'Jika kreator mengunggah video dengan resolusi standar atau Facebook hanya memproses versi SD, opsi HD tidak akan ditampilkan secara palsu.',
      },
    ],
  },

  'pinterest-downloader': {
    slug: 'pinterest-downloader',
    platformId: 'pinterest',
    name: 'Pinterest',
    badge: 'Pin Foto & Media Visual',
    title: 'Pinterest Media Downloader — Unduh Pin & Gambar | Tempelink',
    description:
      'Informasi utilitas pengunduhan Pin gambar dan media Pinterest publik. Transparan mengenai ketersediaan dan status penyedia.',
    keywords: [
      'pinterest downloader',
      'download pin pinterest',
      'unduh gambar pinterest',
      'pinterest image download',
    ],
    h1: 'Pinterest Media & Pin Utility',
    h2Sub:
      'Periksa dan unduh gambar Pin publik Pinterest dengan resolusi asli yang tersedia.',
    aboutText:
      'Tempelink menyediakan pendeteksian Pin gambar dan media visual Pinterest. Kami mengutamakan transparansi: jika penyedia pihak ketiga mengalami hambatan upstream, sistem kami secara jujur memberitahukan status ketersediaan tanpa kepalsuan.',
    supportedFormats: [
      {
        type: 'image',
        label: 'Gambar Pin (JPG/PNG)',
        quality: 'Resolusi Asli Pin',
        description: 'File gambar visual resolusi penuh yang disematkan pada Pin.',
      },
    ],
    supportedUrlExamples: [
      'https://www.pinterest.com/pin/70437488608239/',
      'https://pin.it/abcdefg',
    ],
    howToSteps: [
      {
        step: 1,
        title: 'Salin Tautan Pin',
        description: 'Buka Pin di Pinterest, klik ikon Bagikan, lalu salin tautan Pin.',
      },
      {
        step: 2,
        title: 'Tempel di Tempelink',
        description: 'Masukkan tautan ke Tempelink untuk memeriksa ketersediaan media.',
      },
      {
        step: 3,
        title: 'Unduh Media',
        description: 'Simpan file gambar yang tersedia langsung ke galeri Anda.',
      },
    ],
    limitations: [
      'Saat ini penyedia pihak ketiga Pinterest mungkin mengalami pembatasan upstream temporer (CONTENT_UNAVAILABLE). Tempelink menampilkan status sebenarnya secara jujur.',
      'Pin rahasia (Secret Boards) tidak dapat diakses demi menjaga privasi pemilik akun.',
    ],
    faqs: [
      {
        question: 'Mengapa sebagian Pin Pinterest menampilkan status tidak tersedia?',
        answer:
          'Penyedia gateway pihak ketiga untuk Pinterest terkadang mengalami perubahan API upstream. Tempelink memilih untuk menginformasikan kendala tersebut secara transparan daripada memberikan unduhan rusak.',
      },
      {
        question: 'Apakah tautan pin.it didukung?',
        answer:
          'Ya, tautan pendek pin.it dikenali dan dideteksi secara otomatis sebagai platform Pinterest.',
      },
    ],
  },
};

export function getAllPlatformSlugs(): string[] {
  return Object.keys(PLATFORM_SEO_REGISTRY);
}

export function getPlatformSeoBySlug(slug: string): PlatformSeoConfig | undefined {
  return PLATFORM_SEO_REGISTRY[slug];
}

export function getPlatformSeoById(platformId: string): PlatformSeoConfig | undefined {
  return Object.values(PLATFORM_SEO_REGISTRY).find((p) => p.platformId === platformId);
}
