/**
 * Listado de casos (getAllCases): lee una página, y solo las columnas que usa.
 *
 * Dos propiedades distintas, por dos bugs distintos:
 *
 *   1. **La cota.** La consulta no tenía `take` ni `skip`: traía todos los
 *      casos del centro y la pantalla paginaba en memoria del cliente (P-1 de
 *      `docs/AUDITORIA_BLOQUE3_2026-10-27.md`). Los tests de "paginación
 *      acotada" son los que impiden que vuelva.
 *   2. **El ancho de la fila.** Antes traía las 269 columnas de cada caso.
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

import {
  getAllCases,
  getCasesForSelector,
  deleteCase,
} from '@/features/case/actions';
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
    const item = result.data!.items[0];
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
    expect(result.data!.items).toHaveLength(2);
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

describe('deleteCase — lectura acotada + visibilidad por fila', () => {
  it('lee solo las tres columnas del guard (no la fila) y sigue borrando en transacción', async () => {
    asAdmin();
    // GC-A1: el `select` pasó de `{ id: true }` a las tres columnas que pide
    // `assertCaseAccess`. La intención original de este test —no traer la fila
    // de 265 columnas para comprobar existencia— se conserva intacta: siguen
    // siendo tres columnas y no la fila. Lo que cambió es cuáles.
    // Dos lecturas: la del guard (GC-A1) y el snapshot previo al borrado
    // (GC-M6). El assert de más abajo es sobre la PRIMERA.
    mockPrisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        operatorId: ADMIN_USER.id,
        debtorId: 'debtor-1',
      })
      .mockResolvedValueOnce({
        caseNumber: 'CASO-000001',
        debtorName: 'Test',
        type: 'INSOLVENCY',
        phase: 'Inicial',
        driveFolderId: null,
        _count: { documents: 0, debts: 0, assets: 0, dependents: 0 },
      });
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

    const result = await deleteCase({
      id: 'case-1',
      confirmCaseNumber: 'CASO-000001',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1', tenantId: TENANT.id },
        select: { id: true, operatorId: true, debtorId: true },
      }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('un caso inexistente sigue devolviendo error', async () => {
    asAdmin();
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const result = await deleteCase({
      id: 'no-existe',
      confirmCaseNumber: 'CASO-000001',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
/**
 * La cota del listado — P-1.
 *
 * Ningún test del repositorio verificaba `take`/`skip` en ninguna action, y
 * así fue como el listado principal se quedó sin cota mientras los demás
 * (audit-log, notificaciones, búsqueda) sí la tenían. Estos tests son esa
 * verificación para `/cases`: si alguien saca el `take` o deja de pasar el
 * mismo `where` al `count`, fallan.
 */
describe('getAllCases — paginación acotada', () => {
  const argsFindMany = () => mockPrisma.case.findMany.mock.calls[0][0];
  const argsCount = () => mockPrisma.case.count.mock.calls[0][0];

  beforeEach(() => {
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);
  });

  it('SIEMPRE pide una página: `take` y `skip` presentes, nunca el listado entero', async () => {
    asAdmin();

    await getAllCases();

    const args = argsFindMany();
    expect(args.take).toBe(20);
    expect(args.skip).toBe(0);
  });

  it('`skip` sale de la página pedida', async () => {
    asAdmin();

    await getAllCases({ page: 3, pageSize: 50 });

    const args = argsFindMany();
    expect(args.take).toBe(50);
    expect(args.skip).toBe(100);
  });

  it('un `pageSize` desmedido se recorta al tope en vez de traer todo', async () => {
    asAdmin();

    await getAllCases({ pageSize: 5000 });

    // El tope es lo que impide que un parámetro del cliente reintroduzca el
    // bug: 5.000 no es "sin límite", es 100.
    expect(argsFindMany().take).toBe(100);
  });

  it('página y pageSize basura caen al default, sin romper la pantalla', async () => {
    asAdmin();

    const result = await getAllCases({ page: '-3', pageSize: 'muchos' });

    expect(result.success).toBe(true);
    expect(argsFindMany()).toMatchObject({ take: 20, skip: 0 });
  });

  it('el `count` recibe EXACTAMENTE el mismo `where` que el `findMany`', async () => {
    // El agujero más fácil de dejar: un total que filtra por tenant pero no
    // por rol le mostraría a un Abogado el total del centro entero.
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: 'abogado-1',
        name: 'Abogado',
        email: 'abogado@example.com',
        permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
      },
      tenantId: TENANT.id,
    });

    await getAllCases({ search: 'torres' });

    expect(argsCount().where).toEqual(argsFindMany().where);
    // Y el alcance por rol sigue en los dos.
    expect(argsCount().where).toMatchObject({
      tenantId: TENANT.id,
      operatorId: 'abogado-1',
    });
  });

  it('el total lo da el `count`, no la cantidad de filas de la página', async () => {
    asAdmin();
    mockPrisma.case.findMany.mockResolvedValue([listRow()]);
    mockPrisma.case.count.mockResolvedValue(4321);

    const result = await getAllCases();

    expect(result.data!.items).toHaveLength(1);
    expect(result.data!.total).toBe(4321);
    expect(result.data!.page).toBe(1);
    expect(result.data!.pageSize).toBe(20);
  });

  it('un usuario sin alcance no consulta: ni `findMany` ni `count`', async () => {
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: 'u-1',
        name: 'Sin alcance',
        email: 'sin@example.com',
        permissions: [PERMISSIONS.VIEW_CASES],
      },
      tenantId: TENANT.id,
    });

    const result = await getAllCases();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.case.count).not.toHaveBeenCalled();
  });

  it('del deudor pide tres columnas, no la relación completa', async () => {
    asAdmin();

    await getAllCases();

    // `debtor: true` eran los 56 campos del deudor por fila — su situación
    // financiera entera — para mostrar una cédula.
    const { debtor } = argsFindMany().select;
    expect(debtor).not.toBe(true);
    expect(Object.keys(debtor.select).sort()).toEqual([
      'id',
      'idNumber',
      'name',
    ]);
  });
});

