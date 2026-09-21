/**
 * requestId: el servidor lo emite; lo que llega del cliente se valida.
 * (middleware.ts lo genera siempre; request-context.ts solo acepta un UUID.)
 */

import { newRequestId, parseRequestId } from '@/lib/request-id';

const UUID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

describe('parseRequestId', () => {
  it('acepta un UUID bien formado (y lo normaliza a minúsculas)', () => {
    expect(parseRequestId(UUID)).toBe(UUID);
    expect(parseRequestId(UUID.toUpperCase())).toBe(UUID);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['vacío', ''],
    ['texto libre', 'atacante-controla-esto'],
    ['un UUID con basura al final', `${UUID}-extra`],
    ['un UUID con salto de línea (inyección de log)', `${UUID}\nlevel":"ERROR`],
    ['un valor larguísimo', 'a'.repeat(10_000)],
    ['un UUID sin guiones', UUID.replace(/-/g, '')],
  ])('descarta %s', (_nombre, valor) => {
    expect(parseRequestId(valor as string | null | undefined)).toBeUndefined();
  });
});

describe('newRequestId', () => {
  it('genera UUIDs válidos y distintos', () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(parseRequestId(a)).toBe(a);
    expect(a).not.toBe(b);
  });
});

describe('seedRequestContextFromHeaders — header del cliente', () => {
  // AsyncLocalStorage.enterWith persiste: cada caso carga un módulo nuevo.
  async function seedWithHeader(value: string | null) {
    jest.resetModules();
    jest.doMock('next/headers', () => ({
      headers: async () =>
        new Headers(value === null ? {} : { 'x-request-id': value }),
    }));
    const mod = await import('@/lib/request-context');
    return mod.seedRequestContextFromHeaders();
  }

  afterEach(() => {
    jest.dontMock('next/headers');
  });

  it('usa el id del header si es un UUID (el que puso el middleware)', async () => {
    expect(await seedWithHeader(UUID)).toBe(UUID);
  });

  it.each([
    ['texto libre', 'atacante-controla-esto'],
    // Un header HTTP real no puede llevar saltos de línea; sí comillas y espacios.
    [
      'comillas y espacios (inyección en el JSON del log)',
      `${UUID}", "level":"ERROR`,
    ],
    ['larguísimo', 'a'.repeat(10_000)],
  ])('descarta un header con %s y genera uno propio', async (_n, valor) => {
    const id = await seedWithHeader(valor);
    expect(id).not.toBe(valor);
    expect(parseRequestId(id)).toBe(id);
  });

  it('sin header genera uno propio', async () => {
    const id = await seedWithHeader(null);
    expect(parseRequestId(id)).toBe(id);
  });
});
