/**
 * Tests — src/instrumentation.ts + src/instrumentation-client.ts
 *
 * Regresión del hallazgo N-1 (checkpoint 2026-09-01): `Sentry.init()` no se
 * ejecutaba en ningún runtime porque nadie importaba los `sentry.*.config.ts`.
 * Estos tests afirman que, con DSN configurado, cada runtime inicializa el SDK
 * exactamente una vez con la configuración de privacidad esperada, y que sin
 * DSN sigue siendo no-op.
 */

type InitOptions = {
  dsn?: string;
  environment?: string;
  sendDefaultPii?: boolean;
  tracesSampleRate?: number;
  beforeSend?: (event: unknown) => unknown;
};

const initMock = jest.fn<void, [InitOptions]>();
const captureRequestErrorMock = jest.fn();
const captureRouterTransitionStartMock = jest.fn();
const flushMock = jest.fn<Promise<boolean>, [number?]>();

jest.mock('@sentry/nextjs', () => ({
  init: (...args: [InitOptions]) => initMock(...args),
  captureRequestError: captureRequestErrorMock,
  captureRouterTransitionStart: captureRouterTransitionStartMock,
  flush: (...args: [number?]) => flushMock(...args),
}));

const originalEnv = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...originalEnv };
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.NEXT_RUNTIME;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  jest.resetModules();
  initMock.mockClear();
  captureRequestErrorMock.mockClear();
  flushMock.mockReset();
  flushMock.mockResolvedValue(true);
});

afterAll(() => {
  process.env = originalEnv;
});

const SERVER_DSN = 'https://abc123@o111.ingest.us.sentry.io/222';
const CLIENT_DSN = 'https://pub456@o111.ingest.us.sentry.io/333';

describe('instrumentation.ts — register() (server / edge)', () => {
  it('nodejs runtime con SENTRY_DSN → init() una vez con el DSN de servidor', async () => {
    resetEnv({
      NEXT_RUNTIME: 'nodejs',
      SENTRY_DSN: SERVER_DSN,
      NEXT_PUBLIC_APP_ENV: 'staging',
    });
    const { register } = await import('@/instrumentation');

    await register();

    expect(initMock).toHaveBeenCalledTimes(1);
    const options = initMock.mock.calls[0][0];
    expect(options.dsn).toBe(SERVER_DSN);
    expect(options.environment).toBe('staging');
    expect(options.sendDefaultPii).toBe(false);
    expect(typeof options.beforeSend).toBe('function');
  });

  it('edge runtime con SENTRY_DSN → init() una vez', async () => {
    resetEnv({ NEXT_RUNTIME: 'edge', SENTRY_DSN: SERVER_DSN });
    const { register } = await import('@/instrumentation');

    await register();

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0].dsn).toBe(SERVER_DSN);
  });

  it('server: cae a NEXT_PUBLIC_SENTRY_DSN si SENTRY_DSN no está', async () => {
    resetEnv({ NEXT_RUNTIME: 'nodejs', NEXT_PUBLIC_SENTRY_DSN: CLIENT_DSN });
    const { register } = await import('@/instrumentation');

    await register();

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0].dsn).toBe(CLIENT_DSN);
  });

  it('sin DSN → no-op (no llama a init)', async () => {
    resetEnv({ NEXT_RUNTIME: 'nodejs' });
    const { register } = await import('@/instrumentation');

    await register();

    expect(initMock).not.toHaveBeenCalled();
  });

  it('runtime desconocido → no carga ningún config', async () => {
    resetEnv({ NEXT_RUNTIME: undefined, SENTRY_DSN: SERVER_DSN });
    const { register } = await import('@/instrumentation');

    await register();

    expect(initMock).not.toHaveBeenCalled();
  });

  /**
   * Regresión (preview de fix/sentry-init, 2026-09-01): el servidor
   * respondía 500 pero el evento nunca llegaba. `captureRequestError`
   * programa el flush con `vercelWaitUntil`, que es no-op en el runtime
   * Node, y Vercel congela la función apenas responde. Next espera a
   * `onRequestError`, así que el flush explícito y esperado es lo que
   * garantiza la entrega.
   */
  it('onRequestError delega en captureRequestError y espera el flush', async () => {
    resetEnv({});
    const { onRequestError } = await import('@/instrumentation');
    const error = new Error('boom');
    const request = { path: '/x', method: 'GET', headers: {} };
    const context = {
      routerKind: 'App Router',
      routePath: '/x',
      routeType: 'route',
    } as const;

    let resolveFlush: (value: boolean) => void = () => undefined;
    flushMock.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveFlush = resolve;
      }),
    );

    let settled = false;
    const pending = onRequestError(error, request, context).then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(captureRequestErrorMock).toHaveBeenCalledTimes(1);
    expect(captureRequestErrorMock).toHaveBeenCalledWith(
      error,
      request,
      context,
    );
    expect(flushMock).toHaveBeenCalledWith(2000);
    // Mientras el flush no termina, la promesa que Next espera sigue abierta.
    expect(settled).toBe(false);

    resolveFlush(true);
    await pending;
    expect(settled).toBe(true);
  });

  it('beforeSend del servidor redacta cookies y headers de auth', async () => {
    resetEnv({ NEXT_RUNTIME: 'nodejs', SENTRY_DSN: SERVER_DSN });
    const { register } = await import('@/instrumentation');
    await register();

    const beforeSend = initMock.mock.calls[0][0].beforeSend!;
    const scrubbed = beforeSend({
      request: {
        url: 'https://app/reset?token=secreto&x=1',
        cookies: { 'access-token': 'jwt' },
        headers: { authorization: 'Bearer jwt', 'x-request-id': 'r1' },
      },
    }) as {
      request: {
        url: string;
        cookies: Record<string, string>;
        headers: Record<string, string>;
      };
    };

    expect(scrubbed.request.cookies).toEqual({});
    expect(scrubbed.request.headers.authorization).toBe('[REDACTED]');
    expect(scrubbed.request.headers['x-request-id']).toBe('r1');
    expect(scrubbed.request.url).not.toContain('secreto');
    expect(scrubbed.request.url).toContain('token=[REDACTED]');
  });
});

describe('instrumentation-client.ts — navegador', () => {
  it('con NEXT_PUBLIC_SENTRY_DSN → init() una vez con sendDefaultPii=false', async () => {
    resetEnv({
      NEXT_PUBLIC_SENTRY_DSN: CLIENT_DSN,
      NEXT_PUBLIC_APP_ENV: 'production',
    });

    await import('@/instrumentation-client');

    expect(initMock).toHaveBeenCalledTimes(1);
    const options = initMock.mock.calls[0][0];
    expect(options.dsn).toBe(CLIENT_DSN);
    expect(options.environment).toBe('production');
    expect(options.sendDefaultPii).toBe(false);
    expect(typeof options.beforeSend).toBe('function');
  });

  it('sin NEXT_PUBLIC_SENTRY_DSN → no-op', async () => {
    resetEnv({});

    await import('@/instrumentation-client');

    expect(initMock).not.toHaveBeenCalled();
  });

  it('no usa el DSN de servidor (SENTRY_DSN) en el navegador', async () => {
    resetEnv({ SENTRY_DSN: SERVER_DSN });

    await import('@/instrumentation-client');

    expect(initMock).not.toHaveBeenCalled();
  });

  it('exporta onRouterTransitionStart = Sentry.captureRouterTransitionStart', async () => {
    resetEnv({});
    const { onRouterTransitionStart } = await import(
      '@/instrumentation-client'
    );

    expect(onRouterTransitionStart).toBe(captureRouterTransitionStartMock);
  });
});
