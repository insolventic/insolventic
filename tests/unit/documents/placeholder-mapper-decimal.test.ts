/**
 * Regresión: el mapper recibe `Prisma.Decimal`, no `number`.
 *
 * `Decimal.valueOf()` devuelve un STRING, así que `sum + a.value` concatena en
 * vez de sumar. `TOTAL_INMUEBLES`, `TOTAL_MUEBLES`, `TOTAL_BIENES` y los
 * `MUEBLE_*_VALOR` de "Solicitud de Insolvencia" salían con cifras absurdas
 * (un inmueble de $100M + un mueble de $500k daba $1.000.000.500.000) en todo
 * documento generado por la ruta automática, que le pasa al mapper la fila de
 * Prisma sin convertir (asCaseWithRelations).
 *
 * Por qué los tests anteriores no lo detectaron: fabricaban los activos con
 * `number`, que suma bien. Estos usan la clase real de Prisma, y además
 * comparan la salida COMPLETA del mapper entre un caso con `Decimal` y el mismo
 * caso con `number` (cualquier otra suma sin `Number()` haría diferir alguna
 * clave).
 */

import { Prisma } from '@prisma/client';

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';

const D = (value: number | string) => new Prisma.Decimal(value);

// El formato de moneda del mapper (es-CO, COP, sin decimales), sin depender de
// caracteres invisibles copiados a mano.
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

// ---------------------------------------------------------------------------
// Fixture genérico a partir del modelo Prisma real: cubre las ~270 columnas de
// Case y sus relaciones sin listar campo por campo (no se rompe si el schema
// cambia). Los campos Decimal salen como Prisma.Decimal o como number según el
// modo.
// ---------------------------------------------------------------------------

const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map((e) => [e.name, e]));

type Mode = 'decimal' | 'number';
type Row = Record<string, unknown>;

function buildRow(
  modelName: string,
  mode: Mode,
  seq: { n: number },
  depth = 0,
  overrides: Row = {},
): Row {
  const out: Row = {};
  for (const f of models.get(modelName)!.fields) {
    if (f.kind === 'object') {
      if (depth >= 1) continue;
      out[f.name] = f.isList
        ? [
            buildRow(f.type, mode, seq, depth + 1),
            buildRow(f.type, mode, seq, depth + 1),
          ]
        : buildRow(f.type, mode, seq, depth + 1);
      continue;
    }
    if (f.isList) {
      out[f.name] = [];
      continue;
    }
    seq.n += 1;
    if (f.kind === 'enum') out[f.name] = enums.get(f.type)!.values[0].name;
    else if (f.type === 'Decimal')
      out[f.name] =
        mode === 'decimal'
          ? D(1_000_000 * seq.n + 250_000)
          : 1_000_000 * seq.n + 250_000;
    else if (f.type === 'Int') out[f.name] = seq.n;
    else if (f.type === 'Float') out[f.name] = seq.n + 0.5;
    else if (f.type === 'Boolean') out[f.name] = true;
    else if (f.type === 'DateTime')
      out[f.name] = new Date('2026-03-15T12:00:00Z');
    else if (f.type === 'Json') out[f.name] = null;
    else out[f.name] = `${f.name}-${seq.n}`;
  }
  return { ...out, ...overrides };
}

type AssetSpec = { type: string; value: number | string | null };

/** Un caso completo. `assets` reemplaza los activos del fixture genérico. */
function makeCase(
  mode: Mode,
  opts: { type?: string; assets?: AssetSpec[] } = {},
): Row {
  const seq = { n: 0 };
  const c = buildRow('Case', mode, seq, 0, { type: opts.type ?? 'INSOLVENCY' });
  const asset = (a: AssetSpec) =>
    buildRow('Asset', mode, seq, 1, {
      type: a.type,
      value:
        a.value === null
          ? null
          : mode === 'decimal'
            ? D(a.value)
            : Number(a.value),
    });
  const specs: AssetSpec[] = opts.assets ?? [
    { type: 'INMUEBLE', value: 180_000_000 },
    { type: 'VEHICULO', value: 35_000_000 },
  ];
  c.assets = specs.map(asset);
  c.debts = [0, 1].map(() => ({
    ...buildRow('Debt', mode, seq, 1),
    creditor: { name: 'Banco X' },
  }));
  c.debtor = buildRow('Debtor', mode, seq, 1);
  c.operator = { id: 'op', name: 'Op', email: 'op@x.co' };
  c._count = { documents: 0 };
  c.causes = ['a', 'b'];
  c.applicantScope = ['x'];
  c.documents = [];
  return c;
}

const map = (c: Row) => mapCaseToPlaceholders(c as never);

beforeAll(() => {
  // El mapper usa la fecha de hoy (nowColombia): congelarla para comparar.
  jest.useFakeTimers({ now: new Date('2026-03-15T12:00:00Z') });
});
afterAll(() => {
  jest.useRealTimers();
});

describe('sanidad del fixture: usa Prisma.Decimal de verdad', () => {
  it('el modo decimal entrega instancias de Prisma.Decimal y valueOf() es un string', () => {
    const c = makeCase('decimal');
    const value = (c.assets as Row[])[0].value;
    expect(Prisma.Decimal.isDecimal(value)).toBe(true);
    // Esta es la raíz del bug: un Decimal NO se comporta como un número con `+`.
    expect(typeof (value as Prisma.Decimal).valueOf()).toBe('string');
    expect(0 + (value as unknown as number)).not.toBe(180_000_000);
  });
});

