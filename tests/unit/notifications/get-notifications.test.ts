/**
 * Regresión: `getNotifications` reventaba con ZodError en cuanto una fila
 * tenía un `type` fuera de `NOTIFICATION_TYPES` — en particular
 * 'document_generation'/'document_generation_failed' (emitidas por
 * generation-job.ts), que no estaban en el enum aunque el código ya las
 * creaba en BD desde julio (P4). La bandeja entera quedaba rota para
 * cualquier usuario con una de esas notificaciones.
 *
 * Dos cosas se verifican por separado:
 *  1. Las dos emitidas por generation-job.ts ahora son valores legítimos del
 *     enum — se leen tal cual, sin degradar.
 *  2. Un `type` que NO esté en el enum (futuro, o una fila corrupta) no
 *     tumba la bandeja entera: esa fila se degrada a 'system' y se registra
 *     con el logger, pero el resto de notificaciones se sigue viendo.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/cache', () => require('../../__mocks__/next-cache'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { TENANT } from '../../helpers/fixtures';
import { logger } from '@/lib/logger';
import { getNotifications } from '@/features/notification/actions';

function signIn() {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'Usuario de prueba',
      email: 'prueba@test.com',
      permissions: ['Ver notificaciones'],
    },
    tenantId: TENANT.id,
  });
}

const BASE_ROW = {
  id: 'notif-1',
  title: 'Documentos generados',
  message: 'Se generaron 3 documentos',
  userId: 'user-1',
  caseId: 'case-1',
  relatedId: 'req-1',
  read: false,
  createdDate: new Date('2026-10-18T10:00:00.000Z'),
  case: null,
};

describe('getNotifications', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    signIn();
  });

  it('lee sin error una notificación real de generación de documentos (caso de generation-job.ts)', async () => {
    mockPrisma.notification.findMany.mockResolvedValueOnce([
      { ...BASE_ROW, type: 'document_generation' },
    ]);
    mockPrisma.notification.count.mockResolvedValueOnce(1);

    const result = await getNotifications();

    expect(result.success).toBe(true);
    expect(result.data?.notifications).toHaveLength(1);
    expect(result.data?.notifications[0].type).toBe('document_generation');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('lee sin error una notificación de generación fallida', async () => {
    mockPrisma.notification.findMany.mockResolvedValueOnce([
      {
        ...BASE_ROW,
        id: 'notif-2',
        type: 'document_generation_failed',
        title: 'Falló la generación de documentos',
      },
    ]);
    mockPrisma.notification.count.mockResolvedValueOnce(1);

    const result = await getNotifications();

    expect(result.success).toBe(true);
    expect(result.data?.notifications[0].type).toBe(
      'document_generation_failed',
    );
  });

  it('un type desconocido se degrada a "system" y se registra, sin romper el resto de la bandeja', async () => {
    mockPrisma.notification.findMany.mockResolvedValueOnce([
      { ...BASE_ROW, id: 'notif-ok', type: 'case_created' },
      { ...BASE_ROW, id: 'notif-raro', type: 'algo_que_no_existe_todavia' },
    ]);
    mockPrisma.notification.count.mockResolvedValueOnce(2);

    const result = await getNotifications();

    expect(result.success).toBe(true);
    expect(result.data?.notifications).toHaveLength(2);
    expect(result.data?.notifications[0].type).toBe('case_created');
    expect(result.data?.notifications[1].type).toBe('system');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('type desconocido'),
      expect.objectContaining({
        action: 'get-notifications',
        notificationId: 'notif-raro',
        rawType: 'algo_que_no_existe_todavia',
      }),
    );
  });
});
