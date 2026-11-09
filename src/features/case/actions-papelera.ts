'use server';

/**
 * Papelera de expedientes: listar, restaurar y eliminar definitivamente.
 *
 * `deleteCase` (en `actions.ts`) manda un caso a la papelera. Desde acá se
 * deshace (`restoreCase`) o se destruye (`purgeCase`). Decisiones del dueño
 * del proyecto (2026-11-08):
 *
 *   - Ver la papelera y restaurar: el mismo permiso que manda a la papelera,
 *     `Eliminar casos`. Sin permisos nuevos.
 *   - Eliminar definitivamente: permiso propio, `Eliminar casos
 *     definitivamente`, que la migración `20261109000000_case_papelera` da
 *     SOLO al rol Administrador. Existe para poder cumplir una solicitud de
 *     supresión (Ley 1581, `docs/PROCEDIMIENTO_ARCO.md`); nunca corre sola.
 *
 * Todas las consultas de este archivo piden la papelera de forma explícita
 * (`soloPapelera`): sin eso, la extensión de `src/lib/prisma.ts` ocultaría
 * justo los casos que acá se quieren ver.
 */

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { authenticateUser } from '@/features/auth/actions';
import { createAuditLog } from '@/features/audit-log/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { soloPapelera } from '@/lib/papelera';
import { mensajeDeError } from '@/lib/error-de-accion';

import {
  assertCaseAccessOnRow,
  caseWhereFromVisibility,
  isCaseAccessError,
  resolveCaseVisibility,
} from './case-access';
import { deleteCaseSchema } from './schemas';

export interface CasoEnPapelera {
  id: string;
  caseNumber: string;
  debtorName: string;
  type: string;
  phase: string | null;
  deletedAt: Date;
  deletedByName: string | null;
}

const restoreCaseSchema = z.object({ id: z.string().min(1) });

/** Un caso de la papelera, acotado por centro y por la visibilidad del rol. */
async function cargarDeLaPapelera(params: {
  id: string;
  tenantId: string;
  user: { id: string; email: string; permissions: string[] };
}) {
  const { id, tenantId, user } = params;
  const fila = await prisma.case.findFirst({
    where: { id, tenantId, ...soloPapelera },
    select: {
      id: true,
      caseNumber: true,
      debtorName: true,
      type: true,
      phase: true,
      operatorId: true,
      debtorId: true,
      driveFolderId: true,
      deletedAt: true,
      deletedByName: true,
      _count: {
        select: {
          documents: true,
          debts: true,
          assets: true,
          dependents: true,
          payments: true,
        },
      },
    },
  });
  if (!fila) return null;
  // Misma regla de visibilidad que un caso activo: un rol acotado a sus
  // propios expedientes no ve ni restaura los de otro.
  await assertCaseAccessOnRow({ caseRow: fila, user, tenantId });
  return fila;
}

export async function getDeletedCases(): Promise<{
  success: boolean;
  data?: CasoEnPapelera[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();
    if (!user.permissions.includes(P.ELIMINAR_CASOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver la papelera',
      };
    }

    const alcance = caseWhereFromVisibility(
      await resolveCaseVisibility(user, tenantId),
    );
    if (!alcance) return { success: true, data: [] };

    const casos = await prisma.case.findMany({
      where: { tenantId, ...alcance, ...soloPapelera },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        type: true,
        phase: true,
        deletedAt: true,
        deletedByName: true,
      },
    });

    return {
      success: true,
      // `soloPapelera` garantiza `deletedAt` no nulo; el tipo de Prisma no lo
      // sabe.
      data: casos.map((c) => ({ ...c, deletedAt: c.deletedAt as Date })),
    };
  } catch (error) {
    logger.error('Error al listar la papelera', error, {
      action: 'get-deleted-cases',
    });
    return {
      success: false,
      error: mensajeDeError(error, 'Error al cargar la papelera'),
    };
  }
}