describe('totales de bienes con Prisma.Decimal (Solicitud de Insolvencia)', () => {
  it('1 inmueble + 1 vehículo (el caso de los 13 documentos afectados): $180M + $35M = $215M', () => {
    const p = map(makeCase('decimal'));

    expect(p.TOTAL_INMUEBLES).toBe(cop(180_000_000));
    expect(p.TOTAL_MUEBLES).toBe(cop(35_000_000));
    expect(p.TOTAL_BIENES).toBe(cop(215_000_000));
    expect(p.MUEBLE_VEHICULO_VALOR).toBe(cop(35_000_000));
  });

  it('1 inmueble y ningún mueble: TOTAL_BIENES no se multiplica por 10', () => {
    const p = map(
      makeCase('decimal', {
        assets: [{ type: 'INMUEBLE', value: 100_000_000 }],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(100_000_000));
    expect(p.TOTAL_MUEBLES).toBe(cop(0));
    expect(p.TOTAL_BIENES).toBe(cop(100_000_000));
  });

  it('solo muebles (sin inmuebles)', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'VEHICULO', value: 20_000_000 },
          { type: 'VEHICULO', value: 15_000_000 },
        ],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(0));
    expect(p.TOTAL_MUEBLES).toBe(cop(35_000_000));
    expect(p.TOTAL_BIENES).toBe(cop(35_000_000));
  });

  it('2 inmuebles: TOTAL_INMUEBLES suma en vez de concatenar', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'INMUEBLE', value: 100_000_000 },
          { type: 'INMUEBLE', value: 50_000_000 },
        ],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(150_000_000));
    expect(p.TOTAL_BIENES).toBe(cop(150_000_000));
  });

  it('REAL_ESTATE también cuenta como inmueble', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'REAL_ESTATE', value: 80_000_000 },
          { type: 'INMUEBLE', value: 20_000_000 },
        ],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(100_000_000));
  });

  it('varios inmuebles y varios muebles a la vez', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'INMUEBLE', value: 100_000_000 },
          { type: 'INMUEBLE', value: 50_000_000 },
          { type: 'VEHICULO', value: 20_000_000 },
          { type: 'ELECTRONICO', value: 5_000_000 },
        ],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(150_000_000));
    expect(p.TOTAL_MUEBLES).toBe(cop(25_000_000));
    expect(p.TOTAL_BIENES).toBe(cop(175_000_000));
  });

  it('activos con valor 0 o nulo no rompen la suma', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'INMUEBLE', value: 0 },
          { type: 'INMUEBLE', value: null },
          { type: 'VEHICULO', value: 12_000_000 },
        ],
      }),
    );

    expect(p.TOTAL_INMUEBLES).toBe(cop(0));
    expect(p.TOTAL_BIENES).toBe(cop(12_000_000));
  });

  it('valores con decimales se suman antes de redondear', () => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type: 'INMUEBLE', value: '1000.4' },
          { type: 'INMUEBLE', value: '1000.4' },
        ],
      }),
    );

    // 2000,8 -> $2.001 (redondear cada sumando daría $2.000).
    expect(p.TOTAL_INMUEBLES).toBe(cop(2001));
  });

  it.each([
    ['MUEBLE_ELECTRONICO_VALOR', 'ELECTRONICO'],
    ['MUEBLE_ENSERES_VALOR', 'MUEBLES'],
    ['MUEBLE_VEHICULO_VALOR', 'VEHICULO'],
    ['MUEBLE_JOYAS_VALOR', 'JOYAS'],
    ['MUEBLE_EFECTIVO_VALOR', 'EFECTIVO'],
    ['MUEBLE_ACCIONES_VALOR', 'ACCIONES'],
    ['MUEBLE_CUENTAS_VALOR', 'CUENTAS_POR_COBRAR'],
  ])('%s suma 2 activos de la categoría (%s)', (key, type) => {
    const p = map(
      makeCase('decimal', {
        assets: [
          { type, value: 7_000_000 },
          { type, value: 3_500_000 },
        ],
      }),
    );

    expect(p[key]).toBe(cop(10_500_000));
  });
});

describe('el mapper produce lo mismo con Prisma.Decimal que con number', () => {
  it.each(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'])(
    'caso %s: ninguna clave difiere',
    (type) => {
      const withDecimal = map(makeCase('decimal', { type }));
      const withNumber = map(makeCase('number', { type }));

      // No vacuo: el mapper emite cientos de claves. El piso bajo de 800 a 650
      // al retirar los ~200 slots numerados de acreedor (AC{n}_* y el cuadro
      // resumen) en el Paso 5 del plan de acreedores: esas claves ya no existen
      // porque las plantillas iteran ACREEDORES con {{#each}}.
      expect(Object.keys(withNumber).length).toBeGreaterThan(650);
      expect(Object.keys(withDecimal)).toEqual(Object.keys(withNumber));

      const distintas = Object.keys(withNumber).filter(
        (k) => withDecimal[k] !== withNumber[k],
      );
      expect(distintas).toEqual([]);
    },
  );
});
