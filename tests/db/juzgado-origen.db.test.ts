/**
 * Juzgado de origen de un proceso judicial contra Postgres REAL: la columna
 * "originCourt" existe (migración 20261126000000_legal_process_origin_court),
 * se guarda al crear el caso y es opcional; "court" sigue siendo el actual.
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
import { createCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';

const TAG = `juzgado-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '' };

const proceso = (extra: Record<string, unknown>) => ({
  processType: 'EJECUTIVO_SINGULAR',
  plaintiff: 'Banco de Prueba S.A.',
  court: 'Juzgado 5 Civil Municipal de Pereira',
  fileNumber: '66001-40-03-005-2025-00100',
  ...extra,
});

async function crear(legalProcesses: unknown[]) {
  const parsed = createCaseFormSchema.parse({
    debtorId: ctx.debtorId,
    operatorId: ctx.userId,
    type: 'INSOLVENCY',
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
    hasLegalProcesses: true,
    legalProcesses,
    apoderados: [],
  }) as Record<string, unknown>;
  return createCase(wizardSubmit(parsed) as never);
}

beforeEach(() => _resetRateLimitStore());

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG);
  ctx.tenantId = tenant.tenantId;
  ctx.userId = tenant.userId;
  mockCookies.setToken('access-token', tenant.token);
  const debtor = await prisma.debtor.create({
    data: {
      name: 'Rosa Elena Quintero',
      idNumber: `J-${TAG}`,
      idType: 'CC',
      email: `deudor-${TAG}@correoejemplo.test`,
      phone: '3001112233',
      address: 'Calle 1 # 2-3',
      city: 'Pereira',
      department: 'Risaralda',
      occupation: 'Comerciante',
      monthlyIncome: 1800000,
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

describe('juzgado de origen', () => {
  it('se guarda junto al actual', async () => {
    const r = await crear([
      proceso({ originCourt: '  Juzgado 1 Civil del Circuito de Pereira  ' }),
    ]);
    expect(r.error).toBeUndefined();
    const procesos = await prisma.legalProcess.findMany({
      where: { caseId: r.data!.id },
    });
    expect(procesos).toHaveLength(1);
    expect(procesos[0].court).toBe('Juzgado 5 Civil Municipal de Pereira');
    expect(procesos[0].originCourt).toBe(
      'Juzgado 1 Civil del Circuito de Pereira',
    );
  });

  it('es opcional: vacío queda NULL', async () => {
    const r = await crear([proceso({ originCourt: '' })]);
    expect(r.error).toBeUndefined();
    const [p] = await prisma.legalProcess.findMany({
      where: { caseId: r.data!.id },
    });
    expect(p.originCourt).toBeNull();
  });
});
