/**
 * Formato de teléfono (F3, auditoría 2026-10-27).
 *
 * Antes los 7 sitios que pedían teléfono validaban solo `.min(1)`:
 * `abc-def-ghi` era un teléfono válido y terminaba impreso en las
 * notificaciones a acreedores y juzgados.
 *
 * La regla: entre 7 y 15 dígitos, con espacios, `+` (solo al inicio), `-` y
 * paréntesis como separadores, y una extensión opcional con «ext.». No se
 * exige celular de 10 dígitos: acreedores y entidades dan fijos y
 * extensiones. 15 es el máximo de E.164.
 *
 * DÓNDE SE APLICA. Al crear, siempre. Al editar, solo si el teléfono cambió
 * respecto del guardado (`problemaDeTelefonoSiCambio`): un registro viejo con
 * un teléfono mal cargado se sigue pudiendo editar en sus otros campos. Por
 * eso NO va en los schemas base (`debtorSchema`, `creditorSchema`,
 * `userSchema`): también se usan para leer de la base, y la lectura de datos
 * existentes no puede fallar por esto.
 */
import { z } from 'zod';

export const TELEFONO_MIN_DIGITOS = 7;
export const TELEFONO_MAX_DIGITOS = 15;

export const MENSAJE_TELEFONO_INVALIDO =
  'El teléfono debe tener entre 7 y 15 dígitos (se permiten espacios, +, -, paréntesis y «ext.»)';

/** Número principal y extensión opcional: `+57 (601) 555-1234 ext. 12`. */
const FORMATO = /^\+?[\d\s\-()]+?(?:\s*ext\.?\s*\d{1,6})?$/i;
const EXTENSION = /\s*ext\.?\s*\d{1,6}$/i;

/** `null` si el teléfono es válido; si no, el mensaje para mostrar. */
export function problemaDeTelefono(valor: string): string | null {
  const texto = valor.trim();
  if (!FORMATO.test(texto)) return MENSAJE_TELEFONO_INVALIDO;
  const principal = texto.replace(EXTENSION, '');
  const digitos = principal.replace(/\D/g, '').length;
  if (digitos < TELEFONO_MIN_DIGITOS || digitos > TELEFONO_MAX_DIGITOS) {
    return MENSAJE_TELEFONO_INVALIDO;
  }
  return null;
}

/**
 * Para las ediciones: valida solo si el teléfono cambió. `nuevo` undefined
 * significa que el campo no viene en la edición.
 */
export function problemaDeTelefonoSiCambio(
  nuevo: string | null | undefined,
  guardado: string | null | undefined,
): string | null {
  if (nuevo === undefined || nuevo === null) return null;
  if (nuevo.trim() === (guardado ?? '').trim()) return null;
  return problemaDeTelefono(nuevo);
}

/** Campo de teléfono obligatorio de un alta. */
export const telefonoNuevo = () =>
  z
    .string()
    .min(1, 'El teléfono es requerido')
    .superRefine((valor, ctx) => {
      const problema = problemaDeTelefono(valor);
      if (problema) ctx.addIssue({ code: 'custom', message: problema });
    });
