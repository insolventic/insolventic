/**
 * requestId de correlación de logs — módulo puro y edge-safe.
 *
 * Lo importan `middleware.ts` (edge) y `request-context.ts` (Node), por eso no
 * depende de nada de Node ni de `logger.ts`.
 *
 * Regla: el id de un request lo emite SIEMPRE el servidor. Un `x-request-id`
 * que llegue del cliente no es de fiar: quien lo fija puede hacerse pasar por
 * otro request (colisionar con el id de otra operación al buscar en los logs o
 * en Sentry) o inyectar valores arbitrarios (larguísimos, con caracteres de
 * control) en cada línea de log. El middleware lo ignora y `parseRequestId`
 * acota lo que las server actions aceptan del header a un UUID bien formado.
 */

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id nuevo, generado en el servidor. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Devuelve el id si tiene forma de UUID; `undefined` en cualquier otro caso
 * (ausente, demasiado largo, con caracteres fuera del formato, etc.).
 *
 * Solo valida el FORMATO: no distingue un id emitido por el middleware de uno
 * escrito por el cliente. Esa garantía la da el middleware, que sobrescribe el
 * header en toda ruta que intercepta (ver `config.matcher`).
 */
export function parseRequestId(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  return REQUEST_ID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}
