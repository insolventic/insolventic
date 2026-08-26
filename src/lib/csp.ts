/**
 * Content-Security-Policy — construida en un módulo aparte para poder
 * testearla (next.config.ts no es testeable de forma directa).
 *
 * A-7 (auditoría 2026-08-25): `connect-src` solo permitía 'self' + Google,
 * así que el navegador bloqueaba los envíos del SDK de Sentry y NINGÚN
 * error de frontend llegaba al dashboard. El origen de ingest se deriva
 * del propio DSN (evita hardcodear la región/org del proyecto).
 *
 * No se usa `tunnelRoute` de @sentry/nextjs porque next.config no está
 * envuelto con withSentryConfig() — envolverlo reabre el problema de
 * tracing de @opentelemetry/api que rompió los deploys en agosto.
 */

/**
 * Deriva el origen de ingest a partir del DSN de Sentry.
 * DSN: https://<publicKey>@o<org>.ingest.<region>.sentry.io/<projectId>
 * → origen: https://o<org>.ingest.<region>.sentry.io
 *
 * Devuelve null si el DSN está vacío o malformado (Sentry queda no-op y la
 * CSP no se ensancha sin necesidad).
 */
export function getSentryIngestOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(
  sentryDsn: string | undefined = process.env.NEXT_PUBLIC_SENTRY_DSN,
): string {
  const connectSrc = [
    "'self'",
    'https://drive.google.com',
    'https://www.googleapis.com',
  ];

  const sentryOrigin = getSentryIngestOrigin(sentryDsn);
  if (sentryOrigin) {
    connectSrc.push(sentryOrigin);
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://drive.google.com",
    "font-src 'self'",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
