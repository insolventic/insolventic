'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { createAuditLog } from '@/features/audit-log/actions';
import { resumirCambios, valoresAuditables } from '@/features/case/audit-diff';
import { assertCaseAccessOnRow } from '@/features/case/case-access';
import { createNotificationForAction } from '@/features/notification/actions';
import {
  HEARING_SCHEDULED_PHASE,
  PHASE_AFTER_HEARING_CANCELLED,
} from '@/lib/case-phases';
import { parseDateOnly } from '@/lib/date-colombia';
import { logger } from '@/lib/logger';
import { P, puedeVerCalendario } from '@/lib/permissions';

import {
  audienciaVigente,
  claveDia,
  esCasoCerrado,
  hoyColombia,
  tieneAudienciaPendiente,
  whereAudienciaEntre,
} from './audiencia';
import { cancelarAudienciaSchema, programarAudienciaSchema } from './schemas';

const hearingSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  debtorName: z.string(),
  version: z.number(),
  date: z.coerce.date(),
  time: z.string().nullable(),
  zoomLink: z.string().nullable(),
  phase: z.string().nullable(),
  type: z.string(),
});

export type Hearing = z.infer<typeof hearingSchema>;

export async function getHearings(input: {
  month: number;
  year: number;
}): Promise<{
  success: boolean;
  data?: Hearing[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!puedeVerCalendario(user.permissions)) {
      return {
        success: false,
        error: 'No tienes permisos para ver el calendario',
      };
    }

    const { month, year } = input;
    // En UTC, para no depender de la zona del servidor: las fechas se guardan
    // sin hora (mediodía UTC, o 00:00 UTC las filas viejas) y las dos caen dentro.
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Build visibility filter
    let visibilityFilter: Record<string, unknown> = {};
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (!canViewAllCases) {
      if (canViewOwnCases) {
        visibilityFilter = { operatorId: user.id };
      } else if (canViewAsClient) {
        const userDebtor = await prisma.debtor.findFirst({
          where: { email: user.email, tenantId },
          select: { id: true },
        });
        if (userDebtor) {
          visibilityFilter = { debtorId: userDebtor.id };
        } else {
          return { success: true, data: [] };
        }
      } else {
        return { success: true, data: [] };
      }
    }

    const cases = await prisma.case.findMany({
      where: {
        tenantId,
        ...visibilityFilter,
        ...whereAudienciaEntre(startDate, endDate),
      },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        version: true,
        hearingDate: true,
        hearingTime: true,
        firstHearingDate: true,
        firstHearingTime: true,
        zoomLink: true,
        phase: true,
        type: true,
      },
    });

    const typeMap: Record<string, string> = {
      INSOLVENCY: 'Insolvencia',
      CONCILIATION: 'Conciliación',
      SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
    };

    const hearings: Hearing[] = [];
    for (const c of cases) {
      const audiencia = audienciaVigente(c);
      if (!audiencia) continue;

      // Un caso cerrado ya no tiene audiencias por delante. Las que se celebraron
      // antes de cerrarlo siguen a la vista: son historia del expediente.
      if (esCasoCerrado(c.phase) && tieneAudienciaPendiente(c)) continue;

      hearings.push(
        hearingSchema.parse({
          id: c.id,
          caseNumber: c.caseNumber,
          debtorName: c.debtorName,
          version: c.version,
          date: audiencia.fecha,
          time: audiencia.hora,
          zoomLink: c.zoomLink,
          phase: c.phase,
          type: typeMap[c.type] ?? c.type,
        }),
      );
    }

    hearings.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { success: true, data: hearings };
  } catch (error) {
    logger.error('No se pudieron obtener las audiencias', error, {
      action: 'getHearings',
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener audiencias',
    };
  }
}

type ResultadoAudiencia = {
  success: boolean;
  error?: string;
  /** La fase a la que volvió el caso, si cancelar la cambió. */
  faseNueva?: string;
};

