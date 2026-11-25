/**
 * Unit test: `regenerateCaseDocument` solo regenera plantillas del tipo del
 * caso, como la generación manual (`generacion-manual-tipo-de-caso.test.ts`).
 *
 * Recibía un `templateId` cualquiera y lo generaba contra el caso: una
 * plantilla de insolvencia sobre un caso de conciliación salía igual. El
 * rechazo tiene que llegar antes de `resolveCaseFolder`, que puede crear la
 * carpeta del caso en Drive.
 */
jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...a: unknown[]) => mockAuthenticateUser(...a),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest
    .fn()
    .mockResolvedValue({ allowed: true, remainingAttempts: 5, resetInMs: 0 }),
  getRateLimitKey: (scope: string, id: string) => `${scope}:${id}`,
  RATE_LIMIT_CONFIGS: { documentGeneration: {} },
}));

jest.mock('@/features/case/case-access', () => ({
  assertCaseAccess: jest.fn().mockResolvedValue(undefined),
  assertCaseAccessOnRow: jest.fn().mockResolvedValue(undefined),
}));

const mockFetchCase = jest.fn();
jest.mock('@/features/document/persistence', () => ({
  fetchCaseForGeneration: (...a: unknown[]) => mockFetchCase(...a),
  asCaseWithRelations: (c: unknown) => c,
  persistGeneratedDocuments: jest.fn().mockResolvedValue(undefined),
  inferMimeType: () => 'application/pdf',
}));

jest.mock('@/features/document/generation-request', () => ({
  getGenerationRequests: jest.fn(),
  runWithGenerationLock: jest.fn(),
}));

const mockRegenerate = jest.fn().mockResolvedValue({ status: 'error' });
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn(),
  generateDocumentsForAdmission: jest.fn(),
  generateDocumentsForAgreement: jest.fn(),
  generateDocumentsForFailure: jest.fn(),
  regenerateDocument: (...a: unknown[]) => mockRegenerate(...a),
}));

const mockResolveCaseFolder = jest.fn().mockResolvedValue({
  folderId: 'carpeta-1',
  layoutVersion: 1,
  creada: false,
});
jest.mock('@/features/document/case-folder', () => ({
  resolveCaseFolder: (...a: unknown[]) => mockResolveCaseFolder(...a),
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { regenerateCaseDocument } from '@/features/document/actions-generation';

const TENANT_ID = 'tenant-1';

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  mockAuthenticateUser.mockResolvedValue({
    user: { ...ADMIN_USER, permissions: Object.values(P) },
    tenantId: TENANT_ID,
  });
});

const casoDeTipo = (type: string) => ({
  id: 'caso-1',
  type,
  driveFolderId: 'carpeta-1',
  layoutVersion: 1,
});

describe('regenerateCaseDocument — solo plantillas del tipo del caso', () => {
  it('una plantilla de insolvencia sobre un caso de conciliación: error claro, sin carpeta ni generación', async () => {
    mockFetchCase.mockResolvedValue(casoDeTipo('CONCILIATION'));

    const resultado = await regenerateCaseDocument({
      caseId: 'caso-1',
      templateId: 'tramite-audiencia',
    });

    expect(resultado).toEqual({
      success: false,
      error:
        'La plantilla "Tramite Audiencia" no corresponde a un caso de conciliación.',
    });
    expect(mockResolveCaseFolder).not.toHaveBeenCalled();
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('una plantilla de acuerdo de apoyo sobre un caso de insolvencia: también se rechaza', async () => {
    mockFetchCase.mockResolvedValue(casoDeTipo('INSOLVENCY'));

    const resultado = await regenerateCaseDocument({
      caseId: 'caso-1',
      templateId: 'apoyo-acuerdo',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain(
      'no corresponde a un caso de insolvencia',
    );
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('una plantilla del tipo del caso se regenera', async () => {
    mockFetchCase.mockResolvedValue(casoDeTipo('CONCILIATION'));

    await regenerateCaseDocument({
      caseId: 'caso-1',
      templateId: 'conc-acta-general',
    });

    expect(mockResolveCaseFolder).toHaveBeenCalledWith('caso-1', TENANT_ID);
    expect(mockRegenerate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'caso-1' }),
      'conc-acta-general',
      'carpeta-1',
    );
  });

  it('un id que no existe sigue llegando a regenerateDocument ("Plantilla no encontrada")', async () => {
    mockFetchCase.mockResolvedValue(casoDeTipo('INSOLVENCY'));

    await regenerateCaseDocument({
      caseId: 'caso-1',
      templateId: 'no-existe',
    });

    expect(mockRegenerate).toHaveBeenCalledWith(
      expect.anything(),
      'no-existe',
      'carpeta-1',
    );
  });

  it('un caso con un tipo desconocido no regenera', async () => {
    mockFetchCase.mockResolvedValue(casoDeTipo('OTRO'));

    const resultado = await regenerateCaseDocument({
      caseId: 'caso-1',
      templateId: 'tramite-audiencia',
    });

    expect(resultado).toEqual({
      success: false,
      error: 'Tipo de caso desconocido: OTRO',
    });
    expect(mockResolveCaseFolder).not.toHaveBeenCalled();
  });
});
