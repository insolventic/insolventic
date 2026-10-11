/**
 * El separador de miles no puede corromper el valor guardado.
 *
 * EL BUG QUE ESTO FIJA. El schema traía 54 copias de
 *
 *     parseFloat(val.replace(/[^0-9.-]/g, ''))
 *
 * y ese strip **conserva el punto**, así que `"1.500.000"` daba `1.5`. Mientras
 * los campos de dinero fueron `<input type="number">` el bug era inalcanzable
 * —el navegador no deja escribir el punto—, pero el pedido de mostrar
 * separador de miles obliga a pasarlos a `type="text"`, y ahí el punto llega al
 * schema. Un gasto de millón y medio se habría guardado como un peso cincuenta,
 * y ese número alimenta la hoja "Ingresos y Gastos" del Excel y el cálculo de
 * capacidad de pago.
 *
 * Los casos de abajo son el bug exacto, no una aproximación: el primer bloque
 * falla con el parseo viejo y pasa con el nuevo.
 */

import { z } from 'zod';

import {
  formatearMientrasEscribe,
  formatearMonto,
  parsearMonto,
} from '@/features/case/monto';
import { montoOpcional, montoRequerido } from '@/features/case/schemas';

/** El parseo viejo, tal cual estaba, para comparar contra él. */
const parseoViejo = (val: string) =>
  val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined;

