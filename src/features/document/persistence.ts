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

import type { Prisma } from '@prisma/client';

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
      creditor: { select: { name: true, representative: true } },
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
 * Columnas `Json?` de Prisma que el schema Zod (`CaseWithRelations`) tipa como
 * filas estructuradas: en Prisma son `JsonValue` (forma desconocida), en el
 * schema son arrays de objetos con claves concretas. Son la ÚNICA diferencia
 * de tipos entre el payload de Prisma y `CaseWithRelations` (medido comparando
 * las ~280 claves y sus relaciones), y por eso antes hacía falta un doble
 * cast a través de `unknown` en cada sitio.
 */
type JsonRowKey =
  | 'concMenoresAlimentos'
  | 'concMenoresUnion'
  | 'concClausulasAdicionalesAlimentos'
  | 'concClausulasAdicionalesUnion'
  | 'concClausulasAdicionalesDisolucion'
  | 'concClausulasAcuerdo'
  | 'apoyoClausulas'
  | 'serviciosManutencion';

/**
 * Lo que `asCaseWithRelations` acepta: todo `CaseWithRelations` salvo las 7
 * columnas JSON, que se admiten con su tipo real de Prisma. Cualquier otra
 * clave o relación cuyo tipo deje de coincidir con el schema hace FALLAR LA
 * COMPILACIÓN aquí, en vez de pasar en silencio como con el doble cast.
 */
type CaseFromPrisma = Omit<CaseWithRelations, JsonRowKey> & {
  [K in JsonRowKey]?: Prisma.JsonValue | null;
};

/**
 * Puente único entre el payload de Prisma (o el objeto armado a mano a partir
 * de él) y el tipo `CaseWithRelations` que consume el mapper de placeholders.
 *
 * Reemplaza el doble cast a través de `unknown` que se repetía en cada
 * llamador: ese cast apagaba toda la comprobación de tipos. Aquí solo
 * quedan 7 aserciones explícitas y con nombre (las columnas JSON de arriba); el
 * resto lo verifica el compilador.
 *
 * NO cambia ningún valor: las 7 columnas se devuelven tal cual las entrega
 * Prisma, sin validar su forma, igual que antes. Decidir si esa forma se valida
 * en tiempo de ejecución (y qué hacer con un JSON mal formado en un documento
 * legal) es una decisión de diseño pendiente; ver el resumen del PR. Tampoco
 * convierte Decimal: los campos Decimal están tipados `any` en el schema
 * (`decimalToNumber = z.any().transform(...)`), por lo que el compilador no
 * puede vigilarlos.
 */
export function asCaseWithRelations(
  caseData: CaseFromPrisma,
): CaseWithRelations {
  return {
    ...caseData,
    concMenoresAlimentos:
      caseData.concMenoresAlimentos as CaseWithRelations['concMenoresAlimentos'],
    concMenoresUnion:
      caseData.concMenoresUnion as CaseWithRelations['concMenoresUnion'],
    concClausulasAdicionalesAlimentos:
      caseData.concClausulasAdicionalesAlimentos as CaseWithRelations['concClausulasAdicionalesAlimentos'],
    concClausulasAdicionalesUnion:
      caseData.concClausulasAdicionalesUnion as CaseWithRelations['concClausulasAdicionalesUnion'],
    concClausulasAdicionalesDisolucion:
      caseData.concClausulasAdicionalesDisolucion as CaseWithRelations['concClausulasAdicionalesDisolucion'],
    concClausulasAcuerdo:
      caseData.concClausulasAcuerdo as CaseWithRelations['concClausulasAcuerdo'],
    apoyoClausulas:
      caseData.apoyoClausulas as CaseWithRelations['apoyoClausulas'],
    serviciosManutencion:
      caseData.serviciosManutencion as CaseWithRelations['serviciosManutencion'],
  };
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
