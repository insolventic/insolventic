/**
 * Papelera de expedientes (soft-delete), contra Postgres REAL.
 *
 * Hace falta la base real porque la pieza central es la extensión del cliente
 * de `src/lib/prisma.ts`, y `tests/__mocks__/prisma` la reemplaza entera: con
 * el mock, "el caso eliminado no aparece" no se puede distinguir de "el mock
 * devolvió lo que le dijimos".
 *
 * El ciclo, en orden:
 *   1. Eliminar manda a la papelera: la fila sigue, con quién y cuándo, y
 *      desaparece de getCaseById, getAllCases, la búsqueda y los conteos.
 *   2. La extensión aplica también dentro de `$transaction(async (tx) => …)`.
 *   3. Un caso en la papelera no se edita.
 *   4. La numeración no reutiliza el número de un caso en la papelera.
 *   5. La papelera lo lista; un deudor con un caso en la papelera no se borra.
 *   6. Restaurar lo devuelve entero.
 *   7. Eliminar definitivamente: solo con permiso, solo desde la papelera,
 *      con la confirmación escrita, y deja la auditoría `purged`.
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
import { P } from '@/lib/permissions';
import { incluyendoPapelera } from '@/lib/papelera';
import { createAccessToken } from '@/lib/auth';
import {
  createCase,
  deleteCase,
  getAllCases,
  getCaseById,
  updateCase,
} from '@/features/case/actions';
import {
  getDeletedCases,
  purgeCase,
  restoreCase,
} from '@/features/case/actions-papelera';
import { deleteDebtor } from '@/features/debtor/actions';
import { globalSearch } from '@/features/search/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';
import { crearTenantDePrueba, purgeTenant } from './helpers/tenant';

const TAG = `papelera-${Date.now().toString(36)}`;
const ctx = {
  tenantId: '',
  tenantSlug: '',
  userId: '',
  debtorId: '',
  caseId: '',
  caseNumber: '',
  tokenAdmin: '',
  tokenSinPurga: '',
};

const PERMISOS_ADMIN = [
  P.CREAR_CASOS,
  P.VER_CASOS,
  P.EDITAR_CASOS,
  P.VER_TODOS_CASOS,
  P.ELIMINAR_CASOS,
  P.ELIMINAR_CASOS_DEFINITIVAMENTE,
  P.ELIMINAR_DEUDORES,
];

async function crearConciliacion() {
  const result = await createCase(
    createCaseFormSchema.parse({
      debtorId: ctx.debtorId,
      operatorId: ctx.userId,
      type: 'CONCILIATION' as const,
      totalDebt: '0',
      creditors: 0,
      causes: [],
    }) as never,
  );
  if (!result.success || !result.data) {
    throw new Error(`No se pudo crear el caso: ${result.error}`);
  }
  return result.data;
}

/** Un usuario del mismo centro con `Eliminar casos` pero sin purgar. */
async function crearOperadoraSinPurga(): Promise<string> {
  const permisos = [P.VER_CASOS, P.VER_TODOS_CASOS, P.ELIMINAR_CASOS];
  const rol = await prisma.role.create({
    data: {
      name: 'Operadora de Insolvencia',
      description: TAG,
      tenantId: ctx.tenantId,
    },
  });
  for (const name of permisos) {
    const permiso = await prisma.permission.upsert({
      where: { name_tenantId: { name, tenantId: ctx.tenantId } },
      update: {},
      create: { name, category: 'casos', tenantId: ctx.tenantId },
    });
    await prisma.rolePermission.create({
      data: {
        roleId: rol.id,
        permissionId: permiso.id,
        tenantId: ctx.tenantId,
      },
    });
  }
  const usuaria = await prisma.user.create({
    data: {
      name: 'Operadora Sin Purga',
      email: `operadora-${TAG}@centroejemplo.test`,
      professionalCard: '000000',
      phone: '3000000000',
      address: 'Calle 1',
      roleId: rol.id,
      tenantId: ctx.tenantId,
    },
  });
  return createAccessToken({
    id: usuaria.id,
    name: usuaria.name,
    email: usuaria.email,
    roleId: rol.id,
    roleName: rol.name,
    permissions: permisos,
    tenantId: ctx.tenantSlug,
    tenantName: `Prueba ${TAG}`,
    lastLogin: new Date(),
  });
}

function comoAdmin() {
  mockCookies.setToken('access-token', ctx.tokenAdmin);
}

beforeEach(() => {
  _resetRateLimitStore();
  comoAdmin();
});

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG, PERMISOS_ADMIN);
  ctx.tenantId = tenant.tenantId;
  ctx.tenantSlug = tenant.tenantSlug;
  ctx.userId = tenant.userId;
  ctx.tokenAdmin = tenant.token;
  comoAdmin();

  const debtor = await prisma.debtor.create({
    data: {
      name: 'Pepita Pérez',
      idType: 'CC',
      idNumber: `${TAG}-cc`,
      email: `pepita-${TAG}@test.local`,
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      department: 'Cundinamarca',
      occupation: 'Empleada',
      monthlyIncome: 2000000,
      totalDebt: 0,
      activeCases: 0,
      maritalStatus: 'Soltero(a)',
      tenantId: ctx.tenantId,
    },
  });
  ctx.debtorId = debtor.id;

  const caso = await crearConciliacion();
  ctx.caseId = caso.id;
  ctx.caseNumber = caso.caseNumber;

  ctx.tokenSinPurga = await crearOperadoraSinPurga();
  comoAdmin();
});

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
});

