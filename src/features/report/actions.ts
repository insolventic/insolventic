'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, string> = {
  INSOLVENCY: 'Insolvencia',
  CONCILIATION: 'Conciliación',
  SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
};

/**
 * Returns context-appropriate labels per case type.
 * Not every service revolves around "debt" — Conciliación is mediation-focused
 * and Acuerdo de Apoyo is about payment restructuring.
 */
const TYPE_CONTEXT: Record<
  string,
  {
    label: string;
    monetaryLabel: string;
    entityLabel: string;
    description: string;
  }
> = {
  Insolvencia: {
    label: 'Insolvencia',
    monetaryLabel: 'Monto en proceso',
    entityLabel: 'Acreedores',
    description: 'Procesos de insolvencia económica',
  },
  Conciliación: {
    label: 'Conciliación',
    monetaryLabel: 'Valor en disputa',
    entityLabel: 'Partes involucradas',
    description: 'Procesos de conciliación y mediación',
  },
  'Acuerdo de Apoyo': {
    label: 'Acuerdo de Apoyo',
    monetaryLabel: 'Monto a reestructurar',
    entityLabel: 'Acreedores',
    description: 'Acuerdos de reestructuración de obligaciones',
  },
};

function getTypeContext(type: string) {
  return (
    TYPE_CONTEXT[type] ?? {
      label: type,
      monetaryLabel: 'Monto total',
      entityLabel: 'Partes',
      description: type,
    }
  );
}

// ---------------------------------------------------------------------------
// Case Status Report
// ---------------------------------------------------------------------------

const caseStatusFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function getCaseStatusReport(
  filters: z.infer<typeof caseStatusFilterSchema> = {},
) {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos para ver reportes' };
    }

    const validated = caseStatusFilterSchema.parse(filters);
    const where: Record<string, unknown> = { tenantId };

    if (validated.dateFrom || validated.dateTo) {
      const createdDate: Record<string, Date> = {};
      if (validated.dateFrom) createdDate.gte = new Date(validated.dateFrom);
      if (validated.dateTo) {
        const endDate = new Date(validated.dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdDate.lte = endDate;
      }
      where.createdDate = createdDate;
    }

    const [byPhase, byType, insolvencyAggregate, totalCases] =
      await Promise.all([
        prisma.case.groupBy({
          by: ['phase'],
          where,
          _count: { id: true },
          _sum: { totalDebt: true },
        }),
        prisma.case.groupBy({
          by: ['type'],
          where,
          _count: { id: true },
          _sum: { totalDebt: true },
        }),
        // Only sum debt for Insolvencia cases
        prisma.case.aggregate({
          where: { ...where, type: 'INSOLVENCY' },
          _sum: { totalDebt: true },
        }),
        prisma.case.count({ where }),
      ]);

    return {
      success: true,
      data: {
        totalCases,
        totalAmount: insolvencyAggregate._sum.totalDebt
          ? Number(insolvencyAggregate._sum.totalDebt)
          : 0,
        byPhase: byPhase.map((g) => ({
          phase: g.phase ?? 'Inicial',
          count: g._count.id,
          amount: g._sum.totalDebt ? Number(g._sum.totalDebt) : 0,
        })),
        byType: byType.map((g) => {
          const typeName = TYPE_MAP[g.type] ?? g.type;
          const ctx = getTypeContext(typeName);
          const showMonetary = g.type === 'INSOLVENCY';
          return {
            type: typeName,
            count: g._count.id,
            amount: showMonetary
              ? g._sum.totalDebt
                ? Number(g._sum.totalDebt)
                : 0
              : 0,
            showMonetary,
            monetaryLabel: ctx.monetaryLabel,
            entityLabel: ctx.entityLabel,
            description: ctx.description,
          };
        }),
      },
    };
  } catch (error) {
    console.error('Error getting case status report:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener reporte de estado',
    };
  }
}

// ---------------------------------------------------------------------------
// Financial Report — now grouped by service type
// ---------------------------------------------------------------------------

