/**
 * `uploadCaseDocument`: el servidor recibe un archivo por llamada, como `File`,
 * y es quien manda sobre el tamaño.
 *
 * Antes la acción recibía todos los archivos del caso en una sola llamada y en
 * base64, y prometía 10 MB por archivo. Medido contra `next dev` con
 * `bodySizeLimit: '4.25mb'`: un lote de 2 + 2 MB ya rechazaba la promesa.
 */

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

const mockCaseFindUnique = jest.fn();
const mockDocumentCreate = jest.fn();
const mockDocumentFromDriveUpsert = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: (...a: unknown[]) => mockCaseFindUnique(...a),
      update: jest.fn(),
    },
    document: { create: (...a: unknown[]) => mockDocumentCreate(...a) },
    documentFromDrive: {
      upsert: (...a: unknown[]) => mockDocumentFromDriveUpsert(...a),
    },
  },
}));

jest.mock('@/features/auth/actions', () => ({
  authenticateUser: jest.fn(),
}));

const mockCreateAuditLog = jest.fn();
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

const mockCreateFolderHierarchy = jest.fn();
const mockUploadFile = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
    getFileUrl: (id: string) => `https://drive.google.com/file/d/${id}/view`,
  },
}));

jest.mock('@/lib/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

import { authenticateUser } from '@/features/auth/actions';
import { uploadCaseDocument } from '@/features/document/actions';
import { P } from '@/lib/permissions';

/** A propósito sin importar la constante: es la cifra que se le promete al usuario. */
const CUATRO_MB = 4 * 1024 * 1024;

function pdfDe(tamano: number, nombre = 'cédula.pdf'): File {
  return new File([new Uint8Array(tamano)], nombre, {
    type: 'application/pdf',
  });
}

function subir(file: File, docName = 'Cédula de ciudadanía') {
  return uploadCaseDocument({ caseId: 'caso-1', docName, file });
}

describe('uploadCaseDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    (authenticateUser as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Operadora',
        professionalCard: '123',
        permissions: [P.GENERAR_DOCUMENTOS],
      },
      tenantId: 'tenant-1',
      tenantSlug: 'armonia',
    });
    mockCaseFindUnique.mockResolvedValue({
      id: 'caso-1',
      caseNumber: 'C-1',
      centroConciliacionNombre: null,
      driveFolderId: 'carpeta-caso',
      layoutVersion: 1,
    });
    mockCreateFolderHierarchy.mockResolvedValue('carpeta-adjuntos');
    mockUploadFile.mockResolvedValue('archivo-subido');
    mockDocumentCreate.mockResolvedValue({ id: 'documento-1' });
    mockDocumentFromDriveUpsert.mockResolvedValue({});
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('tamaño', () => {
    it('acepta un archivo justo por debajo del límite y lo sube íntegro', async () => {
      const resultado = await subir(pdfDe(CUATRO_MB - 1));

      expect(resultado).toEqual({ success: true });
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      const [, contenido, tipo, carpeta] = mockUploadFile.mock.calls[0];
      expect(Buffer.isBuffer(contenido)).toBe(true);
      expect(contenido).toHaveLength(CUATRO_MB - 1);
      expect(tipo).toBe('application/pdf');
      expect(carpeta).toBe('carpeta-adjuntos');
    });

    it('acepta un archivo exactamente en el límite', async () => {
      await expect(subir(pdfDe(CUATRO_MB))).resolves.toEqual({ success: true });
    });

    it('rechaza un byte de más con el mensaje claro, sin tocar Drive ni la base', async () => {
      const resultado = await subir(pdfDe(CUATRO_MB + 1));

      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/el máximo es 4 MB/);
      expect(resultado.error).toMatch(/Comprime el PDF o reduce la foto/);
      expect(mockCaseFindUnique).not.toHaveBeenCalled();
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(mockDocumentCreate).not.toHaveBeenCalled();
    });

    it('rechaza un archivo vacío', async () => {
      const resultado = await subir(pdfDe(0));

      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/vacío/);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });
  });

  describe('registro', () => {
    it('guarda el documento en el caso y en el centro de la sesión', async () => {
      await subir(pdfDe(10));

      expect(mockCaseFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'caso-1', tenantId: 'tenant-1' },
        }),
      );
      expect(mockDocumentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Cédula de ciudadanía',
          caseId: 'caso-1',
          tenantId: 'tenant-1',
          googleDriveId: 'archivo-subido',
          mimeType: 'application/pdf',
        }),
      });
    });

    it('deja en la auditoría qué archivo se adjuntó, antes de responder', async () => {
      let auditado = false;
      mockCreateAuditLog.mockImplementation(async () => {
        await Promise.resolve();
        auditado = true;
      });

      await subir(pdfDe(10, 'redam.pdf'));

      expect(auditado).toBe(true);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'document',
          entityId: 'caso-1',
          entityName: expect.stringContaining('redam.pdf'),
          tenantId: 'tenant-1',
        }),
      );
    });
  });

  describe('rechazos que el usuario tiene que poder entender', () => {
    it('sin permiso no sube nada', async () => {
      (authenticateUser as jest.Mock).mockResolvedValue({
        user: { id: 'user-1', permissions: [] },
        tenantId: 'tenant-1',
        tenantSlug: 'armonia',
      });

      const resultado = await subir(pdfDe(10));

      expect(resultado).toEqual({
        success: false,
        error: 'No tienes permisos para subir documentos',
      });
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('un tipo no permitido se explica con texto, no con el JSON de zod', async () => {
      const resultado = await subir(
        new File(['x'], 'datos.zip', { type: 'application/zip' }),
      );

      expect(resultado.success).toBe(false);
      expect(resultado.error).toBe(
        'Tipo de archivo no permitido. Solo se aceptan PDF, JPG y PNG.',
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('una extensión que no coincide con el tipo se rechaza', async () => {
      const resultado = await subir(
        new File(['x'], 'foto.png', { type: 'application/pdf' }),
      );

      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/no coincide/);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('un caso de otro centro responde "Caso no encontrado"', async () => {
      mockCaseFindUnique.mockResolvedValue(null);

      const resultado = await subir(pdfDe(10));

      expect(resultado).toEqual({
        success: false,
        error: 'Caso no encontrado',
      });
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('si Drive falla dice que no se guardó, sin el detalle técnico', async () => {
      mockUploadFile.mockRejectedValue(new Error('invalid_grant: token viejo'));

      const resultado = await subir(pdfDe(10));

      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/No se pudo guardar el archivo/);
      expect(resultado.error).not.toMatch(/invalid_grant/);
      expect(mockDocumentCreate).not.toHaveBeenCalled();
    });

    it('si la sesión venció lo dice, para que no se reintente sin entrar', async () => {
      (authenticateUser as jest.Mock).mockRejectedValue(
        new Error('No hay token de acceso'),
      );

      const resultado = await subir(pdfDe(10));

      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/sesión/);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });
  });
});
