/**
 * Longitud máxima de los textos (F2, auditoría 2026-10-27).
 *
 * Antes casi ningún `z.string()` tenía `.max()` y todas las columnas de texto
 * son `text`: un nombre de deudor de 50.000 caracteres atravesaba el mapper
 * intacto y entraba al HTML que va a Puppeteer.
 *
 * NO HAY MIGRACIÓN NI CAMBIO DE COLUMNAS: el límite es de la aplicación, no de
 * la base. Se aplica en las acciones del servidor, no en los schemas, por dos
 * motivos:
 *
 *  1. **Al editar se valida solo lo que cambió**, como el teléfono (F3): un
 *     registro viejo con un texto más largo se sigue pudiendo editar en sus
 *     otros campos. Para eso hace falta el valor guardado, que el schema no
 *     tiene.
 *  2. Los schemas base también se usan para leer de la base; la lectura de
 *     datos existentes no puede fallar por esto.
 *
 * Los límites son holgados a propósito: cortan el abuso y el pegado
 * accidental, no un dato real.
 */

/** Nombres, documentos, ciudad, cargo, tarjeta profesional. */
export const LIMITE_CORTO = 200;
/** Correos: 254 es el máximo del estándar, el mismo de `registerSchema`. */
export const LIMITE_CORREO = 254;
/** Direcciones. */
export const LIMITE_MEDIO = 500;
/** Texto libre: observaciones, hechos, descripciones, cláusulas. */
export const LIMITE_LARGO = 10_000;

const CAMPO_CORTO =
  /(name|nombre|idnumber|identificacion|cedula|nit|city|ciudad|department|departamento|occupation|ocupacion|cargo|profession|representative|representante|professionalcard|tarjeta)/i;
const CAMPO_MEDIO = /(address|direccion|domicilio)/i;
const CAMPO_CORREO = /(email|correo)/i;

/** El límite que corresponde a un campo, por su nombre. */
export function limiteDeCampo(campo: string): number {
  if (CAMPO_CORREO.test(campo)) return LIMITE_CORREO;
  if (CAMPO_MEDIO.test(campo)) return LIMITE_MEDIO;
  if (CAMPO_CORTO.test(campo)) return LIMITE_CORTO;
  return LIMITE_LARGO;
}

function mensaje(campo: string, limite: number): string {
  return `El campo «${campo}» supera el máximo de ${limite.toLocaleString('es-CO')} caracteres`;
}

function valorEn(guardado: unknown, clave: string | number): unknown {
  if (guardado === null || typeof guardado !== 'object') return undefined;
  return (guardado as Record<string | number, unknown>)[clave];
}

/**
 * Primer texto que supera su límite, o `null`.
 *
 * Recorre también arreglos y objetos anidados (acreedores, bienes y demás
 * relaciones del alta). Con `guardado`, un texto que llega igual al valor
 * guardado en la misma ruta no se valida.
 */
export function excesoDeLongitud(
  nuevo: unknown,
  guardado?: unknown,
  campo = '',
): string | null {
  if (typeof nuevo === 'string') {
    if (guardado !== undefined && nuevo === guardado) return null;
    const limite = limiteDeCampo(campo);
    return nuevo.length > limite ? mensaje(campo, limite) : null;
  }
  if (Array.isArray(nuevo)) {
    for (const [i, item] of nuevo.entries()) {
      const problema = excesoDeLongitud(item, valorEn(guardado, i), campo);
      if (problema) return problema;
    }
    return null;
  }
  if (nuevo !== null && typeof nuevo === 'object' && !(nuevo instanceof Date)) {
    if (typeof File !== 'undefined' && nuevo instanceof File) return null;
    for (const [clave, valor] of Object.entries(nuevo)) {
      const problema = excesoDeLongitud(valor, valorEn(guardado, clave), clave);
      if (problema) return problema;
    }
  }
  return null;
}
