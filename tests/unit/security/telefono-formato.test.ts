/**
 * F3 (auditoría 2026-10-27): el teléfono no tenía formato. Los 7 sitios que lo
 * pedían validaban solo `.min(1)`, así que `abc-def-ghi` era válido y terminaba
 * impreso en las notificaciones a acreedores y juzgados.
 *
 * Regla: entre 7 y 15 dígitos, con espacios, `+`, `-`, paréntesis y «ext.».
 * Se exige siempre al crear; al editar, solo si el teléfono cambió respecto
 * del guardado, para no bloquear registros viejos.
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
  MENSAJE_TELEFONO_INVALIDO,
  problemaDeTelefono,
  problemaDeTelefonoSiCambio,
} from '@/lib/telefono';
import { registerSchema } from '@/features/auth/schemas';
import { createContactSchema } from '@/features/contact/schemas';
import { createCreditorSchema } from '@/features/creditor/schemas';
import { createDebtorSchema } from '@/features/debtor/schemas';
import { createUserSchema } from '@/features/user/schemas';
import { updateDebtor } from '@/features/debtor/actions';
import {
  ADMIN_USER,
  DEBTOR,
  PERMISSIONS,
  TENANT,
} from '../../helpers/fixtures';

const mensajesDelTelefono = (r: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  r.success
    ? []
    : (r.error?.issues ?? [])
        .filter((i) => i.path[0] === 'phone')
        .map((i) => i.message);

describe('problemaDeTelefono', () => {
  it.each([
    '3001234567',
    '300 123 4567',
    '+57 300 123 4567',
    '(601) 555-1234',
    '601 555 1234 ext. 12',
    '6015551234 ext 345',
    '5551234',
  ])('acepta %p', (tel) => {
    expect(problemaDeTelefono(tel)).toBeNull();
  });

  it.each([
    'abc-def-ghi',
    '123456',
    '1234567890123456',
    '300+1234567',
    'tel: 3001234567',
    '',
  ])('rechaza %p', (tel) => {
    expect(problemaDeTelefono(tel)).toBe(MENSAJE_TELEFONO_INVALIDO);
  });
});

describe('problemaDeTelefonoSiCambio', () => {
  it('un teléfono viejo inválido que no cambió no bloquea la edición', () => {
    expect(problemaDeTelefonoSiCambio('abc', 'abc')).toBeNull();
    expect(problemaDeTelefonoSiCambio(undefined, 'abc')).toBeNull();
  });

  it('si cambió, se valida', () => {
    expect(problemaDeTelefonoSiCambio('xyz', 'abc')).toBe(
      MENSAJE_TELEFONO_INVALIDO,
    );
    expect(problemaDeTelefonoSiCambio('3001234567', 'abc')).toBeNull();
  });
});

describe('las altas exigen el formato', () => {
  it.each([
    ['registro', registerSchema],
    ['contacto', createContactSchema],
    ['acreedor', createCreditorSchema],
    ['deudor', createDebtorSchema],
    ['usuario', createUserSchema],
  ])('%s', (_nombre, schema) => {
    expect(
      mensajesDelTelefono(schema.safeParse({ phone: 'abc-def-ghi' })),
    ).toContain(MENSAJE_TELEFONO_INVALIDO);
    expect(
      mensajesDelTelefono(schema.safeParse({ phone: '300 123 4567' })),
    ).toEqual([]);
  });
});

/** El diálogo de edición manda la ficha completa en cada guardado. */
const EDICION = Object.fromEntries(
  Object.entries({ ...DEBTOR, birthDate: undefined }).filter(
    ([, v]) => v !== null,
  ),
) as typeof DEBTOR;

describe('updateDebtor: el formato solo si el teléfono cambió', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        permissions: [PERMISSIONS.EDIT_DEBTORS],
      },
      tenantId: TENANT.id,
    });
    mockPrisma.debtor.findFirst.mockResolvedValue({ phone: 'abc-def-ghi' });
    mockPrisma.debtor.update.mockResolvedValue({
      ...DEBTOR,
      phone: 'abc-def-ghi',
    });
  });

  it('cambiar a un teléfono inválido se rechaza y no escribe', async () => {
    const r = await updateDebtor({ ...EDICION, phone: 'xyz' });
    expect(r).toEqual({ success: false, error: MENSAJE_TELEFONO_INVALIDO });
    expect(mockPrisma.debtor.update).not.toHaveBeenCalled();
  });

  it('reenviar el teléfono viejo sin cambiarlo no bloquea la edición', async () => {
    const r = await updateDebtor({
      ...EDICION,
      phone: 'abc-def-ghi',
      name: 'Nuevo',
    });
    expect(r.error).toBeUndefined();
    expect(mockPrisma.debtor.update).toHaveBeenCalled();
  });
});
