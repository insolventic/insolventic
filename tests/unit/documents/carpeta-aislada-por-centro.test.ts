/**
 * Aislamiento entre centros en Drive: un caso de cada centro, con el MISMO
 * número (`INSOL-000007`), nunca comparte carpeta ni archivo, desde ningún
 * módulo, y nada se crea en la raíz de Drive por número de caso.
 *
 * Antes los comprobantes de pago, sin carpeta guardada, buscaban o creaban
 * `RAIZ/INSOL-000007`. Los números de caso son secuencias por centro, así que
 * el comprobante de un centro y el del otro terminaban en la misma carpeta, y
 * `resolveCaseFolder` la adoptaba después para todo el expediente.
 *
 * Drive es un fake en el que el id de una carpeta es su ruta: dos casos que
 * resuelven la misma ruta reciben la misma carpeta, como hace el
 * buscar-o-crear de Drive real. La base es un fake en memoria de dos filas de
 * `Case`, con el `updateMany` condicional de verdad.
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

const RAIZ = 'raiz-de-drive';
const mockFindOrCreateCaseFolder = jest.fn(
  async (numero: string, padre: string) => `${padre}/${numero}`,
);
const mockCreateFolderHierarchy = jest.fn(
  async (ruta: string[], padre: string) => `${padre}/${ruta.join('/')}`,
);
const mockUploadFile = jest.fn(
  async (nombre: string, _b: Buffer, _m: string, padre: string) =>
    `${padre}/${nombre}`,
);
const mockUploadDocumentToCase = jest.fn(
  async (nombre: string, _b: Buffer, padre: string) => ({
    fileId: `${padre}/${nombre}`,
    fileUrl: `https://drive.example/file/${padre}/${nombre}`,
  }),
);
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    findOrCreateCaseFolder: (...a: [string, string]) =>
      mockFindOrCreateCaseFolder(...a),
    createFolderHierarchy: (...a: [string[], string]) =>
      mockCreateFolderHierarchy(...a),
    uploadFile: (...a: [string, Buffer, string, string]) =>
      mockUploadFile(...a),
    uploadDocumentToCase: (...a: [string, Buffer, string]) =>
      mockUploadDocumentToCase(...a),
    listFoldersAndFiles: jest.fn().mockResolvedValue({
      folders: [{ id: 'docgen-id', name: 'documentos-generados' }],
      files: [],
    }),
    createFolder: jest.fn().mockResolvedValue('carpeta-nueva'),
    getFolderUrl: (id: string) => `https://drive.example/folder/${id}`,
    getFileUrl: (id: string) => `https://drive.example/file/${id}`,
  },
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import {
  findManyDeImagenes,
  firmasDelCentro,
} from '../../helpers/imagenes-privadas';
import { P } from '@/lib/permissions';
import {
  batchGenerateDocuments,
  uploadCaseDocument,
} from '@/features/document/actions';
import { registerPayment } from '@/features/payment/actions';

const CENTROS = ['armonia', 'constructores-paz'] as const;
type Centro = (typeof CENTROS)[number];

const casoDe = (centro: Centro) => `caso-${centro}`;

interface Fila {
  driveFolderId: string | null;
  layoutVersion: number;
}
let filas: Record<Centro, Fila>;

function filaCompleta(centro: Centro) {
  return {
    id: casoDe(centro),
    // El mismo número en los dos centros: es una secuencia por centro.
    caseNumber: 'INSOL-000007',
    debtorName: 'Juan Pérez',
    type: 'INSOLVENCY',
    createdDate: new Date('2026-11-10T15:00:00Z'),
    centroConciliacionNombre: null,
    operatorId: ADMIN_USER.id,
    debtorId: `deudor-${centro}`,
    tenantId: centro,
    tenant: { slug: centro },
    debtor: { name: 'Juan Pérez' },
    debts: [],
    assets: [],
    documents: [],
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    legalProcesses: [],
    operator: ADMIN_USER,
    ...filas[centro],
  };
}

function sesionDe(centro: Centro) {
  mockAuthenticateUser.mockResolvedValue({
    user: { ...ADMIN_USER, permissions: Object.values(P) },
    tenantId: centro,
    tenantSlug: centro,
  });
}

const pdf = (nombre: string) =>
  new File(['%PDF-1.4', new Uint8Array(10)], nombre, {
    type: 'application/pdf',
  });

/** Lo que cada centro sube: un comprobante, un documento y un adjunto. */
async function subirTodoDesde(centro: Centro) {
  sesionDe(centro);
  const caseId = casoDe(centro);
  const antes = {
    archivos: mockUploadFile.mock.calls.length,
    generados: mockUploadDocumentToCase.mock.calls.length,
  };
  const pago = await registerPayment({
    caseId,
    amount: 250000,
    paymentDate: '2026-11-20',
    receipt: pdf(`comprobante-${centro}.pdf`),
  });
  const generacion = await batchGenerateDocuments({
    caseId,
    templateIds: ['solicitud-insolvencia'],
    outputFormat: 'pdf',
  });
  const adjunto = await uploadCaseDocument({
    caseId,
    docName: 'Cédula',
    file: pdf(`cedula-${centro}.pdf`),
  });
  // Las carpetas donde quedó lo que subió este centro.
  const destinos = [
    ...mockUploadFile.mock.calls.slice(antes.archivos).map((c) => c[3]),
    ...mockUploadDocumentToCase.mock.calls
      .slice(antes.generados)
      .map((c) => c[2]),
  ];
  return { pago, generacion, adjunto, destinos };
}

