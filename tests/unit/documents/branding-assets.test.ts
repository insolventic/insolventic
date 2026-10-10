/**
 * Branding por centro: los assets de las plantillas se eligen por tenant.
 *
 * ANTES: las 63 plantillas tenían la ruta del logo de Constructores de Paz
 * escrita a mano en el HTML, en tres variantes según su profundidad de carpeta.
 * `getTemplateAssetsBaseDir()` resuelve por TIPO DE CASO, nunca por centro, así
 * que todo documento del tenant `armonia` salía con el logo y la firma del otro
 * centro. Hallazgo §1 de `docs/BRANDING_POR_CENTRO_2026-09-30.md`.
 *
 * Los dos centros comparten los assets de Constructores HOY, a propósito:
 * Armonía todavía no entregó los suyos. Eso no es lo que estos tests fijan —
 * fijan que la ELECCIÓN pase por el mapa de `branding-assets.ts` y que los
 * archivos que el mapa promete existan de verdad en el disco.
 *
 * El test guardián (§3) cubre un agujero real: cuando una imagen no existe,
 * `inlineAssets` solo escribe un `console.warn` y el documento se genera igual,
 * con la imagen rota, y se sube a Drive así. Sin este test, un asset mal
 * nombrado en la carpeta de un centro se descubre en un PDF ya radicado.
 */

import { promises as fs } from 'fs';
import path from 'path';

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { mapBrandingAssets } from '@/features/document/placeholders/branding';
import {
  ASSETS_REQUERIDOS,
  BRANDING_REF_PREFIX,
  TENANTS_CON_BRANDING,
  brandingRef,
} from '@/lib/branding-assets';
import { inlineAssets } from '@/lib/html-to-pdf';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/**
 * Caso de un centro con la forma de **producción**: `tenantId` es el cuid del
 * `Tenant` y el slug viaja en la relación `tenant`.
 *
 * Verificado contra la base real el 2026-10-09: los `Tenant.id` son cuids y
 * **no** coinciden con el slug. Por eso overridear `tenantId` con un slug —como
 * hacía este test— no representaba nada que producción produzca, y el branding
 * por centro podía estar roto con estos tests en verde.
 */
function casoDelCentro(slug: string): CaseWithRelations {
  return caso({ tenantId: 'cmluzsnr0000qwertyuiop123', tenant: { slug } });
}

/** Caso base del golden, con overrides puntuales. */
function caso(overrides: Record<string, unknown> = {}): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return { ...base, ...overrides } as CaseWithRelations;
}

/** `templates/`, la raíz compartida contra la que resuelve `/branding/...`. */
const TEMPLATES_ROOT = path.join(process.cwd(), 'templates');

describe('1. el mapper produce los tres placeholders de branding', () => {
  it('las tres claves existen y apuntan a /branding/', () => {
    const map = mapCaseToPlaceholders(casoDelCentro('constructores-paz'));

    for (const clave of [
      'LOGO_ENCABEZADO_SRC',
      'LOGO_FIRMA_SRC',
      'FIRMA_OPERADOR_SRC',
    ]) {
      expect(typeof map[clave]).toBe('string');
      expect(map[clave].startsWith(BRANDING_REF_PREFIX)).toBe(true);
    }
  });

  it('el escapado del punto de fusión no toca estas rutas (sin allowlist)', () => {
    // Si el valor saliera escapado (p. ej. `&#39;`), el `src` del <img>
    // apuntaría a una ruta inexistente y la imagen saldría rota.
    const map = mapCaseToPlaceholders(casoDelCentro('constructores-paz'));
    expect(map.LOGO_ENCABEZADO_SRC).toBe(
      '/branding/constructores-paz/logo-encabezado.png',
    );
  });
});

