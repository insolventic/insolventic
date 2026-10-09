/**
 * El mapper elige por el SLUG del centro, no por `Case.tenantId`.
 *
 * EL BUG QUE ESTE TEST FIJA. `branding-assets.ts` keyea su mapa por slug
 * (`'armonia'` | `'constructores-paz'`), pero `Case.tenantId` guarda el
 * `Tenant.id`, que es un **cuid**: el JWT lleva el slug, `authenticateUser()`
 * resuelve el tenant por slug y devuelve `tenant.id`, y eso es lo que
 * `createCase` persiste (la FK `Case_tenantId_fkey` referencia `Tenant("id")`,
 * así que no puede ser otra cosa). Resultado: el mapa recibía un cuid, nunca
 * encontraba la fila y **siempre** caía al valor por defecto. El branding por
 * centro nunca eligió por centro.
 *
 * POR QUÉ NO LO ATRAPÓ NADA. Los fixtures le pasaban el slug a mano
 * (`tenantId: 'constructores-paz'`), un valor que producción nunca produce; y
 * el test de `tests/db` comparaba contra `brandingRef(asset, stored.tenantId)`,
 * o sea contra el mismo valor equivocado: pasaba por construcción.
 *
 * De ahí el §3 de este archivo: un **guardián de forma**. No alcanza con que el
 * valor "funcione" contra un fixture; tiene que *parecer* un slug. Un cuid no
 * pasa, así que el próximo fixture sintético falla en vez de pasar en silencio.
 */

import { mapBrandingAssets } from '@/features/document/placeholders/branding';
import {
  esSlugDeCentroConocido,
  tenantSlugDelCaso,
  tieneFormaDeSlug,
  FORMA_DE_SLUG,
} from '@/features/document/placeholders/tenant-slug';
import { CASE_GENERATION_INCLUDE } from '@/features/document/persistence';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Un cuid como los que genera Prisma para `Tenant.id`. */
const CUID = 'clz9k2f4x0000qwertyuiop12';

/**
 * Caso con la forma REAL de producción: `tenantId` es el cuid del tenant y el
 * slug viaja en la relación `tenant`, que es lo que trae
 * `CASE_GENERATION_INCLUDE`.
 */
function casoComoEnProduccion(slug: string): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return {
    ...base,
    tenantId: CUID,
    tenant: { slug },
  } as unknown as CaseWithRelations;
}

describe('1. el slug sale de la relación tenant, no de Case.tenantId', () => {
  it('con la forma de producción devuelve el slug, no el cuid', () => {
    expect(tenantSlugDelCaso(casoComoEnProduccion('armonia'))).toBe('armonia');
    expect(tenantSlugDelCaso(casoComoEnProduccion('constructores-paz'))).toBe(
      'constructores-paz',
    );
  });

  it('el include de generación pide el slug (sin esto, producción manda un cuid)', () => {
    const include = CASE_GENERATION_INCLUDE as unknown as {
      tenant?: { select?: { slug?: boolean } };
    };
    expect(include.tenant?.select?.slug).toBe(true);
  });

  it('sin la relación cae a tenantId, solo para fixtures sintéticos', () => {
    const base = SCENARIOS[
      'insolvencia-completa'
    ].build() as unknown as CaseWithRelations;
    const sinRelacion = { ...base, tenantId: 'constructores-paz' } as Record<
      string,
      unknown
    >;
    delete sinRelacion.tenant;
    expect(tenantSlugDelCaso(sinRelacion as unknown as CaseWithRelations)).toBe(
      'constructores-paz',
    );
  });
});

describe('2. REGRESIÓN: la carpeta la decide el slug, no el cuid', () => {
  /**
   * Mapa inyectado con una carpeta por centro. Es lo que hace la aserción
   * capaz de fallar: con el mapa real los dos centros comparten carpeta y el
   * valor sería el mismo tanto si se eligió por slug como si se cayó al
   * fallback.
   */
  const CARPETAS = {
    'constructores-paz': 'carpeta-de-constructores',
    armonia: 'carpeta-de-armonia',
  };

  it.each(['armonia', 'constructores-paz'])(
    '%s: resuelve por su carpeta aunque tenantId sea un cuid',
    (slug) => {
      const map = mapBrandingAssets(casoComoEnProduccion(slug), CARPETAS);
      expect(map.LOGO_ENCABEZADO_SRC).toBe(
        `/branding/${CARPETAS[slug as keyof typeof CARPETAS]}/logo-encabezado.png`,
      );
    },
  );

  it('un caso de Armonía NO sale con la carpeta de Constructores', () => {
    // Esta es la aserción que estaba rota en producción: con el cuid, Armonía
    // caía al default y recibía los assets del otro centro.
    const map = mapBrandingAssets(casoComoEnProduccion('armonia'), CARPETAS);
    expect(map.LOGO_ENCABEZADO_SRC).not.toContain('constructores');
    expect(map.LOGO_FIRMA_SRC).not.toContain('constructores');
    expect(map.FIRMA_OPERADOR_SRC).not.toContain('constructores');
  });
});

describe('3. GUARDIÁN DE FORMA: el valor que usa el mapper parece un slug', () => {
  // La trampa en la que ya caímos una vez: un fixture le pasa al mapper un
  // identificador sintético que "funciona" porque el test compara contra ese
  // mismo valor. Esto corta esa salida: el valor tiene que parecer un slug.

  it('un cuid NO es un slug de centro', () => {
    expect(esSlugDeCentroConocido(CUID)).toBe(false);
    expect(FORMA_DE_SLUG.test(CUID)).toBe(false);
  });

  it.each([
    'tenant-golden',
    'tenant-test-id',
    'e2edocs-m2k3j4',
    'clz9k2f4x0000qwertyuiop12',
    'Constructores-Paz',
    'constructores_paz',
    '',
  ])('rechaza el identificador sintético %p', (valor) => {
    // `tenant-golden` y `e2edocs-m2k3j4` SÍ tienen forma de slug: la forma sola
    // no los distingue de uno real. Lo que los rechaza es la pertenencia al
    // mapa, que es por qué el guardián fuerte no es la regex.
    expect(esSlugDeCentroConocido(valor)).toBe(false);
  });

  it('la forma sola NO alcanza, y por eso el guardián fuerte es la pertenencia', () => {
    // Documentado porque es el error que cometí al escribir esto: con un
    // patrón permisivo (`^[a-z][a-z0-9-]*$`) un cuid pasa, porque es
    // minúsculas y alfanumérico. Y aun con el patrón sin dígitos, un
    // identificador inventado como `tenant-golden` lo pasa igual.
    expect(tieneFormaDeSlug('tenant-golden')).toBe(true);
    expect(esSlugDeCentroConocido('tenant-golden')).toBe(false);
  });

  it.each(['armonia', 'constructores-paz'])(
    '%s sí es un slug de centro válido',
    (slug) => {
      expect(esSlugDeCentroConocido(slug)).toBe(true);
    },
  );

  it('el slug que el mapper usa con la forma de producción pasa el filtro', () => {
    for (const slug of ['armonia', 'constructores-paz']) {
      const usado = tenantSlugDelCaso(casoComoEnProduccion(slug));
      expect(esSlugDeCentroConocido(usado)).toBe(true);
      expect(usado).toMatch(FORMA_DE_SLUG);
      // Y explícitamente: NO es el cuid que está en Case.tenantId.
      expect(usado).not.toBe(CUID);
    }
  });
});
