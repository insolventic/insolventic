/**
 * De dónde sale el slug del centro que usan los mapas por tenant.
 *
 * EL PROBLEMA QUE ESTE MÓDULO RESUELVE
 * ====================================
 * `branding-assets.ts` (y el membrete, cuando entre) keyean sus mapas por el
 * **slug** del centro: `'armonia'` | `'constructores-paz'`. Es la clave
 * correcta — legible, estable entre entornos, y la misma que usa el selector de
 * login y `centro-conciliacion.ts`.
 *
 * Pero `Case.tenantId` **no es el slug**: es el `Tenant.id`, un cuid. El
 * recorrido real:
 *
 *   1. El login recibe el slug del formulario y busca el tenant con
 *      `where: { slug }`.
 *   2. El JWT se firma con ese slug (`tenantId: tenantIdValue`).
 *   3. `authenticateUser()` lee el slug del token, vuelve a resolver el tenant
 *      por slug y devuelve **`tenantId: tenant.id`** — el cuid.
 *   4. `createCase` persiste ese cuid en `Case.tenantId`. Y no podría ser otra
 *      cosa: la FK `Case_tenantId_fkey` referencia `Tenant("id")`, con
 *      `id String @id @default(cuid())`.
 *
 * Resultado: `mapBrandingAssets` recibía un cuid, `CARPETA_POR_TENANT[cuid]`
 * daba `undefined` y **siempre** caía a `CARPETA_POR_DEFECTO`. El branding por
 * centro nunca eligió por centro. Hoy no se nota porque los dos centros
 * comparten la carpeta de Constructores, pero el día que Armonía tenga la suya,
 * sus documentos seguirían saliendo con los assets del otro centro — es decir,
 * el bug que la infraestructura de branding decía arreglar.
 *
 * POR QUÉ SUS TESTS NO LO ATRAPARON
 * =================================
 * Porque le pasaban el slug a mano. Los fixtures unitarios construyen el caso
 * con `tenantId: 'constructores-paz'` — un valor que producción nunca produce —
 * y el test de `tests/db` comparaba contra `brandingRef(asset, stored.tenantId)`,
 * o sea contra el mismo valor que estaba mal: pasaba por construcción.
 *
 * Por eso `tenant-slug.test.ts` incluye un **guardián de forma**: el valor que
 * el mapper termina usando tiene que parecer un slug (`^[a-z][a-z0-9-]*$`). Un
 * cuid no pasa ese filtro, así que el próximo fixture sintético falla en vez de
 * pasar en silencio.
 */

import type { CaseWithRelations } from '../../case/schemas';
import { TENANTS_CON_BRANDING } from '@/lib/branding-assets';
import type { TenantId } from '@/lib/prisma';

/**
 * Forma de un slug de centro: palabras en minúscula separadas por guiones,
 * **sin dígitos**.
 *
 * La ausencia de dígitos no es capricho: es lo único de la *forma* que separa un
 * slug de un cuid. Un cuid como `'clz9k2f4x0000qwertyuiop12'` es minúsculas y
 * alfanumérico, así que un patrón permisivo tipo `^[a-z][a-z0-9-]*$` **lo
 * acepta** — lo comprobé escribiéndolo así primero y el test lo cazó. Los dos
 * slugs reales (`armonia`, `constructores-paz`) no tienen dígitos.
 *
 * Si algún día un centro necesita un dígito en su slug, esta es la línea a
 * cambiar — y la red que queda es `esSlugDeCentroConocido`, que no depende de
 * la forma.
 */
export const FORMA_DE_SLUG = /^[a-z]+(-[a-z]+)*$/;

/** `true` si el valor **tiene forma** de slug de centro. */
export function tieneFormaDeSlug(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_DE_SLUG.test(valor);
}

/**
 * `true` si el valor es un slug que el mapa de centros **conoce de verdad**.
 *
 * Es el guardián fuerte, y el que no se puede eludir con un fixture: la forma
 * se puede imitar (`'tenant-golden'` parece un slug), pero la pertenencia al
 * mapa no. Si el mapper recibe algo que no está acá, el branding cae al valor
 * por defecto — exactamente el bug que esto viene a cerrar.
 */
export function esSlugDeCentroConocido(valor: unknown): valor is TenantId {
  return (
    tieneFormaDeSlug(valor) &&
    (TENANTS_CON_BRANDING as readonly string[]).includes(valor)
  );
}

/**
 * El slug del centro de un caso.
 *
 * Prefiere la relación `tenant.slug`, que es la fuente correcta y la que
 * `CASE_GENERATION_INCLUDE` trae en todos los caminos de generación.
 *
 * El fallback a `tenantId` existe solo para los fixtures sintéticos que
 * construyen el caso a mano sin la relación. **No es una red de seguridad**: si
 * en producción volviera a llegar un cuid por ahí, el valor no tendría forma de
 * slug y los mapas caerían al valor por defecto otra vez. Lo que impide que eso
 * vuelva a pasar inadvertido es el guardián de forma del test, no este
 * fallback.
 */
export function tenantSlugDelCaso(
  caseData: CaseWithRelations,
): string | undefined {
  const raw = caseData as Record<string, unknown>;

  const tenant = raw.tenant as { slug?: unknown } | null | undefined;
  if (tenant && typeof tenant.slug === 'string') return tenant.slug;

  const tenantId = raw.tenantId;
  return typeof tenantId === 'string' ? tenantId : undefined;
}
