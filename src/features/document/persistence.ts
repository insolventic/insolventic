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
import type { CaseWithRelations } from '../case/schemas';

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
  apoderados: { orderBy: { orden: 'asc' } },
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
 * ADR (mini): puente único entre el payload de Prisma (Decimal, relaciones)
 * y el tipo CaseWithRelations (Zod, number) que consume el mapper de
 * placeholders. Ambos tipos son estructuralmente compatibles en los campos
 * que la generación usa, pero difieren en Decimal vs number, por lo que un
 * assert directo no compila. Centralizar el cast aquí (en vez de repetir
 * `as unknown as` en cada call-site) acota el punto ciego a una función
 * documentada. La eliminación real —derivar el tipo con
 * Prisma.CaseGetPayload<typeof CASE_GENERATION_INCLUDE> + un transformador
 * Decimal→number— está planificada para la sesión de refactor de tipos.
 */
export function asCaseWithRelations(
  caseData: NonNullable<Awaited<ReturnType<typeof fetchCaseForGeneration>>>,
): CaseWithRelations {
  return caseData as unknown as CaseWithRelations;
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