describe('2. la elección pasa por el mapa de tenants, no por el fallback', () => {
  /**
   * Mapa inyectado con UNA CARPETA DISTINTA POR TENANT.
   *
   * Es lo que le da dientes a este bloque. Con el mapa real los dos centros
   * comparten `constructores-paz`, igual que el fallback de tenant desconocido:
   * con esos valores, `expect(map.X).toBe(brandingRef('x', tenantId))` se cumple
   * incluso si el sub-mapper pierde el `tenantId` por completo y cae al
   * fallback — la aserción no distingue los dos casos. Verificado: ignorando
   * `caseData` en `mapBrandingAssets`, los 676 tests de documentos seguían
   * pasando, golden master incluido.
   *
   * Con una carpeta por tenant, perder el `tenantId` devuelve la carpeta del
   * fallback y el test falla.
   */
  const CARPETAS_DISTINTAS: Record<string, string> = {
    'constructores-paz': 'carpeta-de-constructores',
    armonia: 'carpeta-de-armonia',
  };

  /** Qué placeholder emite cada asset. */
  const CLAVE_POR_ASSET: Record<string, string> = {
    'logo-encabezado': 'LOGO_ENCABEZADO_SRC',
    'logo-firma': 'LOGO_FIRMA_SRC',
    'firma-operador': 'FIRMA_OPERADOR_SRC',
  };

  it.each(TENANTS_CON_BRANDING)(
    '%s: el tenant del expediente es el que elige la carpeta',
    (tenantId) => {
      const brandingDelCaso = mapBrandingAssets(
        casoDelCentro(tenantId),
        CARPETAS_DISTINTAS,
      );

      for (const asset of ASSETS_REQUERIDOS) {
        expect(brandingDelCaso[CLAVE_POR_ASSET[asset]]).toBe(
          `${BRANDING_REF_PREFIX}${CARPETAS_DISTINTAS[tenantId]}/${asset}.png`,
        );
      }

      // Y no es la carpeta del OTRO centro ni la del fallback.
      expect(brandingDelCaso.LOGO_ENCABEZADO_SRC).not.toContain(
        'constructores-paz',
      );
    },
  );

  it.each(TENANTS_CON_BRANDING)(
    '%s resuelve sus tres assets por el mapa real (hoy compartido)',
    (tenantId) => {
      const map = mapCaseToPlaceholders(casoDelCentro(tenantId));
      // Con el mapa real los dos centros comparten carpeta a propósito: esto
      // fija el estado actual, no el cableado (de eso se encarga el caso de
      // arriba, con el mapa inyectado).
      for (const asset of ASSETS_REQUERIDOS) {
        expect(brandingRef(asset, tenantId)).toBe(
          `${BRANDING_REF_PREFIX}constructores-paz/${asset}.png`,
        );
      }
      expect(map.LOGO_ENCABEZADO_SRC).toBe(
        brandingRef('logo-encabezado', tenantId),
      );
    },
  );

  it('un tenant desconocido cae a Constructores en vez de romper la generación', () => {
    // Fixtures sintéticos y expedientes sin la columna: el documento sale con
    // el branding de siempre, no con un `src` vacío que daría imagen rota.
    expect(brandingRef('logo-encabezado', undefined)).toBe(
      '/branding/constructores-paz/logo-encabezado.png',
    );
    expect(brandingRef('logo-encabezado', 'tenant-que-no-existe')).toBe(
      '/branding/constructores-paz/logo-encabezado.png',
    );
  });
});

describe('3. GUARDIÁN: todo asset que el mapa promete existe en el disco', () => {
  // Esto es lo que hoy no cubre nada: si falta el archivo, inlineAssets tira
  // un console.warn y el PDF se genera con la imagen rota.
  const casos = TENANTS_CON_BRANDING.flatMap((tenantId) =>
    ASSETS_REQUERIDOS.map(
      (asset) => [tenantId, asset, brandingRef(asset, tenantId)] as const,
    ),
  );

  it.each(casos)('%s / %s → %s existe', async (_tenantId, _asset, ref) => {
    // El ref es root-relative (`/branding/...`) y resuelve contra
    // `templates/`, igual que lo hace `inlineAssets`.
    const absoluto = path.join(TEMPLATES_ROOT, ref.replace(/^\//, ''));
    await expect(fs.access(absoluto)).resolves.toBeUndefined();
  });
});

describe('4. inlineAssets resuelve /branding/ a cualquier profundidad', () => {
  // El punto del cambio en el pipeline: las plantillas viven a 1, 2 y 3 niveles
  // de profundidad y antes cada una traía su propia variante de `../`. Un ref
  // compartido tiene que resolver igual desde todas.
  const profundidades: Array<[string, string]> = [
    ['raíz del tipo de caso', path.join(process.cwd(), 'templates/insolvency')],
    [
      'un nivel',
      path.join(process.cwd(), 'templates/conciliation/Actas de Conciliacion'),
    ],
    [
      'dos niveles',
      path.join(
        process.cwd(),
        'templates/insolvency/Tipos De Fracaso/Fracaso por incumplimiento',
      ),
    ],
  ];

  it.each(profundidades)(
    'desde %s, el <img> queda inlineado como data URI',
    async (_nombre, docDir) => {
      const html = `<img src="${brandingRef('logo-encabezado', 'constructores-paz')}" class="logo">`;
      const salida = await inlineAssets(
        html,
        path.join(process.cwd(), 'templates/insolvency'),
        docDir,
      );

      expect(salida).toContain('data:image/png;base64,');
      // Si no hubiera resuelto, el src quedaría con la ruta sin tocar.
      expect(salida).not.toContain('/branding/');
    },
  );
});
