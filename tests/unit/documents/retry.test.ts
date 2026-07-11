/**
 * Unit Tests: withRetry (backoff exponencial para llamadas a Drive)
 * src/lib/retry.ts
 */

import { withRetry } from '@/lib/retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('devuelve el resultado al primer intento sin esperar', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta con backoff exponencial y termina exitoso', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient 1'))
      .mockRejectedValueOnce(new Error('transient 2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 100 });
    // 1er reintento a los 100ms, 2do a los 200ms (exponencial)
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras agotar los intentos y lanza el último error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permanente'));

    const promise = withRetry(fn, { attempts: 3, baseDelayMs: 10 });
    promise.catch(() => {}); // evitar unhandled rejection durante los timers
    await jest.advanceTimersByTimeAsync(10 + 20);

    await expect(promise).rejects.toThrow('permanente');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('no reintenta errores marcados como no-retryables', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('404 not found'));

    await expect(
      withRetry(fn, {
        isRetryable: (e) => !(e as Error).message.includes('404'),
      }),
    ).rejects.toThrow('404');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
