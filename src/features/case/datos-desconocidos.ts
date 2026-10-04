/**
 * Las casillas "Desconozco" del formulario de acreedores.
 *
 * El wizard (`create-case-dialog/creditors-detailed-section.tsx`) ofrece tres
 * casillas —tasa de interés, fecha de otorgamiento y fecha de vencimiento— que
 * escriben el literal `'DESCONOZCO'` en el campo. Es una opción legítima y
 * prevista: el art. 539 del CGP permite al deudor manifestar bajo juramento que
 * no conoce un dato con exactitud, y la Solicitud tiene el texto para decirlo.
 *
 * El mapper estaba preparado (`placeholder-mapper.ts` imprimía "Desconoce"), la
 * persistencia no:
 *
 *   interestRate: parseFloat('DESCONOZCO')   → NaN      → Prisma rechaza
 *   grantDate:    new Date('DESCONOZCO')     → Invalid  → Prisma rechaza
 *
 * Marcar cualquiera de las tres casillas reventaba la creación del caso
 * (hallazgo T4 de `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`). Como las
 * deudas se creaban DESPUÉS del caso y fuera de transacción, el operador veía un
 * error y en la base quedaba un expediente con el número de radicado consumido y
 * cero acreedores.
 *
 * Por qué una bandera y no `null`: en un documento legal no es lo mismo "no
 * aplica" que "no se informó" —el mismo criterio que ya seguía `noCoDebtor`—.
 * Las dos fechas son opcionales en el formulario, así que `null` solo significa
 * "no lo llenó"; sin la bandera no habría forma de distinguir eso de "declaró
 * que no lo conoce", que es lo que el documento tiene que decir.
 */

/** Lo que escriben las casillas del formulario. */
export const VALOR_DESCONOCIDO = 'DESCONOZCO';

/** Texto con el que el documento declara un dato no conocido. */
export const ETIQUETA_DESCONOCIDO = 'Desconoce';

export function esDesconocido(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === VALOR_DESCONOCIDO;
}

/**
 * Tasa de interés tal como hay que guardarla.
 *
 * Con la casilla marcada se guarda `0` y la bandera en `true`: el `0` nunca se
 * imprime —el mapper usa la bandera— y así la columna sigue siendo `Float` no
 * nulo, que es una migración puramente aditiva sobre una tabla con datos reales.
 */
export function parseTasaInteres(raw: string | null | undefined): {
  interestRate: number;
  interestRateUnknown: boolean;
} {
  if (esDesconocido(raw)) return { interestRate: 0, interestRateUnknown: true };
  const parsed = parseFloat(raw ?? '0');
  return {
    interestRate: Number.isFinite(parsed) ? parsed : 0,
    interestRateUnknown: false,
  };
}

/**
 * Fecha de un crédito tal como hay que guardarla.
 *
 * `parse` es la conversión de fecha-sin-hora de quien llama (`parseDateOnly`):
 * se inyecta para que este módulo no dependa de la capa de fechas y para que el
 * anclaje al mediodía UTC siga siendo una sola decisión, tomada en un solo sitio.
 */
export function parseFechaCredito(
  raw: string | null | undefined,
  parse: (value: string | null | undefined) => Date | null,
): { value: Date | null; unknown: boolean } {
  if (esDesconocido(raw)) return { value: null, unknown: true };
  return { value: parse(raw), unknown: false };
}
