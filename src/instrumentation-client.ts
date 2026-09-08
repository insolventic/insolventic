/**
 * Sentry — inicialización en el navegador (hallazgo N-1, checkpoint
 * 2026-09-01; reabre A-7).
 *
 * Reemplaza a `sentry.client.config.ts`, que Next nunca cargaba: ese archivo
 * solo lo inyecta el loader de `withSentryConfig()`, que este proyecto no
 * usa. `instrumentation-client.ts` es la convención nativa de Next ≥ 15.3
 * (también funciona con Turbopack) y se ejecuta antes de hidratar la app.
 *
 * Si NEXT_PUBLIC_SENTRY_DSN está vacío, Sentry queda como no-op: sin tráfico
 * de red y sin datos del usuario saliendo del navegador. El origen de ingest
 * derivado de ese mismo DSN ya está permitido en `connect-src` (A-7,
 * `src/lib/csp.ts`).
 */

import * as Sentry from '@sentry/nextjs';

import { scrubSentryEvent } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    // 10% de muestreo de performance en producción; 0 en el resto.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Privacidad: sin PII en breadcrumbs por defecto.
    sendDefaultPii: false,
    // Redacta cookies, headers de auth y query params sensibles.
    beforeSend: (event) => scrubSentryEvent(event),
  });
}

/** Spans de navegación del App Router (lo exige el SDK ≥ 9). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
