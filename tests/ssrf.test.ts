import { describe, it, expect } from 'vitest';
import { isPrivateIPv4, isBlockedHost, validateUrlSafety } from '../src/lib/security/ssrf';

describe('SSRF Protection & Host Boundary', () => {
  describe('isPrivateIPv4', () => {
    it('detects loopback addresses', () => {
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('127.1.2.3')).toBe(true);
    });

    it('detects 0.0.0.0 current network', () => {
      expect(isPrivateIPv4('0.0.0.0')).toBe(true);
    });

    it('detects RFC 1918 private subnets', () => {
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateIPv4('172.31.255.254')).toBe(true);
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      expect(isPrivateIPv4('192.168.0.254')).toBe(true);
    });

    it('detects cloud metadata IP (169.254.169.254)', () => {
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);
      expect(isPrivateIPv4('169.254.1.1')).toBe(true);
    });

    it('allows public IPv4 addresses', () => {
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('1.1.1.1')).toBe(false);
      expect(isPrivateIPv4('142.250.190.46')).toBe(false);
    });
  });

  describe('isBlockedHost', () => {
    it('blocks localhost and internal domains', () => {
      expect(isBlockedHost('localhost')).toBe(true);
      expect(isBlockedHost('127.0.0.1')).toBe(true);
      expect(isBlockedHost('0.0.0.0')).toBe(true);
      expect(isBlockedHost('sub.localhost')).toBe(true);
      expect(isBlockedHost('my-service.local')).toBe(true);
      expect(isBlockedHost('metadata.google.internal')).toBe(true);
      expect(isBlockedHost('instance-data')).toBe(true);
    });

    it('blocks IPv6 localhost and IPv4-mapped IPv6', () => {
      expect(isBlockedHost('::1')).toBe(true);
      expect(isBlockedHost('[::1]')).toBe(true);
      expect(isBlockedHost('::ffff:127.0.0.1')).toBe(true);
      expect(isBlockedHost('::ffff:192.168.1.1')).toBe(true);
      expect(isBlockedHost('fe80::1')).toBe(true);
    });

    it('allows public social platform domains', () => {
      expect(isBlockedHost('tiktok.com')).toBe(false);
      expect(isBlockedHost('www.tiktok.com')).toBe(false);
      expect(isBlockedHost('instagram.com')).toBe(false);
      expect(isBlockedHost('youtube.com')).toBe(false);
      expect(isBlockedHost('x.com')).toBe(false);
    });
  });

  describe('validateUrlSafety', () => {
    it('throws SSRF_BLOCKED for localhost target', () => {
      const url = new URL('http://127.0.0.1:80/admin');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for 0.0.0.0 target', () => {
      const url = new URL('http://0.0.0.0:80/admin');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for AWS metadata target', () => {
      const url = new URL('http://169.254.169.254/latest/meta-data/');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for IPv6 localhost target', () => {
      const url = new URL('http://[::1]:80/admin');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for decimal IP notation (normalized to 127.0.0.1)', () => {
      const url = new URL('http://2130706433/');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for non-standard port scan', () => {
      const url = new URL('https://example.com:6379/keys');
      expect(() => validateUrlSafety(url)).toThrowError();
    });

    it('throws SSRF_BLOCKED for unsupported protocols', () => {
      const ftpUrl = new URL('ftp://127.0.0.1/file');
      expect(() => validateUrlSafety(ftpUrl)).toThrowError();

      const gopherUrl = new URL('gopher://example.com/item');
      expect(() => validateUrlSafety(gopherUrl)).toThrowError();
    });

    it('passes for legitimate public URLs', () => {
      const url = new URL('https://www.tiktok.com/@user/video/12345');
      expect(() => validateUrlSafety(url)).not.toThrow();
    });
  });
});
