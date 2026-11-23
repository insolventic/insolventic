/**
 * La ruta automática (alta del caso, Regenerar, etapas y cambio de fase) no
 * sube a la raíz de la carpeta del caso si no puede crear la subcarpeta.
 *
 * Antes `createDocumentSubfolder` no reintentaba y, ante cualquier fallo,
 * devolvía la carpeta del caso: el documento se subía fuera de `01-Generados`
 * y quedaba como generado. `/documents` ya lo trataba como error visible con
 * reintento; ahora las dos rutas se comportan igual.
 *
 * Se usa `generateDocumentsForAdmission` (etapa de admisión) con un caso v1:
 * todas sus plantillas van dentro de `01-Generados`. `withRetry` es el real.
 */

jest.mock('@/lib/html-to-pdf', () => ({
  htmlToPdf: jest.fn(),
  batchHtmlToPdf: jest.fn(),
}));
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    uploadFile: jest.fn(),
    getFileUrl: jest.fn((id: string) => `https://drive.example/${id}`),
    createFolderHierarchy: jest.fn(),
  },
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { batchHtmlToPdf } from '@/lib/html-to-pdf';
import { googleDriveService } from '@/lib/google-drive';
import { generateDocumentsForAdmission } from '@/features/document/generate-documents';
import { makeCase } from '../../helpers/mapper-fixtures';
import mockPrisma from '../../__mocks__/prisma';
import {
  findManyDeImagenes,
  firmasDelCentro,
} from '../../helpers/imagenes-privadas';

const mockUploadFile = googleDriveService.uploadFile as jest.Mock;
const mockCreateFolderHierarchy =
  googleDriveService.createFolderHierarchy as jest.Mock;

function casoV1() {
  return { ...makeCase({ type: 'INSOLVENCY' }), layoutVersion: 1 } as never;
}

const error = (status: number, texto: string) =>
  Object.assign(new Error(texto), { status });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockPrisma.imagenPrivada.findMany.mockImplementation(
    findManyDeImagenes(
      firmasDelCentro((makeCase() as { tenantId: string }).tenantId),
    ),
  );
  (batchHtmlToPdf as jest.Mock).mockImplementation(
    async (docs: Array<{ filename: string }>) => ({
      ok: docs.map((d) => ({
        filename: d.filename.replace(/\.html$/, '.pdf'),
        buffer: Buffer.from('PDF'),
      })),
      failed: [],
    }),
  );
  mockUploadFile.mockImplementation(
    async (nombre: string, _b: Buffer, _m: string, carpeta: string) =>
      `${carpeta}/${nombre}`,
  );
});

afterEach(() => jest.useRealTimers());

describe('ruta automática: la subcarpeta que no se puede crear', () => {
  it('un error permanente no se reintenta: cada documento es un error visible y nada se sube a la carpeta del caso', async () => {
    mockCreateFolderHierarchy.mockRejectedValue(
      error(403, 'Drive 403 insufficientPermissions'),
    );

    const resultado = await generateDocumentsForAdmission(
      casoV1(),
      'carpeta-del-caso',
    );
    const intentados = resultado.filter((d) => d.status !== 'skipped');

    expect(intentados.length).toBeGreaterThan(0);
    for (const d of intentados) {
      expect(d.status).toBe('error');
      expect(d.error).toMatch(
        /^No se subió a Google Drive: no se pudo crear la subcarpeta 01-Generados.* \(Drive 403 insufficientPermissions\)\.$/,
      );
    }
    expect(mockUploadFile).not.toHaveBeenCalled();
    // Sin reintento: un intento por documento (el fallo no queda en caché).
    expect(mockCreateFolderHierarchy).toHaveBeenCalledTimes(intentados.length);
  });

  it('un error transitorio se reintenta y el documento llega a su subcarpeta', async () => {
    // Los temporizadores avanzan solos: la espera del reintento no tarda.
    jest.useFakeTimers({ advanceTimers: 100 });
    mockCreateFolderHierarchy
      .mockRejectedValueOnce(error(503, 'Drive 503 backendError'))
      .mockResolvedValue('carpeta-del-caso/01-Generados');

    const resultado = await generateDocumentsForAdmission(
      casoV1(),
      'carpeta-del-caso',
    );
    const intentados = resultado.filter((d) => d.status !== 'skipped');

    expect(intentados.length).toBeGreaterThan(0);
    for (const d of intentados) expect(d.status).toBe('success');
    for (const [, , , carpeta] of mockUploadFile.mock.calls) {
      expect(carpeta).toBe('carpeta-del-caso/01-Generados');
    }
  });
});