export async function getFinancialReport() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos para ver reportes' };
    }

    // Get cases with their debts, grouped by type
    const cases = await prisma.case.findMany({
      where: { tenantId },
      select: {
        id: true,
        type: true,
        totalDebt: true,
        creditors: true,
        phase: true,
        debtorName: true,
      },
    });

    // Get individual debts with creditor info
    const debts = await prisma.debt.findMany({
      where: { case: { tenantId } },
      include: {
        creditor: { select: { name: true, nit: true, type: true } },
        case: { select: { type: true } },
      },
    });

    // --- Summary by service type ---
    const byServiceType: Record<
      string,
      {
        type: string;
        totalAmount: number;
        caseCount: number;
        creditorCount: number;
        monetaryLabel: string;
        description: string;
      }
    > = {};

    for (const c of cases) {
      const typeName = TYPE_MAP[c.type] ?? c.type;
      const ctx = getTypeContext(typeName);
      if (!byServiceType[typeName]) {
        byServiceType[typeName] = {
          type: typeName,
          totalAmount: 0,
          caseCount: 0,
          creditorCount: 0,
          monetaryLabel: ctx.monetaryLabel,
          description: ctx.description,
        };
      }
      byServiceType[typeName].totalAmount += Number(c.totalDebt);
      byServiceType[typeName].caseCount += 1;
      byServiceType[typeName].creditorCount += c.creditors;
    }

    // --- Group debts by creditor ---
    const creditorMap: Record<
      string,
      {
        name: string;
        nit: string;
        type: string;
        totalAmount: number;
        count: number;
        caseTypes: Set<string>;
      }
    > = {};

    for (const d of debts) {
      const key = d.creditorId;
      if (!creditorMap[key]) {
        creditorMap[key] = {
          name: d.creditor.name,
          nit: d.creditor.nit,
          type: d.creditor.type,
          totalAmount: 0,
          count: 0,
          caseTypes: new Set(),
        };
      }
      creditorMap[key].totalAmount += Number(d.amount);
      creditorMap[key].count += 1;
      const caseTypeName = TYPE_MAP[d.case.type] ?? d.case.type;
      creditorMap[key].caseTypes.add(caseTypeName);
    }

    const byCreditor = Object.values(creditorMap)
      .map((c) => ({
        name: c.name,
        nit: c.nit,
        type: c.type,
        totalAmount: c.totalAmount,
        count: c.count,
        services: Array.from(c.caseTypes),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const totalAmount = cases.reduce((sum, c) => sum + Number(c.totalDebt), 0);

    return {
      success: true,
      data: {
        totalAmount,
        totalRecords: debts.length,
        totalCases: cases.length,
        byServiceType: Object.values(byServiceType),
        byCreditor,
      },
    };
  } catch (error) {
    console.error('Error getting financial report:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener reporte financiero',
    };
  }
}

// ---------------------------------------------------------------------------
// Export Cases to Excel (returns base64)
// ---------------------------------------------------------------------------

export async function exportCasesToExcel(
  filters: {
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos para exportar' };
    }

    // Rate limit report exports per user
    const rlKey = getRateLimitKey('reportExport', user.id);
    const rl = await checkRateLimit(rlKey, RATE_LIMIT_CONFIGS.reportExport);
    if (!rl.allowed) {
      return {
        success: false,
        error: `Demasiadas solicitudes de exportación. Intente en ${Math.ceil(rl.resetInMs / 60000)} minutos.`,
      };
    }

    const where: Record<string, unknown> = { tenantId };
    if (filters.dateFrom || filters.dateTo) {
      const createdDate: Record<string, Date> = {};
      if (filters.dateFrom) createdDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdDate.lte = endDate;
      }
      where.createdDate = createdDate;
    }

    const cases = await prisma.case.findMany({
      where,
      orderBy: { createdDate: 'desc' },
      select: {
        caseNumber: true,
        debtorName: true,
        type: true,
        phase: true,
        totalDebt: true,
        creditors: true,
        createdDate: true,
        hearingDate: true,
        city: true,
      },
    });

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Insolventic';
    workbook.created = new Date();

    const COLUMNS = [
      { header: 'Caso', key: 'caseNumber', width: 18 },
      { header: 'Deudor / Solicitante', key: 'debtorName', width: 32 },
      { header: 'Servicio', key: 'type', width: 22 },
      { header: 'Fase', key: 'phase', width: 22 },
      { header: 'Monto', key: 'totalDebt', width: 18 },
      { header: 'Partes', key: 'creditors', width: 10 },
      { header: 'Ciudad', key: 'city', width: 18 },
      { header: 'Fecha Creación', key: 'createdDate', width: 16 },
      { header: 'Audiencia', key: 'hearingDate', width: 16 },
    ];

    type WorksheetT = ReturnType<typeof workbook.addWorksheet>;
    const styleHeader = (sheet: WorksheetT) => {
      const h = sheet.getRow(1);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' },
      };
      h.alignment = { horizontal: 'center', vertical: 'middle' };
      h.height = 24;
    };

    // ---------- Sheets per service type ----------
    const SERVICE_SHEETS: Array<{ key: string; name: string }> = [
      { key: 'INSOLVENCY', name: 'Insolvencia' },
      { key: 'CONCILIATION', name: 'Conciliación' },
      { key: 'SUPPORT_AGREEMENT', name: 'Acuerdos de Apoyo' },
    ];

    const grouped: Record<string, typeof cases> = {};
    for (const c of cases) {
      const k = c.type ?? 'INSOLVENCY';
      (grouped[k] ||= []).push(c);
    }

    // Summary sheet first
    const summary = workbook.addWorksheet('Resumen');
    summary.columns = [
      { header: 'Servicio', key: 'service', width: 28 },
      { header: 'Casos', key: 'count', width: 12 },
      { header: 'Monto Total', key: 'amount', width: 22 },
    ];
    styleHeader(summary);
    let totalCount = 0;
    let totalAmount = 0;
    for (const s of SERVICE_SHEETS) {
      const list = grouped[s.key] ?? [];
      const amount = list.reduce((acc, c) => acc + Number(c.totalDebt ?? 0), 0);
      summary.addRow({ service: s.name, count: list.length, amount });
      totalCount += list.length;
      totalAmount += amount;
    }
    const totalRow = summary.addRow({
      service: 'TOTAL',
      count: totalCount,
      amount: totalAmount,
    });
    totalRow.font = { bold: true };
    summary.getColumn('amount').numFmt = '"$"#,##0';

    // One sheet per service
    for (const s of SERVICE_SHEETS) {
      const list = grouped[s.key] ?? [];
      const sheet = workbook.addWorksheet(s.name);
      sheet.columns = COLUMNS;
      styleHeader(sheet);
      for (const c of list) {
        sheet.addRow({
          caseNumber: c.caseNumber,
          debtorName: c.debtorName,
          type: TYPE_MAP[c.type] ?? c.type,
          phase: c.phase ?? 'Inicial',
          totalDebt: Number(c.totalDebt),
          creditors: c.creditors,
          city: c.city ?? '',
          createdDate: c.createdDate.toLocaleDateString('es-CO'),
          hearingDate: c.hearingDate
            ? c.hearingDate.toLocaleDateString('es-CO')
            : '',
        });
      }
      sheet.getColumn('totalDebt').numFmt = '"$"#,##0';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { success: true, data: base64 };
  } catch (error) {
    console.error('Error exporting cases:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al exportar casos',
    };
  }
}
