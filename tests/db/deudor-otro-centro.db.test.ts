/**
 * Un expediente no puede quedar enlazado al deudor de OTRO centro.
 *
 * `updateCase` escribía `debtor: { connect: { id: debtorId } }` sin comprobar
 * el tenant, y el `connect` de Prisma solo exige que el id exista: la action
 * devolvía `success` y el expediente quedaba apuntando a un deudor ajeno.
 * Es la misma clase de hueco que GC-M2 cerró para el operador.
 *
 * Necesita Prisma REAL: con el cliente mockeado el `connect` siempre "funciona"
 * y la pertenencia al tenant, que la impone la consulta, no se ve.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/server', () => ({ after: jest.fn() }));
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
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `deudor-cruzado-${Date.now().toString(36)}`;
const INGRESO_ORIGINAL = 1800000;

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;
let deudorA: string;
let otroDeudorA: string;
let deudorB: string;
let casoA: string;

async function crearDeudor(tenantId: string, sufijo: string): Promise<string> {
  const deudor = await prisma.debtor.create({
    data: {
      name: `Deudor ${sufijo}`,
      idNumber: `${TAG}-${sufijo}`,
      idType: 'CC',
      email: `deudor-${sufijo}-${TAG}@correoejemplo.test`,
      phone: '3209981177',
      address: 'Carrera 48 # 22-14',
      city: 'Medellín',
      department: 'Antioquia',
      occupation: 'Mensajero motorizado',
      monthlyIncome: INGRESO_ORIGINAL,
      totalDebt: 0,
      activeCases: 0,
      maritalStatus: 'Soltero(a)',
      tenantId,
    },
  });
  return deudor.id;
}

/** Todo lo que una escritura colada dejaría en cualquiera de los dos centros. */
async function huella() {
  const [caso, casosA, casosB, deudorAjeno, auditoria, notificaciones] =
    await Promise.all([
      prisma.case.findUniqueOrThrow({
        where: { id: casoA },
        select: { debtorId: true, creditors: true, version: true },
      }),
      prisma.case.count({ where: { tenantId: centroA.tenantId } }),
      prisma.case.count({ where: { tenantId: centroB.tenantId } }),
      prisma.debtor.findUniqueOrThrow({
        where: { id: deudorB },
        select: { monthlyIncome: true, activeCases: true, totalDebt: true },
      }),
      prisma.auditLog.count({ where: { tenantId: centroA.tenantId } }),
      prisma.notification.count({ where: { tenantId: centroA.tenantId } }),
    ]);

  return {
    caso,
    casosA,
    casosB,
    deudorAjeno: {
      monthlyIncome: Number(deudorAjeno.monthlyIncome),
      activeCases: deudorAjeno.activeCases,
      totalDebt: Number(deudorAjeno.totalDebt),
    },
    auditoria,
    notificaciones,
  };
}

function payloadDeCreacion(debtorId: string) {
  const parsed = createCaseFormSchema.parse({
    debtorId,
    operatorId: centroA.userId,
    type: 'INSOLVENCY',
    totalDebt: '45200000',
    creditors: 1,
    phase: 'Inicial',
    caseNumber: '',
    hearingDate: null,
    causes: ['SOBREENDEUDAMIENTO'],
    filingDate: '2026-03-04',
    monthlyIncome: 1900000,
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
  }) as Record<string, unknown>;
  return wizardSubmit(parsed) as never;
}

beforeAll(async () => {
  centroA = await crearTenantDePrueba(TAG);
  centroB = await crearTenantDePrueba(`${TAG}-b`);
  mockCookies.setToken('access-token', centroA.token);

  deudorA = await crearDeudor(centroA.tenantId, 'a');
  otroDeudorA = await crearDeudor(centroA.tenantId, 'a2');
  deudorB = await crearDeudor(centroB.tenantId, 'b');

  const caso = await prisma.case.create({
    data: {
      caseNumber: `${TAG}-1`,
      debtorName: 'Deudor a',
      type: 'INSOLVENCY',
      totalDebt: 1000,
      creditors: 1,
      phase: 'Inicial',
      debtorId: deudorA,
      operatorId: centroA.userId,
      tenantId: centroA.tenantId,
    } as never,
  });
  casoA = caso.id;
});

beforeEach(() => {
  _resetRateLimitStore();
});

afterAll(async () => {
  await purgeTenant(centroA.tenantId);
  await purgeTenant(centroB.tenantId);
  await prisma.$disconnect();
});

describe('updateCase con un debtorId que no es de este centro', () => {
  it('rechaza el deudor de otro centro sin escribir nada', async () => {
    const antes = await huella();

    const result = await updateCase({
      id: casoA,
      debtorId: deudorB,
      creditors: 99,
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no pertenece a este centro/i);
    expect(await huella()).toEqual(antes);
  });

  it('rechaza también si el payload trae datos del deudor, y no los escribe', async () => {
    // Esta forma ya fallaba, pero por accidente: el `tx.debtor.update` acotado
    // por tenant no encontraba la fila. Sin el guard, lo que la protege es que
    // el payload traiga un campo de ingresos.
    const antes = await huella();

    const result = await updateCase({
      id: casoA,
      debtorId: deudorB,
      monthlyIncome: 1900000,
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no pertenece a este centro/i);
    expect(await huella()).toEqual(antes);
  });

  it('rechaza un id que no existe en ningún centro con el mismo mensaje', async () => {
    const antes = await huella();

    const result = await updateCase({
      id: casoA,
      debtorId: 'id-que-no-existe',
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no pertenece a este centro/i);
    expect(await huella()).toEqual(antes);
  });

  // Controles: sin ellos, los rechazos de arriba pasarían igual si updateCase
  // estuviera fallando por cualquier otra razón.
  it('sigue aceptando otro deudor del mismo centro', async () => {
    const result = await updateCase({
      id: casoA,
      debtorId: otroDeudorA,
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const caso = await prisma.case.findUniqueOrThrow({
      where: { id: casoA },
      select: { debtorId: true },
    });
    expect(caso.debtorId).toBe(otroDeudorA);
  });

  it('sigue aceptando una edición sin debtorId (pre-generation-form)', async () => {
    const result = await updateCase({ id: casoA, creditors: 7 } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const caso = await prisma.case.findUniqueOrThrow({
      where: { id: casoA },
      select: { creditors: true },
    });
    expect(caso.creditors).toBe(7);
  });
});

describe('createCase con un debtorId que no es de este centro', () => {
  it('rechaza el deudor de otro centro sin escribir nada', async () => {
    const antes = await huella();

    const result = await createCase(payloadDeCreacion(deudorB));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Deudor no encontrado');
    expect(await huella()).toEqual(antes);
    expect(await prisma.debt.count({ where: { debtorId: deudorB } })).toBe(0);
  });

  it('sigue aceptando un deudor del propio centro', async () => {
    const result = await createCase(payloadDeCreacion(deudorA));

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
