/**
 * Los campos propios de Conciliación y de Acuerdo de Apoyo, para el diálogo de
 * edición.
 *
 * Hallazgo A1 de la auditoría del formulario de conciliación: el diálogo de
 * edición era de insolvencia y nada más. Tenía ocho pestañas, todas de
 * insolvencia, y su `submitData` enumeraba a mano ~69 campos sin un solo
 * `conc*` ni `apoyo*`. Como `updateCase` hace `...rest` sobre un esquema
 * parcial, las columnas ausentes quedaban intactas: los datos no se perdían,
 * pero **no había forma de corregirlos**. Un error de tipeo en el nombre del
 * convocado o en una cláusula del acuerdo era permanente desde la aplicación.
 *
 * Se resuelve recogiendo las claves por prefijo en vez de enumerarlas. Son 93
 * columnas `String?` y 7 `Json?`; listarlas a mano garantizaba que la próxima
 * que se agregue vuelva a quedar afuera sin que nada avise — que es exactamente
 * como se llegó hasta acá.
 */

/** Prefijos de los campos que pertenecen a un tipo de caso y no a todos. */
export const TYPE_SPECIFIC_PREFIXES = ['conc', 'apoyo'] as const;

/**
 * Las 7 columnas `Json?`. Importan por un detalle del formulario: las consume
 * `useFieldArray`, que necesita un arreglo. Un `null` de la base ahí deja el
 * bloque de cláusulas sin renderizar.
 */
export const TYPE_SPECIFIC_JSON_FIELDS = new Set([
  'concMenoresAlimentos',
  'concMenoresUnion',
  'concClausulasAcuerdo',
  'concClausulasAdicionalesAlimentos',
  'concClausulasAdicionalesUnion',
  'concClausulasAdicionalesDisolucion',
  'apoyoClausulas',
]);

export function isTypeSpecificField(key: string): boolean {
  return TYPE_SPECIFIC_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Los campos del caso guardado, listos para `form.reset()`.
 *
 * Normaliza los `null` de la base: a `[]` en las columnas Json —para que
 * `useFieldArray` tenga de dónde agarrarse— y a `''` en el resto, porque un
 * `null` en un `<Input>` lo vuelve no controlado y React avisa por consola.
 */
export function pickTypeSpecificFields(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source) return out;

  for (const [key, value] of Object.entries(source)) {
    if (!isTypeSpecificField(key)) continue;

    if (TYPE_SPECIFIC_JSON_FIELDS.has(key)) {
      out[key] = Array.isArray(value) ? value : [];
    } else {
      out[key] = value ?? '';
    }
  }
  return out;
}

/**
 * Los campos tal como salen del formulario, para el `submitData`.
 *
 * A diferencia de la precarga, acá NO se normaliza: lo que el formulario tenga
 * es lo que se manda. Las claves ausentes simplemente no viajan, y `updateCase`
 * deja esa columna como estaba — que es el comportamiento correcto cuando se
 * edita un caso de un tipo que no usa esos campos.
 */
export function pickTypeSpecificValues(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isTypeSpecificField(key)) out[key] = value;
  }
  return out;
}
