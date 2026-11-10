import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Pesos colombianos sin decimales y con separador de miles: `8.916.667`.
 *
 * `toLocaleString('es-CO')` sin opciones imprime hasta 3 decimales, y en la
 * interfaz salían importes como `$8.916.666,667` en cualquier promedio o total
 * calculado (N3, auditoría 2026-10-27). Los documentos ya redondeaban
 * (`features/document/placeholders/format.ts`); la interfaz ahora hace lo
 * mismo.
 */
const PESOS = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Monto sin el símbolo `$`, para inputs que ya lo muestran aparte. */
export function formatAmount(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) return '0';
  const numericValue =
    typeof value === 'string' ? parseFloat(value) || 0 : Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return PESOS.format(numericValue);
}

export function formatCurrency(
  value: number | string | null | undefined,
): string {
  return `$${formatAmount(value)}`;
}

export function parseCurrencyInput(value: string): string {
  return value.replace(/[^\d]/g, '');
}
