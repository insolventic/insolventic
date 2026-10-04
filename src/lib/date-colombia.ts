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

// ---------------------------------------------------------------------------
// Fechas SIN hora (las que teclea el operador en un <input type="date">)
// ---------------------------------------------------------------------------

/**
 * Hora del día, en UTC, con la que se guarda una fecha-sin-hora.
 *
 * El mediodía UTC preserva el día del calendario en cualquier zona entre UTC-12
 * y UTC+11, así que da igual dónde corra el servidor y dónde esté el navegador
 * que después la muestra. Las 00:00 UTC —lo que devuelve `new Date('2026-02-11')`—
 * no: en Colombia (UTC-5) son las 19:00 del día ANTERIOR.
 */
const DATE_ONLY_HOUR_UTC = 12;

/**
 * Convierte el `"YYYY-MM-DD"` de un `<input type="date">` en el instante que
 * representa ese día.
 *
 * POR QUÉ EXISTE. `new Date("2026-02-11")` devuelve, por especificación de
 * ECMAScript, la **medianoche UTC** de ese día. Eso no es un error de la
 * plataforma: un literal `YYYY-MM-DD` es una fecha sin zona, y el estándar
 * decidió anclarla a UTC. El error aparece al leer ese instante en una zona
 * detrás de UTC: los helpers de `placeholders/format.ts` formatean con
 * `timeZone: 'America/Bogota'`, y medianoche UTC allá son las 19:00 del día
 * anterior. Resultado: TODA fecha tecleada por el operador salía impresa un día
 * antes, siempre — en los 195 documentos medidos no apareció ni una correcta
 * (ver `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`, hallazgo T1).
 *
 * NO es el bug de PR #46. Aquel era una DOBLE conversión en `nowColombia()`,
 * solo sobre la fecha de hoy y solo entre las 00:00 y las 04:59 COT. Su arreglo
 * dejó explícitamente fuera "los ~50 usos de los helpers de format.ts con
 * fechas guardadas del caso" por considerarlos correctos: hacen una sola
 * conversión, sí, pero sobre un instante que ya venía mal anclado. Este helper
 * arregla esa otra mitad, en el origen.
 *
 * Acepta también un ISO completo (`2026-02-11T15:00:00Z`): si trae hora, se
 * respeta tal cual — no es una fecha-sin-hora y no hay nada que anclar.
 */
export function parseDateOnly(
  value: string | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        DATE_ONLY_HOUR_UTC,
      ),
    );
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * ¿Este instante es una fecha-sin-hora guardada ANTES del arreglo?
 *
 * Las filas que ya están en producción se guardaron con `new Date("YYYY-MM-DD")`,
 * o sea exactamente las 00:00:00.000 UTC. Formatearlas en hora de Colombia
 * seguiría dando el día anterior, así que los helpers de formato las tratan como
 * lo que son —un día del calendario, sin hora— y las leen en UTC. Así los
 * expedientes que ya existen imprimen bien sin tocar un solo dato de la base.
 *
 * Las filas nuevas se guardan al mediodía UTC (`parseDateOnly`), no caen en esta
 * rama y se formatean en hora de Colombia como cualquier otro instante.
 *
 * Límite conocido y aceptado: un instante REAL que caiga exactamente en
 * 00:00:00.000 UTC se leería como fecha-sin-hora. En estas columnas no ocurre
 * —son todas fechas de calendario que teclea el operador— y la probabilidad al
 * milisegundo es despreciable.
 */
export function isDateOnlyInstant(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/**
 * Zona con la que hay que leer este instante para obtener su día de calendario.
 *
 * Único punto de decisión: lo usan los seis helpers de `placeholders/format.ts`
 * para no repetir el ternario (y para que agregar un helper nuevo no se olvide
 * de la compatibilidad con las filas viejas).
 */
export function displayTimeZone(date: Date): string {
  return isDateOnlyInstant(date) ? 'UTC' : COLOMBIA_TZ;
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
  return d.toLocaleDateString('es-CO', {
    ...options,
    timeZone: displayTimeZone(d),
  });
}

export { COLOMBIA_TZ };
