'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import { createAuditLog } from '@/features/audit-log/actions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_RECEIPT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

// Note: PAYMENT_METHODS is defined in payment-constants.ts (cannot export non-functions from 'use server' files)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  debtorId: z.string(),
  amount: z
    .any()
    .transform((val) =>
      val && typeof val === 'object' && 'toNumber' in val
        ? val.toNumber()
        : Number(val),
    ),
  dueDate: z.coerce.date().nullable(),
  paymentDate: z.coerce.date().nullable(),
  status: z.string(),
  paymentNumber: z.number().nullable(),
  paymentMethod: z.string().nullable(),
  observations: z.string().nullable(),
  registeredById: z.string().nullable(),
  receiptFileId: z.string().nullable(),
  receiptFileName: z.string().nullable(),
  receiptFileUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type Payment = z.infer<typeof paymentSchema>;

export type PaymentWithRelations = Payment & {
  caseName?: string;
  caseNumber?: string;
  debtorName?: string;
  registeredByName?: string;
};

export type PaymentTrackingData = {
  payments: PaymentWithRelations[];
  summary: {
    totalRecaudado: number;
    totalPendiente: number;
    totalVencido: number;
    casesConPagos: number;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileName(fileName: string): string {
  let sanitized = fileName.replace(/[\\/\0]/g, '');
  sanitized = sanitized.replace(/^\.+/, '');
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.\sáéíóúñÁÉÍÓÚÑ()]/g, '_');
  sanitized = sanitized.replace(/[_\s]+/g, '_');
  const ext =
    sanitized.lastIndexOf('.') > 0
      ? sanitized.substring(sanitized.lastIndexOf('.'))
      : '';
  const name = sanitized.substring(
    0,
    sanitized.lastIndexOf('.') > 0
      ? sanitized.lastIndexOf('.')
      : sanitized.length,
  );
  const maxNameLen = 200 - ext.length;
  sanitized = name.substring(0, maxNameLen) + ext;
  if (!sanitized || sanitized === ext) {
    sanitized = `comprobante_${Date.now()}${ext || '.pdf'}`;
  }
  return sanitized;
}

