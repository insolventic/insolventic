/**
 * HTML to PDF conversion utility
 * Uses Puppeteer with Chromium for server-side PDF generation
 *
 * FIX 2: Detects full HTML documents and skips double wrapping
 * FIX 3: batchHtmlToPdf reuses a single browser for all documents
 * FIX 4: inlineAssets resolves CSS/images from local filesystem
 */

import puppeteer from 'puppeteer-core';

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

  throw new Error('No se encontro Chromium. Instale Google Chrome o configure CHROME_PATH.');
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
 * @param html - The HTML content
 * @param assetsBaseDir - Absolute path to the directory containing CSS/ and img/ folders
 */
export async function inlineAssets(html: string, assetsBaseDir: string): Promise<string> {
  const fs = await import('fs');
  const pathModule = await import('path');

  let result = html;

  // 1. Inline CSS: Replace <link rel="stylesheet" href="..."> with <style>...</style>
  const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  const linkMatches = [...result.matchAll(linkRegex)];

  // Also match href before rel
  const linkRegex2 = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi;
  const linkMatches2 = [...result.matchAll(linkRegex2)];

  const allLinkMatches = [...linkMatches, ...linkMatches2];

  for (const match of allLinkMatches) {
    const fullTag = match[0];
    const href = match[1];

    // Resolve the CSS file path - handle root-relative paths like /CSS/file.css
    let cssPath: string;
    if (href.startsWith('/')) {
      cssPath = pathModule.join(assetsBaseDir, href);
    } else {
      cssPath = pathModule.join(assetsBaseDir, href);
    }

    try {
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        result = result.replace(fullTag, `<style>\n${cssContent}\n</style>`);
      } else {
        console.warn(`CSS file not found: ${cssPath} (from href="${href}")`);
      }
    } catch (err) {
      console.warn(`Error reading CSS file ${cssPath}:`, err);
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

    // Resolve the image file path
    let imgPath: string;
    if (src.startsWith('/')) {
      imgPath = pathModule.join(assetsBaseDir, src);
    } else {
      imgPath = pathModule.join(assetsBaseDir, src);
    }

    try {
      if (fs.existsSync(imgPath)) {
        const imgBuffer = fs.readFileSync(imgPath);
        const base64 = imgBuffer.toString('base64');
        const mimeType = getMimeType(imgPath);
        const dataUri = `data:${mimeType};base64,${base64}`;

        // Replace only the src attribute value in the tag
        const newTag = fullTag.replace(src, dataUri);
        result = result.replace(fullTag, newTag);
      } else {
        console.warn(`Image file not found: ${imgPath} (from src="${src}")`);
      }
    } catch (err) {
      console.warn(`Error reading image file ${imgPath}:`, err);
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
): Promise<Buffer> {
  const mergedOptions = { ...defaultOptions, ...options };
  let browser = null;

  try {
    // Inline assets if base directory provided
    let processedHtml = assetsBaseDir
      ? await inlineAssets(html, assetsBaseDir)
      : html;

    // Smart wrapping: only wrap if HTML is a fragment
    processedHtml = prepareHtml(processedHtml);

    const executablePath = await getExecutablePath();
    const args = await getBrowserArgs();
    const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

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
    console.error('Error generating PDF:', error);
    throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
export async function batchHtmlToPdf(
  documents: Array<{ html: string; filename: string }>,
  options: PDFOptions = {},
  assetsBaseDir?: string,
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const mergedOptions = { ...defaultOptions, ...options };
  let browser = null;

  try {
    const executablePath = await getExecutablePath();
    const args = await getBrowserArgs();
    const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

    browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true,
      ...(isServerless && { defaultViewport: { width: 1920, height: 1080 } }),
    });

    const results: Array<{ filename: string; buffer: Buffer }> = [];

    for (const doc of documents) {
      try {
        // Inline assets if base directory provided
        let processedHtml = assetsBaseDir
          ? await inlineAssets(doc.html, assetsBaseDir)
          : doc.html;

        // Smart wrapping
        processedHtml = prepareHtml(processedHtml);

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

        results.push({
          filename: doc.filename.replace(/\.html$/, '.pdf'),
          buffer: Buffer.from(pdfBuffer),
        });

        await page.close();
      } catch (error) {
        console.error(`Error generating PDF for ${doc.filename}:`, error);
        // Continue with other documents - don't break the batch
      }
    }

    return results;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
