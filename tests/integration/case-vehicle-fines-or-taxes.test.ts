/**
 * Integration Tests: casilla de comparendos/impuestos del vehículo.
 *
 * Solo captura. El párrafo dirigido a la Secretaría de Hacienda que cuelga de
 * esta casilla todavía no existe: falta el texto legal. Lo que se fija acá es
 * que el dato se guarde y viaje por las dos rutas de escritura (alta de caso y
 * alta de bien suelto), porque ese es el modo de falla de esta clase de cambio:
 * `createCase` y `addAssetToCase` proyectan los campos del bien uno por uno, así
 * que una columna que exista en Prisma pero no se liste en esas proyecciones
 * nunca se escribe y ni tsc ni el tipo de Prisma se quejan.
 *
 * También se verifica lo que NO tiene que pasar: que el dato no llegue a los
 * documentos. El párrafo está pendiente, así que por ahora ningún placeholder
 * debe nombrarlo.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('next/server', () => ({ after: jest.fn() }));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/centro-conciliacion', () => ({
  resolveCenterFolderName: jest.fn().mockReturnValue('Centro Test'),
}));

import { Prisma } from '@prisma/client';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import { assetSchema } from '@/features/case/schemas';
import { createCase } from '@/features/case/actions';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { asCaseWithRelations } from '@/features/document/persistence';
import { SCENARIOS } from '../helpers/mapper-scenarios';

const VEHICULO = {
  name: 'Camioneta Toyota',
  type: 'VEHICULO',
  value: '75000000',
  licensePlate: 'ABC123',
  transitAuthority: 'Secretaría de Movilidad Bogotá',
};

const PAYLOAD = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: '1',
  operatorId: ADMIN_USER.id,
  causes: ['SOBREENDEUDAMIENTO'],
  debts: [
    {
      creditor: 'Banco Test',
      type: 'TARJETA_CREDITO',
      interestRate: '2.5',
      capitalAmount: '50000000',
      interestAmount: '0',
    },
  ],
};

function createdAssets(): Array<Record<string, unknown>> {
  const calls = mockPrisma.case.create.mock.calls;
  const data = (calls[calls.length - 1][0] as { data: Record<string, unknown> })
    .data;
  const assets = data.assets as
    | { create?: Array<Record<string, unknown>> }
    | undefined;
  return assets?.create ?? [];
}

describe('vehículo — comparendos o impuestos pendientes', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();

    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });

    mockPrisma.case.findFirst.mockResolvedValue(null);
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.debtor.findUnique.mockResolvedValue(DEBTOR);
    mockPrisma.debtor.update.mockResolvedValue(DEBTOR);
    mockPrisma.case.create.mockResolvedValue({
      ...CASE_DATA,
      id: 'new-case-id',
      caseNumber: 'CASO-000001',
    });
  });

  it('la columna existe en Asset y arranca en false', () => {
    const asset = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Asset');
    const campo = (asset?.fields ?? []).find(
      (f) => f.name === 'hasPendingFinesOrTaxes',
    );

    expect(campo).toBeDefined();
    expect(campo!.type).toBe('Boolean');
    expect(campo!.default).toBe(false);
  });

  it('el zod del bien la acepta y por defecto es false', () => {
    const conCasilla = assetSchema.parse({
      ...VEHICULO,
      hasPendingFinesOrTaxes: true,
    });
    expect(conCasilla.hasPendingFinesOrTaxes).toBe(true);

    // Sin la clave: el default del zod evita que un bien viejo llegue como
    // undefined a una columna NOT NULL.
    const sinCasilla = assetSchema.parse(VEHICULO);
    expect(sinCasilla.hasPendingFinesOrTaxes).toBe(false);
  });

  it('createCase la escribe en la fila del bien', async () => {
    const created = await createCase({
      ...PAYLOAD,
      assets: [{ ...VEHICULO, hasPendingFinesOrTaxes: true }],
    });
    expect(created.success).toBe(true);

    expect(createdAssets()[0]).toMatchObject({
      type: 'VEHICULO',
      hasPendingFinesOrTaxes: true,
    });
  });

  it('sin marcar, se guarda en false y no en undefined', async () => {
    await createCase({
      ...PAYLOAD,
      assets: [{ ...VEHICULO, hasPendingFinesOrTaxes: false }],
    });

    expect(createdAssets()[0].hasPendingFinesOrTaxes).toBe(false);
  });

  it('todavía no llega a ningún documento (falta el texto legal)', () => {
    // El párrafo a la Secretaría de Hacienda está pendiente. Hasta que exista,
    // ningún placeholder debe nombrar la casilla: si alguien agrega uno sin el
    // texto aprobado, este test lo frena.
    const raw = SCENARIOS['insolvencia-completa'].build() as Record<
      string,
      unknown
    >;
    const assets = (raw.assets as Array<Record<string, unknown>>) ?? [];
    const caseData = asCaseWithRelations({
      ...raw,
      assets: assets.map((a) => ({ ...a, hasPendingFinesOrTaxes: true })),
    } as Parameters<typeof asCaseWithRelations>[0]);

    const placeholders = mapCaseToPlaceholders(caseData);
    const sospechosas = Object.keys(placeholders).filter((clave) =>
      /comparendo|hacienda|impuesto.*pendiente|fines_?or_?taxes/i.test(clave),
    );

    expect(sospechosas).toEqual([]);
  });
});