function validateReceiptFile(
  fileName: string,
  mimeType: string,
): { valid: boolean; error?: string } {
  if (
    !ALLOWED_RECEIPT_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${mimeType}. Solo se aceptan PDF, JPG y PNG.`,
    };
  }
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  const allowedExtensions = MIME_TO_EXTENSIONS[mimeType];
  if (allowedExtensions && !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `La extensión ${ext} no coincide con el tipo ${mimeType}.`,
    };
  }
  return { valid: true };
}

async function uploadReceiptToDrive(
  caseId: string,
  tenantId: string,
  fileName: string,
  mimeType: string,
  dataBase64: string,
): Promise<{
  receiptFileId: string;
  receiptFileName: string;
  receiptFileUrl: string;
}> {
  const { googleDriveService } = await import('@/lib/google-drive');

  const caseData = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: { driveFolderId: true, caseNumber: true },
  });

  let caseFolderId = caseData?.driveFolderId;

  if (!caseFolderId) {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const folder = await googleDriveService.findOrCreateCaseFolder(
      caseData?.caseNumber ?? caseId,
      rootFolderId,
    );
    caseFolderId = folder;
    await prisma.case.update({
      where: { id: caseId },
      data: { driveFolderId: caseFolderId },
    });
  }

  const [comprobantesFolderId] = await googleDriveService.createFolderHierarchy(
    ['Comprobantes'],
    caseFolderId,
  );

  const sanitizedName = sanitizeFileName(fileName);
  const buffer = Buffer.from(dataBase64, 'base64');
  const fileId = await googleDriveService.uploadFile(
    sanitizedName,
    buffer,
    mimeType,
    comprobantesFolderId,
  );
  const fileUrl = googleDriveService.getFileUrl(fileId);

  return {
    receiptFileId: fileId,
    receiptFileName: sanitizedName,
    receiptFileUrl: fileUrl,
  };
}

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
      orderBy: [{ paymentNumber: 'asc' }, { createdAt: 'asc' }],
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
        debtorId: true,
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

    if (!caseData.debtorId) {
      return { success: false, error: 'El caso no tiene un deudor asignado' };
    }

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
    if (months < 1 || months > 120) {
      return {
        success: false,
        error: 'El plazo debe estar entre 1 y 120 meses',
      };
    }

    const startDate =
      caseData.propuestaFechaInicioPago ??
      caseData.paymentStartDate ??
      new Date();
    const totalDebt = Number(caseData.totalDebt);

    if (!totalDebt || totalDebt <= 0) {
      return { success: false, error: 'La deuda total debe ser mayor a 0' };
    }

    const periodicity = caseData.propuestaPeriodicidadPago ?? 'Mensual';
    let intervalMonths = 1;
    if (periodicity === 'Bimestral') intervalMonths = 2;
    else if (periodicity === 'Trimestral') intervalMonths = 3;
    else if (periodicity === 'Semestral') intervalMonths = 6;

    const numberOfPayments = Math.ceil(months / intervalMonths);

    if (numberOfPayments > 120) {
      return {
        success: false,
        error: 'El número de cuotas no puede exceder 120',
      };
    }

    const paymentAmount = totalDebt / numberOfPayments;

    const paymentsData = Array.from({ length: numberOfPayments }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i * intervalMonths);
      return {
        caseId,
        debtorId: caseData.debtorId!,
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
// markPaymentPaid (enhanced with receipt, method, observations)
// ---------------------------------------------------------------------------

const markPaymentPaidInput = z.object({
  paymentId: z.string(),
  amount: z.number().positive().optional(),
  paymentMethod: z.string().optional(),
  observations: z.string().optional(),
  receipt: z
    .object({
      fileName: z.string(),
      mimeType: z.string(),
      dataBase64: z.string().max(13_700_000),
    })
    .optional(),
});

export async function markPaymentPaid(
  input: z.infer<typeof markPaymentPaidInput>,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const validated = markPaymentPaidInput.parse(input);
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.REGISTRAR_PAGOS)) {
      return {
        success: false,
        error: 'No tienes permisos para registrar pagos',
      };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: validated.paymentId, tenantId },
      include: {
        case: { select: { caseNumber: true, debtorName: true, id: true } },
      },
    });

    if (!payment) {
      return { success: false, error: 'Pago no encontrado' };
    }

    // Upload receipt if provided
    let receiptData: {
      receiptFileId: string;
      receiptFileName: string;
      receiptFileUrl: string;
    } | null = null;

    if (validated.receipt) {
      const fileValidation = validateReceiptFile(
        validated.receipt.fileName,
        validated.receipt.mimeType,
      );
      if (!fileValidation.valid) {
        return { success: false, error: fileValidation.error };
      }
      receiptData = await uploadReceiptToDrive(
        payment.caseId,
        tenantId,
        validated.receipt.fileName,
        validated.receipt.mimeType,
        validated.receipt.dataBase64,
      );
    }

    await prisma.payment.update({
      where: { id: validated.paymentId },
      data: {
        status: 'pagado',
        paymentDate: new Date(),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.paymentMethod && {
          paymentMethod: validated.paymentMethod,
        }),
        ...(validated.observations && { observations: validated.observations }),
        registeredById: user.id,
        ...(receiptData && receiptData),
      },
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
        paymentNumber: (payment.paymentNumber ?? 0).toString(),
        action: 'marked_paid',
        ...(validated.paymentMethod && { method: validated.paymentMethod }),
        ...(receiptData && { hasReceipt: 'true' }),
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
// registerPayment (manual payment, not tied to scheduled installment)
// ---------------------------------------------------------------------------

const registerPaymentInput = z.object({
  caseId: z.string(),
  amount: z.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.string().optional(),
  observations: z.string().optional(),
  receipt: z
    .object({
      fileName: z.string(),
      mimeType: z.string(),
      dataBase64: z.string().max(13_700_000),
    })
    .optional(),
});

export async function registerPayment(
  input: z.infer<typeof registerPaymentInput>,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const validated = registerPaymentInput.parse(input);
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.REGISTRAR_PAGOS)) {
      return {
        success: false,
        error: 'No tienes permisos para registrar pagos',
      };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: validated.caseId, tenantId },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        debtorId: true,
      },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    if (!caseData.debtorId) {
      return { success: false, error: 'El caso no tiene un deudor asignado' };
    }

    // Upload receipt if provided
    let receiptData: {
      receiptFileId: string;
      receiptFileName: string;
      receiptFileUrl: string;
    } | null = null;

    if (validated.receipt) {
      const fileValidation = validateReceiptFile(
        validated.receipt.fileName,
        validated.receipt.mimeType,
      );
      if (!fileValidation.valid) {
        return { success: false, error: fileValidation.error };
      }
      receiptData = await uploadReceiptToDrive(
        validated.caseId,
        tenantId,
        validated.receipt.fileName,
        validated.receipt.mimeType,
        validated.receipt.dataBase64,
      );
    }

    await prisma.payment.create({
      data: {
        caseId: validated.caseId,
        debtorId: caseData.debtorId,
        tenantId,
        amount: validated.amount,
        paymentDate: new Date(validated.paymentDate),
        paymentMethod: validated.paymentMethod ?? null,
        observations: validated.observations ?? null,
        status: 'pagado',
        registeredById: user.id,
        ...(receiptData && receiptData),
      },
    });

    createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: validated.caseId,
      entityName: `${caseData.caseNumber} - ${caseData.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        field: 'payment',
        action: 'manual_payment',
        amount: validated.amount.toString(),
        ...(validated.paymentMethod && { method: validated.paymentMethod }),
        ...(receiptData && { hasReceipt: 'true' }),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error registering payment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al registrar el pago',
    };
  }
}

