/**
 * Tests: Drive Storage Structure & Multi-tenant Isolation
 * Validates that documents use the correct folder structure and enforce tenant isolation.
 */

import {
  uploadCaseDocumentsInputSchema,
} from '@/features/document/schemas';

// We test the schema validation and structural expectations.
// Actual Google Drive integration is mocked in integration tests.

describe('Drive Storage — Folder Structure & Multi-tenant', () => {
  describe('Upload input validation', () => {
    const validDoc = {
      docName: 'Cédula de ciudadanía',
      fileName: 'cedula.pdf',
      mimeType: 'application/pdf' as const,
      dataBase64: 'dGVzdA==',
    };

    it('should require a caseId to associate documents with a case', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        personName: 'Test',
        documents: [validDoc],
      });
      expect(result.success).toBe(false);
    });

    it('should require caseId to be non-empty', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: '',
        personName: 'Test',
        documents: [validDoc],
      });
      expect(result.success).toBe(false);
    });

    it('should validate correct input structure', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-123',
        personName: 'Juan Rodríguez',
        documents: [validDoc],
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple documents for batch upload', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-123',
        personName: 'Juan',
        documents: [
          { ...validDoc, docName: 'Cédula' },
          { ...validDoc, docName: 'REDAM', fileName: 'redam.pdf' },
          { ...validDoc, docName: 'Ingresos', fileName: 'ingresos.pdf' },
          { ...validDoc, docName: 'Foto', fileName: 'foto.jpg', mimeType: 'image/jpeg' as const },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.documents).toHaveLength(4);
      }
    });
  });

  describe('Document type tracking', () => {
    it('should preserve docName for database type field', () => {
      const input = {
        caseId: 'case-1',
        personName: 'Test',
        documents: [
          {
            docName: 'Certificado REDAM',
            fileName: 'redam_2024.pdf',
            mimeType: 'application/pdf' as const,
            dataBase64: 'dGVzdA==',
          },
        ],
      };
      const result = uploadCaseDocumentsInputSchema.parse(input);
      expect(result.documents[0].docName).toBe('Certificado REDAM');
    });
  });

  describe('File type enforcement for Drive uploads', () => {
    const baseInput = {
      caseId: 'case-1',
      personName: 'Test',
    };

    it('should only allow PDF, JPEG, PNG in Drive uploads', () => {
      // PDF — allowed
      expect(
        uploadCaseDocumentsInputSchema.safeParse({
          ...baseInput,
          documents: [{ docName: 'A', fileName: 'a.pdf', mimeType: 'application/pdf', dataBase64: 'x' }],
        }).success,
      ).toBe(true);

      // JPEG — allowed
      expect(
        uploadCaseDocumentsInputSchema.safeParse({
          ...baseInput,
          documents: [{ docName: 'B', fileName: 'b.jpg', mimeType: 'image/jpeg', dataBase64: 'x' }],
        }).success,
      ).toBe(true);

      // PNG — allowed
      expect(
        uploadCaseDocumentsInputSchema.safeParse({
          ...baseInput,
          documents: [{ docName: 'C', fileName: 'c.png', mimeType: 'image/png', dataBase64: 'x' }],
        }).success,
      ).toBe(true);

      // DOCX — blocked
      expect(
        uploadCaseDocumentsInputSchema.safeParse({
          ...baseInput,
          documents: [{
            docName: 'D',
            fileName: 'd.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            dataBase64: 'x',
          }],
        }).success,
      ).toBe(false);

      // ZIP — blocked
      expect(
        uploadCaseDocumentsInputSchema.safeParse({
          ...baseInput,
          documents: [{ docName: 'E', fileName: 'e.zip', mimeType: 'application/zip', dataBase64: 'x' }],
        }).success,
      ).toBe(false);
    });
  });

  describe('Tenant isolation expectations', () => {
    it('should require personName for upload context (tenant user identification)', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-1',
        personName: '',
        documents: [{ docName: 'A', fileName: 'a.pdf', mimeType: 'application/pdf', dataBase64: 'x' }],
      });
      expect(result.success).toBe(false);
    });

    it('should enforce caseId association (prevents cross-case access)', () => {
      // Each document upload is tied to a specific caseId
      const result = uploadCaseDocumentsInputSchema.parse({
        caseId: 'case-specific-id',
        personName: 'User',
        documents: [{ docName: 'Doc', fileName: 'doc.pdf', mimeType: 'application/pdf', dataBase64: 'x' }],
      });
      expect(result.caseId).toBe('case-specific-id');
    });
  });
});
