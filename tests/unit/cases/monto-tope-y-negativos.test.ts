/**
 * F4 y F5 (auditoría 2026-10-27): ningún monto es negativo y ninguno supera
 * 10^15. Antes una deuda de −1 imprimía `TOTAL_ACREENCIAS = "-$ 3"` y un
 * ingreso de 1e21 imprimía dígitos de error de punto flotante.
 *
 * La regla vive en un solo helper (`monto-schemas.ts`); acá se comprueba que
 * la aplican los schemas de ENTRADA de casos, deudores y pagos, que son los
 * que corta el servidor.
 */
import {
  MENSAJE_MONTO_MAXIMO,
  MENSAJE_MONTO_NEGATIVO,
  MONTO_MAXIMO,
  problemaDeMonto,
} from '@/features/case/monto-schemas';
import {
  addAssetToCaseSchema,
  addDebtToCaseSchema,
  addLibranzaToCaseSchema,
  addSuspendedServiceToCaseSchema,
  assetSchema,
  createCaseFormSchema,
  debtSchema,
  libranzaSchema,
  suspendedServiceSchema,
} from '@/features/case/schemas';
import {
  createDebtorSchema,
  updateDebtorSchema,
} from '@/features/debtor/schemas';

const mensajes = (r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => (r.success ? [] : (r.error?.issues ?? []).map((i) => i.message));

const DEUDA = { creditor: 'Banco X', type: 'Hipotecaria', interestRate: '1' };
const BIEN = { type: 'Inmueble', description: 'Casa' };

describe('problemaDeMonto', () => {
  it.each([
    [0, null],
    [1_500_000, null],
    [MONTO_MAXIMO, null],
    [-1, MENSAJE_MONTO_NEGATIVO],
    [MONTO_MAXIMO + 1, MENSAJE_MONTO_MAXIMO],
    [1e21, MENSAJE_MONTO_MAXIMO],
  ])('%p → %p', (valor, esperado) => {
    expect(problemaDeMonto(valor)).toBe(esperado);
  });

  it('NaN e Infinity no son montos', () => {
    expect(problemaDeMonto(Number.NaN)).not.toBeNull();
    expect(problemaDeMonto(Infinity)).not.toBeNull();
  });
});

describe('montos que el schema guarda como texto', () => {
  it.each([
    ['capital de la deuda', debtSchema, { ...DEUDA, capitalAmount: '-1' }],
    ['intereses de la deuda', debtSchema, { ...DEUDA, interestAmount: '-1' }],
    ['valor del bien', assetSchema, { ...BIEN, value: '-5' }],
    ['suma descontada (libranza)', libranzaSchema, { deductedAmount: '-1' }],
    [
      'valor adeudado (servicio)',
      suspendedServiceSchema,
      { creditorName: 'EPM', amountOwed: '-1' },
    ],
    [
      'capital (agregar deuda)',
      addDebtToCaseSchema,
      { caseId: 'c', ...DEUDA, amount: '1', capitalAmount: '-1' },
    ],
    [
      'valor (agregar bien)',
      addAssetToCaseSchema,
      { caseId: 'c', ...BIEN, value: '-1' },
    ],
    [
      'suma descontada (agregar libranza)',
      addLibranzaToCaseSchema,
      { caseId: 'c', deductedAmount: '-1' },
    ],
    [
      'valor adeudado (agregar servicio)',
      addSuspendedServiceToCaseSchema,
      { caseId: 'c', creditorName: 'EPM', amountOwed: '-1' },
    ],
  ])('rechaza un negativo en %s', (_campo, schema, entrada) => {
    expect(mensajes(schema.safeParse(entrada))).toContain(
      MENSAJE_MONTO_NEGATIVO,
    );
  });

  it('rechaza un monto por encima del tope y uno ilegible', () => {
    expect(
      mensajes(debtSchema.safeParse({ ...DEUDA, capitalAmount: '1e21' })),
    ).toContain(MENSAJE_MONTO_MAXIMO);
    expect(
      mensajes(debtSchema.safeParse({ ...DEUDA, capitalAmount: 'abc' })),
    ).not.toEqual([]);
  });

  it('acepta montos normales, con separador de miles, y el campo vacío opcional', () => {
    const r = debtSchema.safeParse({
      ...DEUDA,
      capitalAmount: '1.500.000',
      interestAmount: '',
    });
    expect(mensajes(r)).not.toContain(MENSAJE_MONTO_NEGATIVO);
    expect(mensajes(r)).not.toContain(MENSAJE_MONTO_MAXIMO);
    expect(r.success).toBe(true);
  });

  it('el valor del bien sigue siendo obligatorio', () => {
    expect(mensajes(assetSchema.safeParse({ ...BIEN, value: '' }))).toContain(
      'El valor es requerido',
    );
  });
});

describe('montos del formulario maestro (montoOpcional / montoRequerido)', () => {
  it('rechazan el negativo y el monto fuera de tope', () => {
    const base = createCaseFormSchema.safeParse({
      monthlyIncome: '-1',
      totalDebt: '1e21',
    });
    const porCampo = Object.fromEntries(
      (base.success ? [] : base.error.issues).map((i) => [
        String(i.path[0]),
        i.message,
      ]),
    );
    expect(porCampo.monthlyIncome).toBe(MENSAJE_MONTO_NEGATIVO);
    expect(porCampo.totalDebt).toBe(MENSAJE_MONTO_MAXIMO);
  });
});

describe('montos que ya llegan como número', () => {
  it('ingresos y gastos del deudor', () => {
    const alta = createDebtorSchema.safeParse({ monthlyIncome: -1 });
    expect(mensajes(alta)).toContain(MENSAJE_MONTO_NEGATIVO);
    const edicion = updateDebtorSchema.safeParse({ monthlyExpenses: 1e21 });
    expect(mensajes(edicion)).toContain(MENSAJE_MONTO_MAXIMO);
  });
});
