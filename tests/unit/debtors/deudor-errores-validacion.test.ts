/**
 * `createDebtor` y `updateDebtor`: un error de validación vuelve como texto
 * legible y por campo, nunca como el JSON del ZodError.
 *
 * Antes las dos acciones hacían `schema.parse(input)` y el `catch` devolvía
 * `error.message`, que en Zod 4 es el JSON de los issues. El diálogo "Crear
 * Nuevo Deudor" lo mostraba tal cual:
 * `[ { "origin": "string", "code": "too_small", ... "path": [ "address" ], ... } ]`.
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

import { TENANT, ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { createDebtor, updateDebtor } from '@/features/debtor/actions';

/** Lo que manda el diálogo rápido del asistente, con la dirección vacía. */
const DESDE_EL_ASISTENTE = {
  name: 'Ana Pérez Gómez',
  idNumber: '1234567',
  email: 'ana@example.com',
  phone: '3001234567',
  address: '',
  city: 'Bogotá',
  department: 'Cundinamarca',
  monthlyIncome: 0,
  monthlyExpenses: 0,
  idType: 'CC',
  occupation: 'Empleado',
  birthDate: undefined,
  dependents: 0,
  maritalStatus: 'SOLTERO',
  educationLevel: 'UNIVERSITARIO',
  emergencyContact: '',
  emergencyPhone: '',
  bankAccount: '',
  bankName: '',
  accountType: 'AHORROS',
  description: '',
};

/** Rastros del JSON de un ZodError. */
const JSON_DE_ZOD = /"code"|"origin"|too_small|"path"|^\s*\[/;

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockAuthenticateUser.mockResolvedValue({
    user: { ...ADMIN_USER, permissions: Object.values(P) },
    tenantId: TENANT.id,
  });
});

describe('createDebtor con datos inválidos', () => {
  it('devuelve el mensaje legible y el error por campo, no el JSON', async () => {
    const resultado = await createDebtor(DESDE_EL_ASISTENTE);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBe('La dirección es requerida');
    expect(resultado.error).not.toMatch(JSON_DE_ZOD);
    expect(resultado.fieldErrors).toEqual({
      address: 'La dirección es requerida',
    });
    expect(mockPrisma.debtor.create).not.toHaveBeenCalled();
  });

  it('varios campos: uno por campo, en el orden del schema', async () => {
    const resultado = await createDebtor({
      ...DESDE_EL_ASISTENTE,
      city: '',
      department: '',
    });

    expect(resultado.fieldErrors).toMatchObject({
      address: 'La dirección es requerida',
      city: 'La ciudad es requerida',
      department: 'El departamento es requerido',
    });
    expect(JSON.stringify(resultado)).not.toMatch(/"code"|too_small/);
  });
});

describe('updateDebtor con datos inválidos', () => {
  it('devuelve el mensaje legible y el error por campo, no el JSON', async () => {
    const resultado = await updateDebtor({
      id: 'deudor-1',
      ...DESDE_EL_ASISTENTE,
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error).not.toMatch(JSON_DE_ZOD);
    expect(resultado.fieldErrors?.address).toBe('La dirección es requerida');
    expect(mockPrisma.debtor.update).not.toHaveBeenCalled();
  });
});
