/** Smoke temporal — verificación manual de requestId auto-inyectado. */
import {
  runWithRequestContext,
  getRequestId,
} from '@/lib/request-context';
import { logger } from '@/lib/logger';

describe('requestId auto-injection (smoke)', () => {
  it('logger incluye requestId automáticamente dentro del contexto', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    runWithRequestContext('req-test-123', () => {
      expect(getRequestId()).toBe('req-test-123');
      logger.warn('mensaje de prueba', { action: 'smoke' });
    });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.requestId).toBe('req-test-123');
    expect(parsed.level).toBe('WARN');
    expect(parsed.action).toBe('smoke');
    spy.mockRestore();
  });

  it('fuera de contexto no hay requestId y un requestId explícito pisa al automático', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('sin contexto');
    expect(JSON.parse(spy.mock.calls[0][0] as string).requestId).toBeUndefined();

    runWithRequestContext('auto-id', () => {
      logger.warn('explícito gana', { requestId: 'manual-id' });
    });
    expect(JSON.parse(spy.mock.calls[1][0] as string).requestId).toBe('manual-id');
    spy.mockRestore();
  });
});
