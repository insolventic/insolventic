/**
 * Campos del bien que solo aplican a ciertos tipos, y qué hay que limpiar cuando
 * el tipo cambia.
 *
 * El formulario de bienes muestra los campos específicos en bloques
 * condicionados por `type` (`{assetType === 'INMUEBLE' && ...}`). Al cambiar el
 * tipo el bloque se desmonta, pero react-hook-form NO borra el valor de un campo
 * cuyo input se desmontó: `shouldUnregister` es `false` por defecto. Resultado:
 * lo que se cargó para un inmueble seguía en el formulario y se enviaba junto a
 * un vehículo.
 *
 * Los dos grupos son los mismos que agrupa `schema.prisma` en el modelo `Asset`
 * ("Real Estate specific fields" / "Personal Property specific fields"), con una
 * excepción deliberada: `description` está en el segundo grupo del schema pero en
 * el formulario es un campo general ("Descripción Adicional") que se muestra para
 * todos los tipos, así que NO se limpia.
 */

/** Se muestran solo cuando el tipo es INMUEBLE. */
export const REAL_ESTATE_ONLY_FIELDS = [
  'propertyType',
  'address',
  'registrationNumber',
  'encumbrance',
  'affectation',
  'precautionaryMeasure',
  'proofDocument',
  'isFamilyHome',
  'isInalienablePatrimony',
] as const;

/** Se muestran solo cuando el tipo es VEHICULO (el único tipo de bien mueble con bloque propio). */
export const PERSONAL_PROPERTY_ONLY_FIELDS = [
  'brand',
  'model',
  'condition',
  'licensePlate',
  'transitAuthority',
  'guaranteeInFavorOf',
  'guaranteeAmount',
  'material',
] as const;

export type AssetTypeField =
  | (typeof REAL_ESTATE_ONLY_FIELDS)[number]
  | (typeof PERSONAL_PROPERTY_ONLY_FIELDS)[number];

/** Valor en blanco de cada campo: las casillas a `false`, el resto a `''`. */
const BOOLEAN_FIELDS = new Set<string>([
  'isFamilyHome',
  'isInalienablePatrimony',
]);

export function blankValueFor(field: AssetTypeField): boolean | string {
  return BOOLEAN_FIELDS.has(field) ? false : '';
}

/**
 * Campos que hay que limpiar para el tipo elegido: los que el formulario NO
 * muestra con ese tipo.
 *
 *  - `INMUEBLE` → se limpian los de bien mueble.
 *  - `VEHICULO` → se limpian los de inmueble.
 *  - cualquier otro tipo (MUEBLE, JOYA, DINERO…) no tiene bloque propio, así que
 *    no muestra ninguno de los dos grupos y se limpian los dos. Es el caso que
 *    de otro modo pasa desapercibido: al ir de INMUEBLE a JOYA no desaparece
 *    ningún campo de la pantalla, pero los del inmueble siguen en el formulario.
 *  - sin tipo elegido no se limpia nada: el formulario recién arranca y no hay
 *    nada que arrastrar.
 */
export function assetFieldsToClear(
  assetType: string | null | undefined,
): AssetTypeField[] {
  if (!assetType) return [];

  if (assetType === 'INMUEBLE') return [...PERSONAL_PROPERTY_ONLY_FIELDS];
  if (assetType === 'VEHICULO') return [...REAL_ESTATE_ONLY_FIELDS];

  return [...REAL_ESTATE_ONLY_FIELDS, ...PERSONAL_PROPERTY_ONLY_FIELDS];
}
