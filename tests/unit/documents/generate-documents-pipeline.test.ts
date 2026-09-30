/**
 * Verifica el P1 de la auditoría de documentos
 * (docs/AUDITORIA_MODULO_GENERACION_2026-07.md): `generateFromTemplates`
 * corre en 3 fases (preparar, renderizar en lote, subir) en vez de lanzar y
 * cerrar un Chromium por documento (`generateDocument` -> `htmlToPdf`).
 *
 * `batchHtmlToPdf` y `googleDriveService` van mockeados: lo que importa acá
 * es CUÁNTAS VECES y CON QUÉ se llama al lote, y que el resultado siga
 * teniendo un elemento por plantilla de entrada, en el mismo orden, con el
 * mismo comportamiento de validación/skip/error que antes de la división en
 * fases. Los valores esperados (qué se salta, cuántas llegan al batch) se
 * tomaron de una corrida real contra el fixture, no se inventaron.
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
jest.mock('@/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));

import { htmlToPdf, batchHtmlToPdf } from '@/lib/html-to-pdf';
import { googleDriveService } from '@/lib/google-drive';
import {
  generateDocumentsForAdmission,
  generateDocumentsForNewCase,
} from '@/features/document/generate-documents';
import { makeCase } from '../../helpers/mapper-fixtures';

const mockBatchHtmlToPdf = batchHtmlToPdf as jest.Mock;
const mockUploadFile = googleDriveService.uploadFile as jest.Mock;
const mockCreateFolderHierarchy =
  googleDriveService.createFolderHierarchy as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchHtmlToPdf.mockImplementation(
    async (docs: Array<{ filename: string }>) =>
      docs.map((d) => ({
        filename: d.filename.replace(/\.html$/, '.pdf'),
        buffer: Buffer.from(`PDF:${d.filename}`),
      })),
  );
  mockUploadFile.mockImplementation(
    async (fileName: string) => `drive-id:${fileName}`,
  );
  mockCreateFolderHierarchy.mockResolvedValue('subfolder-id');
});

describe('generateFromTemplates — pipeline en 3 fases (P1)', () => {
  it('un solo llamado a batchHtmlToPdf para las 6 plantillas de Admisión que pasan la Fase 1 (8 en total, 2 se saltan)', async () => {
    const caseData = makeCase({ type: 'INSOLVENCY' });
    const result = await generateDocumentsForAdmission(
      caseData as never,
      'case-folder-id',
    );

    expect(result).toHaveLength(8);
    expect(mockBatchHtmlToPdf).toHaveBeenCalledTimes(1);
    expect(htmlToPdf).not.toHaveBeenCalled();

    const skipped = result.filter((d) => d.status === 'skipped');
    const succeeded = result.filter((d) => d.status === 'success');
    expect(skipped.map((d) => d.templateId).sort()).toEqual([
      'edicto-emplazatorio',
      'suspension-juzgados',
    ]);
    expect(succeeded).toHaveLength(6);
    expect(
      succeeded.every((d) => d.googleDriveId.startsWith('drive-id:')),
    ).toBe(true);

    // Las 2 saltadas en la Fase 1 nunca llegan a ocupar un Chromium.
    const [docsPassedToBatch] = mockBatchHtmlToPdf.mock.calls[0];
    expect(docsPassedToBatch).toHaveLength(6);
    expect(
      docsPassedToBatch.some(
        (d: { filename: string }) =>
          d.filename.startsWith('edicto-emplazatorio') ||
          d.filename.startsWith('suspension-juzgados'),
      ),
    ).toBe(false);
  });

  it('el resultado mantiene el orden y el motivo exacto de cada plantilla salteada', async () => {
    const caseData = makeCase({ type: 'INSOLVENCY' });
    const result = await generateDocumentsForAdmission(
      caseData as never,
      'case-folder-id',
    );

    // Mismo orden que getTemplatesForAdmission('INSOLVENCY').
    expect(result.map((d) => d.templateId)).toEqual([
      'auto-admision',
      'designacion-conciliador',
      'aceptacion-cargo',
      'edicto-emplazatorio',
      'notificacion-acreedores',
      'suspension-juzgados',
      'envio-pagador-suspension',
      'restablecimiento-servicios',
    ]);
    expect(result[3].error).toMatch(/al menos un acreedor/i);
    expect(result[5].error).toMatch(/proceso judicial/i);
  });

  it('sin acreedores, la solicitud de insolvencia se salta y las demás plantillas de creación siguen generándose', async () => {
    const caseData = makeCase({ type: 'INSOLVENCY', debts: [] });
    const { documents } = await generateDocumentsForNewCase(caseData as never, {
      uploadToGoogleDrive: false,
    });

    const solicitud = documents.find(
      (d) => d.templateId === 'solicitud-insolvencia',
    );
    expect(solicitud?.status).toBe('skipped');
    expect(solicitud?.error).toMatch(/acreedor/i);

    // No se sube a Drive con uploadToGoogleDrive:false, pero sí debe seguir
    // pasando por la Fase 2 (PDF sin subir) el resto de las plantillas.
    const others = documents.filter(
      (d) => d.templateId !== 'solicitud-insolvencia',
    );
    expect(others.length).toBeGreaterThan(0);
    expect(others.some((d) => d.status === 'success')).toBe(true);

    // La plantilla saltada nunca llegó a la Fase 2.
    const [docsPassedToBatch] = mockBatchHtmlToPdf.mock.calls[0];
    expect(
      docsPassedToBatch.some((d: { filename: string }) =>
        d.filename.startsWith('solicitud-insolvencia'),
      ),
    ).toBe(false);
  });

  it('el cache de subcarpetas evita un round-trip a Drive por documento (6 subidas, 1 sola resolución de carpeta)', async () => {
    const caseData = makeCase({ type: 'INSOLVENCY' });
    await generateDocumentsForAdmission(caseData as never, 'case-folder-id');

    expect(mockUploadFile).toHaveBeenCalledTimes(6);
    expect(mockCreateFolderHierarchy).toHaveBeenCalledTimes(1);
  });
});
