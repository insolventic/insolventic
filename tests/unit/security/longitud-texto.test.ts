/**
 * F2 (auditoría 2026-10-27): casi ningún texto tenía longitud máxima y las
 * columnas son `text`. Un nombre de deudor de 50.000 caracteres atravesaba el
 * mapper intacto y entraba al HTML que va a Puppeteer.
 *
 * El límite es de la aplicación (sin migración): se aplica en las acciones,
 * siempre al crear y, al editar, solo a los textos que cambiaron respecto de
 * lo guardado.
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
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import {
  LIMITE_CORREO,
  LIMITE_CORTO,
  LIMITE_LARGO,
  LIMITE_MEDIO,
  excesoDeLongitud,
  limiteDeCampo,
} from '@/lib/longitud-texto';
import { createDebtor, updateDebtor } from '@/features/debtor/actions';
import {
  ADMIN_USER,
  DEBTOR,
  PERMISSIONS,
  TENANT,
} from '../../helpers/fixtures';

const largo = (n: number) => 'A'.repeat(n);

describe('limiteDeCampo', () => {
  it.each([
    ['name', LIMITE_CORTO],
    ['creditorName', LIMITE_CORTO],
    ['idNumber', LIMITE_CORTO],
    ['apoderadoTarjetaProfesional', LIMITE_CORTO],
    ['email', LIMITE_CORREO],
    ['concConvocadoCorreo', LIMITE_CORREO],
    ['address', LIMITE_MEDIO],
    ['concConvocanteDireccion', LIMITE_MEDIO],
    ['observations', LIMITE_LARGO],
    ['otherCauseDetail', LIMITE_LARGO],
  ])('%s → %i', (campo, limite) => {
    expect(limiteDeCampo(campo)).toBe(limite);
  });
});

describe('excesoDeLongitud', () => {
  it('el nombre de 50.000 caracteres de la auditoría se rechaza', () => {
    expect(excesoDeLongitud({ name: largo(50_000) })).toMatch(/«name».*200/);
  });

  it('el límite es inclusivo', () => {
    expect(excesoDeLongitud({ name: largo(LIMITE_CORTO) })).toBeNull();
    expect(excesoDeLongitud({ name: largo(LIMITE_CORTO + 1) })).not.toBeNull();
  });

  it('recorre relaciones anidadas (acreedores, bienes)', () => {
    expect(
      excesoDeLongitud({
        debts: [{ creditor: 'Banco', creditorName: largo(201) }],
      }),
    ).toMatch(/creditorName/);
  });

  it('con lo guardado, un texto que no cambió no se valida', () => {
    const viejo = { name: largo(300), observations: 'x' };
    expect(excesoDeLongitud({ ...viejo }, viejo)).toBeNull();
    expect(excesoDeLongitud({ name: largo(301) }, viejo)).not.toBeNull();
  });

  it('ignora números, fechas y booleanos', () => {
    expect(
      excesoDeLongitud({ amount: 1e14, date: new Date(), ok: true, n: null }),
    ).toBeNull();
  });
});

describe('acciones de deudor', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        permissions: [PERMISSIONS.CREATE_DEBTORS, PERMISSIONS.EDIT_DEBTORS],
      },
      tenantId: TENANT.id,
    });
  });

  const FICHA = Object.fromEntries(
    Object.entries({ ...DEBTOR, birthDate: undefined }).filter(
      ([, v]) => v !== null,
    ),
  ) as typeof DEBTOR;

  it('createDebtor rechaza un nombre por encima del límite y no escribe', async () => {
    const alta: Record<string, unknown> = { ...FICHA, name: largo(50_000) };
    delete alta.id;
    const r = await createDebtor(alta);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/«name»/);
    expect(mockPrisma.debtor.create).not.toHaveBeenCalled();
  });

  it('updateDebtor: un texto viejo largo que no cambió no bloquea la edición', async () => {
    mockPrisma.debtor.findFirst.mockResolvedValue({
      ...DEBTOR,
      address: largo(800),
    });
    mockPrisma.debtor.update.mockResolvedValue({
      ...DEBTOR,
      address: largo(800),
    });
    const r = await updateDebtor({
      ...FICHA,
      address: largo(800),
      city: 'Cali',
    });
    expect(r.error).toBeUndefined();
    expect(mockPrisma.debtor.update).toHaveBeenCalled();
  });

  it('updateDebtor: cambiarlo a otro texto demasiado largo se rechaza', async () => {
    mockPrisma.debtor.findFirst.mockResolvedValue({
      ...DEBTOR,
      address: largo(800),
    });
    const r = await updateDebtor({ ...FICHA, address: largo(801) });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/«address».*500/);
    expect(mockPrisma.debtor.update).not.toHaveBeenCalled();
  });
});
