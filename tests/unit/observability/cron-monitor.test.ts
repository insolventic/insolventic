/**
 * Unit Tests: el heartbeat del cron (O-4).
 *
 * Un cron que deja de correr no produce un error que reportar: produce
 * **silencio**, y el silencio es justo lo que ningún `logger.error` detecta.
 * Hoy eso se descubre cuando un operador nota que no le llegaron los avisos.
 * Detectar una ausencia necesita que alguien espere la señal, y eso es un cron
 * monitor (hallazgo O-4 de `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * Lo que estos tests fijan es que la señal se manda con la forma correcta —el
 * slug y la programación son con lo que Sentry decide que una corrida falta— y
 * que nada de esto puede tumbar el cron que vigila.
 */

const mockCaptureCheckIn = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(true);
jest.mock('@sentry/nextjs', () => ({
  captureCheckIn: (...args: unknown[]) => mockCaptureCheckIn(...args),
  flush: (...args: unknown[]) => mockFlush(...args),
}));

import {
  CRON_MONITOR_SLUG,
  cronCheckInFinish,
  cronCheckInStart,
} from '@/lib/cron-monitor';

describe('cronCheckInStart', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureCheckIn.mockReturnValue('check-in-1');
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('sin DSN no manda nada: el cron corre idéntico', async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const id = await cronCheckInStart();

    expect(id).toBeUndefined();
    expect(mockCaptureCheckIn).not.toHaveBeenCalled();
  });

  it('con DSN abre la corrida con el slug y la programación del cron', async () => {
    process.env.SENTRY_DSN = 'https://clave@o1.ingest.sentry.io/1';

    const id = await cronCheckInStart();

    expect(id).toBe('check-in-1');
    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: CRON_MONITOR_SLUG, status: 'in_progress' },
      // La programación tiene que ser la misma que la de `vercel.json`: es con
      // esto con lo que Sentry decide que una corrida falta.
      expect.objectContaining({
        schedule: { type: 'crontab', value: '0 8 * * *' },
      }),
    );
  });

  it('si el envío falla, devuelve undefined en vez de lanzar', async () => {
    process.env.SENTRY_DSN = 'https://clave@o1.ingest.sentry.io/1';
    mockCaptureCheckIn.mockImplementation(() => {
      throw new Error('Sentry no responde');
    });

    // Un problema del monitor no puede tumbar al cron que vigila.
    await expect(cronCheckInStart()).resolves.toBeUndefined();
  });
});

describe('cronCheckInFinish', () => {
  beforeEach(() => {
    // `clearAllMocks` borra las llamadas pero NO las implementaciones: sin el
    // reset, el mock que lanza del describe anterior sigue puesto.
    mockCaptureCheckIn.mockReset();
    mockCaptureCheckIn.mockReturnValue('check-in-1');
    mockFlush.mockClear();
  });

  it('sin id no manda nada (no se habia abierto ninguna corrida)', async () => {
    await cronCheckInFinish(undefined, 'ok');

    expect(mockCaptureCheckIn).not.toHaveBeenCalled();
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('cierra la corrida con el mismo id y hace flush explícito', async () => {
    await cronCheckInFinish('check-in-1', 'ok');

    expect(mockCaptureCheckIn).toHaveBeenCalledWith({
      checkInId: 'check-in-1',
      monitorSlug: CRON_MONITOR_SLUG,
      status: 'ok',
    });
    // Sin flush el evento queda encolado y la función se congela al
    // responder: el mismo motivo por el que `onRequestError` lo hace.
    expect(mockFlush).toHaveBeenCalled();
  });

  it('puede cerrar como error', async () => {
    await cronCheckInFinish('check-in-1', 'error');

    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('un fallo al cerrar tampoco lanza', async () => {
    mockCaptureCheckIn.mockImplementation(() => {
      throw new Error('Sentry no responde');
    });

    await expect(
      cronCheckInFinish('check-in-1', 'ok'),
    ).resolves.toBeUndefined();
  });
});
