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
 * Returns the current instant, for code that needs "ahora" for Colombia-facing
 * output.
 *
 * Hasta 2026-09 esta función pre-convertía a hora de Colombia (shifteando el
 * instante devuelto), pensada para que los getters LOCALES del `Date` (getDate,
 * getMonth...) mostraran directamente la hora de Colombia. El problema: sus
 * únicos consumidores (en `placeholder-mapper.ts`) casi siempre pasan el
 * resultado a los helpers de `placeholders/format.ts`, que YA hacen su propia
 * conversión con `timeZone: 'America/Bogota'` — la misma conversión que aplican
 * sobre cualquier otra fecha del caso (`admissionDate`, `filingDate`, etc.). El
 * pre-shift sumaba una segunda conversión encima: en un servidor UTC, entre las
 * 00:00 y las 05:00 hora de Colombia, el día calculado retrocedía un día
 * (hallazgo documentado en PR #43 / tests/unit/documents/mapper-golden.test.ts).
 *
 * El fix: esta función ya no pre-convierte, devuelve el instante real. Quien
 * necesite el año/día/mes en hora de Colombia debe pasar este valor por
 * `getYear`/`getDayNumber`/`getMonthName`/etc. (o por `formatDateColombia`),
 * igual que con cualquier otra fecha — no leer los getters locales del Date.
 */
export function nowColombia(): Date {
  return new Date();
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