describe('1. REGRESIÓN: el valor con separador de miles se guarda entero', () => {
  const CASOS: Array<[string, number]> = [
    ['1.500.000', 1_500_000],
    ['1.500', 1_500],
    ['250.000', 250_000],
    ['12.345.678', 12_345_678],
    ['999', 999],
    ['1.000.000.000', 1_000_000_000],
  ];

  it.each(CASOS)('%s se lee como %i', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(CASOS.filter(([t]) => t.includes('.')))(
    'y el parseo VIEJO lo rompía: %s',
    (texto, esperado) => {
      // Si este test empieza a fallar es que alguien "arregló" el parseo viejo
      // o cambió el caso: el punto de este bloque es demostrar que el bug era
      // real, no suponerlo.
      expect(parseoViejo(texto)).not.toBe(esperado);
    },
  );

  it('el caso que más duele, explícito', () => {
    expect(parseoViejo('1.500.000')).toBe(1.5);
    expect(parsearMonto('1.500.000')).toBe(1_500_000);
  });
});

describe('2. la regla punto/coma', () => {
  it('con coma, la coma es el decimal y los puntos son miles', () => {
    expect(parsearMonto('1.500.000,50')).toBe(1_500_000.5);
    expect(parsearMonto('1.234,56')).toBe(1_234.56);
    expect(parsearMonto('0,99')).toBe(0.99);
  });

  it('sin coma y en grupos de tres exactos, son miles', () => {
    expect(parsearMonto('1.500')).toBe(1_500);
    expect(parsearMonto('12.345')).toBe(12_345);
  });

  it('COMPATIBILIDAD: el punto decimal viejo de step="0.01" se sigue leyendo', () => {
    // Los valores que ya están guardados y los que produce un input numérico
    // viejo vienen así. No pueden cambiar de significado.
    expect(parsearMonto('1234.56')).toBe(1_234.56);
    expect(parsearMonto('0.01')).toBe(0.01);
    expect(parsearMonto('1.5')).toBe(1.5);
    expect(parsearMonto('12.75')).toBe(12.75);
  });

  it('un número pasa tal cual (los 3 campos con valueAsNumber)', () => {
    expect(parsearMonto(1_500_000)).toBe(1_500_000);
    expect(parsearMonto(0)).toBe(0);
  });

  it('vacío es undefined y NO cero: "no lo cargué" ≠ "cargué cero"', () => {
    expect(parsearMonto('')).toBeUndefined();
    expect(parsearMonto('   ')).toBeUndefined();
    expect(parsearMonto(null)).toBeUndefined();
    expect(parsearMonto(undefined)).toBeUndefined();
    expect(parsearMonto(0)).toBe(0);
  });

  it('tolera el adorno que se pega al copiar y pegar', () => {
    expect(parsearMonto('$ 1.500.000')).toBe(1_500_000);
    expect(parsearMonto(' 1.500.000 ')).toBe(1_500_000);
  });
});

describe('3. ida y vuelta: formatear y volver a leer no mueve el número', () => {
  const VALORES = [0, 1, 999, 1_500, 250_000, 1_500_000, 12_345_678, 1_234.56];

  it.each(VALORES)('%p sobrevive al viaje', (n) => {
    expect(parsearMonto(formatearMonto(n))).toBe(n);
  });

  it('formatea con puntos y sin decimales cuando son enteros', () => {
    expect(formatearMonto(1_500_000)).toBe('1.500.000');
    expect(formatearMonto(250_000)).toBe('250.000');
    expect(formatearMonto(999)).toBe('999');
  });

  it('formatea los decimales con coma', () => {
    expect(formatearMonto(1_234.56)).toBe('1.234,56');
  });

  it('vacío y NaN se muestran vacíos, no como "NaN"', () => {
    expect(formatearMonto('')).toBe('');
    expect(formatearMonto(null)).toBe('');
    expect(formatearMonto('abc')).toBe('');
  });
});

describe('4. el schema valida DESPUÉS de parsear', () => {
  const schema = z.object({ monto: montoOpcional() });

  it('guarda el entero completo, no el truncado', () => {
    expect(schema.parse({ monto: '1.500.000' })).toEqual({ monto: 1_500_000 });
  });

  it('acepta vacío como undefined', () => {
    expect(schema.parse({ monto: '' })).toEqual({ monto: undefined });
  });

  it('RECHAZA negativos — antes se colaban por la rama string', () => {
    // El `.min(0)` vivía solo en la rama numérica de la unión, y 23 de los 26
    // campos de dinero llegan como string: en la práctica no tenían mínimo.
    expect(schema.safeParse({ monto: '-500' }).success).toBe(false);
    expect(schema.safeParse({ monto: -500 }).success).toBe(false);
  });

  it('RECHAZA basura en vez de guardar NaN en silencio', () => {
    // La salida de un `.transform()` no se re-valida: antes un `NaN` pasaba.
    expect(schema.safeParse({ monto: 'abc' }).success).toBe(false);
  });

  it('montoRequerido exige el dato y conserva el mensaje', () => {
    const req = z.object({ total: montoRequerido('La deuda total es requerida') });
    expect(req.parse({ total: '1.500.000' })).toEqual({ total: 1_500_000 });
    const fallo = req.safeParse({ total: '' });
    expect(fallo.success).toBe(false);
    if (!fallo.success) {
      expect(JSON.stringify(fallo.error.issues)).toContain(
        'La deuda total es requerida',
      );
    }
  });
});

describe('5. formateo mientras se escribe', () => {
  it('agrupa de a tres a medida que crece el número', () => {
    expect(formatearMientrasEscribe('1')).toBe('1');
    expect(formatearMientrasEscribe('15')).toBe('15');
    expect(formatearMientrasEscribe('1500')).toBe('1.500');
    expect(formatearMientrasEscribe('1500000')).toBe('1.500.000');
  });

  it('no pelea con quien está escribiendo un decimal', () => {
    // Estados intermedios que un formateo ingenuo destruiría.
    expect(formatearMientrasEscribe('1500,')).toBe('1.500,');
    expect(formatearMientrasEscribe('1500,5')).toBe('1.500,5');
    expect(formatearMientrasEscribe('1500,50')).toBe('1.500,50');
  });

  it('descarta lo que no es un monto en vez de dejarlo entrar', () => {
    expect(formatearMientrasEscribe('1a5b0c0')).toBe('1.500');
    expect(formatearMientrasEscribe('')).toBe('');
  });

  it('lo que se escribe se lee de vuelta igual', () => {
    for (const tecleado of ['1500000', '250000', '1500,50', '999']) {
      const enPantalla = formatearMientrasEscribe(tecleado);
      expect(parsearMonto(enPantalla)).toBe(
        Number(tecleado.replace(',', '.')),
      );
    }
  });
});
