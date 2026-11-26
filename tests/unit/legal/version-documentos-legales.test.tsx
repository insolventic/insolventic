/**
 * El hash de `src/features/legal/documentos.ts` tiene que ser el del texto que
 * hoy muestran /terminos y /privacidad (N-G-07).
 *
 * La aceptación guarda versión y hash: si alguien cambia el texto sin subir la
 * versión, los usuarios que aceptaron el texto anterior figurarían aceptando el
 * nuevo. Este test lo impide: cualquier cambio en el cuerpo de la página cambia
 * el hash y obliga a tocar `documentos.ts`, donde está la instrucción de subir
 * también la versión.
 *
 * Se hashea el texto del `<article>` (el cuerpo), normalizado: sin etiquetas y
 * con los espacios colapsados, para que reindentar el JSX no cuente como un
 * cambio de texto.
 */

import { createHash } from 'crypto';

import { renderToStaticMarkup } from 'react-dom/server';

import TerminosPage from '@/app/terminos/page';
import PrivacidadPage from '@/app/privacidad/page';
import {
  PRIVACIDAD,
  TERMINOS,
  type VersionDocumentoLegal,
} from '@/features/legal/documentos';

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function textoNormalizadoDelCuerpo(html: string): string {
  const cuerpo = html.match(/<article[^>]*>([\s\S]*)<\/article>/);
  if (!cuerpo) throw new Error('La página no tiene <article>');
  return cuerpo[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim();
}

function hashDe(Pagina: () => React.ReactElement): string {
  const texto = textoNormalizadoDelCuerpo(renderToStaticMarkup(<Pagina />));
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

describe.each<[string, () => React.ReactElement, VersionDocumentoLegal]>([
  ['/terminos', TerminosPage, TERMINOS],
  ['/privacidad', PrivacidadPage, PRIVACIDAD],
])('%s', (_ruta, Pagina, vigente) => {
  it('el hash declarado es el del texto que muestra la página', () => {
    const actual = hashDe(Pagina);
    if (actual !== vigente.sha256) {
      throw new Error(
        `Cambió el texto de ${vigente.ruta} y no su versión. En ` +
          `src/features/legal/documentos.ts subí \`version\` a la fecha de ` +
          `hoy y poné sha256: '${actual}'. Todos los usuarios van a tener ` +
          `que volver a aceptar.`,
      );
    }
  });

  it('la página muestra la versión vigente como "Última actualización"', () => {
    const html = renderToStaticMarkup(<Pagina />);
    expect(html).toContain(`Última actualización: ${vigente.version}`);
  });
});

describe('textoNormalizadoDelCuerpo', () => {
  it('reindentar el JSX no cambia el texto', () => {
    const a = '<article><p>Hola\n      mundo</p></article>';
    const b = '<article>  <p>Hola mundo</p>\n</article>';
    expect(textoNormalizadoDelCuerpo(a)).toBe(textoNormalizadoDelCuerpo(b));
  });

  it('una palabra distinta sí lo cambia', () => {
    expect(
      textoNormalizadoDelCuerpo('<article><p>Hola mundo</p></article>'),
    ).not.toBe(
      textoNormalizadoDelCuerpo('<article><p>Hola mundos</p></article>'),
    );
  });
});