/** Las carpetas donde se subió cada archivo, de los dos centros. */
function carpetasDeLosArchivos(): string[] {
  return [
    ...mockUploadFile.mock.calls.map((c) => c[3]),
    ...mockUploadDocumentToCase.mock.calls.map((c) => c[2]),
  ];
}

beforeEach(() => {
  resetAllMocks();
  mockPrisma.imagenPrivada.findMany.mockImplementation(
    findManyDeImagenes(CENTROS.flatMap((c) => firmasDelCentro(c))),
  );
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // Ninguno de los dos casos tiene carpeta todavía: el primero que sube algo
  // la crea. Es el escenario del job del alta que falló antes de guardarla.
  filas = {
    armonia: { driveFolderId: null, layoutVersion: 0 },
    'constructores-paz': { driveFolderId: null, layoutVersion: 0 },
  };

  mockPrisma.case.findUnique.mockImplementation(
    async ({ where }: { where: { id: string; tenantId: string } }) => {
      const centro = CENTROS.find(
        (c) => casoDe(c) === where.id && c === where.tenantId,
      );
      return centro ? filaCompleta(centro) : null;
    },
  );
  mockPrisma.case.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string; tenantId?: string; driveFolderId?: string | null };
      data: Partial<Fila>;
    }) => {
      const centro = CENTROS.find(
        (c) => casoDe(c) === where.id && c === where.tenantId,
      );
      if (!centro) return { count: 0 };
      if (
        'driveFolderId' in where &&
        where.driveFolderId !== filas[centro].driveFolderId
      )
        return { count: 0 };
      Object.assign(filas[centro], data);
      return { count: 1 };
    },
  );
  mockPrisma.payment.create.mockImplementation(({ data }: never) =>
    Promise.resolve({ id: 'pago-1', ...(data as object) }),
  );
  mockPrisma.document.create.mockImplementation(({ data }: never) =>
    Promise.resolve({ id: 'doc-1', ...(data as object) }),
  );
});

describe('un caso de cada centro, con el mismo número, no comparte nada en Drive', () => {
  it('comprobante, documento y adjunto de cada centro quedan en la carpeta de su caso, y las dos carpetas son distintas', async () => {
    const armonia = await subirTodoDesde('armonia');
    const constructores = await subirTodoDesde('constructores-paz');

    for (const r of [armonia, constructores]) {
      expect(r.pago.success).toBe(true);
      expect(r.adjunto.success).toBe(true);
      const docs = (r.generacion.data as { documents: { status: string }[] })
        .documents;
      expect(docs.map((d) => d.status)).toEqual(['success']);
    }

    const carpetaArmonia = filas.armonia.driveFolderId!;
    const carpetaConstructores = filas['constructores-paz'].driveFolderId!;
    expect(carpetaArmonia).toBeTruthy();
    expect(carpetaConstructores).toBeTruthy();
    expect(carpetaArmonia).not.toBe(carpetaConstructores);
    // Ninguna carpeta de caso cuelga de la otra.
    expect(carpetaArmonia.startsWith(carpetaConstructores)).toBe(false);
    expect(carpetaConstructores.startsWith(carpetaArmonia)).toBe(false);

    // Los tres archivos de cada centro (comprobante, documento y adjunto),
    // dentro de la carpeta de su caso.
    expect(armonia.destinos).toHaveLength(3);
    expect(constructores.destinos).toHaveLength(3);
    for (const d of armonia.destinos)
      expect(d.startsWith(`${carpetaArmonia}/`)).toBe(true);
    for (const d of constructores.destinos)
      expect(d.startsWith(`${carpetaConstructores}/`)).toBe(true);

    // Ningún archivo es el mismo: el id de Drive es `carpeta/nombre`, y el
    // documento generado se llama igual en los dos centros.
    const ids = [
      ...mockUploadFile.mock.calls.map((c) => `${c[3]}/${c[0]}`),
      ...mockUploadDocumentToCase.mock.calls.map((c) => `${c[2]}/${c[0]}`),
    ];
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it('nada se busca ni se crea en la raíz de Drive por número de caso', async () => {
    await subirTodoDesde('armonia');
    await subirTodoDesde('constructores-paz');

    expect(mockFindOrCreateCaseFolder).not.toHaveBeenCalled();
    // Lo único que se crea colgando de la raíz es la ruta v1 del caso, que
    // empieza por la carpeta del centro, nunca por el número de caso.
    const desdeLaRaiz = mockCreateFolderHierarchy.mock.calls.filter(
      ([, padre]) => padre === RAIZ,
    );
    expect(desdeLaRaiz).toHaveLength(2);
    for (const [ruta] of desdeLaRaiz) {
      expect(ruta[0]).not.toBe('INSOL-000007');
    }
    expect(desdeLaRaiz[0][0]).not.toEqual(desdeLaRaiz[1][0]);
    // Ningún archivo se subió directo a la raíz ni a `raíz/<número>`.
    for (const d of carpetasDeLosArchivos()) {
      expect(d).not.toBe(RAIZ);
      expect(d.startsWith(`${RAIZ}/INSOL-000007`)).toBe(false);
    }
  });

  it('la carpeta se guarda solo en el caso de su centro, y solo si estaba vacía', async () => {
    await subirTodoDesde('armonia');

    expect(mockPrisma.case.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: casoDe('armonia'),
          tenantId: 'armonia',
          driveFolderId: null,
        },
      }),
    );
    expect(mockPrisma.case.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driveFolderId: expect.anything() }),
      }),
    );
    expect(filas['constructores-paz'].driveFolderId).toBeNull();
  });
});
