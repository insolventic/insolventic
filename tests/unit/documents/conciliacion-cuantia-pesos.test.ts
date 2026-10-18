/**
 * `concCuantiaPesos` (Conciliación) era un `<Input type="text">` plano —sin
 * `MoneyInput`, sin `parsearMonto`— y el mapper lo leía con `Number()`
 * directo. `Number("1.234,56")` da `NaN`; `formatCurrency` atrapa el `NaN` y
 * lo convierte en `"$ 0"` **en silencio**: el documento de conciliación salía
 * con cuantía cero pesos sin ningún aviso, con el formato colombiano que usa
 * el resto del sistema (coma decimal, punto de miles).
 *
 * Ahora el campo es `MoneyInput` y el mapper usa `parsearMonto`, igual que
 * todos los demás campos de dinero. `parsearMonto` tiene que leer bien los
 * TRES formatos que pueden llegar: el que escribe `MoneyInput` hoy
 * ("1.234,56" / "1.500.000") y el que puede haber quedado guardado de antes,
 * cuando el campo era texto libre sin ningún parseo ("1234.56", con punto
 * decimal al estilo viejo).
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { formatCurrency } from '@/features/document/placeholders/format';
import { makeCase, DEBTOR_MALE } from '../../helpers/mapper-fixtures';

function conCuantia(valor: string) {
  const caseData = makeCase({
    fill: 'minimal',
    type: 'CONCILIATION',
    debtor: { ...DEBTOR_MALE },
    overrides: { concCuantiaPesos: valor },
  });
  return mapCaseToPlaceholders(caseData as never).CUANTIA_PESOS;
}

describe('CUANTIA_PESOS — los 3 formatos que puede traer concCuantiaPesos', () => {
  it('REGRESIÓN: coma decimal, el que escribe MoneyInput hoy — antes daba "$ 0"', () => {
    expect(conCuantia('1.234,56')).toBe(formatCurrency(1234.56));
  });

  it('separador de miles sin decimales, el que escribe MoneyInput para enteros', () => {
    expect(conCuantia('1.500.000')).toBe(formatCurrency(1_500_000));
  });

  it('COMPATIBILIDAD: punto decimal viejo, de antes de este fix (sin MoneyInput)', () => {
    expect(conCuantia('1234.56')).toBe(formatCurrency(1234.56));
  });

  it('vacío no imprime nada (no "$ 0")', () => {
    expect(conCuantia('')).toBe('');
  });

  it('null no imprime nada', () => {
    const caseData = makeCase({
      fill: 'minimal',
      type: 'CONCILIATION',
      debtor: { ...DEBTOR_MALE },
      overrides: { concCuantiaPesos: null },
    });
    expect(mapCaseToPlaceholders(caseData as never).CUANTIA_PESOS).toBe('');
  });
});
