/**
 * Unit Tests: placeholders de fecha de Fracaso en el merge final (issue #18).
 *
 * `mapExtendedDates` declaraba DIA/MES/ANO_FRACASO como '' ("Manual") y
 * `mapFracasoVariables` los calcula desde `failureDate`. Como
 * `mapCaseToPlaceholders` fusiona con spread y `mapFracasoVariables` va
 * DESPUÉS, el valor correcto siempre ganó: el '' era código muerto que parecía
 * un bug (el issue #18 lo diagnosticó como tal, pero el documento salía bien).
 *
 * Estos tests fijan lo que importa —el valor que llega a la plantilla— para que
 * nadie reintroduzca una segunda fuente de verdad que lo pise.
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';

const makeCase = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'INSOLVENCY',
    caseNumber: 'INS-2026-018',
    debtor: {
      name: 'Ana Torres',
      idNumber: '987654321',
      address: 'Calle 8 # 3-20',
      city: 'Bogotá',
      email: 'ana@example.com',
      phone: '3001112222',
      occupation: 'Comerciante',
    },
    debts: [],
    assets: [],
    documents: [],
    legalProcesses: [],
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    causes: [],
    applicantScope: [],
    operator: null,
    ...overrides,
  }) as never;

const CASE_TYPES = ['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'] as const;

describe('DIA/MES/ANO_FRACASO en el merge final (issue #18)', () => {
  describe.each(CASE_TYPES)('caso %s', (type) => {
    it('con failureDate: día, mes y año salen de esa fecha', () => {
      const p = mapCaseToPlaceholders(
        makeCase({ type, failureDate: new Date('2026-03-15T15:00:00Z') }),
      );

      expect(p.DIA_FRACASO).toBe('15');
      expect(p.MES_FRACASO).toBe('marzo');
      expect(p.ANO_FRACASO).toBe('2026');
    });

    it('sin failureDate: marcador para completar a mano (no en blanco, no la fecha de hoy)', () => {
      const p = mapCaseToPlaceholders(makeCase({ type }));

      // Comportamiento vigente, fijado a propósito: si en algún momento se
      // decide imprimir la fecha de hoy cuando no hay failureDate, es una
      // decisión legal/de negocio y debe cambiarse aquí de forma explícita.
      expect(p.DIA_FRACASO).toBe('____');
      expect(p.MES_FRACASO).toBe('____________');
      expect(p.ANO_FRACASO).toBe('______');
    });
  });

  it('usa la zona horaria de Colombia: 22:30 del 15 (UTC-5) sigue siendo día 15', () => {
    // 2026-03-16T03:30Z == 2026-03-15 22:30 en Bogotá.
    const p = mapCaseToPlaceholders(
      makeCase({ failureDate: new Date('2026-03-16T03:30:00Z') }),
    );

    expect(p.DIA_FRACASO).toBe('15');
    expect(p.MES_FRACASO).toBe('marzo');
  });

  it('cambio de año en hora de Colombia: 31/dic 22:00 no salta a enero', () => {
    // 2026-01-01T03:00Z == 2025-12-31 22:00 en Bogotá.
    const p = mapCaseToPlaceholders(
      makeCase({ failureDate: new Date('2026-01-01T03:00:00Z') }),
    );

    expect(p.DIA_FRACASO).toBe('31');
    expect(p.MES_FRACASO).toBe('diciembre');
    expect(p.ANO_FRACASO).toBe('2025');
  });

  it('acepta failureDate como string ISO (así llega de una server action)', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ failureDate: '2026-07-04T15:00:00.000Z' }),
    );

    expect(p.DIA_FRACASO).toBe('4');
    expect(p.MES_FRACASO).toBe('julio');
    expect(p.ANO_FRACASO).toBe('2026');
  });
});
