'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import {
  INITIAL_CASE_PHASE,
  validatePhaseTransition,
  phaseRequiresSubtype,
  isValidDesistimientoSubtype,
} from '@/lib/case-phases';
import { logger } from '@/lib/logger';
import {
  validateCaseBusinessRules,
  formatValidationErrors,
} from './validation-rules';
import { createNotificationForAction } from '@/features/notification/actions';
import { createAuditLog } from '@/features/audit-log/actions';
import {
  generateDocumentsForAdmission,
  generateDocumentsForAgreement,
  generateDocumentsForFailure,
} from '@/features/document/generate-documents';
import { isValidFailureType } from '@/features/document/templates-config';
import {
  fetchCaseForGeneration,
  asCaseWithRelations,
  persistGeneratedDocuments,
} from '@/features/document/persistence';
import {
  runWithGenerationLock,
  type GenerationKind,
} from '@/features/document/generation-request';
import { generatePaymentSchedule } from '@/features/payment/actions';
import { buildApoderadosCreate, mirrorPrincipalApoderado } from './apoderados';

import {
  createCaseFormSchema,
  updateCaseSchema,
  addDebtToCaseSchema,
  removeDebtFromCaseSchema,
  addLibranzaToCaseSchema,
  removeLibranzaFromCaseSchema,
  addSuspendedServiceToCaseSchema,
  removeSuspendedServiceFromCaseSchema,
  addAssetToCaseSchema,
  removeAssetFromCaseSchema,
  addDependentToCaseSchema,
  removeDependentFromCaseSchema,
  caseWithRelationsSchema,
  caseSummarySchema,
  debtResponseSchema,
  libranzaResponseSchema,
  suspendedServiceResponseSchema,
  assetResponseSchema,
  dependentResponseSchema,
  getAllCasesSchema,
  CASE_LIST_COLUMNS,
  getCaseByIdSchema,
  deleteCaseSchema,
  caseStatsSchema,
  dashboardStatsSchema,
  type DebtData,
  type AssetData,
  type LibranzaData,
  type SuspendedServiceData,
  type DependentData,
  type LegalProcessData,
  type AcreedorFormData,
  type BienFormData,
  type ProcesoJudicialFormData,
} from './schemas';

// Prisma Json fields reject `null` — they need `Prisma.JsonNull` or omission.
// Simplest safe approach: strip null values so Prisma keeps the column NULL via `undefined`.
const JSON_ARRAY_FIELDS = [
  'concMenoresAlimentos',
  'concMenoresUnion',
  'concClausulasAdicionalesAlimentos',
  'concClausulasAdicionalesUnion',
  'concClausulasAdicionalesDisolucion',
  'concClausulasAcuerdo',
  // Json? igual que los anteriores: sin esto, un payload con `null` aquí llega
  // a Prisma, que para columnas Json? exige `Prisma.DbNull`, no `null`.
  'apoyoClausulas',
] as const;

function sanitizeJsonFields<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data } as Record<string, unknown>;
  for (const key of JSON_ARRAY_FIELDS) {
    if (key in copy && copy[key] == null) {
      delete copy[key];
    }
  }
  return copy as T;
}

export async function getAllCases(): Promise<{
  success: boolean;
  data?: z.infer<typeof getAllCasesSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.VER_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para ver casos' };
    }

    // Build where clause based on user permissions and role
    let whereClause: {
      operatorId?: string;
      debtorId?: string;
      tenantId: string;
    } = {
      tenantId,
    };

    // Check user permissions to determine case visibility scope
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // Administrador, Operadora de Insolvencia, Secretaria: see all cases
      // No additional filtering needed
    } else if (canViewOwnCases) {
      // Abogado, Asistente Legal: only cases they are working on (assigned as operator)
      whereClause = {
        ...whereClause,
        operatorId: user.id,
      };
    } else if (canViewAsClient) {
      // Usuario: only cases where they are the debtor (client)
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      if (userDebtor) {
        whereClause = {
          ...whereClause,
          debtorId: userDebtor.id,
        };
      } else {
        // If user is not found as a debtor, return empty array
        return { success: true, data: [] };
      }
    } else {
      // If user has no specific case visibility permissions, return empty array
      return { success: true, data: [] };
    }

    // Solo las columnas que usa el listado (CASE_LIST_COLUMNS), no las 269 de
    // cada caso: menos datos por fila y sin depender de columnas que la
    // pantalla no lee. El detalle sí trae todo (getCaseById).
    const cases = await prisma.case.findMany({
      where: whereClause,
      select: {
        ...CASE_LIST_COLUMNS,
        debtor: true,
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdDate: 'desc',
      },
    });

    const result = getAllCasesSchema.parse(cases);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting all cases:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener casos',
    };
  }
}

export async function getCaseById(id: string): Promise<{
  success: boolean;
  data?: z.infer<typeof caseWithRelationsSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.VER_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para ver casos' };
    }

    const validatedInput = getCaseByIdSchema.parse(id);

    const caseItem = await prisma.case.findUnique({
      where: {
        id: validatedInput,
        tenantId,
      },
      include: {
        debtor: true,
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: true,
        debts: {
          include: {
            creditor: {
              select: {
                name: true,
              },
            },
          },
        },
        assets: true,
        libranzas: true,
        suspendedServices: true,
        dependents: true,
        legalProcesses: true,
        acreedores: true,
        bienes: true,
        procesosJudiciales: true,
        apoderados: { orderBy: { orden: 'asc' } },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!caseItem) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // Check if user has permission to view this specific case
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // Can see all cases
      const result = caseWithRelationsSchema.parse(caseItem);
      return { success: true, data: result };
    } else if (canViewOwnCases) {
      // Can only see own cases (where they are the operator)
      if (caseItem.operatorId === user.id) {
        const result = caseWithRelationsSchema.parse(caseItem);
        return { success: true, data: result };
      }
    } else if (canViewAsClient) {
      // Can only see cases where they are the debtor
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        select: { id: true },
      });

      if (userDebtor && caseItem.debtorId === userDebtor.id) {
        const result = caseWithRelationsSchema.parse(caseItem);
        return { success: true, data: result };
      }
    }

    // User doesn't have permission to view this case
    return { success: false, error: 'No tienes permisos para ver este caso' };
  } catch (error) {
    console.error('Error getting case by ID:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener el caso',
    };
  }
}

