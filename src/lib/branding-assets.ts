/**
 * Branding por centro en las plantillas de documentos.
 *
 * ANTES de este módulo, las 63 plantillas tenían la ruta del logo de
 * Constructores de Paz **escrita a mano** en el HTML, en tres variantes según
 * la profundidad del archivo (`/img/...`, `../insolvency/img/...`,
 * `../../insolvency/img/...`). No había ninguna rama por tenant en la
 * generación: `getTemplateAssetsBaseDir()` resuelve por TIPO DE CASO, nunca por
 * centro. Consecuencia, medida y documentada en
 * `docs/BRANDING_POR_CENTRO_2026-09-30.md` §1: todo documento generado para el
 * tenant `armonia` sale con el logo y la firma del OTRO centro.
 *
 * Los assets se eligen por `tenantId` y NO por `centroConciliacionNombre`: ese
 * campo es texto libre que escribe el usuario, y por la misma razón que ya está
 * escrita en `centro-conciliacion.ts`, no sirve para elegir rutas de archivo.
 *
 * ESTADO ACTUAL — los dos centros apuntan a los assets de Constructores de Paz.
 * Armonía todavía no entregó los suyos (hace falta un banner horizontal con
 * transparencia ≥1200px, un logo cuadrado ≥640px y una firma ≥500px sin fondo;
 * el detalle está en §4 de ese documento). Esto NO es una regresión: es
 * exactamente el comportamiento que el código ya tenía. La diferencia es que
 * ahora cambiarlo es editar una fila de este mapa, y que
 * `tests/unit/documents/branding-assets.test.ts` falla en CI si a un centro le
 * falta un archivo — hoy, cuando una imagen no existe, `inlineAssets` solo
 * escribe un `console.warn` y el documento se genera igual, con la imagen rota.
 */

import type { TenantId } from './prisma';

/**
 * Prefijo de los refs de branding dentro del HTML de las plantillas.
 *
 * `inlineAssets` (src/lib/html-to-pdf.ts) lo trata como caso especial: lo
 * resuelve contra la raíz compartida `templates/`, no contra el directorio del
 * tipo de caso. Es el único prefijo root-relative que se comparte entre
 * insolvencia, conciliación y acuerdos de apoyo.
 */
export const BRANDING_REF_PREFIX = '/branding/';

/** Las piezas de branding que una plantilla puede pedir. */
export type BrandingAsset =
  | 'logo-encabezado'
  | 'logo-firma'
  | 'firma-operador';

/**
 * Carpeta de assets por tenant, relativa a `templates/branding/`.
 *
 * Armonía apunta a `constructores-paz` a propósito y de forma temporal: es lo
 * que el código ya hacía. Cuando lleguen sus assets, esta fila pasa a
 * `'armonia'` y se crea `templates/branding/armonia/` con los mismos cuatro
 * nombres de archivo. Nada más cambia.
 */
const CARPETA_POR_TENANT: Record<TenantId, string> = {
  'constructores-paz': 'constructores-paz',
  armonia: 'constructores-paz',
};

/** Carpeta que se usa cuando no se conoce el tenant (ver `brandingRef`). */
const CARPETA_POR_DEFECTO = 'constructores-paz';

/**
 * El ref que va en el `src` del `<img>` de la plantilla, p. ej.
 * `/branding/constructores-paz/logo-encabezado.png`.
 *
 * `tenantId` desconocido o ausente cae a Constructores de Paz. Pasa en los
 * fixtures sintéticos de los tests (que construyen el caso a mano, sin la
 * columna `tenantId` de Prisma) y es el mismo valor que hoy producen los dos
 * centros reales, así que no cambia ningún documento. Si algún día los centros
 * dejan de compartir assets, este fallback deja de ser inocuo: por eso el test
 * `branding-assets.test.ts` verifica que los dos tenants reales resuelvan por
 * mapa y no por fallback.
 */
export function brandingRef(
  asset: BrandingAsset,
  tenantId?: string | null,
): string {
  const carpeta =
    (tenantId && CARPETA_POR_TENANT[tenantId as TenantId]) ||
    CARPETA_POR_DEFECTO;
  return `${BRANDING_REF_PREFIX}${carpeta}/${asset}.png`;
}

/** Los tenants que este mapa conoce, para que los tests los recorran. */
export const TENANTS_CON_BRANDING = Object.keys(
  CARPETA_POR_TENANT,
) as TenantId[];

/** Los assets que toda carpeta de centro debe tener. */
export const ASSETS_REQUERIDOS: BrandingAsset[] = [
  'logo-encabezado',
  'logo-firma',
  'firma-operador',
];
