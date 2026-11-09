/**
 * N6 (auditoría 2026-10-27), de punta a punta en las acciones: qué llega al
 * cliente cuando algo falla.
 *
 *  - Un error de Prisma o de red NUNCA llega: el cliente recibe el mensaje
 *    genérico de la acción y el detalle se registra con logger.error.
 *  - Un error de negocio (permisos, "no encontrado") llega con su texto.
 *  - Un error de validación llega como su primer mensaje, no como el JSON del
 *    ZodError (1.017 caracteres en inglés antes de N6).
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

const mockLoggerError = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...a: unknown[]) => mockLoggerError(...a),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
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

import { Prisma } from '@prisma/client';

import { P } from '@/lib/permissions';
import { getAllCreditors } from '@/features/creditor/actions';
import { createDebtor, getAllDebtors } from '@/features/debtor/actions';
import {
  ADMIN_USER,
  DEBTOR,
  PERMISSIONS,
  TENANT,
} from '../../helpers/fixtures';

const DETALLE_PRISMA =
  'Unique constraint failed on the fields: (`idNumber`,`tenantId`)';
const DETALLE_RED = 'fetch failed: ECONNRESET ep-xxx.neon.tech:5432';

function comoAdmin(permissions: string[]) {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      permissions,
    },
    tenantId: TENANT.id,
  });
}

const ALTA = Object.fromEntries(
  Object.entries({ ...DEBTOR, birthDate: undefined }).filter(
    ([k, v]) => v !== null && k !== 'id',
  ),
);

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('un error de Prisma o de red no llega al cliente', () => {
  it('Prisma (createDebtor): genérico de la acción y registrado', async () => {
    comoAdmin([PERMISSIONS.CREATE_DEBTORS]);
    const error = new Prisma.PrismaClientKnownRequestError(DETALLE_PRISMA, {
      code: 'P2010',
      clientVersion: '6.19.3',
    });
    mockPrisma.debtor.create.mockRejectedValue(error);

    const r = await createDebtor(ALTA);

    expect(r).toEqual({ success: false, error: 'Error al crear deudor' });
    expect(JSON.stringify(r)).not.toContain('constraint');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Error al crear deudor',
      error,
      { action: 'createDebtor' },
    );
  });

  it('red (getAllCreditors): genérico de la acción y registrado', async () => {
    comoAdmin([P.VER_ACREEDORES, P.VER_TODOS_CASOS]);
    const error = new TypeError(DETALLE_RED);
    mockPrisma.creditor.findMany.mockRejectedValue(error);

    const r = await getAllCreditors();

    expect(r.success).toBe(false);
    expect(r.error).toBe('Error al obtener acreedores');
    expect(JSON.stringify(r)).not.toContain('ECONNRESET');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Error al obtener acreedores',
      error,
      { action: 'getAllCreditors' },
    );
  });
});

describe('lo que sí llega al cliente', () => {
  it('un error de negocio (permiso) llega con su texto y no se registra', async () => {
    comoAdmin([]);
    const r = await getAllDebtors();
    expect(r).toEqual({
      success: false,
      error: 'No tiene permisos para: Ver deudores',
    });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('un error de validación llega como su primer mensaje, no como JSON', async () => {
    comoAdmin([PERMISSIONS.CREATE_DEBTORS]);
    const r = await createDebtor({ ...ALTA, phone: 'abc-def-ghi' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/^El teléfono debe tener/);
    expect(mockPrisma.debtor.create).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});
