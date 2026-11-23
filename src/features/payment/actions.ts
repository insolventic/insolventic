'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { CASO_ACTIVO } from '@/lib/papelera';
import { authenticateUser } from '@/features/auth/actions';
import {
  assertCaseAccess,
  assertCaseAccessOnRow,
  caseWhereFromVisibility,
  caseWhereOrNothing,
  isCaseAccessError,
  resolveCaseVisibility,
  type CaseAccessUser,
} from '@/features/case/case-access';
import { P } from '@/lib/permissions';
import { createAuditLog } from '@/features/audit-log/actions';
import { errorDeTamanoDeArchivo } from '@/lib/limite-archivos';
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

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

/*
 * VISIBILIDAD POR EXPEDIENTE. Un pago es del expediente al que pertenece, así
 * que quién lo ve o lo toca lo decide la misma regla que decide quién ve el
 * expediente: `case-access.ts` (ver todos / ver propios / ver como cliente).
 * Antes este módulo solo filtraba por `tenantId` y, en algunos listados, por
 * `operatorId` escrito a mano: el rol cliente listaba los pagos y los casos de
 * todo el centro, y `getPaymentHistory` dejaba pasar a cualquier cliente a
 * cualquier expediente.
 *
 *   - Las actions que reciben un id de caso o de pago verifican la fila con
 *     `assertCaseAccess` / `assertCaseAccessOnRow` ANTES de leer o escribir.
 *   - Las que listan o suman acotan `case` con `filtroDeCasoVisible`.
 */

/**
 * El `where` sobre la relación `case` de `Payment` que deja solo los pagos de
 * expedientes visibles para el usuario y fuera de la papelera.
 *
 * Va dentro de `case` porque es una lectura anidada: la extensión de Prisma
 * que filtra la papelera solo actúa sobre las consultas de primer nivel sobre
 * `Case`. Para `none` devuelve un filtro que no coincide con ninguna fila, así
 * que los totales salen en cero en vez de sumar todo el centro.
 */
async function filtroDeCasoVisible(
  user: CaseAccessUser,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const visibilidad = await resolveCaseVisibility(user, tenantId);
  return { ...CASO_ACTIVO, ...caseWhereOrNothing(visibilidad) };
}

/** Respuesta de una action ante un acceso denegado: esperado, sin Sentry. */
function respuestaDeAccesoDenegado(
  error: unknown,
): { success: false; error: string } | null {
  return isCaseAccessError(error)
    ? { success: false, error: error.message }
    : null;
}

const trackingFiltersSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  hasReceipt: z.enum(['yes', 'no', 'all']).optional(),
  search: z.string().optional(),
});

/**
 * El `where` del reporte de seguimiento de pagos. Uno solo para el reporte y
 * su exportación a Excel: antes eran dos copias "sincronizadas a propósito",
 * y las dos tenían el mismo hueco de visibilidad.
 */
async function whereDelReporteDePagos(
  validated: z.infer<typeof trackingFiltersSchema>,
  user: CaseAccessUser,
  tenantId: string,
): Promise<Record<string, unknown>> {
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

  // Papelera + visibilidad por expediente, en la relación `case`.
  where.case = await filtroDeCasoVisible(user, tenantId);

  return where;
}

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

