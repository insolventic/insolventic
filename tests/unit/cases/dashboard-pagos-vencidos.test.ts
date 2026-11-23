/**
 * Unit Tests: el contador de pagos vencidos del dashboard respeta la
 * visibilidad por expediente.
 *
 * `getDashboardStats` acotaba todas sus métricas de casos por visibilidad
 * (ver todos / propios / como cliente), salvo una: `overduePayments` contaba
 * los pagos vencidos de TODO el centro. Un abogado o un cliente veía cuántas
 * cuotas vencidas había en expedientes que no le tocan. Ahora el conteo usa el
 * mismo alcance de `case-access` que el resto del tablero, en la relación
 * `case` del pago (como `payment/actions.ts`).
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

import { getDashboardStats } from '@/features/case/actions';
import { CASO_ACTIVO } from '@/lib/papelera';
import { P } from '@/lib/permissions';

const TENANT = 'tenant-1';
const DEUDOR_DEL_CLIENTE = 'deudor-del-cliente';

const usuario = (id: string, permissions: string[]) => ({
  id,
  email: `${id}@test.com`,
  name: id,
  permissions,
});

const ADMIN = usuario('admin', Object.values(P));
const ABOGADO = usuario('abogado', [P.VER_CASOS, P.VER_CASOS_PROPIOS]);
const CLIENTE = usuario('cliente', [P.VER_CASOS, P.VER_CASOS_CLIENTE]);
const SIN_ALCANCE = usuario('sin-alcance', [P.VER_CASOS, P.REGISTRAR_PAGOS]);

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  mockPrisma.debtor.findFirst.mockImplementation(
    async ({ where }: { where: { email?: string } }) =>
      where.email === CLIENTE.email ? { id: DEUDOR_DEL_CLIENTE } : null,
  );
  mockPrisma.payment.count.mockResolvedValue(7);
  // El resto del tablero, vacío: este test mira solo el conteo de pagos.
  mockPrisma.case.count.mockResolvedValue(0);
  mockPrisma.case.aggregate.mockResolvedValue({
    _sum: { totalDebt: null, creditors: null },
  });
  mockPrisma.case.groupBy.mockResolvedValue([]);
  mockPrisma.case.findMany.mockResolvedValue([]);
});

function sesion(user: ReturnType<typeof usuario>) {
  mockAuthenticateUser.mockResolvedValue({ user, tenantId: TENANT });
}

/** El `where` de la consulta de pagos vencidos. */
const wherePagosVencidos = () =>
  (mockPrisma.payment.count as jest.Mock).mock.calls[0][0].where;

/** El `where` del total de casos, que ya estaba acotado. */
const whereTotalCasos = () =>
  (mockPrisma.case.count as jest.Mock).mock.calls[0][0].where;

describe('getDashboardStats — pagos vencidos con el alcance del usuario', () => {
  it.each([
    ['ver todos', ADMIN, {}],
    ['ver propios', ABOGADO, { operatorId: ABOGADO.id }],
    ['cliente', CLIENTE, { debtorId: DEUDOR_DEL_CLIENTE }],
  ] as const)('%s', async (_nombre, user, alcance) => {
    sesion(user);

    const resultado = await getDashboardStats();

    expect(resultado.success).toBe(true);
    expect(resultado.data?.overduePayments).toBe(7);
    const where = wherePagosVencidos();
    expect(where.tenantId).toBe(TENANT);
    expect(where.status).toBe('pendiente');
    expect(where.case).toEqual({ ...CASO_ACTIVO, ...alcance });
    // El mismo alcance que el resto del tablero.
    expect(whereTotalCasos()).toEqual({ tenantId: TENANT, ...alcance });
  });

  it('sin permiso de alcance: no consulta nada y el contador queda en 0', async () => {
    sesion(SIN_ALCANCE);

    const resultado = await getDashboardStats();

    expect(resultado.success).toBe(true);
    expect(resultado.data?.overduePayments).toBe(0);
    expect(mockPrisma.payment.count).not.toHaveBeenCalled();
    expect(mockPrisma.case.count).not.toHaveBeenCalled();
  });

  it('cliente sin ficha de deudor: tampoco ve pagos vencidos', async () => {
    sesion({ ...CLIENTE, email: 'sin-ficha@test.com' });

    const resultado = await getDashboardStats();

    expect(resultado.data?.overduePayments).toBe(0);
    expect(mockPrisma.payment.count).not.toHaveBeenCalled();
  });

  it('sin `Ver casos` no hay tablero', async () => {
    sesion(usuario('nadie', []));
    const resultado = await getDashboardStats();
    expect(resultado.success).toBe(false);
    expect(mockPrisma.payment.count).not.toHaveBeenCalled();
  });
});
