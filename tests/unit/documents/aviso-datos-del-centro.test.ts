/**
 * El aviso cuando un documento no se genera porque al centro le falta un dato
 * propio (`src/features/document/datos-faltantes.ts`).
 *
 * Antes el operador recibía "Falta: DIRECTOR_CARGO": el nombre interno del
 * placeholder, de un dato que además no puede completar desde la aplicación.
 * Ahora el aviso nombra el dato y el centro, y lo manda al administrador.
 *
 * Se prueba en las dos rutas de generación con la plantilla real de la
 * Designación del Conciliador y un membrete al que se le quita un dato.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'root-folder-id';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

/** Los campos que se le quitan al membrete del centro en cada test. */
let mockCamposQuitados: string[] = [];
jest.mock('@/lib/membrete-centro', () => {
  const real = jest.requireActual('@/lib/membrete-centro');
  return {
    ...real,
    membreteParcialDelCentro: (tenant?: string | null) => {
      const m = real.membreteParcialDelCentro(tenant);
      if (!m) return m;
      const copia = { ...m };
      for (const c of mockCamposQuitados) copia[c] = null;
      return copia;
    },
  };
});

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
jest.mock('@/lib/html-to-pdf', () => ({
  htmlToPdf: jest.fn(),
  batchHtmlToPdf: jest.fn(async (docs: Array<{ filename: string }>) => ({
    ok: docs.map((d) => ({
      filename: d.filename.replace(/\.html$/, '.pdf'),
      buffer: Buffer.from('pdf'),
    })),
    failed: [],
  })),
}));
jest.mock('@/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    uploadFile: jest.fn(async (n: string) => `drive-id:${n}`),
    getFileUrl: jest.fn((id: string) => `https://drive.example/file/${id}`),
    getFolderUrl: jest.fn((id: string) => `https://drive.example/folder/${id}`),
    createFolderHierarchy: jest.fn().mockResolvedValue('subfolder-id'),
    uploadDocumentToCase: jest.fn().mockResolvedValue({
      fileId: 'file-1',
      fileUrl: 'https://drive.example/file/file-1',
    }),
  },
}));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
import {
  findManyDeImagenes,
  firmasDelCentro,
} from '../../helpers/imagenes-privadas';
import { ADMIN_USER } from '../../helpers/fixtures';
import { makeCase } from '../../helpers/mapper-fixtures';
import { P } from '@/lib/permissions';
import {
  mensajeDeDatosFaltantes,
  mensajeFaltanDatosDelCentro,
} from '@/features/document/datos-faltantes';
import { batchGenerateDocuments } from '@/features/document/actions';
import {
  generateDocumentsForAdmission,
  previewDocument,
  regenerateDocument,
} from '@/features/document/generate-documents';

const delExpediente = (resto: string[]) => `Falta: ${resto.join(', ')}.`;

beforeEach(() => {
  mockCamposQuitados = [];
});

describe('el texto del aviso', () => {
  it('un dato: "Falta el <dato> de <centro>. Contacta al administrador."', () => {
    expect(
      mensajeFaltanDatosDelCentro(['DIRECTOR_CARGO'], 'Constructores de Paz'),
    ).toBe(
      'Falta el cargo del director de Constructores de Paz. Contacta al administrador.',
    );
  });

  it('varios datos van en una sola oración, y las formas de un mismo dato cuentan una vez', () => {
    expect(
      mensajeFaltanDatosDelCentro(
        [
          'DIRECTOR_NOMBRE',
          'CENTRO_RES_INSOLVENCIA_NUMERO',
          'CENTRO_RES_INSOLVENCIA_FECHA',
          'DIRECTOR_CARGO',
        ],
        'Armonía Concertada',
      ),
    ).toBe(
      'Faltan el nombre del director, la resolución de habilitación como operador de insolvencia y el cargo del director de Armonía Concertada. Contacta al administrador.',
    );
  });

  it('sin el nombre del centro, dice "del centro"', () => {
    expect(mensajeFaltanDatosDelCentro(['CENTRO_NOMBRE'], undefined)).toBe(
      'Falta el nombre del centro. Contacta al administrador.',
    );
  });

  it('solo datos del expediente: el texto de siempre de la ruta', () => {
    expect(
      mensajeDeDatosFaltantes(
        ['DEUDOR_NOMBRE'],
        { CENTRO_NOMBRE: 'X' },
        delExpediente,
      ),
    ).toBe('Falta: DEUDOR_NOMBRE.');
  });

  it('de los dos: primero lo del expediente, después el aviso del centro', () => {
    expect(
      mensajeDeDatosFaltantes(
        ['DEUDOR_NOMBRE', 'CENTRO_CUENTA_CONSIGNACION'],
        { CENTRO_NOMBRE: 'Armonía Concertada' },
        delExpediente,
      ),
    ).toBe(
      'Falta: DEUDOR_NOMBRE. Falta la cuenta de consignación de Armonía Concertada. Contacta al administrador.',
    );
  });
});

