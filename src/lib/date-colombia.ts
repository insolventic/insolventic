/**
 * Centralized Colombia timezone date utilities.
 *
 * On Vercel serverless functions, `new Date()` returns UTC.
 * Colombia is UTC-5 (no daylight saving), so dates can be wrong
 * around midnight UTC (e.g. Jan 2 00:30 UTC = Jan 1 19:30 COT).
 *
 * All "current date" references in the app should use `nowColombia()`
 * instead of `new Date()`.
 */

const COLOMBIA_TZ = 'America/Bogota';

/**
 * Returns the current date/time adjusted to Colombia timezone.
 * The returned Date object's local methods (getDate, getMonth, etc.)
 * will reflect Colombia time.
 */
export function nowColombia(): Date {
  // Get current UTC time, then shift by Colombia offset (-5h)
  const now = new Date();
  const colombiaString = now.toLocaleString('en-US', { timeZone: COLOMBIA_TZ });
  return new Date(colombiaString);
}

/**
 * Format a date using Colombia locale and timezone.
 * Wrapper around toLocaleDateString with timeZone forced to Colombia.
 */
export function formatDateColombia(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  },
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { ...options, timeZone: COLOMBIA_TZ });
}

export { COLOMBIA_TZ };