/**
 * Los filtros, que antes se evaluaban en el cliente sobre la lista completa.
 * Cada uno tenía su trampa al bajarlo a la consulta.
 */
describe('getAllCases — los filtros van a la consulta', () => {
  const where = () => mockPrisma.case.findMany.mock.calls[0][0].where;

  beforeEach(() => {
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);
    asAdmin();
  });

  it('la búsqueda cubre número de caso, nombre del deudor y cédula', async () => {
    await getAllCases({ search: 'torres' });

    expect(where().AND).toEqual([
      {
        OR: [
          { caseNumber: { contains: 'torres', mode: 'insensitive' } },
          { debtorName: { contains: 'torres', mode: 'insensitive' } },
          // La cédula vive en la relación, no en una columna de Case: es el
          // motivo por el que el select del deudor tiene que seguir trayendo
          // `idNumber`.
          { debtor: { idNumber: { contains: 'torres' } } },
        ],
      },
    ]);
  });

  it("filtrar por 'Inicial' incluye los casos con la fase en NULL", async () => {
    await getAllCases({ phase: 'Inicial' });

    // La pantalla muestra 'Inicial' para `phase === null`. Sin el OR, el
    // filtro perdía en silencio todos los casos que nunca cambiaron de fase.
    expect(where().AND).toEqual([
      { OR: [{ phase: 'Inicial' }, { phase: null }] },
    ]);
  });

  it('otra fase filtra por igualdad, sin el OR', async () => {
    await getAllCases({ phase: 'Admisión' });

    expect(where().AND).toEqual([{ phase: 'Admisión' }]);
  });

  it('el tipo se traduce de la etiqueta en español al enum de la columna', async () => {
    await getAllCases({ type: 'Acuerdo de Apoyo' });

    // El `<Select>` ofrece 'Acuerdo de Apoyo'; la columna guarda
    // 'SUPPORT_AGREEMENT'. Mientras el filtro era client-side la diferencia no
    // se notaba, porque comparaba contra el valor ya traducido por Zod.
    expect(where().AND).toEqual([{ type: 'SUPPORT_AGREEMENT' }]);
  });

  it("'all' no filtra", async () => {
    await getAllCases({ phase: 'all', type: 'all' });

    expect(where().AND).toBeUndefined();
    expect(where()).toEqual({ tenantId: TENANT.id });
  });

  it('los filtros se acumulan en `AND`, sin pisarse entre sí', async () => {
    await getAllCases({ search: 'ana', phase: 'Inicial', type: 'Insolvencia' });

    // Tres cláusulas: dos de ellas necesitan su propio `OR`, así que al mismo
    // nivel la segunda habría pisado a la primera.
    expect(where().AND).toHaveLength(3);
  });
});

/**
 * El selector de `/documents` filtra en el cliente, así que necesita el
 * conjunto y no una página — pero tampoco puede ser una consulta sin cota.
 */
describe('getCasesForSelector', () => {
  beforeEach(() => {
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);
    asAdmin();
  });

  it('lleva `take` y no pide la relación del deudor', async () => {
    await getCasesForSelector();

    const args = mockPrisma.case.findMany.mock.calls[0][0];
    expect(args.take).toBe(500);
    expect(args.select.debtor).toBeUndefined();
    expect(args.select.debtorName).toBe(true);
  });

  it('informa el total para que la pantalla pueda avisar del recorte', async () => {
    mockPrisma.case.count.mockResolvedValue(1200);

    const result = await getCasesForSelector();

    expect(result.data).toMatchObject({ total: 1200, limit: 500 });
  });
});
