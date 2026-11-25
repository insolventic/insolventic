/**
 * Casos creados antes del detalle de gastos: mapeo de las 7 columnas viejas,
 * orden de resolución para documentos y precarga del formulario.
 */
import {
  ETIQUETA_OTROS_HISTORICO,
  ETIQUETA_SERVICIOS_HISTORICO,
  calcularGastos,
  detalleDesdeCamposLegados,
  entradaGastosDesdeCaso,
  leerDetalleGuardado,
  resolverGastosDelCaso,
} from '@/features/case/gastos-mensuales';

/** Imita un Decimal de Prisma. */
const dec = (n: number) => ({ toNumber: () => n, toString: () => String(n) });

const LEGADO_COMPLETO = {
  gastosVivienda: dec(800000),
  gastosAlimentacion: dec(600000),
  gastosServiciosPublicos: dec(250000),
  gastosTransporte: dec(300000),
  gastosEducacion: dec(400000),
  gastosSalud: dec(150000),
  otrosGastos: dec(300000),
};

describe('detalleDesdeCamposLegados', () => {
  it('mapea cada columna vieja a su concepto, y lo no desglosable a "Otros"', () => {
    expect(detalleDesdeCamposLegados(LEGADO_COMPLETO)).toEqual({
      version: 1,
      conceptos: [
        {
          clave: 'ARRIENDO',
          valor: 800000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 800000,
        },
        {
          clave: 'ALIMENTOS',
          valor: 600000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 600000,
        },
        {
          clave: 'SALUD',
          valor: 150000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 150000,
        },
        {
          clave: 'EDUCACION',
          valor: 400000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 400000,
        },
        {
          clave: 'TRANSPORTE',
          valor: 300000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 300000,
        },
      ],
      otros: [
        {
          concepto: ETIQUETA_SERVICIOS_HISTORICO,
          valor: 250000,
          mensual: 250000,
        },
        { concepto: ETIQUETA_OTROS_HISTORICO, valor: 300000, mensual: 300000 },
      ],
      total: 2800000,
    });
  });

  it('el total derivado es la suma de las 7 columnas (lo que mostraba el formulario)', () => {
    expect(detalleDesdeCamposLegados(LEGADO_COMPLETO)!.total).toBe(
      800000 + 600000 + 250000 + 300000 + 400000 + 150000 + 300000,
    );
  });

  it('acepta números y strings además de Decimal, y redondea centavos half-up', () => {
    const d = detalleDesdeCamposLegados({
      gastosVivienda: '1000.5',
      gastosSalud: 99.4,
    })!;
    expect(d.conceptos.map((l) => l.mensual)).toEqual([1001, 99]);
    expect(d.total).toBe(1100);
  });

  it('null si ninguna columna tiene valor > 0', () => {
    expect(detalleDesdeCamposLegados({})).toBeNull();
    expect(
      detalleDesdeCamposLegados({
        gastosVivienda: null,
        gastosSalud: dec(0),
        otrosGastos: '0',
      }),
    ).toBeNull();
  });

  it('el derivado cumple el schema de lo guardado', () => {
    const d = detalleDesdeCamposLegados(LEGADO_COMPLETO);
    expect(leerDetalleGuardado(d)).toEqual(d);
  });
});

