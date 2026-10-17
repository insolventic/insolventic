/**
 * Unit test: el rate limit de generación por lotes (`batchDocumentGeneration`,
 * 5 intentos / 10 min) se cobra por LOTE, no por tanda (GD-A1, issue #3,
 * revisión de PR #140).
 *
 * `batchGenerateDocuments` solo revisa el límite cuando `requestId` está
 * ausente (la primera tanda de un lote) — ver actions.ts. Sin esto, un lote
 * de 65 plantillas (7 tandas de a 10) se habría bloqueado A SÍ MISMO a mitad
 * de camino: la tanda 6 habría chocado contra el límite de 5, nunca
 * terminando un solo lote completo.
 *
 * Usa el rate limiter REAL (no mockeado) para probar el comportamiento de
 * verdad, no solo que `checkRateLimit` se llama — mismo criterio que
 * `batch-generate-retry.test.ts` con `withRetry`.
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

// El lock de generación no es lo que este test prueba — se simplifica a
// "siempre concede", para que lo único que pueda bloquear un lote sea el
// rate limit real.
let claimCounter = 0;
jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: jest.fn(() => {
    claimCounter += 1;
    return Promise.resolve({
      claimed: true,
      request: { id: `req-${claimCounter}`, kind: 'BATCH', status: 'PENDING' },
    });
  }),
  markGenerationProcessing: jest.fn().mockResolvedValue(undefined),
  completeGenerationRequest: jest.fn().mockResolvedValue(undefined),
  failGenerationRequest: jest.fn().mockResolvedValue(undefined),
  continueOrResumeGenerationRequest: jest.fn().mockResolvedValue({ ok: true }),
  recordBatchTandaProgress: jest.fn().mockResolvedValue(undefined),
  finalizeBatchGenerationRequest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Fase 1 fuera de alcance: se fija para llegar determinísticamente a la
// Fase 3 en cada tanda, sin importar cuántas plantillas traiga.
jest.mock('@/features/document/prepare-template', () => ({
  prepareTemplate: jest.fn().mockResolvedValue({
    htmlContent: '<html>sin placeholders</html>',
    html: '<html>sin placeholders</html>',
    placeholders: {},
    unresolved: [],
    coveragePercentage: 100,
    missing: [],
    empty: [],
  }),
  variantDisplayName: (template: { name: string }) => template.name,
  SIN_VARIANTE: { suffix: '', label: '', overlay: {} },
}));

jest.mock('@/lib/html-to-pdf', () => ({
  batchHtmlToPdf: jest
    .fn()
    .mockImplementation(
      (
        inputs: Array<{ filename: string }>,
      ): Promise<Array<{ filename: string; buffer: Buffer }>> =>
        Promise.resolve(
          inputs.map((i) => ({
            filename: i.filename.replace(/\.html$/, '.pdf'),
            buffer: Buffer.from('pdf'),
          })),
        ),
    ),
}));

jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: jest.fn().mockResolvedValue('center-folder-id'),
    uploadDocumentToCase: jest.fn().mockResolvedValue({
      fileId: 'file-1',
      fileUrl: 'https://drive.example/file/file-1',
    }),
  },
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import {
  batchGenerateDocuments,
  planBatchGeneration,
} from '@/features/document/actions';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { ALL_TEMPLATES } from '@/features/document/templates-config';

const TENANT_ID = 'armonia';

/** Corre un lote completo (todas sus tandas, en orden) y devuelve el último resultado. */
async function correrLoteCompleto(tandas: string[][]) {
  let requestId: string | undefined;
  let ultimo;
  for (let i = 0; i < tandas.length; i++) {
    ultimo = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: tandas[i],
      requestId,
      isFinalTanda: i === tandas.length - 1,
    });
    if (!ultimo.success) return ultimo;
    requestId = (ultimo.data as { requestId?: string } | null)?.requestId;
  }
  return ultimo!;
}

describe('batchDocumentGeneration — el límite se cobra por lote, no por tanda', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    claimCounter = 0;
    _resetRateLimitStore();
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT_ID,
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      caseNumber: 'INSOL-000001',
      debtorName: 'Juan Pérez',
      type: 'INSOLVENCY',
      operatorId: ADMIN_USER.id,
      debtorId: 'debtor-1',
      tenantId: TENANT_ID,
      debtor: { name: 'Juan Pérez' },
      debts: [],
      assets: [],
      documents: [],
      libranzas: [],
      suspendedServices: [],
      dependents: [],
      legalProcesses: [],
      operator: ADMIN_USER,
    });
    mockPrisma.document.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `doc-${data.name}`, ...data }),
    );
  });

  it('planBatchGeneration sobre TODOS los templates (65) produce exactamente 7 tandas', async () => {
    const plan = await planBatchGeneration({ caseId: 'case-1' });

    expect(plan.success).toBe(true);
    expect(ALL_TEMPLATES.length).toBe(65);
    expect(plan.data!.tandas).toHaveLength(7);
    expect(plan.data!.tandas.map((t) => t.length)).toEqual([
      10, 10, 10, 10, 10, 10, 5,
    ]);
  });

  it('un lote de 65 plantillas (7 tandas) NO se bloquea a sí mismo: las 7 tandas corren sin chocar contra el límite de 5', async () => {
    const plan = await planBatchGeneration({ caseId: 'case-1' });
    const tandas = plan.data!.tandas;
    expect(tandas).toHaveLength(7); // sanity: si esto cambia, el test de abajo no prueba lo que dice.

    const resultado = await correrLoteCompleto(tandas);

    expect(resultado.success).toBe(true);
    // Si el límite se cobrara por tanda, la 6ª (de 7) habría chocado contra
    // el máximo de 5 intentos y el lote nunca habría llegado a la 7ª.
  });

  it('5 lotes completos seguidos caben en el límite; el 6º lote (su primera tanda) queda bloqueado', async () => {
    const plan = await planBatchGeneration({ caseId: 'case-1' });
    const tandas = plan.data!.tandas;

    for (let lote = 1; lote <= 5; lote++) {
      const resultado = await correrLoteCompleto(tandas);
      expect(resultado.success).toBe(true);
    }

    // El 6º lote: su PRIMERA tanda (sin requestId) es la que paga el costo
    // del límite, y ya se gastaron los 5 intentos de la ventana de 10 min.
    const sexto = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: tandas[0],
      isFinalTanda: false,
    });

    expect(sexto.success).toBe(false);
    expect(sexto.message).toContain('Demasiadas solicitudes');
  });

  it('dentro de un lote YA en curso, las tandas 2+ (con requestId) nunca pagan el límite — ni agotado el límite se bloquean a mitad de un lote que ya empezó', async () => {
    const plan = await planBatchGeneration({ caseId: 'case-1' });
    const tandas = plan.data!.tandas;

    // Agotar el límite con 5 lotes completos.
    for (let lote = 1; lote <= 5; lote++) {
      await correrLoteCompleto(tandas);
    }

    // Un 6º lote que YA reclamó su requestId (tanda 1 corrió antes de que se
    // agotara el límite, en un escenario real) puede seguir con sus tandas
    // restantes aunque el límite ya esté en cero — porque esas llamadas
    // llevan `requestId` y no vuelven a pagar el costo.
    const continuacion = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: tandas[1],
      requestId: 'req-ya-reclamado',
      isFinalTanda: false,
    });

    expect(continuacion.success).toBe(true);
  });
});
