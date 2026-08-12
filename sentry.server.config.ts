/**
 * Sentry — Server-side (Node runtime) initialisation.
 * Captures errors thrown inside Server Components, Route Handlers, and
 * Server Actions. No-op when SENTRY_DSN is unset.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry-scrub';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    // Redacta cookies, headers de auth y query params sensibles.
    beforeSend: (event) => scrubSentryEvent(event),
  });
}
