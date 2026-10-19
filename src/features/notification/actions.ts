'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { emailService } from '@/lib/email';
import { logger } from '@/lib/logger';
import {
  getNotificationsInputSchema,
  getNotificationsOutputSchema,
  deleteNotificationInputSchema,
  deleteNotificationOutputSchema,
  getNotificationStatsInputSchema,
  getNotificationStatsOutputSchema,
  notificationTypeSchema,
  NOTIFICATION_TYPES,
  type NotificationType,
  type CrudNotificationType,
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

    const notifications = notificationsRaw.map((notification) => {
      const parsedType = notificationTypeSchema.safeParse(notification.type);
      if (!parsedType.success) {
        logger.warn('Notificación con type desconocido — se muestra como genérica', {
          action: 'get-notifications',
          notificationId: notification.id,
          rawType: notification.type,
        });
      }
      return {
        ...notification,
        type: parsedType.success ? parsedType.data : ('system' as NotificationType),
      };
    });

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

export async function getUnreadCount(): Promise<{
  success: boolean;
  data?: number;
}> {
  try {
    const { user, tenantId } = await authenticateUser();
    const count = await prisma.notification.count({
      where: { userId: user.id, tenantId, read: false },
    });
    return { success: true, data: count };
  } catch {
    return { success: true, data: 0 };
  }
}

export async function markAsRead(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId, tenantId },
    });

    if (!notification || notification.userId !== user.id) {
      return { success: false, error: 'Notificación no encontrada' };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    revalidatePath('/notifications');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al marcar notificación como leída',
    };
  }
}

export async function markAllAsRead(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    await prisma.notification.updateMany({
      where: { userId: user.id, tenantId, read: false },
      data: { read: true },
    });

    revalidatePath('/notifications');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al marcar notificaciones como leídas',
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

    // One groupBy roundtrip instead of 15+ individual counts — scales cleanly
    // as new notification types are added.
    const [total, grouped] = await Promise.all([
      prisma.notification.count({ where: { userId: finalUserId, tenantId } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId: finalUserId, tenantId },
        _count: { _all: true },
      }),
    ]);

    const byType = Object.fromEntries(
      NOTIFICATION_TYPES.map((t) => [t, 0]),
    ) as Record<NotificationType, number>;
    for (const row of grouped) {
      if ((NOTIFICATION_TYPES as readonly string[]).includes(row.type)) {
        byType[row.type as NotificationType] = row._count._all;
      }
    }

    const result = getNotificationStatsOutputSchema.parse({
      total,
      byType,
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

interface ActionActorInfo {
  name: string;
  email: string;
  roleName: string;
  professionalCard: string;
}

export async function createNotificationForAction(
  type: CrudNotificationType,
  entityName: string,
  prisma: PrismaClient,
  tenantId: string,
  entityId?: string,
  caseId?: string,
  targetUserIds?: string[],
  actorInfo?: ActionActorInfo,
) {
  const actionMap = {
    case_created: { action: 'creado', entity: 'caso' },
    case_updated: { action: 'actualizado', entity: 'caso' },
    case_deleted: { action: 'eliminado', entity: 'caso' },
    creditor_created: { action: 'creado', entity: 'acreedor' },
    creditor_updated: {
      action: 'actualizado',
      entity: 'acreedor',
    },
    creditor_deleted: {
      action: 'eliminado',
      entity: 'acreedor',
    },
    debtor_created: { action: 'creado', entity: 'deudor' },
    debtor_updated: {
      action: 'actualizado',
      entity: 'deudor',
    },
    debtor_deleted: { action: 'eliminado', entity: 'deudor' },
    user_created: { action: 'creado', entity: 'usuario' },
    user_updated: {
      action: 'actualizado',
      entity: 'usuario',
    },
    user_deleted: { action: 'eliminado', entity: 'usuario' },
    role_created: { action: 'creado', entity: 'rol' },
    role_updated: { action: 'actualizado', entity: 'rol' },
    role_deleted: { action: 'eliminado', entity: 'rol' },
  };

  const { action, entity } = actionMap[type];
  const title = `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${action}`;
  const article =
    entity === 'acreedor'
      ? 'el'
      : entity === 'deudor'
        ? 'el'
        : entity === 'usuario'
          ? 'el'
          : entity === 'caso'
            ? 'el'
            : 'el';

  let message: string;
  if (actorInfo) {
    message = `Se ha ${action} ${article} ${entity} '${entityName}' por el usuario ${actorInfo.name} con cédula ${actorInfo.professionalCard}`;
  } else {
    message = `Se ha ${action} ${article} ${entity} '${entityName}'`;
  }

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

  // Email admin notification (fire-and-forget, don't block the action)
  if (actorInfo) {
    void (async () => {
      try {
        const adminUsers = await prisma.user.findMany({
          where: {
            tenantId,
            role: { name: 'Administrador' },
          },
          select: { email: true, name: true },
        });

        for (const admin of adminUsers) {
          await emailService.sendActionNotificationEmail(admin.email, {
            adminName: admin.name,
            actorName: actorInfo.name,
            actorEmail: actorInfo.email,
            actorRole: actorInfo.roleName,
            action: action,
            entity: entity,
            entityName: entityName,
            database: tenantId,
            date: new Date(),
          });
        }
      } catch (error) {
        console.error('Error sending admin notification email:', error);
      }
    })();
  }
}
