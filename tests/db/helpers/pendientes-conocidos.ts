/**
 * Los hallazgos de la verificación del 2026-10-03 que todavía NO están
 * arreglados, escritos de forma que la suite los compruebe.
 *
 * No es una lista de excepciones para que los tests pasen: es el inventario del
 * backlog, y la suite exige que coincida EXACTAMENTE. Si alguien arregla uno y
 * no lo borra de acá, el test falla por "ya no está roto". Si aparece uno nuevo
 * que no está en la lista, también falla. Las dos direcciones importan.
 *
 * Referencia completa de cada hallazgo:
 * `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`.
 */

/**
 * Plantillas que referencian un placeholder que el mapper no produce.
 *
 * Esto NO es cosmético: las dos rutas de generación cortan cuando queda un
 * placeholder sin resolver, así que la plantilla no produce documento para
 * ningún expediente.
 */
export const PLANTILLAS_CON_PLACEHOLDER_FALTANTE: Readonly<
  Record<string, string>
> = {
  // §4.1 — `Check List.html` usa SI_PARAGRAFO_1..3 / NO_PARAGRAFO_1..3 y
  // `mapCheckList` no produce ninguno (produce SI_PC / NO_PC, que no usa nadie).
  // Tiene generateOnCreate: true, así que falta en el Paquete 1 de TODOS los
  // expedientes.
  'check-list': 'Severidad alta — hallazgo §4.1',
};

/**
 * Valores que el formulario captura y que hoy no llegan a ningún documento.
 *
 * La clave es la etiqueta de la expectativa en `casos-sinteticos.ts`; el valor,
 * el hallazgo que lo explica. Se puede acotar a un expediente concreto con
 * `clave-del-caso:campo`, para los campos cuyo valor coincide, en otro
 * expediente, con uno que sí se imprime.
 */
export const VALORES_QUE_NO_LLEGAN: Readonly<Record<string, string>> = {
  // --- T7: listas que se guardan completas y llegan truncadas ---------------
  'apoderado2.nombre': 'T7 — solo el apoderado principal llega al documento',
  'apoderado3.nombre': 'T7 — solo el apoderado principal llega al documento',
  'libranza2.pagador': 'T7 — el mapper solo lee libranzas[0]',
  'servicio2.acreedor': 'T7 — el mapper solo lee suspendedServices[0]',
  'dependiente3.nombre': 'T7 — la plantilla solo tiene dos renglones',
  'proceso3.tipoOtro': 'T7 — la plantilla solo tiene dos procesos',

  // --- T8: capturado, guardado, y ninguna plantilla lo usa ------------------
  attorney: 'T8 — el apoderado se imprime desde la tabla, no de este campo',
  owedCapital: 'T8',
  requestedFee: 'T8 — la Sección 14 (tarifa) es texto fijo',
  legalFoundations: 'T8 — la Sección 15 (fundamentos) es texto fijo',
  siccacNumber: 'T8',
  insuranceOffering: 'T8 — la plantilla solo marca la casilla, no el texto',
  propuestaObservaciones: 'T8',
  expedienteNumero: 'T8',
  conciliadorAsignado: 'T8',
  designatedOperator: 'T8',
  deudorProfesion: 'T8',
  deudorActividadEconomica: 'T8',
  deudorNitEmpleador: 'T8',

  // --- §4.3: las cláusulas del Acuerdo de Apoyo se pierden -------------------
  // 🟢 RESUELTO 2026-10-08 (clausula1/clausula3): CLAUSULAS_APOYO pasó a viajar
  // por `extraContext` (buildApoyoContext), igual que las cláusulas de
  // conciliación — ya no pasa por `escapeAllUnlessHtml`, que era lo que las
  // convertía en '[object Object],…'. Solo queda sin resolver la plantilla
  // misma, que no imprime la dirección del prestador en ningún renglón —
  // eso no es un bug del mapper, es contenido que la plantilla nunca tuvo.
  //
  // Acotado a A1: en A2 el prestador vive en la misma dirección que la
  // beneficiaria, que sí se imprime, así que el texto aparece por otra vía.
  'A1-apoyo-completo:apoyoPrestadorDireccion':
    'La plantilla del acuerdo no imprime la dirección del prestador',
};
