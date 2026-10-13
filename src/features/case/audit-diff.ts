/**
 * Qué cambió en una edición de expediente, para el `metadata` del audit log.
 *
 * GC-M4 — EL PROBLEMA. El registro de `updateCase` decía, literalmente,
 * "Se ha actualizado el caso INSOL-000042". Nada más. Para un expediente legal
 * eso no es trazabilidad: no permite responder "¿quién le cambió la fecha de
 * audiencia?" ni "¿qué se tocó en esa edición?", que son exactamente las
 * preguntas que una auditoría tiene que poder contestar.
 *
 * POR QUÉ NO ALCANZA CON LISTAR EL PAYLOAD. El formulario de edición reenvía
 * **todos** sus campos, cambiados o no. Una lista de "campos enviados" sería
 * casi la lista completa de columnas en cada edición: ruido con forma de dato.
 * Así que hay que comparar contra lo que había, y para eso se leen de la base
 * únicamente las columnas que el payload trae (`selectDeCamposEnviados`), no
 * las 265 del modelo.
 *
 * LA COMPARACIÓN, Y HACIA DÓNDE SE EQUIVOCA A PROPÓSITO. Los valores llegan
 * en formas distintas a las que tiene la base: el formulario manda
 * `"2026-03-15"` donde hay un `DateTime`, y `"1.500.000"` donde hay un
 * `Decimal`. Un `!==` crudo marcaría todo como cambiado. `normalizar` reduce
 * las dos partes a una cadena comparable; cuando no puede decidir, se declara
 * **cambiado**. El sesgo es deliberado: un "cambió" de más es ruido en el
 * registro, un "no cambió" de menos **esconde una edición real**, que es el
 * defecto que esto viene a cerrar.
 *
 * LOS VALORES. Solo se registran los de un allowlist de campos NO PERSONALES
 * (`CAMPOS_CON_VALOR_AUDITABLE`). Del resto se guarda el nombre y nada más.
 * El audit log es una tabla que se conserva y se consulta desde la UI: meterle
 * la cédula, los ingresos o la dirección del deudor sería duplicar datos
 * personales fuera del expediente, justo lo que la Ley 1581 obliga a acotar.
 */

import { caseSchema } from './schemas';

/**
 * Claves de `caseSchema` que son relaciones, no columnas. Se excluyen del
 * `select` del diff: `select: { debtor: true }` es válido en Prisma pero
 * traería la fila entera del deudor para nada.
 */
const RELACIONES_DE_CASE: ReadonlySet<string> = new Set([
  'debtor',
  'operator',
  '_count',
]);

/**
 * Las columnas escalares del modelo `Case`, derivadas de `caseSchema`.
 *
 * Se usa como filtro del `select` del diff. Derivarla del schema y no de una
 * lista a mano es lo que evita que se desactualice: `case-list-query.test.ts`
 * ya verifica que `caseSchema` y el modelo de Prisma coinciden.
 *
 * Importa que sea un filtro y no una aserción: una clave del payload que no
 * esté acá simplemente no entra en el diff. Si fuera un error, un campo nuevo
 * del formulario tumbaría `updateCase` entero en vez de quedar fuera del
 * registro de auditoría.
 */
export const COLUMNAS_CASE: ReadonlySet<string> = new Set(
  Object.keys(caseSchema.shape).filter((k) => !RELACIONES_DE_CASE.has(k)),
);

/**
 * Campos cuyo valor se puede escribir en el audit log.
 *
 * Criterio: describen el trámite, no a la persona. Nada de nombres, cédulas,
 * direcciones, correos, teléfonos, ingresos, gastos ni montos de deuda — de
 * esos se registra que cambiaron, no a qué.
 *
 * Las fechas procesales entran porque son hechos del expediente y son
 * justamente las que se audita quién movió.
 */
export const CAMPOS_CON_VALOR_AUDITABLE: ReadonlySet<string> = new Set([
  'type',
  'tramite',
  'phase',
  'creditors',
  'caseNumber',
  'failureType',
  'resultType',
  'hearingDate',
  'filingDate',
  'designationDate',
  'positionAcceptanceDate',
  'inadmissionDate',
  'admissionDate',
  'firstHearingDate',
  'firstHearingTime',
  'suspensionDate',
  'resultDeliveryDate',
  'resultDate',
  'failureDate',
  'paymentStartDate',
  'agreementValidityDate',
  'hasLegalProcesses',
  'riskCenterCommunication',
]);

