/**
 * Sentry — Client-side initialisation.
 * Loaded automatically by `@sentry/nextjs`. If NEXT_PUBLIC_SENTRY_DSN is
 * unset, Sentry is a no-op (no network traffic, no user data leaves the
 * browser). Set the DSN in Vercel env for each environment.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    // 10% sample rate for performance traces — tune per environment.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Privacy: no PII in breadcrumbs by default.
    sendDefaultPii: false,
    // Scrub likely-sensitive inputs automatically.
    beforeSend(event) {
      if (event.request?.cookies) {
        event.request.cookies = {};
      }
      return event;
    },
  });
}
