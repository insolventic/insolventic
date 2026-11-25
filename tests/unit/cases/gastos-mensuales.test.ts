/**
 * Cálculo de gastos mensuales: catálogo, lectura de pesos enteros, divisores,
 * redondeo half-up y total como suma de equivalentes ya redondeados.
 */
import {
  CONCEPTOS_GASTO,
  GRUPOS_GASTO,
  MAX_OTROS_GASTOS,
  MENSAJE_PESOS_ENTEROS,
  MENSAJE_VALOR_INVALIDO,
  MENSAJE_VALOR_NEGATIVO,
  calcularGastos,
  conceptoPorClave,
  entradaGastosVacia,
  equivalenteMensual,
  leerPesosEnteros,
  pesosAlSalir,
  pesosMientrasEscribe,
  totalEnVivo,
  type EntradaGastos,
} from '@/features/case/gastos-mensuales';

function detalleOk(entrada: EntradaGastos) {
  const r = calcularGastos(entrada);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.detalle;
}

describe('catálogo de conceptos', () => {
  it('tiene los 20 conceptos fijos en el orden pedido', () => {
    expect(CONCEPTOS_GASTO.map((c) => c.etiqueta)).toEqual([
      'Arriendo',
      'Administración (propiedad horizontal)',
      'Agua',
      'Luz',
      'Teléfono',
      'Internet',
      'Alimentos',
      'Elementos de aseo',
      'Onces hijos',
      'Salud',
      'Medicamentos',
      'Pensión (aporte/costo)',
      'Seguros',
      'Educación',
      'Pensión colegio',
      'Uniformes',
      'Matrícula',
      'Manutención padres',
      'Transporte',
      'Impuestos',
    ]);
  });

  it('los grupos aparecen en el orden del catálogo', () => {
    const orden = GRUPOS_GASTO.map((g) => g.id);
    const vistos = [...new Set(CONCEPTOS_GASTO.map((c) => c.grupo))];
    expect(vistos).toEqual(orden.filter((g) => g !== 'OTROS'));
  });

  it('los divisores son los acordados', () => {
    const divisores = (clave: string) =>
      conceptoPorClave(clave)!.periodicidades.map((p) => [p.id, p.divisor]);
    expect(divisores('IMPUESTOS')).toEqual([['ANUAL', 12]]);
    expect(divisores('UNIFORMES')).toEqual([['ANUAL', 12]]);
    expect(divisores('MATRICULA')).toEqual([
      ['COLEGIO', 12],
      ['UNIVERSIDAD', 6],
    ]);
    const prorrateados = new Set(['IMPUESTOS', 'UNIFORMES', 'MATRICULA']);
    for (const c of CONCEPTOS_GASTO) {
      if (!prorrateados.has(c.clave)) {
        expect(c.periodicidades.map((p) => p.divisor)).toEqual([1]);
      }
    }
  });
});

describe('leerPesosEnteros', () => {
  it.each([
    ['1234567', 1234567],
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['$ 1.234.567', 1234567],
    ['1.234', 1234],
    ['1,234', 1234],
    ['0', 0],
    ['1.234.567,00', 1234567],
    ['1,234,567.00', 1234567],
    ['1234.0', 1234],
    [2500000, 2500000],
    [0, 0],
  ])('%p → %p', (entrada, esperado) => {
    expect(leerPesosEnteros(entrada)).toEqual({
      tipo: 'valor',
      valor: esperado,
    });
  });

  it.each(['', '   ', null, undefined])('%p es vacío', (entrada) => {
    expect(leerPesosEnteros(entrada)).toEqual({ tipo: 'vacio' });
  });

  it.each(['1.234,50', '1234.5', '1,5', '1.5', '1,234,567.89', 1234.5])(
    '%p tiene decimales reales → pesos enteros',
    (entrada) => {
      expect(leerPesosEnteros(entrada)).toEqual({
        tipo: 'error',
        mensaje: MENSAJE_PESOS_ENTEROS,
      });
    },
  );

  it.each(['-500', '-1.000', -1])('%p es negativo', (entrada) => {
    expect(leerPesosEnteros(entrada)).toEqual({
      tipo: 'error',
      mensaje: MENSAJE_VALOR_NEGATIVO,
    });
  });

  it.each([
    'abc',
    '12a',
    '1.2.3',
    '1.234,567,8',
    '1..000',
    NaN,
    Infinity,
    '99999999999999999999',
  ])('%p no es numérico', (entrada) => {
    expect(leerPesosEnteros(entrada)).toEqual({
      tipo: 'error',
      mensaje: MENSAJE_VALOR_INVALIDO,
    });
  });

  it('los mensajes de decimales y de inválido hablan de pesos enteros', () => {
    expect(MENSAJE_PESOS_ENTEROS).toMatch(/pesos enteros/);
    expect(MENSAJE_VALOR_INVALIDO).toMatch(/pesos enteros/);
  });
});

