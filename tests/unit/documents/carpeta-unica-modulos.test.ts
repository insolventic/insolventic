/**
 * Un caso, una carpeta: `/documents` (`batchGenerateDocuments`) y la subida de
 * adjuntos (`uploadCaseDocument`) terminan en la MISMA carpeta del caso.
 *
 * Antes no:
 *  - `/documents` usaba siempre la ruta v0 `documentos-generados/{centro}/{N°}`
 *    e ignoraba el `driveFolderId` guardado.
 *  - En el alta, los adjuntos llegaban antes que el job, creaban la carpeta v0
 *    y el job guardaba encima la v1.
 *
 * La base es un fake en memoria de UNA fila de `Case`, con el `updateMany`
 * condicional de verdad, compartida por todos los módulos del test.
 */
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'raiz-de-drive';

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

jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: jest.fn().mockResolvedValue({
    claimed: true,
    request: { id: 'req-1', kind: 'BATCH', status: 'PROCESSING' },
  }),
  markGenerationProcessing: jest.fn().mockResolvedValue(undefined),
  completeGenerationRequest: jest.fn().mockResolvedValue(undefined),
  failGenerationRequest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest
    .fn()
    .mockResolvedValue({ allowed: true, remainingAttempts: 5, resetInMs: 0 }),
  getRateLimitKey: (scope: string, id: string) => `${scope}:${id}`,
  RATE_LIMIT_CONFIGS: { batchDocumentGeneration: {} },
}));

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

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
  batchHtmlToPdf: jest.fn().mockResolvedValue({
    ok: [{ filename: 'solicitud-insolvencia.pdf', buffer: Buffer.from('pdf') }],
    failed: [],
  }),
}));

const mockCreateFolderHierarchy = jest.fn();
const mockUploadDocumentToCase = jest.fn();
const mockUploadFile = jest.fn();
const mockFindOrCreateCaseFolder = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    findOrCreateCaseFolder: (...a: unknown[]) =>
      mockFindOrCreateCaseFolder(...a),
    listFoldersAndFiles: jest.fn().mockResolvedValue({
      folders: [{ id: 'docgen-id', name: 'documentos-generados' }],
      files: [],
    }),
    createFolder: jest.fn().mockResolvedValue('carpeta-nueva'),
    getFolderUrl: (id: string) => `https://drive.example/folder/${id}`,
    getFileUrl: (id: string) => `https://drive.example/file/${id}`,
    uploadDocumentToCase: (...a: unknown[]) => mockUploadDocumentToCase(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
  },
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import {
  batchGenerateDocuments,
  uploadCaseDocument,
} from '@/features/document/actions';
import { resolveCaseFolder } from '@/features/document/case-folder';

const TENANT_ID = 'armonia';

interface Fila {
  driveFolderId: string | null;
  layoutVersion: number;
}
let fila: Fila;

function filaCompleta() {
  return {
    id: 'case-1',
    caseNumber: 'INSOL-000003',
    debtorName: 'Juan Pérez',
    type: 'INSOLVENCY',
    createdDate: new Date('2026-11-10T15:00:00Z'),
    centroConciliacionNombre: null,
    operatorId: ADMIN_USER.id,
    debtorId: 'debtor-1',
    tenantId: TENANT_ID,
    tenant: { slug: 'armonia' },
    debtor: { name: 'Juan Pérez' },
    debts: [],
    assets: [],
    documents: [],
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    legalProcesses: [],
    operator: ADMIN_USER,
    ...fila,
  };
}

/** Carpetas en las que terminó algo: generados (/documents) y adjuntos. */
function carpetasDeDestino(): string[] {
  const padresDeSubcarpetas = mockCreateFolderHierarchy.mock.calls
    .filter(([, padre]) => padre !== 'raiz-de-drive')
    .map(([, padre]) => padre as string);
  return [...new Set(padresDeSubcarpetas)];
}

function adjunto() {
  return new File([new Uint8Array(10)], 'cedula.pdf', {
    type: 'application/pdf',
  });
}

function generarDesdeDocuments() {
  return batchGenerateDocuments({
    caseId: 'case-1',
    templateIds: ['solicitud-insolvencia'],
    outputFormat: 'pdf',
  });
}

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  mockAuthenticateUser.mockResolvedValue({
    user: { ...ADMIN_USER, permissions: Object.values(P) },
    tenantId: TENANT_ID,
    tenantSlug: 'armonia',
  });

  mockPrisma.case.findUnique.mockImplementation(
    async ({ where }: { where: { id: string; tenantId: string } }) =>
      where.id === 'case-1' && where.tenantId === TENANT_ID
        ? filaCompleta()
        : null,
  );
  mockPrisma.case.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { driveFolderId?: string | null };
      data: Partial<Fila>;
    }) => {
      if (
        'driveFolderId' in where &&
        where.driveFolderId !== fila.driveFolderId
      )
        return { count: 0 };
      Object.assign(fila, data);
      return { count: 1 };
    },
  );
  mockPrisma.document.create.mockImplementation(({ data }: never) =>
    Promise.resolve({ id: 'doc-1', ...(data as object) }),
  );

  mockCreateFolderHierarchy.mockImplementation(
    async (ruta: string[], padre: string) =>
      padre === 'raiz-de-drive' ? 'carpeta-v1' : `${padre}/${ruta.join('/')}`,
  );
  mockUploadDocumentToCase.mockResolvedValue({
    fileId: 'archivo-generado',
    fileUrl: 'https://drive.example/file/archivo-generado',
  });
  mockUploadFile.mockResolvedValue('archivo-adjunto');
});

