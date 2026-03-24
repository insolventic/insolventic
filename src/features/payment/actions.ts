'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import { createAuditLog } from '@/features/audit-log/actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  amount: z
    .any()
    .transform((val) =>
      val && typeof val === 'object' && 'toNumber' in val
        ? val.toNumber()
        : Number(val),
    ),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().nullable(),
  status: z.string(),
  paymentNumber: z.number(),
  createdAt: z.coerce.date(),
});

export type Payment = z.infer<typeof paymentSchema>;

// ---------------------------------------------------------------------------
// getPaymentSchedule
// ---------------------------------------------------------------------------

export async function getPaymentSchedule(caseId: string): Promise<{
  success: boolean;
  data?: Payment[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_CASOS)) {
      return { success: false, error: 'No tienes permisos' };
    }

    const payments = await prisma.payment.findMany({
      where: { caseId, tenantId },
      orderBy: { paymentNumber: 'asc' },
    });

    const parsed = payments.map((p) => paymentSchema.parse(p));
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Error getting payment schedule:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener cronograma de pagos',
    };
  }
}

// ---------------------------------------------------------------------------
// generatePaymentSchedule
// ---------------------------------------------------------------------------

export async function generatePaymentSchedule(caseId: string): Promise<{
  success: boolean;
  data?: Payment[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        totalDebt: true,
        propuestaPlazoMeses: true,
        propuestaPeriodicidadPago: true,
        propuestaFechaInicioPago: true,
        paymentStartDate: true,
      },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // Check if payments already exist
    const existing = await prisma.payment.count({
      where: { caseId, tenantId },
    });
    if (existing > 0) {
      return {
        success: false,
        error: 'Ya existe un cronograma de pagos para este caso',
      };
    }

    const months = caseData.propuestaPlazoMeses ?? 12;
    const startDate =
      caseData.propuestaFechaInicioPago ??
      caseData.paymentStartDate ??
      new Date();
    const totalDebt = Number(caseData.totalDebt);

    // Determine number of payments based on periodicity
    const periodicity = caseData.propuestaPeriodicidadPago ?? 'Mensual';
    let intervalMonths = 1;
    if (periodicity === 'Bimestral') intervalMonths = 2;
    else if (periodicity === 'Trimestral') intervalMonths = 3;
    else if (periodicity === 'Semestral') intervalMonths = 6;

    const numberOfPayments = Math.ceil(months / intervalMonths);
    const paymentAmount = totalDebt / numberOfPayments;

    const paymentsData = Array.from({ length: numberOfPayments }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i * intervalMonths);
      return {
        caseId,
        amount: paymentAmount,
        dueDate,
        status: 'pendiente',
        paymentNumber: i + 1,
        tenantId,
      };
    });

    await prisma.payment.createMany({ data: paymentsData });

    const payments = await prisma.payment.findMany({
      where: { caseId, tenantId },
      orderBy: { paymentNumber: 'asc' },
    });

    createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: `${caseData.caseNumber} - ${caseData.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        field: 'payment_schedule',
        numberOfPayments: numberOfPayments.toString(),
        periodicity,
      },
    });

    const parsed = payments.map((p) => paymentSchema.parse(p));
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Error generating payment schedule:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al generar cronograma de pagos',
    };
  }
}

// ---------------------------------------------------------------------------
// markPaymentPaid
// ---------------------------------------------------------------------------

export async function markPaymentPaid(paymentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos' };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId, tenantId },
      include: {
        case: { select: { caseNumber: true, debtorName: true } },
      },
    });

    if (!payment) {
      return { success: false, error: 'Pago no encontrado' };
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'pagado', paidDate: new Date() },
    });

    createAuditLog({
      action: 'updated',
      entityType: 'case',
      entityId: payment.caseId,
      entityName: `${payment.case.caseNumber} - ${payment.case.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        field: 'payment',
        paymentNumber: payment.paymentNumber.toString(),
        action: 'marked_paid',
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking payment paid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar pago',
    };
  }
}

// ---------------------------------------------------------------------------
// getOverduePayments (for dashboard)
// ---------------------------------------------------------------------------

export async function getOverduePayments(): Promise<{
  success: boolean;
  data?: { count: number };
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_CASOS)) {
      return { success: true, data: { count: 0 } };
    }

    const count = await prisma.payment.count({
      where: {
        tenantId,
        status: 'pendiente',
        dueDate: { lt: new Date() },
      },
    });

    return { success: true, data: { count } };
  } catch (error) {
    console.error('Error getting overdue payments:', error);
    return { success: false, error: 'Error al obtener pagos vencidos' };
  }
}
