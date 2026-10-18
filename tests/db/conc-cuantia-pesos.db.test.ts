/**
 * `concCuantiaPesos` (Conciliación): ciclo crear → editar → leer contra
 * Postgres REAL, con un monto en coma decimal — el formato que escribe
 * `MoneyInput` y que antes de este fix el mapper leía con `Number()` directo,
 * dando `NaN` y, en el documento, "$ 0" en silencio (ver
 * `tests/unit/documents/conciliacion-cuantia-pesos.test.ts` para el mapper en
 * aislamiento). Este test confirma la otra mitad: que la columna —que sigue
 * siendo `String?`, sin cambio de schema— persiste el texto exacto que llega
 * del formulario, tanto al crear como al editar, sin que `createCase` ni
 * `updateCase` lo toquen.
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
import { crearTenantDePrueba, purgeTenant } from './helpers/tenant';

const TAG = `conccuantia-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '', caseId: '' };

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
      name: 'Convocante Prueba',
      idType: 'CC',
      idNumber: `${TAG}-cc`,
      email: `convocante-${TAG}@test.local`,
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      department: 'Cundinamarca',
      occupation: 'Empleado',
      monthlyIncome: 2000000,
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
});

async function leerCuantia(id: string) {
  const fila = await prisma.case.findUniqueOrThrow({
    where: { id },
    select: { concCuantiaPesos: true },
  });
  return fila.concCuantiaPesos;
}

describe('concCuantiaPesos — crear → editar → leer, coma decimal (Postgres real)', () => {
  it('1. crear con "1.234,56": se guarda el texto exacto', async () => {
    const payload = createCaseFormSchema.parse({
      debtorId: ctx.debtorId,
      operatorId: ctx.userId,
      type: 'CONCILIATION' as const,
      totalDebt: '0',
      creditors: 0,
      causes: [],
      concCuantiaPesos: '1.234,56',
    }) as never;

    const result = await createCase(payload);
    expect(result.success).toBe(true);
    ctx.caseId = result.data!.id;

    expect(await leerCuantia(ctx.caseId)).toBe('1.234,56');
  });

  it('2. editar a "2.500.000,75": updateCase lo actualiza', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      concCuantiaPesos: '2.500.000,75',
    } as never);

    expect(result.success).toBe(true);
    expect(await leerCuantia(ctx.caseId)).toBe('2.500.000,75');
  });

  it('3. editar sin reenviarlo: no se borra por omisión', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      concAsunto: 'Asunto ajeno, no toca concCuantiaPesos',
    } as never);

    expect(result.success).toBe(true);
    expect(await leerCuantia(ctx.caseId)).toBe('2.500.000,75');
  });
});
