/**
 * Listado de casos (getAllCases): lee solo las columnas del listado.
 *
 * Antes traía las 269 columnas de cada caso (`include`) y las validaba todas con
 * `z.array(caseSchema)`: una columna ausente en la base (o un null que el schema
 * no esperaba) invalidaba el listado entero. Así se cayó /cases con las 29
 * columnas `apoyo_*` que nunca se habían creado. Ahora el `select` y el schema
 * de validación salen de la misma máscara (CASE_LIST_COLUMNS).
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));

import { Prisma } from '@prisma/client';

import {
  TENANT,
  ADMIN_USER,
  DEBTOR,
  CASE_DATA,
  PERMISSIONS,
} from '../../helpers/fixtures';

import { getAllCases, deleteCase } from '@/features/case/actions';
import {
  CASE_LIST_COLUMNS,
  caseSchema,
  getAllCasesSchema,
} from '@/features/case/schemas';

const asAdmin = () =>
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      permissions: [
        PERMISSIONS.VIEW_CASES,
        PERMISSIONS.VIEW_ALL_CASES,
        PERMISSIONS.DELETE_CASES,
      ],
    },
    tenantId: TENANT.id,
  });

/** Una fila como la devolvería Prisma con el `select` del listado: SOLO esas columnas. */
function listRow(overrides: Record<string, unknown> = {}) {
  const base = CASE_DATA as Record<string, unknown>;
  const scalars = Object.fromEntries(
    Object.keys(CASE_LIST_COLUMNS).map((k) => [k, base[k] ?? null]),
  );
  return {
    ...scalars,
    id: 'case-1',
    caseNumber: 'INS-2026-001',
    debtorName: 'Ana Torres',
    type: 'INSOLVENCY',
    totalDebt: 50_000_000,
    creditors: 3,
    version: 1,
    createdDate: new Date('2026-03-15T12:00:00Z'),
    hearingDate: null,
    phase: 'Inicial',
    causes: [],
    driveFolderId: null,
    debtor: DEBTOR,
    operator: { id: 'op-1', name: 'Operadora', email: 'op@example.com' },
    _count: { documents: 2 },
    ...overrides,
  };
}

beforeEach(() => {
  resetAllMocks();
  mockAuthenticateUser.mockReset();
  jest.clearAllMocks();
});

describe('getAllCases — consulta acotada', () => {
  it('pide las columnas del listado con `select` (y NO usa `include`)', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([]);

    await getAllCases();

    const args = mockPrisma.case.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.include).toBeUndefined();
    // Tenant scoping intacto.
    expect(args.where).toEqual({ tenantId: TENANT.id });
    expect(args.orderBy).toEqual({ createdDate: 'desc' });
  });

  it('el select son exactamente CASE_LIST_COLUMNS + las tres relaciones que usa el listado', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([]);

    await getAllCases();

    const { select } = mockPrisma.case.findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      [
        ...Object.keys(CASE_LIST_COLUMNS),
        'debtor',
        'operator',
        '_count',
      ].sort(),
    );
    // Trae ~16 columnas del caso, no las 269.
    expect(Object.keys(select).length).toBeLessThan(20);
  });

  it('no pide columnas de los formularios de conciliación, apoyo ni definitivo', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([]);

    await getAllCases();

    const { select } = mockPrisma.case.findMany.mock.calls[0][0];
    const keys = Object.keys(select);
    expect(keys.filter((k) => k.startsWith('apoyo'))).toEqual([]);
    expect(keys.filter((k) => k.startsWith('conc'))).toEqual([]);
    expect(keys).not.toContain('apoyoClausulas');
  });
});

describe('getAllCases — la validación ya no depende del resto de las columnas', () => {
  it('una fila con SOLO las columnas del listado valida y devuelve los campos que usa la pantalla', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([listRow()]);

    const result = await getAllCases();

    expect(result.success).toBe(true);
    const item = result.data![0];
    expect(item.caseNumber).toBe('INS-2026-001');
    expect(item.type).toBe('Insolvencia'); // mapCaseTypeToSpanish sigue aplicándose
    expect(item.totalDebt).toBe(50_000_000);
    expect(item.debtor.idNumber).toBe(DEBTOR.idNumber);
    expect(item._count.documents).toBe(2);
    expect(item.phase).toBe('Inicial');
  });

  it('el schema anterior (caseSchema completo) SÍ rechazaba esa misma fila: es la fragilidad que se elimina', () => {
    const row = listRow();

    expect(getAllCasesSchema.safeParse([row]).success).toBe(true);
    // Con las ~250 columnas restantes ausentes, el `z.array(caseSchema)` de antes fallaba.
    expect(caseSchema.safeParse(row).success).toBe(false);
  });

  it('un caso de apoyo/conciliación con columnas raras no invalida el listado', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([
      listRow({ id: 'a' }),
      listRow({ id: 'b', type: 'SUPPORT_AGREEMENT', phase: null }),
    ]);

    const result = await getAllCases();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });
});

describe('CASE_LIST_COLUMNS', () => {
  it('cada columna existe en el modelo Prisma Case (sin erratas ni columnas retiradas)', () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Case')!;
    const columns = new Set(model.fields.map((f) => f.name));

    for (const name of Object.keys(CASE_LIST_COLUMNS)) {
      expect(columns.has(name)).toBe(true);
    }
  });

  it('cada columna existe también en caseSchema (la máscara de Zod no puede referenciar algo que no está)', () => {
    for (const name of Object.keys(CASE_LIST_COLUMNS)) {
      expect(Object.keys(caseSchema.shape)).toContain(name);
    }
  });
});

describe('deleteCase — solo comprueba existencia', () => {
  it('lee únicamente el id del caso (no la fila) y sigue borrando en transacción', async () => {
    asAdmin();
    mockPrisma.case.findUnique.mockResolvedValue({ id: 'case-1' });
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        document: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        debt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        asset: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        legalProcess: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        libranza: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        suspendedService: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        dependent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        case: {
          delete: jest
            .fn()
            .mockResolvedValue({ ...CASE_DATA, debtorName: 'Test' }),
        },
      }),
    );

    const result = await deleteCase({ id: 'case-1' });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1', tenantId: TENANT.id },
        select: { id: true },
      }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('un caso inexistente sigue devolviendo error', async () => {
    asAdmin();
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const result = await deleteCase({ id: 'no-existe' });

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
