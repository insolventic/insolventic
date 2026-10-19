/**
 * `getNotifications` contra Postgres real, con una notificación tal como la
 * crea `generation-job.ts` (`notifyRequester`) al terminar un job de
 * generación en background — y una fila con un `type` que el enum no
 * reconoce, para confirmar que no tumba la bandeja (ver
 * tests/unit/notifications/get-notifications.test.ts para el detalle del
 * porqué: `document_generation`/`document_generation_failed` no estaban en
 * `NOTIFICATION_TYPES` desde que P4 las empezó a emitir en julio).
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import { P } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { getNotifications } from '@/features/notification/actions';
import { mockCookies } from '../__mocks__/next-headers';
import { crearTenantDePrueba, purgeTenant } from './helpers/tenant';

const TAG = `notif-generacion-${Date.now().toString(36)}`;

const ctx = { tenantId: '', userId: '' };

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('getNotifications — notificaciones de generación de documentos (Postgres real)', () => {
  beforeAll(async () => {
    const tenant = await crearTenantDePrueba(TAG, [P.VER_NOTIFICACIONES]);
    ctx.tenantId = tenant.tenantId;
    ctx.userId = tenant.userId;
    mockCookies.setToken('access-token', tenant.token);

    // Mismo shape exacto que `notifyRequester` en generation-job.ts.
    await prisma.notification.create({
      data: {
        type: 'document_generation',
        title: 'Documentos generados',
        message: 'Se generaron 3 documentos para el caso INS-001',
        userId: ctx.userId,
        caseId: null,
        relatedId: 'req-de-prueba',
        tenantId: ctx.tenantId,
      },
    });
    await prisma.notification.create({
      data: {
        type: 'document_generation_failed',
        title: 'Falló la generación de documentos',
        message: 'Drive API down',
        userId: ctx.userId,
        caseId: null,
        relatedId: 'req-de-prueba-2',
        tenantId: ctx.tenantId,
      },
    });
    // Fila deliberadamente corrupta/futura — simula un `type` que el enum
    // todavía no reconoce, para probar la degradación defensiva.
    await prisma.notification.create({
      data: {
        type: 'un_tipo_que_no_existe',
        title: 'Notificación con type desconocido',
        message: 'No debería tumbar la bandeja',
        userId: ctx.userId,
        caseId: null,
        relatedId: null,
        tenantId: ctx.tenantId,
      },
    });
  }, 30_000);

  it('lee las 3 filas sin reventar, con los tipos de generación intactos y el desconocido degradado a "system"', async () => {
    const result = await getNotifications({ limit: 50, offset: 0 });

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(3);

    const byMessage = Object.fromEntries(
      (result.data?.notifications ?? []).map((n) => [n.message, n.type]),
    );
    expect(byMessage['Se generaron 3 documentos para el caso INS-001']).toBe(
      'document_generation',
    );
    expect(byMessage['Drive API down']).toBe('document_generation_failed');
    expect(byMessage['No debería tumbar la bandeja']).toBe('system');
  });
});
