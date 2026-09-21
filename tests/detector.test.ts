import { describe, it, expect } from 'vitest';
import { PlatformDetector } from '../src/lib/platforms/detector';
import { normalizeAndParseUrl } from '../src/lib/security/sanitizer';

describe('PlatformDetector & URL Normalization', () => {
  describe('normalizeAndParseUrl', () => {
    it('normalizes URLs without protocol to https', () => {
      const url = normalizeAndParseUrl('www.tiktok.com/@creator/video/7123456789012345678');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('www.tiktok.com');
    });

    it('rejects disallowed protocols', () => {
      expect(() => normalizeAndParseUrl('ftp://example.com/file')).toThrowError();
      expect(() => normalizeAndParseUrl('file:///etc/passwd')).toThrowError();
    });

    it('rejects empty or blank strings', () => {
      expect(() => normalizeAndParseUrl('')).toThrowError();
      expect(() => normalizeAndParseUrl('   ')).toThrowError();
    });
  });

  describe('Platform Detection', () => {
    it('detects TikTok video URLs', () => {
      const result = PlatformDetector.detect(
        'https://www.tiktok.com/@user/video/7123456789012345678'
      );
      expect(result.status).toBe('SUPPORTED_PLATFORM');
      expect(result.platformId).toBe('tiktok');
      expect(result.mediaType).toBe('video');
      expect(result.mediaId).toBe('7123456789012345678');
    });

    it('detects TikTok shortlinks (vm.tiktok.com)', () => {
      const result = PlatformDetector.detect('https://vm.tiktok.com/ZM8rX1234/');
      expect(result.status).toBe('SUPPORTED_PLATFORM');
      expect(result.platformId).toBe('tiktok');
    });

    it('detects YouTube watch URLs', () => {
      const result = PlatformDetector.detect('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.status).toBe('SUPPORTED_PLATFORM');
      expect(result.platformId).toBe('youtube');
      expect(result.mediaId).toBe('dQw4w9WgXcQ');
    });

    it('detects YouTube shortlinks (youtu.be)', () => {
      const result = PlatformDetector.detect('https://youtu.be/dQw4w9WgXcQ');
      expect(result.status).toBe('SUPPORTED_PLATFORM');
      expect(result.platformId).toBe('youtube');
      expect(result.mediaId).toBe('dQw4w9WgXcQ');
    });

    it('detects Instagram Reels URLs', () => {
      const result = PlatformDetector.detect('https://www.instagram.com/reel/C3b4X9vL123/');
      expect(result.status).toBe('SUPPORTED_PLATFORM');
      expect(result.platformId).toBe('instagram');
      expect(result.mediaType).toBe('video');
      expect(result.mediaId).toBe('C3b4X9vL123');
    });

    it('detects X / Twitter status URLs (both x.com and twitter.com)', () => {
      const resultX = PlatformDetector.detect(
        'https://x.com/username/status/1234567890123456789?s=20'
      );
      expect(resultX.status).toBe('SUPPORTED_PLATFORM');
      expect(resultX.platformId).toBe('x');
      expect(resultX.mediaId).toBe('1234567890123456789');

      const resultTwitter = PlatformDetector.detect(
        'https://twitter.com/jack/status/20?ref_src=twsrc'
      );
      expect(resultTwitter.status).toBe('SUPPORTED_PLATFORM');
      expect(resultTwitter.platformId).toBe('x');
      expect(resultTwitter.mediaId).toBe('20');
    });

    it('detects Facebook Watch, Reel, and fb.watch URLs', () => {
      const resultWatch = PlatformDetector.detect('https://www.facebook.com/watch/?v=1234567890');
      expect(resultWatch.status).toBe('SUPPORTED_PLATFORM');
      expect(resultWatch.platformId).toBe('facebook');
      expect(resultWatch.mediaId).toBe('1234567890');

      const resultReel = PlatformDetector.detect('https://www.facebook.com/reel/9876543210');
      expect(resultReel.status).toBe('SUPPORTED_PLATFORM');
      expect(resultReel.platformId).toBe('facebook');
      expect(resultReel.mediaId).toBe('9876543210');

      const resultFbWatch = PlatformDetector.detect('https://fb.watch/shortid123/');
      expect(resultFbWatch.status).toBe('SUPPORTED_PLATFORM');
      expect(resultFbWatch.platformId).toBe('facebook');
      expect(resultFbWatch.mediaId).toBe('shortid123');
    });

    it('detects Pinterest Pin and pin.it shortlinks', () => {
      const resultPin = PlatformDetector.detect('https://www.pinterest.com/pin/123456789012345678/');
      expect(resultPin.status).toBe('SUPPORTED_PLATFORM');
      expect(resultPin.platformId).toBe('pinterest');
      expect(resultPin.mediaId).toBe('123456789012345678');

      const resultShort = PlatformDetector.detect('https://pin.it/abc1234');
      expect(resultShort.status).toBe('SUPPORTED_PLATFORM');
      expect(resultShort.platformId).toBe('pinterest');
      expect(resultShort.mediaId).toBe('abc1234');
    });

    it('returns UNSUPPORTED_PLATFORM for unhandled websites', () => {
      const result = PlatformDetector.detect('https://vimeo.com/123456789');
      expect(result.status).toBe('UNSUPPORTED_PLATFORM');
    });

    it('returns UNSUPPORTED_MEDIA for platform pages that are not media', () => {
      const result = PlatformDetector.detect('https://www.youtube.com/feed/subscriptions');
      expect(result.status).toBe('UNSUPPORTED_MEDIA');
    });
  });
});
