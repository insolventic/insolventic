/**
 * Tests — entrega de eventos del logger a Sentry en serverless.
 *
 * Regresión (preview de fix/sentry-init, 2026-09-01): `logger.error` en un
 * Route Handler respondía 200 y el evento nunca aparecía en Sentry. La
 * captura era "fire and forget" (import dinámico + captureException sin
 * flush) y Vercel congela la función apenas responde. Estos tests afirman
 * que la captura + flush se registra en el `waitUntil` del contexto de
 * request cuando existe, que no rompe nada cuando no existe, y que la
 * promesa nunca rechaza.
 */

const captureExceptionMock = jest.fn();
const captureMessageMock = jest.fn();
const flushMock = jest.fn<Promise<boolean>, [number?]>();

jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
  flush: (...args: [number?]) => flushMock(...args),
}));

const NEXT_CTX = Symbol.for('@next/request-context');
const VERCEL_CTX = Symbol.for('@vercel/request-context');
type Globals = Record<symbol, unknown>;
const globals = globalThis as unknown as Globals;

const originalEnv = { ...process.env };

function installContext(symbol: symbol): jest.Mock {
  const waitUntil = jest.fn();
  globals[symbol] = { get: () => ({ waitUntil }) };
  return waitUntil;
}

async function loadLogger() {
  return (await import('@/lib/logger')).logger;
}

async function loadHasWaitUntil() {
  return (await import('@/lib/logger')).hasServerlessWaitUntil;
}

beforeEach(() => {
  jest.resetModules();
  captureExceptionMock.mockClear();
  captureMessageMock.mockClear();
  flushMock.mockReset();
  flushMock.mockResolvedValue(true);
  process.env = {
    ...originalEnv,
    SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1',
  };
  delete globals[NEXT_CTX];
  delete globals[VERCEL_CTX];
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
  delete globals[NEXT_CTX];
  delete globals[VERCEL_CTX];
});

describe('logger → Sentry en serverless', () => {
  it('error(): registra captura + flush en waitUntil de @next/request-context', async () => {
    const waitUntil = installContext(NEXT_CTX);
    const logger = await loadLogger();
    const err = new Error('boom');

    logger.error('algo falló', err, { action: 'test' });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    const task = waitUntil.mock.calls[0][0] as Promise<unknown>;
    expect(task).toBeInstanceOf(Promise);

    await task;

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0][0]).toBe(err);
    expect(flushMock).toHaveBeenCalledWith(2000);
  });

  it('error(): también acepta el contexto legacy @vercel/request-context', async () => {
    const waitUntil = installContext(VERCEL_CTX);
    const logger = await loadLogger();

    logger.error('algo falló', new Error('boom'));

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it('warn(): registra captureMessage + flush en waitUntil', async () => {
    const waitUntil = installContext(NEXT_CTX);
    const logger = await loadLogger();

    logger.warn('ojo', { action: 'test' });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(captureMessageMock).toHaveBeenCalledWith('ojo', 'warning');
    expect(flushMock).toHaveBeenCalledWith(2000);
  });

  it('el flush ocurre después de la captura, no antes', async () => {
    const waitUntil = installContext(NEXT_CTX);
    const order: string[] = [];
    captureExceptionMock.mockImplementation(() => order.push('capture'));
    flushMock.mockImplementation(async () => {
      order.push('flush');
      return true;
    });
    const logger = await loadLogger();

    logger.error('x', new Error('x'));
    await waitUntil.mock.calls[0][0];

    expect(order).toEqual(['capture', 'flush']);
  });

  it('sin contexto de request (dev local, tests): captura igual y no lanza', async () => {
    const logger = await loadLogger();

    expect(() => logger.error('x', new Error('x'))).not.toThrow();
    // Dejar correr la cadena import → capture → flush.
    await new Promise((resolve) => setImmediate(resolve));

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it('la tarea registrada nunca rechaza aunque flush falle', async () => {
    const waitUntil = installContext(NEXT_CTX);
    flushMock.mockRejectedValue(new Error('red caída'));
    const logger = await loadLogger();

    logger.error('x', new Error('x'));

    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('sin DSN: no toca waitUntil ni Sentry', async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const waitUntil = installContext(NEXT_CTX);
    const logger = await loadLogger();

    logger.error('x', new Error('x'));
    await waitUntil.mock.calls[0]?.[0];

    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(flushMock).not.toHaveBeenCalled();
  });

  it('hasServerlessWaitUntil refleja si la plataforma expone waitUntil', async () => {
    const hasWaitUntil = await loadHasWaitUntil();
    expect(hasWaitUntil()).toBe(false);

    installContext(NEXT_CTX);
    expect(hasWaitUntil()).toBe(true);
  });

  it('un contexto roto (get lanza) no rompe el logger', async () => {
    globals[NEXT_CTX] = {
      get: () => {
        throw new Error('sin contexto');
      },
    };
    const logger = await loadLogger();

    expect(() => logger.error('x', new Error('x'))).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
