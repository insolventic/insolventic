/**
 * In-memory rate limiting for serverless environments.
 * Provides per-instance sliding window rate limiting.
 * For production-grade distributed rate limiting, replace with Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

export const RATE_LIMIT_CONFIGS = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  register: { windowMs: 60 * 60 * 1000, maxAttempts: 3 },
  forgotPassword: { windowMs: 15 * 60 * 1000, maxAttempts: 3 },
  changePassword: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  resetPassword: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
} as const;

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remainingAttempts: number; resetInMs: number } {
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
    };
  }

  if (entry.count >= config.maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetInMs: entry.resetTime - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.count,
    resetInMs: entry.resetTime - now,
  };
}

export function getRateLimitKey(action: string, identifier: string): string {
  return `${action}:${identifier}`;
}

/** Exported for testing — clears the internal rate limit store */
export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}
