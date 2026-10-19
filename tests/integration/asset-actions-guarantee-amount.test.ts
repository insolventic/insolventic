/**
 * Bug encontrado al escribir el test:db de bienes en dos niveles (TAREA 4):
 * `addAssetToCase`/`removeAssetFromCase` fallaban SIEMPRE que el bien no
 * traía `guaranteeAmount` — es decir, para cualquier bien que no sea un
 * vehículo con garantía, la inmensa mayoría de los casos reales.
 *
 * `asset.guaranteeAmount?.toString()` da `undefined` cuando
 * `guaranteeAmount` es `null` (optional chaining, no el operador `??`), y
 * `assetResponseSchema.guaranteeAmount` es `z.string().nullable()` — acepta
 * `string | null`, pero NO `undefined`. El `.parse()` final de las dos
 * server actions reventaba con un ZodError, así que las dos devolvían
 * `{ success: false }` con CUALQUIER bien sin garantía — agregar o quitar
 * un bien desde "Agregar Nuevo Bien" (edit-case-dialog/assets-tab.tsx)
 * estaba roto en la práctica para todo lo que no fuera un vehículo con
 * garantía explícita.
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
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { TENANT, ADMIN_USER } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import { addAssetToCase, removeAssetFromCase } from '@/features/case/actions';

const ASSET_SIN_GARANTIA = {
  id: 'asset-1',
  caseId: 'case-1',
  tenantId: TENANT.id,
  name: 'Nevera',
  type: 'ELECTRONICO',
  value: { toString: () => '1500000' },
  description: null,
  propertyType: null,
  address: null,
  registrationNumber: null,
  encumbrance: null,
  affectation: null,
  precautionaryMeasure: null,
  proofDocument: null,
  isFamilyHome: false,
  isInalienablePatrimony: false,
  hasPendingFinesOrTaxes: false,
  brand: null,
  model: null,
  condition: null,
  licensePlate: null,
  transitAuthority: null,
  guaranteeInFavorOf: null,
  guaranteeAmount: null, // <- el caso que rompía: sin optional chaining -> null
  material: null,
};

describe('addAssetToCase / removeAssetFromCase — bien sin guaranteeAmount', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      operatorId: ADMIN_USER.id,
      debtorId: 'debtor-1',
    });
    mockPrisma.asset.findUnique.mockResolvedValue({ caseId: 'case-1' });
  });

  it('REGRESIÓN: addAssetToCase no falla con un bien sin guaranteeAmount (p. ej. un electrónico)', async () => {
    mockPrisma.asset.create.mockResolvedValue(ASSET_SIN_GARANTIA);

    const result = await addAssetToCase({
      caseId: 'case-1',
      name: 'Nevera',
      type: 'ELECTRONICO',
      value: '1500000',
    });

    expect(result.success).toBe(true);
    expect(result.data?.guaranteeAmount).toBeNull();
  });

  it('REGRESIÓN: removeAssetFromCase no falla al borrar un bien sin guaranteeAmount', async () => {
    mockPrisma.asset.delete.mockResolvedValue(ASSET_SIN_GARANTIA);

    const result = await removeAssetFromCase({ assetId: 'asset-1' });

    expect(result.success).toBe(true);
    expect(result.data?.guaranteeAmount).toBeNull();
  });

  it('con guaranteeAmount sí presente, lo sigue devolviendo como string (caso que ya funcionaba)', async () => {
    mockPrisma.asset.create.mockResolvedValue({
      ...ASSET_SIN_GARANTIA,
      type: 'VEHICULO',
      guaranteeAmount: { toString: () => '5000000' },
    });

    const result = await addAssetToCase({
      caseId: 'case-1',
      name: 'Camioneta',
      type: 'VEHICULO',
      value: '75000000',
      guaranteeAmount: '5000000',
    });

    expect(result.success).toBe(true);
    expect(result.data?.guaranteeAmount).toBe('5000000');
  });
});
