/**
 * withRetry — reintento con backoff exponencial para operaciones transitorias
 * (llamadas a la API de Google Drive, principalmente).
 *
 * No reintenta errores claramente permanentes (4xx de validación); el
 * predicado `isRetryable` puede afinarse por llamada.
 */

export interface RetryOptions {
  /** Intentos totales (incluido el primero). Default: 3 */
  attempts?: number;
  /** Espera base en ms; crece exponencialmente (base, 2×base, 4×base…). Default: 500 */
  baseDelayMs?: number;
  /** Decide si un error amerita reintento. Default: siempre true */
  isRetryable?: (error: unknown) => boolean;
  /** Etiqueta para el log de reintentos */
  label?: string;
}

import { logger } from '@/lib/logger';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const isRetryable = options.isRetryable ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn('Retry attempt', {
        action: options.label ?? 'withRetry',
        attempt,
        maxAttempts: attempts,
        nextDelayMs: delay,
        reason: error instanceof Error ? error.message : String(error),
      });
      await wait(delay);
    }
  }
  throw lastError;
}
