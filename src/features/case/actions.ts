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
// Las fechas del formulario llegan como "YYYY-MM-DD" (<input type="date">), que
// `new Date()` ancla a medianoche UTC y por tanto se imprimen un día antes en
// hora de Colombia. `parseDateOnly` las ancla al mediodía UTC.
import { parseDateOnly } from '@/lib/date-colombia';
import { parseTasaInteres, parseFechaCredito } from './datos-desconocidos';
import { filasApoderadoDesdeFormulario } from './apoderado-acreedor';
// GC-A1: el permiso (`EDITAR_CASOS`) dice QUÉ puede hacer el rol; esto dice
// SOBRE CUÁL expediente. Antes solo se filtraba por `tenantId`, así que un rol
// con `Ver casos propios` podía mutar cualquier expediente del centro pasando
// el id directo a la action.
import {
  assertCaseAccess,
  assertCaseAccessOnRow,
  assertOperatorInTenant,
  findParentCaseId,
} from './case-access';
// GC-M4: el audit log de `updateCase` decia solo "Se ha actualizado el caso X".
// Esto calcula QUE cambio, comparando el payload contra lo que hay en la base.
import {
  COLUMNAS_CASE,
  selectDeCamposEnviados,
  resumirCambios,
  valoresAuditables,
} from './audit-diff';
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
import { parsearMonto } from './monto';
import {
  requiresOtherDetail,
  tipoProcesoLabel,
} from '@/features/case/proceso-judicial-tipos';
import {
  buildApoderadosCreate,
  mirrorPrincipalApoderado,
  cleanText,
} from './apoderados';

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
  addApoderadoToCaseSchema,
  removeApoderadoFromCaseSchema,
  caseWithRelationsSchema,
  caseSummarySchema,
  debtResponseSchema,
  libranzaResponseSchema,
  suspendedServiceResponseSchema,
  assetResponseSchema,
  dependentResponseSchema,
  apoderadoResponseSchema,
  getAllCasesSchema,
  CASE_LIST_COLUMNS,
  getCaseByIdSchema,
  deleteCaseSchema,
  caseStatsSchema,
  dashboardStatsSchema,
  type AssetData,
  type LibranzaData,
  type SuspendedServiceData,
  type DependentData,
  type LegalProcessData,
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
  'serviciosManutencion',
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

    // GC-M2 — el operador se escribia con un `connect` a secas, y el `connect`
    // de Prisma solo exige que el id exista: bastaba mandar el id de un usuario
    // del OTRO centro para dejarle un expediente asignado. El deudor si se
    // validaba (mas abajo); el operador no.
    await assertOperatorInTenant(validatedInput.operatorId, tenantId);

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
      // Tres columnas DateTime que se quedaron fuera de esta lista: viajaban con
      // el resto del payload como el string "YYYY-MM-DD" del <input type="date">
      // y Prisma las rechazaba ("premature end of input. Expected ISO-8601
      // DateTime"), asi que llenar cualquiera de las tres hacia fallar la
      // creacion entera.
      //
      // OJO: no escribir aqui el literal del spread. El test de guardia
      // case-input-contract.test.ts delimita este bloque buscando su primera
      // aparicion en el archivo, y un comentario que lo mencione lo trunca.
      paymentStartDate,
      agreementValidityDate,
      failureDate,
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

    // Una sola transaccion para el caso y sus deudas.
    //
    // Antes el caso se creaba solo y las deudas en un bucle posterior, fuera de
    // cualquier transaccion: si una deuda fallaba -y con la casilla
    // "Desconozco" fallaban todas-, el operador veia el error y en la base
    // quedaba un expediente con el numero de radicado ya consumido y cero
    // acreedores. Reintentar creaba otro.
    //
    // timeout generoso a proposito: el tope legal son 150 acreedores y cada uno
    // puede implicar buscar o crear su Creditor, asi que los 5 s por defecto de
    // Prisma se quedan cortos en los expedientes grandes.
    const newCase = await prisma.$transaction(
      async (tx) => {
        const created = await tx.case.create({
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
            hearingDate: parseDateOnly(hearingDate),
            filingDate: parseDateOnly(filingDate),
            designationDate: parseDateOnly(designationDate),
            positionAcceptanceDate: parseDateOnly(positionAcceptanceDate),
            inadmissionDate: parseDateOnly(inadmissionDate),
            admissionDate: parseDateOnly(admissionDate),
            firstHearingDate: parseDateOnly(firstHearingDate),
            suspensionDate: parseDateOnly(suspensionDate),
            resultDeliveryDate: parseDateOnly(resultDeliveryDate),
            resultDate: parseDateOnly(resultDate),
            paymentStartDate: parseDateOnly(paymentStartDate),
            agreementValidityDate: parseDateOnly(agreementValidityDate),
            failureDate: parseDateOnly(failureDate),
            monthlyPaymentAmount: monthlyPaymentAmount ?? null,
            variablePayment: variablePayment ?? null,
            capitalReductionPercent: capitalReductionPercent ?? null,
            // Formulario definitivo date conversions
            fechaCesacionPagos: parseDateOnly(fechaCesacionPagos),
            propuestaFechaInicioPago: parseDateOnly(propuestaFechaInicioPago),
            fechaRadicacion: parseDateOnly(fechaRadicacion),
            // Note: debts, assets, and other relations are created separately after case creation
            assets:
              assets && assets.length > 0
                ? {
                    create: assets.map((asset: AssetData) => ({
                      name: asset.name,
                      type: asset.type,
                      value: parsearMonto(asset.value) ?? 0,
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
                      hasPendingFinesOrTaxes: asset.hasPendingFinesOrTaxes,
                      // Vehicle specific
                      brand: asset.brand,
                      model: asset.model,
                      condition: asset.condition,
                      licensePlate: asset.licensePlate,
                      transitAuthority: asset.transitAuthority,
                      guaranteeInFavorOf: asset.guaranteeInFavorOf,
                      guaranteeAmount: asset.guaranteeAmount
                        ? (parsearMonto(asset.guaranteeAmount) ?? null)
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
                      deductedAmount: parsearMonto(libranza.deductedAmount) ?? 0,
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
                        amountOwed: parsearMonto(service.amountOwed) ?? 0,
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
                      // La descripción es el resumen que se muestra en listados: en
                      // "Otros" el valor crudo no dice nada, así que se usa el texto
                      // que escribió el usuario.
                      description: `${tipoProcesoLabel(
                        process.processType,
                        process.processTypeOther,
                      )} - ${process.plaintiff}`,
                      processType: process.processType,
                      processTypeOther: requiresOtherDetail(process.processType)
                        ? process.processTypeOther
                        : null,
                      plaintiff: process.plaintiff,
                      court: process.court,
                      courtEmail: process.courtEmail || null,
                      fileNumber: process.fileNumber,
                      precautionaryMeasure: process.precautionaryMeasure,
                      tenantId,
                    })),
                  }
                : undefined,
            // Apoderados (Sección XI): lista completa en la tabla nueva + espejo del
            // principal en las 8 columnas escalares (solo si vienen vacías).
            apoderados: buildApoderadosCreate(apoderados, tenantId),
            ...mirrorPrincipalApoderado(apoderados, rest),
          },
        });

        // Las deudas van en el mismo `tx`: o entra el expediente completo o no
        // entra nada.
        if (debts && debts.length > 0) {
          for (const debt of debts) {
            // Find or create creditor by name
            let creditorId = debt.creditorId;

            if (!creditorId || creditorId === 'PENDING') {
              const creditorName = debt.creditor || 'Acreedor sin nombre';

              // Try to find existing creditor by name
              let existingCreditor = await tx.creditor.findFirst({
                where: {
                  name: creditorName,
                  tenantId,
                },
                select: { id: true },
              });

              // If not found, create new creditor with required fields
              if (!existingCreditor) {
                const autoNit = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                existingCreditor = await tx.creditor.create({
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

            // Las casillas "Desconozco" guardan la bandera, no un NaN ni un
            // Invalid Date (ver features/case/datos-desconocidos.ts).
            const tasa = parseTasaInteres(debt.interestRate);
            const otorgamiento = parseFechaCredito(
              debt.grantDate,
              parseDateOnly,
            );
            const vencimiento = parseFechaCredito(debt.dueDate, parseDateOnly);

            await tx.debt.create({
              data: {
                // `amount` tambien es Decimal y tambien venia del formulario
                // como string: el sub-schema de deuda transporta
                // `capitalAmount`/`amount` como `z.string()`, no como monto.
                // Sin parsear, Prisma recibe "30.000.000" y lo rechaza
                // ("invalid digit found in string"). Lo encontro el test de
                // base, no el de unidad: es el unico que llega hasta Prisma.
                amount: parsearMonto(debt.capitalAmount ?? debt.amount) ?? 0,
                interestRate: tasa.interestRate,
                interestRateUnknown: tasa.interestRateUnknown,
                type: debt.type || 'CREDIT',
                creditorId,
                caseId: created.id,
                tenantId,
                // Detailed creditor info
                creditorAddress: debt.creditorAddress,
                creditorCity: debt.creditorCity,
                creditorEmail: debt.creditorEmail,
                capitalAmount: debt.capitalAmount
                  ? (parsearMonto(debt.capitalAmount) ?? null)
                  : null,
                interestAmount: debt.interestAmount
                  ? (parsearMonto(debt.interestAmount) ?? null)
                  : null,
                isDeferred: debt.isDeferred ?? false,
                documentType: debt.documentType,
                grantDate: otorgamiento.value,
                grantDateUnknown: otorgamiento.unknown,
                dueDate: vencimiento.value,
                dueDateUnknown: vencimiento.unknown,
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
                coDebtorPhone: debt.coDebtorPhone,
                coDebtorEmail: debt.coDebtorEmail,
                // Apoderado del acreedor: una fila por fuente cargada, ninguna
                // si no cargaron ninguna (que es el caso normal). El helper
                // solo traduce; comparar las dos fuentes y bloquear la
                // generación ante discrepancia es el PR 3 del plan.
                apoderadosAcreedor: {
                  create: filasApoderadoDesdeFormulario(debt, tenantId),
                },
              },
            });
          }
        }

        return created;
      },
      { timeout: 30_000 },
    );

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

    await createAuditLog({
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

    // GC-A1 — visibilidad por fila antes de tocar nada. Va aquí y no dentro de
    // la transacción a propósito: un acceso denegado no debe abrir transacción.
    await assertCaseAccess({
      caseId: validatedInput.id,
      user,
      tenantId,
    });

    // GC-M2 — solo cuando el payload lo trae: `operatorId` es opcional en la
    // edición y `pre-generation-form` manda ediciones sin él.
    if (validatedInput.operatorId) {
      await assertOperatorInTenant(validatedInput.operatorId, tenantId);
    }

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
      // Mismas tres columnas DateTime que en createCase. `agreementValidityDate`
      // es la que manda pre-generation-form.tsx para el Paquete 3.
      paymentStartDate,
      agreementValidityDate,
      failureDate,
      // Debtor fields (not Case fields)
      monthlyIncome,
      monthlyExpenses,
      otherIncomeDescription,
      otherIncomeAmount,
      hasEmployerCertification,
      ...rest
    } = validatedInput;

    const safeRestUpdate = sanitizeJsonFields(rest);

    // GC-M4 — las fechas se destructuran fuera de `rest`, así que no están en
    // `safeRestUpdate`. Para poder diffearlas hay que volverlas a parsear con
    // el mismo `parseDateOnly` que usa el `update` de abajo: es una función
    // pura, llamarla dos veces no tiene efecto.
    const fechasEnviadas: Record<string, Date | undefined> = {
      hearingDate: parseDateOnly(hearingDate) ?? undefined,
      filingDate: parseDateOnly(filingDate) ?? undefined,
      designationDate: parseDateOnly(designationDate) ?? undefined,
      positionAcceptanceDate: parseDateOnly(positionAcceptanceDate) ?? undefined,
      inadmissionDate: parseDateOnly(inadmissionDate) ?? undefined,
      admissionDate: parseDateOnly(admissionDate) ?? undefined,
      firstHearingDate: parseDateOnly(firstHearingDate) ?? undefined,
      suspensionDate: parseDateOnly(suspensionDate) ?? undefined,
      resultDeliveryDate: parseDateOnly(resultDeliveryDate) ?? undefined,
      resultDate: parseDateOnly(resultDate) ?? undefined,
      paymentStartDate: parseDateOnly(paymentStartDate) ?? undefined,
      agreementValidityDate: parseDateOnly(agreementValidityDate) ?? undefined,
      failureDate: parseDateOnly(failureDate) ?? undefined,
    };

    /** Exactamente lo que esta edición escribe en `Case`. */
    const camposEnviados: Record<string, unknown> = {
      ...safeRestUpdate,
      ...Object.fromEntries(
        Object.entries(fechasEnviadas).filter(([, v]) => v !== undefined),
      ),
    };

    // Solo las columnas que el payload trae, no las 265 del modelo.
    const selectDeCambios = selectDeCamposEnviados(
      camposEnviados,
      COLUMNAS_CASE,
    );

    // Wrap debtor + case update in a transaction with optimistic locking
    const { updatedCase, antes } = await prisma.$transaction(async (tx) => {
      // Se lee siempre (no solo cuando llega `version`): la fase persistida es
      // el punto de partida obligatorio del guard de transición (C-1).
      // Se añaden las columnas del diff de GC-M4 al select que ya existía, en
      // la misma consulta.
      const current = await tx.case.findUnique({
        where: { id, tenantId },
        select: { version: true, phase: true, ...selectDeCambios },
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

      const actualizado = await tx.case.update({
        where: { id, tenantId },
        data: {
          ...safeRestUpdate,
          version: { increment: 1 },
          // Condicional: el schema declara los dos ids como opcionales, pero el
          // `connect` era incondicional, asi que CUALQUIER updateCase que no los
          // reenviara fallaba. Es lo que hace pre-generation-form.tsx -manda
          // solo {id} mas los campos del paquete-, de modo que el formulario de
          // "Datos requeridos para Admision" no funcionaba nunca.
          ...(debtorId ? { debtor: { connect: { id: debtorId } } } : {}),
          ...(operatorId ? { operator: { connect: { id: operatorId } } } : {}),
          hearingDate: parseDateOnly(hearingDate) ?? undefined,
          filingDate: parseDateOnly(filingDate) ?? undefined,
          designationDate: parseDateOnly(designationDate) ?? undefined,
          positionAcceptanceDate:
            parseDateOnly(positionAcceptanceDate) ?? undefined,
          inadmissionDate: parseDateOnly(inadmissionDate) ?? undefined,
          admissionDate: parseDateOnly(admissionDate) ?? undefined,
          firstHearingDate: parseDateOnly(firstHearingDate) ?? undefined,
          suspensionDate: parseDateOnly(suspensionDate) ?? undefined,
          resultDeliveryDate: parseDateOnly(resultDeliveryDate) ?? undefined,
          resultDate: parseDateOnly(resultDate) ?? undefined,
          paymentStartDate: parseDateOnly(paymentStartDate) ?? undefined,
          agreementValidityDate:
            parseDateOnly(agreementValidityDate) ?? undefined,
          failureDate: parseDateOnly(failureDate) ?? undefined,
        },
      });

      // GC-M4: `current` es el "antes" del diff; se devuelve junto con la fila
      // actualizada porque el audit log se escribe fuera de la transacción.
      return { updatedCase: actualizado, antes: current };
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

    // GC-M4 — el registro deja constancia de QUÉ cambió, no solo de que hubo
    // una edición. Los NOMBRES de todos los campos cambiados; los VALORES solo
    // de los que no son datos personales (ver `CAMPOS_CON_VALOR_AUDITABLE`).
    const cambios = resumirCambios(antes, camposEnviados);
    const camposCambiados = cambios.changedFields
      ? cambios.changedFields.split(', ')
      : [];

    await createAuditLog({
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
      metadata: {
        ...cambios,
        ...valoresAuditables(antes, camposEnviados, camposCambiados),
      },
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
    const {
      caseId,
      creditorId,
      amount,
      type,
      interestRate,
      creditorAddress,
      creditorCity,
      creditorEmail,
      capitalAmount,
      interestAmount,
      isDeferred,
      documentType,
      grantDate,
      dueDate,
      creditClassification,
      hasActiveLibranza,
      creditorClass,
      percentageOfTotal,
      daysOverdue,
      coDebtorName,
      coDebtorCity,
      coDebtorAddress,
      coDebtorPhone,
      coDebtorEmail,
    } = validatedInput;

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant), añade la
    // visibilidad por fila y devuelve el `debtorId` que la deuda necesita, así
    // que son dos comprobaciones en una sola consulta.
    const caseData = await assertCaseAccess({ caseId, user, tenantId });

    // Mismo tratamiento que en la creacion del caso: la UI de edicion todavia
    // no ofrece las casillas "Desconozco", pero la action acepta el literal y
    // reventaria igual.
    const tasaAgregada = parseTasaInteres(interestRate);
    const otorgamientoAgregado = parseFechaCredito(grantDate, parseDateOnly);
    const vencimientoAgregado = parseFechaCredito(dueDate, parseDateOnly);

    const debt = await prisma.debt.create({
      data: {
        amount: parsearMonto(amount) ?? 0,
        interestRate: tasaAgregada.interestRate,
        interestRateUnknown: tasaAgregada.interestRateUnknown,
        type,
        caseId,
        creditorId,
        debtorId: caseData.debtorId,
        tenantId,
        creditorAddress: cleanText(creditorAddress),
        creditorCity: cleanText(creditorCity),
        creditorEmail: cleanText(creditorEmail),
        capitalAmount: capitalAmount ? (parsearMonto(capitalAmount) ?? null) : null,
        interestAmount: interestAmount ? (parsearMonto(interestAmount) ?? null) : null,
        isDeferred: isDeferred ?? false,
        documentType: cleanText(documentType),
        grantDate: otorgamientoAgregado.value,
        grantDateUnknown: otorgamientoAgregado.unknown,
        dueDate: vencimientoAgregado.value,
        dueDateUnknown: vencimientoAgregado.unknown,
        creditClassification: cleanText(creditClassification),
        hasActiveLibranza: hasActiveLibranza ?? false,
        creditorClass: cleanText(creditorClass),
        percentageOfTotal: percentageOfTotal
          ? parseFloat(percentageOfTotal)
          : null,
        daysOverdue: daysOverdue ?? null,
        coDebtorName: cleanText(coDebtorName),
        coDebtorCity: cleanText(coDebtorCity),
        coDebtorAddress: cleanText(coDebtorAddress),
        coDebtorPhone: cleanText(coDebtorPhone),
        coDebtorEmail: cleanText(coDebtorEmail),
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
      creditorAddress: debt.creditorAddress,
      creditorCity: debt.creditorCity,
      creditorEmail: debt.creditorEmail,
      capitalAmount: debt.capitalAmount,
      interestAmount: debt.interestAmount,
      isDeferred: debt.isDeferred,
      documentType: debt.documentType,
      grantDate: debt.grantDate
        ? debt.grantDate.toISOString().split('T')[0]
        : null,
      dueDate: debt.dueDate ? debt.dueDate.toISOString().split('T')[0] : null,
      creditClassification: debt.creditClassification,
      hasActiveLibranza: debt.hasActiveLibranza,
      creditorClass: debt.creditorClass,
      percentageOfTotal: debt.percentageOfTotal,
      daysOverdue: debt.daysOverdue,
      coDebtorName: debt.coDebtorName,
      coDebtorCity: debt.coDebtorCity,
      coDebtorAddress: debt.coDebtorAddress,
      coDebtorPhone: debt.coDebtorPhone,
      coDebtorEmail: debt.coDebtorEmail,
    });

    await createAuditLog({
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

    // GC-A1 — esta action recibe un `debtId`, no un `caseId`, así que primero
    // hay que subir al expediente padre. Sin esto el único filtro era
    // `tenantId`: cualquier rol con `EDITAR_CASOS` podía borrar la deuda de un
    // expediente que no le corresponde.
    const parentCaseId = await findParentCaseId('debt', debtId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Deuda no encontrada' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

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
      creditorAddress: deletedDebt.creditorAddress,
      creditorCity: deletedDebt.creditorCity,
      creditorEmail: deletedDebt.creditorEmail,
      capitalAmount: deletedDebt.capitalAmount,
      interestAmount: deletedDebt.interestAmount,
      isDeferred: deletedDebt.isDeferred,
      documentType: deletedDebt.documentType,
      grantDate: deletedDebt.grantDate
        ? deletedDebt.grantDate.toISOString().split('T')[0]
        : null,
      dueDate: deletedDebt.dueDate
        ? deletedDebt.dueDate.toISOString().split('T')[0]
        : null,
      creditClassification: deletedDebt.creditClassification,
      hasActiveLibranza: deletedDebt.hasActiveLibranza,
      creditorClass: deletedDebt.creditorClass,
      percentageOfTotal: deletedDebt.percentageOfTotal,
      daysOverdue: deletedDebt.daysOverdue,
      coDebtorName: deletedDebt.coDebtorName,
      coDebtorCity: deletedDebt.coDebtorCity,
      coDebtorAddress: deletedDebt.coDebtorAddress,
      coDebtorPhone: deletedDebt.coDebtorPhone,
      coDebtorEmail: deletedDebt.coDebtorEmail,
    });

    await createAuditLog({
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

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant) y añade la
    // visibilidad por fila, en la misma consulta.
    await assertCaseAccess({ caseId, user, tenantId });

    const libranza = await prisma.libranza.create({
      data: {
        payerName,
        payerAddress: payerAddress || null,
        payerEmail: payerEmail || null,
        payerPhone: payerPhone || null,
        deductedAmount: parsearMonto(deductedAmount) ?? 0,
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

    await createAuditLog({
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

    // GC-A1 — la action recibe el id de la fila hija, no el del expediente:
    // hay que subir al padre antes de decidir el acceso.
    const parentCaseId = await findParentCaseId('libranza', libranzaId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Libranza no encontrada' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

    const deletedLibranza = await prisma.libranza.delete({
      where: {
        id: libranzaId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant) y añade la
    // visibilidad por fila, en la misma consulta.
    await assertCaseAccess({ caseId, user, tenantId });

    const suspendedService = await prisma.suspendedService.create({
      data: {
        creditorName,
        address: address || null,
        email: email || null,
        phone: phone || null,
        amountOwed: parsearMonto(amountOwed) ?? 0,
        suspendedProduct: serviceType || null,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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

    // GC-A1 — la action recibe el id de la fila hija, no el del expediente:
    // hay que subir al padre antes de decidir el acceso.
    const parentCaseId = await findParentCaseId('suspendedService', suspendedServiceId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Servicio suspendido no encontrado' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

    const deletedService = await prisma.suspendedService.delete({
      where: {
        id: suspendedServiceId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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
      hasPendingFinesOrTaxes,
      brand,
      model,
      condition,
      licensePlate,
      transitAuthority,
      guaranteeInFavorOf,
      guaranteeAmount,
      material,
    } = validatedInput;

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant) y añade la
    // visibilidad por fila, en la misma consulta.
    await assertCaseAccess({ caseId, user, tenantId });

    const asset = await prisma.asset.create({
      data: {
        name,
        type,
        value: parsearMonto(value) ?? 0,
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
        hasPendingFinesOrTaxes: hasPendingFinesOrTaxes ?? undefined,
        brand: brand || null,
        model: model || null,
        condition: condition || null,
        licensePlate: licensePlate || null,
        transitAuthority: transitAuthority || null,
        guaranteeInFavorOf: guaranteeInFavorOf || null,
        guaranteeAmount: guaranteeAmount
          ? (parsearMonto(guaranteeAmount) ?? null)
          : null,
        material: material || null,
        caseId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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
      hasPendingFinesOrTaxes: asset.hasPendingFinesOrTaxes,
      brand: asset.brand,
      model: asset.model,
      condition: asset.condition,
      licensePlate: asset.licensePlate,
      transitAuthority: asset.transitAuthority,
      guaranteeInFavorOf: asset.guaranteeInFavorOf,
      guaranteeAmount: asset.guaranteeAmount?.toString(),
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

    // GC-A1 — la action recibe el id de la fila hija, no el del expediente:
    // hay que subir al padre antes de decidir el acceso.
    const parentCaseId = await findParentCaseId('asset', assetId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Bien no encontrado' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

    const deletedAsset = await prisma.asset.delete({
      where: {
        id: assetId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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
      hasPendingFinesOrTaxes: deletedAsset.hasPendingFinesOrTaxes,
      brand: deletedAsset.brand,
      model: deletedAsset.model,
      condition: deletedAsset.condition,
      licensePlate: deletedAsset.licensePlate,
      transitAuthority: deletedAsset.transitAuthority,
      guaranteeInFavorOf: deletedAsset.guaranteeInFavorOf,
      guaranteeAmount: deletedAsset.guaranteeAmount?.toString(),
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

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant) y añade la
    // visibilidad por fila, en la misma consulta.
    await assertCaseAccess({ caseId, user, tenantId });

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

    await createAuditLog({
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

    // GC-A1 — la action recibe el id de la fila hija, no el del expediente:
    // hay que subir al padre antes de decidir el acceso.
    const parentCaseId = await findParentCaseId('dependent', dependentId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Dependiente no encontrado' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

    const deletedDependent = await prisma.dependent.delete({
      where: {
        id: dependentId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
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

/**
 * Alta de un apoderado post-creación. Mismo patrón que Debt/Asset/Libranza/
 * SuspendedService/Dependent: no hay edición en el lugar, corregir un
 * apoderado es borrarlo (`removeApoderadoFromCase`) y agregarlo de nuevo.
 *
 * A propósito NO espeja en las 8 columnas escalares `apoderado_*` de `Case`
 * (`mirrorPrincipalApoderado`, usado solo en `createCase`): esas columnas ya
 * son editables directamente desde `general-fields.ts` (PR #102), y mezclar
 * las dos vías acá fabricaría un registro híbrido si alguien las edita por
 * separado a propósito.
 */
export async function addApoderadoToCase(
  input: z.infer<typeof addApoderadoToCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof apoderadoResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = addApoderadoToCaseSchema.parse(input);
    const {
      caseId,
      nombreCompleto,
      tipoIdentificacion,
      identificacion,
      tarjetaProfesional,
      direccion,
      telefono,
      correo,
      existePoderOtorgado,
    } = validatedInput;

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí:
    // comprueba lo mismo (que el caso exista en el tenant) y añade la
    // visibilidad por fila, en la misma consulta.
    await assertCaseAccess({ caseId, user, tenantId });

    // `orden` conserva la posición del formulario (0 = apoderado principal),
    // mismo criterio que `buildApoderadosCreate`. Un hueco si se borró uno de
    // en medio es inofensivo: solo ordena la lista, no es clave única.
    const existingCount = await prisma.apoderado.count({
      where: { caseId, tenantId },
    });

    const apoderado = await prisma.apoderado.create({
      data: {
        caseId,
        tenantId,
        orden: existingCount,
        nombreCompleto,
        tipoIdentificacion: cleanText(tipoIdentificacion),
        identificacion: cleanText(identificacion),
        tarjetaProfesional: cleanText(tarjetaProfesional),
        direccion: cleanText(direccion),
        telefono: cleanText(telefono),
        correo: cleanText(correo),
        existePoderOtorgado: existePoderOtorgado ?? false,
      },
    });

    revalidateTag('cases');

    const result = apoderadoResponseSchema.parse({
      id: apoderado.id,
      orden: apoderado.orden,
      nombreCompleto: apoderado.nombreCompleto,
      tipoIdentificacion: apoderado.tipoIdentificacion,
      identificacion: apoderado.identificacion,
      tarjetaProfesional: apoderado.tarjetaProfesional,
      direccion: apoderado.direccion,
      telefono: apoderado.telefono,
      correo: apoderado.correo,
      existePoderOtorgado: apoderado.existePoderOtorgado,
    });

    await createAuditLog({
      action: 'created',
      entityType: 'case',
      entityId: caseId,
      entityName: 'Apoderado en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'apoderado', subEntityId: result.id },
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error('Error adding apoderado to case', error, {
      action: 'add-apoderado-to-case',
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al agregar apoderado al caso',
    };
  }
}

export async function removeApoderadoFromCase(
  input: z.infer<typeof removeApoderadoFromCaseSchema>,
): Promise<{
  success: boolean;
  data?: z.infer<typeof apoderadoResponseSchema>;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_CASOS)) {
      return { success: false, error: 'No tienes permisos para editar casos' };
    }

    const validatedInput = removeApoderadoFromCaseSchema.parse(input);
    const { apoderadoId } = validatedInput;

    // GC-A1 — la action recibe el id de la fila hija, no el del expediente:
    // hay que subir al padre antes de decidir el acceso.
    const parentCaseId = await findParentCaseId('apoderado', apoderadoId, tenantId);
    if (!parentCaseId) {
      return { success: false, error: 'Apoderado no encontrado' };
    }
    await assertCaseAccess({ caseId: parentCaseId, user, tenantId });

    const deletedApoderado = await prisma.apoderado.delete({
      where: {
        id: apoderadoId,
        tenantId,
      },
    });

    revalidateTag('cases');

    await createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: deletedApoderado.caseId,
      entityName: 'Apoderado en caso',
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { subEntity: 'apoderado', subEntityId: deletedApoderado.id },
    });

    const result = apoderadoResponseSchema.parse({
      id: deletedApoderado.id,
      orden: deletedApoderado.orden,
      nombreCompleto: deletedApoderado.nombreCompleto,
      tipoIdentificacion: deletedApoderado.tipoIdentificacion,
      identificacion: deletedApoderado.identificacion,
      tarjetaProfesional: deletedApoderado.tarjetaProfesional,
      direccion: deletedApoderado.direccion,
      telefono: deletedApoderado.telefono,
      correo: deletedApoderado.correo,
      existePoderOtorgado: deletedApoderado.existePoderOtorgado,
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error('Error removing apoderado from case', error, {
      action: 'remove-apoderado-from-case',
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar apoderado del caso',
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
    const { id, confirmCaseNumber } = validatedInput;

    // GC-A1 — el guard reemplaza al `findUnique` de existencia que había aquí.
    // En un borrado físico e irreversible la visibilidad por fila importa más
    // que en cualquier otra mutación.
    await assertCaseAccess({ caseId: id, user, tenantId });

    // ---------------------------------------------------------------------
    // GC-M6 — mitigación interina mientras no exista el soft-delete.
    //
    // El borrado sigue siendo físico y en cascada (el soft-delete es Fase 3
    // del roadmap, ~20 h, y toca el schema). Lo que se añade acá son las tres
    // cosas que se pueden hacer sin tocar el schema:
    //
    //   1. La confirmación escrita, verificada CONTRA LA BASE (no contra lo
    //      que mandó el cliente): el número tiene que ser el del expediente
    //      que se va a borrar.
    //   2. El audit log ANTES de borrar, con un snapshot de lo que se pierde.
    //   3. El conteo de lo que se va en cascada, para que quede registrado
    //      cuánto se destruyó.
    // ---------------------------------------------------------------------
    const snapshot = await prisma.case.findUnique({
      where: { id, tenantId },
      select: {
        caseNumber: true,
        debtorName: true,
        type: true,
        phase: true,
        driveFolderId: true,
        _count: {
          select: {
            documents: true,
            debts: true,
            assets: true,
            dependents: true,
          },
        },
      },
    });

    if (!snapshot) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // La comparación es contra `snapshot.caseNumber`, el valor de la base.
    // Comparar contra otro campo del mismo payload del cliente no confirmaría
    // nada: el cliente controla los dos lados.
    if (confirmCaseNumber.trim() !== snapshot.caseNumber) {
      return {
        success: false,
        error: `El número del caso no coincide. Escriba exactamente "${snapshot.caseNumber}" para confirmar la eliminación.`,
      };
    }

    // El audit log va ANTES del borrado y se ESPERA. Si se escribiera después
    // y fallara, quedaría un expediente legal destruido sin ningún registro de
    // quién lo hizo; y si se dispara sin `await` (como estaba), el proceso
    // serverless puede terminar antes de que la fila llegue a la base.
    //
    // El snapshot es deliberadamente NO SENSIBLE: número, fase, tipo y
    // conteos. Nada de cédula, ingresos, dependientes ni acreedores — el
    // audit log no es el lugar para conservar los datos personales de un
    // expediente que se está borrando, justamente bajo la Ley 1581.
    const registro = await createAuditLog({
      action: 'deleted',
      entityType: 'case',
      entityId: id,
      entityName: `${snapshot.caseNumber} - ${snapshot.debtorName}`,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: {
        caseNumber: snapshot.caseNumber,
        type: snapshot.type,
        phase: snapshot.phase,
        documentCount: snapshot._count.documents,
        debtCount: snapshot._count.debts,
        assetCount: snapshot._count.assets,
        dependentCount: snapshot._count.dependents,
        // GC-M6 pendiente: la carpeta NO se borra ni se archiva en Drive. Los
        // PDFs con datos personales quedan huérfanos allí. Se registra el id
        // para que una limpieza posterior sepa qué buscar.
        driveFolderId: snapshot.driveFolderId,
        driveFolderDeleted: false,
        confirmedByTypingCaseNumber: true,
      },
    });

    // GC-M4 + GC-M6: si la auditoría no quedó escrita, NO se borra. Es la
    // única mutación donde se toma esta decisión, y es por lo que destruye:
    // un expediente legal eliminado sin registro de quién lo hizo no se puede
    // reconstruir ni explicar. En las demás actions un fallo de auditoría se
    // reporta y la operación sigue (ver el docblock de `createAuditLog`).
    if (!registro.ok) {
      return {
        success: false,
        error:
          'No se pudo registrar la eliminación en la auditoría. El caso NO fue eliminado. Intente de nuevo.',
      };
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

      // 2. Delete the case (Apoderado, Notification, DocumentGenerationRequest, Payment cascade automatically)
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

    // GC-M6: el audit log de este borrado ya quedó escrito ARRIBA, antes de
    // destruir la fila y con el snapshot de lo que se perdía. No se duplica
    // acá: un segundo registro del mismo evento ensucia el histórico.

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
      select: {
        id: true,
        phase: true,
        caseNumber: true,
        debtorName: true,
        // GC-A1: estas dos no las usaba la transición; las pide el guard de
        // visibilidad por fila. Se añaden al `select` que ya existía en vez de
        // hacer una segunda consulta.
        operatorId: true,
        debtorId: true,
      },
    });

    if (!existingCase) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // GC-A1 — un cambio de fase dispara generación documental y queda en la
    // auditoría del expediente: es de las mutaciones que más importa acotar.
    await assertCaseAccessOnRow({ caseRow: existingCase, user, tenantId });

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
    await createAuditLog({
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
