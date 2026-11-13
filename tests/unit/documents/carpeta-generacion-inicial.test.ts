/**
 * La generación inicial (alta de caso y "Generar iniciales" manual) sube a la
 * carpeta que decide `resolveCaseFolder`, y anida según el layout GUARDADO.
 *
 * Antes `generateDocumentsForNewCase` llamaba siempre a `getOrCreateCaseFolder`,
 * que recalculaba la ruta v1 con el año y el apellido del momento aunque el
 * caso ya tuviera carpeta (la de los adjuntos del alta, o una v0), y forzaba
 * el layout v1 en memoria.
 */
jest.mock('@/lib/html-to-pdf', () => ({
  htmlToPdf: jest.fn(),
  batchHtmlToPdf: jest.fn(),
}));
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    uploadFile: jest.fn(),
    getFileUrl: jest.fn((id: string) => `https://drive.example/${id}`),
    getFolderUrl: jest.fn((id: string) => `https://drive.example/f/${id}`),
    createFolderHierarchy: jest.fn(),
  },
}));
jest.mock('@/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));
jest.mock('@/features/document/generate-excel', () => ({
  generateAndUploadExcel: jest.fn().mockResolvedValue({
    fileName: 'consolidado.xlsx',
    googleDriveId: 'excel-id',
    googleDriveUrl: 'https://drive.example/excel-id',
  }),
}));
const mockResolveCaseFolder = jest.fn();
jest.mock('@/features/document/case-folder', () => ({
  resolveCaseFolder: (...a: unknown[]) => mockResolveCaseFolder(...a),
}));

import { batchHtmlToPdf } from '@/lib/html-to-pdf';
import { googleDriveService } from '@/lib/google-drive';
import { generateDocumentsForNewCase } from '@/features/document/generate-documents';
import { makeCase } from '../../helpers/mapper-fixtures';

const mockCreateFolderHierarchy =
  googleDriveService.createFolderHierarchy as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_DRIVE_FOLDER_ID = 'raiz-de-drive';
  (batchHtmlToPdf as jest.Mock).mockImplementation(
    async (docs: Array<{ filename: string }>) => ({
      ok: docs.map((d) => ({
        filename: d.filename.replace(/\.html$/, '.pdf'),
        buffer: Buffer.from('PDF'),
      })),
      failed: [],
    }),
  );
  (googleDriveService.uploadFile as jest.Mock).mockImplementation(
    async (fileName: string) => `drive-id:${fileName}`,
  );
  mockCreateFolderHierarchy.mockResolvedValue('subcarpeta');
});

function caso() {
  return { ...makeCase({ type: 'INSOLVENCY' }), id: 'caso-1' };
}

describe('generateDocumentsForNewCase y la carpeta del caso', () => {
  it('pide la carpeta a resolveCaseFolder con el tenant y no arma ninguna ruta desde la raíz', async () => {
    mockResolveCaseFolder.mockResolvedValue({
      folderId: 'carpeta-guardada',
      layoutVersion: 1,
      creada: false,
    });

    const resultado = await generateDocumentsForNewCase(
      caso() as never,
      {},
      'tenant-1',
    );

    expect(mockResolveCaseFolder).toHaveBeenCalledWith('caso-1', 'tenant-1');
    expect(resultado.caseFolderId).toBe('carpeta-guardada');
    const padres = mockCreateFolderHierarchy.mock.calls.map(
      ([, padre]) => padre,
    );
    expect(padres).not.toContain('raiz-de-drive');
    expect(new Set(padres)).toEqual(new Set(['carpeta-guardada']));
  });

  it('caso v1: los generados van dentro de 01-Generados', async () => {
    mockResolveCaseFolder.mockResolvedValue({
      folderId: 'carpeta-v1',
      layoutVersion: 1,
      creada: true,
    });

    await generateDocumentsForNewCase(caso() as never, {}, 'tenant-1');

    const rutas = mockCreateFolderHierarchy.mock.calls.map(([ruta]) => ruta);
    expect(rutas.length).toBeGreaterThan(0);
    for (const ruta of rutas) expect(ruta[0]).toBe('01-Generados');
  });

  it('caso v0 con carpeta guardada: conserva su estructura, sin 01-Generados', async () => {
    mockResolveCaseFolder.mockResolvedValue({
      folderId: 'carpeta-v0',
      layoutVersion: 0,
      creada: false,
    });

    await generateDocumentsForNewCase(caso() as never, {}, 'tenant-1');

    const rutas = mockCreateFolderHierarchy.mock.calls.map(([ruta]) => ruta);
    for (const ruta of rutas) expect(ruta[0]).not.toBe('01-Generados');
    expect(
      mockCreateFolderHierarchy.mock.calls.every(([, p]) => p === 'carpeta-v0'),
    ).toBe(true);
  });

  it('sin tenant no adivina una carpeta', async () => {
    await expect(
      generateDocumentsForNewCase(caso() as never, {}),
    ).rejects.toThrow('tenant');
    expect(mockResolveCaseFolder).not.toHaveBeenCalled();
  });
});
