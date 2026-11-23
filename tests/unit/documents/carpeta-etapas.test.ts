/**
 * Gestión de Casos → Documentos: regenerar y las etapas (admisión, acuerdo,
 * fracaso) piden la carpeta a `resolveCaseFolder`.
 *
 * Antes, sin `driveFolderId` respondían «El caso no tiene una carpeta de Google
 * Drive asociada» y no generaban. Ahora la carpeta se crea (v1) y se genera en
 * ella; un caso v0 sigue generando en su carpeta, sin 01-Generados.
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
  runWithGenerationLock: async (
    _params: unknown,
    produce: () => Promise<unknown[]>,
  ) => ({ ok: true, requestId: 'req-1', documents: await produce() }),
}));

const mockAdmission = jest.fn().mockResolvedValue([]);
const mockAgreement = jest.fn().mockResolvedValue([]);
const mockFailure = jest.fn().mockResolvedValue([]);
const mockRegenerate = jest.fn().mockResolvedValue({ status: 'error' });
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn(),
  generateDocumentsForAdmission: (...a: unknown[]) => mockAdmission(...a),
  generateDocumentsForAgreement: (...a: unknown[]) => mockAgreement(...a),
  generateDocumentsForFailure: (...a: unknown[]) => mockFailure(...a),
  regenerateDocument: (...a: unknown[]) => mockRegenerate(...a),
}));

const mockResolveCaseFolder = jest.fn();
jest.mock('@/features/document/case-folder', () => ({
  resolveCaseFolder: (...a: unknown[]) => mockResolveCaseFolder(...a),
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import {
  generateAdmissionDocuments,
  generateAgreementDocuments,
  generateFailureDocuments,
  regenerateCaseDocument,
} from '@/features/document/actions-generation';

const TENANT_ID = 'tenant-1';

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockAuthenticateUser.mockResolvedValue({
    user: { ...ADMIN_USER, permissions: Object.values(P) },
    tenantId: TENANT_ID,
  });
});

const acciones: Array<
  [string, () => Promise<{ success: boolean }>, jest.Mock]
> = [
  ['admisión', () => generateAdmissionDocuments('caso-1'), mockAdmission],
  ['acuerdo', () => generateAgreementDocuments('caso-1'), mockAgreement],
  [
    'fracaso',
    () => generateFailureDocuments('caso-1', 'vencimiento-terminos'),
    mockFailure,
  ],
  [
    'regenerar',
    () =>
      regenerateCaseDocument({
        caseId: 'caso-1',
        templateId: 'solicitud-insolvencia',
      }),
    mockRegenerate,
  ],
];

describe.each(acciones)(
  '%s y la carpeta del caso',
  (_nombre, accion, generar) => {
    it('sin carpeta guardada, la crea con resolveCaseFolder y genera en ella (antes respondía error)', async () => {
      mockFetchCase.mockResolvedValue({
        id: 'caso-1',
        driveFolderId: null,
        layoutVersion: 0,
      });
      mockResolveCaseFolder.mockResolvedValue({
        folderId: 'carpeta-creada',
        layoutVersion: 1,
        creada: true,
      });

      const resultado = await accion();

      expect(resultado.success).toBe(true);
      expect(mockResolveCaseFolder).toHaveBeenCalledWith('caso-1', TENANT_ID);
      const [caso, ...resto] = generar.mock.calls[0];
      expect(resto).toContain('carpeta-creada');
      // El layout recién guardado viaja con el caso: anida en 01-Generados.
      expect(caso).toMatchObject({ layoutVersion: 1 });
    });

    it('caso v0 con carpeta guardada: genera en ella y conserva el layout 0', async () => {
      mockFetchCase.mockResolvedValue({
        id: 'caso-1',
        driveFolderId: 'carpeta-v0',
        layoutVersion: 0,
      });
      mockResolveCaseFolder.mockResolvedValue({
        folderId: 'carpeta-v0',
        layoutVersion: 0,
        creada: false,
      });

      await accion();

      const [caso, ...resto] = generar.mock.calls[0];
      expect(resto).toContain('carpeta-v0');
      expect(caso).toMatchObject({ layoutVersion: 0 });
    });
  },
);
