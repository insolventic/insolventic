/**
 * Sentry — Edge runtime initialisation (middleware, edge routes).
 * No-op when SENTRY_DSN is unset.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry-scrub';
import { serverSentryRelease } from '@/lib/sentry-release';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sin `release` no hay forma de casar un stack trace minificado con el
    // codigo: es la clave con la que se suben los source maps (O-1).
    release: serverSentryRelease(),
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    // Redacta cookies, headers de auth y query params sensibles.
    beforeSend: (event) => scrubSentryEvent(event),
  });
}
