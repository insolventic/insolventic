'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction = 'created' | 'updated' | 'deleted';

export type AuditEntityType =
  | 'case'
  | 'debtor'
  | 'creditor'
  | 'user'
  | 'role'
  | 'contact'
  | 'document';

export interface AuditActorInfo {
  userId: string;
  userName: string;
  userCedula: string;
}

// ---------------------------------------------------------------------------
// Core: createAuditLog (non-blocking, fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Creates an immutable audit log entry. Call this from any server action
 * that mutates data. Designed to be non-blocking (fire-and-forget).
 */
export async function createAuditLog(params: {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  actor: AuditActorInfo;
  tenantId: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const {
    action,
    entityType,
    entityId,
    entityName,
    actor,
    tenantId,
    metadata,
  } = params;

  const actionLabels: Record<AuditAction, string> = {
    created: 'creado',
    updated: 'actualizado',
    deleted: 'eliminado',
  };

  const entityLabels: Record<
    AuditEntityType,
    { label: string; article: string }
  > = {
    case: { label: 'caso', article: 'el' },
    debtor: { label: 'deudor', article: 'el' },
    creditor: { label: 'acreedor', article: 'el' },
    user: { label: 'usuario', article: 'el' },
    role: { label: 'rol', article: 'el' },
    contact: { label: 'contacto', article: 'el' },
    document: { label: 'documento', article: 'el' },
  };

  const actionLabel = actionLabels[action];
  const { label, article } = entityLabels[entityType];

  const description = `Se ha ${actionLabel} ${article} ${label} '${entityName}' por el usuario ${actor.userName} con cédula ${actor.userCedula}`;

  // Fire-and-forget — no await, don't block the caller
  void prisma.auditLog
    .create({
      data: {
        action,
        entityType,
        entityId,
        entityName,
        userId: actor.userId,
        userName: actor.userName,
        userCedula: actor.userCedula,
        description,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        tenantId,
      },
    })
    .catch((error) => {
      console.error('Error creating audit log:', error);
    });
}

// ---------------------------------------------------------------------------
// Query: getAuditLogs (paginated, filterable)
// ---------------------------------------------------------------------------

const getAuditLogsInputSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  entityType: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type GetAuditLogsInput = z.infer<typeof getAuditLogsInputSchema>;

export async function getAuditLogs(
  input: GetAuditLogsInput = { page: 1, pageSize: 20 },
) {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_AUDITORIA)) {
      return {
        success: false,
        error: 'No tienes permisos para ver la auditoría',
      };
    }

    const validated = getAuditLogsInputSchema.parse(input);
    const {
      page,
      pageSize,
      entityType,
      action,
      userId,
      search,
      dateFrom,
      dateTo,
    } = validated;

    const where: Record<string, unknown> = { tenantId };

    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }
      where.createdAt = createdAt;
    }

    if (search) {
      where.OR = [
        { entityName: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          entityName: log.entityName,
          userId: log.userId,
          userName: log.userName,
          userCedula: log.userCedula,
          description: log.description,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener registros de auditoría',
    };
  }
}

// ---------------------------------------------------------------------------
// Query: getAuditLogUsers (for filter dropdown)
// ---------------------------------------------------------------------------

export async function getAuditLogUsers() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_AUDITORIA)) {
      return {
        success: false,
        error: 'No tienes permisos para ver la auditoría',
      };
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: users };
  } catch (error) {
    console.error('Error getting audit log users:', error);
    return { success: false, error: 'Error al obtener usuarios' };
  }
}
