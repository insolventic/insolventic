/**
 * ¿Es el error con el que Next señala una redirección (`redirect()`)? Next lo
 * marca con un `digest` que empieza por "NEXT_REDIRECT;" — el mismo criterio
 * que su `isRedirectError` interno, sin importar de `next/dist`.
 *
 * Es el contrato de Next: comparar el `message` ("NEXT_REDIRECT") depende de un
 * detalle de implementación y falla en ambos sentidos (una redirección con otro
 * message no se reconoce; un error común con ese message se toma por redirección).
 *
 * Vive fuera de `features/auth/actions.ts` porque los archivos `'use server'`
 * solo pueden exportar funciones async.
 */
export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;');
}
