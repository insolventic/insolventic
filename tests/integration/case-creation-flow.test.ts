/**
 * Integration Tests: Full Case Creation Flow
 * Tests the complete flow from authentication → case creation → document generation trigger.
 * Validates that all server actions work together correctly.
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

const mockGenerateDocuments = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: (...args: unknown[]) => mockGenerateDocuments(...args),
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
} from '../helpers/fixtures';

import { createCase, getAllCases, getCaseById, deleteCase } from '@/features/case/actions';

describe('Integration: Case Creation Flow', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    mockGenerateDocuments.mockReset();
    jest.clearAllMocks();
  });

  describe('Full lifecycle: Create → Read → Delete', () => {
    it('should create a case with auto-generated case number', async () => {
      // Setup: Admin user authenticated
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [
            PERMISSIONS.VIEW_CASES,
            PERMISSIONS.VIEW_ALL_CASES,
            PERMISSIONS.CREATE_CASES,
            PERMISSIONS.DELETE_CASES,
          ],
        },
        tenantId: TENANT.id,
      });

      // Mock: No existing cases (for case number generation)
      mockPrisma.case.findFirst.mockResolvedValue(null);
      mockPrisma.case.count.mockResolvedValue(0);

      // Mock: Debtor exists
      mockPrisma.debtor.findUnique.mockResolvedValue(DEBTOR);
      mockPrisma.debtor.update.mockResolvedValue(DEBTOR);

      // Mock: Case creation
      const createdCase = {
        ...CASE_DATA,
        id: 'new-case-id',
        caseNumber: 'CASO-000001',
      };
      mockPrisma.case.create.mockResolvedValue(createdCase);

      const result = await createCase({
        debtorId: DEBTOR.id,
        type: 'INSOLVENCY',
        totalDebt: '50000000',
        creditors: '3',
        operatorId: ADMIN_USER.id,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.case.create).toHaveBeenCalled();
    });

    it('should trigger document generation after case creation', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.CREATE_CASES, PERMISSIONS.VIEW_ALL_CASES],
        },
        tenantId: TENANT.id,
      });

      mockPrisma.case.findFirst.mockResolvedValue(null);
      mockPrisma.case.count.mockResolvedValue(0);
      mockPrisma.debtor.findUnique.mockResolvedValue(DEBTOR);
      mockPrisma.debtor.update.mockResolvedValue(DEBTOR);

      const createdCase = { ...CASE_DATA, id: 'new-case-id' };
      mockPrisma.case.create.mockResolvedValue(createdCase);

      // Also mock the case retrieval that generateDocuments might need
      mockPrisma.case.findUnique.mockResolvedValue({
        ...createdCase,
        debtor: DEBTOR,
        operator: ADMIN_USER,
        debts: [],
        assets: [],
        documents: [],
      });

      await createCase({
        debtorId: DEBTOR.id,
        type: 'INSOLVENCY',
        totalDebt: '50000000',
        creditors: '3',
        operatorId: ADMIN_USER.id,
      });

      // Document generation should have been triggered
      expect(mockGenerateDocuments).toHaveBeenCalled();
    });

    it('should deny case creation without "Crear casos" permission', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: LAWYER_USER.id,
          name: LAWYER_USER.name,
          email: LAWYER_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
        },
        tenantId: TENANT.id,
      });

      const result = await createCase({
        debtorId: DEBTOR.id,
        type: 'INSOLVENCY',
        totalDebt: '50000000',
        creditors: '3',
        operatorId: LAWYER_USER.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
      expect(mockPrisma.case.create).not.toHaveBeenCalled();
    });
  });

  describe('Tenant isolation', () => {
    it('should only return cases from the authenticated tenant', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_ALL_CASES],
        },
        tenantId: 'tenant-A',
      });

      mockPrisma.case.findMany.mockResolvedValue([]);

      await getAllCases();

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-A' }),
        }),
      );
    });

    it('getCaseById should scope to tenant', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          permissions: [PERMISSIONS.VIEW_CASES],
        },
        tenantId: 'tenant-A',
      });

      mockPrisma.case.findUnique.mockResolvedValue(null);

      await getCaseById('some-case-id');

      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-A',
          }),
        }),
      );
    });
  });

  describe('RBAC visibility matrix', () => {
    const testCases = [
      {
        role: 'Administrador',
        permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_ALL_CASES],
        expectedFilter: { tenantId: TENANT.id },
        description: 'should see all cases',
      },
      {
        role: 'Abogado',
        permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
        expectedFilter: { tenantId: TENANT.id, operatorId: LAWYER_USER.id },
        description: 'should only see assigned cases',
      },
    ];

    testCases.forEach(({ role, permissions, expectedFilter, description }) => {
      it(`${role}: ${description}`, async () => {
        const userId = role === 'Abogado' ? LAWYER_USER.id : ADMIN_USER.id;

        mockAuthenticateUser.mockResolvedValue({
          user: { id: userId, name: role, email: `${role}@test.com`, permissions },
          tenantId: TENANT.id,
        });

        mockPrisma.case.findMany.mockResolvedValue([]);

        await getAllCases();

        expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expectedFilter,
          }),
        );
      });
    });
  });
});