export async function createCase(
  input: z.infer<typeof createCaseFormSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof caseSummarySchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.CREAR_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para crear casos' };
    }

    const validatedInput = createCaseFormSchema.parse(input);
    const {
      debtorId,
      hearingDate,
      caseNumber,
      filingDate,
      designationDate,
      positionAcceptanceDate,
      inadmissionDate,
      admissionDate,
      firstHearingDate,
      suspensionDate,
      resultDeliveryDate,
      resultDate,
      monthlyPaymentAmount,
      variablePayment,
      capitalReductionPercent,
      // Debtor fields (not Case fields)
      monthlyIncome,
      monthlyExpenses,
      otherIncomeDescription,
      otherIncomeAmount,
      hasEmployerCertification,
      // Relations to create separately
      debts,
      assets,
      libranzas,
      suspendedServices,
      dependents,
      legalProcesses,
      // Formulario definitivo relations
      acreedores,
      bienes,
      procesosJudiciales,
      apoderados,
      // Formulario definitivo date fields (strings -> Date)
      fechaCesacionPagos,
      propuestaFechaInicioPago,
      fechaRadicacion,
      ...rest
    } = validatedInput;

    let finalCaseNumber = caseNumber;
    if (!finalCaseNumber) {
      // Service-specific prefix so case numbers are visually distinguishable.
      const caseTypeForNumber =
        (rest as { type?: string }).type ?? 'INSOLVENCY';
      const prefix =
        caseTypeForNumber === 'CONCILIATION'
          ? 'CONC'
          : caseTypeForNumber === 'SUPPORT_AGREEMENT'
            ? 'APOYO'
            : 'INSOL';

      // Last case of the SAME prefix — sequences are independent per service.
      const lastCase = await prisma.case.findFirst({
        where: { tenantId, caseNumber: { startsWith: `${prefix}-` } },
        orderBy: { createdDate: 'desc' },
        select: { caseNumber: true },
      });

      const lastNumber = lastCase?.caseNumber
        ? parseInt(lastCase.caseNumber.split('-')[1]) || 0
        : 0;
      finalCaseNumber = `${prefix}-${(lastNumber + 1).toString().padStart(6, '0')}`;
    }

    const debtor = await prisma.debtor.findUnique({
      where: {
        id: debtorId,
        tenantId,
      },
      // maritalStatus alimenta la regla de sociedad conyugal (C-2); vive en
      // Debtor, no en Case, por eso se trae aquí.
      select: { name: true, maritalStatus: true },
    });

    if (!debtor) {
      return { success: false, error: 'Deudor no encontrado' };
    }

    // C-2: las reglas del trámite se aplican en el servidor, no solo en el
    // formulario. Antes este módulo solo lo importaban los componentes de
    // React, así que un POST directo a esta action las saltaba todas.
    const rulesCheck = validateCaseBusinessRules(validatedInput, {
      mode: 'create',
      debtorMaritalStatus: debtor.maritalStatus,
      year: new Date().getFullYear(),
    });

    if (!rulesCheck.isValid) {
      return {
        success: false,
        error: `El expediente no cumple las reglas del trámite: ${formatValidationErrors(rulesCheck)}`,
      };
    }

    if (rulesCheck.warnings.length > 0) {
      logger.warn('Caso creado con advertencias de reglas de negocio', {
        action: 'create-case',
        debtorId,
        warnings: rulesCheck.warnings.map((w) => w.field),
      });
    }

    // Update debtor income/expense info if provided
    if (
      monthlyIncome !== undefined ||
      monthlyExpenses !== undefined ||
      otherIncomeDescription !== undefined ||
      otherIncomeAmount !== undefined ||
      hasEmployerCertification !== undefined
    ) {
      await prisma.debtor.update({
        where: {
          id: debtorId,
          tenantId,
        },
        data: {
          ...(monthlyIncome !== undefined && { monthlyIncome }),
          ...(monthlyExpenses !== undefined && { monthlyExpenses }),
          ...(otherIncomeDescription !== undefined && {
            otherIncomeDescription,
          }),
          ...(otherIncomeAmount !== undefined && { otherIncomeAmount }),
          ...(hasEmployerCertification !== undefined && {
            hasEmployerCertification,
          }),
        },
      });
    }

    // Auto-generate tramite based on case type if not provided
    const autoTramite =
      rest.tramite ||
      (() => {
        switch (rest.type) {
          case 'INSOLVENCY':
            return 'Negociación de deudas';
          case 'CONCILIATION':
            return 'Conciliación';
          case 'SUPPORT_AGREEMENT':
            return 'Acuerdo de apoyo';
          default:
            return 'Negociación de deudas';
        }
      })();

    const safeRest = sanitizeJsonFields(rest);

    const newCase = await prisma.case.create({
      data: {
        ...safeRest,
        tramite: autoTramite,
        debtorId,
        caseNumber: finalCaseNumber,
        debtorName: debtor.name,
        tenantId,
        // C-1: la fase inicial no es negociable desde el cliente. Antes era
        // `rest.phase ?? 'Inicial'`, así que se podía crear un expediente ya
        // en "Acuerdo aprobado", saltándose admisión, negociación y toda su
        // documentación. Todo avance pasa ahora por `updateCasePhase`.
        phase: INITIAL_CASE_PHASE,
        hearingDate:
          hearingDate && hearingDate.trim() ? new Date(hearingDate) : null,
        filingDate:
          filingDate && filingDate.trim() ? new Date(filingDate) : null,
        designationDate:
          designationDate && designationDate.trim()
            ? new Date(designationDate)
            : null,
        positionAcceptanceDate:
          positionAcceptanceDate && positionAcceptanceDate.trim()
            ? new Date(positionAcceptanceDate)
            : null,
        inadmissionDate:
          inadmissionDate && inadmissionDate.trim()
            ? new Date(inadmissionDate)
            : null,
        admissionDate:
          admissionDate && admissionDate.trim()
            ? new Date(admissionDate)
            : null,
        firstHearingDate:
          firstHearingDate && firstHearingDate.trim()
            ? new Date(firstHearingDate)
            : null,
        suspensionDate:
          suspensionDate && suspensionDate.trim()
            ? new Date(suspensionDate)
            : null,
        resultDeliveryDate:
          resultDeliveryDate && resultDeliveryDate.trim()
            ? new Date(resultDeliveryDate)
            : null,
        resultDate:
          resultDate && resultDate.trim() ? new Date(resultDate) : null,
        monthlyPaymentAmount: monthlyPaymentAmount ?? null,
        variablePayment: variablePayment ?? null,
        capitalReductionPercent: capitalReductionPercent ?? null,
        // Formulario definitivo date conversions
        fechaCesacionPagos:
          fechaCesacionPagos && fechaCesacionPagos.trim()
            ? new Date(fechaCesacionPagos)
            : null,
        propuestaFechaInicioPago:
          propuestaFechaInicioPago && propuestaFechaInicioPago.trim()
            ? new Date(propuestaFechaInicioPago)
            : null,
        fechaRadicacion:
          fechaRadicacion && fechaRadicacion.trim()
            ? new Date(fechaRadicacion)
            : null,
        // Note: debts, assets, and other relations are created separately after case creation
        assets:
          assets && assets.length > 0
            ? {
                create: assets.map((asset: AssetData) => ({
                  name: asset.name,
                  type: asset.type,
                  value: parseFloat(asset.value),
                  description: asset.description,
                  tenantId,
                  // Real estate specific
                  propertyType: asset.propertyType,
                  address: asset.address,
                  registrationNumber: asset.registrationNumber,
                  encumbrance: asset.encumbrance,
                  affectation: asset.affectation,
                  precautionaryMeasure: asset.precautionaryMeasure,
                  proofDocument: asset.proofDocument,
                  isFamilyHome: asset.isFamilyHome,
                  isInalienablePatrimony: asset.isInalienablePatrimony,
                  // Vehicle specific
                  brand: asset.brand,
                  model: asset.model,
                  condition: asset.condition,
                  licensePlate: asset.licensePlate,
                  transitAuthority: asset.transitAuthority,
                  guaranteeInFavorOf: asset.guaranteeInFavorOf,
                  guaranteeAmount: asset.guaranteeAmount
                    ? parseFloat(asset.guaranteeAmount)
                    : null,
                  material: asset.material,
                })),
              }
            : undefined,
        libranzas:
          libranzas && libranzas.length > 0
            ? {
                create: libranzas.map((libranza: LibranzaData) => ({
                  payerName: libranza.payerName,
                  payerAddress: libranza.payerAddress,
                  payerEmail: libranza.payerEmail,
                  payerPhone: libranza.payerPhone,
                  deductedAmount: parseFloat(libranza.deductedAmount),
                  productAndCreditor: libranza.productAndCreditor,
                  tenantId,
                })),
              }
            : undefined,
        suspendedServices:
          suspendedServices && suspendedServices.length > 0
            ? {
                create: suspendedServices.map(
                  (service: SuspendedServiceData) => ({
                    creditorName: service.creditorName,
                    address: service.address,
                    email: service.email,
                    phone: service.phone,
                    suspendedProduct: service.suspendedProduct,
                    amountOwed: parseFloat(service.amountOwed),
                    tenantId,
                  }),
                ),
              }
            : undefined,
        dependents:
          dependents && dependents.length > 0
            ? {
                create: dependents.map((dependent: DependentData) => ({
                  name: dependent.name,
                  age: parseInt(dependent.age.toString()),
                  relationship: dependent.relationship,
                  tenantId,
                })),
              }
            : undefined,
        legalProcesses:
          legalProcesses && legalProcesses.length > 0
            ? {
                create: legalProcesses.map((process: LegalProcessData) => ({
                  description: `${process.processType} - ${process.plaintiff}`,
                  processType: process.processType,
                  plaintiff: process.plaintiff,
                  court: process.court,
                  fileNumber: process.fileNumber,
                  precautionaryMeasure: process.precautionaryMeasure,
                  tenantId,
                })),
              }
            : undefined,
        // Formulario definitivo - nested relations
        acreedores:
          acreedores && acreedores.length > 0
            ? {
                create: acreedores.map((a: AcreedorFormData) => ({
                  acreedorTipo: a.acreedorTipo,
                  acreedorNombreRazonSocial: a.acreedorNombreRazonSocial,
                  acreedorTipoIdentificacion: a.acreedorTipoIdentificacion,
                  acreedorIdentificacion: a.acreedorIdentificacion,
                  acreedorDireccion: a.acreedorDireccion,
                  acreedorCiudad: a.acreedorCiudad,
                  acreedorCorreo: a.acreedorCorreo,
                  acreedorTelefono: a.acreedorTelefono,
                  tipoObligacion: a.tipoObligacion,
                  numeroObligacion: a.numeroObligacion,
                  fechaOtorgamiento: a.fechaOtorgamiento
                    ? new Date(a.fechaOtorgamiento)
                    : null,
                  fechaVencimiento: a.fechaVencimiento
                    ? new Date(a.fechaVencimiento)
                    : null,
                  fechaMora: a.fechaMora ? new Date(a.fechaMora) : null,
                  diasMora: a.diasMora,
                  valorCapital: a.valorCapital
                    ? parseFloat(a.valorCapital)
                    : null,
                  valorInteresesCorrientes: a.valorInteresesCorrientes
                    ? parseFloat(a.valorInteresesCorrientes)
                    : null,
                  valorInteresesMora: a.valorInteresesMora
                    ? parseFloat(a.valorInteresesMora)
                    : null,
                  valorGastosCobranza: a.valorGastosCobranza
                    ? parseFloat(a.valorGastosCobranza)
                    : null,
                  valorTotalObligacion: a.valorTotalObligacion
                    ? parseFloat(a.valorTotalObligacion)
                    : null,
                  naturalezaCredito: a.naturalezaCredito,
                  obligacionCodeudores: a.obligacionCodeudores ?? false,
                  nombreCodeudores: a.nombreCodeudores,
                  garantiaAsociada: a.garantiaAsociada ?? false,
                  tipoGarantia: a.tipoGarantia,
                  descripcionGarantia: a.descripcionGarantia,
                  procesoJudicialEnCurso: a.procesoJudicialEnCurso ?? false,
                  tipoProcesoJudicial: a.tipoProcesoJudicial,
                  juzgadoNombre: a.juzgadoNombre,
                  juzgadoCiudad: a.juzgadoCiudad,
                  procesoJudicialRadicado: a.procesoJudicialRadicado,
                  demandanteNombre: a.demandanteNombre,
                  etapaProcesal: a.etapaProcesal,
                  tenantId,
                })),
              }
            : undefined,
        bienes:
          bienes && bienes.length > 0
            ? {
                create: bienes.map((b: BienFormData) => ({
                  bienTipo: b.bienTipo,
                  bienDescripcion: b.bienDescripcion,
                  bienUbicacion: b.bienUbicacion,
                  bienMatriculaInmobiliaria: b.bienMatriculaInmobiliaria,
                  bienPlaca: b.bienPlaca,
                  bienEntidadFinanciera: b.bienEntidadFinanciera,
                  bienValorComercial: b.bienValorComercial
                    ? parseFloat(b.bienValorComercial)
                    : null,
                  bienValorCatastral: b.bienValorCatastral
                    ? parseFloat(b.bienValorCatastral)
                    : null,
                  bienValorLibros: b.bienValorLibros
                    ? parseFloat(b.bienValorLibros)
                    : null,
                  bienGravamenes: b.bienGravamenes ?? false,
                  descripcionGravamen: b.descripcionGravamen,
                  bienEmbargado: b.bienEmbargado ?? false,
                  bienAfectadoViviendaFamiliar:
                    b.bienAfectadoViviendaFamiliar ?? false,
                  bienEnLeasing: b.bienEnLeasing ?? false,
                  tenantId,
                })),
              }
            : undefined,
        procesosJudiciales:
          procesosJudiciales && procesosJudiciales.length > 0
            ? {
                create: procesosJudiciales.map(
                  (p: ProcesoJudicialFormData) => ({
                    tipoProceso: p.tipoProceso,
                    juzgadoNombre: p.juzgadoNombre,
                    juzgadoCiudad: p.juzgadoCiudad,
                    procesoJudicialRadicado: p.procesoJudicialRadicado,
                    demandanteNombre: p.demandanteNombre,
                    demandadoNombre: p.demandadoNombre,
                    cuantiaProceso: p.cuantiaProceso
                      ? parseFloat(p.cuantiaProceso)
                      : null,
                    estadoProceso: p.estadoProceso,
                    tenantId,
                  }),
                ),
              }
            : undefined,
        // Apoderados (Sección XI): lista completa en la tabla nueva + espejo del
        // principal en las 8 columnas escalares (solo si vienen vacías).
        apoderados: buildApoderadosCreate(apoderados, tenantId),
        ...mirrorPrincipalApoderado(apoderados, rest),
      },
    });

    // Create debts with creditors (separate step to handle creditor creation)
    if (debts && debts.length > 0) {
      for (const debt of debts) {
        // Find or create creditor by name
        let creditorId = debt.creditorId;

        if (!creditorId || creditorId === 'PENDING') {
          const creditorName = debt.creditor || 'Acreedor sin nombre';

          // Try to find existing creditor by name
          let existingCreditor = await prisma.creditor.findFirst({
            where: {
              name: creditorName,
              tenantId,
            },
            select: { id: true },
          });

          // If not found, create new creditor with required fields
          if (!existingCreditor) {
            const autoNit = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            existingCreditor = await prisma.creditor.create({
              data: {
                name: creditorName,
                nit: autoNit,
                type: 'BANK', // Default type
                email: `${autoNit.toLowerCase()}@placeholder.com`, // Required field
                phone: 'N/A', // Required field
                address: 'Pendiente de actualizar', // Required field
                representative: 'Pendiente de actualizar', // Required field
                tenantId,
              },
              select: { id: true },
            });
          }

          creditorId = existingCreditor.id;
        }

        // Create the debt with the creditor ID
        await prisma.debt.create({
          data: {
            amount: debt.capitalAmount ?? debt.amount ?? '0',
            interestRate: parseFloat(debt.interestRate || '0'),
            type: debt.type || 'CREDIT',
            creditorId,
            caseId: newCase.id,
            tenantId,
            // Detailed creditor info
            creditorAddress: debt.creditorAddress,
            creditorCity: debt.creditorCity,
            creditorEmail: debt.creditorEmail,
            capitalAmount: debt.capitalAmount
              ? parseFloat(debt.capitalAmount)
              : null,
            interestAmount: debt.interestAmount
              ? parseFloat(debt.interestAmount)
              : null,
            isDeferred: debt.isDeferred ?? false,
            documentType: debt.documentType,
            grantDate: debt.grantDate ? new Date(debt.grantDate) : null,
            dueDate: debt.dueDate ? new Date(debt.dueDate) : null,
            creditClassification: debt.creditClassification,
            hasActiveLibranza: debt.hasActiveLibranza ?? false,
            creditorClass: debt.creditorClass,
            percentageOfTotal: debt.percentageOfTotal
              ? parseFloat(debt.percentageOfTotal)
              : null,
            daysOverdue: debt.daysOverdue ?? 0,
            coDebtorName: debt.coDebtorName,
            coDebtorCity: debt.coDebtorCity,
            coDebtorAddress: debt.coDebtorAddress,
          },
        });
      }
    }

    revalidateTag('cases');

    await createNotificationForAction(
      'case_created',
      `${finalCaseNumber} - ${debtor.name}`,
      prisma,
      tenantId,
      newCase.id,
      newCase.id,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: newCase.id,
      entityName: `${finalCaseNumber} - ${debtor.name}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    // P3+P4: generación inicial en background post-response.
    // El lock (DocumentGenerationRequest.activeKey) evita duplicados; after()
    // mantiene viva la función serverless tras responder (a diferencia del
    // fire-and-forget anterior, que Vercel podía cortar); el job actualiza el
    // estado consultable y notifica in-app al terminar o fallar.
    try {
      const { claimGenerationRequest } = await import(
        '@/features/document/generation-request'
      );
      const { runInitialGenerationJob } = await import(
        '@/features/document/generation-job'
      );
      const { after } = await import('next/server');

      const claim = await claimGenerationRequest({
        tenantId,
        caseId: newCase.id,
        kind: 'INITIAL',
        requestedById: user.id,
      });

      if (claim.claimed) {
        after(() =>
          runInitialGenerationJob({
            requestId: claim.request.id,
            caseId: newCase.id,
            tenantId,
            requestedById: user.id,
          }),
        );
      }
    } catch (genError) {
      // La creación del caso no debe fallar por el arranque de la generación;
      // el usuario puede lanzarla manualmente desde la sección Documentos.
      console.error(
        `Error iniciando generación de documentos para ${finalCaseNumber}:`,
        genError,
      );
    }

    const result = caseSummarySchema.parse(newCase);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating case:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear el caso',
    };
  }
}

export async function updateCase(
  input: z.infer<typeof updateCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof caseSummarySchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.EDITAR_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = updateCaseSchema.parse(input);
    const {
      id,
      debtorId,
      operatorId,
      hearingDate,
      filingDate,
      designationDate,
      positionAcceptanceDate,
      inadmissionDate,
      admissionDate,
      firstHearingDate,
      suspensionDate,
      resultDeliveryDate,
      resultDate,
      // Debtor fields (not Case fields)
      monthlyIncome,
      monthlyExpenses,
      otherIncomeDescription,
      otherIncomeAmount,
      hasEmployerCertification,
      ...rest
    } = validatedInput;

    const safeRestUpdate = sanitizeJsonFields(rest);

    // Wrap debtor + case update in a transaction with optimistic locking
    const updatedCase = await prisma.$transaction(async (tx) => {
      // Se lee siempre (no solo cuando llega `version`): la fase persistida es
      // el punto de partida obligatorio del guard de transición (C-1).
      const current = await tx.case.findUnique({
        where: { id, tenantId },
        select: { version: true, phase: true },
      });
      if (!current) {
        throw new Error('Caso no encontrado');
      }

      // Optimistic lock check: if caller sends version, it must match current DB version
      if (
        validatedInput.version !== undefined &&
        current.version !== validatedInput.version
      ) {
        throw new Error(
          'Este caso fue modificado por otro usuario. Recargue la página e intente de nuevo.',
        );
      }

      // C-2: mismas reglas de negocio que en creación, en modo 'update' (solo
      // se evalúa lo que trae el payload; una edición parcial no debe fallar
      // por campos que ni siquiera toca).
      const rulesCheck = validateCaseBusinessRules(validatedInput, {
        mode: 'update',
        year: new Date().getFullYear(),
      });
      if (!rulesCheck.isValid) {
        throw new Error(
          `El expediente no cumple las reglas del trámite: ${formatValidationErrors(rulesCheck)}`,
        );
      }

      // C-1: `updateCase` era la puerta trasera de la máquina de estados —
      // escribía `phase` directo desde el spread del payload. Ahora toda
      // escritura de fase pasa por el mismo guard que `updateCasePhase`.
      // El formulario de edición reenvía siempre la fase actual sin cambiarla:
      // ese caso es un no-op válido y no requiere transición.
      if (safeRestUpdate.phase !== undefined) {
        const check = validatePhaseTransition(
          current.phase,
          safeRestUpdate.phase as string,
        );
        if (!check.valid) {
          throw new Error(check.reason);
        }
        if (!check.isNoop) {
          throw new Error(
            'El cambio de fase no puede hacerse desde la edición del caso. Use la acción "Cambiar fase" para que se registren la auditoría y la documentación asociadas.',
          );
        }
      }

      // Update debtor income/expense info if provided
      if (
        monthlyIncome !== undefined ||
        monthlyExpenses !== undefined ||
        otherIncomeDescription !== undefined ||
        otherIncomeAmount !== undefined ||
        hasEmployerCertification !== undefined
      ) {
        await tx.debtor.update({
          where: { id: debtorId, tenantId },
          data: {
            ...(monthlyIncome !== undefined && { monthlyIncome }),
            ...(monthlyExpenses !== undefined && { monthlyExpenses }),
            ...(otherIncomeDescription !== undefined && {
              otherIncomeDescription,
            }),
            ...(otherIncomeAmount !== undefined && { otherIncomeAmount }),
            ...(hasEmployerCertification !== undefined && {
              hasEmployerCertification,
            }),
          },
        });
      }

      return tx.case.update({
        where: { id, tenantId },
        data: {
          ...safeRestUpdate,
          version: { increment: 1 },
          debtor: { connect: { id: debtorId } },
          operator: { connect: { id: operatorId } },
          hearingDate:
            hearingDate && hearingDate.trim()
              ? new Date(hearingDate)
              : undefined,
          filingDate:
            filingDate && filingDate.trim() ? new Date(filingDate) : undefined,
          designationDate:
            designationDate && designationDate.trim()
              ? new Date(designationDate)
              : undefined,
          positionAcceptanceDate:
            positionAcceptanceDate && positionAcceptanceDate.trim()
              ? new Date(positionAcceptanceDate)
              : undefined,
          inadmissionDate:
            inadmissionDate && inadmissionDate.trim()
              ? new Date(inadmissionDate)
              : undefined,
          admissionDate:
            admissionDate && admissionDate.trim()
              ? new Date(admissionDate)
              : undefined,
          firstHearingDate:
            firstHearingDate && firstHearingDate.trim()
              ? new Date(firstHearingDate)
              : undefined,
          suspensionDate:
            suspensionDate && suspensionDate.trim()
              ? new Date(suspensionDate)
              : undefined,
          resultDeliveryDate:
            resultDeliveryDate && resultDeliveryDate.trim()
              ? new Date(resultDeliveryDate)
              : undefined,
          resultDate:
            resultDate && resultDate.trim() ? new Date(resultDate) : undefined,
        },
      });
    });

    revalidateTag('cases');

    await createNotificationForAction(
      'case_updated',
      `${updatedCase.caseNumber} - ${updatedCase.debtorName}`,
      prisma,
      tenantId,
      updatedCase.id,
      updatedCase.id,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'updated',
      entityType: 'case',
      entityId: updatedCase.id,
      entityName: `${updatedCase.caseNumber} - ${updatedCase.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    const result = caseSummarySchema.parse(updatedCase);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error updating case:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al actualizar el caso',
    };
  }
}

