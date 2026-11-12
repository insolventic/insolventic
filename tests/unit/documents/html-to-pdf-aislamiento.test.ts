/**
 * N-A2-02: Chromium renderiza los documentos sin JavaScript y sin red.
 *
 * El HTML de un documento mezcla la plantilla con datos de usuario. Escapado y
 * confinamiento (`generacion-assets-confinados.test.ts`) son las defensas
 * principales; esto fija la capa de abajo: la página no ejecuta scripts, toda
 * petición que no sea `data:` o `about:blank` se aborta, y `pdf()` tiene un
 * tope explícito con un error que dice qué pasó.
 *
 * Chromium va simulado, igual que en `html-to-pdf-executable-path.test.ts`:
 * lo que importa es cómo se configura la página, no el PDF.
 */

const mockLaunch = jest.fn();
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: (...args: unknown[]) => mockLaunch(...args) },
}));

jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: {
    executablePath: jest.fn().mockResolvedValue('/tmp/chromium-serverless'),
    args: ['--serverless-arg'],
  },
}));

import fs from 'fs';
import {
  batchHtmlToPdf,
  esPeticionPermitida,
  htmlToPdf,
  PDF_TIMEOUT_MS,
} from '@/lib/html-to-pdf';
import { logger } from '@/lib/logger';

type Handler = (req: FakeRequest) => void;

interface FakeRequest {
  url: () => string;
  continue: jest.Mock;
  abort: jest.Mock;
}

/** Página simulada que registra el orden de las llamadas. */
function crearPagina(pdfImpl?: () => Promise<Uint8Array>) {
  const orden: string[] = [];
  const handlers: Handler[] = [];
  const page = {
    orden,
    handlers,
    setJavaScriptEnabled: jest.fn(async (v: boolean) => {
      orden.push(`js:${v}`);
    }),
    setRequestInterception: jest.fn(async (v: boolean) => {
      orden.push(`intercept:${v}`);
    }),
    on: jest.fn((evento: string, h: Handler) => {
      orden.push(`on:${evento}`);
      if (evento === 'request') handlers.push(h);
    }),
    setContent: jest.fn(async () => {
      orden.push('setContent');
    }),
    pdf: jest.fn(
      pdfImpl ??
        (async () => {
          orden.push('pdf');
          return new Uint8Array([37, 80, 68, 70]);
        }),
    ),
    close: jest.fn(async () => undefined),
  };
  return page;
}

function peticion(url: string): FakeRequest {
  return {
    url: () => url,
    continue: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
  };
}

