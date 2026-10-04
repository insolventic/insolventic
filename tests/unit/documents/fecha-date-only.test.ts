/**
 * El corrimiento de un día de TODA fecha tecleada por el operador.
 *
 * Hallazgo T1 de `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`: de las 61
 * fechas cargadas en 8 expedientes sintéticos, el día correcto no apareció en
 * ninguno de los 195 PDF generados — solo el día anterior.
 *
 * NO es el bug de PR #46. Aquel era una DOBLE conversión en `nowColombia()`,
 * solo sobre la fecha de hoy y solo entre las 00:00 y las 04:59 COT. Este es la
 * otra mitad, la que #46 declaró correcta y dejó sin tocar: una sola conversión,
 * sí, pero aplicada sobre un instante que ya venía mal anclado. Pasa SIEMPRE, a
 * cualquier hora, con cualquier fecha.
 *
 * Por qué ninguna suite lo veía: el golden master congela `admissionDate` en
 * `2026-02-20T15:00:00Z` —mediodía, no medianoche—, que es justo el único tipo
 * de instante que NO se corre. Los tests de `format.ts` hacían lo mismo.
 */

import {
  parseDateOnly,
  isDateOnlyInstant,
  displayTimeZone,
} from '@/lib/date-colombia';
import {
  formatDate,
  formatShortDate,
  getDayNumber,
  getMonthName,
  getYear,
  formatDateComplete,
} from '@/features/document/placeholders/format';

describe('parseDateOnly — anclaje de las fechas sin hora del formulario', () => {
  it('ancla "YYYY-MM-DD" al mediodía UTC, no a la medianoche', () => {
    const d = parseDateOnly('2026-02-11')!;
    expect(d.toISOString()).toBe('2026-02-11T12:00:00.000Z');
  });

  it('el mediodía UTC preserva el día del calendario en Colombia', () => {
    const d = parseDateOnly('2026-02-11')!;
    expect(
      d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }),
    ).toBe('11/02/2026');
  });

  it('new Date() crudo —lo que había antes— cae en el día anterior', () => {
    // Deja escrito el mecanismo exacto del bug, para que nadie "simplifique"
    // parseDateOnly de vuelta a new Date().
    expect(
      new Date('2026-02-11').toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }),
    ).toBe('10/02/2026');
  });

  it('respeta un ISO con hora: si trae hora no es una fecha-sin-hora', () => {
    const d = parseDateOnly('2026-02-20T15:00:00Z')!;
    expect(d.toISOString()).toBe('2026-02-20T15:00:00.000Z');
  });

  it('devuelve null para vacío, nulo e inválido', () => {
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('   ')).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('no es una fecha')).toBeNull();
  });

  it('deja pasar un Date ya construido', () => {
    const original = new Date('2026-02-20T15:00:00Z');
    expect(parseDateOnly(original)).toBe(original);
  });

  it.each([
    ['2024-02-29', '2024-02-29T12:00:00.000Z'], // bisiesto
    ['2026-03-01', '2026-03-01T12:00:00.000Z'], // cambio de mes
    ['2026-01-01', '2026-01-01T12:00:00.000Z'], // cambio de año
    ['2025-12-31', '2025-12-31T12:00:00.000Z'],
  ])('ancla bien los bordes: %s', (input, expected) => {
    expect(parseDateOnly(input)!.toISOString()).toBe(expected);
  });
});

describe('isDateOnlyInstant / displayTimeZone — compatibilidad con filas viejas', () => {
  it('reconoce la medianoche UTC exacta (lo que guardó el código viejo)', () => {
    expect(isDateOnlyInstant(new Date('2026-02-11T00:00:00.000Z'))).toBe(true);
  });

  it('no confunde un instante real con una fecha-sin-hora', () => {
    expect(isDateOnlyInstant(new Date('2026-02-11T12:00:00.000Z'))).toBe(false);
    expect(isDateOnlyInstant(new Date('2026-02-11T00:00:00.001Z'))).toBe(false);
    expect(isDateOnlyInstant(new Date('2026-02-11T00:00:01.000Z'))).toBe(false);
  });

  it('lee las filas viejas en UTC y las nuevas en hora de Colombia', () => {
    expect(displayTimeZone(new Date('2026-02-11T00:00:00.000Z'))).toBe('UTC');
    expect(displayTimeZone(new Date('2026-02-11T12:00:00.000Z'))).toBe(
      'America/Bogota',
    );
  });
});

describe('format.ts — el día impreso es el día cargado', () => {
  // Las dos formas en que una misma fecha puede estar hoy en la base:
  //   nueva  → mediodía UTC (parseDateOnly)
  //   vieja  → medianoche UTC (new Date("YYYY-MM-DD") del código anterior)
  const nueva = parseDateOnly('2026-02-11')!;
  const vieja = new Date('2026-02-11T00:00:00.000Z');

  describe.each([
    ['fila nueva (mediodía UTC)', nueva],
    ['fila vieja (medianoche UTC)', vieja],
  ])('%s', (_label, fecha) => {
    it('formatDate imprime el 11 de febrero', () => {
      expect(formatDate(fecha)).toBe('11 de febrero de 2026');
    });

    it('formatShortDate imprime 11/02/2026', () => {
      expect(formatShortDate(fecha)).toBe('11/02/2026');
    });

    it('getDayNumber imprime 11', () => {
      expect(getDayNumber(fecha)).toBe('11');
    });

    it('getMonthName imprime febrero', () => {
      expect(getMonthName(fecha)).toBe('febrero');
    });

    it('getYear imprime 2026', () => {
      expect(getYear(fecha)).toBe('2026');
    });

    it('formatDateComplete imprime la fecha en palabras', () => {
      expect(formatDateComplete(fecha)).toBe('11 de febrero de 2026');
    });
  });

  it('un instante real sigue leyéndose en hora de Colombia', () => {
    // 2026-02-12 02:00 UTC = 2026-02-11 21:00 COT → el día correcto es el 11.
    expect(formatShortDate(new Date('2026-02-12T02:00:00.000Z'))).toBe(
      '11/02/2026',
    );
  });

  it.each([
    ['2024-03-01', '01/03/2024', 'cruzaba al 29 de febrero bisiesto'],
    ['2025-03-01', '01/03/2025', 'cruzaba al 28 de febrero'],
    ['2026-01-01', '01/01/2026', 'cruzaba al 31 de diciembre del año anterior'],
  ])('borde %s → %s (antes %s)', (iso, esperado) => {
    expect(formatShortDate(parseDateOnly(iso)!)).toBe(esperado);
    // y la fila vieja equivalente también
    expect(formatShortDate(new Date(`${iso}T00:00:00.000Z`))).toBe(esperado);
  });
});