export async function addDebtToCase(
  input: z.infer<typeof addDebtToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof debtResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addDebtToCaseSchema.parse(input);
    const { caseId, creditorId, amount, type, interestRate } = validatedInput;

    const caseData = await prisma.case.findUnique({
      where: {
        id: caseId,
        tenantId,
      },
      select: { debtorId: true },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const debt = await prisma.debt.create({
      data: {
        amount: parseFloat(amount.replace(/[^0-9.-]/g, '')),
        interestRate: parseFloat(interestRate),
        type,
        caseId,
        creditorId,
        debtorId: caseData.debtorId,
        tenantId,
      },
      include: {
        creditor: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidateTag('cases');

    const result = debtResponseSchema.parse({
      id: debt.id,
      amount: debt.amount,
      interestRate: debt.interestRate,
      type: debt.type,
      creditor: debt.creditor.name,
      creditorId: debt.creditorId,
    });

    void createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Deuda en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'debt', subEntityId: result.id },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding debt to case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar deuda al caso',
    };
  }
}

export async function removeDebtFromCase(
  input: z.infer<typeof removeDebtFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof debtResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeDebtFromCaseSchema.parse(input);
    const { debtId } = validatedInput;

    const deletedDebt = await prisma.debt.delete({
      where: {
        id: debtId,
        tenantId,
      },
      include: {
        creditor: true,
      },
    });

    revalidateTag('cases');

    const result = debtResponseSchema.parse({
      id: deletedDebt.id,
      creditor: deletedDebt.creditor.name,
      creditorId: deletedDebt.creditorId,
      amount: deletedDebt.amount,
      type: deletedDebt.type,
      interestRate: deletedDebt.interestRate,
    });

    void createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedDebt.caseId,
      entityName: 'Deuda en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'debt', subEntityId: result.id },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error removing debt from case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar deuda del caso',
    };
  }
}

