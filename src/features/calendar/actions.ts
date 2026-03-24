'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';

const hearingSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  debtorName: z.string(),
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

    if (!user.permissions.includes(P.VER_CALENDARIO)) {
      return {
        success: false,
        error: 'No tienes permisos para ver el calendario',
      };
    }

    const { month, year } = input;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

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
        OR: [
          {
            hearingDate: { gte: startDate, lte: endDate },
          },
          {
            firstHearingDate: { gte: startDate, lte: endDate },
          },
        ],
      },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        hearingDate: true,
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
      // Use firstHearingDate if available, fall back to hearingDate
      const date = c.firstHearingDate ?? c.hearingDate;
      if (!date) continue;

      hearings.push(
        hearingSchema.parse({
          id: c.id,
          caseNumber: c.caseNumber,
          debtorName: c.debtorName,
          date,
          time: c.firstHearingTime,
          zoomLink: c.zoomLink,
          phase: c.phase,
          type: typeMap[c.type] ?? c.type,
        }),
      );
    }

    hearings.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { success: true, data: hearings };
  } catch (error) {
    console.error('Error getting hearings:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener audiencias',
    };
  }
}
