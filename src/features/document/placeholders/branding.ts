/**
 * Branding por centro: sub-mapper de los placeholders de assets.
 *
 * Reemplaza las rutas de imagen escritas a mano en las 63 plantillas por tres
 * placeholders que se resuelven por `tenantId`. El porqué, el inventario y el
 * plan completo están en `docs/BRANDING_POR_CENTRO_2026-09-30.md`; la mecánica
 * de resolución y el estado "los dos centros comparten assets por ahora", en
 * `src/lib/branding-assets.ts`.
 *
 * POR QUÉ PLACEHOLDERS Y NO UNA BASE DE ASSETS POR CENTRO (§5.1 de ese doc):
 *  - Las plantillas usaban rutas relativas con `../`, así que mover la base
 *    obligaba igual a editar los 63 archivos. No se ahorraba nada.
 *  - Con placeholder, el valor queda en el golden master: si alguien cambia qué
 *    logo usa un centro, el golden se mueve y hay que mirarlo. Con una base
 *    implícita el cambio es invisible para la red de seguridad.
 *  - El gate de placeholders sin resolver pasa a cubrir el branding: si el
 *    mapper no produce la clave, la generación se bloquea en vez de subir a
 *    Drive un PDF sin logo.
 *
 * Los valores son rutas sin caracteres especiales, así que el escapado por
 * defecto (`escapeAllUnlessHtml`) los deja intactos: NO hay que agregarlos a
 * `HTML_PLACEHOLDERS_ALLOWLIST`.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { brandingRef, type CarpetasPorTenant } from '@/lib/branding-assets';

/**
 * `tenantId` es una columna real de `Case` y viaja en el payload de Prisma,
 * pero `CaseWithRelations` (el schema Zod) no la declara. Se lee con el mismo
 * patrón que ya usan `mapApoyoFields`, `mapCheckList` y
 * `buildConciliationContext` para campos no declarados: el cast a
 * `Record<string, unknown>`. `asCaseWithRelations` es un spread, no un
 * `.parse()`, así que no descarta la clave.
 */
export function mapBrandingAssets(
  caseData: CaseWithRelations,
  /**
   * Mapa tenant → carpeta. Producción nunca lo pasa: el default es el mapa real
   * de `branding-assets.ts`. Los tests inyectan uno con una carpeta distinta por
   * tenant para poder verificar que el `tenantId` del expediente es el que
   * decide — con el mapa real, los dos centros comparten carpeta y la aserción
   * no distinguiría el fallback.
   */
  carpetas?: CarpetasPorTenant,
): PlaceholderMap {
  const tenantId = (caseData as Record<string, unknown>).tenantId as
    | string
    | undefined;

  return {
    LOGO_ENCABEZADO_SRC: brandingRef('logo-encabezado', tenantId, carpetas),
    LOGO_FIRMA_SRC: brandingRef('logo-firma', tenantId, carpetas),
    FIRMA_OPERADOR_SRC: brandingRef('firma-operador', tenantId, carpetas),
  };
}
