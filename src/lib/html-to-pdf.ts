/**
 * HTML to PDF conversion utility
 * Uses Puppeteer with Chromium for server-side PDF generation
 *
 * FIX 2: Detects full HTML documents and skips double wrapping
 * FIX 3: batchHtmlToPdf reuses a single browser for all documents
 * FIX 4: inlineAssets resolves CSS/images from local filesystem
 */

import puppeteer from 'puppeteer-core';

import { logger } from './logger';
import { BRANDING_REF_PREFIX } from './branding-assets';

// Dynamic import for serverless environments
let chromium: typeof import('@sparticuz/chromium') | null = null;

async function getChromium() {
  if (!chromium) {
    chromium = await import('@sparticuz/chromium');
  }
  return chromium;
}

interface PDFOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

const defaultOptions: PDFOptions = {
  format: 'A4',
  margin: {
    top: '20mm',
    bottom: '20mm',
    left: '15mm',
    right: '15mm',
  },
  printBackground: true,
  displayHeaderFooter: false,
};

/**
 * Get executable path for Chromium based on environment
 */
async function getExecutablePath(): Promise<string> {
  // In Vercel/AWS Lambda serverless environment
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromiumModule = await getChromium();
    return await chromiumModule.default.executablePath();
  }

  // Local development: CHROME_PATH tiene prioridad sobre las rutas habituales
  // (Chrome/Edge/Chromium en otra ubicación, WSL, CI…). Si está definida pero no
  // existe se falla diciendo cuál: caer en silencio a otra ruta ocultaría el
  // error de configuración. En serverless (arriba) no se lee.
  const customPath = process.env.CHROME_PATH?.trim();
  if (customPath) {
    const fs = await import('fs');
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    throw new Error(
      `CHROME_PATH apunta a un archivo que no existe: ${customPath}`,
    );
  }

  // Local development - try common paths
  const possiblePaths = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const chromePath of possiblePaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'No se encontro Chromium. Instale Google Chrome o defina CHROME_PATH con la ruta al ejecutable.',
  );
}

/**
 * Get browser launch arguments based on environment
 */
async function getBrowserArgs(): Promise<string[]> {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromiumModule = await getChromium();
    return chromiumModule.default.args;
  }

  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ];
}

/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
  };
  return mimeTypes[ext || ''] || 'image/png';
}

/**
 * Check if HTML string already has a full document structure
 */