// ---------------------------------------------------------------------------
// uploadPaymentReceipt (add receipt to existing payment)
// ---------------------------------------------------------------------------

const uploadReceiptInput = z.object({
  paymentId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  dataBase64: z.string().max(13_700_000),
});

export async function uploadPaymentReceipt(
  input: z.infer<typeof uploadReceiptInput>,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const validated = uploadReceiptInput.parse(input);
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.REGISTRAR_PAGOS)) {
      return { success: false, error: 'No tienes permisos' };
    }

    const fileValidation = validateReceiptFile(
      validated.fileName,
      validated.mimeType,
    );
    if (!fileValidation.valid) {
      return { success: false, error: fileValidation.error };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: validated.paymentId, tenantId },
      include: {
        case: { select: { caseNumber: true, debtorName: true } },
      },
    });

    if (!payment) {
      return { success: false, error: 'Pago no encontrado' };
    }

    const receiptData = await uploadReceiptToDrive(
      payment.caseId,
      tenantId,
      validated.fileName,
      validated.mimeType,
      validated.dataBase64,
    );

    await prisma.payment.update({
      where: { id: validated.paymentId },
      data: receiptData,
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
        field: 'payment_receipt',
        paymentId: validated.paymentId,
        fileName: receiptData.receiptFileName,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al subir comprobante',
    };
  }
}

// ---------------------------------------------------------------------------
// getPaymentHistory (chronological payments for a case)
// ---------------------------------------------------------------------------

export async function getPaymentHistory(caseId: string): Promise<{
  success: boolean;
  data?: {
    payments: PaymentWithRelations[];
    totalObligation: number;
    totalPaid: number;
  };
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_CASOS)) {
      return { success: false, error: 'No tienes permisos' };
    }

    // Ownership check: users with VER_CASOS_PROPIOS can only see their own cases
    if (!user.permissions.includes(P.VER_TODOS_CASOS)) {
      const caseCheck = await prisma.case.findUnique({
        where: { id: caseId, tenantId },
        select: { operatorId: true, debtorId: true },
      });
      if (!caseCheck) return { success: false, error: 'Caso no encontrado' };

      const isOperator =
        user.permissions.includes(P.VER_CASOS_PROPIOS) &&
        caseCheck.operatorId === user.id;
      const isClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

      if (!isOperator && !isClient) {
        return { success: false, error: 'No tienes acceso a este caso' };
      }
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: { totalDebt: true },
    });

    const payments = await prisma.payment.findMany({
      where: { caseId, tenantId },
      include: {
        case: { select: { caseNumber: true, debtorName: true } },
        debtor: { select: { name: true } },
        registeredBy: { select: { name: true } },
      },
      orderBy: [
        { paymentDate: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const totalObligation = caseData?.totalDebt
      ? Number(caseData.totalDebt)
      : 0;

    const totalPaid = payments
      .filter((p) => p.status === 'pagado')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const mapped: PaymentWithRelations[] = payments.map((p) => ({
      ...paymentSchema.parse(p),
      caseName: p.case.debtorName,
      caseNumber: p.case.caseNumber,
      debtorName: p.debtor.name,
      registeredByName: p.registeredBy?.name ?? undefined,
    }));

    return {
      success: true,
      data: { payments: mapped, totalObligation, totalPaid },
    };
  } catch (error) {
    console.error('Error getting payment history:', error);
    return {
      success: false,
      error: 'Error al obtener historial de pagos',
    };
  }
}

// ---------------------------------------------------------------------------
// getPaymentTrackingReport (for reports module)
// ---------------------------------------------------------------------------

const trackingFiltersSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  hasReceipt: z.enum(['yes', 'no', 'all']).optional(),
  search: z.string().optional(),
});

