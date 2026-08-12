/**
 * Contexto de request (server-only) — correlación de logs por requestId.
 *
 * Realidad de Next.js que condiciona el diseño: `middleware.ts` corre en el
 * runtime edge, en un isolate SEPARADO de las server actions (Node). Un
 * AsyncLocalStorage.run() dentro del middleware no se propaga a las actions.
 *
 * Flujo real:
 *   1. middleware.ts emite `x-request-id` y lo reenvía en los headers.
 *   2. `authenticateUser()` (entry point de casi toda server action) llama
 *      a `seedRequestContextFromHeaders()`, que lee ese header y siembra el
 *      AsyncLocalStorage con `enterWith()` — se usa enterWith (y no run)
 *      porque no podemos envolver el body de la action desde dentro.
 *   3. El logger incluye el requestId automáticamente vía el provider
 *      registrado abajo (inversión de dependencia: logger.ts también corre
 *      en el cliente y no puede importar async_hooks).
 *
 * Los jobs post-response (`after()`) heredan el contexto de la action que
 * los programó.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { setRequestIdProvider } from './logger';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** requestId del contexto actual, o undefined fuera de un request sembrado. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Ejecuta `fn` dentro de un contexto con requestId (cron, jobs, tests). */
export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/**
 * Siembra el contexto con el x-request-id emitido por el middleware, o uno
 * nuevo si no existe (invocación fuera de request: cron, tests). Idempotente:
 * si el contexto ya tiene id, lo conserva.
 */
export async function seedRequestContextFromHeaders(): Promise<string> {
  const existing = getRequestId();
  if (existing) return existing;

  let requestId: string;
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    requestId = h.get('x-request-id') ?? randomUUID();
  } catch {
    requestId = randomUUID();
  }

  storage.enterWith({ requestId });
  return requestId;
}

// El logger emite el requestId automáticamente en cada llamada del servidor.
setRequestIdProvider(getRequestId);
