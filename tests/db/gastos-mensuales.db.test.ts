/**
 * Gastos mensuales por concepto contra Postgres REAL.
 *
 * Lo que el mock de Prisma no puede ver: que la columna JSONB
 * `gastos_mensuales_detalle` exista (la crea la migración
 * 20261125000000_case_gastos_mensuales_detalle), que el detalle se guarde y se
 * lea con la forma esperada, que vaciar el bloque deje la columna en NULL de
 * verdad (`Prisma.DbNull`), y que un caso viejo —solo con las 7 columnas
 * agregadas— siga resolviendo su gasto y conserve sus columnas intactas al
 * editarlo.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { createCase, getCaseById, updateCase } from '@/features/case/actions';
import {
  createCaseFormSchema,
  updateCaseFormSchema,
} from '@/features/case/schemas';
import {
  MENSAJE_PESOS_ENTEROS,
  entradaGastosDesdeCaso,
  leerDetalleGuardado,
  resolverGastosDelCaso,
} from '@/features/case/gastos-mensuales';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import {
  asCaseWithRelations,
  fetchCaseForGeneration,
} from '@/features/document/persistence';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';

const TAG = `gastos-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '' };

const GASTOS = {
  conceptos: {
    ARRIENDO: { valor: '900.000' },
    LUZ: { valor: '85.000' },
    IMPUESTOS: { valor: '1.200.000' },
    MATRICULA: { valor: '2.400.000', periodicidad: 'UNIVERSIDAD' },
  },
  otros: [{ concepto: 'Gas', valor: '45.000' }],
};
const TOTAL = 900_000 + 85_000 + 100_000 + 400_000 + 45_000;

const PAYLOAD_BASE = () => ({
  debtorId: ctx.debtorId,
  operatorId: ctx.userId,
  type: 'INSOLVENCY' as const,
  totalDebt: '45200000',
  creditors: 1,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['SOBREENDEUDAMIENTO'],
  filingDate: '2026-03-04',
  monthlyIncome: 1800000,
  monthlyExpenses: 1450000,
  debts: [
    {
      creditor: 'Banco Falabella S.A.',
      type: 'TARJETA_CREDITO',
      interestRate: '2.35',
      capitalAmount: '41200000',
      interestAmount: '4000000',
    },
  ],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
});

async function crear(overrides: Record<string, unknown> = {}) {
  const parsed = createCaseFormSchema.parse({
    ...PAYLOAD_BASE(),
    ...overrides,
  }) as Record<string, unknown>;
  return createCase(wizardSubmit(parsed) as never);
}

async function placeholdersDe(caseId: string) {
  const caso = await fetchCaseForGeneration(caseId, ctx.tenantId);
  return mapCaseToPlaceholders(asCaseWithRelations(caso!));
}

const sinNbsp = (t: string) => t.replace(/ /g, ' ');

beforeEach(() => {
  _resetRateLimitStore();
});

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG);
  ctx.tenantId = tenant.tenantId;
  ctx.userId = tenant.userId;
  mockCookies.setToken('access-token', tenant.token);

  const debtor = await prisma.debtor.create({
    data: {
      name: 'Luz Dary Ospina Cárdenas',
      idNumber: `G-${TAG}`,
      idType: 'CC',
      email: `deudor-${TAG}@correoejemplo.test`,
      phone: '3104455667',
      address: 'Calle 10 # 4-21',
      city: 'Pereira',
      department: 'Risaralda',
      occupation: 'Docente',
      monthlyIncome: 1800000,
      monthlyExpenses: 1450000,
      totalDebt: 0,
      activeCases: 0,
      maritalStatus: 'Soltero(a)',
      tenantId: ctx.tenantId,
    },
  });
  ctx.debtorId = debtor.id;
});

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('alta con gastos por concepto', () => {
  let caseId = '';

  it('crea el caso', async () => {
    const r = await crear({ gastosMensuales: GASTOS });
    expect(r.error).toBeUndefined();
    caseId = r.data!.id;
  });

  it('Postgres guardó el detalle calculado y el total', async () => {
    const fila = await prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: {
        gastosMensualesDetalle: true,
        totalGastosMensuales: true,
        gastosVivienda: true,
        serviciosManutencion: true,
      },
    });
    const detalle = leerDetalleGuardado(fila.gastosMensualesDetalle);
    expect(detalle?.total).toBe(TOTAL);
    expect(detalle?.conceptos.find((l) => l.clave === 'MATRICULA')).toEqual({
      clave: 'MATRICULA',
      valor: 2400000,
      periodicidad: 'UNIVERSIDAD',
      divisor: 6,
      mensual: 400000,
    });
    expect(Number(fila.totalGastosMensuales)).toBe(TOTAL);
    // Las columnas viejas y el widget eliminado ya no se escriben.
    expect(fila.gastosVivienda).toBeNull();
    expect(fila.serviciosManutencion).toBeNull();
  });

  it('el deudor quedó con el total calculado como gasto mensual', async () => {
    const d = await prisma.debtor.findUniqueOrThrow({
      where: { id: ctx.debtorId },
    });
    expect(Number(d.monthlyExpenses)).toBe(TOTAL);
  });

  it('recargar el caso devuelve los mismos valores al formulario', async () => {
    const { data } = await getCaseById(caseId);
    const entrada = entradaGastosDesdeCaso(data!);
    expect(entrada.conceptos.ARRIENDO.valor).toBe('900.000');
    expect(entrada.conceptos.MATRICULA).toEqual({
      valor: '2.400.000',
      periodicidad: 'UNIVERSIDAD',
    });
    expect(entrada.otros).toEqual([{ concepto: 'Gas', valor: '45.000' }]);
  });

  it('los documentos usan el total guardado', async () => {
    const p = await placeholdersDe(caseId);
    expect(sinNbsp(p.GASTOS_MENSUALES)).toBe(
      `$ ${TOTAL.toLocaleString('es-CO')}`,
    );
    expect(p.GASTOS_DETALLE_TABLA).toContain('Matrícula');
  });

  it('editar con otro valor recalcula; vaciar el bloque deja NULL de verdad', async () => {
    const { data } = await getCaseById(caseId);
    const base = { id: caseId, version: data!.version, debtorId: ctx.debtorId };

    const r1 = await updateCase(
      updateCaseFormSchema.parse({
        ...base,
        type: 'INSOLVENCY',
        creditors: 1,
        gastosMensuales: { conceptos: { ARRIENDO: { valor: '1.000.000' } } },
      }) as never,
    );
    expect(r1.error).toBeUndefined();
    let fila = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(Number(fila.totalGastosMensuales)).toBe(1_000_000);

    const r2 = await updateCase(
      updateCaseFormSchema.parse({
        ...base,
        version: fila.version,
        type: 'INSOLVENCY',
        creditors: 1,
        gastosMensuales: { conceptos: {}, otros: [] },
      }) as never,
    );
    expect(r2.error).toBeUndefined();
    fila = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(fila.gastosMensualesDetalle).toBeNull();
    expect(fila.totalGastosMensuales).toBeNull();
  });
});

describe('borde del servidor', () => {
  it('un decimal real se rechaza con "pesos enteros" y no crea nada', async () => {
    const antes = await prisma.case.count({
      where: { tenantId: ctx.tenantId },
    });
    await expect(
      crear({
        gastosMensuales: { conceptos: { AGUA: { valor: '1.500,50' } } },
      }),
    ).rejects.toThrow(MENSAJE_PESOS_ENTEROS);
    expect(await prisma.case.count({ where: { tenantId: ctx.tenantId } })).toBe(
      antes,
    );
  });
});

describe('caso anterior al detalle (solo las 7 columnas)', () => {
  let caseId = '';

  beforeAll(async () => {
    const r = await crear();
    caseId = r.data!.id;
    // Simula un caso creado antes de la migración.
    await prisma.case.update({
      where: { id: caseId },
      data: {
        gastosVivienda: 800000,
        gastosAlimentacion: 600000,
        gastosServiciosPublicos: 250000,
        gastosTransporte: 300000,
        gastosEducacion: 400000,
        gastosSalud: 150000,
        otrosGastos: 300000,
      },
    });
  });

  it('se resuelve con la suma de las 7 columnas, no con el gasto del deudor', async () => {
    const { data } = await getCaseById(caseId);
    expect(resolverGastosDelCaso(data!)).toMatchObject({
      origen: 'CAMPOS_LEGADOS',
      total: 2_800_000,
    });
    const p = await placeholdersDe(caseId);
    expect(sinNbsp(p.GASTOS_MENSUALES)).toBe('$ 2.800.000');
    expect(p.GASTOS_DETALLE_TABLA).toContain('Servicios públicos (histórico)');
  });

  it('guardar la precarga del formulario conserva el total y no toca las columnas viejas', async () => {
    const { data } = await getCaseById(caseId);
    const r = await updateCase(
      updateCaseFormSchema.parse({
        id: caseId,
        version: data!.version,
        debtorId: ctx.debtorId,
        type: 'INSOLVENCY',
        creditors: 1,
        gastosMensuales: entradaGastosDesdeCaso(data!),
      }) as never,
    );
    expect(r.error).toBeUndefined();
    const fila = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(Number(fila.totalGastosMensuales)).toBe(2_800_000);
    expect(leerDetalleGuardado(fila.gastosMensualesDetalle)?.total).toBe(
      2_800_000,
    );
    expect(Number(fila.gastosVivienda)).toBe(800000);
    expect(Number(fila.otrosGastos)).toBe(300000);
  });
});
