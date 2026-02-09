/**
 * HTML to PDF conversion utility
 * Uses Puppeteer with Chromium for server-side PDF generation
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

  for (const path of possiblePaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(path)) {
        return path;
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
 * Convert HTML string to PDF buffer
 */
export async function htmlToPdf(
  html: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  const mergedOptions = { ...defaultOptions, ...options };
  let browser = null;

  try {
    const executablePath = await getExecutablePath();
    const args = await getBrowserArgs();

    // Check if we're in serverless environment
    const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

    browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true,
      ...(isServerless && { defaultViewport: { width: 1920, height: 1080 } }),
    });

    const page = await browser.newPage();

    // Set content with base styles
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              color: #000;
              margin: 0;
              padding: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 5px 8px;
              text-align: left;
              font-size: 10pt;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .text-center {
              text-align: center;
            }
            .bold {
              font-weight: bold;
            }
            .justified {
              text-align: justify;
            }
            h2, h3 {
              margin-top: 15px;
              margin-bottom: 10px;
            }
            .section-title {
              font-size: 12pt;
              font-weight: bold;
              text-decoration: underline;
              margin-top: 20px;
            }
            .logo-section {
              text-align: center;
              margin-bottom: 20px;
            }
            .logo-section img {
              max-width: 200px;
              height: auto;
            }
            .firma-section {
              margin-top: 40px;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 9pt;
              color: #666;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await page.setContent(styledHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Generate PDF
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
 * Convert multiple HTML documents to PDFs
 */
export async function batchHtmlToPdf(
  documents: Array<{ html: string; filename: string }>,
  options: PDFOptions = {}
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
        const page = await browser.newPage();

        const styledHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
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
              </style>
            </head>
            <body>${doc.html}</body>
          </html>
        `;

        await page.setContent(styledHtml, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        const pdfBuffer = await page.pdf({
          format: mergedOptions.format,
          margin: mergedOptions.margin,
          printBackground: mergedOptions.printBackground,
        });

        results.push({
          filename: doc.filename.replace(/\.html$/, '.pdf'),
          buffer: Buffer.from(pdfBuffer),
        });

        await page.close();
      } catch (error) {
        console.error(`Error generating PDF for ${doc.filename}:`, error);
        // Continue with other documents
      }
    }

    return results;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
