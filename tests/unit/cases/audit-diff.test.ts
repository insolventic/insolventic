/**
 * GC-M4 — el diff que alimenta el `metadata` del audit log de `updateCase`.
 *
 * Lo que este test protege, por orden de importancia:
 *
 *  1. Que un cambio real NUNCA se declare "sin cambios". Un falso "cambió" es
 *     ruido en el registro; un falso "no cambió" **esconde una edición de un
 *     expediente legal**, que es el defecto que GC-M4 viene a cerrar.
 *  2. Que las formas distintas del mismo valor (string vs Date, string vs
 *     Decimal) no se cuenten como cambio: si no, cada edición marcaría las 13
 *     fechas y los montos, y el registro volvería a ser inútil por exceso.
 *  3. Que los valores de campos personales no lleguen al metadata.
 */

import {
  COLUMNAS_CASE,
  CAMPOS_CON_VALOR_AUDITABLE,
  mismoValor,
  resumirCambios,
  selectDeCamposEnviados,
  valoresAuditables,
} from '@/features/case/audit-diff';

describe('audit-diff — qué cambió en una edición (GC-M4)', () => {
  describe('COLUMNAS_CASE', () => {
    it('sale del schema y no incluye las relaciones', () => {
      expect(COLUMNAS_CASE.has('caseNumber')).toBe(true);
      expect(COLUMNAS_CASE.has('phase')).toBe(true);
      expect(COLUMNAS_CASE.has('hearingDate')).toBe(true);
      // Relaciones: `select: { debtor: true }` traería la fila entera.
      expect(COLUMNAS_CASE.has('debtor')).toBe(false);
      expect(COLUMNAS_CASE.has('operator')).toBe(false);
      expect(COLUMNAS_CASE.has('_count')).toBe(false);
    });

    it('es grande (es el modelo Case real, no una lista a mano)', () => {
      expect(COLUMNAS_CASE.size).toBeGreaterThan(200);
    });
  });

  describe('selectDeCamposEnviados', () => {
    it('toma solo las claves que son columnas de Case', () => {
      const select = selectDeCamposEnviados(
        { phase: 'Admisión', caseNumber: 'X', monthlyIncome: 1 },
        COLUMNAS_CASE,
      );
      expect(select.phase).toBe(true);
      expect(select.caseNumber).toBe(true);
    });

    it('descarta en silencio lo que no es columna (no revienta)', () => {
      const select = selectDeCamposEnviados(
        { campoInventado: 'x', phase: 'Inicial' },
        COLUMNAS_CASE,
      );
      expect(select.campoInventado).toBeUndefined();
      expect(select.phase).toBe(true);
    });

    it('un payload vacío da un select vacío', () => {
      expect(selectDeCamposEnviados({}, COLUMNAS_CASE)).toEqual({});
    });
  });

  describe('mismoValor — las formas distintas del mismo dato', () => {
    it('un Date y el "YYYY-MM-DD" que manda el formulario son iguales', () => {
      // El formulario manda la cadena; la base guarda el DateTime anclado al
      // mediodía UTC (ver date-colombia.ts). Comparar el instante completo
      // marcaría cambio en CADA edición.
      expect(mismoValor(new Date('2026-03-15T12:00:00.000Z'), '2026-03-15')).toBe(
        true,
      );
    });

    it('un ISO completo y su parte de fecha son iguales', () => {
      expect(mismoValor('2026-03-15T12:00:00.000Z', '2026-03-15')).toBe(true);
    });

    it('fechas distintas SÍ son un cambio', () => {
      expect(
        mismoValor(new Date('2026-03-15T12:00:00.000Z'), '2026-03-16'),
      ).toBe(false);
    });

    it('un Decimal-como-objeto y el número equivalente son iguales', () => {
      const decimalFalso = { toString: () => '1500000.000000000000000000' };
      expect(mismoValor(decimalFalso, 1500000)).toBe(true);
      expect(mismoValor(decimalFalso, '1500000')).toBe(true);
    });

    it('montos distintos SÍ son un cambio', () => {
      const decimalFalso = { toString: () => '1500000' };
      expect(mismoValor(decimalFalso, 1500001)).toBe(false);
    });

    it('null, undefined y cadena vacía son el mismo "sin valor"', () => {
      expect(mismoValor(null, '')).toBe(true);
      expect(mismoValor(undefined, '')).toBe(true);
      expect(mismoValor(null, undefined)).toBe(true);
    });

    it('pasar de vacío a tener valor SÍ es un cambio', () => {
      expect(mismoValor(null, 'Admisión')).toBe(false);
      expect(mismoValor('', '0')).toBe(false);
    });

    it('los espacios alrededor no son un cambio', () => {
      expect(mismoValor('Admisión', '  Admisión  ')).toBe(true);
    });

    it('los booleanos se comparan como tales', () => {
      expect(mismoValor(true, 'true')).toBe(true);
      expect(mismoValor(false, 'true')).toBe(false);
    });

    it('ante un valor que no sabe normalizar, declara CAMBIADO', () => {
      // El sesgo deliberado: nunca esconder una edición real.
      expect(mismoValor(Symbol('x'), Symbol('x'))).toBe(false);
      expect(mismoValor(NaN, NaN)).toBe(false);
    });
  });

  describe('resumirCambios', () => {
    it('lista solo los campos que cambiaron, ordenados', () => {
      const antes = {
        phase: 'Inicial',
        tramite: 'A',
        caseNumber: 'INSOL-1',
        type: 'INSOLVENCY',
      };
      const despues = {
        phase: 'Inicial', // igual
        tramite: 'B', // cambió
        caseNumber: 'INSOL-1', // igual
        type: 'CONCILIATION', // cambió
      };

      const r = resumirCambios(antes, despues);

      expect(r.changedFields).toBe('tramite, type');
      expect(r.changedFieldCount).toBe(2);
      expect(r.submittedFieldCount).toBe(4);
    });

    it('una edición que no cambia nada queda registrada como tal', () => {
      const fila = { phase: 'Inicial', tramite: 'A' };
      const r = resumirCambios(fila, { ...fila });

      expect(r.changedFields).toBe('');
      expect(r.changedFieldCount).toBe(0);
      expect(r.submittedFieldCount).toBe(2);
    });

    it('ignora las claves que no están en el "antes"', () => {
      const r = resumirCambios({ phase: 'Inicial' }, { phase: 'X', otra: 'Y' });

      expect(r.changedFields).toBe('phase');
      expect(r.submittedFieldCount).toBe(1);
    });

    it('el caso que motivó el hallazgo: cambiar la fecha de audiencia se ve', () => {
      const r = resumirCambios(
        { hearingDate: new Date('2026-03-15T12:00:00.000Z') },
        { hearingDate: new Date('2026-04-20T12:00:00.000Z') },
      );

      expect(r.changedFields).toBe('hearingDate');
      expect(r.changedFieldCount).toBe(1);
    });
  });

  describe('valoresAuditables — la frontera con los datos personales', () => {
    it('incluye el antes y el después de los campos del trámite', () => {
      const v = valoresAuditables(
        { phase: 'Inicial', type: 'INSOLVENCY' },
        { phase: 'Admisión', type: 'CONCILIATION' },
        ['phase', 'type'],
      );

      expect(v).toEqual({
        phase_antes: 'Inicial',
        phase_despues: 'Admisión',
        type_antes: 'INSOLVENCY',
        type_despues: 'CONCILIATION',
      });
    });

    it('NO incluye el valor de un campo personal, aunque haya cambiado', () => {
      const v = valoresAuditables(
        { debtorName: 'Ana', debtorIdNumber: '123', phase: 'Inicial' },
        { debtorName: 'Ana María', debtorIdNumber: '456', phase: 'Admisión' },
        ['debtorName', 'debtorIdNumber', 'phase'],
      );

      // Del nombre y la cédula solo queda que cambiaron (en changedFields).
      expect(v.debtorName_antes).toBeUndefined();
      expect(v.debtorName_despues).toBeUndefined();
      expect(v.debtorIdNumber_antes).toBeUndefined();
      expect(v.phase_despues).toBe('Admisión');
    });

    it('el allowlist no contiene ningún campo de datos personales', () => {
      const prohibidos = [
        'debtorName',
        'debtorIdNumber',
        'convened',
        'attorney',
        'monthlyIncome',
        'monthlyExpenses',
        'totalDebt',
        'owedCapital',
        'city',
        'plaintiff',
      ];
      for (const campo of prohibidos) {
        expect(CAMPOS_CON_VALOR_AUDITABLE.has(campo)).toBe(false);
      }
    });

    it('las fechas procesales sí llevan valor (son hechos del expediente)', () => {
      for (const campo of [
        'hearingDate',
        'admissionDate',
        'firstHearingDate',
        'resultDate',
      ]) {
        expect(CAMPOS_CON_VALOR_AUDITABLE.has(campo)).toBe(true);
      }
    });

    it('normaliza las fechas a YYYY-MM-DD en el registro', () => {
      const v = valoresAuditables(
        { hearingDate: new Date('2026-03-15T12:00:00.000Z') },
        { hearingDate: new Date('2026-04-20T12:00:00.000Z') },
        ['hearingDate'],
      );

      expect(v.hearingDate_antes).toBe('2026-03-15');
      expect(v.hearingDate_despues).toBe('2026-04-20');
    });
  });
});
