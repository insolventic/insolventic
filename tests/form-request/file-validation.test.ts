/**
 * Tests: File Upload Validation
 * Validates MIME type whitelist, file size limits, and filename sanitization.
 */

import {
  uploadCaseDocumentsInputSchema,
  ALLOWED_UPLOAD_MIME_TYPES,
} from '@/features/document/schemas';

describe('File Validation — Document Upload Schema', () => {
  const validBase = {
    caseId: 'case-123',
    personName: 'Test User',
  };

  const makeDoc = (overrides: Partial<{
    docName: string;
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }> = {}) => ({
    docName: overrides.docName ?? 'Cédula de ciudadanía',
    fileName: overrides.fileName ?? 'cedula.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    dataBase64: overrides.dataBase64 ?? 'dGVzdA==', // "test" in base64
  });

  describe('Allowed MIME types', () => {
    it('should define PDF, JPEG, and PNG as allowed types', () => {
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/png');
    });

    it('should accept PDF file', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'application/pdf', fileName: 'doc.pdf' })],
      });
      expect(result.success).toBe(true);
    });

    it('should accept JPEG file', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'image/jpeg', fileName: 'foto.jpg' })],
      });
      expect(result.success).toBe(true);
    });

    it('should accept PNG file', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'image/png', fileName: 'scan.png' })],
      });
      expect(result.success).toBe(true);
    });

    it('should reject executable file (application/x-msdownload)', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'application/x-msdownload', fileName: 'malware.exe' })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject JavaScript file (text/javascript)', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'text/javascript', fileName: 'script.js' })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject HTML file (text/html)', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'text/html', fileName: 'page.html' })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject SVG file (image/svg+xml)', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: 'image/svg+xml', fileName: 'image.svg' })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty mimeType', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ mimeType: '' })],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('File size limits', () => {
    it('should reject base64 string exceeding 10MB (~13.7M base64)', () => {
      const hugeBase64 = 'A'.repeat(14_000_000);
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ dataBase64: hugeBase64 })],
      });
      expect(result.success).toBe(false);
    });

    it('should accept file within 10MB limit', () => {
      const smallBase64 = 'A'.repeat(1000);
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ dataBase64: smallBase64 })],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('File name validation', () => {
    it('should reject fileName exceeding 255 characters', () => {
      const longName = 'a'.repeat(260) + '.pdf';
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ fileName: longName })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileName', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [makeDoc({ fileName: '' })],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Document array validation', () => {
    it('should reject empty documents array', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [],
      });
      expect(result.success).toBe(false);
    });

    it('should accept multiple valid documents', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [
          makeDoc({ docName: 'Cédula', fileName: 'cedula.pdf' }),
          makeDoc({ docName: 'REDAM', fileName: 'redam.pdf' }),
          makeDoc({ docName: 'Foto', fileName: 'foto.jpg', mimeType: 'image/jpeg' }),
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject if one document in array has invalid mimeType', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [
          makeDoc({ docName: 'Valid', fileName: 'ok.pdf' }),
          makeDoc({ docName: 'Malicious', fileName: 'bad.exe', mimeType: 'application/x-msdownload' }),
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Required fields', () => {
    it('should reject missing caseId', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        personName: 'Test',
        documents: [makeDoc()],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing personName', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-1',
        documents: [makeDoc()],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing docName in document', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        ...validBase,
        documents: [{ fileName: 'test.pdf', mimeType: 'application/pdf', dataBase64: 'dGVzdA==', docName: '' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