const CONFLICTO_DE_VERSION =
  'Este caso fue modificado por otro usuario. Recargue la página e intente de nuevo.';

const COLUMNAS_AUDIENCIA = {
  id: true,
  caseNumber: true,
  debtorName: true,
  phase: true,
  version: true,
  operatorId: true,
  debtorId: true,
  hearingDate: true,
  hearingTime: true,
  firstHearingDate: true,
  firstHearingTime: true,
} as const;

/**
 * Lo común de programar y cancelar: el caso del centro, si el usuario alcanza a
 * verlo. `assertCaseAccessOnRow` lanza si no; lo atrapa la action que llama.
 */
async function leerCasoParaAudiencia(
  caseId: string,
  user: Parameters<typeof assertCaseAccessOnRow>[0]['user'],
  tenantId: string,
) {
  const caso = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: COLUMNAS_AUDIENCIA,
  });
  if (caso) await assertCaseAccessOnRow({ caseRow: caso, user, tenantId });
  return caso;
}

/**
 * Escribe la audiencia con bloqueo optimista en la misma sentencia: el `version`
 * va en el `where`, así dos operadores simultáneos no se pisan.
 */
async function escribirAudiencia(
  caso: { id: string; version: number },
  tenantId: string,
  datos: Record<string, unknown>,
): Promise<boolean> {
  const { count } = await prisma.case.updateMany({
    where: { id: caso.id, tenantId, version: caso.version },
    data: { ...datos, version: { increment: 1 } },
  });
  return count === 1;
}

/**
 * Deja constancia con el antes y el después, y avisa solo al operador del caso.
 * El cambio ya quedó guardado: un fallo aquí se registra, no se le devuelve al
 * usuario como si la audiencia no se hubiera programado.
 */
async function registrarCambioDeAudiencia(params: {
  caso: {
    id: string;
    caseNumber: string;
    debtorName: string;
    operatorId: string;
  };
  antes: Record<string, unknown>;
  datos: Record<string, unknown>;
  user: {
    id: string;
    name: string;
    email: string;
    roleName: string;
    professionalCard: string;
  };
  tenantId: string;
}): Promise<void> {
  const { caso, antes, datos, user, tenantId } = params;
  const entityName = `${caso.caseNumber} - ${caso.debtorName}`;
  try {
    const cambios = resumirCambios(antes, datos);
    await createAuditLog({
      action: 'updated',
      entityType: 'case',
      entityId: caso.id,
      entityName,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        ...cambios,
        ...valoresAuditables(
          antes,
          datos,
          cambios.changedFields ? cambios.changedFields.split(', ') : [],
        ),
      },
    });

    if (caso.operatorId !== user.id) {
      await createNotificationForAction(
        'case_updated',
        entityName,
        prisma as unknown as PrismaClient,
        tenantId,
        caso.id,
        caso.id,
        [caso.operatorId],
        {
          name: user.name,
          email: user.email,
          roleName: user.roleName,
          professionalCard: user.professionalCard,
        },
      );
    }
  } catch (error) {
    logger.error('No se pudo registrar el cambio de audiencia', error, {
      action: 'registrarCambioDeAudiencia',
      tenantId,
      caseId: caso.id,
    });
  }
}

/**
 * Programa o reprograma la audiencia de un caso.
 *
 * Una fecha pasada se acepta a propósito: los casos creados desde marzo de 2026
 * no tenían dónde registrar audiencias, y el acta de una que ya se celebró tiene
 * que poder imprimir su fecha real. El formulario avisa antes de guardarla.
 */
