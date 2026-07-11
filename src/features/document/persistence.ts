/**
 * Document Persistence Helpers
 *
 * Shared, non-action utilities used by the server actions in
 * `actions-generation.ts` and by the case-creation flow in
 * `features/case/actions.ts`. Centralizes:
 *   1. The Prisma `include` needed to build a CaseWithRelations for generation.
 *   2. Persisting GeneratedDocument results as Document rows (single source
 *      of truth for mimeType inference and record shape).
 */

import prisma from '@/lib/prisma';
import type { GeneratedDocument } from './generate-documents';

/**
 * Relations required by mapCaseToPlaceholders / document generation.
 * Keep in sync with CaseWithRelations (features/case/schemas).
 */
export const CASE_GENERATION_INCLUDE = {
  debtor: true,
  operator: {
    select: { id: true, name: true, email: true },
  },
  documents: true,
  debts: {
    include: {
      creditor: { select: { name: true } },
    },
  },
  assets: true,
  libranzas: true,
  suspendedServices: true,
  dependents: true,
  legalProcesses: true,
  acreedores: true,
  bienes: true,
  procesosJudiciales: true,
  _count: { select: { documents: true } },
} as const;

/**
 * Fetch a case with every relation needed for document generation,
 * scoped to the tenant.
 */
export async function fetchCaseForGeneration(caseId: string, tenantId: string) {
  return prisma.case.findUnique({
    where: { id: caseId, tenantId },
    include: CASE_GENERATION_INCLUDE,
  });
}

/**
 * Infer the MIME type from a generated file name.
 * Previously every record was stored as 'application/pdf' even for HTML/XLSX.
 */
export function inferMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'html':
      return 'text/html';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Persist successfully generated documents as Document rows.
 * Skips results that failed or were skipped by validation.
 * Returns the number of records created.
 */
export async function persistGeneratedDocuments(
  docs: GeneratedDocument[],
  caseId: string,
  tenantId: string,
): Promise<number> {
  const successful = docs.filter(
    (d) => d.status === 'success' && d.googleDriveId,
  );
  if (successful.length === 0) return 0;

  const result = await prisma.document.createMany({
    data: successful.map((doc) => ({
      name: doc.templateName,
      type: 'generated',
      status: 'completed',
      url: doc.googleDriveUrl,
      caseId,
      tenantId,
      googleDriveId: doc.googleDriveId,
      fileName: doc.fileName,
      mimeType: inferMimeType(doc.fileName),
      isGenerated: true,
      section: 'GENERADO',
    })),
  });
  return result.count;
}
