/**
 * Qué mensaje de error llega al cliente desde una server action (N6,
 * auditoría 2026-10-27).
 *
 * Antes los `catch` devolvían `error.message` tal cual. Con un `ZodError` eso
 * era el JSON completo de los errores, en inglés (1.017 caracteres en el alta
 * de casos); con un error de Prisma o de red, el detalle interno del fallo.
 *
 * Tres casos:
 *
 *  - **`ErrorDeNegocio`**: un mensaje escrito para el usuario ("No tiene
 *    permisos para: Ver deudores", "Caso no encontrado", el motivo de una
 *    transición de fase no permitida). Llega tal cual. Es un evento esperado:
 *    no se registra como error.
 *  - **Error de validación (Zod)**: llega el primer mensaje, en español (los
 *    propios del schema tienen prioridad sobre los del locale de `zod-es.ts`).
 *  - **Cualquier otro** (Prisma, red, Drive, un bug): llega el mensaje genérico
 *    de la acción y el detalle se registra con `logger.error`, que lo manda a
 *    Sentry con redacción de datos personales. Nunca llega al cliente.
 *
 * Sin `'use server'`: lo importan las acciones de todas las features.
 */
import { z } from 'zod';

import { logger } from '@/lib/logger';
import './zod-es';

export class ErrorDeNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
  }
}

/**
 * También por nombre: una subclase o una copia del módulo en otro bundle
 * (servidor/edge) no comparte el mismo constructor.
 */
export function esErrorDeNegocio(error: unknown): error is ErrorDeNegocio {
  return (
    error instanceof ErrorDeNegocio ||
    (error instanceof Error && error.name === 'ErrorDeNegocio')
  );
}

function esErrorDeValidacion(error: unknown): error is z.ZodError {
  return (
    error instanceof z.ZodError ||
    (error instanceof Error &&
      error.name === 'ZodError' &&
      Array.isArray((error as { issues?: unknown }).issues))
  );
}

/**
 * El mensaje para el cliente. `accion` identifica el sitio en el log.
 */
export function mensajeDeError(
  error: unknown,
  generico: string,
  accion = 'server-action',
): string {
  if (esErrorDeNegocio(error)) return error.message;

  if (esErrorDeValidacion(error)) {
    return error.issues[0]?.message ?? generico;
  }

  logger.error(generico, error, { action: accion });
  return generico;
}