export async function restoreCase(
  input: z.infer<typeof restoreCaseSchema>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, tenantId } = await authenticateUser();
    if (!user.permissions.includes(P.ELIMINAR_CASOS)) {
      return {
        success: false,
        error: 'No tienes permisos para restaurar casos',
      };
    }

    const { id } = restoreCaseSchema.parse(input);
    const fila = await cargarDeLaPapelera({ id, tenantId, user });
    if (!fila) {
      return { success: false, error: 'El caso no está en la papelera' };
    }

    // El `where` con `soloPapelera`: si otro usuario lo restauró o lo eliminó
    // definitivamente entre la lectura y acá, el update falla en vez de
    // escribir sobre una fila que ya no está en la papelera.
    await prisma.case.update({
      where: { id, tenantId, ...soloPapelera },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });

    // Restaurar se audita pero no aborta si la auditoría falla: devuelve un
    // expediente a la vista, no destruye nada (criterio de `createAuditLog`).
    await createAuditLog({
      action: 'restored',
      entityType: 'case',
      entityId: id,
      entityName: `${fila.caseNumber} - ${fila.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        caseNumber: fila.caseNumber,
        deletedAt: fila.deletedAt ? fila.deletedAt.toISOString() : null,
        deletedByName: fila.deletedByName,
      },
    });

    revalidateTag('cases');
    return { success: true };
  } catch (error) {
    if (isCaseAccessError(error)) {
      logger.info('Restauración denegada', { action: 'restore-case' });
    } else {
      logger.error('Error al restaurar el caso', error, {
        action: 'restore-case',
      });
    }
    return {
      success: false,
      error: mensajeDeError(error, 'Error al restaurar el caso'),
    };
  }
}

export async function purgeCase(
  input: z.infer<typeof deleteCaseSchema>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, tenantId } = await authenticateUser();
    if (!user.permissions.includes(P.ELIMINAR_CASOS_DEFINITIVAMENTE)) {
      return {
        success: false,
        error: 'No tienes permisos para eliminar casos definitivamente',
      };
    }

    const { id, confirmCaseNumber } = deleteCaseSchema.parse(input);
    // Solo desde la papelera: un caso activo no se puede destruir de un paso.
    const fila = await cargarDeLaPapelera({ id, tenantId, user });
    if (!fila) {
      return {
        success: false,
        error:
          'Solo se puede eliminar definitivamente un caso que esté en la papelera',
      };
    }

    // Confirmación contra el número que tiene la base, no contra el payload.
    if (confirmCaseNumber.trim() !== fila.caseNumber) {
      return {
        success: false,
        error: `El número del caso no coincide. Escriba exactamente "${fila.caseNumber}" para confirmar la eliminación definitiva.`,
      };
    }

    // Auditoría ANTES de destruir, y esperada: si no queda escrita, no se
    // borra. Mismo snapshot no sensible que tenía `deleteCase` cuando borraba:
    // número, tipo, fase y conteos; nada de cédula, ingresos ni acreedores.
    const registro = await createAuditLog({
      action: 'purged',
      entityType: 'case',
      entityId: id,
      entityName: `${fila.caseNumber} - ${fila.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        caseNumber: fila.caseNumber,
        type: fila.type,
        phase: fila.phase,
        documentCount: fila._count.documents,
        debtCount: fila._count.debts,
        assetCount: fila._count.assets,
        dependentCount: fila._count.dependents,
        paymentCount: fila._count.payments,
        deletedAt: fila.deletedAt ? fila.deletedAt.toISOString() : null,
        deletedByName: fila.deletedByName,
        // GC-M6 sigue pendiente: la carpeta de Drive no se borra. Se registra
        // el id para que una limpieza posterior sepa qué buscar.
        driveFolderId: fila.driveFolderId,
        driveFolderDeleted: false,
        confirmedByTypingCaseNumber: true,
      },
    });
    if (!registro.ok) {
      return {
        success: false,
        error:
          'No se pudo registrar la eliminación en la auditoría. El caso NO fue eliminado. Intente de nuevo.',
      };
    }

    // El borrado físico que antes hacía `deleteCase`. Los modelos sin
    // `onDelete: Cascade` se borran a mano primero; Apoderado, Notification,
    // DocumentGenerationRequest y Payment caen en cascada con el caso.
    await prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({ where: { caseId: id, tenantId } });
      await tx.debt.deleteMany({ where: { caseId: id, tenantId } });
      await tx.asset.deleteMany({ where: { caseId: id, tenantId } });
      await tx.legalProcess.deleteMany({ where: { caseId: id, tenantId } });
      await tx.libranza.deleteMany({ where: { caseId: id, tenantId } });
      await tx.suspendedService.deleteMany({ where: { caseId: id, tenantId } });
      await tx.dependent.deleteMany({ where: { caseId: id, tenantId } });
      // `soloPapelera` en el `where`: la extensión no deja borrar un caso
      // activo ni aunque alguien lo restaure en medio de esta transacción.
      await tx.case.delete({ where: { id, tenantId, ...soloPapelera } });
    });

    revalidateTag('cases');
    return { success: true };
  } catch (error) {
    if (isCaseAccessError(error)) {
      logger.info('Eliminación definitiva denegada', { action: 'purge-case' });
    } else {
      logger.error('Error al eliminar definitivamente el caso', error, {
        action: 'purge-case',
      });
    }
    return {
      success: false,
      error: mensajeDeError(error, 'Error al eliminar definitivamente el caso'),
    };
  }
}