function isFullHtmlDocument(html: string): boolean {
  const trimmed = html.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

/**
 * Inline external CSS files and images into the HTML.
 * Replaces <link rel="stylesheet" href="..."> with <style> blocks
 * and <img src="..."> with base64 data URIs.
 *
 * Solo lee archivos bajo `templates/` (ver el bloque de confinamiento abajo).
 * Un ref que resuelve fuera, con esquema (`file:`, `http:`…) o por un symlink
 * que escapa no se lee: la etiqueta se quita y el rechazo se registra como
 * error. Los `data:` se dejan como están.
 *
 * @param html - The HTML content
 * @param assetsBaseDir - Absolute path used to resolve root-relative refs ("/CSS/...")
 * @param docDir - Absolute path of the source HTML's own directory, used to
 *   resolve relative refs ("./CSS/...", "../CSS/..."). Defaults to assetsBaseDir.
 */
export async function inlineAssets(
  html: string,
  assetsBaseDir: string,
  docDir?: string,
): Promise<string> {
  const fs = await import('fs');
  const pathModule = await import('path');
  const relativeBase = docDir || assetsBaseDir;

  // CONFINAMIENTO (N-A2-01). Todo asset legítimo vive bajo `templates/`
  // (incluido `templates/branding/`), y nada fuera de ahí se lee. Antes un
  // `<img src="../../.env">` que llegara al HTML —por un campo de usuario sin
  // escapar— se leía del disco y se incrustaba en el PDF en base64.
  //
  // No se rechaza `..` a secas: las plantillas de conciliación usan
  // `../CSS/...` legítimamente. Lo que se exige es que la ruta RESUELTA quede
  // dentro de la raíz, primero en forma léxica y después con `realpath`, para
  // que un symlink dentro de `templates/` no apunte afuera.
  const raizPlantillas = pathModule.resolve(process.cwd(), 'templates');
  let raizReal: string | null = null;
  const raizPlantillasReal = (): string => {
    if (raizReal === null) {
      try {
        raizReal = fs.realpathSync(raizPlantillas);
      } catch {
        // Sin `templates/` en disco no hay nada que se pueda leer.
        raizReal = raizPlantillas;
      }
    }
    return raizReal;
  };

  const estaDentro = (raiz: string, destino: string): boolean => {
    const rel = pathModule.relative(raiz, destino);
    return (
      rel !== '' &&
      !pathModule.isAbsolute(rel) &&
      rel.split(pathModule.sep)[0] !== '..'
    );
  };

  /**
   * Resuelve un ref con `resolver` y decide si se puede leer.
   *
   * - `permitido` con `existe: false`: está dentro de la raíz pero no hay
   *   archivo; se deja el warn de siempre ("no se encontró").
   * - `rechazado`: no se lee ni se incrusta; el llamador quita la etiqueta y
   *   lo registra como error.
   */
  type Resolucion =
    | { tipo: 'permitido'; ruta: string; existe: boolean }
    | { tipo: 'rechazado'; motivo: string };

  const resolverConfinado = (
    ref: string,
    resolver: (ref: string) => string,
  ): Resolucion => {
    // `\` y NUL no aparecen en ninguna plantilla; con `\` entran las rutas de
    // Windows (`C:\...`, `\\servidor\...`), que no tienen nada que hacer acá.
    if (ref.includes('\0') || ref.includes('\\')) {
      return { tipo: 'rechazado', motivo: 'caracteres no permitidos' };
    }
    // `file:`, `http:`, `javascript:`… y `//host/...` (protocolo relativo).
    // Los `data:` no llegan hasta acá: el llamador los deja pasar antes.
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
      return { tipo: 'rechazado', motivo: 'esquema no permitido' };
    }

    const ruta = pathModule.resolve(resolver(ref));
    if (!estaDentro(raizPlantillas, ruta)) {
      return { tipo: 'rechazado', motivo: 'ruta fuera de templates/' };
    }
    if (!fs.existsSync(ruta)) {
      return { tipo: 'permitido', ruta, existe: false };
    }

    let real: string;
    try {
      real = fs.realpathSync(ruta);
    } catch {
      return { tipo: 'rechazado', motivo: 'no se pudo resolver la ruta real' };
    }
    if (!estaDentro(raizPlantillasReal(), real)) {
      return {
        tipo: 'rechazado',
        motivo: 'enlace simbólico fuera de templates/',
      };
    }
    return { tipo: 'permitido', ruta: real, existe: true };
  };

  const registrarRechazo = (
    tipoAsset: 'css' | 'css-import' | 'imagen',
    ref: string,
    motivo: string,
  ) => {
    // `error` y no `warn`: una plantilla del repo nunca produce esto, así que
    // un rechazo es HTML que no salió de una plantilla —un intento, o un
    // escapado roto— y tiene que llegar a Sentry.
    logger.error(
      'Se rechazó un asset del documento: no se lee ni se incrusta',
      undefined,
      {
        action: 'pdf.inline-assets',
        tipoAsset,
        motivo,
        ref: ref.slice(0, 200),
      },
    );
  };

  const resolveAssetPath = (ref: string): string => {
    // `/branding/...` es el único prefijo compartido por los tres tipos de
    // caso: los assets por centro viven en `templates/branding/{centro}/`, un
    // nivel POR ENCIMA de cada `assetsBaseDir` (templates/insolvency,
    // templates/conciliation, templates/support-agreements). Sin esta rama
    // habría que triplicar cada logo y cada firma, una copia por tipo de caso,
    // que es exactamente la duplicación que el branding por centro viene a
    // eliminar. El resto de los refs root-relative (`/CSS/...`, `/img/...`)
    // siguen resolviendo contra el directorio del tipo de caso, sin cambios.
    if (ref.startsWith(BRANDING_REF_PREFIX)) {
      return pathModule.join(pathModule.dirname(assetsBaseDir), ref);
    }
    return ref.startsWith('/')
      ? pathModule.join(assetsBaseDir, ref)
      : pathModule.resolve(relativeBase, ref);
  };

  let result = html;

  // 1. Inline CSS: Replace <link rel="stylesheet" href="..."> with <style>...</style>
  const linkRegex =
    /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  const linkMatches = [...result.matchAll(linkRegex)];

  // Also match href before rel
  const linkRegex2 =
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi;
  const linkMatches2 = [...result.matchAll(linkRegex2)];

  const allLinkMatches = [...linkMatches, ...linkMatches2];

  for (const match of allLinkMatches) {
    const fullTag = match[0];
    const href = match[1];

    // Root-relative ("/CSS/...") resolves against assetsBaseDir;
    // relative ("./CSS/...", "../CSS/...") against the document's own dir.
    const resolucionCss = resolverConfinado(href, resolveAssetPath);
    if (resolucionCss.tipo === 'rechazado') {
      registrarRechazo('css', href, resolucionCss.motivo);
      result = result.replace(fullTag, '');
      continue;
    }
    const cssPath = resolucionCss.ruta;

    try {
      if (resolucionCss.existe) {
        let cssContent = fs.readFileSync(cssPath, 'utf-8');
        // Resolve @import statements within CSS files
        const cssDir = pathModule.dirname(cssPath);
        const importRegex = /@import\s+url\(["']?([^"')]+)["']?\)\s*;/gi;
        const importMatches = [...cssContent.matchAll(importRegex)];
        for (const importMatch of importMatches) {
          const importUrl = importMatch[1];
          const resolucionImport = resolverConfinado(importUrl, (ref) =>
            pathModule.resolve(cssDir, ref),
          );
          if (resolucionImport.tipo === 'rechazado') {
            registrarRechazo('css-import', importUrl, resolucionImport.motivo);
            cssContent = cssContent.replace(importMatch[0], '');
            continue;
          }
          const importPath = resolucionImport.ruta;
          try {
            if (resolucionImport.existe) {
              const importedCss = fs.readFileSync(importPath, 'utf-8');
              cssContent = cssContent.replace(importMatch[0], importedCss);
            } else {
              logger.warn('No se encontro un @import de un CSS', {
                action: 'pdf.inline-assets',
                importPath,
                importUrl,
              });
            }
          } catch (importErr) {
            logger.warn('No se pudo leer un @import de un CSS', {
              action: 'pdf.inline-assets',
              importPath,
              reason:
                importErr instanceof Error
                  ? importErr.message
                  : String(importErr),
            });
          }
        }
        result = result.replace(fullTag, `<style>\n${cssContent}\n</style>`);
      } else {
        logger.warn('No se encontró un CSS de la plantilla', {
          action: 'pdf.inline-assets',
          cssPath,
          href,
        });
      }
    } catch (err) {
      logger.warn('No se pudo leer un CSS de la plantilla', {
        action: 'pdf.inline-assets',
        cssPath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Inline images: Replace <img src="..."> with base64 data URIs
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi;
  const imgMatches = [...result.matchAll(imgRegex)];

  for (const match of imgMatches) {
    const fullTag = match[0];
    const src = match[1];

    // Skip already-inlined data URIs
    if (src.startsWith('data:')) continue;

    const resolucionImg = resolverConfinado(src, resolveAssetPath);
    if (resolucionImg.tipo === 'rechazado') {
      registrarRechazo('imagen', src, resolucionImg.motivo);
      // Se quita la etiqueta entera: dejarla con el `src` original le pasaría
      // la ruta a Chromium (o al conversor DOCX) para que la intente él.
      result = result.replace(fullTag, '');
      continue;
    }
    const imgPath = resolucionImg.ruta;

    try {
      if (resolucionImg.existe) {
        const imgBuffer = fs.readFileSync(imgPath);
        const base64 = imgBuffer.toString('base64');
        const mimeType = getMimeType(imgPath);
        const dataUri = `data:${mimeType};base64,${base64}`;

        // Replace only the src attribute value in the tag
        const newTag = fullTag.replace(src, dataUri);
        result = result.replace(fullTag, newTag);
      } else {
        logger.warn('No se encontró una imagen de la plantilla', {
          action: 'pdf.inline-assets',
          imgPath,
          src,
        });
      }
    } catch (err) {
      logger.warn('No se pudo leer una imagen de la plantilla', {
        action: 'pdf.inline-assets',
        imgPath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Fallback styles applied when HTML is a fragment (no full document structure)
 */
const fallbackStyles = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Arial', 'Helvetica', sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    margin: 0;
    padding: 0;
  }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 10pt; }
  th { background-color: #f0f0f0; font-weight: bold; }
  .text-center { text-align: center; }
  .bold { font-weight: bold; }
  .justified { text-align: justify; }
  h2, h3 { margin-top: 15px; margin-bottom: 10px; }
  .section-title { font-size: 12pt; font-weight: bold; text-decoration: underline; margin-top: 20px; }
  .logo-section { text-align: center; margin-bottom: 20px; }
  .logo-section img { max-width: 200px; height: auto; }
  .firma-section { margin-top: 40px; text-align: center; }
  .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #666; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * Prepare HTML for rendering: if it's a full document, use as-is;
 * if it's a fragment, wrap it in a basic document structure.
 */
function prepareHtml(html: string): string {
  if (isFullHtmlDocument(html)) {
    // FIX 2: Template already has full structure - use it directly
    return html;
  }

  // Fragment: wrap with fallback styles
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>${fallbackStyles}</style>
  </head>
  <body>${html}</body>
</html>`;
}

/**
 * Convert HTML string to PDF buffer (single document).
 * If assetsBaseDir is provided, CSS and images are inlined before rendering.
 */
export async function htmlToPdf(
  html: string,
  options: PDFOptions = {},
  assetsBaseDir?: string,
  docDir?: string,
): Promise<Buffer> {
  const mergedOptions = { ...defaultOptions, ...options };
  let browser = null;

  try {
    // Inline assets if base directory provided
    let processedHtml = assetsBaseDir
      ? await inlineAssets(html, assetsBaseDir, docDir)
      : html;

    // Smart wrapping: only wrap if HTML is a fragment
    processedHtml = prepareHtml(processedHtml);

    const executablePath = await getExecutablePath();
    const args = await getBrowserArgs();
    const isServerless =
      process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

    browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true,
      ...(isServerless && { defaultViewport: { width: 1920, height: 1080 } }),
    });

    const page = await browser.newPage();

    // Use domcontentloaded since all CSS/images are inlined by inlineAssets
    await page.setContent(processedHtml, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: mergedOptions.format,
      margin: mergedOptions.margin,
      printBackground: mergedOptions.printBackground,
      displayHeaderFooter: mergedOptions.displayHeaderFooter,
      headerTemplate: mergedOptions.headerTemplate,
      footerTemplate: mergedOptions.footerTemplate,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    logger.error('Falló la generación de un PDF', error, {
      action: 'pdf.single',
    });
    throw new Error(
      `Error al generar PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert multiple HTML documents to PDFs using a SINGLE browser instance.
 * FIX 3: Reuses one Chromium process for all documents instead of N launches.
 * If assetsBaseDir is provided, CSS and images are inlined before rendering.
 */
/**
 * Lo que devuelve {@link batchHtmlToPdf}.
 *
 * Antes devolvía **solo** el array de PDFs generados. Un documento que se
 * caía se registraba en consola y el lote seguía — la decisión de no cortar el
 * lote por uno está bien —, pero la función devolvía un array **más corto**
 * sin decir cuáles faltaban: el contrato no distinguía "generé 10" de "generé
 * 7 y 3 se cayeron". Los dos llamadores tenían que reconstruir la
 * correspondencia por nombre de archivo y se quedaban sin el motivo del fallo
 * (hallazgo P-4 de `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 */
export interface BatchPdfResult {
  /** Los PDFs que salieron. `filename` con extensión `.pdf`. */
  ok: Array<{ filename: string; buffer: Buffer }>;
  /**
   * Los que se cayeron, con el motivo. `filename` es el **de entrada** (con su
   * `.html`), que es la clave con la que el llamador los ubica.
   */
  failed: Array<{ filename: string; reason: string }>;
}

export async function batchHtmlToPdf(
  documents: Array<{
    html: string;
    filename: string;
    /** Per-document override for root-relative asset refs */
    assetsBaseDir?: string;
    /** Per-document dir for relative ("./", "../") asset refs */
    docDir?: string;
  }>,
  options: PDFOptions = {},
  assetsBaseDir?: string,
): Promise<BatchPdfResult> {
  const mergedOptions = { ...defaultOptions, ...options };
  let browser = null;

  try {
    const executablePath = await getExecutablePath();
    const args = await getBrowserArgs();
    const isServerless =
      process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

    browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true,
      ...(isServerless && { defaultViewport: { width: 1920, height: 1080 } }),
    });

    const results: BatchPdfResult = { ok: [], failed: [] };

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      let page = null;
      try {
        logger.debug('Convirtiendo un documento del lote a PDF', {
          action: 'pdf.batch',
          indice: i + 1,
          total: documents.length,
          filename: doc.filename,
        });

        // Inline assets if base directory provided (per-doc override wins)
        const docAssetsBase = doc.assetsBaseDir || assetsBaseDir;
        let processedHtml = docAssetsBase
          ? await inlineAssets(doc.html, docAssetsBase, doc.docDir)
          : doc.html;

        // Smart wrapping
        processedHtml = prepareHtml(processedHtml);

        page = await browser.newPage();

        // Use domcontentloaded since all CSS/images are inlined by inlineAssets
        await page.setContent(processedHtml, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        const pdfBuffer = await page.pdf({
          format: mergedOptions.format,
          margin: mergedOptions.margin,
          printBackground: mergedOptions.printBackground,
          displayHeaderFooter: mergedOptions.displayHeaderFooter,
          headerTemplate: mergedOptions.headerTemplate,
          footerTemplate: mergedOptions.footerTemplate,
        });

        results.ok.push({
          filename: doc.filename.replace(/\.html$/, '.pdf'),
          buffer: Buffer.from(pdfBuffer),
        });

        await page.close();
        page = null;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logger.error(
          'Un documento del lote no se pudo convertir a PDF',
          error,
          {
            action: 'pdf.batch',
            indice: i + 1,
            total: documents.length,
            filename: doc.filename,
          },
        );
        // Se sigue con el resto del lote a propósito — un documento que se cae
        // no debería tirar los otros nueve — pero ahora el fallo VIAJA en el
        // resultado en vez de quedar solo en la consola.
        results.failed.push({ filename: doc.filename, reason });
        if (page) {
          try {
            await page.close();
          } catch {
            /* ignore close error */
          }
        }
      }
    }

    return results;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
