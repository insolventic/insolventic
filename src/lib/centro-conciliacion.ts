/**
 * Centro de Conciliación — Configuration & Validation
 *
 * Maps tenant IDs to their conciliation center names and provides
 * validation to enforce Drive folder isolation per center.
 *
 * Folder structure: documentos-generados/{CenterName}/{caseNumber}/
 *
 * IMPORTANT: The tenant→center mapping (CENTRO_BY_TENANT) is the single
 * source of truth for Drive folder routing. The Case field
 * `centroConciliacionNombre` is a display/legal field and must NOT be
 * used to determine storage paths — users enter free-text values like
 * "Centro de Conciliación Constructores de Paz" which don't match folder
 * names. Security is enforced by Prisma's `tenantId` filter on every
 * query, not by string comparison.
 */

import type { TenantId } from './prisma';

// ============================================
// CENTER CONFIGURATION
// ============================================

export interface CentroConciliacionConfig {
  /** The folder name used in Google Drive */
  driveFolderName: string;
  /** Display name for UI */
  displayName: string;
}

/**
 * Maps tenant IDs to their conciliation center Drive folder names.
 * This is the single source of truth for center ↔ folder mapping.
 */
const CENTRO_BY_TENANT: Record<TenantId, CentroConciliacionConfig> = {
  armonia: {
    driveFolderName: 'Armonía',
    displayName: 'Armonía',
  },
  'constructores-paz': {
    driveFolderName: 'Constructores de Paz',
    displayName: 'Constructores de Paz',
  },
};

/**
 * All valid center folder names — used for whitelist validation.
 */
export const VALID_CENTER_FOLDER_NAMES = Object.values(CENTRO_BY_TENANT).map(
  (c) => c.driveFolderName,
);

// ============================================
// RESOLUTION FUNCTIONS
// ============================================

/**
 * Resolves the Drive folder name for a center.
 *
 * Priority:
 *   1. Tenant mapping (authoritative — always correct)
 *   2. Fallback to case field only when tenant is unknown
 *
 * The tenant-to-center mapping is the authoritative source because:
 * - Cases are always loaded with `where: { tenantId }`, so they belong
 *   to the correct center by definition.
 * - The `centroConciliacionNombre` field is free-text input from users
 *   and may contain values like "Centro de Conciliación X" that don't
 *   match expected Drive folder names.
 *
 * `tenantSlug` debe ser el SLUG del centro (`'armonia'` |
 * `'constructores-paz'`), NO el cuid de `Tenant.id`/`Case.tenantId`.
 * `CENTRO_BY_TENANT` está indexado por slug — pasarle el cuid nunca
 * encuentra la fila y cae siempre al fallback (o lanza). Ver
 * `src/features/document/placeholders/tenant-slug.ts` para la fuente
 * correcta del slug en un caso ya cargado, y `authenticateUser()` para
 * la del slug de la sesión actual.
 *
 * @throws Error if neither source provides a valid center name
 */
export function resolveCenterFolderName(
  tenantSlug: string,
  _caseCentroConciliacion?: string | null,
): string {
  // 1. Tenant mapping is authoritative
  const config = CENTRO_BY_TENANT[tenantSlug as TenantId];
  if (config) {
    return config.driveFolderName;
  }

  // 2. Fallback: try the case-level field (only for unknown tenants)
  if (_caseCentroConciliacion && _caseCentroConciliacion.trim().length > 0) {
    const trimmed = _caseCentroConciliacion.trim();
    const match = Object.values(CENTRO_BY_TENANT).find(
      (c) =>
        c.driveFolderName.toLowerCase() === trimmed.toLowerCase() ||
        c.displayName.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      return match.driveFolderName;
    }
    const sanitized = sanitizeCenterName(trimmed);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  throw new Error(
    `No se pudo determinar el centro de conciliación para el tenant "${tenantSlug}". ` +
      'Asegúrese de que el tenant esté configurado en CENTRO_BY_TENANT.',
  );
}

/**
 * Gets the center config for a tenant ID.
 */
export function getCenterConfigByTenant(
  tenantId: string,
): CentroConciliacionConfig | undefined {
  return CENTRO_BY_TENANT[tenantId as TenantId];
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validates that a center folder name is safe for use as a Drive folder name.
 * Prevents path traversal, special chars, and empty values.
 */
export function sanitizeCenterName(name: string): string {
  // Remove path separators and null bytes
  let sanitized = name.replace(/[\\/\0]/g, '');
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  // Only allow alphanumeric, hyphens, underscores, spaces, and accented chars
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_\sáéíóúñÁÉÍÓÚÑ]/g, '');
  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100).trim();
  }
  return sanitized;
}

/**
 * Validates that a center name is one of the known valid centers.
 * Use this for strict validation when cross-center security is needed.
 */
export function isKnownCenter(centerName: string): boolean {
  return VALID_CENTER_FOLDER_NAMES.some(
    (name) => name.toLowerCase() === centerName.toLowerCase(),
  );
}

/**
 * Validates that a case's center matches the expected center for the tenant.
 * Returns an error message if they don't match, or null if valid.
 *
 * NOTE: This check is informational only. Real security is enforced by
 * Prisma's tenantId filter on every query. Do NOT use this to block
 * operations — the case field is free-text and may legitimately differ
 * from the Drive folder name.
 */
export function validateCenterBelongsToTenant(
  tenantId: string,
  centerFolderName: string,
): string | null {
  const config = CENTRO_BY_TENANT[tenantId as TenantId];
  if (!config) {
    return `Tenant "${tenantId}" no tiene un centro de conciliación configurado.`;
  }
  if (config.driveFolderName.toLowerCase() !== centerFolderName.toLowerCase()) {
    return (
      `El centro "${centerFolderName}" no pertenece al tenant "${tenantId}". ` +
      `Se esperaba "${config.driveFolderName}".`
    );
  }
  return null;
}
