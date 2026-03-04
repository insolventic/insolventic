/**
 * Unit Tests: Debtor CRUD Server Actions (src/features/debtor/actions.ts)
 * Tests getAllDebtors, deleteDebtor with RBAC and cascade.
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

import { TENANT, ADMIN_USER, LAWYER_USER, DEBTOR, PERMISSIONS } from '../../helpers/fixtures';
import { getAllDebtors, deleteDebtor } from '@/features/debtor/actions';

describe('Debtor Actions — src/features/debtor/actions.ts', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
  });

  describe('getAllDebtors', () => {
    it('should return all debtors for admin user', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [
            PERMISSIONS.VIEW_DEBTORS,
            PERMISSIONS.VIEW_CASES,
            PERMISSIONS.VIEW_ALL_CASES,
          ],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.debtor.findMany.mockResolvedValue([]);

      const result = await getAllDebtors();

      expect(result.success).toBe(true);
      // Admin: queries all debtors without case filter
      expect(mockPrisma.debtor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT.id },
        }),
      );
    });

    it('should filter debtors by assigned cases for lawyer', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: LAWYER_USER.id,
          name: LAWYER_USER.name,
          email: LAWYER_USER.email,
          permissions: [
            PERMISSIONS.VIEW_DEBTORS,
            PERMISSIONS.VIEW_CASES,
            PERMISSIONS.VIEW_OWN_CASES,
          ],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.case.findMany.mockResolvedValue([
        { debtorId: DEBTOR.id },
      ]);
      mockPrisma.debtor.findMany.mockResolvedValue([]);

      const result = await getAllDebtors();

      expect(result.success).toBe(true);
      // Lawyer: first gets accessible case debtorIds
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT.id, operatorId: LAWYER_USER.id },
        select: { debtorId: true },
      });
    });

    it('should deny access without "Ver deudores" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-no-perms',
          name: 'No Perms',
          email: 'noperms@test.com',
          permissions: [],
        },
        tenantId: TENANT.id,
      });

      const result = await getAllDebtors();

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
    });
  });

  describe('deleteDebtor', () => {
    it('should cascade delete debtor with all related records', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_DEBTORS, PERMISSIONS.DELETE_DEBTORS],
        },
        tenantId: TENANT.id,
      });

      const mockTx = {
        case: {
          findMany: jest.fn().mockResolvedValue([{ id: 'case-1' }]),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        document: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        debt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        asset: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        legalProcess: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        libranza: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        suspendedService: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        dependent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        debtor: { delete: jest.fn().mockResolvedValue(DEBTOR) },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockTx));

      const result = await deleteDebtor(DEBTOR.id);

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should deny deletion without "Eliminar deudores" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: LAWYER_USER.id,
          name: LAWYER_USER.name,
          email: LAWYER_USER.email,
          permissions: [PERMISSIONS.VIEW_DEBTORS],
        },
        tenantId: TENANT.id,
      });

      const result = await deleteDebtor(DEBTOR.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
    });
  });
});
