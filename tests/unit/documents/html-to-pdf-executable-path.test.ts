/**
 * Unit Tests: resolución del ejecutable de Chromium (src/lib/html-to-pdf.ts).
 *
 * El mensaje de error decía "configure CHROME_PATH" pero el código nunca leía esa
 * variable: quien tenía Chrome/Edge/Chromium en otra ruta no tenía cómo
 * destrabarse sin editar el código. Ahora, FUERA de Vercel/Lambda, CHROME_PATH
 * tiene prioridad sobre las rutas habituales; en serverless no cambia nada.
 *
 * Se ejercita por la vía pública (`htmlToPdf`) con puppeteer y el sistema de
 * archivos simulados: solo importa con qué `executablePath` se lanza el browser.
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
import { htmlToPdf } from '@/lib/html-to-pdf';

const CUSTOM_CHROME = '/opt/mi-chrome/chrome';
const STANDARD_CHROME = '/usr/bin/google-chrome';

const ENV_KEYS = ['CHROME_PATH', 'VERCEL', 'AWS_LAMBDA_FUNCTION_NAME'] as const;

describe('htmlToPdf — ejecutable de Chromium', () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
  let existsSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  /** Simula qué rutas existen en el disco. */
  const filesystemHas = (...paths: string[]) =>
    existsSpy.mockImplementation((p: unknown) => paths.includes(String(p)));

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    // htmlToPdf registra con console.error cada fallo que relanza.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLaunch.mockResolvedValue({
      newPage: async () => ({
        setContent: async () => undefined,
        pdf: async () => Buffer.from('%PDF-fake'),
      }),
      close: async () => undefined,
    });
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    existsSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const launchedWith = () =>
    (mockLaunch.mock.calls[0][0] as { executablePath: string }).executablePath;

  describe('CHROME_PATH (desarrollo local)', () => {
    it('si existe, se usa para lanzar el browser', async () => {
      process.env.CHROME_PATH = CUSTOM_CHROME;
      filesystemHas(CUSTOM_CHROME);

      await htmlToPdf('<p>hola</p>');

      expect(launchedWith()).toBe(CUSTOM_CHROME);
    });

    it('tiene prioridad sobre las rutas habituales aunque también existan', async () => {
      process.env.CHROME_PATH = CUSTOM_CHROME;
      filesystemHas(CUSTOM_CHROME, STANDARD_CHROME);

      await htmlToPdf('<p>hola</p>');

      expect(launchedWith()).toBe(CUSTOM_CHROME);
    });

    it('si apunta a un archivo que no existe: falla diciendo cuál, sin caer en silencio a otra ruta', async () => {
      process.env.CHROME_PATH = CUSTOM_CHROME;
      // Existe Chrome en una ruta habitual: NO debe usarse a escondidas.
      filesystemHas(STANDARD_CHROME);

      await expect(htmlToPdf('<p>hola</p>')).rejects.toThrow(
        new RegExp(`CHROME_PATH.*${CUSTOM_CHROME}`),
      );
      expect(mockLaunch).not.toHaveBeenCalled();
    });

    it('un valor en blanco cuenta como no definido', async () => {
      process.env.CHROME_PATH = '   ';
      filesystemHas(STANDARD_CHROME);

      await htmlToPdf('<p>hola</p>');

      expect(launchedWith()).toBe(STANDARD_CHROME);
    });
  });

  describe('sin CHROME_PATH (comportamiento que no debe cambiar)', () => {
    it('usa la primera ruta habitual que exista', async () => {
      filesystemHas(STANDARD_CHROME);

      await htmlToPdf('<p>hola</p>');

      expect(launchedWith()).toBe(STANDARD_CHROME);
    });

    it('sin ningún Chromium: el error es accionable y nombra CHROME_PATH', async () => {
      await expect(htmlToPdf('<p>hola</p>')).rejects.toThrow(
        /No se encontro Chromium.*CHROME_PATH/,
      );
      expect(mockLaunch).not.toHaveBeenCalled();
    });
  });

  describe('serverless (Vercel / Lambda)', () => {
    it.each(['VERCEL', 'AWS_LAMBDA_FUNCTION_NAME'])(
      'con %s usa @sparticuz/chromium e ignora CHROME_PATH',
      async (envKey) => {
        process.env[envKey] = '1';
        process.env.CHROME_PATH = CUSTOM_CHROME;
        filesystemHas(CUSTOM_CHROME, STANDARD_CHROME);

        await htmlToPdf('<p>hola</p>');

        expect(launchedWith()).toBe('/tmp/chromium-serverless');
      },
    );
  });
});