describe('htmlToPdf — página aislada', () => {
  let paginas: ReturnType<typeof crearPagina>[];
  let existsSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  const savedChrome = process.env.CHROME_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
    paginas = [];
    process.env.CHROME_PATH = '/opt/chrome';
    existsSpy = jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((p) => String(p) === '/opt/chrome');
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockLaunch.mockImplementation(async () => ({
      newPage: async () => {
        const p = crearPagina();
        paginas.push(p);
        return p;
      },
      close: async () => undefined,
    }));
  });

  afterEach(() => {
    if (savedChrome === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = savedChrome;
    existsSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('desactiva JavaScript e intercepta peticiones ANTES de cargar el HTML', async () => {
    await htmlToPdf('<p>hola</p>');

    const [p] = paginas;
    expect(p.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(p.setRequestInterception).toHaveBeenCalledWith(true);
    // El orden importa: configurar después de setContent dejaría correr los
    // scripts y salir las peticiones del primer render.
    expect(p.orden).toEqual([
      'js:false',
      'intercept:true',
      'on:request',
      'setContent',
      'pdf',
    ]);
  });

  it('pasa un timeout explícito a pdf()', async () => {
    await htmlToPdf('<p>hola</p>');
    expect(paginas[0].pdf).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: PDF_TIMEOUT_MS }),
    );
  });

  it('el lote configura igual CADA página', async () => {
    const res = await batchHtmlToPdf([
      { html: '<p>1</p>', filename: 'a.html' },
      { html: '<p>2</p>', filename: 'b.html' },
    ]);

    expect(res.ok).toHaveLength(2);
    expect(paginas).toHaveLength(2);
    for (const p of paginas) {
      expect(p.setJavaScriptEnabled).toHaveBeenCalledWith(false);
      expect(p.setRequestInterception).toHaveBeenCalledWith(true);
      expect(p.orden.indexOf('on:request')).toBeLessThan(
        p.orden.indexOf('setContent'),
      );
    }
  });

  describe('aborto de peticiones', () => {
    const bloqueadas = [
      'file:///etc/passwd',
      'file:///C:/Windows/win.ini',
      'http://169.254.169.254/latest/meta-data/',
      'https://atacante.example/x.png',
      'http://localhost:3000/api',
      'ws://atacante.example/',
      'chrome://settings',
      'blob:null/1234',
    ];

    it.each(bloqueadas)('%s se aborta y no continúa', async (url) => {
      await htmlToPdf('<p>hola</p>');
      const req = peticion(url);
      paginas[0].handlers[0](req);

      expect(req.abort).toHaveBeenCalledWith('blockedbyclient');
      expect(req.continue).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Se bloqueó una petición'),
        expect.objectContaining({ action: 'pdf.render' }),
      );
    });

    it.each(['data:image/png;base64,iVBORw0KGgo=', 'about:blank'])(
      '%s continúa',
      async (url) => {
        await htmlToPdf('<p>hola</p>');
        const req = peticion(url);
        paginas[0].handlers[0](req);

        expect(req.continue).toHaveBeenCalled();
        expect(req.abort).not.toHaveBeenCalled();
      },
    );

    it('la regla es estricta: solo data: y about:blank exacto', () => {
      expect(esPeticionPermitida('data:text/css,')).toBe(true);
      expect(esPeticionPermitida('about:blank')).toBe(true);
      expect(esPeticionPermitida('about:blank#x')).toBe(false);
      expect(esPeticionPermitida('about:srcdoc')).toBe(false);
      expect(esPeticionPermitida(' data:x')).toBe(false);
      expect(esPeticionPermitida('DATA:x')).toBe(false);
    });
  });

  it('si pdf() no termina, falla con un error claro al cumplirse el tope', async () => {
    jest.useFakeTimers();
    mockLaunch.mockImplementation(async () => ({
      newPage: async () => {
        const p = crearPagina(() => new Promise<Uint8Array>(() => {}));
        paginas.push(p);
        return p;
      },
      close: async () => undefined,
    }));

    const promesa = htmlToPdf('<p>hola</p>');
    const resultado = expect(promesa).rejects.toThrow(
      `La conversión a PDF superó el límite de ${PDF_TIMEOUT_MS / 1000} s`,
    );
    await jest.advanceTimersByTimeAsync(PDF_TIMEOUT_MS);
    await resultado;
  });

  it('en el lote, el documento que se pasa del tope queda en failed con el motivo', async () => {
    jest.useFakeTimers();
    let n = 0;
    mockLaunch.mockImplementation(async () => ({
      newPage: async () => {
        n++;
        const p =
          n === 1
            ? crearPagina(() => new Promise<Uint8Array>(() => {}))
            : crearPagina();
        paginas.push(p);
        return p;
      },
      close: async () => undefined,
    }));

    const promesa = batchHtmlToPdf([
      { html: '<p>1</p>', filename: 'colgado.html' },
      { html: '<p>2</p>', filename: 'ok.html' },
    ]);
    await jest.advanceTimersByTimeAsync(PDF_TIMEOUT_MS);
    const res = await promesa;

    expect(res.ok.map((d) => d.filename)).toEqual(['ok.pdf']);
    expect(res.failed).toEqual([
      {
        filename: 'colgado.html',
        reason: expect.stringContaining('superó el límite'),
      },
    ]);
  });
});
