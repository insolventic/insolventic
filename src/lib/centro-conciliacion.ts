/**
 * Centro de Conciliación — Configuration & Validation
 *
 * Maps tenant IDs to their conciliation center names and provides
 * validation to enforce Drive folder isolation per center.
 *
 * Folder structure: documentos-generados/{CenterName}/{caseNumber}/
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
    driveFolderName: 'Armonia',
    displayName: 'Armonía',
  },
  'constructores-paz': {
    driveFolderName: 'Construpaz',
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
 * Priority:
 *   1. Explicit `centroConciliacionNombre` from the Case record
 *   2. Fallback: mapped from the tenantId
 *
 * @throws Error if neither source provides a valid center name
 */
export function resolveCenterFolderName(
  tenantId: string,
  caseCentroConciliacion?: string | null,
): string {
  // 1. Try the explicit case-level field
  if (caseCentroConciliacion && caseCentroConciliacion.trim().length > 0) {
    const trimmed = caseCentroConciliacion.trim();
    // Check if it's a known center name
    const match = Object.values(CENTRO_BY_TENANT).find(
      (c) =>
        c.driveFolderName.toLowerCase() === trimmed.toLowerCase() ||
        c.displayName.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      return match.driveFolderName;
    }
    // Accept the value as-is if it passes sanitization
    const sanitized = sanitizeCenterName(trimmed);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  // 2. Fallback to tenant mapping
  const config = CENTRO_BY_TENANT[tenantId as TenantId];
  if (config) {
    return config.driveFolderName;
  }

  throw new Error(
    `No se pudo determinar el centro de conciliación para el tenant "${tenantId}". ` +
      'Asegúrese de que el caso tenga un centroConciliacionNombre o que el tenant esté configurado.',
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
