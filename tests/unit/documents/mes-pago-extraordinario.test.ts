/**
 * La cuota extraordinaria se captura en TEXTO LIBRE, y el documento tiene que
 * imprimir algo legible pase lo que pase.
 *
 * `Case.extraordinaryPaymentDate` es `String?`: el asistente lo pide con un
 * input de texto y el operador escribe lo que diga el acuerdo. El propio
 * botón de datos de prueba propone «Diciembre de cada año», que no es una
 * fecha. El mapper hacía `getMonthName(new Date(valor))` sin comprobar nada,
 * así que esos valores salían impresos como **`Invalid Date`** en la tabla de
 * la propuesta de pago de la Solicitud de Insolvencia, al lado de la fecha
 * (auditoría 2026-10-27).
 *
 * Lo que se fija acá: vacío sigue vacío, una fecha se formatea como mes, y
 * cualquier otro texto se imprime tal cual. Nunca `Invalid Date`.
 */

import {
  mapPaymentProposal,
  mesDelPagoExtraordinario,
} from '@/features/document/placeholders/tablas-dinamicas-pagos';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

type Row = Record<string, unknown>;

const casoCon = (valor: unknown): never => {
  const base = SCENARIOS['insolvencia-completa'].build() as Row;
  return { ...base, extraordinaryPaymentDate: valor } as never;
};

describe('mesDelPagoExtraordinario', () => {
  describe('texto que no es una fecha: se imprime tal cual', () => {
    const textos = [
      'Diciembre de cada año',
      'Cada diciembre',
      'Al recibir la prima',
      'Primas de junio y diciembre',
      'N/A',
    ];

    for (const texto of textos) {
      it(`«${texto}» sale literal`, () => {
        expect(mesDelPagoExtraordinario(texto)).toBe(texto);
      });
    }
  });

  describe('fechas reales: se formatea el mes', () => {
    it('una fecha sin hora da su mes en español', () => {
      expect(mesDelPagoExtraordinario('2026-12-15')).toBe('diciembre');
    });

    it('el mes sale del día anclado, no del día anterior', () => {
      // `new Date('2026-03-01')` es medianoche UTC, que en Colombia son las
      // 19:00 del 28 de febrero. Sin anclar, el mes salía «febrero».
      expect(mesDelPagoExtraordinario('2026-03-01')).toBe('marzo');
    });

    it('un ISO completo también se formatea', () => {
      expect(mesDelPagoExtraordinario('2026-07-20T15:00:00Z')).toBe('julio');
    });
  });

  describe('vacío sigue vacío', () => {
    for (const vacio of ['', '   ', null, undefined]) {
      it(`${JSON.stringify(vacio)} da cadena vacía`, () => {
        expect(mesDelPagoExtraordinario(vacio)).toBe('');
      });
    }
  });

  it('nunca devuelve Invalid Date', () => {
    const entradas = [
      'Diciembre de cada año',
      'cuando se pueda',
      '31/02/2026',
      'xxx',
      '2026-12-15',
      '',
    ];
    for (const entrada of entradas) {
      expect(mesDelPagoExtraordinario(entrada)).not.toMatch(/Invalid Date/);
    }
  });
});

describe('PROP_EXTRA_MES en el mapper', () => {
  it('el valor que propone el asistente ya no imprime Invalid Date', () => {
    // Es exactamente el literal de create-case-dialog.tsx.
    const map = mapPaymentProposal(casoCon('Diciembre de cada año'));
    expect(map.PROP_EXTRA_MES).toBe('Diciembre de cada año');
    expect(map.PROP_EXTRA_MES).not.toBe('Invalid Date');
  });

  it('con una fecha real imprime el mes', () => {
    const map = mapPaymentProposal(casoCon('2026-12-01'));
    expect(map.PROP_EXTRA_MES).toBe('diciembre');
  });

  it('la fecha cruda sigue saliendo por su propio placeholder', () => {
    const map = mapPaymentProposal(casoCon('Diciembre de cada año'));
    expect(map.PROP_EXTRA_FECHA).toBe('Diciembre de cada año');
  });

  it('sin valor, los dos placeholders quedan vacíos', () => {
    const map = mapPaymentProposal(casoCon(null));
    expect(map.PROP_EXTRA_FECHA).toBe('');
    expect(map.PROP_EXTRA_MES).toBe('');
  });
});
