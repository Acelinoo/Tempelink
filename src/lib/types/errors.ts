/**
 * Tempelink Error System
 * Standardized error codes, HTTP status mappings, and localized Indonesian user messages.
 */

export type TempelinkErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'UNSUPPORTED_MEDIA'
  | 'PRIVATE_CONTENT'
  | 'AUTH_REQUIRED'
  | 'CONTENT_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TEMPORARY_FAILURE'
  | 'REGION_RESTRICTED'
  | 'RESOLUTION_FAILED'
  | 'DOWNLOAD_UNAVAILABLE'
  | 'SSRF_BLOCKED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'MEDIA_URL_EXPIRED'
  | 'BATCH_TOO_LARGE'
  | 'BATCH_NOT_FOUND'
  | 'BATCH_CANCELLED'
  | 'BATCH_LIMIT_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'URI_TOO_LONG'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'BOT_CHALLENGE_FAILED'
  | 'INTERNAL_ERROR';

export interface ErrorDefinition {
  httpStatus: number;
  userMessage: string;
}

export const ERROR_DEFINITIONS: Record<TempelinkErrorCode, ErrorDefinition> = {
  INVALID_URL: {
    httpStatus: 400,
    userMessage: 'Link tidak valid. Pastikan format URL sudah benar.',
  },
  UNSUPPORTED_PLATFORM: {
    httpStatus: 422,
    userMessage: 'Platform ini belum didukung oleh Tempelink.',
  },
  UNSUPPORTED_MEDIA: {
    httpStatus: 422,
    userMessage: 'Tipe media pada link ini belum didukung atau tidak dapat diunduh.',
  },
  PRIVATE_CONTENT: {
    httpStatus: 403,
    userMessage: 'Media bersifat privat atau memerlukan izin akun untuk mengakses.',
  },
  AUTH_REQUIRED: {
    httpStatus: 401,
    userMessage: 'Media memerlukan login pada platform asal dan tidak dapat diakses publik.',
  },
  CONTENT_UNAVAILABLE: {
    httpStatus: 404,
    userMessage: 'Media tidak ditemukan, telah dihapus, atau sedang tidak tersedia.',
  },
  PROVIDER_UNAVAILABLE: {
    httpStatus: 503,
    userMessage: 'Layanan platform sedang mengalami gangguan. Silakan coba lagi nanti.',
  },
  RATE_LIMITED: {
    httpStatus: 429,
    userMessage: 'Permintaan terlalu banyak. Silakan tunggu beberapa saat.',
  },
  TEMPORARY_FAILURE: {
    httpStatus: 502,
    userMessage: 'Gagal memproses media untuk sementara waktu. Silakan coba lagi.',
  },
  REGION_RESTRICTED: {
    httpStatus: 403,
    userMessage: 'Media dibatasi secara geografis dan tidak tersedia di wilayah ini.',
  },
  RESOLUTION_FAILED: {
    httpStatus: 500,
    userMessage: 'Gagal mengekstrak opsi download dari platform ini.',
  },
  DOWNLOAD_UNAVAILABLE: {
    httpStatus: 404,
    userMessage: 'Opsi unduhan yang dipilih saat ini tidak tersedia.',
  },
  SSRF_BLOCKED: {
    httpStatus: 403,
    userMessage: 'Akses ke alamat link ini diblokir demi alasan keamanan sistem.',
  },
  PROVIDER_NOT_CONFIGURED: {
    httpStatus: 503,
    userMessage: 'Layanan platform ini belum dikonfigurasi dengan API token yang valid.',
  },
  MEDIA_URL_EXPIRED: {
    httpStatus: 410,
    userMessage: 'Tautan unduhan media telah kedaluwarsa. Silakan periksa ulang tautan.',
  },
  BATCH_TOO_LARGE: {
    httpStatus: 400,
    userMessage: 'Jumlah URL melebihi batas maksimal batch (maksimal 10 tautan).',
  },
  BATCH_NOT_FOUND: {
    httpStatus: 404,
    userMessage: 'Antrean batch tidak ditemukan atau telah kedaluwarsa.',
  },
  BATCH_CANCELLED: {
    httpStatus: 400,
    userMessage: 'Antrean batch ini telah dibatalkan.',
  },
  BATCH_LIMIT_EXCEEDED: {
    httpStatus: 429,
    userMessage: 'Batas antrean batch aktif per perangkat tercapai. Harap tunggu batch selesai.',
  },
  PAYLOAD_TOO_LARGE: {
    httpStatus: 413,
    userMessage: 'Ukuran payload permintaan melebihi batas maksimal yang diizinkan (maksimal 64 KB).',
  },
  URI_TOO_LONG: {
    httpStatus: 414,
    userMessage: 'Panjang alamat URL melebihi batas maksimal (maksimal 2048 karakter).',
  },
  CIRCUIT_BREAKER_OPEN: {
    httpStatus: 503,
    userMessage: 'Layanan penyedia sedang dalam masa pemulihan akibat kegagalan berulang. Silakan coba kembali dalam beberapa saat.',
  },
  BOT_CHALLENGE_FAILED: {
    httpStatus: 403,
    userMessage: 'Verifikasi keamanan bot gagal atau tidak valid. Silakan selesaikan tantangan keamanan.',
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    userMessage: 'Terjadi kesalahan pada sistem. Tim kami sedang menanganinya.',
  },
};

export class TempelinkError extends Error {
  public readonly code: TempelinkErrorCode;
  public readonly userMessage: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown> | null;

  constructor(
    code: TempelinkErrorCode,
    customMessage?: string,
    details?: Record<string, unknown> | null
  ) {
    const def = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.INTERNAL_ERROR;
    super(customMessage || def.userMessage);
    this.name = 'TempelinkError';
    this.code = code;
    this.userMessage = customMessage || def.userMessage;
    this.httpStatus = def.httpStatus;
    this.details = details || null;
  }

  public toJSON(correlationId?: string) {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        correlationId: correlationId || null,
        details: this.details,
      },
    };
  }
}
