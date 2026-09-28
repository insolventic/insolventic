/**
 * Etiquetas del formulario de bienes que dependen del tipo de bien.
 *
 * Viven acá —y no inline en cada componente— porque la captura de bienes está
 * duplicada en dos pantallas que ya divergieron entre sí:
 *
 *   - create-case-dialog/assets-section.tsx  (alta de caso)
 *   - edit-case-dialog/assets-tab.tsx        (edición de caso)
 *
 * Sin una única fuente, un cambio de texto de producto se aplica en una y se
 * olvida en la otra, y el deudor ve un rótulo distinto según por dónde entró.
 *
 * No hay enum de tipo de bien en Prisma (todo el schema usa `String`), así que
 * el discriminante es el mismo literal `'INMUEBLE'` que ya usan los bloques
 * condicionales de ambos componentes.
 */

/** Valor de `Asset.type` que identifica a un bien inmueble. */
export const ASSET_TYPE_INMUEBLE = 'INMUEBLE';

export function isInmueble(assetType: string | undefined | null): boolean {
  return assetType === ASSET_TYPE_INMUEBLE;
}

/**
 * Rótulo del campo de valor.
 *
 * En inmuebles se pide explícitamente el valor *comercial*, que es el que la
 * Solicitud de Insolvencia imprime ("Valor Comercial o estimado", fila
 * `{{INMUEBLE_VALOR}}`). En los muebles el rótulo genérico alcanza.
 */
export function assetValueLabel(assetType: string | undefined | null): string {
  return isInmueble(assetType) ? 'Valor comercial ($)' : 'Valor ($)';
}
