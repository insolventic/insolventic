'use server';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'case' | 'debtor' | 'creditor';
  href: string;
}

export async function globalSearch(query: string): Promise<{
  success: boolean;
  data?: SearchResult[];
  error?: string;
}> {
  try {
    const { tenantId } = await authenticateUser();

    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    const [cases, debtors, creditors] = await Promise.all([
      prisma.case.findMany({
        where: {
          tenantId,
          OR: [
            { caseNumber: { contains: query, mode: 'insensitive' } },
            { debtorName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          caseNumber: true,
          debtorName: true,
          type: true,
        },
        take: 5,
      }),
      prisma.debtor.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { idNumber: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          idNumber: true,
        },
        take: 5,
      }),
      prisma.creditor.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { nit: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          nit: true,
        },
        take: 5,
      }),
    ]);

    const results: SearchResult[] = [
      ...cases.map((c) => ({
        id: c.id,
        title: `${c.caseNumber} - ${c.debtorName}`,
        subtitle: c.type,
        category: 'case' as const,
        href: `/cases?search=${encodeURIComponent(c.caseNumber)}`,
      })),
      ...debtors.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: `CC: ${d.idNumber}`,
        category: 'debtor' as const,
        href: `/debtors?search=${encodeURIComponent(d.name)}`,
      })),
      ...creditors.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `NIT: ${c.nit}`,
        category: 'creditor' as const,
        href: `/creditors?search=${encodeURIComponent(c.name)}`,
      })),
    ];

    return { success: true, data: results };
  } catch (error) {
    console.error('Error in global search:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en la búsqueda',
    };
  }
}
