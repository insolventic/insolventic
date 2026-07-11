/**
 * Redacción compartida para los `beforeSend` de Sentry (client/server/edge).
 * Pura y sin dependencias: segura para el runtime edge.
 *
 * Genérica sobre el tipo de evento (client y server usan tipos distintos de
 * `ErrorEvent`), con guards en runtime en lugar de asumir la forma exacta.
 */

const SENSITIVE_QUERY_PARAMS =
  /(token|secret|password|apikey|api_key|code)=([^&#]+)/gi;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];

/**
 * Elimina cookies, headers de auth y parámetros sensibles de la URL antes
 * de que el evento salga hacia Sentry. Devuelve el mismo evento (mutado).
 */
export function scrubSentryEvent<T>(event: T): T {
  const req = (
    event as {
      request?: {
        url?: unknown;
        query_string?: unknown;
        cookies?: unknown;
        headers?: unknown;
      };
    }
  ).request;
  if (!req) return event;

  if (typeof req.url === 'string') {
    req.url = req.url.replace(SENSITIVE_QUERY_PARAMS, '$1=[REDACTED]');
  }
  if (typeof req.query_string === 'string') {
    req.query_string = req.query_string.replace(
      SENSITIVE_QUERY_PARAMS,
      '$1=[REDACTED]',
    );
  }
  if (req.cookies && typeof req.cookies === 'object') {
    req.cookies = {};
  }
  if (req.headers && typeof req.headers === 'object') {
    const headers = req.headers as Record<string, unknown>;
    for (const header of SENSITIVE_HEADERS) {
      if (headers[header] !== undefined) headers[header] = '[REDACTED]';
    }
  }
  return event;
}
