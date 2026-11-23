/**
 * Errores de validación (Zod) en texto legible para el usuario.
 *
 * El `message` de un `ZodError` en Zod 4 es el JSON de sus issues:
 * `[ { "origin": "string", "code": "too_small", ..., "message": "La dirección
 * es requerida" } ]`. Las acciones que devolvían `error.message` le mostraban
 * eso al usuario (diálogo "Crear Nuevo Deudor" del asistente de casos).
 *
 * Este helper devuelve el mensaje del primer issue y, por campo, el primer
 * mensaje de cada uno, para que el formulario pueda mostrarlo bajo su campo.
 *
 * Hoy lo usan solo las acciones de deudor. Extenderlo al resto de las acciones
 * queda cubierto por el PR #187 (`mensajeDeError`, `src/lib/error-de-accion.ts`
 * en esa rama); ver `docs/ROADMAP.md`.
 *
 * Sin `'use server'`: lo importan las acciones y se prueba como función pura.
 */
import { ZodError } from 'zod';

export interface ErroresDeValidacion {
  /** El mensaje del primer issue: lo que se muestra si no hay campo donde ponerlo. */
  error: string;
  /** Primer mensaje de cada campo, por ruta (`address`, `debts.0.amount`). */
  fieldErrors: Record<string, string>;
}

const MENSAJE_POR_DEFECTO = 'Los datos ingresados no son válidos';

/**
 * También por forma (`name` e `issues`): una copia de Zod en otro bundle no
 * comparte la clase.
 */
function esZodError(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true;
  return (
    error instanceof Error &&
    error.name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

/** `null` si `error` no es un error de validación de Zod. */
export function erroresDeValidacion(
  error: unknown,
): ErroresDeValidacion | null {
  if (!esZodError(error)) return null;

  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.map(String).join('.');
    if (campo && !(campo in fieldErrors)) fieldErrors[campo] = issue.message;
  }

  return {
    error: error.issues[0]?.message || MENSAJE_POR_DEFECTO,
    fieldErrors,
  };
}
