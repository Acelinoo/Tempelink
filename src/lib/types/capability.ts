/**
 * Capability System Types
 * Dynamically model what can actually be downloaded from any platform without hardcoding UI logic.
 */

export type CapabilityType = 'video' | 'audio' | 'image' | 'gif' | 'document' | 'other';

export type QualityCategory = 'standard' | 'hd' | 'audio_only' | 'image';

export interface Capability {
  /**
   * Unique capability identifier within this media item (e.g. 'video_1080p_mp4')
   */
  id: string;

  /**
   * Broad media category
   */
  type: CapabilityType;

  /**
   * Categorized tier:
   * - standard: < 1080p (480p, 720p)
   * - hd: >= 1080p (1080p, 1440p, 2160p/4K)
   * - audio_only: extracted/original sound
   * - image: photo, thumbnail, or slide
   */
  qualityCategory: QualityCategory;

  /**
   * Clean human-readable label (e.g. "HD 1080p", "Standard 720p", "Original Audio")
   */
  label: string;

  /**
   * Resolution tag if applicable (e.g. "1080p", "720p", "360p")
   */
  resolution?: string | null;

  /**
   * Pixel dimensions if known
   */
  width?: number | null;
  height?: number | null;

  /**
   * Container format (e.g. 'mp4', 'webm', 'mp3', 'm4a', 'jpg')
   */
  format: string;

  /**
   * Optional technical metadata when legitimately provided by provider
   */
  codec?: string | null;
  fileSizeBytes?: number | null;
  bitrateKbps?: number | null;

  /**
   * Media attributes
   */
  hasAudio?: boolean;
  isWatermarkFree?: boolean;

  /**
   * Ephemeral download / direct delivery endpoint if already resolved
   */
  downloadUrl?: string | null;

  /**
   * Cryptographically signed token for secure server-side download delivery
   */
  downloadToken?: string | null;

  /**
   * ISO string timestamp when this capability stream/token expires
   */
  expiresAt?: string | null;

  /**
   * Flag indicating whether this option is currently available for download
   */
  available: boolean;
}
