/**
 * Instrumentation hook de Next.js — punto de entrada real de Sentry en el
 * servidor (hallazgo N-1 del checkpoint 2026-09-01; reabre A-7).
 *
 * Hasta este archivo, `sentry.server.config.ts` y `sentry.edge.config.ts`
 * existían pero nadie los importaba: Next solo carga automáticamente
 * `instrumentation.ts` (este) e `instrumentation-client.ts`, y los archivos
 * `sentry.*.config.ts` solo se cargan vía `withSentryConfig()`, que este
 * proyecto no usa a propósito (reabre el problema de tracing de
 * `@opentelemetry/api` que rompió los deploys en agosto — ver
 * `next.config.ts`). Resultado: `Sentry.init()` nunca corría y ningún
 * error de servidor llegaba al dashboard, con o sin DSN.
 *
 * `register()` corre una vez por instancia al arrancar el runtime. Se
 * importa el config que corresponde al runtime activo: el bundle edge
 * (middleware) no puede cargar el config de Node y viceversa.
 */

import * as Sentry from '@sentry/nextjs';

/** Tiempo máximo de espera para vaciar la cola de envío (mismo valor que usa el SDK). */
const FLUSH_TIMEOUT_MS = 2_000;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Errores de Server Components, Route Handlers y Server Actions que Next
 * captura antes de renderizar el error boundary. Sin este export, esos
 * errores no llegan a Sentry aunque `init()` haya corrido.
 *
 * Por qué no se exporta `Sentry.captureRequestError` directo: ese helper
 * programa el flush con `vercelWaitUntil`, que en el SDK es un no-op fuera
 * del runtime edge. En el runtime Node de Vercel el evento queda encolado,
 * la función responde el 500 y se congela antes de que salga el envío: el
 * servidor "responde bien" y Sentry no recibe nada (verificado 2026-09-01
 * en el preview de `fix/sentry-init`). Next espera (`await`) esta función,
 * así que el flush explícito garantiza la entrega antes de responder.
 */
export async function onRequestError(
  ...args: Parameters<typeof Sentry.captureRequestError>
): Promise<void> {
  Sentry.captureRequestError(...args);
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}
