/**
 * Regresión de GC-M5: los reportes scopeaban por `tenantId` y nada más.
 *
 * `report/actions.ts` no contenía **ninguna** referencia a `VER_CASOS_PROPIOS`
 * ni a `operatorId`, así que un rol limitado a sus propios expedientes obtenía
 * por vía de los reportes los agregados y el detalle de todos los casos del
 * centro. Mismo vector que GC-A1 por otra puerta. Pagos y Calendario sí lo
 * aplicaban: Reportes era la anomalía.
 *
 * Los asserts son sobre el `where` que se le pasa a Prisma, no sobre el
 * resultado: con el mock devolviendo `[]` un `where` demasiado amplio daría el
 * mismo reporte vacío y el test no probaría nada.
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

import { TENANT, PERMISSIONS } from '../../helpers/fixtures';
import {
  getCaseStatusReport,
  getFinancialReport,
  exportCasesToExcel,
} from '@/features/report/actions';

const P = PERMISSIONS;
const VER_REPORTES = 'Ver reportes';

function signIn(permissions: string[], id = 'user-bajo-prueba') {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id,
      name: 'Usuario',
      email: 'u@test.com',
      professionalCard: 'TP-1',
      permissions,
    },
    tenantId: TENANT.id,
  });
}

describe('reportes — scoping por rol (GC-M5)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
  });

  describe('getCaseStatusReport', () => {
    it('Administrador (ve todos) no añade filtro de fila', async () => {
      signIn([VER_REPORTES, P.VIEW_ALL_CASES]);

      await getCaseStatusReport();

      const where = mockPrisma.case.groupBy.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT.id);
      expect(where.operatorId).toBeUndefined();
      expect(where.id).toBeUndefined();
    });

    it('Abogado (ve los propios) filtra por operatorId en TODAS las consultas', async () => {
      signIn([VER_REPORTES, P.VIEW_OWN_CASES], 'user-abogado');

      await getCaseStatusReport();

      // groupBy ×2, aggregate ×1, count ×1 — las cuatro tienen que llevarlo.
      for (const call of mockPrisma.case.groupBy.mock.calls) {
        expect(call[0].where.operatorId).toBe('user-abogado');
      }
      expect(mockPrisma.case.aggregate.mock.calls[0][0].where.operatorId).toBe(
        'user-abogado',
      );
      expect(mockPrisma.case.count.mock.calls[0][0].where.operatorId).toBe(
        'user-abogado',
      );
    });

    it('cliente filtra por su debtorId', async () => {
      signIn([VER_REPORTES, P.VIEW_AS_CLIENT]);
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-cliente' });

      await getCaseStatusReport();

      expect(mockPrisma.case.groupBy.mock.calls[0][0].where.debtorId).toBe(
        'debtor-cliente',
      );
    });

    it('un rol con VER_REPORTES pero sin alcance obtiene un reporte en ceros', async () => {
      signIn([VER_REPORTES]);

      const result = await getCaseStatusReport();

      // El where no matchea nada: NO es un where vacío (que daría todo).
      const where = mockPrisma.case.groupBy.mock.calls[0][0].where;
      expect(where.id).toEqual({ in: [] });
      expect(result.success).toBe(true);
      expect(result.data?.totalCases).toBe(0);
      expect(result.data?.totalAmount).toBe(0);
    });

    it('sin VER_REPORTES no consulta nada', async () => {
      signIn([P.VIEW_ALL_CASES]);

      const result = await getCaseStatusReport();

      expect(result.success).toBe(false);
      expect(mockPrisma.case.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getFinancialReport', () => {
    it('Abogado: el scope llega al findMany de casos Y al de deudas', async () => {
      signIn([VER_REPORTES, P.VIEW_OWN_CASES], 'user-abogado');

      await getFinancialReport();

      expect(mockPrisma.case.findMany.mock.calls[0][0].where).toEqual({
        tenantId: TENANT.id,
        operatorId: 'user-abogado',
      });
      // La deuda se filtra por su expediente: si el expediente no es visible,
      // su deuda tampoco.
      expect(mockPrisma.debt.findMany.mock.calls[0][0].where).toEqual({
        case: { tenantId: TENANT.id, operatorId: 'user-abogado' },
      });
    });

    it('Administrador no lleva filtro de fila', async () => {
      signIn([VER_REPORTES, P.VIEW_ALL_CASES]);

      await getFinancialReport();

      expect(mockPrisma.case.findMany.mock.calls[0][0].where).toEqual({
        tenantId: TENANT.id,
      });
    });
  });

  describe('exportCasesToExcel', () => {
    it('Abogado exporta solo sus expedientes', async () => {
      signIn([VER_REPORTES, P.VIEW_OWN_CASES], 'user-abogado');

      await exportCasesToExcel();

      const where = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(where.operatorId).toBe('user-abogado');
      expect(where.tenantId).toBe(TENANT.id);
    });

    it('un rol sin alcance exporta un archivo vacío, no el centro entero', async () => {
      signIn([VER_REPORTES]);

      await exportCasesToExcel();

      expect(mockPrisma.case.findMany.mock.calls[0][0].where.id).toEqual({
        in: [],
      });
    });
  });
});
