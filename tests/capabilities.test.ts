import { describe, it, expect } from 'vitest';
import {
  categorizeVideoQuality,
  createVideoCapability,
  createAudioCapability,
  createImageCapability,
} from '../src/lib/platforms/capabilities';

describe('Capability Engine — Standard vs HD', () => {
  describe('categorizeVideoQuality', () => {
    it('classifies 1080p height as hd', () => {
      expect(categorizeVideoQuality(1080, 1920)).toBe('hd');
    });

    it('classifies vertical 1080x1920 (height=1920) as hd', () => {
      expect(categorizeVideoQuality(1920, 1080)).toBe('hd');
    });

    it('classifies 1440p (2K) and 2160p (4K) as hd', () => {
      expect(categorizeVideoQuality(1440, 2560)).toBe('hd');
      expect(categorizeVideoQuality(2160, 3840)).toBe('hd');
    });

    it('classifies 720p as standard', () => {
      expect(categorizeVideoQuality(720, 1280)).toBe('standard');
    });

    it('classifies 480p and 360p as standard', () => {
      expect(categorizeVideoQuality(480, 854)).toBe('standard');
      expect(categorizeVideoQuality(360, 640)).toBe('standard');
    });

    it('identifies resolution labels without dimensions', () => {
      expect(categorizeVideoQuality(null, null, '1080p Full HD')).toBe('hd');
      expect(categorizeVideoQuality(null, null, '4K UHD')).toBe('hd');
      expect(categorizeVideoQuality(null, null, '720p HD')).toBe('standard');
      expect(categorizeVideoQuality(null, null, '480p SD')).toBe('standard');
    });
  });

  describe('createVideoCapability', () => {
    it('creates standard capability with proper labels', () => {
      const cap = createVideoCapability({
        id: 'cap_sd',
        height: 720,
        width: 1280,
        format: 'mp4',
        resolution: '720p',
      });

      expect(cap.qualityCategory).toBe('standard');
      expect(cap.label).toBe('Standard 720p');
      expect(cap.format).toBe('mp4');
      expect(cap.available).toBe(true);
    });

    it('creates HD capability with proper labels and refuses false HD', () => {
      const cap = createVideoCapability({
        id: 'cap_hd',
        height: 1080,
        width: 1920,
        format: 'mp4',
        resolution: '1080p',
      });

      expect(cap.qualityCategory).toBe('hd');
      expect(cap.label).toBe('HD 1080p');
      expect(cap.available).toBe(true);
    });
  });

  describe('createAudioCapability', () => {
    it('creates audio capability with audio_only category', () => {
      const cap = createAudioCapability({
        id: 'cap_audio',
        label: 'Original Audio',
        format: 'mp3',
        bitrateKbps: 320,
      });

      expect(cap.type).toBe('audio');
      expect(cap.qualityCategory).toBe('audio_only');
      expect(cap.bitrateKbps).toBe(320);
      expect(cap.resolution).toBeNull();
    });
  });

  describe('createImageCapability', () => {
    it('creates image capability with image category', () => {
      const cap = createImageCapability({
        id: 'cap_img',
        label: 'Cover Photo',
        format: 'jpg',
        width: 1200,
        height: 800,
      });

      expect(cap.type).toBe('image');
      expect(cap.qualityCategory).toBe('image');
      expect(cap.format).toBe('jpg');
    });
  });
});
