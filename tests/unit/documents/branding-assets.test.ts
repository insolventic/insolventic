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

import fsSync from 'fs';
import { join as pathJoin } from 'path';
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
    '%s resuelve sus tres assets a SU PROPIA carpeta con el mapa real',
    (tenantId) => {
      // Hasta el 2026-10-10 los dos centros compartían `constructores-paz` y
      // este caso solo podía fijar ese estado: con las dos filas iguales, la
      // aserción pasaba igual aunque el sub-mapper perdiera el `tenantId` y
      // cayera al fallback. Por eso existe el caso de arriba con el mapa
      // inyectado. Ahora el mapa real ya distingue, así que esto mide el
      // cableado de verdad y no hace falta inyectar nada para tener dientes.
      const map = mapCaseToPlaceholders(casoDelCentro(tenantId));
      for (const asset of ASSETS_REQUERIDOS) {
        expect(brandingRef(asset, tenantId)).toBe(
          `${BRANDING_REF_PREFIX}${tenantId}/${asset}.png`,
        );
      }
      expect(map.LOGO_ENCABEZADO_SRC).toBe(
        brandingRef('logo-encabezado', tenantId),
      );
    },
  );

  it('REGRESIÓN: un documento de Armonía no pide NINGÚN asset de Constructores', () => {
    const map = mapCaseToPlaceholders(casoDelCentro('armonia'));
    for (const clave of Object.values(CLAVE_POR_ASSET)) {
      expect(map[clave]).toContain('/branding/armonia/');
      expect(map[clave]).not.toContain('constructores-paz');
    }
  });

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

describe('5. el fallback de assets no puede llegar a un documento real', () => {
  /**
   * Desde que cada centro tiene su carpeta, `brandingRef` con un tenant
   * desconocido significa "logo de Constructores" — ya no es inocuo.
   *
   * Lo que impide que eso salga impreso no es `branding-assets.ts` sino el
   * membrete: para un tenant desconocido no emite ninguna clave, y el gate de
   * placeholders sin resolver corta la generación de toda plantilla que use
   * un `{{CENTRO_*}}`.
   *
   * Esa protección depende de un supuesto que conviene no dar por sentado:
   * que TODA plantilla con imagen de branding usa también algún `{{CENTRO_*}}`.
   * Si alguien agregara una plantilla con logo y sin membrete, el fallback
   * volvería a ser capaz de imprimir el logo del otro centro. Esto lo verifica
   * plantilla por plantilla.
   */
  const CLAVES_MEMBRETE_RE = /\{\{\s*(CENTRO_[A-Z_]+|OPERADOR_[A-Z_]+)\s*\}\}/;
  const REF_BRANDING_RE = /\{\{\s*(LOGO_ENCABEZADO_SRC|LOGO_FIRMA_SRC|FIRMA_OPERADOR_SRC)\s*\}\}/;

  function plantillas(dir: string, out: string[] = []): string[] {
    for (const e of fsSync.readdirSync(dir, { withFileTypes: true })) {
      const p = pathJoin(dir, e.name);
      if (e.isDirectory()) plantillas(p, out);
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  }

  const CON_BRANDING = plantillas(TEMPLATES_ROOT)
    .map((f) => ({ rel: f, texto: fsSync.readFileSync(f, 'utf8') }))
    .filter((t) => REF_BRANDING_RE.test(t.texto));

  it('hay plantillas con imagen de branding que recorrer', () => {
    expect(CON_BRANDING.length).toBeGreaterThan(30);
  });

  it('toda plantilla con imagen de branding falla cerrada si no se conoce el centro', () => {
    const sinRed = CON_BRANDING.filter(
      (t) => !CLAVES_MEMBRETE_RE.test(t.texto),
    ).map((t) => t.rel);
    expect(sinRed).toEqual([]);
  });
});
