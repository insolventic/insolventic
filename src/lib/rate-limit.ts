/**
 * Rate limiting distribuido (A-2, auditoría 2026-08-25).
 *
 * El store in-memory anterior no protegía nada en Vercel: cada instancia
 * serverless tiene su propio Map y las instancias se reciclan, así que un
 * atacante obtenía N×maxAttempts intentos de login. Ahora, cuando Upstash
 * está configurado, la ventana deslizante vive en Redis y es compartida por
 * todas las instancias.
 *
 * Degradación (decisión explícita): si Upstash no está configurado, o si
 * Redis falla en runtime, se cae al limitador in-memory en vez de bloquear
 * el login. Para un sistema con casos legales reales, dejar a los dos
 * centros sin poder entrar por un hipo de Redis es peor que degradar la
 * protección: el fallback sigue frenando el abuso dentro de cada instancia.
 * La degradación se loguea (warn) para que sea visible en Sentry.
 */

import type { Ratelimit as RatelimitType } from '@upstash/ratelimit';

import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetInMs: number;
  /** true cuando la decisión vino del fallback in-memory, no de Redis. */
  degraded: boolean;
}

export const RATE_LIMIT_CONFIGS = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  register: { windowMs: 60 * 60 * 1000, maxAttempts: 3 },
  forgotPassword: { windowMs: 15 * 60 * 1000, maxAttempts: 3 },
  changePassword: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  resetPassword: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  // Resource-intensive operations
  documentGeneration: { windowMs: 5 * 60 * 1000, maxAttempts: 10 },
  batchDocumentGeneration: { windowMs: 10 * 60 * 1000, maxAttempts: 5 },
  reportExport: { windowMs: 5 * 60 * 1000, maxAttempts: 8 },
} as const;

// ---------------------------------------------------------------------------
// Fallback in-memory (por instancia)
// ---------------------------------------------------------------------------

export function checkRateLimitInMemory(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Periodic cleanup of expired entries (1% chance per call)
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore) {
      if (now > v.resetTime) rateLimitStore.delete(k);
    }
  }

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - 1,
      resetInMs: config.windowMs,
      degraded: true,
    };
  }

  if (entry.count >= config.maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetInMs: entry.resetTime - now,
      degraded: true,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.count,
    resetInMs: entry.resetTime - now,
    degraded: true,
  };
}

// ---------------------------------------------------------------------------
// Backend distribuido (Upstash Redis)
// ---------------------------------------------------------------------------

/**
 * Env vars validadas en el primer uso, nunca en import — convención del
 * proyecto (`email.ts`, `auth.ts`): `next build` recolecta page data sin
 * secrets disponibles.
 */
function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

// Un limiter por config (la ventana es parte del limiter en @upstash/ratelimit).
const limiterCache = new Map<string, RatelimitType>();
let warnedMissingUpstash = false;

async function getLimiter(
  config: RateLimitConfig,
): Promise<RatelimitType | null> {
  if (!isUpstashConfigured()) {
    // Un solo warn por instancia: en producción significa que el rate
    // limiting está degradado a per-instance y hay que configurar Upstash.
    if (!warnedMissingUpstash && process.env.NODE_ENV === 'production') {
      warnedMissingUpstash = true;
      logger.warn('Upstash no configurado — rate limiting degradado', {
        action: 'rate-limit',
        reason: 'missing-env',
      });
    }
    return null;
  }

  const cacheKey = `${config.windowMs}:${config.maxAttempts}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);

    const limiter = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(config.maxAttempts, `${config.windowMs} ms`),
      prefix: 'insolventic:rl',
      analytics: false,
    });

    limiterCache.set(cacheKey, limiter);
    return limiter;
  } catch (error) {
    logger.error('No se pudo inicializar el rate limiter distribuido', error, {
      action: 'rate-limit',
    });
    return null;
  }
}

/**
 * Consume un intento contra la ventana de `key`.
 *
 * Async porque el backend distribuido es una llamada de red. Ante cualquier
 * fallo de Redis cae al limitador in-memory (ver nota de degradación arriba).
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const limiter = await getLimiter(config);
  if (!limiter) return checkRateLimitInMemory(key, config);

  try {
    const { success, remaining, reset } = await limiter.limit(key);
    return {
      allowed: success,
      remainingAttempts: remaining,
      // `reset` es un epoch en ms; lo normalizamos a "faltan X ms".
      resetInMs: Math.max(0, reset - Date.now()),
      degraded: false,
    };
  } catch (error) {
    logger.warn('Redis falló — rate limiting degradado a in-memory', {
      action: 'rate-limit',
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return checkRateLimitInMemory(key, config);
  }
}

export function getRateLimitKey(action: string, identifier: string): string {
  return `${action}:${identifier}`;
}

/** Exported for testing — clears the internal rate limit store */
export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
  limiterCache.clear();
  warnedMissingUpstash = false;
}
