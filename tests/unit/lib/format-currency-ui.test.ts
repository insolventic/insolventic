/**
 * N3 (auditoría 2026-10-27): la interfaz mostraba importes como
 * `$8.916.666,667`. `formatCurrency` (src/lib/utils.ts) usaba
 * `toLocaleString('es-CO')` sin opciones, que imprime hasta 3 decimales. Los
 * montos en COP van sin decimales, igual que en los documentos.
 */
import { formatAmount, formatCurrency } from '@/lib/utils';

describe('formatCurrency (interfaz) — COP sin decimales', () => {
  it('un promedio no entero se redondea a pesos', () => {
    expect(formatCurrency(26_750_000 / 3)).toBe('$8.916.667');
  });

  it('mantiene el separador de miles de es-CO', () => {
    expect(formatCurrency(1_500_000)).toBe('$1.500.000');
    expect(formatCurrency('2500000.4')).toBe('$2.500.000');
  });

  it('nulo, vacío y no numérico quedan en $0', () => {
    expect(formatCurrency(null)).toBe('$0');
    expect(formatCurrency(undefined)).toBe('$0');
    expect(formatCurrency('abc')).toBe('$0');
    expect(formatCurrency(Number.NaN)).toBe('$0');
  });

  it('formatAmount da el mismo número sin el símbolo', () => {
    expect(formatAmount(1234.5)).toBe('1.235');
    expect(formatAmount(0)).toBe('0');
  });
});