describe('resolverGastosDelCaso', () => {
  const DETALLE = calcularGastos({
    conceptos: {
      ARRIENDO: { valor: '900.000' },
      IMPUESTOS: { valor: '1.200.000' },
    },
    otros: [{ concepto: 'Gas', valor: '40.000' }],
  });
  const detalle = DETALLE.ok ? DETALLE.detalle : null;

  it('1) el detalle guardado manda sobre todo lo demás', () => {
    const r = resolverGastosDelCaso({
      ...LEGADO_COMPLETO,
      gastosMensualesDetalle: detalle,
      monthlyExpenses: dec(1),
      debtor: { monthlyExpenses: dec(2) },
    });
    expect(r.origen).toBe('DETALLE');
    expect(r.total).toBe(900000 + 100000 + 40000);
    expect(r.lineas).toEqual([
      { grupo: 'VIVIENDA', etiqueta: 'Arriendo', mensual: 900000 },
      { grupo: 'IMPUESTOS', etiqueta: 'Impuestos', mensual: 100000 },
      { grupo: 'OTROS', etiqueta: 'Gas', mensual: 40000 },
    ]);
  });

  it('2) sin detalle, la suma de las 7 columnas aunque el deudor tenga otro monto', () => {
    const r = resolverGastosDelCaso({
      ...LEGADO_COMPLETO,
      debtor: { monthlyExpenses: dec(1234567) },
    });
    expect(r.origen).toBe('CAMPOS_LEGADOS');
    expect(r.total).toBe(2800000);
    expect(r.lineas).toHaveLength(7);
  });

  it('3) sin detalle ni columnas, Case.monthlyExpenses y después el del deudor', () => {
    expect(
      resolverGastosDelCaso({
        monthlyExpenses: dec(500000),
        debtor: { monthlyExpenses: dec(9) },
      }),
    ).toEqual({
      origen: 'MONTO_LEGADO',
      detalle: null,
      lineas: [],
      total: 500000,
    });
    expect(
      resolverGastosDelCaso({
        monthlyExpenses: null,
        debtor: { monthlyExpenses: dec(2750000) },
      }),
    ).toEqual({
      origen: 'MONTO_LEGADO',
      detalle: null,
      lineas: [],
      total: 2750000,
    });
    expect(resolverGastosDelCaso({})).toEqual({
      origen: 'MONTO_LEGADO',
      detalle: null,
      lineas: [],
      total: 0,
    });
  });

  it('un detalle corrupto en la base no rompe: cae a la cadena legada', () => {
    const r = resolverGastosDelCaso({
      gastosMensualesDetalle: { version: 1, conceptos: 'roto' },
      debtor: { monthlyExpenses: dec(100) },
    });
    expect(r).toMatchObject({ origen: 'MONTO_LEGADO', total: 100 });
  });

  it('omite de las líneas los conceptos en $0, pero no del total', () => {
    const cero = calcularGastos({
      conceptos: { ARRIENDO: { valor: '0' }, AGUA: { valor: '30.000' } },
      otros: [{ concepto: 'Gas', valor: '0' }],
    });
    const r = resolverGastosDelCaso({
      gastosMensualesDetalle: cero.ok ? cero.detalle : null,
    });
    expect(r.lineas).toEqual([
      { grupo: 'VIVIENDA', etiqueta: 'Agua', mensual: 30000 },
    ]);
    expect(r.total).toBe(30000);
  });
});

describe('entradaGastosDesdeCaso (precarga del formulario)', () => {
  it('un caso viejo se precarga con su mapeo legado', () => {
    const entrada = entradaGastosDesdeCaso(LEGADO_COMPLETO);
    expect(entrada.conceptos.ARRIENDO).toEqual({
      valor: '800.000',
      periodicidad: 'MENSUAL',
    });
    expect(entrada.conceptos.AGUA).toEqual({
      valor: '',
      periodicidad: 'MENSUAL',
    });
    expect(entrada.otros).toEqual([
      { concepto: ETIQUETA_SERVICIOS_HISTORICO, valor: '250.000' },
      { concepto: ETIQUETA_OTROS_HISTORICO, valor: '300.000' },
    ]);
  });

  it('guardar la precarga de un caso viejo conserva su total', () => {
    const r = calcularGastos(entradaGastosDesdeCaso(LEGADO_COMPLETO));
    expect(r.ok && r.detalle?.total).toBe(2800000);
  });

  it('un caso con detalle se precarga con el valor digitado (no el mensual) y su periodicidad', () => {
    const r = calcularGastos({
      conceptos: {
        MATRICULA: { valor: '3.000.000', periodicidad: 'UNIVERSIDAD' },
      },
    });
    const entrada = entradaGastosDesdeCaso({
      gastosMensualesDetalle: r.ok ? r.detalle : null,
    });
    expect(entrada.conceptos.MATRICULA).toEqual({
      valor: '3.000.000',
      periodicidad: 'UNIVERSIDAD',
    });
    expect(entrada.conceptos.IMPUESTOS).toEqual({
      valor: '',
      periodicidad: 'ANUAL',
    });
  });

  it('un caso sin nada se precarga vacío', () => {
    const entrada = entradaGastosDesdeCaso({});
    expect(entrada.otros).toEqual([]);
    expect(Object.values(entrada.conceptos).every((c) => c.valor === '')).toBe(
      true,
    );
  });
});
