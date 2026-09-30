/**
 * Tipos de proceso judicial — lista única del sistema.
 *
 * Antes había dos listas distintas y hardcodeadas, cada una en su componente:
 * una con `EJECUTIVO / ORDINARIO / ABREVIADO / MONITORIO / VERBAL / OTRO` y otra
 * con `Ejecutivo singular / Ejecutivo mixto / Ordinario / Laboral / Otro`. Ni los
 * valores ni las etiquetas coincidían, así que qué se guardaba dependía de por
 * dónde se hubiera entrado.
 *
 * Esta es la lista definitiva que dictó la abogada. No se deriva del Código
 * General del Proceso ni de ninguna otra nomenclatura general: es la
 * clasificación con la que trabaja el centro de conciliación.
 *
 * Los dos modelos que guardan procesos la comparten (`LegalProcess` y el
 * snapshot por caso `ProcesoJudicial`), así que el valor almacenado significa lo
 * mismo en los dos.
 *
 * Sigue siendo `String` en Prisma, no un enum de la base: el schema no usa
 * enums en ninguna parte, y un enum obligaría a migrar los valores que ya
 * existen en producción. El contrato se sostiene desde acá.
 */

export const TIPO_PROCESO_OTROS = 'OTROS';

export interface TipoProcesoOption {
  /** Valor que se persiste. */
  readonly value: string;
  /** Texto que ve el usuario. */
  readonly label: string;
}

export const TIPOS_PROCESO_JUDICIAL: readonly TipoProcesoOption[] = [
  { value: 'EJECUTIVO', label: 'Ejecutivo' },
  { value: 'COACTIVO', label: 'Coactivo' },
  { value: 'RESTITUCION_INMUEBLE', label: 'Restitución de inmueble' },
  { value: 'PAGO_DIRECTO', label: 'Pago directo' },
  { value: 'CIVIL_ALIMENTOS', label: 'Civil/Alimentos' },
  { value: 'LABORAL', label: 'Laboral' },
  { value: TIPO_PROCESO_OTROS, label: 'Otros' },
] as const;

/** Valores válidos, para validar y para los tests. */
export const TIPOS_PROCESO_VALUES: readonly string[] =
  TIPOS_PROCESO_JUDICIAL.map((t) => t.value);

/**
 * ¿Este tipo exige el texto libre?
 *
 * Solo "Otros". Se pregunta acá en vez de comparar contra el literal en cada
 * call-site para que la UI, la validación y la persistencia usen el mismo
 * criterio.
 */
export function requiresOtherDetail(
  processType: string | null | undefined,
): boolean {
  return processType === TIPO_PROCESO_OTROS;
}

/**
 * Etiqueta a mostrar para un proceso.
 *
 * En "Otros" devuelve el texto que escribió el usuario, porque "Otros" por sí
 * solo no dice nada; si ese texto viene vacío, cae a la etiqueta genérica. Los
 * valores que no están en la lista (filas viejas, guardadas con alguna de las
 * dos nomenclaturas anteriores) se devuelven tal cual en lugar de mostrarse
 * vacíos.
 */
export function tipoProcesoLabel(
  processType: string | null | undefined,
  otherDetail?: string | null,
): string {
  if (!processType) return '';

  if (requiresOtherDetail(processType)) {
    const detail = (otherDetail ?? '').trim();
    if (detail) return detail;
  }

  const known = TIPOS_PROCESO_JUDICIAL.find((t) => t.value === processType);
  return known?.label ?? processType;
}
