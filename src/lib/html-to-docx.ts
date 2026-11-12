/**
 * HTML to DOCX conversion utility
 * Uses html-to-docx for server-side Word document generation
 *
 * Mirrors the pattern of html-to-pdf.ts:
 *  - htmlToDocx() for single documents
 *  - batchHtmlToDocx() for multiple documents
 *  - Reuses inlineAssets from html-to-pdf.ts
 */

import { inlineAssets } from './html-to-pdf';
import { logger } from './logger';

/**
 * Lo único que `inlineAssets` deja en un `<img>`: una imagen en base64. El
 * patrón es estricto a propósito —sin entidades, sin espacios, sin `:` en el
 * cuerpo— para que nada que el parser de la librería decodifique distinto
 * pueda pasar por un `data:`.
 */
const DATA_URI_IMAGEN =
  /^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml|x-icon);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Inicio de una etiqueta `<img`, en cualquier capitalización. */
const INICIO_IMG = /<img(?=[\s/>])/gi;

/**
 * Lee los atributos de una etiqueta desde `desde` (justo después de `<img`).
 *
 * Tokeniza como un parser HTML y no con un regex de atributo, porque la
 * diferencia importa: valores sin comillas (`src=http://...`), `>` dentro de
 * un valor entre comillas, `src` repetido o `<img/src=...>`. Devuelve dónde
 * termina la etiqueta y todos los `src` que trae.
 */
function leerAtributosImg(
  html: string,
  desde: number,
): { fin: number; srcs: string[] } {
  const n = html.length;
  const srcs: string[] = [];
  let i = desde;
  while (i < n) {
    while (i < n && /[\s/]/.test(html[i])) i++;
    if (i >= n) break;
    if (html[i] === '>') return { fin: i + 1, srcs };

    let j = i;
    while (j < n && !/[\s/>=]/.test(html[j])) j++;
    const nombre = html.slice(i, j).toLowerCase();
    i = j;
    while (i < n && /\s/.test(html[i])) i++;

    let valor = '';
    if (html[i] === '=') {
      i++;
      while (i < n && /\s/.test(html[i])) i++;
      const comilla = html[i];
      if (comilla === '"' || comilla === "'") {
        const cierre = html.indexOf(comilla, i + 1);
        const finValor = cierre === -1 ? n : cierre;
        valor = html.slice(i + 1, finValor);
        i = finValor + 1;
      } else {
        let k = i;
        while (k < n && !/[\s>]/.test(html[k])) k++;
        valor = html.slice(i, k);
        i = k;
      }
    }
    if (nombre === 'src') srcs.push(valor);
  }
  return { fin: n, srcs };
}

/**
 * Quita todo `<img>` cuyo `src` no sea una imagen ya incrustada en base64.
 *
 * `html-to-docx` resuelve las imágenes por su cuenta: ante un `src` que
 * contenga `http(s)://` en cualquier posición (su regex no está anclado),
 * lo **descarga desde el servidor** con un `node-fetch` empaquetado. Es la
 * única petición que la librería hace: medido con un servidor local, un
 * `<img src="http://...">` produce dos peticiones, mientras que `url()` en CSS,
 * `<svg><image>` y las rutas locales no producen ninguna ni leen disco.
 *
 * Chromium ya no tiene red (N-A2-02), pero la ruta DOCX no pasa por Chromium.
 * `inlineAssets` incrusta los `<img>` de las plantillas y quita los que
 * rechaza, pero solo ve los `src` entre comillas: un `src=http://...` sin
 * comillas le pasa de largo y llega a la librería. Este filtro es la barrera
 * de esa ruta, y es lista blanca: lo que no es `data:image/...;base64,...`
 * se quita, con un `src` repetido o sin cerrar incluidos.
 */