describe('una sola carpeta por caso, desde cualquier módulo', () => {
  it('caso v1 guardado (INSOL-000003): /documents y los adjuntos van a la carpeta guardada', async () => {
    fila = { driveFolderId: 'carpeta-guardada-v1', layoutVersion: 1 };

    await generarDesdeDocuments();
    await uploadCaseDocument({
      caseId: 'case-1',
      docName: 'Cédula',
      file: adjunto(),
    });

    expect(carpetasDeDestino()).toEqual(['carpeta-guardada-v1']);
    // /documents anida en 01-Generados en un caso v1.
    const [destinoGenerado] = mockUploadDocumentToCase.mock.calls[0].slice(2);
    expect(destinoGenerado).toMatch(/^carpeta-guardada-v1\/01-Generados/);
    // El adjunto, en 02-Adjuntos.
    expect(mockUploadFile.mock.calls[0][3]).toBe(
      'carpeta-guardada-v1/02-Adjuntos',
    );
    // Nadie recalculó ni volvió a guardar la carpeta.
    expect(mockFindOrCreateCaseFolder).not.toHaveBeenCalled();
    expect(mockPrisma.case.updateMany).not.toHaveBeenCalled();
    expect(fila).toEqual({
      driveFolderId: 'carpeta-guardada-v1',
      layoutVersion: 1,
    });
  });

  it('caso v0 guardado: conserva su carpeta y su estructura en los dos módulos', async () => {
    fila = { driveFolderId: 'carpeta-v0', layoutVersion: 0 };

    await generarDesdeDocuments();
    await uploadCaseDocument({
      caseId: 'case-1',
      docName: 'Cédula',
      file: adjunto(),
    });

    expect(carpetasDeDestino()).toEqual(['carpeta-v0']);
    const [destinoGenerado] = mockUploadDocumentToCase.mock.calls[0].slice(2);
    expect(destinoGenerado).not.toMatch(/01-Generados/);
    expect(mockUploadFile.mock.calls[0][3]).toBe('carpeta-v0/Adjuntos');
    expect(fila).toEqual({ driveFolderId: 'carpeta-v0', layoutVersion: 0 });
    // La fila de la carpeta en el índice de la pestaña Drive se conserva para v0.
    expect(mockPrisma.documentFromDrive.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          googleDriveId_tenantId: {
            googleDriveId: 'carpeta-v0',
            tenantId: TENANT_ID,
          },
        },
      }),
    );
  });

  it('caso sin carpeta: el primero que llega crea la v1 y el otro módulo la reutiliza', async () => {
    fila = { driveFolderId: null, layoutVersion: 0 };

    await uploadCaseDocument({
      caseId: 'case-1',
      docName: 'Cédula',
      file: adjunto(),
    });
    await generarDesdeDocuments();

    expect(fila).toEqual({ driveFolderId: 'carpeta-v1', layoutVersion: 1 });
    expect(carpetasDeDestino()).toEqual(['carpeta-v1']);
    // La ruta v1 se creó una sola vez, desde la raíz.
    expect(
      mockCreateFolderHierarchy.mock.calls.filter(
        ([, padre]) => padre === 'raiz-de-drive',
      ),
    ).toHaveLength(1);
    expect(mockUploadFile.mock.calls[0][3]).toBe('carpeta-v1/02-Adjuntos');
  });

  it('alta de caso: adjunto y job a la vez guardan UNA carpeta y los dos la usan', async () => {
    fila = { driveFolderId: null, layoutVersion: 0 };
    // Drive responde a las dos solo cuando ambas preguntaron, y a cada una
    // con una carpeta distinta: el peor caso.
    const pendientes: Array<() => void> = [];
    let n = 0;
    mockCreateFolderHierarchy.mockImplementation(
      (ruta: string[], padre: string) => {
        if (padre !== 'raiz-de-drive')
          return Promise.resolve(`${padre}/${ruta.join('/')}`);
        const id = n++ === 0 ? 'carpeta-del-adjunto' : 'carpeta-del-job';
        return new Promise<string>((resolve) => {
          pendientes.push(() => resolve(id));
          if (pendientes.length === 2) pendientes.forEach((r) => r());
        });
      },
    );

    const [, delJob] = await Promise.all([
      uploadCaseDocument({
        caseId: 'case-1',
        docName: 'Cédula',
        file: adjunto(),
      }),
      // Lo que hace el job dentro de generateDocumentsForNewCase.
      resolveCaseFolder('case-1', TENANT_ID),
    ]);

    expect(fila).toEqual({
      driveFolderId: 'carpeta-del-adjunto',
      layoutVersion: 1,
    });
    expect(delJob.folderId).toBe('carpeta-del-adjunto');
    expect(mockUploadFile.mock.calls[0][3]).toBe(
      'carpeta-del-adjunto/02-Adjuntos',
    );
  });
});