describe('ruta manual (/documents): la Designación sin el cargo del director', () => {
  const TENANT_ID = 'armonia';

  beforeEach(() => {
    resetAllMocks();
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(firmasDelCentro(TENANT_ID)),
    );
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT_ID,
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      ...(makeCase({ type: 'INSOLVENCY' }) as object),
      id: 'case-1',
      caseNumber: 'INSOL-000001',
      driveFolderId: 'case-folder-id',
      layoutVersion: 0,
      tenantId: TENANT_ID,
      tenant: { slug: TENANT_ID },
      documents: [],
    });
    mockPrisma.document.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'doc-1', ...data }),
    );
  });

  async function generarDesignacion() {
    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['designacion-conciliador'],
      outputFormat: 'pdf',
    });
    const data = result.data as {
      documents: Array<{ status: string; error?: string }>;
    };
    expect(data.documents).toHaveLength(1);
    return data.documents[0];
  }

  it('el documento no se genera y el aviso nombra el dato y el centro', async () => {
    mockCamposQuitados = ['directorCargo'];

    const doc = await generarDesignacion();

    expect(doc.status).toBe('skipped');
    expect(doc.error).toBe(
      'Falta el cargo del director de Armonía Concertada. Contacta al administrador.',
    );
  });

  it('con el membrete completo, se genera', async () => {
    const doc = await generarDesignacion();
    expect(doc.status).toBe('success');
  });
});

describe('ruta automática (al crear el caso): la Designación sin el nombre del director', () => {
  beforeEach(() => {
    resetAllMocks();
    const tenant = (makeCase() as { tenantId: string }).tenantId;
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(firmasDelCentro(tenant)),
    );
  });

  async function designacion() {
    const result = await generateDocumentsForAdmission(
      makeCase({ type: 'INSOLVENCY' }) as never,
      'case-folder-id',
    );
    const doc = result.find((d) => d.templateId === 'designacion-conciliador');
    if (!doc) throw new Error('la Designación no está en el resultado');
    return doc;
  }

  it('el documento no se genera y el aviso nombra el dato y el centro', async () => {
    mockCamposQuitados = ['directorNombre'];

    const doc = await designacion();

    expect(doc.status).toBe('error');
    expect(doc.error).toBe(
      'Falta el nombre del director de Constructores de Paz. Contacta al administrador.',
    );
  });

  it('con el membrete completo, se genera', async () => {
    expect((await designacion()).status).toBe('success');
  });
  it('regenerar un documento suelto da el mismo aviso', async () => {
    mockCamposQuitados = ['directorNombre'];

    const doc = await regenerateDocument(
      makeCase({ type: 'INSOLVENCY' }) as never,
      'designacion-conciliador',
      'case-folder-id',
    );

    expect(doc.status).toBe('error');
    expect(doc.error).toBe(
      'Falta el nombre del director de Constructores de Paz. Contacta al administrador.',
    );
  });

  it('la vista previa corta con el mismo aviso', async () => {
    mockCamposQuitados = ['directorNombre'];

    await expect(
      previewDocument(
        makeCase({ type: 'INSOLVENCY' }) as never,
        'designacion-conciliador',
      ),
    ).rejects.toThrow(
      'Falta el nombre del director de Constructores de Paz. Contacta al administrador.',
    );
  });
});
