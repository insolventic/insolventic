'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import {
  getNotificationsInputSchema,
  getNotificationsOutputSchema,
  deleteNotificationInputSchema,
  deleteNotificationOutputSchema,
  getNotificationStatsInputSchema,
  getNotificationStatsOutputSchema,
  notificationTypeSchema,
} from './schemas';

export async function getNotifications(
  input: z.infer<typeof getNotificationsInputSchema> = {
    limit: 50,
    offset: 0,
  },
): Promise<{
  success: boolean;
  data?: z.infer<typeof getNotificationsOutputSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.VER_NOTIFICACIONES);
    if (!hasPermission) {
      return {
        success: false,
        error: 'No tienes permisos para ver notificaciones',
      };
    }

    const validatedInput = getNotificationsInputSchema.parse(input);
    const { userId, type, limit, offset } = validatedInput;

    const where = {
      userId: userId || user.id,
      tenantId,
      ...(type && { type }),
    };

    const [notificationsRaw, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              debtorName: true,
              type: true,
            },
          },
        },
        orderBy: [{ createdDate: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    const notifications = notificationsRaw.map((notification) => ({
      ...notification,
      type: notification.type as
        | 'case_created'
        | 'case_updated'
        | 'case_deleted'
        | 'creditor_created'
        | 'creditor_updated'
        | 'creditor_deleted'
        | 'debtor_created'
        | 'debtor_updated'
        | 'debtor_deleted'
        | 'user_created'
        | 'user_updated'
        | 'user_deleted'
        | 'role_created'
        | 'role_updated'
        | 'role_deleted',
    }));

    const result = getNotificationsOutputSchema.parse({
      notifications,
      total,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting notifications:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener notificaciones',
    };
  }
}

export async function deleteNotification(
  input: z.infer<typeof deleteNotificationInputSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof deleteNotificationOutputSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.GESTIONAR_NOTIFICACIONES);
    if (!hasPermission) {
      return {
        success: false,
        error: 'No tienes permisos para eliminar notificaciones',
      };
    }

    const validatedInput = deleteNotificationInputSchema.parse(input);
    const { notificationId } = validatedInput;

    const notification = await prisma.notification.findUnique({
      where: {
        id: notificationId,
        tenantId,
      },
    });

    if (!notification) {
      return { success: false, error: 'Notificación no encontrada' };
    }

    if (notification.userId !== user.id) {
      return {
        success: false,
        error: 'No tienes permisos para eliminar esta notificación',
      };
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    revalidatePath('/notifications');
    revalidatePath('/dashboard');

    const result = deleteNotificationOutputSchema.parse({ success: true });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar notificación',
    };
  }
}

export async function getNotificationStats(
  input: z.infer<typeof getNotificationStatsInputSchema> = {},
): Promise<{
  success: boolean;
  data?: z.infer<typeof getNotificationStatsOutputSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.VER_NOTIFICACIONES);
    if (!hasPermission) {
      return {
        success: false,
        error: 'No tienes permisos para ver estadísticas de notificaciones',
      };
    }

    const validatedInput = getNotificationStatsInputSchema.parse(input);
    const { userId } = validatedInput;
    const finalUserId = userId || user.id;

    const [total, byType] = await Promise.all([
      prisma.notification.count({ where: { userId: finalUserId, tenantId } }),
      Promise.all([
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'case_created' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'case_updated' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'case_deleted' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'creditor_created' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'creditor_updated' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'creditor_deleted' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'debtor_created' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'debtor_updated' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'debtor_deleted' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'user_created' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'user_updated' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'user_deleted' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'role_created' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'role_updated' },
        }),
        prisma.notification.count({
          where: { userId: finalUserId, tenantId, type: 'role_deleted' },
        }),
      ]),
    ]);

    const result = getNotificationStatsOutputSchema.parse({
      total,
      byType: {
        case_created: byType[0],
        case_updated: byType[1],
        case_deleted: byType[2],
        creditor_created: byType[3],
        creditor_updated: byType[4],
        creditor_deleted: byType[5],
        debtor_created: byType[6],
        debtor_updated: byType[7],
        debtor_deleted: byType[8],
        user_created: byType[9],
        user_updated: byType[10],
        user_deleted: byType[11],
        role_created: byType[12],
        role_updated: byType[13],
        role_deleted: byType[14],
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener estadísticas de notificaciones',
    };
  }
}

export async function createNotificationForAction(
  type: z.infer<typeof notificationTypeSchema>,
  entityName: string,
  prisma: PrismaClient,
  tenantId: string,
  entityId?: string,
  caseId?: string,
  targetUserIds?: string[],
) {
  const actionMap = {
    case_created: { action: 'creado', entity: 'caso' },
    case_updated: { action: 'actualizado', entity: 'caso' },
    case_deleted: { action: 'eliminado', entity: 'caso' },
    creditor_created: { action: 'creado', entity: 'acreedor' },
    creditor_updated: { action: 'actualizado', entity: 'acreedor' },
    creditor_deleted: { action: 'eliminado', entity: 'acreedor' },
    debtor_created: { action: 'creado', entity: 'deudor' },
    debtor_updated: { action: 'actualizado', entity: 'deudor' },
    debtor_deleted: { action: 'eliminado', entity: 'deudor' },
    user_created: { action: 'creado', entity: 'usuario' },
    user_updated: { action: 'actualizado', entity: 'usuario' },
    user_deleted: { action: 'eliminado', entity: 'usuario' },
    role_created: { action: 'creado', entity: 'rol' },
    role_updated: { action: 'actualizado', entity: 'rol' },
    role_deleted: { action: 'eliminado', entity: 'rol' },
  };

  const { action, entity } = actionMap[type];
  const title = `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${action}`;
  const message = `Se ha ${action} ${entity === 'acreedor' ? 'el' : entity === 'deudor' ? 'el' : entity === 'usuario' ? 'el' : entity === 'caso' ? 'el' : 'el'} ${entity} "${entityName}"`;

  let usersToNotify: string[] = [];

  if (targetUserIds) {
    usersToNotify = targetUserIds;
  } else {
    const entityPermissionMap = {
      case: 'Ver casos',
      creditor: 'Ver acreedores',
      debtor: 'Ver deudores',
      user: 'Ver usuarios',
      role: 'Ver roles',
    };

    const entityType =
      entity === 'acreedor'
        ? 'creditor'
        : entity === 'deudor'
          ? 'debtor'
          : entity === 'caso'
            ? 'case'
            : entity === 'usuario'
              ? 'user'
              : 'role';

    const requiredPermission =
      entityPermissionMap[entityType as keyof typeof entityPermissionMap];

    const usersWithPermission = await prisma.user.findMany({
      where: {
        tenantId,
        role: {
          permissions: {
            some: {
              permission: {
                name: requiredPermission,
              },
            },
          },
        },
      },
      select: { id: true },
    });

    usersToNotify = usersWithPermission.map((user) => user.id);
  }

  const notifications = usersToNotify.map((userId) => ({
    type,
    title,
    message,
    userId,
    caseId: caseId || null,
    relatedId: entityId || null,
    tenantId,
  }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({
      data: notifications,
    });

    revalidatePath('/notifications');
    revalidatePath('/dashboard');
  }
}
