/**
 * Unit Tests — src/lib/observability.ts
 *
 * The helper is a thin wrapper around @sentry/nextjs. The contract we need
 * to preserve:
 *   - When SENTRY_DSN is unset, calls degrade to console (never throw).
 *   - `reportError` always logs the error exactly once.
 *   - `reportMessage` routes by severity (info/warn/error).
 */

describe('observability.ts', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reportError logs to console.error when Sentry is not configured', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { reportError } = await import('@/lib/observability');

    await reportError(new Error('boom'), { action: 'test.action' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('[test.action]');
    spy.mockRestore();
  });

  it('reportMessage routes by level', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { reportMessage } = await import('@/lib/observability');

    await reportMessage('hello', 'info');
    await reportMessage('careful', 'warning');
    await reportMessage('broke', 'error');

    expect(infoSpy).toHaveBeenCalledWith('hello');
    expect(warnSpy).toHaveBeenCalledWith('careful');
    expect(errSpy).toHaveBeenCalledWith('broke');

    errSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('does not throw when Sentry module fails to load', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/1';
    // Force the dynamic import to reject; the helper must swallow it.
    jest.doMock(
      '@sentry/nextjs',
      () => {
        throw new Error('module not installed');
      },
      { virtual: true },
    );
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { reportError } = await import('@/lib/observability');
    await expect(reportError(new Error('x'))).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