describe('/documents resuelve cada ruta de destino una sola vez por lote', () => {
  /** Un PDF por cada HTML pedido, para que el lote llegue a la subida. */
  function pdfParaCadaPlantilla() {
    const { batchHtmlToPdf } = jest.requireMock('@/lib/html-to-pdf');
    batchHtmlToPdf.mockImplementation(
      async (docs: Array<{ filename: string }>) => ({
        ok: docs.map((d) => ({
          filename: d.filename.replace(/\.html$/, '.pdf'),
          buffer: Buffer.from('pdf'),
        })),
        failed: [],
      }),
    );
  }

  /** Llamadas a createFolderHierarchy bajo la carpeta del caso (no la raíz). */
  function busquedasDeSubcarpeta(): string[] {
    return mockCreateFolderHierarchy.mock.calls
      .filter(([, padre]) => padre !== 'raiz-de-drive')
      .map(([ruta]) => (ruta as string[]).join('/'));
  }

  // Las cuatro con `folderPath: []` en templates-config.ts.
  const CON_RUTA_VACIA = [
    'solicitud-insolvencia',
    'certificado-ingresos',
    'declaracion-juramentada-domicilio',
    'inadmision',
  ];

  it('caso v1: N plantillas con folderPath [] buscan 01-Generados una sola vez y suben todas ahí', async () => {
    fila = { driveFolderId: 'carpeta-v1', layoutVersion: 1 };
    pdfParaCadaPlantilla();

    await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: CON_RUTA_VACIA,
      outputFormat: 'pdf',
    });

    expect(busquedasDeSubcarpeta()).toEqual(['01-Generados']);
    expect(mockUploadDocumentToCase).toHaveBeenCalledTimes(
      CON_RUTA_VACIA.length,
    );
    for (const [, , destino] of mockUploadDocumentToCase.mock.calls) {
      expect(destino).toBe('carpeta-v1/01-Generados');
    }
  });

  it('una ruta distinta se resuelve aparte, también una sola vez', async () => {
    fila = { driveFolderId: 'carpeta-v1', layoutVersion: 1 };
    pdfParaCadaPlantilla();

    await batchGenerateDocuments({
      caseId: 'case-1',
      // cyg-tramite va a ['Formatos Para Audiencias'].
      templateIds: [...CON_RUTA_VACIA, 'cyg-tramite'],
      outputFormat: 'pdf',
    });

    expect(busquedasDeSubcarpeta().sort()).toEqual([
      '01-Generados',
      '01-Generados/Formatos Para Audiencias',
    ]);
  });

  it('caso v0 con folderPath []: sube a la carpeta del caso sin buscar subcarpetas', async () => {
    fila = { driveFolderId: 'carpeta-v0', layoutVersion: 0 };
    pdfParaCadaPlantilla();

    await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: CON_RUTA_VACIA,
      outputFormat: 'pdf',
    });

    expect(busquedasDeSubcarpeta()).toEqual([]);
    for (const [, , destino] of mockUploadDocumentToCase.mock.calls) {
      expect(destino).toBe('carpeta-v0');
    }
  });

  it('si la subcarpeta no se puede crear, ese documento es un error visible y no se sube a la raíz; el siguiente reintenta', async () => {
    fila = { driveFolderId: 'carpeta-v1', layoutVersion: 1 };
    pdfParaCadaPlantilla();
    mockCreateFolderHierarchy.mockRejectedValueOnce(new Error('Drive 503'));

    const resultado = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: CON_RUTA_VACIA,
      outputFormat: 'pdf',
    });

    // withRetry está mockeado sin reintento en este archivo: un intento por
    // documento. El fallo no queda en la caché, así que el segundo reintenta.
    expect(busquedasDeSubcarpeta()).toEqual(['01-Generados', '01-Generados']);
    const destinos = mockUploadDocumentToCase.mock.calls.map(([, , d]) => d);
    // Antes el primero caía a la raíz ('carpeta-v1') como generado.
    expect(destinos).not.toContain('carpeta-v1');
    expect(destinos).toEqual(
      Array(CON_RUTA_VACIA.length - 1).fill('carpeta-v1/01-Generados'),
    );

    const data = resultado.data as {
      documents: Array<{ templateId: string; status: string; error?: string }>;
    };
    const fallido = data.documents.find((d) => d.status === 'error');
    expect(fallido?.templateId).toBe(CON_RUTA_VACIA[0]);
    expect(fallido?.error).toBe(
      'No se subió a Google Drive: no se pudo crear la subcarpeta 01-Generados (Drive 503).',
    );
  });
});
