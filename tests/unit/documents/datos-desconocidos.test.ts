/**
 * Las casillas "Desconozco" del formulario de acreedores.
 *
 * Hallazgo T4 de `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`: marcar
 * cualquiera de las tres —tasa, fecha de otorgamiento, fecha de vencimiento—
 * reventaba la creación del caso, porque la persistencia hacía
 * `parseFloat('DESCONOZCO')` (NaN) y `new Date('DESCONOZCO')` (Invalid Date).
 *
 * El mapper ya estaba preparado para imprimir "Desconoce", pero su condición
 * (`String(debt.interestRate) === 'DESCONOZCO'`) era código muerto: la columna
 * es `Float` y nunca pudo contener ese texto.
 */

import {
  VALOR_DESCONOCIDO,
  ETIQUETA_DESCONOCIDO,
  esDesconocido,
  parseTasaInteres,
  parseFechaCredito,
} from '@/features/case/datos-desconocidos';
import { parseDateOnly } from '@/lib/date-colombia';
import { buildInsolvencyContext } from '@/features/document/placeholder-mapper';
import type { CaseWithRelations } from '@/features/case/schemas';

describe('parseTasaInteres', () => {
  it('"DESCONOZCO" NO produce NaN: guarda 0 y marca la bandera', () => {
    expect(parseTasaInteres(VALOR_DESCONOCIDO)).toEqual({
      interestRate: 0,
      interestRateUnknown: true,
    });
  });

  it('una tasa normal se guarda tal cual, sin bandera', () => {
    expect(parseTasaInteres('2.15')).toEqual({
      interestRate: 2.15,
      interestRateUnknown: false,
    });
  });

  it('vacío o basura caen a 0 sin romper (no NaN, que es lo que Prisma rechaza)', () => {
    for (const raw of ['', '   ', 'abc', null, undefined]) {
      const { interestRate, interestRateUnknown } = parseTasaInteres(raw);
      expect(Number.isFinite(interestRate)).toBe(true);
      expect(interestRateUnknown).toBe(false);
    }
  });

  it('tolera espacios alrededor del literal', () => {
    expect(parseTasaInteres('  DESCONOZCO  ').interestRateUnknown).toBe(true);
  });
});

describe('parseFechaCredito', () => {
  it('"DESCONOZCO" NO produce Invalid Date: deja null y marca la bandera', () => {
    expect(parseFechaCredito(VALOR_DESCONOCIDO, parseDateOnly)).toEqual({
      value: null,
      unknown: true,
    });
  });

  it('una fecha normal se ancla con el parser inyectado', () => {
    const { value, unknown } = parseFechaCredito('2022-08-12', parseDateOnly);
    expect(unknown).toBe(false);
    expect(value?.toISOString()).toBe('2022-08-12T12:00:00.000Z');
  });

  it('vacío es "no lo llenó", que NO es lo mismo que "declara no conocerlo"', () => {
    expect(parseFechaCredito('', parseDateOnly)).toEqual({
      value: null,
      unknown: false,
    });
  });
});

describe('esDesconocido', () => {
  it.each([
    [VALOR_DESCONOCIDO, true],
    ['  DESCONOZCO ', true],
    ['desconozco', false], // el formulario escribe el literal en mayúsculas
    ['2.15', false],
    ['', false],
    [null, false],
    [undefined, false],
    [0, false],
  ])('%s → %s', (input, expected) => {
    expect(esDesconocido(input)).toBe(expected);
  });
});

describe('buildInsolvencyContext — el documento dice "Desconoce"', () => {
  const debt = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    amount: 28400000,
    interestRate: 0,
    type: 'TARJETA_CREDITO',
    caseId: 'c1',
    creditorId: 'cr1',
    debtorId: null,
    creditor: { name: 'Banco Davivienda S.A.', representative: null },
    creditorAddress: null,
    creditorCity: null,
    creditorEmail: null,
    capitalAmount: 28400000,
    interestAmount: 0,
    isDeferred: false,
    documentType: null,
    grantDate: null,
    dueDate: null,
    creditClassification: null,
    hasActiveLibranza: false,
    creditorClass: null,
    percentageOfTotal: null,
    daysOverdue: null,
    coDebtorName: null,
    coDebtorCity: null,
    coDebtorAddress: null,
    coDebtorPhone: null,
    coDebtorEmail: null,
    interestRateUnknown: false,
    grantDateUnknown: false,
    dueDateUnknown: false,
    ...over,
  });

  const contextoCon = (over: Record<string, unknown>) =>
    (
      buildInsolvencyContext({
        debts: [debt(over)],
      } as unknown as CaseWithRelations).ACREEDORES as Array<
        Record<string, string>
      >
    )[0];

  it('la tasa desconocida se imprime "Desconoce", no "0%"', () => {
    expect(contextoCon({ interestRateUnknown: true }).TASA).toBe(
      ETIQUETA_DESCONOCIDO,
    );
  });

  it('una tasa conocida se imprime con su porcentaje', () => {
    expect(contextoCon({ interestRate: 2.15 }).TASA).toBe('2.15%');
  });

  it('las fechas desconocidas se imprimen "Desconoce", no vacías', () => {
    const fila = contextoCon({ grantDateUnknown: true, dueDateUnknown: true });
    expect(fila.FECHA_OTORGAMIENTO).toBe(ETIQUETA_DESCONOCIDO);
    expect(fila.FECHA_VENCIMIENTO).toBe(ETIQUETA_DESCONOCIDO);
  });

  it('una fecha no informada sigue saliendo vacía, no "Desconoce"', () => {
    const fila = contextoCon({});
    expect(fila.FECHA_OTORGAMIENTO).toBe('');
    expect(fila.FECHA_VENCIMIENTO).toBe('');
  });

  it('una fecha informada se imprime normal', () => {
    expect(
      contextoCon({ grantDate: parseDateOnly('2022-08-12') })
        .FECHA_OTORGAMIENTO,
    ).toBe('12/08/2022');
  });
});
