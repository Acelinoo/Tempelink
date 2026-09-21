/**
 * Tempelink Admin — Centralized timestamp formatter
 * All timestamps displayed in Asia/Jakarta (WIB, UTC+7)
 * Format: "21 September 2026, 21:31:42"
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Formats an ISO timestamp to Tempelink admin display format.
 * Example output: "21 September 2026, 21:31:42"
 */
export function formatAdminTimestamp(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';

  try {
    const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(date.getTime())) return '—';

    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: WIB_TIMEZONE,
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);

    // Ensure month names are in Indonesian (Intl may use 'id-ID' names correctly)
    return formatted.replace(',', '');
  } catch {
    return '—';
  }
}

/**
 * Short format for table rows: "21 Sep 2026, 21:31"
 */
export function formatAdminTimestampShort(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';

  try {
    const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(date.getTime())) return '—';

    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: WIB_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return formatter.format(date);
  } catch {
    return '—';
  }
}

/**
 * Returns month name in Indonesian.
 */
export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] ?? '';
}

/**
 * Formats a number with Indonesian locale (1.248.320)
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('id-ID');
}

/**
 * Formats a percentage with 2 decimal places.
 */
export function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}
