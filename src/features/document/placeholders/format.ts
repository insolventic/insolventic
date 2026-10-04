/**
 * Helpers de formato de los placeholders de documentos.
 *
 * Funciones PURAS y "hoja": no dependen de ningún mapper ni de ningún otro helper,
 * solo de `displayTimeZone`. Se movieron aquí desde `placeholder-mapper.ts` SIN
 * cambiar su código (primer paso de la división del archivo; ver docs del plan y la
 * red de seguridad en tests/unit/documents/mapper-golden.test.ts).
 *
 * La zona de lectura ya NO se fija a `COLOMBIA_TZ`: la resuelve `displayTimeZone`
 * por instante, para que una fecha-sin-hora guardada antes del arreglo del
 * corrimiento (medianoche UTC) se lea como el día que es y no como el anterior.
 * Ver `src/lib/date-colombia.ts`.
 *
 * OJO: se conservan tal cual, incluidas sus rarezas (p. ej. `getGenderArticle`
 * tiene una terminación mal codificada en su lista). Corregirlas es una decisión
 * aparte que debe cambiar el golden master a propósito.
 */

import { displayTimeZone } from '@/lib/date-colombia';

// Helper to format currency
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  // Ensure Prisma Decimal objects are converted to number
  const num = Number(value);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Helper to format date (Colombia timezone)
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: displayTimeZone(d),
  });
}

// Helper to format short date (Colombia timezone)
export function formatShortDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return '';
  if (String(date) === 'DESCONOZCO') return 'Desconoce';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: displayTimeZone(d),
  });
}

// Helper to get day number (Colombia timezone)
export function getDayNumber(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const colombiaDay = parseInt(
    d.toLocaleDateString('es-CO', {
      day: 'numeric',
      timeZone: displayTimeZone(d),
    }),
  );
  return colombiaDay.toString();
}

// Helper to get day in words (Colombia timezone)
export function getDayInWords(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const day = parseInt(
    d.toLocaleDateString('es-CO', {
      day: 'numeric',
      timeZone: displayTimeZone(d),
    }),
  );
  const words = [
    '',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciseis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidos',
    'veintitres',
    'veinticuatro',
    'veinticinco',
    'veintiseis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
    'treinta',
    'treinta y uno',
  ];
  return words[day] || day.toString();
}

// Helper to get month name (Colombia timezone)
export function getMonthName(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    month: 'long',
    timeZone: displayTimeZone(d),
  });
}

// Helper to get year (Colombia timezone)
export function getYear(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    timeZone: displayTimeZone(d),
  });
}

// Helper for complete date in words (Colombia timezone)
export function formatDateComplete(
  date: Date | string | null | undefined,
): string {
  if (!date) return '';
  const d = new Date(date);
  const day = parseInt(
    d.toLocaleDateString('es-CO', {
      day: 'numeric',
      timeZone: displayTimeZone(d),
    }),
  );
  const month = d.toLocaleDateString('es-CO', {
    month: 'long',
    timeZone: displayTimeZone(d),
  });
  const year = d.toLocaleDateString('es-CO', {
    year: 'numeric',
    timeZone: displayTimeZone(d),
  });
  return `${day} de ${month} de ${year}`;
}

// Helper for SI/NO values
export function boolToSiNo(value: boolean | null | undefined): string {
  return value ? 'SI' : 'NO';
}

// Helper to get gender prefix
export function getGenderPrefix(name: string): string {
  // Simple heuristic - names ending in 'a' are typically female in Spanish
  const lowerName = name.toLowerCase().trim();
  const femaleEndings = ['a', 'ia', 'ita'];
  for (const ending of femaleEndings) {
    if (lowerName.endsWith(ending)) {
      return 'La señora';
    }
  }
  return 'El señor';
}

// Helper to get gender article (el/la)
export function getGenderArticle(name: string): string {
  if (!name) return 'el';
  const firstName = name.split(' ')[0].toLowerCase();
  // Common female name endings in Spanish
  const femaleEndings = ['a', 'ia', 'na', 'da', 'ta', 'sa', 'za', 'ía'];
  // Common male names that end in 'a'
  const maleExceptions = ['joshua', 'josua', 'garcia', 'borja', 'kocha'];

  if (maleExceptions.includes(firstName)) return 'el';

  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending)) return 'la';
  }
  return 'el';
}

// Helper to format ID number with dots
export function formatIdNumber(idNumber: string): string {
  if (!idNumber) return '';
  // Remove any existing formatting
  const cleaned = idNumber.replace(/\D/g, '');
  // Add thousand separators (Colombian format)
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