function validateReceiptFile(file: File): { valid: boolean; error?: string } {
  const errorDeTamano = errorDeTamanoDeArchivo(file.size);
  if (errorDeTamano) {
    return { valid: false, error: errorDeTamano };
  }

  const { name: fileName, type: mimeType } = file;
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
  file: File,
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

  const comprobantesFolderId = await googleDriveService.createFolderHierarchy(
    ['Comprobantes'],
    caseFolderId,
  );

  const sanitizedName = sanitizeFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = await googleDriveService.uploadFile(
    sanitizedName,
    buffer,
    file.type,
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

    await assertCaseAccess({ caseId, user, tenantId });

    const payments = await prisma.payment.findMany({
      where: { caseId, tenantId, case: CASO_ACTIVO },
      orderBy: [{ paymentNumber: 'asc' }, { createdAt: 'asc' }],
    });

    const parsed = payments.map((p) => paymentSchema.parse(p));
    return { success: true, data: parsed };
  } catch (error) {
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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
        operatorId: true,
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

    await assertCaseAccessOnRow({ caseRow: caseData, user, tenantId });

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

    await createAuditLog({
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
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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
  receipt: z.instanceof(File).optional(),
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

    // `case: CASO_ACTIVO`: el pago de un caso en la papelera no se toca.
    const payment = await prisma.payment.findUnique({
      where: { id: validated.paymentId, tenantId, case: CASO_ACTIVO },
      include: {
        case: {
          select: {
            caseNumber: true,
            debtorName: true,
            id: true,
            operatorId: true,
            debtorId: true,
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Pago no encontrado' };
    }

    // Antes de subir el comprobante o escribir: el pago es del expediente.
    await assertCaseAccessOnRow({ caseRow: payment.case, user, tenantId });

    // Upload receipt if provided
    let receiptData: {
      receiptFileId: string;
      receiptFileName: string;
      receiptFileUrl: string;
    } | null = null;

    if (validated.receipt) {
      const fileValidation = validateReceiptFile(validated.receipt);
      if (!fileValidation.valid) {
        return { success: false, error: fileValidation.error };
      }
      receiptData = await uploadReceiptToDrive(
        payment.caseId,
        tenantId,
        validated.receipt,
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

    await createAuditLog({
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
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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
  receipt: z.instanceof(File).optional(),
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
        operatorId: true,
      },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    await assertCaseAccessOnRow({ caseRow: caseData, user, tenantId });

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
      const fileValidation = validateReceiptFile(validated.receipt);
      if (!fileValidation.valid) {
        return { success: false, error: fileValidation.error };
      }
      receiptData = await uploadReceiptToDrive(
        validated.caseId,
        tenantId,
        validated.receipt,
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

    await createAuditLog({
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
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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
  receipt: z.instanceof(File),
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

    const fileValidation = validateReceiptFile(validated.receipt);
    if (!fileValidation.valid) {
      return { success: false, error: fileValidation.error };
    }

    // `case: CASO_ACTIVO`: el pago de un caso en la papelera no se toca.
    const payment = await prisma.payment.findUnique({
      where: { id: validated.paymentId, tenantId, case: CASO_ACTIVO },
      include: {
        case: {
          select: {
            caseNumber: true,
            debtorName: true,
            operatorId: true,
            debtorId: true,
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Pago no encontrado' };
    }

    await assertCaseAccessOnRow({ caseRow: payment.case, user, tenantId });

    const receiptData = await uploadReceiptToDrive(
      payment.caseId,
      tenantId,
      validated.receipt,
    );

    await prisma.payment.update({
      where: { id: validated.paymentId },
      data: receiptData,
    });

    await createAuditLog({
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
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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

    // La regla de `case-access`. La copia a mano que había acá dejaba pasar a
    // cualquier cliente a cualquier expediente: miraba si tenía el permiso
    // `Ver casos como cliente`, no si el expediente era suyo.
    await assertCaseAccess({ caseId, user, tenantId });

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
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
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

    const where = await whereDelReporteDePagos(validated, user, tenantId);

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
        case: await filtroDeCasoVisible(user, tenantId),
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

    // Listado: `null` es "no ver nada" y se corta antes de consultar.
    const alcance = caseWhereFromVisibility(
      await resolveCaseVisibility(user, tenantId),
    );
    if (!alcance) return { success: true, data: [] };

    const cases = await prisma.case.findMany({
      where: { tenantId, ...alcance },
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

    const alcance = caseWhereFromVisibility(
      await resolveCaseVisibility(user, tenantId),
    );
    if (!alcance) return { success: true, data: [] };

    // Get cases that have payments
    const casesWithPayments = await prisma.case.findMany({
      where: {
        tenantId,
        ...alcance,
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

// ---------------------------------------------------------------------------
// exportPaymentTrackingToExcel — Excel export of the payment tracking report
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  parcial: 'Parcial',
  vencido: 'Vencido',
};

/**
 * Exports the payment tracking report as a multi-sheet Excel workbook.
 * Applies the same filters and visibility scoping as `getPaymentTrackingReport`.
 * Rate-limited per user to avoid abusive generation of heavy exports.
 */
export async function exportPaymentTrackingToExcel(
  filters: z.infer<typeof trackingFiltersSchema> = {},
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const validated = trackingFiltersSchema.parse(filters);
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_REPORTES)) {
      return { success: false, error: 'No tienes permisos para exportar' };
    }

    const rlKey = getRateLimitKey('reportExport', user.id);
    const rl = await checkRateLimit(rlKey, RATE_LIMIT_CONFIGS.reportExport);
    if (!rl.allowed) {
      return {
        success: false,
        error: `Demasiadas solicitudes de exportación. Intente en ${Math.ceil(rl.resetInMs / 60000)} minutos.`,
      };
    }

    // El mismo `where` que el reporte, incluida la visibilidad.
    const where = await whereDelReporteDePagos(validated, user, tenantId);

    const payments = await prisma.payment.findMany({
      where,
      include: {
        case: { select: { caseNumber: true, debtorName: true } },
        debtor: { select: { name: true } },
        registeredBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Insolventic';
    workbook.created = new Date();

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

    // Summary sheet
    const summary = workbook.addWorksheet('Resumen');
    summary.columns = [
      { header: 'Indicador', key: 'label', width: 32 },
      { header: 'Valor', key: 'value', width: 22 },
    ];
    styleHeader(summary);

    const now = new Date();
    const totalRecaudado = payments
      .filter((p) => p.status === 'pagado')
      .reduce((s, p) => s + Number(p.amount), 0);
    const totalPendiente = payments
      .filter(
        (p) => p.status === 'pendiente' && (!p.dueDate || p.dueDate >= now),
      )
      .reduce((s, p) => s + Number(p.amount), 0);
    const totalVencido = payments
      .filter(
        (p) =>
          p.status === 'vencido' ||
          (p.status === 'pendiente' && p.dueDate && p.dueDate < now),
      )
      .reduce((s, p) => s + Number(p.amount), 0);
    const casesConPagos = new Set(
      payments.filter((p) => p.status === 'pagado').map((p) => p.caseId),
    ).size;

    summary.addRow({ label: 'Total Recaudado', value: totalRecaudado });
    summary.addRow({ label: 'Total Pendiente', value: totalPendiente });
    summary.addRow({ label: 'Total Vencido', value: totalVencido });
    summary.addRow({ label: 'Casos con Pagos', value: casesConPagos });
    summary.addRow({ label: 'Total Pagos Listados', value: payments.length });
    summary.getColumn('value').numFmt = '"$"#,##0';
    // Casos con pagos y Total listados son conteos (no montos)
    summary.getCell('B4').numFmt = '#,##0';
    summary.getCell('B5').numFmt = '#,##0';

    // Detail sheet
    const detail = workbook.addWorksheet('Pagos');
    detail.columns = [
      { header: 'Caso', key: 'caseNumber', width: 18 },
      { header: 'Deudor', key: 'debtorName', width: 32 },
      { header: 'Monto', key: 'amount', width: 16 },
      { header: 'Fecha Pago', key: 'paymentDate', width: 16 },
      { header: 'Fecha Límite', key: 'dueDate', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Método', key: 'paymentMethod', width: 18 },
      { header: 'Comprobante', key: 'receipt', width: 14 },
      { header: 'Registrado por', key: 'registeredBy', width: 24 },
      { header: 'Observaciones', key: 'observations', width: 40 },
    ];
    styleHeader(detail);

    for (const p of payments) {
      detail.addRow({
        caseNumber: p.case.caseNumber,
        debtorName: p.debtor.name,
        amount: Number(p.amount),
        paymentDate: p.paymentDate
          ? p.paymentDate.toLocaleDateString('es-CO')
          : '',
        dueDate: p.dueDate ? p.dueDate.toLocaleDateString('es-CO') : '',
        status: STATUS_LABELS[p.status] ?? p.status,
        paymentMethod: p.paymentMethod ?? '',
        receipt: p.receiptFileId ? 'Sí' : 'No',
        registeredBy: p.registeredBy?.name ?? '',
        observations: p.observations ?? '',
      });
    }
    detail.getColumn('amount').numFmt = '"$"#,##0';

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { success: true, data: base64 };
  } catch (error) {
    const denegado = respuestaDeAccesoDenegado(error);
    if (denegado) return denegado;
    console.error('Error exporting payment tracking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al exportar pagos',
    };
  }
}
