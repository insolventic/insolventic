/**
 * Registro de archivos rechazados por tamaño: la evidencia para decidir si el
 * límite de 4 MB alcanza (`docs/DECISIONES.md`). Lo que hay en Drive no sirve
 * para eso, porque solo muestra lo que sí cupo.
 *
 * Lo que se vigila es lo que sale, no solo lo que se calcula: el evento llega a
 * Sentry desde el navegador, y el SDK le agrega por su cuenta la URL y las
 * migas de pan de la sesión, donde sí puede haber datos del expediente.
 */

import {
  categoriaDeTipo,
  rangoDeTamano,
  registrarRechazoPorTamano,
} from '@/lib/rechazo-tamano';
import { scrubSentryEvent } from '@/lib/sentry-scrub';

const MB = 1024 * 1024;

const MENSAJE_6MB_PDF =
  'Archivo rechazado por tamaño | origen=comprobante | rango=5-10 MB | tipo=pdf';

describe('rangoDeTamano', () => {
  it.each([
    [4 * MB + 1, 'hasta 5 MB'],
    [5 * MB, 'hasta 5 MB'],
    [5 * MB + 1, '5-10 MB'],
    [10 * MB, '5-10 MB'],
    [10 * MB + 1, '10-25 MB'],
    [25 * MB, '10-25 MB'],
    [25 * MB + 1, 'más de 25 MB'],
  ])('%i bytes → %s', (bytes, rango) => {
    expect(rangoDeTamano(bytes)).toBe(rango);
  });
});

describe('categoriaDeTipo', () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/heic', 'heic'],
    ['image/heif', 'heic'],
    ['application/msword', 'word'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'word',
    ],
    ['application/vnd.ms-excel', 'excel'],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel',
    ],
  ])('%s → %s', (mimeType, categoria) => {
    expect(categoriaDeTipo(mimeType)).toBe(categoria);
  });

  it('no deja pasar un tipo que no conoce: lo declara el navegador y es texto libre', () => {
    expect(categoriaDeTipo('application/x-juan-perez-1234567')).toBe('otro');
  });

  it('distingue un tipo vacío, que es lo que dan algunas fotos de celular', () => {
    expect(categoriaDeTipo('')).toBe('desconocido');
  });
});

describe('registrarRechazoPorTamano', () => {
  let consola: jest.SpyInstance;

  beforeEach(() => {
    consola = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registra origen, intervalo y tipo, y nada más', () => {
    registrarRechazoPorTamano('comprobante', {
      size: 6 * MB,
      type: 'application/pdf',
    });

    expect(consola).toHaveBeenCalledTimes(1);
    const { timestamp, ...resto } = JSON.parse(consola.mock.calls[0][0]);
    expect(typeof timestamp).toBe('string');
    expect(resto).toEqual({
      level: 'WARN',
      message: MENSAJE_6MB_PDF,
      action: 'rechazo-tamano',
      origen: 'comprobante',
      rango: '5-10 MB',
      tipo: 'pdf',
    });
  });

  it('no copia nada de un File real, aunque se lo pasen entero', () => {
    const archivo = new File(['x'], 'Juan Perez CC 1234567.pdf', {
      type: 'application/x-juan-perez',
    });
    Object.defineProperty(archivo, 'size', { value: 6 * MB });

    registrarRechazoPorTamano('documento-caso', archivo);

    const salida = consola.mock.calls[0][0] as string;
    expect(salida).not.toMatch(/juan|perez|1234567/i);
    expect(JSON.parse(salida).tipo).toBe('otro');
  });

  it('el peso exacto no sale: solo el intervalo', () => {
    registrarRechazoPorTamano('comprobante', {
      size: 6_543_210,
      type: 'application/pdf',
    });

    expect(consola.mock.calls[0][0]).not.toContain('6543210');
  });
});

describe('el evento llega a Sentry con su contador en el mensaje', () => {
  const DSN_ORIGINAL = process.env.SENTRY_DSN;

  afterEach(() => {
    process.env.SENTRY_DSN = DSN_ORIGINAL;
    jest.resetModules();
    jest.dontMock('@sentry/nextjs');
    jest.restoreAllMocks();
  });

  it('una combinación de origen, intervalo y tipo es un mensaje fijo, que Sentry agrupa y cuenta', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const captureMessage = jest.fn();
    const flush = jest.fn().mockResolvedValue(true);
    jest.resetModules();
    jest.doMock('@sentry/nextjs', () => ({ captureMessage, flush }));
    process.env.SENTRY_DSN = 'https://clave@sentry.invalid/1';

    const modulo = await import('@/lib/rechazo-tamano');
    modulo.registrarRechazoPorTamano('comprobante', {
      size: 6 * MB,
      type: 'application/pdf',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(MENSAJE_6MB_PDF, 'warning');
  });
});

describe('scrubSentryEvent con un rechazo por tamaño', () => {
  function eventoConDatosDelExpediente(message: string) {
    return {
      message,
      level: 'warning',
      environment: 'production',
      request: {
        url: 'https://app.invalid/cases?caso=2026-001-juan-perez',
        headers: { 'User-Agent': 'x' },
      },
      breadcrumbs: [{ message: 'caso 2026-001 de Juan Perez' }],
      user: { id: 'usuario-1', ip_address: '10.0.0.1' },
      extra: { caseId: 'caso-1' },
      tags: { caseId: 'caso-1' },
      contexts: { caso: { id: 'caso-1' } },
      transaction: '/cases/caso-1',
    };
  }

  it('solo sobreviven el mensaje y sus datos del propio evento', () => {
    const salida = scrubSentryEvent(
      eventoConDatosDelExpediente(MENSAJE_6MB_PDF),
    );

    expect(salida).toEqual({
      message: MENSAJE_6MB_PDF,
      level: 'warning',
      environment: 'production',
    });
  });

  it('a cualquier otro evento le deja las migas: las necesita para diagnosticar', () => {
    const salida = scrubSentryEvent(
      eventoConDatosDelExpediente('Error al subir archivo a Google Drive'),
    );

    expect(salida.breadcrumbs).toHaveLength(1);
    expect(salida.request?.url).toBeDefined();
    expect(salida.extra).toEqual({ caseId: 'caso-1' });
  });
});
