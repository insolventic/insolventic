/**
 * Validación de montos de dinero, compartida por todos los schemas.
 *
 * Sin `'use server'`: lo importan schemas de casos, deudores y pagos, y los
 * formularios del cliente a través de esos schemas.
 *
 * DOS REGLAS, IGUALES PARA TODOS LOS MONTOS (F4 y F5, auditoría 2026-10-27):
 *
 *  - **Ningún monto es negativo.** Antes, capital e intereses de una deuda,
 *    valor de un bien, suma descontada de una libranza y valor adeudado de un
 *    servicio eran `z.string()` sin ninguna comprobación: una deuda de −1
 *    imprimía `TOTAL_ACREENCIAS = "-$ 3"` en un documento que se radica.
 *  - **Ningún monto supera `MONTO_MAXIMO` (10^15, mil billones de pesos).**
 *    Sin tope, un ingreso de `1e21` imprimía `$ 1.000.000.000.000.001.300.000`:
 *    los dígitos finales son error de punto flotante, no un dato. 10^15 queda
 *    muy por debajo de `Number.MAX_SAFE_INTEGER` (~9 × 10^15), así que todo
 *    monto aceptado se representa exacto.
 *
 * Tres formas, según cómo llega el campo:
 *
 *  - `montoOpcional()` / `montoRequerido(mensaje)`: el campo se **convierte** a
 *    número (`parsearMonto`). Son los 55 campos del formulario maestro.
 *  - `montoTexto(...)`: el campo **sigue siendo string** en el schema (capital,
 *    intereses, valor del bien…) porque así lo consumen las acciones y los
 *    formularios; se valida el valor sin cambiar el tipo.
 *  - `montoNumerico()`: el campo ya es `number` (pagos, ingresos del deudor).
 */
import { z } from 'zod';
import { parsearMonto } from './monto';

export const MONTO_MAXIMO = 1e15;

export const MENSAJE_MONTO_NEGATIVO = 'El monto no puede ser negativo';
export const MENSAJE_MONTO_MAXIMO =
  'El monto supera el máximo permitido ($1.000.000.000.000.000)';
export const MENSAJE_MONTO_INVALIDO = 'El monto no es un número válido';

/** Qué tiene de malo un monto ya leído, o `null` si es válido. */
export function problemaDeMonto(valor: number): string | null {
  if (!Number.isFinite(valor)) return MENSAJE_MONTO_INVALIDO;
  if (valor < 0) return MENSAJE_MONTO_NEGATIVO;
  if (valor > MONTO_MAXIMO) return MENSAJE_MONTO_MAXIMO;
  return null;
}

const entradaDeMonto = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.undefined(),
]);

const numeroDeMonto = (mensajeInvalido: string = MENSAJE_MONTO_INVALIDO) =>
  z
    .number({ message: mensajeInvalido })
    .min(0, MENSAJE_MONTO_NEGATIVO)
    .max(MONTO_MAXIMO, MENSAJE_MONTO_MAXIMO);

export const montoOpcional = () =>
  entradaDeMonto.transform(parsearMonto).pipe(numeroDeMonto().optional());

/**
 * `mensaje` es el de "falta el dato" (vacío o ilegible). Un negativo o un
 * monto fuera de tope dicen eso, no que falta.
 */
export const montoRequerido = (mensaje: string) =>
  entradaDeMonto.transform(parsearMonto).pipe(numeroDeMonto(mensaje));

/**
 * Monto que el schema conserva como string. Vacío es válido salvo que se
 * pase `requerido` (el mensaje de "falta el dato").
 */
export const montoTexto = ({ requerido }: { requerido?: string } = {}) =>
  z.string().superRefine((valor, ctx) => {
    const numero = parsearMonto(valor);
    if (numero === undefined) {
      if (requerido) ctx.addIssue({ code: 'custom', message: requerido });
      return;
    }
    const problema = problemaDeMonto(numero);
    if (problema) ctx.addIssue({ code: 'custom', message: problema });
  });

/** Monto que ya llega como número (pagos, ingresos y gastos del deudor). */
export const montoNumerico = () => numeroDeMonto();
