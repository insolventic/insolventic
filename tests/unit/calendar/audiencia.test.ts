/**
 * La regla única de cuál es la audiencia de un caso. Antes cada pantalla elegía
 * entre `hearingDate` y `firstHearingDate`, y un caso reprogramado mostraba
 * fechas distintas según dónde se mirara.
 */

import {
  audienciaVigente,
  claveDia,
  diaDelMes,
  formatearAudiencia,
  hoyColombia,
  primeraAudiencia,
  whereAudienciaEntre,
} from '@/features/calendar/audiencia';
import { datosAudienciaSchema } from '@/features/calendar/schemas';

const MEDIODIA = (dia: string) => new Date(`${dia}T12:00:00.000Z`);

describe('audienciaVigente', () => {
  it('sin ninguna fecha no hay audiencia', () => {
    expect(audienciaVigente({})).toBeNull();
  });

  it('la reprogramada manda sobre la primera, con su propia hora', () => {
    const vigente = audienciaVigente({
      firstHearingDate: MEDIODIA('2026-11-05'),
      firstHearingTime: '09:00',
      hearingDate: MEDIODIA('2026-11-20'),
      hearingTime: '15:30',
    });
    expect(vigente?.fecha).toEqual(MEDIODIA('2026-11-20'));
    expect(vigente?.hora).toBe('15:30');
  });

  it('sin reprogramar, cae en la primera', () => {
    const vigente = audienciaVigente({
      firstHearingDate: MEDIODIA('2026-11-05'),
      firstHearingTime: '09:00',
    });
    expect(vigente?.fecha).toEqual(MEDIODIA('2026-11-05'));
    expect(vigente?.hora).toBe('09:00');
  });

  it('una fila vieja del mismo día toma la hora de la primera', () => {
    const dia = new Date('2025-02-14T00:00:00.000Z');
    expect(
      audienciaVigente({
        hearingDate: dia,
        firstHearingDate: dia,
        firstHearingTime: '10:00',
      })?.hora,
    ).toBe('10:00');
  });

  it('no le presta la hora de la primera a un día distinto', () => {
    expect(
      audienciaVigente({
        hearingDate: MEDIODIA('2026-11-20'),
        firstHearingDate: MEDIODIA('2026-11-05'),
        firstHearingTime: '09:00',
      })?.hora,
    ).toBeNull();
  });
});

describe('primeraAudiencia', () => {
  it('no cambia al reprogramar', () => {
    const primera = primeraAudiencia({
      firstHearingDate: MEDIODIA('2026-11-05'),
      firstHearingTime: '09:00',
      hearingDate: MEDIODIA('2026-11-20'),
      hearingTime: '15:30',
    });
    expect(primera?.fecha).toEqual(MEDIODIA('2026-11-05'));
    expect(primera?.hora).toBe('09:00');
  });
});

describe('whereAudienciaEntre', () => {
  it('la primera solo cuenta si no hay una vigente que la reemplace', () => {
    const desde = new Date('2026-10-01T00:00:00Z');
    const hasta = new Date('2026-10-31T23:59:59Z');
    const rango = { gte: desde, lte: hasta };
    expect(whereAudienciaEntre(desde, hasta)).toEqual({
      OR: [
        { hearingDate: rango },
        { AND: [{ hearingDate: null }, { firstHearingDate: rango }] },
      ],
    });
  });
});

describe('día de calendario', () => {
  it('una fecha nueva (mediodía UTC) es ese día', () => {
    expect(diaDelMes(MEDIODIA('2026-11-20'))).toBe(20);
  });

  it('una fila vieja (00:00 UTC) no retrocede al día anterior', () => {
    // En hora de Colombia ese instante es el 31 de octubre a las 19:00.
    expect(diaDelMes(new Date('2026-11-01T00:00:00.000Z'))).toBe(1);
  });

  it('el "hoy" de Colombia no se adelanta a las 19:00', () => {
    expect(hoyColombia(new Date('2026-11-03T00:30:00.000Z'))).toBe(
      '2026-11-02',
    );
  });

  it('claveDia devuelve YYYY-MM-DD', () => {
    expect(claveDia(MEDIODIA('2026-01-09'))).toBe('2026-01-09');
  });
});

describe('formatearAudiencia', () => {
  it('imprime la hora guardada', () => {
    expect(
      formatearAudiencia({ fecha: MEDIODIA('2026-11-20'), hora: '08:30' }),
    ).toBe('20/11/2026 a las 08:30');
  });

  it('sin hora no inventa una', () => {
    expect(
      formatearAudiencia({ fecha: MEDIODIA('2026-11-20'), hora: null }),
    ).toBe('20/11/2026');
  });

  it('sin audiencia queda vacío', () => {
    expect(formatearAudiencia(null)).toBe('');
  });
});

describe('datosAudienciaSchema', () => {
  it('acepta fecha y hora válidas', () => {
    expect(
      datosAudienciaSchema.safeParse({ fecha: '2026-11-20', hora: '08:30' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['fecha inexistente', { fecha: '2026-02-31', hora: '08:30' }],
    ['fecha sin formato', { fecha: 'no-es-fecha', hora: '08:30' }],
    ['fecha vacía', { fecha: '', hora: '08:30' }],
    ['hora inválida', { fecha: '2026-11-20', hora: 'hola' }],
    ['hora fuera de rango', { fecha: '2026-11-20', hora: '25:00' }],
    ['hora vacía', { fecha: '2026-11-20', hora: '' }],
  ])('rechaza %s', (_nombre, datos) => {
    expect(datosAudienciaSchema.safeParse(datos).success).toBe(false);
  });
});
