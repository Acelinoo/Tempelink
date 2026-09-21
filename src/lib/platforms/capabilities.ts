import { Capability, QualityCategory } from '../types/capability';

/**
 * Capability Engine
 * Honest quality categorization: Standard vs HD.
 * Never upscales or fabricates HD badges when resolution is < 1080p.
 */

/**
 * Categorizes a video resolution into Standard (<1080p) or HD (>=1080p).
 */
export function categorizeVideoQuality(
  height?: number | null,
  width?: number | null,
  resolutionLabel?: string | null
): QualityCategory {
  // If both width and height are available, HD requires min dimension >= 1080
  // (e.g. 1920x1080 landscape or 1080x1920 portrait)
  if (width && height) {
    const minDim = Math.min(width, height);
    if (minDim >= 1080) {
      return 'hd';
    }
    // If minDim is 720 (e.g. 1280x720 or 720x1280), it's strictly standard
    return 'standard';
  }

  // If only height is given (common standard convention)
  if (height) {
    return height >= 1080 ? 'hd' : 'standard';
  }

  // Check string label (e.g. '1080p', '1440p', '2160p', '4K')
  if (resolutionLabel) {
    const clean = resolutionLabel.toLowerCase();
    if (
      clean.includes('1080') ||
      clean.includes('1440') ||
      clean.includes('2160') ||
      clean.includes('4k') ||
      clean.includes('2k') ||
      clean.includes('uhd') ||
      clean.includes('fhd')
    ) {
      return 'hd';
    }
  }

  return 'standard';
}

/**
 * Creates a normalized Video Capability object.
 */
export function createVideoCapability(options: {
  id: string;
  resolution?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string;
  label?: string;
  fileSizeBytes?: number | null;
  bitrateKbps?: number | null;
  hasAudio?: boolean;
  isWatermarkFree?: boolean;
  downloadUrl?: string | null;
  downloadToken?: string | null;
  expiresAt?: string | null;
  available?: boolean;
}): Capability {
  const format = (options.format || 'mp4').toLowerCase();
  const qualityCategory = categorizeVideoQuality(
    options.height,
    options.width,
    options.resolution
  );

  const defaultLabel =
    qualityCategory === 'hd'
      ? `HD ${options.resolution || '1080p'}`
      : `Standard ${options.resolution || '720p'}`;

  return {
    id: options.id,
    type: 'video',
    qualityCategory,
    label: options.label || defaultLabel,
    resolution: options.resolution || (options.height ? `${options.height}p` : null),
    width: options.width || null,
    height: options.height || null,
    format,
    fileSizeBytes: options.fileSizeBytes || null,
    bitrateKbps: options.bitrateKbps || null,
    hasAudio: options.hasAudio ?? true,
    isWatermarkFree: options.isWatermarkFree ?? true,
    downloadUrl: options.downloadUrl || null,
    downloadToken: options.downloadToken || null,
    expiresAt: options.expiresAt || null,
    available: options.available ?? true,
  };
}

/**
 * Creates a normalized Audio Capability object.
 */
export function createAudioCapability(options: {
  id: string;
  label?: string;
  format?: string;
  bitrateKbps?: number | null;
  fileSizeBytes?: number | null;
  downloadUrl?: string | null;
  downloadToken?: string | null;
  expiresAt?: string | null;
  available?: boolean;
}): Capability {
  return {
    id: options.id,
    type: 'audio',
    qualityCategory: 'audio_only',
    label: options.label || 'Audio (MP3)',
    resolution: null,
    width: null,
    height: null,
    format: (options.format || 'mp3').toLowerCase(),
    bitrateKbps: options.bitrateKbps || 128,
    fileSizeBytes: options.fileSizeBytes || null,
    hasAudio: true,
    isWatermarkFree: true,
    downloadUrl: options.downloadUrl || null,
    downloadToken: options.downloadToken || null,
    expiresAt: options.expiresAt || null,
    available: options.available ?? true,
  };
}

/**
 * Creates a normalized Image/Still Capability object.
 */
export function createImageCapability(options: {
  id: string;
  label?: string;
  resolution?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string;
  fileSizeBytes?: number | null;
  downloadUrl?: string | null;
  downloadToken?: string | null;
  available?: boolean;
}): Capability {
  return {
    id: options.id,
    type: 'image',
    qualityCategory: 'image',
    label: options.label || 'High-Res Photo',
    resolution: options.resolution || null,
    width: options.width || null,
    height: options.height || null,
    format: (options.format || 'jpg').toLowerCase(),
    fileSizeBytes: options.fileSizeBytes || null,
    hasAudio: false,
    isWatermarkFree: true,
    downloadUrl: options.downloadUrl || null,
    downloadToken: options.downloadToken || null,
    available: options.available ?? true,
  };
}