export async function getPaymentTrackingReport(
  filters: z.infer<typeof trackingFiltersSchema>,
): Promise<{
  success: boolean;
  data?: PaymentTrackingData;
  error?: string;
}> {
  try {
    const validated = trackingFiltersSchema.parse(filters);
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos' };
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };

    if (validated.status && validated.status !== 'all') {
      where.status = validated.status;
    }

    if (validated.dateFrom || validated.dateTo) {
      const paymentDateFilter: Record<string, Date> = {};
      if (validated.dateFrom)
        paymentDateFilter.gte = new Date(validated.dateFrom);
      if (validated.dateTo) {
        const endDate = new Date(validated.dateTo);
        endDate.setHours(23, 59, 59, 999);
        paymentDateFilter.lte = endDate;
      }
      where.paymentDate = paymentDateFilter;
    }

    if (validated.hasReceipt === 'yes') {
      where.receiptFileId = { not: null };
    } else if (validated.hasReceipt === 'no') {
      where.receiptFileId = null;
    }

    if (validated.search) {
      where.OR = [
        {
          case: {
            caseNumber: { contains: validated.search, mode: 'insensitive' },
          },
        },
        {
          case: {
            debtorName: { contains: validated.search, mode: 'insensitive' },
          },
        },
        {
          debtor: { name: { contains: validated.search, mode: 'insensitive' } },
        },
      ];
    }

    // Visibility scoping
    if (user.permissions.includes(P.VER_TODOS_CASOS)) {
      // Can see all
    } else if (user.permissions.includes(P.VER_CASOS_PROPIOS)) {
      where.case = { ...(where.case as object), operatorId: user.id };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        case: {
          select: { caseNumber: true, debtorName: true, totalDebt: true },
        },
        debtor: { select: { name: true } },
        registeredBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const mapped: PaymentWithRelations[] = payments.map((p) => ({
      ...paymentSchema.parse(p),
      caseName: p.case.debtorName,
      caseNumber: p.case.caseNumber,
      debtorName: p.debtor.name,
      registeredByName: p.registeredBy?.name ?? undefined,
    }));

    // Summaries – use the same visibility-scoped `where` clause
    const allPayments = await prisma.payment.findMany({
      where,
      select: { amount: true, status: true, caseId: true, dueDate: true },
    });

    const now = new Date();
    const totalRecaudado = allPayments
      .filter((p) => p.status === 'pagado')
      .reduce((s, p) => s + Number(p.amount), 0);

    const totalPendiente = allPayments
      .filter(
        (p) => p.status === 'pendiente' && (!p.dueDate || p.dueDate >= now),
      )
      .reduce((s, p) => s + Number(p.amount), 0);

    const totalVencido = allPayments
      .filter(
        (p) =>
          p.status === 'vencido' ||
          (p.status === 'pendiente' && p.dueDate && p.dueDate < now),
      )
      .reduce((s, p) => s + Number(p.amount), 0);

    const casesConPagos = new Set(
      allPayments.filter((p) => p.status === 'pagado').map((p) => p.caseId),
    ).size;

    return {
      success: true,
      data: {
        payments: mapped,
        summary: {
          totalRecaudado,
          totalPendiente,
          totalVencido,
          casesConPagos,
        },
      },
    };
  } catch (error) {
    console.error('Error getting payment tracking report:', error);
    return {
      success: false,
      error: 'Error al obtener reporte de pagos',
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

// ---------------------------------------------------------------------------
// getCasesForPayment (case selector for payment registration)
// ---------------------------------------------------------------------------

export async function getCasesForPayment(): Promise<{
  success: boolean;
  data?: {
    id: string;
    caseNumber: string;
    debtorName: string;
    debtorId: string;
    totalDebt: number;
    type: string;
  }[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_CASOS)) {
      return { success: false, error: 'No tienes permisos' };
    }

    const where: Record<string, unknown> = { tenantId };

    // Visibility scoping
    if (user.permissions.includes(P.VER_TODOS_CASOS)) {
      // Can see all
    } else if (user.permissions.includes(P.VER_CASOS_PROPIOS)) {
      where.operatorId = user.id;
    }

    const cases = await prisma.case.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        debtorId: true,
        totalDebt: true,
        type: true,
      },
      orderBy: { caseNumber: 'asc' },
    });

    return {
      success: true,
      data: cases
        .filter((c) => c.debtorId)
        .map((c) => ({
          id: c.id,
          caseNumber: c.caseNumber,
          debtorName: c.debtorName,
          debtorId: c.debtorId!,
          totalDebt: c.totalDebt ? Number(c.totalDebt) : 0,
          type: c.type,
        })),
    };
  } catch (error) {
    console.error('Error getting cases for payment:', error);
    return { success: false, error: 'Error al obtener casos' };
  }
}