/** Lo que se guarda en `metadata`. Valores primitivos: `metadata` es Json. */
export interface ResumenDeCambios {
  /** Nombres de los campos que cambiaron, separados por coma. */
  changedFields: string;
  /** Cuántos cambiaron. Útil para filtrar ediciones masivas. */
  changedFieldCount: number;
  /** Cuántos venían en el payload (cambiados o no). */
  submittedFieldCount: number;
}

/**
 * Reduce un valor a una cadena comparable.
 *
 * Devuelve `null` cuando no sabe qué hacer con el valor; el llamador trata ese
 * caso como "cambiado".
 */
function normalizar(valor: unknown): string | null {
  if (valor === null || valor === undefined) return '';

  if (valor instanceof Date) {
    // Solo la parte de fecha: el formulario manda "YYYY-MM-DD" y la base
    // guarda un DateTime anclado al mediodía UTC (ver `date-colombia.ts`).
    // Comparar el instante completo marcaría cambio en cada edición.
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === 'boolean') return valor ? 'true' : 'false';

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? String(valor) : null;
  }

  if (typeof valor === 'string') {
    const limpio = valor.trim();
    // Una fecha ISO con hora se recorta igual que un Date, para que
    // "2026-03-15" y "2026-03-15T12:00:00.000Z" se comparen iguales.
    if (/^\d{4}-\d{2}-\d{2}T/.test(limpio)) return limpio.slice(0, 10);
    return limpio;
  }

  // `Prisma.Decimal` y cualquier otro objeto con `toString` propio. Se
  // compara numéricamente cuando las dos partes son numéricas, para que
  // "1500000" y "1500000.000000" no cuenten como cambio.
  if (typeof valor === 'object' && 'toString' in valor) {
    const texto = String(valor);
    const n = Number(texto);
    return Number.isFinite(n) ? String(n) : texto;
  }

  return null;
}

/** true si los dos valores representan lo mismo. Ante la duda, false. */
export function mismoValor(antes: unknown, despues: unknown): boolean {
  const a = normalizar(antes);
  const b = normalizar(despues);
  if (a === null || b === null) return false;

  // Los dos numéricos: se comparan como números, no como texto. "1.500.000"
  // no llega acá (el schema ya lo parseó), pero "1500000" vs 1500000 sí.
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) {
    return na === nb;
  }

  return a === b;
}

/**
 * El `select` de Prisma con las columnas que el payload trae.
 *
 * `columnasValidas` es la lista de columnas reales del modelo: una clave del
 * payload que no sea columna (las del deudor, por ejemplo, que `updateCase`
 * escribe en otra tabla) se descarta en vez de romper la consulta.
 */
export function selectDeCamposEnviados(
  payload: Record<string, unknown>,
  columnasValidas: ReadonlySet<string>,
): Record<string, true> {
  const select: Record<string, true> = {};
  for (const clave of Object.keys(payload)) {
    if (columnasValidas.has(clave)) select[clave] = true;
  }
  return select;
}

/**
 * Compara el antes con el después y arma el resumen para el audit log.
 *
 * `antes` es la fila leída de la base con el `select` de arriba; `despues` es
 * el payload. Solo se consideran las claves presentes en los dos.
 */
export function resumirCambios(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): ResumenDeCambios {
  const comparables = Object.keys(despues).filter((k) =>
    Object.prototype.hasOwnProperty.call(antes, k),
  );

  const cambiados = comparables.filter((k) => !mismoValor(antes[k], despues[k]));

  return {
    changedFields: cambiados.sort().join(', '),
    changedFieldCount: cambiados.length,
    submittedFieldCount: comparables.length,
  };
}

/**
 * Los valores de los campos cambiados que SÍ se pueden registrar.
 *
 * Las claves salen como `<campo>_antes` / `<campo>_despues` para que se lean
 * de corrido en la UI de auditoría sin estructura anidada (`metadata` acepta
 * primitivos).
 */
export function valoresAuditables(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  camposCambiados: readonly string[],
): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of camposCambiados) {
    if (!CAMPOS_CON_VALOR_AUDITABLE.has(campo)) continue;
    salida[`${campo}_antes`] = normalizar(antes[campo]) ?? '';
    salida[`${campo}_despues`] = normalizar(despues[campo]) ?? '';
  }
  return salida;
}
