/**
 * Observability helpers — thin layer over Sentry so features don't import
 * `@sentry/nextjs` directly. Keeps vendor lock-in minimal and makes it
 * trivial to swap or stub in tests.
 *
 * All functions are safe to call when Sentry is not configured (DSN unset):
 * they degrade to `console.error` / no-op.
 */

type SentryLike = {
  captureException: (err: unknown, context?: unknown) => void;
  captureMessage: (msg: string, level?: string) => void;
  setUser: (user: { id?: string; email?: string } | null) => void;
};

let cachedSentry: SentryLike | null | undefined;

/**
 * Lazy-load Sentry only on server; browsers get the client config via
 * `sentry.client.config.ts`. Silently returns null if the package or DSN
 * is missing.
 */
async function getSentry(): Promise<SentryLike | null> {
  if (cachedSentry !== undefined) return cachedSentry;

  const dsn =
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn) {
    cachedSentry = null;
    return null;
  }

  try {
    const mod = await import('@sentry/nextjs');
    cachedSentry = mod as unknown as SentryLike;
    return cachedSentry;
  } catch {
    cachedSentry = null;
    return null;
  }
}

/**
 * Report an error with optional tags/extra context.
 * Always logs to console; forwards to Sentry when configured.
 */
export async function reportError(
  err: unknown,
  context?: {
    action?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  if (context?.action) {
    console.error(`[${context.action}]`, err);
  } else {
    console.error(err);
  }
  const sentry = await getSentry();
  sentry?.captureException(err, {
    tags: { action: context?.action },
    extra: context?.extra,
  });
}

/**
 * Report an informational message (e.g. unusual-but-not-fatal state).
 */
export async function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  if (level === 'error') console.error(message);
  else if (level === 'warning') console.warn(message);
  else console.info(message);
  const sentry = await getSentry();
  sentry?.captureMessage(message, level);
}