// ---------------------------------------------------------------------------
// getCasePaymentSummaries (progress per case for report view)
// ---------------------------------------------------------------------------

export async function getCasePaymentSummaries(): Promise<{
  success: boolean;
  data?: {
    caseId: string;
    caseNumber: string;
    debtorName: string;
    type: string;
    totalObligation: number;
    totalPaid: number;
    totalPendiente: number;
    paymentsCount: number;
    paidCount: number;
    overdueCount: number;
    progressPercent: number;
  }[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos' };
    }

    const where: Record<string, unknown> = { tenantId };
    if (user.permissions.includes(P.VER_TODOS_CASOS)) {
      // all
    } else if (user.permissions.includes(P.VER_CASOS_PROPIOS)) {
      where.operatorId = user.id;
    }

    // Get cases that have payments
    const casesWithPayments = await prisma.case.findMany({
      where: {
        ...where,
        payments: { some: {} },
      },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        type: true,
        totalDebt: true,
        payments: {
          select: {
            amount: true,
            status: true,
            dueDate: true,
          },
        },
      },
      orderBy: { caseNumber: 'asc' },
    });

    const now = new Date();

    const data = casesWithPayments.map((c) => {
      const totalObligation = c.totalDebt ? Number(c.totalDebt) : 0;
      const totalPaid = c.payments
        .filter((p) => p.status === 'pagado')
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalPendiente = c.payments
        .filter((p) => p.status !== 'pagado')
        .reduce((s, p) => s + Number(p.amount), 0);
      const paidCount = c.payments.filter((p) => p.status === 'pagado').length;
      const overdueCount = c.payments.filter(
        (p) =>
          p.status === 'pendiente' && p.dueDate && new Date(p.dueDate) < now,
      ).length;
      const progressPercent =
        totalObligation > 0
          ? Math.min(100, Math.round((totalPaid / totalObligation) * 100))
          : c.payments.length > 0 && paidCount > 0
            ? Math.round((paidCount / c.payments.length) * 100)
            : 0;

      return {
        caseId: c.id,
        caseNumber: c.caseNumber,
        debtorName: c.debtorName,
        type: c.type,
        totalObligation,
        totalPaid,
        totalPendiente,
        paymentsCount: c.payments.length,
        paidCount,
        overdueCount,
        progressPercent,
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error getting case payment summaries:', error);
    return { success: false, error: 'Error al obtener resúmenes' };
  }
}