export function soloImagenesIncrustadas(html: string): string {
  let salida = '';
  let pos = 0;
  let quitadas = 0;
  const motivos: string[] = [];

  INICIO_IMG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INICIO_IMG.exec(html)) !== null) {
    const inicio = m.index;
    const { fin, srcs } = leerAtributosImg(html, inicio + m[0].length);
    const permitida =
      srcs.length === 0 || (srcs.length === 1 && DATA_URI_IMAGEN.test(srcs[0]));
    if (!permitida) {
      salida += html.slice(pos, inicio);
      pos = fin;
      quitadas++;
      if (motivos.length < 5) motivos.push(srcs.join(' | ').slice(0, 120));
    }
    INICIO_IMG.lastIndex = Math.max(fin, inicio + 1);
  }
  salida += html.slice(pos);

  if (quitadas > 0) {
    // `error`: ninguna plantilla produce esto después de `inlineAssets`.
    logger.error(
      'Se quitaron imágenes no incrustadas antes de generar el DOCX',
      undefined,
      { action: 'docx.imagenes', quitadas, srcs: motivos },
    );
  }
  return salida;
}

interface DocxOptions {
  /** Page margins in millimeters */
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
}

const defaultDocxOptions: DocxOptions = {
  margin: {
    top: 20,
    bottom: 20,
    left: 15,
    right: 15,
  },
  orientation: 'portrait',
};

/**
 * Convert HTML string to DOCX buffer (single document).
 * If assetsBaseDir is provided, CSS and images are inlined before conversion.
 */
export async function htmlToDocx(
  html: string,
  options: DocxOptions = {},
  assetsBaseDir?: string,
  docDir?: string,
): Promise<Buffer> {
  const mergedOptions = { ...defaultDocxOptions, ...options };

  try {
    // Inline assets if base directory provided
    const inlinedHtml = assetsBaseDir
      ? await inlineAssets(html, assetsBaseDir, docDir)
      : html;
    // Siempre, con o sin assetsBaseDir: ver `soloImagenesIncrustadas`.
    const processedHtml = soloImagenesIncrustadas(inlinedHtml);

    // html-to-docx uses a default export
    const HTMLtoDOCX = (await import('html-to-docx')).default;

    const docxBuffer = await HTMLtoDOCX(processedHtml, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      header: false,
      pageNumber: false,
      orientation: mergedOptions.orientation,
      margins: mergedOptions.margin
        ? {
            top: (mergedOptions.margin.top ?? 20) * 56.7, // mm to twips (approx)
            bottom: (mergedOptions.margin.bottom ?? 20) * 56.7,
            left: (mergedOptions.margin.left ?? 15) * 56.7,
            right: (mergedOptions.margin.right ?? 15) * 56.7,
          }
        : undefined,
    });

    return Buffer.from(docxBuffer);
  } catch (error) {
    console.error('Error generating DOCX:', error);
    throw new Error(
      `Error al generar DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Convert multiple HTML documents to DOCX buffers.
 * If assetsBaseDir is provided, CSS and images are inlined before conversion.
 */
export async function batchHtmlToDocx(
  documents: Array<{
    html: string;
    filename: string;
    /** Per-document override for root-relative asset refs */
    assetsBaseDir?: string;
    /** Per-document dir for relative ("./", "../") asset refs */
    docDir?: string;
  }>,
  options: DocxOptions = {},
  assetsBaseDir?: string,
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const results: Array<{ filename: string; buffer: Buffer }> = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    try {
      console.log(
        `[batchHtmlToDocx] Processing ${i + 1}/${documents.length}: ${doc.filename}`,
      );

      const buffer = await htmlToDocx(
        doc.html,
        options,
        doc.assetsBaseDir || assetsBaseDir,
        doc.docDir,
      );

      results.push({
        filename: doc.filename.replace(/\.html$/, '.docx'),
        buffer,
      });
    } catch (error) {
      console.error(
        `[batchHtmlToDocx] FAILED for ${doc.filename} (${i + 1}/${documents.length}):`,
        error instanceof Error ? error.message : error,
      );
      // Continue with other documents - don't break the batch
    }
  }

  return results;
}
