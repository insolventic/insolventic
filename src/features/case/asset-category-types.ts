/**
 * Selector de bienes en dos niveles — Categoría (Inmueble | Mueble) y luego
 * Tipo, filtrado por la categoría elegida. Inventario B (simplificado),
 * aprobado.
 *
 * PROPUESTA pendiente de confirmación de la abogada: las etiquetas y la
 * lista exacta de tipos de bien mueble pueden cambiar. Viven en este único
 * archivo para que ese cambio no obligue a tocar los dos formularios (alta
 * en `create-case-dialog/assets-section.tsx` y edición en
 * `edit-case-dialog/assets-tab.tsx`) ni el selector compartido
 * (`asset-type-selector.tsx`).
 *
 * Sin cambios de schema: `Asset.type` sigue siendo `String` sin enum. Para
 * un INMUEBLE, `Asset.type` se queda en `'INMUEBLE'` y el tipo elegido
 * (Casa, Apartamento, ...) va en `Asset.propertyType` — ese campo y su
 * captura en el formulario YA EXISTÍAN antes de esta rama (ver
 * `assetSchema.propertyType` en `schemas.ts` y el input libre que tenían
 * `assets-section.tsx`/`assets-tab.tsx`, ahora reemplazado por el segundo
 * nivel de este selector). Para un MUEBLE, `Asset.type` guarda directamente
 * el valor del tipo (`ELECTRONICO`, `ENSERES`, ...).
 */

import { PROPERTY_TYPES } from './validation-rules';

export type AssetCategory = 'INMUEBLE' | 'MUEBLE';

export const ASSET_CATEGORIES: ReadonlyArray<{
  value: AssetCategory;
  label: string;
}> = [
  { value: 'INMUEBLE', label: 'Inmueble' },
  { value: 'MUEBLE', label: 'Mueble' },
];

/**
 * Tipos de bien inmueble (segundo nivel cuando la categoría es Inmueble) —
 * reexportado tal cual de `validation-rules.ts`, que ya tenía exactamente
 * esta lista (CASA, APARTAMENTO, LOTE, LOCAL, BODEGA, OFICINA, FINCA, OTRO)
 * sin ningún consumidor real. `validation-rules.ts` es NO TOUCH en esta
 * rama — se reusa de solo lectura, no se modifica.
 */
export { PROPERTY_TYPES as PROPERTY_TYPE_OPTIONS };

/**
 * Tipos de bien mueble (segundo nivel cuando la categoría es Mueble) —
 * `Asset.type` guarda directamente uno de estos `value`.
 *
 * Mismos 7 tipos que `MOVABLE_ASSET_CATEGORIES` de `validation-rules.ts`
 * (que tampoco tenía consumidores) más `OTRO`, con dos etiquetas corregidas
 * por decisión de producto: "Joyas" en plural (no "Joya y piedras
 * preciosas") y "Equipos eléctricos y electrónicos" sin repetir la palabra
 * "electrónico" dos veces.
 */
export const MOVABLE_ASSET_TYPES = [
  { value: 'ELECTRONICO', label: 'Equipos eléctricos y electrónicos' },
  { value: 'ENSERES', label: 'Muebles y enseres' },
  { value: 'VEHICULO', label: 'Vehículo' },
  { value: 'JOYAS', label: 'Joyas' },
  { value: 'EFECTIVO', label: 'Dinero en efectivo' },
  { value: 'ACCIONES', label: 'Acciones y participaciones' },
  { value: 'CUENTAS', label: 'Cuentas por cobrar' },
  { value: 'OTRO', label: 'Otro' },
] as const;

export type MovableAssetType = (typeof MOVABLE_ASSET_TYPES)[number]['value'];

/**
 * Valores viejos de `Asset.type` (antes de este cambio) → el tipo nuevo
 * equivalente. `VEHICULO` y `OTRO` no cambian: ya tenían el mismo valor.
 */
const LEGACY_TYPE_ALIASES: Readonly<Record<string, MovableAssetType>> = {
  EQUIPO: 'ELECTRONICO',
  MUEBLE: 'ENSERES',
  JOYA: 'JOYAS',
  DINERO: 'EFECTIVO',
  ACCION: 'ACCIONES',
  CUENTA_COBRAR: 'CUENTAS',
};

/**
 * Normaliza un `Asset.type` guardado con un valor viejo al equivalente
 * nuevo. SIN migración de datos: esto es solo para que el formulario de
 * edición MUESTRE la categoría/tipo correctos de un bien ya guardado con el
 * valor viejo — no escribe nada en la base hasta que el operador guarde el
 * caso (y en ese momento guarda el valor YA normalizado).
 */
export function normalizeAssetType(type: string | null | undefined): string {
  if (!type) return '';
  return LEGACY_TYPE_ALIASES[type] ?? type;
}

/**
 * La categoría (nivel 1) a la que pertenece un `Asset.type`, aceptando
 * tanto valores ya normalizados como los viejos (los normaliza primero).
 * `undefined` para un tipo vacío o que no pertenece a ninguna categoría
 * conocida — el selector lo deja sin categoría elegida en vez de adivinar.
 */
export function categoryForAssetType(
  type: string | null | undefined,
): AssetCategory | undefined {
  const normalized = normalizeAssetType(type);
  if (!normalized) return undefined;
  if (normalized === 'INMUEBLE') return 'INMUEBLE';
  if (MOVABLE_ASSET_TYPES.some((t) => t.value === normalized)) return 'MUEBLE';
  return undefined;
}
