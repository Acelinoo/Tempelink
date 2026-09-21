export type Language = 'id' | 'en';

export interface Translations {
  // Navigation
  brandSubtitle: string;
  adFreeBadge: string;
  historyButton: string;
  historyCountLabel: string;
  themeToggleDark: string;
  themeToggleLight: string;
  languageSelect: string;

  // Hero Section
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;

  // Tabs
  tabSingle: string;
  tabBatch: string;

  // Single Input Form
  inputPlaceholder: string;
  btnPaste: string;
  btnInspect: string;
  btnInspecting: string;
  btnClear: string;
  clipboardDetected: string;
  clipboardUse: string;
  clipboardDismiss: string;
  clipboardEmpty: string;
  clipboardPermissionDenied: string;
  clipboardAlreadyFilled: string;
  clipboardReadFailed: string;

  // Media Preview
  creatorAnonymous: string;
  openOriginalSource: string;
  noThumbnail: string;

  // Capability Selector
  downloadOptionsTitle: string;
  verifiedDirectSource: string;
  noDownloadOptions: string;
  btnDownload: string;
  btnDownloadHD: string;
  btnDownloading: string;
  btnDownloaded: string;
  btnRetry: string;
  photoLabel: string;
  videoLabel: string;
  audioLabel: string;

  // Value Proposition
  pillarHonestyTitle: string;
  pillarHonestyDesc: string;
  pillarSafetyTitle: string;
  pillarSafetyDesc: string;
  pillarPrivacyTitle: string;
  pillarPrivacyDesc: string;

  // Platform Directory
  platformDirectoryTitle: string;
  supportedPlatforms: string;

  // Batch Form & Queue
  batchInputPlaceholder: string;
  batchInputSummary: string;
  batchValidCount: string;
  batchDuplicateCount: string;
  batchOverLimit: string;
  btnStartBatch: string;
  btnStartingBatch: string;
  batchProgress: string;
  batchCompleted: string;
  btnCancelBatch: string;
  btnRetryFailed: string;
  btnDownloadAll: string;
  batchEmptyNotice: string;
  batchStatusPending: string;
  batchStatusProcessing: string;
  batchStatusCompleted: string;
  batchStatusFailed: string;

  // History Modal
  historyModalTitle: string;
  historyModalSubtitle: string;
  historyEmpty: string;
  btnClearHistory: string;
  btnClose: string;
  historyItemDate: string;

  // Errors & Alerts
  errorDefault: string;
  networkError: string;
  downloadFailed: string;
  batchCreateFailed: string;

  // Footer
  footerCopyright: string;
  footerTagline: string;
}