export async function programarAudiencia(input: {
  caseId: string;
  fecha: string;
  hora: string;
  version?: number;
}): Promise<ResultadoAudiencia> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return {
        success: false,
        error: 'No tienes permisos para programar audiencias',
      };
    }

    const entrada = programarAudienciaSchema.safeParse(input);
    if (!entrada.success) {
      return { success: false, error: entrada.error.issues[0].message };
    }
    const { caseId, fecha, hora, version } = entrada.data;

    const caso = await leerCasoParaAudiencia(caseId, user, tenantId);
    if (!caso) return { success: false, error: 'Caso no encontrado' };

    if (esCasoCerrado(caso.phase)) {
      return {
        success: false,
        error: `No se puede programar una audiencia en un caso en fase "${caso.phase}".`,
      };
    }
    if (version !== undefined && version !== caso.version) {
      return { success: false, error: CONFLICTO_DE_VERSION };
    }

    const dia = parseDateOnly(fecha);
    const datos: Record<string, unknown> = {
      hearingDate: dia,
      hearingTime: hora,
      // La primera audiencia se fija una sola vez: es la que cita el Auto de
      // Admisión, y reprogramar no la reescribe.
      ...(caso.firstHearingDate
        ? {}
        : { firstHearingDate: dia, firstHearingTime: hora }),
    };

    if (!(await escribirAudiencia(caso, tenantId, datos))) {
      return { success: false, error: CONFLICTO_DE_VERSION };
    }

    revalidateTag('cases');
    await registrarCambioDeAudiencia({
      caso,
      antes: caso,
      datos,
      user,
      tenantId,
    });
    return { success: true };
  } catch (error) {
    logger.error('No se pudo programar la audiencia', error, {
      action: 'programarAudiencia',
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al programar la audiencia',
    };
  }
}

/**
 * Cancela la audiencia pendiente de un caso.
 *
 * La primera audiencia solo se borra si todavía no llegó: si ya se celebró es un
 * hecho del expediente, y borrar solo `hearingDate` deja a la vista esa fecha
 * pasada, que no genera alertas.
 *
 * Un caso en "Audiencia programada" vuelve a "En negociación" en la misma
 * escritura: sin audiencia, esa fase afirmaría algo falso. Es una transición que
 * `PHASE_TRANSITIONS` ya permite y no dispara generación de documentos.
 */
export async function cancelarAudiencia(input: {
  caseId: string;
  version?: number;
}): Promise<ResultadoAudiencia> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return {
        success: false,
        error: 'No tienes permisos para cancelar audiencias',
      };
    }

    const entrada = cancelarAudienciaSchema.safeParse(input);
    if (!entrada.success) {
      return { success: false, error: entrada.error.issues[0].message };
    }
    const { caseId, version } = entrada.data;

    const caso = await leerCasoParaAudiencia(caseId, user, tenantId);
    if (!caso) return { success: false, error: 'Caso no encontrado' };

    if (version !== undefined && version !== caso.version) {
      return { success: false, error: CONFLICTO_DE_VERSION };
    }

    const primeraPendiente =
      caso.firstHearingDate !== null &&
      claveDia(caso.firstHearingDate) >= hoyColombia();

    if (!caso.hearingDate && !primeraPendiente) {
      return {
        success: false,
        error: caso.firstHearingDate
          ? 'La audiencia de este caso ya pasó: no hay nada pendiente que cancelar.'
          : 'Este caso no tiene audiencia programada.',
      };
    }

    const datos: Record<string, unknown> = {
      hearingDate: null,
      hearingTime: null,
      ...(primeraPendiente
        ? { firstHearingDate: null, firstHearingTime: null }
        : {}),
      ...(caso.phase === HEARING_SCHEDULED_PHASE
        ? { phase: PHASE_AFTER_HEARING_CANCELLED }
        : {}),
    };

    if (!(await escribirAudiencia(caso, tenantId, datos))) {
      return { success: false, error: CONFLICTO_DE_VERSION };
    }

    revalidateTag('cases');
    await registrarCambioDeAudiencia({
      caso,
      antes: caso,
      datos,
      user,
      tenantId,
    });
    return caso.phase === HEARING_SCHEDULED_PHASE
      ? { success: true, faseNueva: PHASE_AFTER_HEARING_CANCELLED }
      : { success: true };
  } catch (error) {
    logger.error('No se pudo cancelar la audiencia', error, {
      action: 'cancelarAudiencia',
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al cancelar la audiencia',
    };
  }
}
