/**
 * Logger estructurado — niveles + Sentry, sin dependencias nuevas.
 *
 * Decisión (Fase 2.1): no se agrega Pino/Winston. En Vercel serverless los
 * transports de esas librerías no aportan (stdout es el transport), y el
 * volumen del proyecto no justifica la dependencia. El interface es el
 * mismo, así que introducir una librería después es un cambio local.
 *
 * Niveles y salida:
 *   ERROR → console.error (JSON) + Sentry.captureException
 *   WARN  → console.warn  (JSON) + Sentry.captureMessage('warning')
 *   INFO  → console.info  (JSON) — solo si el nivel lo permite
 *   DEBUG → console.log   (JSON) — solo en desarrollo
 *
 * Nivel mínimo: LOG_LEVEL (error|warn|info|debug) o, por defecto,
 * 'warn' en producción y 'debug' en desarrollo. Así los eventos de ciclo
 * de vida (info) pueden activarse en prod vía env sin redeploy de código.
 *
 * Seguridad: el contexto pasa por redacción automática de claves sensibles
 * (password, token, secret, email, phone…) antes de tocar consola o Sentry.
 * Aun así: nunca pasar payloads completos ni PII innecesaria en `context`.
 *
 * Isomórfico: funciona en server actions, edge y componentes cliente
 * (Sentry se resuelve perezosamente y degrada a no-op sin DSN).
 */

export interface LogContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

type Level = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_WEIGHT: Record<Level, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function minLevel(): Level {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env === 'error' || env === 'warn' || env === 'info' || env === 'debug') {
    return env;
  }
  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
}

function enabled(level: Level): boolean {
  return LEVEL_WEIGHT[level] <= LEVEL_WEIGHT[minLevel()];
}

// ---------------------------------------------------------------------------
// Redacción de campos sensibles (claves case-insensitive, match por substring)
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'email',
  'phone',
  'telefono',
  'correo',
  'cedula',
  'idnumber',
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => k.includes(frag));
}

/** Redacta valores de claves sensibles (1 nivel de profundidad extra). */
export function redactContext(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (isSensitiveKey(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested: Record<string, unknown> = {};
      for (const [k2, v2] of Object.entries(value as Record<string, unknown>)) {
        nested[k2] = isSensitiveKey(k2) ? '[REDACTED]' : v2;
      }
      out[key] = nested;
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sentry perezoso (mismo patrón que observability.ts — no-op sin DSN)
// ---------------------------------------------------------------------------

type SentryLike = {
  captureException: (err: unknown, context?: unknown) => void;
  captureMessage: (msg: string, level?: string) => void;
};

let cachedSentry: SentryLike | null | undefined;

async function getSentry(): Promise<SentryLike | null> {
  if (cachedSentry !== undefined) return cachedSentry;
  const dsn =
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn) {
    cachedSentry = null;
    return null;
  }
  try {
    cachedSentry = (await import('@sentry/nextjs')) as unknown as SentryLike;
  } catch {
    cachedSentry = null;
  }
  return cachedSentry;
}

// ---------------------------------------------------------------------------
// Emisión
// ---------------------------------------------------------------------------

function emit(
  level: Level,
  message: string,
  ctx?: LogContext,
  err?: unknown,
): void {
  if (!enabled(level)) return;

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...(ctx ? redactContext(ctx) : {}),
  };
  if (err instanceof Error) {
    entry.error = err.message;
  } else if (err !== undefined) {
    entry.error = String(err);
  }

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'info') console.info(line);
  else console.log(line);
}

export const logger = {
  /** ERROR: consola + Sentry.captureException. `err` opcional pero recomendado. */
  error(message: string, err?: unknown, ctx?: LogContext): void {
    emit('error', message, ctx, err);
    void getSentry().then((sentry) => {
      if (!sentry) return;
      const extra = ctx ? redactContext(ctx) : undefined;
      if (err instanceof Error) {
        sentry.captureException(err, { extra: { message, ...extra } });
      } else {
        sentry.captureMessage(message, 'error');
      }
    });
  },

  /** WARN: consola + Sentry.captureMessage(warning). */
  warn(message: string, ctx?: LogContext): void {
    emit('warn', message, ctx);
    void getSentry().then((sentry) => {
      sentry?.captureMessage(message, 'warning');
    });
  },

  /** INFO: consola estructurada (dev por defecto; en prod con LOG_LEVEL=info). */
  info(message: string, ctx?: LogContext): void {
    emit('info', message, ctx);
  },

  /** DEBUG: consola estructurada, solo desarrollo. */
  debug(message: string, ctx?: LogContext): void {
    emit('debug', message, ctx);
  },
};