export async function addLibranzaToCase(
  input: z.infer<typeof addLibranzaToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof libranzaResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addLibranzaToCaseSchema.parse(input);
    const {
      caseId,
      payerName,
      payerAddress,
      payerEmail,
      payerPhone,
      deductedAmount,
      productAndCreditor,
    } = validatedInput;

    // Solo se comprueba que el caso exista y sea del tenant: no hace falta la fila.
    const caseData = await prisma.case.findUnique({
      where: {
        id: caseId,
        tenantId,
      },
      select: { id: true },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const libranza = await prisma.libranza.create({
      data: {
        payerName,
        payerAddress: payerAddress || null,
        payerEmail: payerEmail || null,
        payerPhone: payerPhone || null,
        deductedAmount: parseFloat(deductedAmount.replace(/[^0-9.-]/g, '')),
        productAndCreditor: productAndCreditor || null,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    const result = libranzaResponseSchema.parse({
      id: libranza.id,
      payerName: libranza.payerName,
      payerAddress: libranza.payerAddress,
      payerEmail: libranza.payerEmail,
      payerPhone: libranza.payerPhone,
      deductedAmount: libranza.deductedAmount.toString(),
      productAndCreditor: libranza.productAndCreditor,
    });

    void createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Libranza en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'libranza', subEntityId: result.id },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding libranza to case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar libranza al caso',
    };
  }
}

export async function removeLibranzaFromCase(
  input: z.infer<typeof removeLibranzaFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof libranzaResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeLibranzaFromCaseSchema.parse(input);
    const { libranzaId } = validatedInput;

    const deletedLibranza = await prisma.libranza.delete({
      where: {
        id: libranzaId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedLibranza.caseId,
      entityName: 'Libranza en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'libranza', subEntityId: deletedLibranza.id },
    });

    const result = libranzaResponseSchema.parse({
      id: deletedLibranza.id,
      payerName: deletedLibranza.payerName,
      payerAddress: deletedLibranza.payerAddress,
      payerEmail: deletedLibranza.payerEmail,
      payerPhone: deletedLibranza.payerPhone,
      deductedAmount: deletedLibranza.deductedAmount.toString(),
      productAndCreditor: deletedLibranza.productAndCreditor,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error removing libranza from case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar libranza del caso',
    };
  }
}

export async function addSuspendedServiceToCase(
  input: z.infer<typeof addSuspendedServiceToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof suspendedServiceResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addSuspendedServiceToCaseSchema.parse(input);
    const {
      caseId,
      creditorName,
      address,
      email,
      phone,
      amountOwed,
      serviceType,
    } = validatedInput;

    // Solo se comprueba que el caso exista y sea del tenant: no hace falta la fila.
    const caseData = await prisma.case.findUnique({
      where: {
        id: caseId,
        tenantId,
      },
      select: { id: true },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const suspendedService = await prisma.suspendedService.create({
      data: {
        creditorName,
        address: address || null,
        email: email || null,
        phone: phone || null,
        amountOwed: parseFloat(amountOwed.replace(/[^0-9.-]/g, '')),
        suspendedProduct: serviceType || null,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Servicio suspendido en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        subEntity: 'suspendedService',
        subEntityId: suspendedService.id,
      },
    });

    const result = suspendedServiceResponseSchema.parse({
      id: suspendedService.id,
      creditorName: suspendedService.creditorName,
      address: suspendedService.address,
      email: suspendedService.email,
      phone: suspendedService.phone,
      amountOwed: suspendedService.amountOwed.toString(),
      serviceType: suspendedService.suspendedProduct,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding suspended service to case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar servicio suspendido al caso',
    };
  }
}

export async function removeSuspendedServiceFromCase(
  input: z.infer<typeof removeSuspendedServiceFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof suspendedServiceResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeSuspendedServiceFromCaseSchema.parse(input);
    const { suspendedServiceId } = validatedInput;

    const deletedService = await prisma.suspendedService.delete({
      where: {
        id: suspendedServiceId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedService.caseId,
      entityName: 'Servicio suspendido en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        subEntity: 'suspendedService',
        subEntityId: deletedService.id,
      },
    });

    const result = suspendedServiceResponseSchema.parse({
      id: deletedService.id,
      creditorName: deletedService.creditorName,
      address: deletedService.address,
      email: deletedService.email,
      phone: deletedService.phone,
      amountOwed: deletedService.amountOwed.toString(),
      serviceType: deletedService.suspendedProduct,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error removing suspended service from case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar servicio suspendido del caso',
    };
  }
}

export async function addAssetToCase(
  input: z.infer<typeof addAssetToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof assetResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addAssetToCaseSchema.parse(input);
    const {
      caseId,
      name,
      type,
      value,
      description,
      propertyType,
      address,
      registrationNumber,
      encumbrance,
      affectation,
      precautionaryMeasure,
      proofDocument,
      isFamilyHome,
      isInalienablePatrimony,
      brand,
      model,
      condition,
      licensePlate,
      transitAuthority,
      guaranteeInFavorOf,
      guaranteeAmount,
      material,
    } = validatedInput;

    // Solo se comprueba que el caso exista y sea del tenant: no hace falta la fila.
    const caseData = await prisma.case.findUnique({
      where: {
        id: caseId,
        tenantId,
      },
      select: { id: true },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const asset = await prisma.asset.create({
      data: {
        name,
        type,
        value: parseFloat(value.replace(/[^0-9.-]/g, '')),
        description: description || null,
        propertyType: propertyType || null,
        address: address || null,
        registrationNumber: registrationNumber || null,
        encumbrance: encumbrance || null,
        affectation: affectation || null,
        precautionaryMeasure: precautionaryMeasure || null,
        proofDocument: proofDocument || null,
        isFamilyHome: isFamilyHome ?? undefined,
        isInalienablePatrimony: isInalienablePatrimony ?? undefined,
        brand: brand || null,
        model: model || null,
        condition: condition || null,
        licensePlate: licensePlate || null,
        transitAuthority: transitAuthority || null,
        guaranteeInFavorOf: guaranteeInFavorOf || null,
        guaranteeAmount: guaranteeAmount
          ? parseFloat(guaranteeAmount.replace(/[^0-9.-]/g, ''))
          : null,
        material: material || null,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Bien en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'asset', subEntityId: asset.id },
    });

    const result = assetResponseSchema.parse({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      value: asset.value.toString(),
      description: asset.description,
      propertyType: asset.propertyType,
      address: asset.address,
      registrationNumber: asset.registrationNumber,
      encumbrance: asset.encumbrance,
      affectation: asset.affectation,
      precautionaryMeasure: asset.precautionaryMeasure,
      proofDocument: asset.proofDocument,
      isFamilyHome: asset.isFamilyHome,
      isInalienablePatrimony: asset.isInalienablePatrimony,
      brand: asset.brand,
      model: asset.model,
      condition: asset.condition,
      licensePlate: asset.licensePlate,
      transitAuthority: asset.transitAuthority,
      guaranteeInFavorOf: asset.guaranteeInFavorOf,
      guaranteeAmount: asset.guaranteeAmount?.toString() ?? null,
      material: asset.material,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding asset to case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar bien al caso',
    };
  }
}

export async function removeAssetFromCase(
  input: z.infer<typeof removeAssetFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof assetResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeAssetFromCaseSchema.parse(input);
    const { assetId } = validatedInput;

    const deletedAsset = await prisma.asset.delete({
      where: {
        id: assetId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedAsset.caseId,
      entityName: 'Bien en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'asset', subEntityId: deletedAsset.id },
    });

    const result = assetResponseSchema.parse({
      id: deletedAsset.id,
      name: deletedAsset.name,
      type: deletedAsset.type,
      value: deletedAsset.value.toString(),
      description: deletedAsset.description,
      propertyType: deletedAsset.propertyType,
      address: deletedAsset.address,
      registrationNumber: deletedAsset.registrationNumber,
      encumbrance: deletedAsset.encumbrance,
      affectation: deletedAsset.affectation,
      precautionaryMeasure: deletedAsset.precautionaryMeasure,
      proofDocument: deletedAsset.proofDocument,
      isFamilyHome: deletedAsset.isFamilyHome,
      isInalienablePatrimony: deletedAsset.isInalienablePatrimony,
      brand: deletedAsset.brand,
      model: deletedAsset.model,
      condition: deletedAsset.condition,
      licensePlate: deletedAsset.licensePlate,
      transitAuthority: deletedAsset.transitAuthority,
      guaranteeInFavorOf: deletedAsset.guaranteeInFavorOf,
      guaranteeAmount: deletedAsset.guaranteeAmount?.toString() ?? null,
      material: deletedAsset.material,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error removing asset from case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar bien del caso',
    };
  }
}

export async function addDependentToCase(
  input: z.infer<typeof addDependentToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof dependentResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addDependentToCaseSchema.parse(input);
    const { caseId, name, age, relationship } = validatedInput;

    // Solo se comprueba que el caso exista y sea del tenant: no hace falta la fila.
    const caseData = await prisma.case.findUnique({
      where: {
        id: caseId,
        tenantId,
      },
      select: { id: true },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const dependent = await prisma.dependent.create({
      data: {
        name,
        age: parseInt(age),
        relationship,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Dependiente en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'dependent', subEntityId: dependent.id },
    });

    const result = dependentResponseSchema.parse({
      id: dependent.id,
      name: dependent.name,
      age: dependent.age.toString(),
      relationship: dependent.relationship,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding dependent to case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar dependiente al caso',
    };
  }
}

export async function removeDependentFromCase(
  input: z.infer<typeof removeDependentFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof dependentResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeDependentFromCaseSchema.parse(input);
    const { dependentId } = validatedInput;

    const deletedDependent = await prisma.dependent.delete({
      where: {
        id: dependentId,
        tenantId,
      },
    });

    revalidateTag('cases');

    void createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedDependent.caseId,
      entityName: 'Dependiente en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'dependent', subEntityId: deletedDependent.id },
    });

    const result = dependentResponseSchema.parse({
      id: deletedDependent.id,
      name: deletedDependent.name,
      age: deletedDependent.age.toString(),
      relationship: deletedDependent.relationship,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error removing dependent from case:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar dependiente del caso',
    };
  }
}

export async function deleteCase(
  input: z.infer<typeof deleteCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof caseSummarySchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.ELIMINAR_CASOS);
    if (!hasPermission) {
      return {
        success: false,
        error: 'No tienes permisos para eliminar casos',
      };
    }

    const validatedInput = deleteCaseSchema.parse(input);
    const { id } = validatedInput;

    // Get case info before deleting for the notification
    // Solo se comprueba que el caso exista y sea del tenant: no hace falta la fila.
    const caseToDelete = await prisma.case.findUnique({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });

    if (!caseToDelete) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // Delete the case and all related records in a transaction
    // Models without onDelete:Cascade must be deleted manually first
    const deletedCase = await prisma.$transaction(async (tx) => {
      // 1. Delete related records that don't have onDelete: Cascade
      // Include tenantId for defense-in-depth (CUIDs are globally unique, but belt+suspenders)
      await tx.document.deleteMany({ where: { caseId: id, tenantId } });
      await tx.debt.deleteMany({ where: { caseId: id, tenantId } });
      await tx.asset.deleteMany({ where: { caseId: id, tenantId } });
      await tx.legalProcess.deleteMany({ where: { caseId: id, tenantId } });
      await tx.libranza.deleteMany({ where: { caseId: id, tenantId } });
      await tx.suspendedService.deleteMany({ where: { caseId: id, tenantId } });
      await tx.dependent.deleteMany({ where: { caseId: id, tenantId } });

      // 2. Delete the case (Acreedor, Bien, ProcesoJudicial, Notification cascade automatically)
      return tx.case.delete({
        where: {
          id,
          tenantId,
        },
      });
    });

    revalidateTag('cases');

    // Create notification WITHOUT caseId reference (case no longer exists)
    await createNotificationForAction(
      'case_deleted',
      `${deletedCase.caseNumber} - ${deletedCase.debtorName}`,
      prisma,
      tenantId,
      undefined, // No entityId since case is deleted
      undefined, // No caseId since case is deleted
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: id,
      entityName: `${deletedCase.caseNumber} - ${deletedCase.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    const result = caseSummarySchema.parse(deletedCase);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error deleting case:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al eliminar el caso',
    };
  }
}

export async function getCaseStats(): Promise<{
  success: boolean;
  data?: z.infer<typeof caseStatsSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    const hasPermission = user.permissions.includes(P.VER_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para ver casos' };
    }

    // Build where clause based on user permissions (same logic as getAllCases)
    let whereClause: {
      operatorId?: string;
      debtorId?: string;
      tenantId: string;
    } = {
      tenantId,
    };

    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // No additional filtering needed
    } else if (canViewOwnCases) {
      whereClause = {
        ...whereClause,
        operatorId: user.id,
      };
    } else if (canViewAsClient) {
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        select: { id: true },
      });

      if (userDebtor) {
        whereClause = {
          ...whereClause,
          debtorId: userDebtor.id,
        };
      } else {
        // Return empty stats if user is not found as debtor
        const emptyStats = caseStatsSchema.parse({
          total: 0,
          byType: [],
          averageDebt: 0,
          totalDebt: null,
          totalCreditors: null,
        });
        return { success: true, data: emptyStats };
      }
    } else {
      // Return empty stats if no permissions
      const emptyStats = caseStatsSchema.parse({
        total: 0,
        byType: [],
        averageDebt: 0,
        totalDebt: null,
        totalCreditors: null,
      });
      return { success: true, data: emptyStats };
    }

    const [total, byType, totalDebtResult, totalCreditors] = await Promise.all([
      prisma.case.count({ where: whereClause }),
      prisma.case.groupBy({
        by: ['type'],
        where: whereClause,
        _count: {
          id: true,
        },
      }),
      prisma.case.aggregate({
        where: whereClause,
        _sum: {
          totalDebt: true,
        },
      }),
      prisma.case.aggregate({
        where: whereClause,
        _sum: {
          creditors: true,
        },
      }),
    ]);

    const averageDebt =
      total > 0 ? Number(totalDebtResult._sum.totalDebt || 0) / total : 0;

    const stats = {
      total,
      byType,
      averageDebt,
      totalDebt: totalDebtResult._sum.totalDebt,
      totalCreditors: totalCreditors._sum.creditors,
    };

    const result = caseStatsSchema.parse(stats);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting case stats:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener estadísticas de casos',
    };
  }
}

// ---------------------------------------------------------------------------
// getDashboardStats — real-time stats for the dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<{
  success: boolean;
  data?: z.infer<typeof dashboardStatsSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    const hasPermission = user.permissions.includes(P.VER_CASOS);
    if (!hasPermission) {
      return { success: false, error: 'No tienes permisos para ver casos' };
    }

    // Build where clause based on visibility permissions
    let whereClause: {
      operatorId?: string;
      debtorId?: string;
      tenantId: string;
    } = { tenantId };

    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // No additional filtering
    } else if (canViewOwnCases) {
      whereClause = { ...whereClause, operatorId: user.id };
    } else if (canViewAsClient) {
      const userDebtor = await prisma.debtor.findFirst({
        where: { email: user.email, tenantId },
        select: { id: true },
      });
      if (userDebtor) {
        whereClause = { ...whereClause, debtorId: userDebtor.id };
      } else {
        const emptyStats = dashboardStatsSchema.parse({
          totalCases: 0,
          casesThisMonth: 0,
          upcomingHearings: 0,
          totalDebt: null,
          totalCreditors: null,
          casesByPhase: [],
          casesByType: [],
          casesOverTime: [],
          overduePayments: 0,
        });
        return { success: true, data: emptyStats };
      }
    } else {
      const emptyStats = dashboardStatsSchema.parse({
        totalCases: 0,
        casesThisMonth: 0,
        upcomingHearings: 0,
        totalDebt: null,
        totalCreditors: null,
        casesByPhase: [],
        casesByType: [],
        casesOverTime: [],
        overduePayments: 0,
      });
      return { success: true, data: emptyStats };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalCases,
      casesThisMonth,
      upcomingHearings,
      totalDebtResult,
      totalCreditorsResult,
      casesByPhaseRaw,
      casesByTypeRaw,
      casesLast6Months,
      overduePayments,
    ] = await Promise.all([
      prisma.case.count({ where: whereClause }),
      prisma.case.count({
        where: { ...whereClause, createdDate: { gte: startOfMonth } },
      }),
      prisma.case.count({
        where: {
          ...whereClause,
          OR: [
            { hearingDate: { gte: now, lte: in7Days } },
            { firstHearingDate: { gte: now, lte: in7Days } },
          ],
        },
      }),
      prisma.case.aggregate({
        where: whereClause,
        _sum: { totalDebt: true },
      }),
      prisma.case.aggregate({
        where: whereClause,
        _sum: { creditors: true },
      }),
      prisma.case.groupBy({
        by: ['phase'],
        where: whereClause,
        _count: { id: true },
      }),
      prisma.case.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { id: true },
      }),
      prisma.case.findMany({
        where: { ...whereClause, createdDate: { gte: sixMonthsAgo } },
        select: { createdDate: true },
      }),
      prisma.payment.count({
        where: {
          tenantId,
          status: 'pendiente',
          dueDate: { lt: now },
        },
      }),
    ]);

    // Aggregate cases by month for the last 6 months
    const monthCounts: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[key] = 0;
    }
    for (const c of casesLast6Months) {
      const d = new Date(c.createdDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthCounts) monthCounts[key]++;
    }

    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const casesOverTime = Object.entries(monthCounts).map(([key, count]) => {
      const [, m] = key.split('-');
      return { month: monthNames[parseInt(m, 10) - 1], count };
    });

    const typeMap: Record<string, string> = {
      INSOLVENCY: 'Insolvencia',
      CONCILIATION: 'Conciliación',
      SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
    };

    const result = dashboardStatsSchema.parse({
      totalCases,
      casesThisMonth,
      upcomingHearings,
      totalDebt: totalDebtResult._sum.totalDebt,
      totalCreditors: totalCreditorsResult._sum.creditors,
      casesByPhase: casesByPhaseRaw.map((g) => ({
        phase: g.phase ?? 'Inicial',
        count: g._count.id,
      })),
      casesByType: casesByTypeRaw.map((g) => ({
        type: typeMap[g.type] ?? g.type,
        count: g._count.id,
      })),
      casesOverTime,
      overduePayments,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener estadísticas del dashboard',
    };
  }
}

// ---------------------------------------------------------------------------
// updateCasePhase — change case phase with validation
// ---------------------------------------------------------------------------

const updateCasePhaseSchema = z.object({
  caseId: z.string().min(1),
  newPhase: z.string().min(1),
  subtype: z.string().min(1).optional(),
  resultDate: z.coerce.date().optional(),
});

/**
 * Fracaso valida contra `getFailureTypes()` (templates-config.ts, ya la
 * fuente de verdad de sus 13 subtipos); Desistimiento contra
 * `isValidDesistimientoSubtype` (case-phases.ts, sin campos propios en el
 * módulo de documentos). Devuelve false para cualquier otra fase.
 */
function isValidSubtypeForPhase(phase: string, subtype: string): boolean {
  if (phase === 'Fracaso') return isValidFailureType(subtype);
  if (phase === 'Desistimiento') return isValidDesistimientoSubtype(subtype);
  return false;
}

export async function updateCasePhase(input: {
  caseId: string;
  newPhase: string;
  subtype?: string;
  resultDate?: string | Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const { caseId, newPhase, subtype, resultDate } =
      updateCasePhaseSchema.parse(input);

    const existingCase = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: { id: true, phase: true, caseNumber: true, debtorName: true },
    });

    if (!existingCase) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const currentPhase = existingCase.phase ?? INITIAL_CASE_PHASE;
    const check = validatePhaseTransition(currentPhase, newPhase);

    if (!check.valid) {
      return { success: false, error: check.reason };
    }

    // Reescribir la misma fase no es una transición: no hay nada que auditar
    // ni documentación que regenerar.
    if (check.isNoop) {
      return { success: true };
    }

    // Fracaso y Desistimiento exigen subtipo + fecha para generar el
    // documento correcto (docs/DISENO_FASES_NUEVAS_2026-09-11.md §4). El
    // frontend ya deshabilita el botón de confirmar sin estos datos, pero
    // esa es solo UX — esta es la fuente de verdad real, mismo principio
    // que validatePhaseTransition para la fase en sí.
    if (phaseRequiresSubtype(newPhase)) {
      if (!subtype) {
        return {
          success: false,
          error: `El subtipo es obligatorio para pasar a "${newPhase}"`,
        };
      }
      if (!resultDate) {
        return {
          success: false,
          error: `La fecha es obligatoria para pasar a "${newPhase}"`,
        };
      }
      if (!isValidSubtypeForPhase(newPhase, subtype)) {
        return {
          success: false,
          error: `Subtipo desconocido para "${newPhase}": "${subtype}"`,
        };
      }
    }

    const phaseUpdateData =
      newPhase === 'Fracaso'
        ? { phase: newPhase, failureType: subtype, failureDate: resultDate }
        : newPhase === 'Desistimiento'
          ? { phase: newPhase, resultType: subtype, resultDate: resultDate }
          : { phase: newPhase };

    await prisma.case.update({
      where: { id: caseId, tenantId },
      data: phaseUpdateData,
    });

    revalidateTag('cases');

    // Fire-and-forget audit log
    createAuditLog({
      action: 'updated',
      entityType: 'case',
      entityId: caseId,
      entityName: `${existingCase.caseNumber} - ${existingCase.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        field: 'phase',
        previousPhase: currentPhase,
        newPhase,
      },
    });

    // Fire-and-forget notification
    createNotificationForAction(
      'case_updated',
      `${existingCase.caseNumber} - ${existingCase.debtorName}`,
      prisma,
      tenantId,
      caseId,
      caseId,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    // ---------------------------------------------------------------
    // Phase-specific side effects: documentos por cambio de fase.
    //
    // Antes: fire-and-forget sin lock ni after() — en Vercel podía cortarse
    // al devolver la respuesta, y Fracaso nunca generaba nada porque
    // 'general' no está en failureTypeMap. Con el subtipo ahora obligatorio
    // (arriba) ese bug queda resuelto de raíz: `subtype` siempre viene
    // validado cuando newPhase es Fracaso. Usa el mismo runWithGenerationLock
    // que la generación manual: se espera el resultado, protegido por el
    // lock anti-duplicados (P3).
    // ---------------------------------------------------------------
    const PHASES_WITH_DOCUMENTS = ['Admisión', 'Acuerdo aprobado', 'Fracaso'];
    if (PHASES_WITH_DOCUMENTS.includes(newPhase)) {
      const fullCase = await fetchCaseForGeneration(caseId, tenantId);

      if (fullCase?.driveFolderId) {
        const caseForDocs = asCaseWithRelations(fullCase);
        const folderId = fullCase.driveFolderId;
        const kind: GenerationKind =
          newPhase === 'Admisión'
            ? 'ADMISSION'
            : newPhase === 'Acuerdo aprobado'
              ? 'AGREEMENT'
              : 'FAILURE';

        try {
          const lock = await runWithGenerationLock(
            { tenantId, caseId, kind, userId: user.id },
            async () => {
              const documents =
                newPhase === 'Admisión'
                  ? await generateDocumentsForAdmission(caseForDocs, folderId)
                  : newPhase === 'Acuerdo aprobado'
                    ? await generateDocumentsForAgreement(caseForDocs, folderId)
                    : await generateDocumentsForFailure(
                        caseForDocs,
                        folderId,
                        subtype ?? fullCase.failureType ?? 'general',
                      );
              await persistGeneratedDocuments(documents, caseId, tenantId);
              return documents;
            },
          );

          if (!lock.ok) {
            logger.warn('Generación por cambio de fase ya en curso', {
              action: 'update-case-phase',
              caseId,
              newPhase,
              requestId: lock.requestId,
            });
          } else {
            logger.info('Documentos generados por cambio de fase', {
              action: 'update-case-phase',
              caseId,
              newPhase,
              requestId: lock.requestId,
              documentCount: lock.documents.length,
            });
          }
        } catch (error) {
          // El cambio de fase ya se persistió arriba; un fallo de Drive/PDF
          // no debe revertirlo — se loguea y queda disponible el reintento
          // manual desde /documents.
          logger.error('Generación por cambio de fase falló', error, {
            action: 'update-case-phase',
            caseId,
            newPhase,
          });
        }
      }
    }

    // Auto-generate payment schedule when entering Post-acuerdo
    if (newPhase === 'Post-acuerdo') {
      generatePaymentSchedule(caseId)
        .then((result) => {
          if (result.success) {
            console.log(
              `[Phase → Post-acuerdo] Payment schedule generated for case ${existingCase.caseNumber}`,
            );
          }
        })
        .catch((err) => {
          console.error(
            `[Phase → Post-acuerdo] Error generating payment schedule for case ${existingCase.caseNumber}:`,
            err,
          );
        });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating case phase:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al actualizar la fase del caso',
    };
  }
}
