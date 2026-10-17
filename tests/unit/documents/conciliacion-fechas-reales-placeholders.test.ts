/**
 * Unit tests: DIA_/MES_/ANO_/FECHA_SOLICITUD, DIA_/MES_/ANO_CITACION y
 * DIA_/MES_/ANO_DESISTIMIENTO en el merge final (C-1a, auditoría del
 * formulario de conciliación, 2026-10-12).
 *
 * Antes de las columnas `concFecha*` (DateTime), estas claves leían
 * `raw.concDiaCitacion`/`concDiaSolicitud`/`concDiaDesistimiento` y hermanas
 * — strings sueltos sin columna en el modelo `Case` — y, al no existir nunca
 * en producción, DIA_/MES_/ANO_CONSTANCIA eran la única fecha de este grupo
 * con valor real; las otras seis (más FECHA_SOLICITUD) imprimían siempre el
 * blanco `____`/`____________`/`______`. Esto fija el comportamiento nuevo:
 * con la columna real, imprime la fecha; sin ella, sigue en blanco (nunca la
 * fecha de hoy, que es justamente el bug que motivó la migración).
 *
 * Requisito explícito de la auditoría: el resultado no puede depender de la
 * zona horaria del proceso Node. No hace falta forzar `TZ` acá —
 * `getDayNumber`/`getMonthName`/`getYear`/`formatDateComplete`
 * (`src/features/document/placeholders/format.ts`) ya convierten a
 * `America/Bogota` con `toLocaleDateString(..., { timeZone })`
 * independientemente del `TZ` del proceso— pero la suite completa se corrió
 * una vez con `TZ=UTC` y otra con `TZ=America/Bogota` para verificarlo en los
 * dos extremos (ver docs/IMPLEMENTACION_SEMANA_6.md).
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';

const makeCase = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'CONCILIATION',
    caseNumber: 'CON-2026-015',
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

describe('DIA_/MES_/ANO_/FECHA_SOLICITUD, _CITACION, _DESISTIMIENTO en el merge final (C-1a)', () => {
  it('con las 3 columnas: cada una imprime SU propia fecha, no la de hoy ni la de otra', () => {
    const p = mapCaseToPlaceholders(
      makeCase({
        concFechaSolicitud: new Date('2026-03-01T12:00:00.000Z'),
        concFechaCitacion: new Date('2026-04-10T12:00:00.000Z'),
        concFechaDesistimiento: new Date('2026-05-20T12:00:00.000Z'),
      }),
    );

    expect(p.DIA_SOLICITUD).toBe('1');
    expect(p.MES_SOLICITUD).toBe('marzo');
    expect(p.ANO_SOLICITUD).toBe('2026');
    expect(p.FECHA_SOLICITUD).toBe('1 de marzo de 2026');

    expect(p.DIA_CITACION).toBe('10');
    expect(p.MES_CITACION).toBe('abril');
    expect(p.ANO_CITACION).toBe('2026');

    expect(p.DIA_DESISTIMIENTO).toBe('20');
    expect(p.MES_DESISTIMIENTO).toBe('mayo');
    expect(p.ANO_DESISTIMIENTO).toBe('2026');
  });

  it('sin ninguna de las 3: blanco visible para llenar a mano, nunca la fecha de hoy', () => {
    const p = mapCaseToPlaceholders(makeCase());

    expect(p.DIA_SOLICITUD).toBe('____');
    expect(p.MES_SOLICITUD).toBe('____________');
    expect(p.ANO_SOLICITUD).toBe('______');
    expect(p.FECHA_SOLICITUD).toBe('____ de ____________ de ______');

    expect(p.DIA_CITACION).toBe('____');
    expect(p.MES_CITACION).toBe('____________');
    expect(p.ANO_CITACION).toBe('______');

    expect(p.DIA_DESISTIMIENTO).toBe('____');
    expect(p.MES_DESISTIMIENTO).toBe('____________');
    expect(p.ANO_DESISTIMIENTO).toBe('______');
  });

  it('acepta las 3 como string ISO (así llegan de una server action, igual que failureDate)', () => {
    const p = mapCaseToPlaceholders(
      makeCase({
        concFechaSolicitud: '2026-07-04T15:00:00.000Z',
      }),
    );

    expect(p.DIA_SOLICITUD).toBe('4');
    expect(p.MES_SOLICITUD).toBe('julio');
    expect(p.ANO_SOLICITUD).toBe('2026');
  });

  it('el día en Colombia (UTC-5) es independiente de la hora UTC guardada: mediodía UTC es el ancla de parseDateOnly y no cambia de día', () => {
    // El mismo caso de prueba que fija parseDateOnly: mediodía UTC del 1 de
    // marzo son las 7:00 a.m. en Bogotá — mismo día de calendario.
    const p = mapCaseToPlaceholders(
      makeCase({ concFechaSolicitud: new Date('2026-03-01T12:00:00.000Z') }),
    );

    expect(p.DIA_SOLICITUD).toBe('1');
    expect(p.MES_SOLICITUD).toBe('marzo');
    expect(p.ANO_SOLICITUD).toBe('2026');
  });

  it('cambio de año en hora de Colombia: 31/dic 22:00 no salta a enero (mismo caso que DIA_FRACASO)', () => {
    // 2026-01-01T03:00Z == 2025-12-31 22:00 en Bogotá.
    const p = mapCaseToPlaceholders(
      makeCase({ concFechaDesistimiento: new Date('2026-01-01T03:00:00Z') }),
    );

    expect(p.DIA_DESISTIMIENTO).toBe('31');
    expect(p.MES_DESISTIMIENTO).toBe('diciembre');
    expect(p.ANO_DESISTIMIENTO).toBe('2025');
  });
});
