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

/**
 * Una plantilla puede producir MAS de un documento. El oficio de suspension va
 * dirigido a un juzgado: con procesos en tres juzgados hacen falta tres
 * oficios, no uno con los datos del primero. Ver `template-variants.ts`.
 *
 * Los tres puntos donde esto se rompe estan en el pipeline, no en el modulo de
 * variantes: la clave con la que la Fase 2 indexa los buffers, el nombre de
 * archivo que se sube a Drive, y el nombre de la fila de `Document`.
 */
describe('generateFromTemplates — N documentos de una misma plantilla', () => {
  const TRES_JUZGADOS = [
    {
      court: 'Juzgado 1 Civil Municipal de Cali',
      plaintiff: 'Banco Uno S.A.',
      processType: 'EJECUTIVO',
      description: 'Proceso 1',
    },
    {
      court: 'Juzgado 2 Civil Municipal de Cali',
      plaintiff: 'Cooperativa Dos',
      processType: 'LABORAL',
      description: 'Proceso 2',
    },
    {
      court: 'Juzgado 3 Laboral del Circuito de Cali',
      plaintiff: 'Empleador Tres Ltda.',
      processType: 'COACTIVO',
      description: 'Proceso 3',
    },
  ];

  const conJuzgados = (procesos = TRES_JUZGADOS) =>
    makeCase({ type: 'INSOLVENCY', legalProcesses: procesos });

  it('tres juzgados producen tres oficios (antes salia uno solo, dirigido al primero)', async () => {
    const result = await generateDocumentsForAdmission(
      conJuzgados() as never,
      'case-folder-id',
    );

    const oficios = result.filter(
      (d) => d.templateId === 'suspension-juzgados',
    );
    expect(oficios).toHaveLength(3);
    expect(oficios.every((d) => d.status === 'success')).toBe(true);
  });

  it('cada oficio se sube con su propio nombre de archivo: ninguno sobreescribe al otro en Drive', async () => {
    const result = await generateDocumentsForAdmission(
      conJuzgados() as never,
      'case-folder-id',
    );

    const nombres = result
      .filter((d) => d.templateId === 'suspension-juzgados')
      .map((d) => d.fileName);

    expect(new Set(nombres).size).toBe(3);
    expect(nombres[0]).toContain('_1_Juzgado_1_Civil_Municipal_de_Cali');
    expect(nombres[2]).toContain('_3_Juzgado_3_Laboral_del_Circuito_de_Ca');
  });

  it('cada oficio lleva SU juzgado: la Fase 2 no puede devolver el PDF del primero', async () => {
    await generateDocumentsForAdmission(
      conJuzgados() as never,
      'case-folder-id',
    );

    const [docsPassedToBatch] = mockBatchHtmlToPdf.mock.calls[0];
    const oficios = (
      docsPassedToBatch as Array<{ filename: string; html: string }>
    ).filter((d) => d.filename.startsWith('suspension-juzgados'));

    expect(oficios).toHaveLength(3);
    // Las claves con las que se indexan los buffers: si fueran iguales, el
    // segundo y el tercer oficio subirian el PDF del primero.
    expect(new Set(oficios.map((d) => d.filename)).size).toBe(3);

    expect(oficios[0].html).toContain('Juzgado 1 Civil Municipal de Cali');
    expect(oficios[0].html).not.toContain('Juzgado 2 Civil Municipal de Cali');
    expect(oficios[1].html).toContain('Juzgado 2 Civil Municipal de Cali');
    expect(oficios[2].html).toContain('Juzgado 3 Laboral del Circuito de Cali');
  });

  it('cada oficio se distingue en la fila de Document por el nombre del juzgado', async () => {
    const result = await generateDocumentsForAdmission(
      conJuzgados() as never,
      'case-folder-id',
    );

    const nombres = result
      .filter((d) => d.templateId === 'suspension-juzgados')
      .map((d) => d.displayName);

    expect(nombres).toEqual([
      'Suspension Juzgados — Juzgado 1 Civil Municipal de Cali',
      'Suspension Juzgados — Juzgado 2 Civil Municipal de Cali',
      'Suspension Juzgados — Juzgado 3 Laboral del Circuito de Cali',
    ]);
  });

  it('con UN solo juzgado nada cambia: un documento, sin sufijo en el nombre', async () => {
    const result = await generateDocumentsForAdmission(
      conJuzgados([TRES_JUZGADOS[0]]) as never,
      'case-folder-id',
    );

    const oficios = result.filter(
      (d) => d.templateId === 'suspension-juzgados',
    );
    expect(oficios).toHaveLength(1);
    expect(oficios[0].fileName).toBe('INS-2026-042_Suspension_Juzgados.pdf');
  });

  it('el resto de las plantillas de Admision sigue produciendo un documento cada una', async () => {
    const result = await generateDocumentsForAdmission(
      conJuzgados() as never,
      'case-folder-id',
    );

    const porPlantilla = new Map<string, number>();
    for (const d of result) {
      porPlantilla.set(d.templateId, (porPlantilla.get(d.templateId) ?? 0) + 1);
    }

    expect(porPlantilla.get('suspension-juzgados')).toBe(3);
    for (const [templateId, n] of porPlantilla) {
      if (templateId === 'suspension-juzgados') continue;
      expect(n).toBe(1);
    }
  });
});
