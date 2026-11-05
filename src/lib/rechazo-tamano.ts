/**
 * Constancia de que alguien quiso subir un archivo y no cupo.
 *
 * Es la evidencia para decidir si el límite por archivo alcanza o si hace falta
 * la subida directa a Drive (`docs/DECISIONES.md`). Lo que ya hay en Drive no
 * sirve para eso: muestra lo que cupo, no lo que se quedó fuera.
 *
 * Solo sale el origen, un intervalo de tamaño y una categoría de tipo, todos de
 * listas cerradas. Nunca el nombre del archivo, que suele llevar datos del
 * deudor, ni el peso exacto, ni nada del caso.
 *
 * Va en `warn`, aunque sea un evento esperado, porque es el único nivel que
 * llega a algún lado: el rechazo ocurre en el navegador, donde `info` se queda
 * en la consola del usuario. El contador es el del propio issue de Sentry: cada
 * combinación es un mensaje fijo, y Sentry agrupa por mensaje. Por eso el dato
 * va en el mensaje y no en el contexto, que `logger.warn` no envía a Sentry.
 *
 * `scrubSentryEvent` le quita a estos eventos lo que el SDK agrega por su
 * cuenta (URL, migas de pan, usuario), que sí puede traer datos del expediente.
 */

import { logger } from '@/lib/logger';
import { PREFIJO_RECHAZO_POR_TAMANO } from '@/lib/sentry-scrub';

export type OrigenDeArchivo = 'comprobante' | 'documento-caso';

const MB = 1024 * 1024;

const CATEGORIAS_DE_TIPO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
};

/** Los cortes responden a la decisión pendiente: ¿bastaría con subir a 10 MB? */
export function rangoDeTamano(bytes: number): string {
  if (bytes <= 5 * MB) return 'hasta 5 MB';
  if (bytes <= 10 * MB) return '5-10 MB';
  if (bytes <= 25 * MB) return '10-25 MB';
  return 'más de 25 MB';
}

/**
 * El tipo lo declara el navegador y es texto libre, así que no se copia: lo que
 * no está en la lista sale como `otro`.
 */
export function categoriaDeTipo(mimeType: string): string {
  if (!mimeType) return 'desconocido';
  return Object.hasOwn(CATEGORIAS_DE_TIPO, mimeType)
    ? CATEGORIAS_DE_TIPO[mimeType]
    : 'otro';
}

export function registrarRechazoPorTamano(
  origen: OrigenDeArchivo,
  archivo: { size: number; type: string },
): void {
  const rango = rangoDeTamano(archivo.size);
  const tipo = categoriaDeTipo(archivo.type);

  logger.warn(
    `${PREFIJO_RECHAZO_POR_TAMANO} | origen=${origen} | rango=${rango} | tipo=${tipo}`,
    { action: 'rechazo-tamano', origen, rango, tipo },
  );
}
