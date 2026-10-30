/**

 * Clasificación de los errores de la API de Google Drive.

 *

 * Vive **aparte** de `google-drive.ts` a propósito: ese módulo instancia el

 * cliente OAuth2 en el scope del módulo (`export const googleDriveService =

 * new GoogleDriveService()`) y lee sus variables de entorno en el

 * constructor, así que `document/actions.ts` lo importa **dinámicamente** en

 * sus seis call-sites para no construirlo al importar (convención de

 * `CLAUDE.md`: validar env vars en el primer uso, nunca en import). Un

 * predicado puro no tiene por qué arrastrar todo eso.

 */

/**

 * El código HTTP de un error de la API de Drive, si se puede sacar.

 *

 * `googleapis` no expone un tipo útil: según el camino, el status llega en

 * `error.code` (número o string), en `error.status` o en

 * `error.response.status`. Se miran los tres.

 */

export function statusDeDrive(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const e = error as {
    code?: unknown;

    status?: unknown;

    response?: { status?: unknown };
  };

  for (const valor of [e.code, e.status, e.response?.status]) {
    const n = typeof valor === 'string' ? Number(valor) : valor;

    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }

  return undefined;
}

/** Los `reason` de Drive que son límite de cuota y sí ameritan reintento. */

const RAZONES_TRANSITORIAS = new Set([
  'rateLimitExceeded',

  'userRateLimitExceeded',

  'backendError',

  'internalError',
]);

/** Los códigos de red de Node que son transitorios por definición. */

const CODIGOS_DE_RED = new Set([
  'ECONNRESET',

  'ECONNABORTED',

  'ETIMEDOUT',

  'EAI_AGAIN',

  'ENOTFOUND',

  'EPIPE',

  'ERR_SOCKET_CONNECTION_TIMEOUT',
]);

/**

 * ¿Vale la pena reintentar este error de Drive?

 *

 * Para pasarlo como `isRetryable` a `withRetry`. Sin esto, los reintentos que

 * ya existían en la generación de documentos trataban igual un 429 (que un

 * reintento resuelve) que un 404 o un 403 de permisos (que no cambia por

 * reintentar): tres intentos con backoff gastaban ~1,5 s del presupuesto de la

 * función para terminar en el mismo error.

 *

 * Solo funciona porque los `catch` de abajo preservan la causa: un error

 * envuelto en un `Error` genérico no se puede clasificar, y era lo que pasaba

 * hasta ahora.

 */

export function isRetryableDriveError(error: unknown): boolean {
  const causa =
    error instanceof Error && error.cause !== undefined ? error.cause : error;

  const codigoDeRed = (causa as { code?: unknown } | null)?.code;

  if (typeof codigoDeRed === 'string' && CODIGOS_DE_RED.has(codigoDeRed)) {
    return true;
  }

  const razones = (causa as { errors?: { reason?: string }[] } | null)?.errors;

  if (razones?.some((r) => r.reason && RAZONES_TRANSITORIAS.has(r.reason))) {
    return true;
  }

  const status = statusDeDrive(causa);

  if (status === undefined) {
    // Sin status y sin reason no hay con qué decidir: un error de red sin

    // código o un fallo del SDK. Se reintenta, que es el default de

    // `withRetry` y el comportamiento que ya había.

    return true;
  }

  // 408 Request Timeout y 429 Too Many Requests, más todos los 5xx.

  return status === 408 || status === 429 || status >= 500;
}
