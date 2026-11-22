/**
 * El logo del encabezado tiene tope de alto en TODAS las plantillas.
 *
 * Las hojas fijaban solo el ancho (`max-width: 380px; width: 100%`). Con el
 * logo apaisado de Constructores de Paz eso daba ~85 px de alto, pero el de
 * Armonía es cuadrado y salía en 380 x 380 px: más de media hoja y una página
 * de más. Además, Restablecimiento de Servicios no recibía la hoja base
 * (`inlineAssets` resuelve un solo nivel de `@import`) y el logo se imprimía a
 * tamaño natural.
 *
 * El test arma el HTML de cada plantilla del catálogo como lo hace el
 * generador (`inlineAssets`, con el mismo `assetsBaseDir` y `docDir`) y exige
 * que el CSS que de verdad llega al documento tenga, para la clase del logo,
 * la regla de membrete: alto máximo y ancho automático. Una plantilla nueva, o
 * una hoja que deje de recibir la base, falla acá y no en el PDF del cliente.
 */

import fs from 'fs';
import path from 'path';

import { inlineAssets } from '@/lib/html-to-pdf';
import {
  ALL_TEMPLATES,
  getTemplateAssetsBaseDir,
  getTemplatePath,
} from '@/features/document/templates-config';

const RAIZ = path.resolve(__dirname, '../../..');
const ALTO_MAXIMO_PX = 100;

/** Plantillas del catálogo que llevan el logo del encabezado, sin repetir. */
const conLogo = [
  ...new Map(
    ALL_TEMPLATES.map((t) => [getTemplatePath(t), t] as const),
  ).values(),
].filter((t) =>
  fs
    .readFileSync(path.join(RAIZ, getTemplatePath(t)), 'utf8')
    .includes('{{LOGO_ENCABEZADO_SRC}}'),
);

/** Clase del contenedor y del `<img>` del logo del encabezado. */
function clasesDelLogo(html: string): { padre: string; img: string } {
  const m = html.match(
    /class="([\w-]+)"[^>]*>\s*<img\s+src="\{\{LOGO_ENCABEZADO_SRC\}\}"[^>]*?class="([\w-]+)"/,
  );
  if (!m) throw new Error('No se encontró el logo del encabezado');
  return { padre: m[1], img: m[2] };
}

/** Bloques `selector { cuerpo }` de nivel superior (fuera de @media). */
function reglasGlobales(
  css: string,
): Array<{ selector: string; cuerpo: string }> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas: Array<{ selector: string; cuerpo: string }> = [];
  let profundidad = 0;
  let inicio = 0;
  let selector = '';
  for (let i = 0; i < sinComentarios.length; i++) {
    const c = sinComentarios[i];
    if (c === '{') {
      if (profundidad === 0) {
        selector = sinComentarios.slice(inicio, i).trim();
        inicio = i + 1;
      }
      profundidad++;
    } else if (c === '}') {
      profundidad--;
      if (profundidad === 0) {
        if (!selector.startsWith('@')) {
          reglas.push({ selector, cuerpo: sinComentarios.slice(inicio, i) });
        }
        inicio = i + 1;
      }
    } else if (c === ';' && profundidad === 0) {
      inicio = i + 1;
    }
  }
  return reglas;
}

describe('membrete — el logo del encabezado tiene tope de alto', () => {
  it('hay plantillas con logo en el catálogo (sanidad)', () => {
    expect(conLogo.length).toBeGreaterThan(40);
  });

  it.each(conLogo.map((t) => [getTemplatePath(t), t] as const))(
    '%s',
    async (_ruta, template) => {
      const html = fs.readFileSync(
        path.join(RAIZ, getTemplatePath(template)),
        'utf8',
      );
      const { padre, img } = clasesDelLogo(html);

      const inlined = await inlineAssets(
        html,
        path.join(RAIZ, getTemplateAssetsBaseDir(template)),
        path.dirname(path.join(RAIZ, getTemplatePath(template))),
      );
      const css = [...inlined.matchAll(/<style>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1])
        .join('\n');

      const selectorBuscado = `.${padre} .${img}`;
      const reglas = reglasGlobales(css).filter((r) =>
        r.selector
          .split(',')
          .map((s) => s.trim().replace(/\s+/g, ' '))
          .includes(selectorBuscado),
      );

      // La última regla con alto máximo gana: debe existir y ser el tope.
      const conAlto = reglas.filter((r) => /max-height\s*:/.test(r.cuerpo));
      expect(conAlto.length).toBeGreaterThan(0);
      const ultima = conAlto[conAlto.length - 1].cuerpo;
      expect(ultima).toMatch(
        new RegExp(`max-height\\s*:\\s*${ALTO_MAXIMO_PX}px`),
      );
      expect(ultima).toMatch(/width\s*:\s*auto/);
    },
  );
});
