/**
 * El aviso que ve el usuario cuando un documento no se genera por datos que
 * faltan.
 *
 * Hay dos clases de dato faltante y piden cosas distintas a quien lee:
 *  - **del expediente** (el deudor, los acreedores, la propuesta de pago): lo
 *    completa el mismo operador, así que el aviso nombra los campos;
 *  - **del centro** (su membrete: nombre, resoluciones, quien firma): el
 *    operador no puede completarlo desde la aplicación. Listarle
 *    `DIRECTOR_CARGO` no le dice nada ni qué hacer; el aviso nombra el dato y
 *    el centro, y lo manda al administrador.
 *
 * El texto del expediente lo sigue armando cada ruta de generación, con su
 * redacción de siempre; acá solo se aparta lo del centro.
 */

import { ETIQUETA_CAMPO_MEMBRETE } from '@/lib/membrete-centro';

import { campoDeClaveMembrete } from './placeholders/membrete';

/**
 * El aviso del centro: "Falta el <dato> de <centro>. Contacta al
 * administrador." Con varios datos, "Faltan el X y el Y de …".
 */
export function mensajeFaltanDatosDelCentro(
  claves: readonly string[],
  nombreCentro: string | undefined,
): string {
  const etiquetas = [
    ...new Set(
      claves.flatMap((c) => {
        const campo = campoDeClaveMembrete(c);
        return campo ? [ETIQUETA_CAMPO_MEMBRETE[campo]] : [];
      }),
    ),
  ];
  const lista =
    etiquetas.length > 1
      ? `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`
      : (etiquetas[0] ?? '');
  // Sin el nombre (un centro desconocido no emite ninguno), "del centro".
  const deCentro = nombreCentro ? `de ${nombreCentro}` : 'del centro';
  return `${etiquetas.length > 1 ? 'Faltan' : 'Falta'} ${lista} ${deCentro}. Contacta al administrador.`;
}

/**
 * El aviso completo para los campos `faltan` de un documento.
 *
 * @param placeholders los del documento; de ahí sale el nombre del centro.
 * @param delExpediente cómo nombra la ruta de generación los datos del
 *   expediente que faltan. Solo se llama si falta alguno.
 */
export function mensajeDeDatosFaltantes(
  faltan: readonly string[],
  placeholders: Readonly<Record<string, string>>,
  delExpediente: (faltan: string[]) => string,
): string {
  const delCentro = faltan.filter((c) => campoDeClaveMembrete(c));
  const resto = faltan.filter((c) => !campoDeClaveMembrete(c));
  if (delCentro.length === 0) return delExpediente(resto);

  const aviso = mensajeFaltanDatosDelCentro(
    delCentro,
    placeholders.CENTRO_NOMBRE || undefined,
  );
  return resto.length > 0 ? `${delExpediente(resto)} ${aviso}` : aviso;
}
