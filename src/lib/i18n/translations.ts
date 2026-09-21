export type Language = 'id' | 'en';

export interface Translations {
  // Navigation
  brandSubtitle: string;
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

  // How To Use
  howToTitle: string;
  howToStep1Title: string;
  howToStep1Desc: string;
  howToStep2Title: string;
  howToStep2Desc: string;
  howToStep3Title: string;
  howToStep3Desc: string;

  // Features
  featuresTitle: string;
  featNoWatermark: string;
  featNoWatermarkDesc: string;
  featAllDevices: string;
  featAllDevicesDesc: string;
  featNoLogin: string;
  featNoLoginDesc: string;
  featOrigQuality: string;
  featOrigQualityDesc: string;
  featMultiPlatform: string;
  featMultiPlatformDesc: string;
  featAudioMp3: string;
  featAudioMp3Desc: string;

  // FAQ
  faqTitle: string;
  faqQ1: string; faqA1: string;
  faqQ2: string; faqA2: string;
  faqQ3: string; faqA3: string;
  faqQ4: string; faqA4: string;
  faqQ5: string; faqA5: string;
  faqQ6: string; faqA6: string;
  faqQ7: string; faqA7: string;
  faqQ8: string; faqA8: string;

  // Footer
  footerCopyright: string;
  footerTagline: string;
  footerMadeBy: string;
}

