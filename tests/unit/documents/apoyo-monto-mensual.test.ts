/**
 * `apoyoMontoMensual` (Acuerdo de Apoyo) ya era `MoneyInput` en el formulario,
 * pero el mapper lo leía con el parseo viejo de 54 copias que #136 reemplazó
 * en el resto del sistema:
 *
 *     parseFloat(montoMensualRaw.replace(/[^0-9.]/g, ''))
 *
 * Ese strip conserva el punto de MILES y descarta la coma decimal:
 *   - "1.500.000" (lo que escribe MoneyInput para un entero) → strip no
 *     cambia nada → parseFloat corta en el primer punto → 1.5
 *   - "1.234,56" (coma decimal) → strip borra la coma → "1.234.56" →
 *     parseFloat corta en el segundo punto → 1.234
 *
 * `parsearMonto` es el único parseo que entiende los dos formatos.
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { makeCase, DEBTOR_MALE } from '../../helpers/mapper-fixtures';

function conMonto(valor: string) {
  const caseData = makeCase({
    fill: 'minimal',
    type: 'SUPPORT_AGREEMENT',
    debtor: { ...DEBTOR_MALE },
    overrides: { apoyoMontoMensual: valor },
  });
  return mapCaseToPlaceholders(caseData as never).MONTO_MENSUAL_APOYO;
}

describe('MONTO_MENSUAL_APOYO — parsearMonto en vez del parseFloat+replace viejo', () => {
  it('REGRESIÓN: separador de miles de un entero — antes daba $ 2 (de 1.500.000 → 1.5)', () => {
    expect(conMonto('1.500.000')).toBe('$ 1.500.000');
  });

  it('REGRESIÓN: coma decimal — antes daba $ 1 (de 1.234,56 → 1.234)', () => {
    expect(conMonto('1.234,56')).toBe('$ 1.235');
  });

  it('COMPATIBILIDAD: punto decimal viejo, sin separador de miles', () => {
    expect(conMonto('1234.56')).toBe('$ 1.235');
  });

  it('vacío imprime "N/A", no "$ 0"', () => {
    expect(conMonto('')).toBe('N/A');
  });
});