export const translations: Record<Language, Translations> = {
  id: {
    // Navigation
    brandSubtitle: 'Platform Utilitas Media Universal',
    adFreeBadge: 'Bebas Iklan & Pengalihan',
    historyButton: 'Riwayat Unduhan',
    historyCountLabel: 'berkas tersimpan',
    themeToggleDark: 'Beralih ke Mode Gelap',
    themeToggleLight: 'Beralih ke Mode Terang',
    languageSelect: 'Pilihan Bahasa',

    // Hero Section
    heroBadge: 'Deteksi Otomatis & Resolusi Asli',
    heroTitle: 'Platform Utilitas Media Universal',
    heroDescription:
      'Tempel tautan video, audio, atau gambar publik untuk memeriksa kapabilitas dan mengunduh berkas dengan kualitas asli langsung ke perangkat Anda.',

    // Tabs
    tabSingle: 'Tautan Tunggal',
    tabBatch: 'Antrean Batch (Maks. 10)',

    // Single Input Form
    inputPlaceholder:
      'Tempel tautan TikTok, Instagram, YouTube, X, Facebook, atau Pinterest...',
    btnPaste: 'Tempel',
    btnInspect: 'Unduh',
    btnInspecting: 'Memeriksa...',
    btnClear: 'Hapus Tautan',
    clipboardDetected: 'Tautan dari papan klip terdeteksi:',
    clipboardUse: 'Gunakan Tautan',
    clipboardDismiss: 'Abaikan',
    clipboardEmpty: 'Papan klip kosong.',
    clipboardPermissionDenied: 'Izin papan klip tidak tersedia pada peramban ini.',
    clipboardAlreadyFilled: 'Tautan sudah terisi di formulir.',
    clipboardReadFailed: 'Gagal membaca papan klip. Silakan gunakan Ctrl+V.',

    // Media Preview
    creatorAnonymous: 'Kreator Anonim',
    openOriginalSource: 'Buka Sumber Asli',
    noThumbnail: 'Gambar Mini Tidak Tersedia',

    // Capability Selector
    downloadOptionsTitle: 'Pilihan Unduhan Tersedia',
    verifiedDirectSource: 'Terverifikasi Langsung dari Sumber',
    noDownloadOptions: 'Tidak ada opsi unduhan yang dapat diekstrak untuk media ini.',
    btnDownload: 'Unduh Berkas',
    btnDownloadHD: 'Unduh HD',
    btnDownloading: 'Mengunduh Berkas...',
    btnDownloaded: 'Berhasil Diunduh',
    btnRetry: 'Coba Lagi',
    photoLabel: 'Foto',
    videoLabel: 'Video',
    audioLabel: 'Audio',

    // Value Proposition
    pillarHonestyTitle: 'Kejujuran Resolusi',
    pillarHonestyDesc:
      'Kami menyajikan resolusi asli tanpa rekayasa resolusi tinggi semu (upscaling palsu). Seluruh opsi berasal langsung dari penyedia media.',
    pillarSafetyTitle: 'Bebas Iklan & Jebakan',
    pillarSafetyDesc:
      'Tanpa tautan pengalihan, tanpa iklan pop-up, dan tanpa berkas mencurigakan. Seluruh pengunduhan dilakukan secara langsung dan transparan.',
    pillarPrivacyTitle: 'Privasi Pengguna Terjamin',
    pillarPrivacyDesc:
      'Dapat digunakan langsung tanpa pendaftaran akun. Riwayat aktivitas hanya disimpan secara lokal di peramban perangkat Anda.',

    // Platform Directory
    platformDirectoryTitle: 'Pengunduh Berdasarkan Platform',
    supportedPlatforms: 'Platform yang Didukung',

    // Batch Form & Queue
    batchInputPlaceholder:
      'Tempel satu tautan per baris (maksimal 10 tautan):\nhttps://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/...\nhttps://pin.it/...',
    batchInputSummary: 'Ringkasan Tautan Batch',
    batchValidCount: 'Tautan Terverifikasi',
    batchDuplicateCount: 'Tautan Duplikat',
    batchOverLimit: 'Jumlah tautan melebihi batas maksimal (10 tautan).',
    btnStartBatch: 'Mulai Pemrosesan Batch',
    btnStartingBatch: 'Mendaftarkan Antrean...',
    batchProgress: 'Kemajuan Antrean',
    batchCompleted: 'Pemrosesan Selesai',
    btnCancelBatch: 'Batalkan Antrean',
    btnRetryFailed: 'Coba Ulang yang Gagal',
    btnDownloadAll: 'Unduh Semua Berkas',
    batchEmptyNotice: 'Belum ada antrean batch yang aktif.',
    batchStatusPending: 'Menunggu',
    batchStatusProcessing: 'Sedang Diproses',
    batchStatusCompleted: 'Selesai',
    batchStatusFailed: 'Gagal',

    // History Modal
    historyModalTitle: 'Riwayat Unduhan Tersimpan',
    historyModalSubtitle:
      'Riwayat ini disimpan secara lokal di peramban Anda dan tidak pernah dikirim ke server.',
    historyEmpty: 'Belum ada riwayat unduhan yang tersimpan.',
    btnClearHistory: 'Hapus Seluruh Riwayat',
    btnClose: 'Tutup',
    historyItemDate: 'Waktu Pengunduhan',

    // Errors & Alerts
    errorDefault: 'Terjadi kesalahan saat memproses permintaan Anda.',
    networkError:
      'Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke internet.',
    downloadFailed: 'Gagal mengunduh berkas media langsung ke perangkat.',
    batchCreateFailed: 'Gagal mendaftarkan antrean batch baru.',

    // Footer
    footerCopyright: '© 2026 Tempelink. Hak cipta dilindungi undang-undang.',
    footerTagline: 'Utilitas Pengunduh Media Universal • Bersih, Cepat, dan Aman',
  },
  en: {
    // Navigation
    brandSubtitle: 'Universal Media Utility Platform',
    adFreeBadge: 'Ad-Free & Direct Delivery',
    historyButton: 'Download History',
    historyCountLabel: 'items saved',
    themeToggleDark: 'Switch to Dark Mode',
    themeToggleLight: 'Switch to Light Mode',
    languageSelect: 'Select Language',

    // Hero Section
    heroBadge: 'Automatic Detection & Native Resolution',
    heroTitle: 'Universal Media Utility Platform',
    heroDescription:
      'Paste any public video, audio, or image link to inspect verified capabilities and download native files directly to your device.',

    // Tabs
    tabSingle: 'Single Link',
    tabBatch: 'Batch Queue (Max 10)',

    // Single Input Form
    inputPlaceholder:
      'Paste a TikTok, Instagram, YouTube, X, Facebook, or Pinterest link...',
    btnPaste: 'Paste',
    btnInspect: 'Download',
    btnInspecting: 'Inspecting...',
    btnClear: 'Clear Link',
    clipboardDetected: 'Link detected from clipboard:',
    clipboardUse: 'Use Link',
    clipboardDismiss: 'Dismiss',
    clipboardEmpty: 'Clipboard is empty.',
    clipboardPermissionDenied: 'Clipboard access is not permitted in this browser.',
    clipboardAlreadyFilled: 'The link is already entered in the form.',
    clipboardReadFailed: 'Failed to read clipboard. Please paste manually using Ctrl+V.',

    // Media Preview
    creatorAnonymous: 'Anonymous Creator',
    openOriginalSource: 'Open Original Source',
    noThumbnail: 'No Thumbnail Available',

    // Capability Selector
    downloadOptionsTitle: 'Available Download Options',
    verifiedDirectSource: 'Directly Verified from Source',
    noDownloadOptions: 'No downloadable options could be extracted for this media.',
    btnDownload: 'Download File',
    btnDownloadHD: 'Download HD',
    btnDownloading: 'Downloading File...',
    btnDownloaded: 'Downloaded',
    btnRetry: 'Retry',
    photoLabel: 'Photo',
    videoLabel: 'Video',
    audioLabel: 'Audio',

    // Value Proposition
    pillarHonestyTitle: 'Resolution Authenticity',
    pillarHonestyDesc:
      'We deliver verified source resolutions without artificial upscaling or deceptive labels. All streams originate directly from source providers.',
    pillarSafetyTitle: 'Ad-Free & Direct Delivery',
    pillarSafetyDesc:
      'No redirect loops, intrusive advertisements, or malicious wrappers. Media downloads are delivered directly and securely.',
    pillarPrivacyTitle: 'User Privacy Guaranteed',
    pillarPrivacyDesc:
      'Use the utility without registration. Your download history is stored locally in your browser and never transmitted to our servers.',

    // Platform Directory
    platformDirectoryTitle: 'Downloaders by Platform',
    supportedPlatforms: 'Supported Platforms',

    // Batch Form & Queue
    batchInputPlaceholder:
      'Enter one link per line (maximum 10 links):\nhttps://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/...\nhttps://pin.it/...',
    batchInputSummary: 'Batch Links Summary',
    batchValidCount: 'Verified Links',
    batchDuplicateCount: 'Duplicate Links',
    batchOverLimit: 'Link count exceeds maximum limit (10 links).',
    btnStartBatch: 'Start Batch Processing',
    btnStartingBatch: 'Registering Queue...',
    batchProgress: 'Queue Progress',
    batchCompleted: 'Processing Complete',
    btnCancelBatch: 'Cancel Queue',
    btnRetryFailed: 'Retry Failed Items',
    btnDownloadAll: 'Download All Files',
    batchEmptyNotice: 'No active batch queue currently in progress.',
    batchStatusPending: 'Pending',
    batchStatusProcessing: 'Processing',
    batchStatusCompleted: 'Completed',
    batchStatusFailed: 'Failed',

    // History Modal
    historyModalTitle: 'Saved Download History',
    historyModalSubtitle:
      'This history is stored locally on your device and is never uploaded to any remote server.',
    historyEmpty: 'No download history recorded yet.',
    btnClearHistory: 'Clear Entire History',
    btnClose: 'Close',
    historyItemDate: 'Download Timestamp',

    // Errors & Alerts
    errorDefault: 'An error occurred while processing your request.',
    networkError:
      'Network connection interrupted. Please ensure your device is connected to the internet.',
    downloadFailed: 'Failed to download the media file directly to your device.',
    batchCreateFailed: 'Failed to initialize the batch processing queue.',

    // Footer
    footerCopyright: '© 2026 Tempelink. All rights reserved.',
    footerTagline: 'Universal Media Utility • Clean, Fast, and Secure',
  },
};