describe('equivalenteMensual (half-up, entero)', () => {
  it.each([
    [1200000, 1, 1200000],
    [1200000, 12, 100000],
    [100, 12, 8], // 8,33
    [6, 12, 1], // 0,5 → sube
    [5, 12, 0], // 0,416
    [150, 12, 13], // 12,5 → sube
    [3, 6, 1], // 0,5 → sube
    [1000001, 6, 166667], // 166.666,83
    [0, 12, 0],
  ])('%p ÷ %p = %p', (valor, divisor, esperado) => {
    expect(equivalenteMensual(valor, divisor)).toBe(esperado);
  });

  it('rechaza valores o divisores imposibles', () => {
    expect(() => equivalenteMensual(-1, 1)).toThrow(RangeError);
    expect(() => equivalenteMensual(1.5, 1)).toThrow(RangeError);
    expect(() => equivalenteMensual(1, 0)).toThrow(RangeError);
  });
});

describe('calcularGastos', () => {
  it('sin ningún valor devuelve detalle null (cae a la cadena legada)', () => {
    expect(calcularGastos(entradaGastosVacia())).toEqual({
      ok: true,
      detalle: null,
    });
    expect(calcularGastos(undefined)).toEqual({ ok: true, detalle: null });
    expect(calcularGastos({ otros: [{ concepto: '', valor: '' }] })).toEqual({
      ok: true,
      detalle: null,
    });
  });

  it('todo en cero sí es un detalle, con total 0', () => {
    const d = detalleOk({ conceptos: { ARRIENDO: { valor: '0' } } });
    expect(d).toEqual({
      version: 1,
      conceptos: [
        {
          clave: 'ARRIENDO',
          valor: 0,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 0,
        },
      ],
      otros: [],
      total: 0,
    });
  });

  it('prorratea impuestos, uniformes y matrícula, y suma los ya redondeados', () => {
    const d = detalleOk({
      conceptos: {
        ARRIENDO: { valor: '1.000.000' },
        IMPUESTOS: { valor: '100' }, // 8,33 → 8
        UNIFORMES: { valor: '150' }, // 12,5 → 13
        MATRICULA: { valor: '3', periodicidad: 'UNIVERSIDAD' }, // 0,5 → 1
      },
    })!;
    expect(d.conceptos.map((l) => [l.clave, l.divisor, l.mensual])).toEqual(
      [
        ['UNIFORMES', 12, 13],
        ['MATRICULA', 6, 1],
        ['ARRIENDO', 1, 1000000],
        ['IMPUESTOS', 12, 8],
      ].sort((a, b) => order(a[0] as string) - order(b[0] as string)),
    );
    // 100+150+3 = 253 de valores prorrateados, cuyo ÷ exacto sumaría 21,33+0,5;
    // el total es la suma de los redondeados: 1.000.000 + 8 + 13 + 1.
    expect(d.total).toBe(1000022);
  });

  it('matrícula: Colegio ÷ 12 por defecto, Universidad ÷ 6', () => {
    const colegio = detalleOk({
      conceptos: { MATRICULA: { valor: '1.200.000' } },
    })!;
    expect(colegio.conceptos[0]).toMatchObject({
      periodicidad: 'COLEGIO',
      divisor: 12,
      mensual: 100000,
    });
    const uni = detalleOk({
      conceptos: {
        MATRICULA: { valor: '1.200.000', periodicidad: 'UNIVERSIDAD' },
      },
    })!;
    expect(uni.conceptos[0]).toMatchObject({
      periodicidad: 'UNIVERSIDAD',
      divisor: 6,
      mensual: 200000,
    });
  });

  it('rechaza una periodicidad que el concepto no admite', () => {
    const r = calcularGastos({
      conceptos: { ARRIENDO: { valor: '1', periodicidad: 'UNIVERSIDAD' } },
    });
    expect(r).toEqual({
      ok: false,
      errores: [
        {
          ruta: ['conceptos', 'ARRIENDO', 'periodicidad'],
          mensaje: expect.any(String),
        },
      ],
    });
  });

  it('rechaza conceptos desconocidos', () => {
    const r = calcularGastos({
      conceptos: { GAS: { valor: '1' } } as EntradaGastos['conceptos'],
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza negativos y decimales, con la ruta del campo', () => {
    const r = calcularGastos({
      conceptos: { AGUA: { valor: '-5' }, LUZ: { valor: '1.234,5' } },
      otros: [{ concepto: 'Gas', valor: '12.5' }],
    });
    expect(r).toEqual({
      ok: false,
      errores: [
        {
          ruta: ['conceptos', 'AGUA', 'valor'],
          mensaje: MENSAJE_VALOR_NEGATIVO,
        },
        { ruta: ['conceptos', 'LUZ', 'valor'], mensaje: MENSAJE_PESOS_ENTEROS },
        { ruta: ['otros', 0, 'valor'], mensaje: MENSAJE_PESOS_ENTEROS },
      ],
    });
  });

  it('ignora total, divisor y equivalente enviados por el cliente', () => {
    const entrada = {
      conceptos: { IMPUESTOS: { valor: '1.200', divisor: 1, mensual: 1200 } },
      total: 999999,
    } as unknown as EntradaGastos;
    const d = detalleOk(entrada)!;
    expect(d.conceptos[0]).toMatchObject({ divisor: 12, mensual: 100 });
    expect(d.total).toBe(100);
  });

  describe('Otros', () => {
    it('solo "Otros": el total es la suma de sus filas', () => {
      const d = detalleOk({
        otros: [
          { concepto: 'Gas', valor: '45.000' },
          { concepto: '  Cuota de manejo  ', valor: '12,000' },
        ],
      })!;
      expect(d.conceptos).toEqual([]);
      expect(d.otros).toEqual([
        { concepto: 'Gas', valor: 45000, mensual: 45000 },
        { concepto: 'Cuota de manejo', valor: 12000, mensual: 12000 },
      ]);
      expect(d.total).toBe(57000);
    });

    it('exige concepto si hay valor', () => {
      expect(
        calcularGastos({ otros: [{ concepto: ' ', valor: '1.000' }] }),
      ).toEqual({
        ok: false,
        errores: [
          {
            ruta: ['otros', 0, 'concepto'],
            mensaje: 'Escriba el concepto del gasto',
          },
        ],
      });
    });

    it('una fila con concepto y sin valor se guarda en 0', () => {
      const d = detalleOk({ otros: [{ concepto: 'Gas', valor: '' }] })!;
      expect(d.otros).toEqual([{ concepto: 'Gas', valor: 0, mensual: 0 }]);
    });

    it('acepta el máximo de filas y rechaza una más', () => {
      const filas = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          concepto: `Gasto ${i + 1}`,
          valor: '1.000',
        }));
      const d = detalleOk({ otros: filas(MAX_OTROS_GASTOS) })!;
      expect(d.total).toBe(MAX_OTROS_GASTOS * 1000);
      expect(calcularGastos({ otros: filas(MAX_OTROS_GASTOS + 1) }).ok).toBe(
        false,
      );
    });

    it('rechaza un concepto de más de 120 caracteres', () => {
      expect(
        calcularGastos({ otros: [{ concepto: 'x'.repeat(121), valor: '1' }] })
          .ok,
      ).toBe(false);
      expect(
        calcularGastos({ otros: [{ concepto: 'x'.repeat(120), valor: '1' }] })
          .ok,
      ).toBe(true);
    });
  });

  it('totalEnVivo coincide con el total del servidor', () => {
    const entrada: EntradaGastos = {
      conceptos: {
        ARRIENDO: { valor: '1.000.000' },
        IMPUESTOS: { valor: '100' },
        UNIFORMES: { valor: '150' },
        MATRICULA: { valor: '3', periodicidad: 'UNIVERSIDAD' },
      },
      otros: [{ concepto: 'Gas', valor: '1,234' }],
    };
    expect(totalEnVivo(entrada)).toBe(detalleOk(entrada)!.total);
  });

  it('totalEnVivo ignora lo inválido en vez de mostrar NaN', () => {
    expect(
      totalEnVivo({
        conceptos: { AGUA: { valor: 'abc' }, LUZ: { valor: '1.000' } },
      }),
    ).toBe(1000);
  });
});

