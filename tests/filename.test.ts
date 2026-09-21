import { describe, it, expect } from 'vitest';
import { sanitizeDownloadFilename, formatContentDisposition } from '../src/lib/security/filename';

describe('Filename Sanitization & RFC 6266 Headers', () => {
  describe('sanitizeDownloadFilename', () => {
    it('preserves clean, normal filenames', () => {
      expect(sanitizeDownloadFilename('tiktok_123456_standard.mp4')).toBe('tiktok_123456_standard.mp4');
      expect(sanitizeDownloadFilename('video-hd-2026.webm')).toBe('video-hd-2026.webm');
      expect(sanitizeDownloadFilename('audio_track_01.mp3')).toBe('audio_track_01.mp3');
    });

    it('neutralizes path traversal attempts', () => {
      expect(sanitizeDownloadFilename('../../etc/passwd.mp4')).toBe('etc_passwd.mp4');
      expect(sanitizeDownloadFilename('..\\..\\windows\\system32\\cmd.exe.mp4')).toBe('windows_system32_cmd.exe.mp4');
      expect(sanitizeDownloadFilename('/absolute/path/to/media.mp4')).toBe('absolute_path_to_media.mp4');
      expect(sanitizeDownloadFilename('....//....//sneaky.mp4')).toBe('sneaky.mp4');
    });

    it('strips CRLF injection characters', () => {
      expect(sanitizeDownloadFilename('malicious\r\nSet-Cookie: evil=1.mp4')).toBe('maliciousSet-Cookie_evil=1.mp4');
      expect(sanitizeDownloadFilename('video\rname\nfile.mp4')).toBe('videonamefile.mp4');
      expect(sanitizeDownloadFilename('header\rinjection.mp3')).toBe('headerinjection.mp3');
    });

    it('replaces dangerous filesystem and shell characters', () => {
      expect(sanitizeDownloadFilename('file<>:"/\\|?*name.mp4')).toBe('file_name.mp4');
      expect(sanitizeDownloadFilename('video;rm -rf /;test.mp4')).toBe('video_rm_-rf_test.mp4');
      expect(sanitizeDownloadFilename('bad$`"file.mp4')).toBe('bad_file.mp4');
    });

    it('neutralizes Windows reserved device names', () => {
      expect(sanitizeDownloadFilename('CON.mp4')).toBe('file_CON.mp4');
      expect(sanitizeDownloadFilename('prn.mp3')).toBe('file_prn.mp3');
      expect(sanitizeDownloadFilename('aux.mp4')).toBe('file_aux.mp4');
      expect(sanitizeDownloadFilename('NUL.mp4')).toBe('file_NUL.mp4');
      expect(sanitizeDownloadFilename('COM1.mp4')).toBe('file_COM1.mp4');
      expect(sanitizeDownloadFilename('LPT9.mp3')).toBe('file_LPT9.mp3');
    });

    it('truncates excessively long base filenames while preserving extension', () => {
      const veryLongBase = 'a'.repeat(200);
      const sanitized = sanitizeDownloadFilename(`${veryLongBase}.mp4`);
      expect(sanitized.endsWith('.mp4')).toBe(true);
      expect(sanitized.length).toBeLessThanOrEqual(80 + 4);
    });

    it('falls back to default safe filename when input is empty or all-invalid', () => {
      expect(sanitizeDownloadFilename('')).toBe('tempelink_media.mp4');
      expect(sanitizeDownloadFilename('', 'bin')).toBe('tempelink_media.bin');
      expect(sanitizeDownloadFilename('   ')).toBe('tempelink_media.mp4');
      expect(sanitizeDownloadFilename('???///:::***')).toBe('tempelink_media.mp4');
    });
  });

  describe('formatContentDisposition', () => {
    it('formats pure ASCII filename correctly', () => {
      const header = formatContentDisposition('tiktok_123_standard.mp4');
      expect(header).toBe('attachment; filename="tiktok_123_standard.mp4"');
    });

    it('handles unicode filenames using RFC 5987 UTF-8 encoding with ASCII fallback', () => {
      const header = formatContentDisposition('video_indonesia_🇮🇩.mp4');
      expect(header).toContain('attachment;');
      expect(header).toContain('filename="video_indonesia_');
      expect(header).toContain("filename*=UTF-8''video_indonesia_");
    });

    it('prevents CRLF injection in the generated header', () => {
      const header = formatContentDisposition('evil\r\nHeader: injected\r\n.mp4');
      expect(header).not.toContain('\r');
      expect(header).not.toContain('\n');
    });
  });
});
