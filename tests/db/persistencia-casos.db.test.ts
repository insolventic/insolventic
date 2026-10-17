/**
 * Las cuatro formas en que la persistencia de un expediente se rompía sin que
 * ningún test lo viera.
 *
 * Son pruebas de UN campo a la vez: cada una parte de un payload que ya se sabe
 * que funciona y le agrega exactamente una cosa, de modo que el resultado es
 * atribuible a esa cosa y no a la combinación. Así se aislaron los cuatro
 * hallazgos críticos de `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`.
 *
 * Todas necesitan Prisma REAL: los tests que mockean el cliente nunca ven un
 * `NaN` rechazado, una fecha que la base no acepta, ni una transacción que no
 * revierte.
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
import { createCase, updateCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';

const TAG = `persist-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '' };

const DEUDA_BASE = {
  creditor: 'Banco Falabella S.A.',
  type: 'TARJETA_CREDITO',
  interestRate: '2.35',
  capitalAmount: '41200000',
  interestAmount: '4000000',
};

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
  debts: [DEUDA_BASE],
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

const contarCasos = () =>
  prisma.case.count({ where: { tenantId: ctx.tenantId } });
const contarDeudas = () =>
  prisma.debt.count({ where: { tenantId: ctx.tenantId } });

// GC-B2: `createCase` ahora tiene rate limit (10 por usuario cada 10 minutos)
// y el limitador in-memory guarda estado por PROCESO. `test:db` corre
// --runInBand, asi que todas las suites comparten proceso, y esta crea mas de
// 10 expedientes entre sus bloques: sin reiniciar la ventana, los ultimos
// fallaban con "Demasiadas creaciones" y el error no tenia nada que ver con lo
// que se estaba probando.
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
      name: 'Yeison Alberto Mosquera Córdoba',
      idNumber: `P-${TAG}`,
      idType: 'CC',
      email: `deudor-${TAG}@correoejemplo.test`,
      phone: '3209981177',
      address: 'Carrera 48 # 22-14 Barrio Belén',
      city: 'Medellín',
      department: 'Antioquia',
      occupation: 'Mensajero motorizado',
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

describe('control', () => {
  it('el payload base se crea sin problemas', async () => {
    const result = await crear();
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});

describe('fechas del formulario que la action tiene que convertir', () => {
  // Las tres últimas se quedaron fuera de la lista de conversión y viajaban
  // como string a una columna DateTime: Prisma respondía "premature end of
  // input. Expected ISO-8601 DateTime" y la creación entera fallaba.
  it.each([
    ['admissionDate'],
    ['filingDate'],
    ['paymentStartDate'],
    ['agreementValidityDate'],
    ['failureDate'],
  ])('%s se guarda como Date, con el día que se cargó', async (campo) => {
    const result = await crear({ [campo]: '2026-04-10' });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const fila = (await prisma.case.findUniqueOrThrow({
      where: { id: result.data!.id },
    })) as unknown as Record<string, Date | null>;

    const guardada = fila[campo];
    expect(guardada).toBeInstanceOf(Date);
    // El día en hora de Colombia tiene que seguir siendo el 10.
    expect(
      guardada!.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }),
    ).toBe('10/04/2026');
  });
});

describe('las casillas "Desconozco" del formulario de acreedores', () => {
  it.each([
    ['interestRate', 'interestRateUnknown'],
    ['grantDate', 'grantDateUnknown'],
    ['dueDate', 'dueDateUnknown'],
  ])('%s = DESCONOZCO crea el caso y marca %s', async (campo, bandera) => {
    const result = await crear({
      debts: [{ ...DEUDA_BASE, [campo]: 'DESCONOZCO' }],
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const debt = (await prisma.debt.findFirstOrThrow({
      where: { caseId: result.data!.id },
    })) as unknown as Record<string, unknown>;

    expect(debt[bandera]).toBe(true);
  });

  it('una deuda normal no queda marcada como desconocida', async () => {
    const result = await crear();
    const debt = (await prisma.debt.findFirstOrThrow({
      where: { caseId: result.data!.id },
    })) as unknown as Record<string, unknown>;

    expect(debt.interestRateUnknown).toBe(false);
    expect(debt.grantDateUnknown).toBe(false);
    expect(debt.dueDateUnknown).toBe(false);
  });
});

describe('la creación del expediente es atómica', () => {
  it('si una deuda falla, no queda ni el caso ni las deudas anteriores', async () => {
    const casosAntes = await contarCasos();
    const deudasAntes = await contarDeudas();

    const result = await crear({
      debts: [
        DEUDA_BASE,
        // `creditorId` inexistente: viola la FK al insertar la SEGUNDA deuda,
        // cuando la primera ya entró.
        { ...DEUDA_BASE, creditorId: 'no-existe-este-acreedor' },
      ],
    });

    expect(result.success).toBe(false);
    // Antes quedaba el expediente con su número de radicado consumido y cero
    // acreedores; si el operador reintentaba, creaba otro.
    expect(await contarCasos()).toBe(casosAntes);
    expect(await contarDeudas()).toBe(deudasAntes);
  });
});

describe('pre-generation-form: los dos envíos exactos de la pantalla', () => {
  // `pre-generation-form.tsx` manda solo { id } más los campos del paquete: ni
  // `debtorId`, ni `operatorId`, ni `version`. El `connect` incondicional de
  // `updateCase` hacía fallar el Paquete 2, y la fecha sin convertir el 3.
  let caseId = '';

  beforeAll(async () => {
    const result = await crear();
    caseId = result.data!.id;
  });

  it('Paquete 2 — Admisión: tres fechas, sin ids', async () => {
    const result = await updateCase({
      id: caseId,
      filingDate: '2026-02-11',
      designationDate: '2026-02-18',
      positionAcceptanceDate: '2026-02-20',
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const fila = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(fila.filingDate).toBeInstanceOf(Date);
    expect(fila.designationDate).toBeInstanceOf(Date);
    expect(fila.positionAcceptanceDate).toBeInstanceOf(Date);
  });

  it('Paquete 3 — Acuerdo: porcentaje y vigencia, sin ids', async () => {
    const result = await updateCase({
      id: caseId,
      approvalPercentage: 72.5,
      agreementValidityDate: '2031-04-10',
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const fila = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    // Las dos condiciones que `documents-section.tsx` exige para dejar generar
    // el Paquete 3. Mientras la vigencia no se podía guardar, el botón volvía a
    // abrir el mismo formulario indefinidamente.
    expect(fila.approvalPercentage).not.toBeNull();
    expect(fila.agreementValidityDate).toBeInstanceOf(Date);
  });
});