export const translations: Record<Language, Translations> = {
  id: {
    // Navigation
    brandSubtitle: 'Platform Utilitas Media Universal',
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
    pillarSafetyTitle: 'Unduhan Langsung & Transparan',
    pillarSafetyDesc:
      'Tanpa tautan pengalihan tersembunyi dan tanpa berkas mencurigakan. Seluruh pengunduhan dilakukan secara langsung dan dapat dilacak sumbernya.',
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

    // How To Use
    howToTitle: 'Cara Mengunduh Video, Foto, dan Musik MP3',
    howToStep1Title: 'Salin Tautan',
    howToStep1Desc: 'Buka platform pilihan (TikTok, Instagram, YouTube, dll.), temukan konten yang ingin diunduh, lalu salin tautannya.',
    howToStep2Title: 'Tempel Tautan',
    howToStep2Desc: 'Tempel tautan yang telah disalin ke kolom input di bagian atas halaman ini, lalu klik tombol Unduh.',
    howToStep3Title: 'Simpan Berkas',
    howToStep3Desc: 'Pilih format yang diinginkan — video HD, foto, atau audio MP3 — lalu berkas akan langsung tersimpan ke perangkat Anda.',

    // Features
    featuresTitle: 'Fitur Utama Tempelink',
    featNoWatermark: 'Tanpa Watermark',
    featNoWatermarkDesc: 'Unduh video dan foto tanpa watermark atau logo platform yang mengganggu tampilan.',
    featAllDevices: 'Semua Perangkat',
    featAllDevicesDesc: 'Berfungsi di semua perangkat: ponsel, tablet, maupun komputer — tanpa instalasi aplikasi.',
    featNoLogin: 'Tanpa Registrasi',
    featNoLoginDesc: 'Gunakan langsung tanpa perlu mendaftar atau masuk ke akun mana pun.',
    featOrigQuality: 'Kualitas Asli',
    featOrigQualityDesc: 'Unduh konten dengan resolusi dan kualitas asli langsung dari sumbernya, tanpa kompresi ulang.',
    featMultiPlatform: 'Multi-Platform',
    featMultiPlatformDesc: 'Mendukung TikTok, Instagram, YouTube, X/Twitter, Facebook, dan Pinterest dalam satu alat.',
    featAudioMp3: 'Ekstraksi Audio MP3',
    featAudioMp3Desc: 'Ekstrak audio dari video dalam format MP3 untuk didengarkan secara offline kapan saja.',

    // FAQ
    faqTitle: 'Pertanyaan yang Sering Diajukan',
    faqQ1: 'Apakah Tempelink gratis digunakan?',
    faqA1: 'Ya, Tempelink dapat digunakan sepenuhnya tanpa biaya. Tidak ada biaya langganan, biaya per unduhan, maupun biaya tersembunyi.',
    faqQ2: 'Platform apa saja yang didukung?',
    faqA2: 'Tempelink mendukung TikTok, Instagram (Reels, foto, cerita), YouTube, X/Twitter, Facebook, dan Pinterest.',
    faqQ3: 'Apakah perlu mendaftar akun untuk menggunakan Tempelink?',
    faqA3: 'Tidak. Tempelink dapat digunakan langsung tanpa registrasi, login, atau pemberian data pribadi apa pun.',
    faqQ4: 'Apakah hasil unduhan bebas watermark?',
    faqA4: 'Tempelink mengunduh konten langsung dari sumber aslinya. Jika platform tidak menyematkan watermark pada sumber asli, hasil unduhan juga bebas watermark.',
    faqQ5: 'Format apa saja yang tersedia untuk diunduh?',
    faqA5: 'Format yang tersedia tergantung pada platform dan jenis konten: video MP4 (berbagai resolusi), foto JPG/PNG, dan audio MP3.',
    faqQ6: 'Apakah Tempelink aman digunakan?',
    faqA6: 'Ya. Tempelink tidak menyimpan data pribadi Anda, tidak meminta izin perangkat, dan seluruh proses unduhan dilakukan secara langsung dan transparan.',
    faqQ7: 'Mengapa unduhan saya gagal atau tidak tersedia?',
    faqA7: 'Beberapa konten bersifat privat atau dibatasi oleh platform sehingga tidak dapat diunduh. Pastikan konten yang dituju bersifat publik dan tautannya valid.',
    faqQ8: 'Apakah ada batasan jumlah unduhan per hari?',
    faqA8: 'Tidak ada batasan resmi. Namun untuk menjaga kestabilan layanan, penggunaan yang wajar dan tidak berlebihan sangat dianjurkan.',

    // Footer
    footerCopyright: '© 2026 Tempelink. Hak cipta dilindungi undang-undang.',
    footerTagline: 'Utilitas Pengunduh Media Universal • Bersih, Cepat, dan Transparan',
    footerMadeBy: 'Dibuat oleh',
  },
  en: {
    // Navigation
    brandSubtitle: 'Universal Media Utility Platform',
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
    pillarSafetyTitle: 'Direct & Transparent Downloads',
    pillarSafetyDesc:
      'No hidden redirect chains or suspicious file wrappers. All media downloads are delivered directly and with traceable sources.',
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

    // How To Use
    howToTitle: 'How to Download Videos, Photos & MP3 Music',
    howToStep1Title: 'Copy the Link',
    howToStep1Desc: 'Open your platform of choice (TikTok, Instagram, YouTube, etc.), find the content you want, and copy its link.',
    howToStep2Title: 'Paste the Link',
    howToStep2Desc: 'Paste the copied link into the input field at the top of this page, then click the Download button.',
    howToStep3Title: 'Save the File',
    howToStep3Desc: 'Choose your preferred format — HD video, photo, or MP3 audio — and the file will be saved directly to your device.',

    // Features
    featuresTitle: 'Key Features of Tempelink',
    featNoWatermark: 'No Watermark',
    featNoWatermarkDesc: 'Download videos and photos without platform watermarks or logos interfering with the content.',
    featAllDevices: 'All Devices',
    featAllDevicesDesc: 'Works on all devices — smartphones, tablets, and computers — with no app installation required.',
    featNoLogin: 'No Registration',
    featNoLoginDesc: 'Use the tool immediately without signing up for an account or providing any personal information.',
    featOrigQuality: 'Native Quality',
    featOrigQualityDesc: 'Download content at its original resolution and quality directly from the source, without re-compression.',
    featMultiPlatform: 'Multi-Platform',
    featMultiPlatformDesc: 'Supports TikTok, Instagram, YouTube, X/Twitter, Facebook, and Pinterest — all in one tool.',
    featAudioMp3: 'MP3 Audio Extraction',
    featAudioMp3Desc: 'Extract audio from videos in MP3 format for offline listening anytime, anywhere.',

    // FAQ
    faqTitle: 'Frequently Asked Questions',
    faqQ1: 'Is Tempelink free to use?',
    faqA1: 'Yes, Tempelink is completely free. There are no subscription fees, per-download charges, or hidden costs.',
    faqQ2: 'Which platforms are supported?',
    faqA2: 'Tempelink supports TikTok, Instagram (Reels, photos, stories), YouTube, X/Twitter, Facebook, and Pinterest.',
    faqQ3: 'Do I need to create an account?',
    faqA3: 'No. Tempelink works immediately without any registration, login, or submission of personal data.',
    faqQ4: 'Will the downloaded content be watermark-free?',
    faqA4: 'Tempelink downloads content directly from its original source. If the platform does not embed a watermark on the original file, the download will be watermark-free.',
    faqQ5: 'What file formats are available?',
    faqA5: 'Available formats depend on the platform and content type: MP4 video (various resolutions), JPG/PNG photo, and MP3 audio.',
    faqQ6: 'Is Tempelink safe to use?',
    faqA6: 'Yes. Tempelink does not store your personal data, does not request device permissions, and all downloads are processed directly and transparently.',
    faqQ7: 'Why did my download fail or show no options?',
    faqA7: 'Some content is private or restricted by the platform and cannot be downloaded. Ensure the content is public and the link is valid.',
    faqQ8: 'Is there a daily download limit?',
    faqA8: 'There is no official limit. However, reasonable and non-excessive usage is strongly encouraged to maintain service stability for all users.',

    // Footer
    footerCopyright: '© 2026 Tempelink. All rights reserved.',
    footerTagline: 'Universal Media Utility • Clean, Fast, and Transparent',
    footerMadeBy: 'Built by',
  },
};
