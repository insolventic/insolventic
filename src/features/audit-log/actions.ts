'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import { logger } from '@/lib/logger';

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
 * Crea una entrada inmutable de auditoría. Se llama desde cualquier server
 * action que mute datos.
 *
 * GC-M4 — POR QUÉ ESTO CAMBIÓ. La función hacía
 * `void prisma.auditLog.create(...)`: programaba el insert y volvía de
 * inmediato. Consecuencia que no es evidente: **un `await createAuditLog(...)`
 * en el call-site no esperaba nada**. Poner `await` en las 16 llamadas de
 * `case/actions.ts` sin tocar esto habría sido puramente cosmético.
 *
 * En Vercel serverless eso no es teórico: la función puede terminar al
 * devolver la respuesta y matar el insert en vuelo. Un expediente legal
 * modificado o borrado quedaba sin registro, de forma intermitente y
 * silenciosa — el peor modo de falla posible para una tabla de auditoría.
 *
 * Ahora SE ESPERA el insert. Lo que NO cambia es que nunca lanza: devuelve
 * `{ ok: false }`. El motivo es concreto: hay 8 módulos más que la invocan
 * como `void createAuditLog(...)`, y si empezara a rechazar, cada uno de esos
 * `void` se convertiría en una unhandled rejection. Devolver un resultado deja
 * que cada llamador decida — `deleteCase` aborta el borrado si la auditoría no
 * quedó; una alta de deuda sigue adelante y deja constancia en el log.
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

  try {
    await prisma.auditLog.create({
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
    });
    return { ok: true as const };
  } catch (error) {
    // No se relanza: ver el docblock. Pero sí se reporta — una auditoría que
    // no se escribe es un incidente, no un evento esperado, así que va a
    // Sentry vía `logger.error`.
    logger.error('No se pudo escribir el registro de auditoría', error, {
      action: 'createAuditLog',
      entityType,
      entityId,
      auditedAction: action,
    });
    return { ok: false as const };
  }
}

// ---------------------------------------------------------------------------
// Query: getAuditLogs (paginated, filterable)
// ---------------------------------------------------------------------------

const getAuditLogsInputSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
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
      entityId,
      action,
      userId,
      search,
      dateFrom,
      dateTo,
    } = validated;

    const where: Record<string, unknown> = { tenantId };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
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
          metadata: log.metadata as Record<string, string> | null,
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

// ---------------------------------------------------------------------------
// Export: exportAuditLogToExcel
// ---------------------------------------------------------------------------

export async function exportAuditLogToExcel(
  input: GetAuditLogsInput = { page: 1, pageSize: 10000 },
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_AUDITORIA)) {
      return { success: false, error: 'No tienes permisos para exportar' };
    }

    const validated = getAuditLogsInputSchema.parse({
      ...input,
      page: 1,
      pageSize: 10000,
    });

    const where: Record<string, unknown> = { tenantId };
    if (validated.entityType) where.entityType = validated.entityType;
    if (validated.action) where.action = validated.action;
    if (validated.userId) where.userId = validated.userId;

    if (validated.dateFrom || validated.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (validated.dateFrom) createdAt.gte = new Date(validated.dateFrom);
      if (validated.dateTo) {
        const endDate = new Date(validated.dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }
      where.createdAt = createdAt;
    }

    if (validated.search) {
      where.OR = [
        { entityName: { contains: validated.search, mode: 'insensitive' } },
        { userName: { contains: validated.search, mode: 'insensitive' } },
        { description: { contains: validated.search, mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Auditoría');

    sheet.columns = [
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'Acción', key: 'action', width: 12 },
      { header: 'Entidad', key: 'entityType', width: 12 },
      { header: 'Nombre Entidad', key: 'entityName', width: 25 },
      { header: 'Descripción', key: 'description', width: 50 },
      { header: 'Usuario', key: 'userName', width: 25 },
      { header: 'Cédula', key: 'userCedula', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    for (const log of logs) {
      sheet.addRow({
        createdAt: log.createdAt.toLocaleString('es-CO'),
        action: log.action,
        entityType: log.entityType,
        entityName: log.entityName,
        description: log.description,
        userName: log.userName,
        userCedula: log.userCedula,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { success: true, data: base64 };
  } catch (error) {
    console.error('Error exporting audit log:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al exportar auditoría',
    };
  }
}
