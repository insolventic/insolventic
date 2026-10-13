/**
 * Unit Tests: Case CRUD Server Actions (src/features/case/actions.ts)
 * Tests getAllCases, getCaseById, createCase, deleteCase
 * with RBAC permission filtering and tenant isolation.
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

// Mock authenticateUser to control user context per test
const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

// Mock document generation (not relevant for case CRUD tests)
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));

import {
  TENANT,
  ADMIN_USER,
  LAWYER_USER,
  DEBTOR,
  CASE_DATA,
  PERMISSIONS,
} from '../../helpers/fixtures';

import { getAllCases, getCaseById, deleteCase } from '@/features/case/actions';

describe('Case Actions — src/features/case/actions.ts', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
  });

  describe('getAllCases', () => {
    it('should query all cases without operatorId filter for admin', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_ALL_CASES],
        },
        tenantId: TENANT.id,
      });

      // Return empty to avoid Zod schema complexity; focus on query behavior
      mockPrisma.case.findMany.mockResolvedValue([]);

      const result = await getAllCases();

      expect(result.success).toBe(true);
      // Admin sees all cases — no operatorId filter
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT.id },
        }),
      );
    });

    it('should filter by operatorId for lawyer with "Ver casos propios"', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: LAWYER_USER.id,
          name: LAWYER_USER.name,
          email: LAWYER_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.case.findMany.mockResolvedValue([]);

      const result = await getAllCases();

      expect(result.success).toBe(true);
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT.id,
            operatorId: LAWYER_USER.id,
          },
        }),
      );
    });

    it('should filter by debtorId for client user with "Ver casos como cliente"', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-client-id',
          name: 'Client User',
          email: 'client@test.com',
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_AS_CLIENT],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.debtor.findFirst.mockResolvedValue({ id: DEBTOR.id });
      mockPrisma.case.findMany.mockResolvedValue([]);

      const result = await getAllCases();

      expect(result.success).toBe(true);
      expect(mockPrisma.debtor.findFirst).toHaveBeenCalledWith({
        where: { email: 'client@test.com', tenantId: TENANT.id },
        select: { id: true },
      });
    });

    it('should return empty array for client user not found as debtor', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-client-id',
          name: 'Client User',
          email: 'client@test.com',
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_AS_CLIENT],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.debtor.findFirst.mockResolvedValue(null);

      const result = await getAllCases();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should deny access when user lacks "Ver casos" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-no-perms',
          name: 'No Perms',
          email: 'noperms@test.com',
          permissions: [], // No permissions
        },
        tenantId: TENANT.id,
      });

      const result = await getAllCases();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tienes permisos');
    });

    it('should return error when authentication fails', async () => {
      mockAuthenticateUser.mockRejectedValue(new Error('Token inválido'));

      const result = await getAllCases();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return empty for user with no visibility scope', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-limited',
          name: 'Limited',
          email: 'limited@test.com',
          permissions: [PERMISSIONS.VIEW_CASES], // Has base permission but no scope
        },
        tenantId: TENANT.id,
      });

      const result = await getAllCases();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getCaseById', () => {
    it('should query case by id scoped to tenant', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_ALL_CASES],
        },
        tenantId: TENANT.id,
      });

      // Return null to test the "not found" path — simpler than full mock
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await getCaseById('case-test-id');

      // Verify the query is scoped to tenant
      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-test-id', tenantId: TENANT.id },
        }),
      );
    });

    it('should return error for non-existent case', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.case.findUnique.mockResolvedValue(null);

      const result = await getCaseById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no encontrado');
    });

    it('should deny access without "Ver casos" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-no-perms',
          name: 'No Perms',
          email: 'noperms@test.com',
          permissions: [],
        },
        tenantId: TENANT.id,
      });

      const result = await getCaseById('case-test-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tienes permisos');
    });
  });

  describe('deleteCase', () => {
    it('should use $transaction for cascading delete', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          // GC-A1: `VIEW_ALL_CASES` se añade porque `deleteCase` ahora aplica
          // visibilidad por fila. No es relajar el test: el usuario que tenía
          // (`VER_CASOS` + `ELIMINAR_CASOS` sin ningún permiso de alcance) no
          // corresponde a ningún rol del seed — el Administrador real sí tiene
          // `Ver todos los casos`. La fixture era la irreal.
          permissions: [
            PERMISSIONS.VIEW_CASES,
            PERMISSIONS.VIEW_ALL_CASES,
            PERMISSIONS.DELETE_CASES,
          ],
        },
        tenantId: TENANT.id,
      });

      // Mock finding the case first
      mockPrisma.case.findUnique.mockResolvedValue(CASE_DATA);

      // Mock transaction
      const deletedCase = { ...CASE_DATA, debtorName: 'Test' };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        return fn({
          document: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          debt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          asset: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          legalProcess: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          libranza: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          suspendedService: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          dependent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          case: { delete: jest.fn().mockResolvedValue(deletedCase) },
        });
      });

      await deleteCase({ id: 'case-test-id' });

      // Transaction should be called (cascading delete)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should deny deletion without "Eliminar casos" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: LAWYER_USER.id,
          name: LAWYER_USER.name,
          email: LAWYER_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
        },
        tenantId: TENANT.id,
      });

      const result = await deleteCase({ id: 'case-test-id' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
    });
  });
});
