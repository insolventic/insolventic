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
): Promise<Buffer> {
  const mergedOptions = { ...defaultDocxOptions, ...options };

  try {
    // Inline assets if base directory provided
    const processedHtml = assetsBaseDir
      ? await inlineAssets(html, assetsBaseDir)
      : html;

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
  documents: Array<{ html: string; filename: string }>,
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

      const buffer = await htmlToDocx(doc.html, options, assetsBaseDir);

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
