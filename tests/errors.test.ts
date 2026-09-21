import { describe, it, expect } from 'vitest';
import { TempelinkError, ERROR_DEFINITIONS } from '../src/lib/types/errors';

describe('TempelinkError System', () => {
  it('assigns correct HTTP status and Indonesian message for INVALID_URL', () => {
    const err = new TempelinkError('INVALID_URL');
    expect(err.httpStatus).toBe(400);
    expect(err.userMessage).toBe(ERROR_DEFINITIONS.INVALID_URL.userMessage);
    expect(err.userMessage).toContain('Link tidak valid');
  });

  it('assigns correct HTTP status and Indonesian message for RATE_LIMITED', () => {
    const err = new TempelinkError('RATE_LIMITED');
    expect(err.httpStatus).toBe(429);
    expect(err.userMessage).toBe('Permintaan terlalu banyak. Silakan tunggu beberapa saat.');
  });

  it('assigns correct HTTP status for SSRF_BLOCKED', () => {
    const err = new TempelinkError('SSRF_BLOCKED');
    expect(err.httpStatus).toBe(403);
    expect(err.userMessage).toContain('keamanan');
  });

  it('allows custom message override while retaining error code', () => {
    const err = new TempelinkError('INVALID_URL', 'Kustom: URL terlalu panjang.');
    expect(err.code).toBe('INVALID_URL');
    expect(err.userMessage).toBe('Kustom: URL terlalu panjang.');
  });

  it('assigns correct HTTP status and Indonesian message for PROVIDER_NOT_CONFIGURED', () => {
    const err = new TempelinkError('PROVIDER_NOT_CONFIGURED');
    expect(err.httpStatus).toBe(503);
    expect(err.userMessage).toContain('belum dikonfigurasi');
  });

  it('assigns correct HTTP status and Indonesian message for MEDIA_URL_EXPIRED', () => {
    const err = new TempelinkError('MEDIA_URL_EXPIRED');
    expect(err.httpStatus).toBe(410);
    expect(err.userMessage).toContain('kedaluwarsa');
  });

  it('serializes to structured JSON with correlation ID', () => {
    const err = new TempelinkError('UNSUPPORTED_PLATFORM');
    const json = err.toJSON('test-corr-id-123');

    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_PLATFORM');
    expect(json.error.correlationId).toBe('test-corr-id-123');
    expect(json.error.message).toBe(ERROR_DEFINITIONS.UNSUPPORTED_PLATFORM.userMessage);
  });
});
