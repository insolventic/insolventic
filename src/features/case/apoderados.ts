/**
 * Apoderados del expediente — Formulario Definitivo, Sección XI.
 *
 * Migración gradual (patrón strangler): la tabla `apoderados` guarda la lista
 * completa, y el apoderado principal (el primero) se espeja ADEMÁS en las 8
 * columnas escalares `apoderado_*` de Case, que siguen leyendo los documentos
 * y la vista de detalle de los casos ya existentes.
 *
 * Módulo sin 'use server': lo consume `createCase` y lo cubren tests unitarios.
 */

import type { ApoderadoFormData } from './schemas';

const LEGACY_TEXT_FIELDS = [
  'apoderadoNombreCompleto',
  'apoderadoTipoIdentificacion',
  'apoderadoIdentificacion',
  'apoderadoTarjetaProfesional',
  'apoderadoDireccion',
  'apoderadoTelefono',
  'apoderadoCorreo',
] as const;

type LegacyTextField = (typeof LEGACY_TEXT_FIELDS)[number];

/** Las 8 columnas escalares "apoderado_*" de Case (apoderado único, legado). */
export type LegacyApoderadoScalars = Partial<
  Record<LegacyTextField, string | null>
> & { existePoderOtorgado?: boolean };

const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '');

const cleanText = (value: string | undefined): string | null =>
  isBlank(value) ? null : (value as string).trim();

/**
 * Filas para el nested create de `prisma.case.create` (mismo patrón que
 * `acreedores`/`bienes`). `orden` conserva la posición del formulario:
 * 0 = apoderado principal.
 */
export function buildApoderadosCreate(
  apoderados: ApoderadoFormData[] | undefined,
  tenantId: string,
) {
  if (!apoderados || apoderados.length === 0) return undefined;

  return {
    create: apoderados.map((a, orden) => ({
      orden,
      nombreCompleto: a.nombreCompleto,
      tipoIdentificacion: cleanText(a.tipoIdentificacion),
      identificacion: cleanText(a.identificacion),
      tarjetaProfesional: cleanText(a.tarjetaProfesional),
      direccion: cleanText(a.direccion),
      telefono: cleanText(a.telefono),
      correo: cleanText(a.correo),
      existePoderOtorgado: a.existePoderOtorgado ?? false,
      tenantId,
    })),
  };
}

/**
 * Espejo del apoderado principal en las 8 columnas escalares de Case.
 *
 * Solo se espeja si el bloque legado viene COMPLETAMENTE vacío. Es todo o nada
 * a propósito: rellenar campo por campo fabricaría un registro híbrido (el
 * nombre de un apoderado con la tarjeta profesional de otro). Si el payload ya
 * trae datos en las columnas escalares (flujo legado), se respetan tal cual.
 */
export function mirrorPrincipalApoderado(
  apoderados: ApoderadoFormData[] | undefined,
  legacy: Partial<Record<LegacyTextField, string | null>> & {
    existePoderOtorgado?: boolean | null;
  },
): LegacyApoderadoScalars {
  const principal = apoderados?.[0];
  if (!principal) return {};

  const legacyIsEmpty =
    LEGACY_TEXT_FIELDS.every((field) => isBlank(legacy[field])) &&
    !legacy.existePoderOtorgado;
  if (!legacyIsEmpty) return {};

  return {
    apoderadoNombreCompleto: principal.nombreCompleto,
    apoderadoTipoIdentificacion: cleanText(principal.tipoIdentificacion),
    apoderadoIdentificacion: cleanText(principal.identificacion),
    apoderadoTarjetaProfesional: cleanText(principal.tarjetaProfesional),
    apoderadoDireccion: cleanText(principal.direccion),
    apoderadoTelefono: cleanText(principal.telefono),
    apoderadoCorreo: cleanText(principal.correo),
    existePoderOtorgado: principal.existePoderOtorgado ?? false,
  };
}
