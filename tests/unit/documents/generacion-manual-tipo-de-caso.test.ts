/**
 * Unit test: la generación manual (`/documents` → `planBatchGeneration` →
 * `batchGenerateDocuments`) solo debe procesar plantillas del tipo del caso.
 *
 * Las rutas automáticas ya filtran por `caseType` (`getTemplatesForCaseCreation`
 * y compañía, templates-config.ts). La manual resuelve las plantillas con
 * `resolveTemplatesToProcess`, que filtra por ids o por paquete, y los números
 * de paquete se comparten entre tipos: el "Paquete 3" de conciliación (Actas)
 * es el mismo número que el "Paquete 3" de insolvencia (Negociación y
 * Acuerdo, donde vive el Trámite Audiencia).
 *
 * Se prueba el comportamiento correcto: si falla, la generación manual le
 * aplica plantillas de insolvencia a un caso de conciliación. Antes del
 * arreglo fallaban 4 de los 5 casos originales: conciliación con "Paquete 3"
 * recibía el Trámite Audiencia y 5 plantillas más de insolvencia (y una de
 * acuerdo de apoyo), y con "Todos" 53 plantillas de otros tipos.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
import {
  findManyDeImagenes,
  firmasDelCentro,
} from '../../helpers/imagenes-privadas';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: jest.fn().mockResolvedValue({
    claimed: true,
    request: { id: 'req-1', kind: 'BATCH', status: 'PENDING' },
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

const mockPrepareTemplate = jest.fn().mockResolvedValue({
  htmlContent: '<html>sin placeholders</html>',
  html: '<html>sin placeholders</html>',
  placeholders: {},
  unresolved: [],
  coveragePercentage: 100,
  missing: [],
  empty: [],
});
jest.mock('@/features/document/prepare-template', () => ({
  prepareTemplate: (...args: unknown[]) => mockPrepareTemplate(...args),
  variantDisplayName: (template: { name: string }) => template.name,
  SIN_VARIANTE: { suffix: '', label: '', overlay: {} },
}));

jest.mock('@/lib/html-to-pdf', () => ({
  batchHtmlToPdf: jest
    .fn()
    .mockImplementation((inputs: Array<{ filename: string }>) =>
      Promise.resolve({
        ok: inputs.map((i) => ({
          filename: i.filename.replace(/\.html$/, '.pdf'),
          buffer: Buffer.from('pdf'),
        })),
        failed: [],
      }),
    ),
}));

jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: jest.fn().mockResolvedValue('center-folder-id'),
    getFolderUrl: jest.fn().mockReturnValue('https://drive.example/folder'),
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
import {
  ALL_TEMPLATES,
  resolveTemplatesToProcess,
  type CaseType,
} from '@/features/document/templates-config';
import {
  isPlantillasDeOtroTipoError,
  type PlantillasDeOtroTipoError,
} from '@/features/document/tipo-de-caso';
import { claimGenerationRequest } from '@/features/document/generation-request';

const TENANT_ID = 'armonia';

const tipoDe = (id: string): CaseType | undefined =>
  ALL_TEMPLATES.find((t) => t.id === id)?.caseType;

function casoDeTipo(type: CaseType) {
  return {
    id: 'case-1',
    caseNumber: type === 'CONCILIATION' ? 'CONC-000001' : 'INSOL-000001',
    debtorName: 'Juan Pérez',
    type,
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
  };
}

function usarCaso(type: CaseType) {
  const caso = casoDeTipo(type);
  mockPrisma.case.findUnique.mockResolvedValue(caso);
  mockPrisma.case.findFirst.mockResolvedValue(caso);
}

async function idsPlanificados(packageNumber?: 3) {
  const plan = await planBatchGeneration({ caseId: 'case-1', packageNumber });
  expect(plan.success).toBe(true);
  return plan.data!.tandas.flat();
}

describe('generación manual — solo plantillas del tipo del caso', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    _resetRateLimitStore();
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(firmasDelCentro(TENANT_ID)),
    );
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT_ID,
    });
    mockPrisma.document.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `doc-${data.name}`, ...data }),
    );
  });

  it('sanity: el número de paquete 3 existe en los tres tipos', () => {
    const tiposDelPaquete3 = new Set(
      ALL_TEMPLATES.filter((t) => t.packageNumber === 3).map((t) => t.caseType),
    );
    expect(tiposDelPaquete3).toEqual(
      new Set(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT']),
    );
    expect(tipoDe('tramite-audiencia')).toBe('INSOLVENCY');
    expect(tipoDe('conc-acta-general')).toBe('CONCILIATION');
  });

  it('caso de conciliación, "Paquete 3": planifica solo plantillas de conciliación', async () => {
    usarCaso('CONCILIATION');

    const ids = await idsPlanificados(3);

    // Que el filtro no vacíe el paquete: las actas tienen que seguir.
    expect(ids).toContain('conc-acta-general');
    expect(ids).not.toContain('tramite-audiencia');
    expect(ids.filter((id) => tipoDe(id) !== 'CONCILIATION')).toEqual([]);
  });

  it('caso de conciliación, "Todos los paquetes": planifica solo plantillas de conciliación', async () => {
    usarCaso('CONCILIATION');

    const ids = await idsPlanificados();

    expect(ids).toContain('conc-acta-general');
    expect(ids.filter((id) => tipoDe(id) !== 'CONCILIATION')).toEqual([]);
  });

  it('control: caso de insolvencia, "Paquete 3": planifica el Trámite Audiencia y nada de conciliación', async () => {
    usarCaso('INSOLVENCY');

    const ids = await idsPlanificados(3);

    expect(ids).toContain('tramite-audiencia');
    expect(ids.filter((id) => tipoDe(id) !== 'INSOLVENCY')).toEqual([]);
  });

  it('caso de acuerdo de apoyo, "Todos los paquetes": planifica solo sus 3 plantillas', async () => {
    usarCaso('SUPPORT_AGREEMENT');

    const ids = await idsPlanificados();

    expect([...ids].sort()).toEqual(
      ALL_TEMPLATES.filter((t) => t.caseType === 'SUPPORT_AGREEMENT')
        .map((t) => t.id)
        .sort(),
    );
  });

  it('planBatchGeneration con ids explícitos de otro tipo devuelve un error claro', async () => {
    usarCaso('CONCILIATION');

    const plan = await planBatchGeneration({
      caseId: 'case-1',
      templateIds: ['tramite-audiencia', 'conc-acta-general'],
    });

    expect(plan).toEqual({
      success: false,
      message:
        'La plantilla "Tramite Audiencia" no corresponde a un caso de conciliación.',
      data: null,
    });
  });

  it('batchGenerateDocuments con un id de otro tipo devuelve un error claro y no prepara ni reclama nada', async () => {
    usarCaso('CONCILIATION');

    const resultado = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['tramite-audiencia', 'conc-acta-general'],
    });

    expect(resultado).toEqual({
      success: false,
      message:
        'La plantilla "Tramite Audiencia" no corresponde a un caso de conciliación.',
      data: null,
    });
    expect(mockPrepareTemplate).not.toHaveBeenCalled();
    // Se rechaza antes del lock: no deja una fila de DocumentGenerationRequest.
    expect(claimGenerationRequest).not.toHaveBeenCalled();
  });

  it('batchGenerateDocuments con ids del tipo del caso sigue generando', async () => {
    usarCaso('CONCILIATION');

    const resultado = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['conc-acta-general'],
    });

    expect(resultado.success).toBe(true);
    const preparadas = mockPrepareTemplate.mock.calls.map(
      ([template]) => (template as { id: string }).id,
    );
    expect(preparadas).toEqual(['conc-acta-general']);
  });
});

describe('resolveTemplatesToProcess — dentro del tipo del caso', () => {
  it('por paquete: solo el tipo pedido', () => {
    for (const caseType of [
      'INSOLVENCY',
      'CONCILIATION',
      'SUPPORT_AGREEMENT',
    ] as const) {
      const plantillas = resolveTemplatesToProcess({
        caseType,
        packageNumber: 3,
      });
      expect(plantillas.length).toBeGreaterThan(0);
      expect(plantillas.every((t) => t.caseType === caseType)).toBe(true);
    }
  });

  it('sin paquete: todas las del tipo, que suman las 65', () => {
    const porTipo = (
      ['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'] as const
    ).map((caseType) => resolveTemplatesToProcess({ caseType }).length);
    expect(porTipo).toEqual([50, 12, 3]);
    expect(porTipo.reduce((a, b) => a + b, 0)).toBe(ALL_TEMPLATES.length);
  });

  it('ids explícitos de otro tipo: PlantillasDeOtroTipoError con los ids ajenos', () => {
    let capturado: unknown;
    try {
      resolveTemplatesToProcess({
        caseType: 'INSOLVENCY',
        templateIds: [
          'tramite-audiencia',
          'conc-acta-general',
          'apoyo-acuerdo',
        ],
      });
    } catch (error) {
      capturado = error;
    }
    expect(isPlantillasDeOtroTipoError(capturado)).toBe(true);
    expect((capturado as PlantillasDeOtroTipoError).templateIds).toEqual([
      'conc-acta-general',
      'apoyo-acuerdo',
    ]);
  });
});
