/**
 * Prefill del pagador de libranza a partir del empleador de la Sección III.
 *
 * El nombre del empleador se pedía dos veces: en la Sección III
 * (`deudorNombreEmpleador`) y otra vez como "Nombre del Pagador" de cada
 * libranza (`libranzas[].payerName`).
 *
 * No se deduplica a un solo campo, se ofrece escrito: el pagador de una
 * libranza NO siempre es el empleador —puede ser una pagaduría o un fondo—, así
 * que el dato tiene que seguir siendo editable por libranza. El valor se escribe
 * con `shouldDirty: false` y solo sobre campos vacíos, así que el usuario lo
 * sobrescribe y nada se lo vuelve a pisar.
 *
 * La decisión vive acá, fuera del componente, porque es la parte con reglas
 * (cuándo actuar y sobre qué filas) y el componente solo aplica el resultado.
 */

/** Campo de la Sección III que dispara el prefill. */
export const EMPLOYER_FIELD = 'deudorNombreEmpleador';

/** Prefijo de los campos del arreglo de libranzas. */
export const LIBRANZAS_FIELD = 'libranzas';

export interface PayerPrefillInput {
  /** Campo que react-hook-form reporta como cambiado. */
  changedField?: string;
  /** Valor actual de `deudorNombreEmpleador`. */
  employerName: unknown;
  libranzas: ReadonlyArray<{ payerName?: unknown } | null | undefined>;
  /** Cantidad de libranzas en la pasada anterior. */
  previousCount: number;
}

export interface PayerPrefillResult {
  /** Índices de libranza a los que hay que escribirles el pagador. */
  indices: number[];
  /** Valor a escribir (el empleador, ya recortado). */
  value: string;
  /** Cantidad de libranzas a recordar para la próxima pasada. */
  nextCount: number;
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Decide qué libranzas reciben el nombre del empleador.
 *
 * Dos disparadores, porque el orden en que se llena el formulario varía:
 *
 *  - **cambió el empleador** → completa las libranzas que estén vacías. Cubre
 *    "agregué la libranza y después declaré el empleador".
 *  - **se agregó una libranza** → la nueva arranca con el empleador. Cubre el
 *    caso habitual: el empleador ya estaba declarado en la Sección III.
 *
 * El segundo disparador mira que el arreglo haya **crecido**, no que haya
 * cambiado. Si reaccionara a cualquier cambio de `libranzas`, borrar el pagador
 * a mano lo volvería a rellenar en el acto y el campo sería imposible de dejar
 * vacío.
 */
export function resolvePayerPrefill(
  input: PayerPrefillInput,
): PayerPrefillResult {
  const { changedField, employerName, libranzas, previousCount } = input;

  const value = text(employerName);
  const nextCount = libranzas.length;

  const touchedEmployer = changedField === EMPLOYER_FIELD;
  const touchedLibranzas = changedField?.startsWith(LIBRANZAS_FIELD) ?? false;
  const grew = nextCount > previousCount;

  const shouldPrefill =
    value !== '' && (touchedEmployer || (touchedLibranzas && grew));

  if (!shouldPrefill) return { indices: [], value, nextCount };

  const indices = libranzas.flatMap((libranza, index) =>
    text(libranza?.payerName) === '' ? [index] : [],
  );

  return { indices, value, nextCount };
}
