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
 * ESTADO ACTUAL — cada centro apunta a su propia carpeta. Armonía entregó sus
 * assets el 2026-10-10 y se convirtieron a PNG con canal alfa; el detalle de la
 * conversión está en `docs/BRANDING_POR_CENTRO_2026-09-30.md` §5.
 * `tests/unit/documents/branding-assets.test.ts` falla en CI si a un centro le
 * falta un archivo — sin ese guardián, cuando una imagen no existe `inlineAssets`
 * solo escribe un `console.warn` y el documento se genera igual, con la imagen
 * rota.
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
 * Cada centro con la suya desde el 2026-10-10. Agregar un centro es agregar una
 * fila acá y una carpeta con los tres nombres de archivo; el guardián del test
 * exige que los tres existan.
 */
const CARPETA_POR_TENANT: Record<TenantId, string> = {
  'constructores-paz': 'constructores-paz',
  armonia: 'armonia',
};

/** Carpeta que se usa cuando no se conoce el tenant (ver `brandingRef`). */
const CARPETA_POR_DEFECTO = 'constructores-paz';

/**
 * Forma del mapa tenant → carpeta, para poder inyectar uno en los tests.
 *
 * POR QUÉ ES INYECTABLE. Se agregó cuando los dos centros compartían la carpeta
 * de Constructores: con las dos filas iguales, el mapa real y el fallback
 * devolvían el MISMO string, así que ninguna aserción contra
 * `brandingRef(asset, tenantId)` podía distinguir "el mapper usó el tenant del
 * expediente" de "el mapper perdió el tenant y cayó al fallback". Verificado
 * entonces: ignorando `caseData` en `mapBrandingAssets`, los 676 tests de
 * documentos seguían pasando, golden incluido.
 *
 * Desde el 2026-10-10 el mapa real ya distingue, así que los tests tienen
 * dientes sin inyectar nada. El parámetro se conserva igual: el día que se
 * agregue un tercer centro vuelve a hacer falta para fijar el cableado sin
 * depender de que las carpetas difieran.
 *
 * El default es siempre el mapa real; producción nunca pasa este parámetro.
 */
export type CarpetasPorTenant = Readonly<Record<string, string>>;

/**
 * El ref que va en el `src` del `<img>` de la plantilla, p. ej.
 * `/branding/constructores-paz/logo-encabezado.png`.
 *
 * `tenantId` desconocido o ausente cae a Constructores de Paz. Pasa en los
 * fixtures sintéticos de los tests, que construyen el caso a mano sin la
 * relación `tenant`.
 *
 * ESE FALLBACK DEJÓ DE SER INOCUO el 2026-10-10, cuando cada centro pasó a
 * tener su carpeta: ahora significa "logo de Constructores". Lo que impide que
 * eso llegue a un documento real no es este módulo sino el membrete, que para
 * un tenant desconocido **no emite ninguna clave** y hace fallar la generación
 * (`membrete-centro.ts`). O sea: un documento con el logo del otro centro por
 * culpa de este fallback no se puede generar, porque antes lo corta el gate de
 * placeholders sin resolver.
 *
 * No es una propiedad que convenga dar por sentada —depende de que toda
 * plantilla con imagen de branding use también algún `{{CENTRO_*}}`—, así que
 * `branding-assets.test.ts` la verifica plantilla por plantilla.
 */
export function brandingRef(
  asset: BrandingAsset,
  tenantId?: string | null,
  carpetas: CarpetasPorTenant = CARPETA_POR_TENANT,
): string {
  const carpeta = (tenantId && carpetas[tenantId]) || CARPETA_POR_DEFECTO;
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
