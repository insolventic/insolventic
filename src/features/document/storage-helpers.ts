/**
 * Storage Helpers — sectioned-layout (v1) utilities.
 *
 * Three independent helpers, all opt-in / no-op for legacy cases:
 *   1. archiveSupersededDocument: move regenerated doc to 04-Historial/ + DB link
 *   2. migrateLegacyCaseToV1: lazy on-demand migrator for layout v0 cases
 *   3. resolveConciliationCenter: DB-first center lookup with hard-coded fallback
 */

import prisma from '@/lib/prisma';
import { googleDriveService } from '@/lib/google-drive';
import { resolveCenterFolderName } from '@/lib/centro-conciliacion';

/**
 * Document section enum (mirrors String? column on Document).
 */
export type DocumentSection =
  | 'GENERADO'
  | 'ADJUNTO'
  | 'EVIDENCIA'
  | 'HISTORIAL';

// ---------------------------------------------------------------------------
// 1. Archive superseded document into 04-Historial/{categoria}/
// ---------------------------------------------------------------------------

/**
 * When a generated document is regenerated, move the previous Drive file
 * into the case's 04-Historial/ folder and persist the supersededBy link.
 *
 * Safe no-op when the case is on layout v0 (legacy) — historial only exists in v1.
 */
export async function archiveSupersededDocument(params: {
  tenantId: string;
  caseId: string;
  caseFolderId: string | null;
  layoutVersion: number;
  templateId: string;
  newDocumentId: string;
  category?: string;
}): Promise<void> {
  const {
    tenantId,
    caseId,
    caseFolderId,
    layoutVersion,
    templateId,
    newDocumentId,
    category,
  } = params;

  if (layoutVersion < 1 || !caseFolderId) return;

  const previous = await prisma.document.findFirst({
    where: {
      tenantId,
      caseId,
      templateId,
      isGenerated: true,
      supersededById: null,
      id: { not: newDocumentId },
    },
    orderBy: { uploadDate: 'desc' },
    select: { id: true, googleDriveId: true, fileName: true },
  });

  if (!previous?.googleDriveId) return;

  try {
    const historialPath = category
      ? ['04-Historial', category]
      : ['04-Historial'];
    const historialFolderId = await googleDriveService.createFolderHierarchy(
      historialPath,
      caseFolderId,
    );

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = previous.fileName?.match(/\.(pdf|html|docx)$/i)?.[0] ?? '';
    const baseName =
      previous.fileName?.replace(/\.(pdf|html|docx)$/i, '') ?? 'archived';
    const archivedName = `${baseName}__v${stamp}${ext}`;

    await googleDriveService.moveFile(
      previous.googleDriveId,
      historialFolderId,
      archivedName,
    );
  } catch (err) {
    // Drive failure must not break document generation; just log.
    console.warn('archiveSupersededDocument: Drive move failed', err);
  }

  await prisma.document.update({
    where: { id: previous.id },
    data: {
      supersededById: newDocumentId,
      section: 'HISTORIAL',
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Lazy migrator: legacy v0 case → v1 sectioned layout
// ---------------------------------------------------------------------------

/**
 * Migrates a single case from layout v0 to v1.
 *
 * Strategy (idempotent, reversible by Drive activity log):
 *   - Skip if case is already v1.
 *   - Build the new hierarchy under Insolventic/{Centro}/{TipoCaso}/{YYYY}/.
 *   - Move the existing case folder INTO the new parent (Drive `parents` swap),
 *     so files keep their IDs and DB references stay valid.
 *   - Inside, create 01-Generados / 02-Adjuntos / 03-Evidencias / 04-Historial.
 *   - Persist layoutVersion=1 and refresh driveFolderId if changed.
 *
 * Returns { migrated: boolean } so callers can react (toast, audit log).
 *
 * `tenantId` (cuid de `Tenant.id`, para el `where` de Prisma) y
 * `tenantSlug` (`'armonia'` | `'constructores-paz'`, para
 * `resolveCenterFolderName`) son DOS valores distintos — ver
 * `src/features/document/placeholders/tenant-slug.ts`. No hay un único
 * llamador del que derivar uno a partir del otro, así que esta función
 * los recibe por separado en vez de adivinar.
 */
export async function migrateLegacyCaseToV1(
  caseId: string,
  tenantId: string,
  tenantSlug: string,
): Promise<{ migrated: boolean; reason?: string }> {
  const c = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: {
      id: true,
      caseNumber: true,
      type: true,
      driveFolderId: true,
      layoutVersion: true,
      centroConciliacionNombre: true,
      debtorName: true,
    },
  });

  if (!c) return { migrated: false, reason: 'Caso no encontrado' };
  if (c.layoutVersion >= 1)
    return { migrated: false, reason: 'Ya está en layout v1' };
  if (!c.driveFolderId)
    return { migrated: false, reason: 'Sin carpeta Drive previa' };

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId)
    return { migrated: false, reason: 'GOOGLE_DRIVE_FOLDER_ID no configurado' };

  const centerFolderName = resolveCenterFolderName(
    tenantSlug,
    c.centroConciliacionNombre,
  );
  const caseTypeLabel =
    c.type === 'CONCILIATION'
      ? 'Conciliación'
      : c.type === 'SUPPORT_AGREEMENT'
        ? 'Acuerdos de Apoyo'
        : 'Insolvencia';

  // Build / find new parent: Insolventic/{Centro}/{TipoCaso}/{YYYY}/
  const year = String(new Date().getFullYear());
  const newParentId = await googleDriveService.createFolderHierarchy(
    ['Insolventic', centerFolderName, caseTypeLabel, year],
    rootFolderId,
  );

  // Move legacy case folder under new parent (keeps its ID and contents).
  try {
    await googleDriveService.moveFile(c.driveFolderId, newParentId);
  } catch (err) {
    return {
      migrated: false,
      reason: `Drive move failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  // Pre-create the 4 standard sections inside the (now-moved) case folder.
  for (const sec of [
    '01-Generados',
    '02-Adjuntos',
    '03-Evidencias',
    '04-Historial',
  ]) {
    try {
      await googleDriveService.createFolderHierarchy([sec], c.driveFolderId);
    } catch {
      /* idempotent — ignore */
    }
  }

  await prisma.case.update({
    where: { id: caseId, tenantId },
    data: { layoutVersion: 1 },
  });

  return { migrated: true };
}

// ---------------------------------------------------------------------------
// 3. ConciliationCenter — DB-first lookup with hard-coded fallback
// ---------------------------------------------------------------------------

/**
 * Resolve a center folder name from DB; fall back to the hard-coded mapping
 * if no DB record exists. New centers can be added by INSERT into
 * ConciliationCenter without code changes.
 *
 * `tenantId` (cuid, FK real de `ConciliationCenter.tenantId`) y
 * `tenantSlug` (para el fallback hard-coded, indexado por slug) son dos
 * valores distintos — ver `tenant-slug.ts`.
 */
export async function resolveCenterFolderNameDB(
  tenantId: string,
  tenantSlug: string,
  caseCentroConciliacion?: string | null,
): Promise<string> {
  try {
    const center = await prisma.conciliationCenter.findFirst({
      where: { tenantId, isActive: true },
      select: { driveFolderName: true },
    });
    if (center?.driveFolderName) return center.driveFolderName;
  } catch {
    /* DB fall-through to hard-coded mapping */
  }
  return resolveCenterFolderName(tenantSlug, caseCentroConciliacion);
}