function order(clave: string): number {
  return CONCEPTOS_GASTO.findIndex((c) => c.clave === clave);
}

describe('pesosMientrasEscribe / pesosAlSalir', () => {
  it.each([
    ['1', '', '1'],
    ['1234', '123', '1.234'],
    ['1.2345', '1.234', '12.345'],
    ['1.23', '1.234', '123'], // borrar un dígito
    ['', '1', ''],
  ])('solo dígitos: %p (antes %p) → %p', (nuevo, anterior, esperado) => {
    expect(pesosMientrasEscribe(nuevo, anterior)).toBe(esperado);
  });

  it.each([
    ['1,234', '1'], // coma: se deja tal cual hasta salir
    ['1.500.', '1.500'], // punto escrito a mano
    ['1.500.5', '1.500.'], // sigue en modo texto
    ['-5', ''],
    ['12a', '12'],
  ])('no reinterpreta %p mientras se escribe', (nuevo, anterior) => {
    expect(pesosMientrasEscribe(nuevo, anterior)).toBe(nuevo);
  });

  it.each([
    ['1,234,567', '1.234.567'],
    ['1234567', '1.234.567'],
    ['1.234,00', '1.234'],
    ['1500.50', '1500.50'],
    ['abc', 'abc'],
    ['', ''],
  ])('al salir: %p → %p', (texto, esperado) => {
    expect(pesosAlSalir(texto)).toBe(esperado);
  });
});
