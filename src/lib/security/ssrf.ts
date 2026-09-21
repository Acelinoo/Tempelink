import { TempelinkError } from '../types/errors';
import { serverConfig } from '../config';

/**
 * SSRF Protection Engine
 * Prevents attackers from targeting local services, internal subnets, or cloud metadata endpoints.
 */

// Hostnames blocked unconditionally
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '::1',
  'metadata.google.internal',
  'instance-data',
]);

/**
 * Checks if an IPv4 address belongs to a private, loopback, or link-local subnet.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [p0, p1] = parts;

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;

  // 0.0.0.0/8 (Current network)
  if (p0 === 0) return true;

  // 10.0.0.0/8 (Private)
  if (p0 === 10) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (p0 === 192 && p1 === 168) return true;

  // 169.254.0.0/16 (Link-local & AWS/GCP metadata: 169.254.169.254)
  if (p0 === 169 && p1 === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

  // 255.255.255.255 (Broadcast)
  if (parts.every((p) => p === 255)) return true;

  return false;
}

/**
 * Checks if a hostname resolves to a blocked internal or metadata location.
 */
export function isBlockedHost(rawHostname: string): boolean {
  const host = rawHostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }

  // Block local domains
  if (
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home')
  ) {
    return true;
  }

  // Check direct IPv4 format
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(host)) {
    return isPrivateIPv4(host);
  }

  // Check IPv6 loopback, private, and IPv4-mapped IPv6
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc00:') ||
    host.startsWith('fd00:')
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (host.startsWith('::ffff:')) {
    const mappedIpv4 = host.replace('::ffff:', '');
    if (ipv4Regex.test(mappedIpv4)) {
      return isPrivateIPv4(mappedIpv4);
    }
    return true;
  }

  return false;
}

/**
 * Validates the safety of a parsed URL against SSRF vulnerabilities.
 * Throws TempelinkError with 'SSRF_BLOCKED' if safety checks fail.
 */
export function validateUrlSafety(url: URL): void {
  if (!serverConfig.security.enforceStrictLocalBlock) {
    return;
  }

  // Strictly enforce http and https protocols only
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TempelinkError(
      'SSRF_BLOCKED',
      'Protokol jaringan tidak diizinkan. Hanya HTTP dan HTTPS yang didukung.'
    );
  }

  if (isBlockedHost(url.hostname)) {
    throw new TempelinkError(
      'SSRF_BLOCKED',
      'Akses ke alamat link ini diblokir demi alasan keamanan sistem.'
    );
  }

  // Disallow non-standard ports for public downloaders (prevent port scanning)
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new TempelinkError(
      'SSRF_BLOCKED',
      'Port jaringan khusus tidak diizinkan.'
    );
  }
}
