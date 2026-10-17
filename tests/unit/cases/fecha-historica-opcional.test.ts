/**
 * `fechaHistoricaOpcional` — C-1a (auditoría del formulario de conciliación,
 * 2026-10-12). Valida las fechas reales de solicitud/citación/desistimiento
 * que llegan del `<input type="date">` del formulario.
 *
 * Por qué hace falta este validador y no basta con `z.string().optional()` +
 * `parseDateOnly` en el servidor: `parseDateOnly` (`src/lib/date-colombia.ts`)
 * **no** valida el calendario — su regex acepta cualquier
 * `\d{4}-\d{2}-\d{2}` y deja que `Date.UTC` resuelva un "2026-02-31"
 * corriéndolo en silencio al 3 de marzo. Es el comportamiento correcto para
 * *leer* una fecha ya guardada; acá hace falta *rechazar* una fecha
 * imposible en la entrada, antes de guardarla — y rechazar cualquier fecha
 * del futuro, porque las tres son hechos que ya ocurrieron.
 */

import { createCaseSchema } from '@/features/case/schemas';

// El validador no se exporta aparte para los tests; se ejercita a través de
// un campo real del schema (concFechaSolicitud), que es exactamente cómo lo
// usa la action.
const campo = createCaseSchema.shape.concFechaSolicitud;

function valida(valor: unknown) {
  return campo.safeParse(valor).success;
}

describe('fechaHistoricaOpcional (vía createCaseSchema.concFechaSolicitud)', () => {
  describe('vacío / ausente', () => {
    it('acepta undefined', () => expect(valida(undefined)).toBe(true));
    it('acepta null', () => expect(valida(null)).toBe(true));
    it('acepta cadena vacía', () => expect(valida('')).toBe(true));
    it('acepta solo espacios', () => expect(valida('   ')).toBe(true));
  });

  describe('fechas válidas, pasadas', () => {
    it('acepta una fecha pasada normal', () => {
      expect(valida('2026-03-15')).toBe(true);
    });
    it('acepta un año bisiesto, 29 de febrero', () => {
      expect(valida('2024-02-29')).toBe(true);
    });
    it('acepta el último día de un mes de 31', () => {
      expect(valida('2026-01-31')).toBe(true);
    });
    it('acepta el último día de un mes de 30', () => {
      expect(valida('2026-04-30')).toBe(true);
    });
  });

  describe('fechas imposibles — rechazadas, no corregidas en silencio', () => {
    it('rechaza el 31 de febrero (parseDateOnly lo correría al 3 de marzo)', () => {
      expect(valida('2026-02-31')).toBe(false);
    });
    it('rechaza el 29 de febrero en un año NO bisiesto', () => {
      expect(valida('2025-02-29')).toBe(false);
    });
    it('rechaza el 31 de abril (abril tiene 30 días)', () => {
      expect(valida('2026-04-31')).toBe(false);
    });
    it('rechaza el mes 13', () => {
      expect(valida('2026-13-01')).toBe(false);
    });
    it('rechaza el día 0', () => {
      expect(valida('2026-03-00')).toBe(false);
    });
  });

  describe('formato', () => {
    it('rechaza una fecha con hora (no es lo que manda un <input type="date">)', () => {
      expect(valida('2026-03-15T10:00:00Z')).toBe(false);
    });
    it('rechaza formato DD/MM/YYYY', () => {
      expect(valida('15/03/2026')).toBe(false);
    });
    it('rechaza texto libre', () => {
      expect(valida('quince de marzo')).toBe(false);
    });
  });

  describe('no puede ser del futuro', () => {
    it('rechaza una fecha claramente futura', () => {
      expect(valida('2099-01-01')).toBe(false);
    });

    it('acepta la fecha de HOY en Colombia', () => {
      const hoyColombia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      expect(valida(hoyColombia)).toBe(true);
    });

    it('rechaza mañana (en Colombia)', () => {
      const mananaUTC = new Date();
      mananaUTC.setUTCDate(mananaUTC.getUTCDate() + 2); // +2 para no chocar con el borde de huso horario
      const mananaColombia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(mananaUTC);
      expect(valida(mananaColombia)).toBe(false);
    });
  });
});
