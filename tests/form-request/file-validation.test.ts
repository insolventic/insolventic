/**
 * Tests: File Upload Validation
 * Validates MIME type whitelist, file size limits, and file name limits.
 */

import {
  uploadCaseDocumentInputSchema,
  ALLOWED_UPLOAD_MIME_TYPES,
} from '@/features/document/schemas';

describe('File Validation — Document Upload Schema', () => {
  const CUATRO_MB = 4 * 1024 * 1024;

  const archivo = (
    nombre: string,
    tipo: string,
    contenido: BlobPart = 'test',
  ) => new File([contenido], nombre, { type: tipo });

  const entrada = (file: File) => ({
    caseId: 'case-123',
    docName: 'Cédula de ciudadanía',
    file,
  });

  const valida = (file: File) =>
    uploadCaseDocumentInputSchema.safeParse(entrada(file)).success;

  describe('Allowed MIME types', () => {
    it('should define PDF, JPEG, and PNG as allowed types', () => {
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/png');
    });

    it.each([
      ['doc.pdf', 'application/pdf'],
      ['foto.jpg', 'image/jpeg'],
      ['scan.png', 'image/png'],
    ])('should accept %s', (nombre, tipo) => {
      expect(valida(archivo(nombre, tipo))).toBe(true);
    });

    it.each([
      ['malware.exe', 'application/x-msdownload'],
      ['script.js', 'text/javascript'],
      ['page.html', 'text/html'],
      ['image.svg', 'image/svg+xml'],
      ['sin-tipo.pdf', ''],
    ])('should reject %s', (nombre, tipo) => {
      expect(valida(archivo(nombre, tipo))).toBe(false);
    });
  });

  describe('File size limits', () => {
    it('should accept a file exactly at the limit', () => {
      expect(
        valida(archivo('a.pdf', 'application/pdf', new Uint8Array(CUATRO_MB))),
      ).toBe(true);
    });

    it('should reject one byte over the limit with the clear message', () => {
      const result = uploadCaseDocumentInputSchema.safeParse(
        entrada(
          archivo('a.pdf', 'application/pdf', new Uint8Array(CUATRO_MB + 1)),
        ),
      );
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/el máximo es 4 MB/);
    });

    it('should reject an empty file', () => {
      expect(valida(archivo('a.pdf', 'application/pdf', ''))).toBe(false);
    });
  });

  describe('File name validation', () => {
    it('should reject fileName exceeding 255 characters', () => {
      expect(valida(archivo('a'.repeat(260) + '.pdf', 'application/pdf'))).toBe(
        false,
      );
    });

    it('should reject empty fileName', () => {
      expect(valida(archivo('', 'application/pdf'))).toBe(false);
    });
  });

  describe('Required fields', () => {
    const file = archivo('a.pdf', 'application/pdf');

    it('should reject missing caseId', () => {
      expect(
        uploadCaseDocumentInputSchema.safeParse({ docName: 'A', file }).success,
      ).toBe(false);
    });

    it('should reject empty docName', () => {
      expect(
        uploadCaseDocumentInputSchema.safeParse({
          caseId: 'case-1',
          docName: '',
          file,
        }).success,
      ).toBe(false);
    });

    it('should reject a payload without a File (the old base64 shape)', () => {
      expect(
        uploadCaseDocumentInputSchema.safeParse({
          caseId: 'case-1',
          docName: 'A',
          file: { fileName: 'a.pdf', dataBase64: 'dGVzdA==' },
        }).success,
      ).toBe(false);
    });
  });
});
