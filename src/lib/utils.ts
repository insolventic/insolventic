import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '$0';
  }

  const numericValue =
    typeof value === 'string' ? parseFloat(value) || 0 : value;

  // Handle NaN case
  if (isNaN(numericValue)) {
    return '$0';
  }

  return `$${numericValue.toLocaleString('es-CO')}`;
}

export function parseCurrencyInput(value: string): string {
  return value.replace(/[^\d]/g, '');
}