describe('papelera de expedientes (Postgres real)', () => {
  it('1. eliminar lo manda a la papelera: la fila sigue y desaparece de la app', async () => {
    const result = await deleteCase({
      id: ctx.caseId,
      confirmCaseNumber: ctx.caseNumber,
    });
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const fila = await prisma.case.findFirst({
      where: { id: ctx.caseId, ...incluyendoPapelera },
      select: { deletedAt: true, deletedById: true, deletedByName: true },
    });
    expect(fila?.deletedAt).toBeInstanceOf(Date);
    expect(fila?.deletedById).toBe(ctx.userId);
    expect(fila?.deletedByName).toBe('Liliana Patricia Arango Mejía');

    expect((await getCaseById(ctx.caseId)).success).toBe(false);

    const listado = await getAllCases();
    expect(listado.success).toBe(true);
    expect(listado.data?.items.map((c) => c.id)).not.toContain(ctx.caseId);

    const busqueda = await globalSearch(ctx.caseNumber);
    expect(JSON.stringify(busqueda.data ?? [])).not.toContain(ctx.caseId);

    expect(await prisma.case.count({ where: { tenantId: ctx.tenantId } })).toBe(
      0,
    );
    expect(
      await prisma.case.count({
        where: { tenantId: ctx.tenantId, ...incluyendoPapelera },
      }),
    ).toBe(1);
  });

  it('2. la extensión también filtra dentro de una transacción interactiva', async () => {
    const dentro = await prisma.$transaction((tx) =>
      tx.case.findUnique({ where: { id: ctx.caseId } }),
    );
    expect(dentro).toBeNull();
  });

  it('3. un caso en la papelera no se edita', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      notificationCity: 'Cali',
    } as never);
    expect(result.success).toBe(false);
  });

  it('4. la numeración no reutiliza el número de un caso en la papelera', async () => {
    const nuevo = await crearConciliacion();
    expect(nuevo.caseNumber).not.toBe(ctx.caseNumber);
    // Se borra enseguida por la vía normal, para no interferir con el resto.
    await deleteCase({ id: nuevo.id, confirmCaseNumber: nuevo.caseNumber });
    comoAdmin();
    await purgeCase({ id: nuevo.id, confirmCaseNumber: nuevo.caseNumber });
  });

  it('5. la papelera lo lista y su deudor no se puede eliminar', async () => {
    const papelera = await getDeletedCases();
    expect(papelera.success).toBe(true);
    const enPapelera = papelera.data?.find((c) => c.id === ctx.caseId);
    expect(enPapelera?.caseNumber).toBe(ctx.caseNumber);
    expect(enPapelera?.deletedByName).toBe('Liliana Patricia Arango Mejía');

    const borradoDeudor = await deleteDebtor(ctx.debtorId);
    expect(borradoDeudor.success).toBe(false);
    expect(borradoDeudor.error).toContain('papelera');
    expect(await prisma.debtor.count({ where: { id: ctx.debtorId } })).toBe(1);
  });

  it('6. restaurar lo devuelve entero', async () => {
    const result = await restoreCase({ id: ctx.caseId });
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const caso = await getCaseById(ctx.caseId);
    expect(caso.success).toBe(true);
    const fila = await prisma.case.findUnique({
      where: { id: ctx.caseId },
      select: { deletedAt: true, deletedByName: true },
    });
    expect(fila).toEqual({ deletedAt: null, deletedByName: null });

    const auditoria = await prisma.auditLog.findFirst({
      where: {
        tenantId: ctx.tenantId,
        entityId: ctx.caseId,
        action: 'restored',
      },
    });
    expect(auditoria).not.toBeNull();
  });

  it('7a. no se elimina definitivamente un caso activo', async () => {
    const result = await purgeCase({
      id: ctx.caseId,
      confirmCaseNumber: ctx.caseNumber,
    });
    expect(result.success).toBe(false);
    expect(await prisma.case.count({ where: { id: ctx.caseId } })).toBe(1);
  });

  it('7b. sin el permiso, no se elimina definitivamente', async () => {
    await deleteCase({ id: ctx.caseId, confirmCaseNumber: ctx.caseNumber });

    mockCookies.setToken('access-token', ctx.tokenSinPurga);
    // Con `Eliminar casos` sí ve la papelera y podría restaurar…
    expect((await getDeletedCases()).success).toBe(true);
    // …pero no destruir.
    const result = await purgeCase({
      id: ctx.caseId,
      confirmCaseNumber: ctx.caseNumber,
    });
    expect(result.success).toBe(false);
    expect(
      await prisma.case.count({
        where: { id: ctx.caseId, ...incluyendoPapelera },
      }),
    ).toBe(1);
  });

  it('7c. con el número equivocado no se elimina; con el correcto, sí', async () => {
    const mal = await purgeCase({
      id: ctx.caseId,
      confirmCaseNumber: 'CONC-999999',
    });
    expect(mal.success).toBe(false);
    expect(
      await prisma.case.count({
        where: { id: ctx.caseId, ...incluyendoPapelera },
      }),
    ).toBe(1);

    const bien = await purgeCase({
      id: ctx.caseId,
      confirmCaseNumber: ctx.caseNumber,
    });
    expect(bien.error).toBeUndefined();
    expect(bien.success).toBe(true);
    expect(
      await prisma.case.count({
        where: { id: ctx.caseId, ...incluyendoPapelera },
      }),
    ).toBe(0);

    const auditoria = await prisma.auditLog.findFirst({
      where: { tenantId: ctx.tenantId, entityId: ctx.caseId, action: 'purged' },
    });
    expect(auditoria).not.toBeNull();
  });

  it('8. sin expedientes, el deudor ya se puede eliminar', async () => {
    const result = await deleteDebtor(ctx.debtorId);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
