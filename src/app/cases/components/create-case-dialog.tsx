'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, FlaskConical, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeCausas } from '@/features/case/causas-insolvencia';

import { createCase } from '@/features/case/actions';
import { getAllCreditors } from '@/features/creditor/actions';
import { getAllDebtors, createDebtor } from '@/features/debtor/actions';
import { getAssignableOperators } from '@/features/user/actions';
import type { AssignableOperator } from '@/features/user/schemas';
import {
  createCaseFormSchema,
  type CreateCaseFormData,
  type DebtorOption,
} from '@/features/case/schemas';
import {
  validateIncomeExpenses,
  validatePaymentProposal,
  validateDocumentsComplete,
  caseHasAttorney,
  SMMLV_2025,
  type ValidationIssue,
} from '@/features/case/validation-rules';
import {
  EMPLOYER_FIELD,
  LIBRANZAS_FIELD,
  resolvePayerPrefill,
} from '@/features/case/libranza-prefill';

import { AssetsSection } from './create-case-dialog/assets-section';
import {
  CreateDebtorDialog,
  type QuickDebtorFormData,
} from './create-case-dialog/create-debtor-dialog';
import { CreditorsDetailedSection } from './create-case-dialog/creditors-detailed-section';
import { DebtorSection } from './create-case-dialog/debtor-section';
import { DocumentsSection } from './create-case-dialog/documents-section';
import { uploadCaseDocuments } from '@/features/document/actions';
import { CaseDetailsSection } from './create-case-dialog/case-details-section';
import { LegalProcessSection } from './create-case-dialog/legal-process-section';
import { ApplicantScopeSection } from './create-case-dialog/applicant-scope-section';
import { LibranzasSection } from './create-case-dialog/libranzas-section';
import { SuspendedServicesSection } from './create-case-dialog/suspended-services-section';
import { PaymentProposalSection } from './create-case-dialog/payment-proposal-section';
import { LegalFoundationsSection } from './create-case-dialog/legal-foundations-section';
import { NotificationsSection } from './create-case-dialog/notifications-section';
import { SignatureSection } from './create-case-dialog/signature-section';
// Formulario definitivo sections
import { ConyugeDefinitivoSection } from './create-case-dialog/conyuge-definitivo-section';
import { InfoLaboralSection } from './create-case-dialog/info-laboral-section';
import { CesacionPagosSection } from './create-case-dialog/cesacion-pagos-section';
import { DeclaracionesSection } from './create-case-dialog/declaraciones-section';
import { ApoderadoSection } from './create-case-dialog/apoderado-section';
// Conciliation sections
import { ConciliationPartiesSection } from './create-case-dialog/conciliation-parties-section';
import { ConciliationDetailsSection } from './create-case-dialog/conciliation-details-section';
// Support agreement sections
import { SupportAgreementPartiesSection } from './create-case-dialog/support-agreement-parties-section';
import { SupportAgreementDetailsSection } from './create-case-dialog/support-agreement-details-section';
import { parsearMonto } from '@/features/case/monto';

type CaseTypeChoice = 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated?: () => void;
  /** Pre-selects the case type when the dialog opens. Defaults to INSOLVENCY. */
  initialType?: CaseTypeChoice;
}

const INSOLVENCY_TABS = [
  'debtor',
  'situation',
  'creditors',
  'assets',
  'proposal',
  'legal',
  'documents',
] as const;

const CONCILIATION_TABS = ['debtor', 'conc-parties', 'conc-details'] as const;

const SUPPORT_AGREEMENT_TABS = [
  'debtor',
  'apoyo-parties',
  'apoyo-details',
] as const;


const TAB_ORDER = INSOLVENCY_TABS; // backward compat for field mapping

// Mapping of field prefixes to their corresponding tab
const FIELD_TAB_MAP: Record<string, (typeof TAB_ORDER)[number]> = {
  debtorId: 'debtor',
  type: 'debtor',
  causes: 'debtor',
  applicantScope: 'debtor',
  monthlyIncome: 'debtor',
  monthlyExpenses: 'debtor',
  otherIncome: 'debtor',
  hasEmployerCertification: 'debtor',
  operatorId: 'debtor',
  phase: 'debtor',
  caseNumber: 'debtor',
  // Tab 2 – Situación
  conyuge: 'situation',
  sociedad: 'situation',
  deudor: 'situation',
  ingreso: 'situation',
  otrosIngresos: 'situation',
  totalIngresos: 'situation',
  ingresosVariables: 'situation',
  ingresosNo: 'situation',
  gastos: 'situation',
  totalGastos: 'situation',
  capacidadPago: 'situation',
  patrimonio: 'situation',
  pasivo: 'situation',
  cesacionPagos: 'situation',
  fechaCesacion: 'situation',
  numeroAcreedores: 'situation',
  porcentajePasivo: 'situation',
  obligacionesEnMora: 'situation',
  procesosEjecutivos: 'situation',
  legalProcesses: 'situation',
  hasLegalProcesses: 'situation',
  // Tab 3 – Acreedores
  debts: 'creditors',
  totalDebt: 'creditors',
  creditors: 'creditors',
  libranzas: 'creditors',
  suspendedServices: 'creditors',
  dependents: 'creditors',
  // Tab 4 – Bienes
  assets: 'assets',
  // Tab 5 – Propuesta
  gracePeriod: 'proposal',
  paymentInKind: 'proposal',
  assetSale: 'proposal',
  cashFlow: 'proposal',
  paymentTerm: 'proposal',
  monthlyPayment: 'proposal',
  variablePayment: 'proposal',
  extraordinaryPayment: 'proposal',
  capitalReduction: 'proposal',
  insurance: 'proposal',
  forgive: 'proposal',
  paymentOrder: 'proposal',
  hasClass: 'proposal',
  classPrivileges: 'proposal',
  thirdParty: 'proposal',
  guaranteeSubstitution: 'proposal',
  propuesta: 'proposal',
  // Tab 6 – Legal
  declaracion: 'legal',
  manifestacion: 'legal',
  autorizacion: 'legal',
  requestedFee: 'legal',
  legalFoundations: 'legal',
  notification: 'legal',
  applicantSignature: 'legal',
  apoderado: 'legal',
  existePoder: 'legal',
  spouse: 'legal',
  attorney: 'legal',
};

function getTabForField(fieldName: string): (typeof TAB_ORDER)[number] | null {
  // Direct match
  if (fieldName in FIELD_TAB_MAP) return FIELD_TAB_MAP[fieldName];
  // Prefix match (e.g. "debts.0.creditor" → "debts" → creditors)
  for (const prefix of Object.keys(FIELD_TAB_MAP)) {
    if (fieldName.startsWith(prefix)) return FIELD_TAB_MAP[prefix];
  }
  return null;
}

// User-friendly error messages for common validation errors
const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  debtorId: 'Debe seleccionar un deudor',
  type: 'Debe seleccionar el tipo de caso',
  operatorId: 'Debe asignar un operador',
  applicantScope: 'Debe seleccionar el ámbito de aplicación',
  debts: 'Revise la información de acreedores',
  assets: 'Revise la información de bienes',
  totalDebt: 'La deuda total es requerida',
  notificationAddress: 'Dirección de notificación requerida',
  notificationCity: 'Ciudad de notificación requerida',
  notificationEmail: 'Correo de notificación requerido',
  applicantSignatureName: 'Nombre del firmante requerido',
  applicantSignatureId: 'Identificación del firmante requerida',
};

export function CreateCaseDialog({
  open,
  onOpenChange,
  onCaseCreated,
  initialType = 'INSOLVENCY',
}: Readonly<CreateCaseDialogProps>) {
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TAB_ORDER[0]);
  const [debtors, setDebtors] = useState<DebtorOption[]>([]);
  const [operators, setOperators] = useState<AssignableOperator[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorOption | null>(
    null,
  );
  const [showCreateDebtorDialog, setShowCreateDebtorDialog] = useState(false);
  const [creatingDebtor, setCreatingDebtor] = useState(false);
  const documentsToUploadRef = useRef<
    Array<{ docName: string; docKey: string; files: File[] }>
  >([]);
  const [validationWarnings, setValidationWarnings] = useState<
    ValidationIssue[]
  >([]);

  const form = useForm({
    resolver: zodResolver(createCaseFormSchema),
    defaultValues: {
      debtorId: '',
      type: initialType,
      // Conciliation/support-agreement cases don't track a debt amount.
      totalDebt:
        initialType === 'CONCILIATION' || initialType === 'SUPPORT_AGREEMENT'
          ? '0'
          : '',
      creditors: 1,
      operatorId: '',
      causes: [],
      debts: [],
      assets: [],
      legalProcesses: [],
      apoderados: [],
      phase: 'Inicial',
      hearingDate: null,
      caseNumber: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const dialogContentRef = useRef<HTMLDivElement>(null);

  // Dynamic tabs based on case type
  const watchedType = form.watch('type');
  const currentTabs: readonly string[] = useMemo(() => {
    if (watchedType === 'CONCILIATION') return CONCILIATION_TABS;
    if (watchedType === 'SUPPORT_AGREEMENT') return SUPPORT_AGREEMENT_TABS;
    return INSOLVENCY_TABS;
  }, [watchedType]);
  const lastTab = currentTabs[currentTabs.length - 1];

  // Determine which tabs have validation errors
  const formErrors = form.formState.errors;
  const tabsWithErrors = useMemo(() => {
    const errorTabs = new Set<string>();
    const errorKeys = Object.keys(formErrors);
    for (const key of errorKeys) {
      const tab = getTabForField(key);
      if (tab) errorTabs.add(tab);
    }
    return errorTabs;
  }, [formErrors]);

  const goToNextTab = () => {
    const currentIndex = currentTabs.indexOf(activeTab);
    if (currentIndex < currentTabs.length - 1) {
      setActiveTab(currentTabs[currentIndex + 1]);
    }
  };

  // Scroll to top when tab changes
  useEffect(() => {
    dialogContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (open) {
      // First tab is always 'debtor' for any case type — keep INSOLVENCY tab key.
      setActiveTab(TAB_ORDER[0]);
      form.reset({
        debtorId: '',
        type: initialType,
        totalDebt: initialType === 'CONCILIATION' ? '0' : '',
        creditors: 1,
        operatorId: '',
        causes: [],
        debts: [],
        assets: [],
        phase: 'Inicial',
        hearingDate: null,
        caseNumber: '',
        attorney: '',
        hasLegalProcesses: false,
        riskCenterCommunication: false,
        // Applicant scope and income
        applicantScope: [],
        monthlyIncome: 0,
        monthlyExpenses: 0,
        otherIncomeDescription: '',
        otherIncomeAmount: 0,
        hasEmployerCertification: false,
        libranzas: [],
        suspendedServices: [],
        dependents: [],
        legalProcesses: [],
        apoderados: [],
        // Payment proposal
        gracePeriodRequested: false,
        gracePeriodMonths: undefined,
        paymentInKind: false,
        paymentInKindDescription: '',
        assetSaleAuthorized: false,
        assetSaleDescription: '',
        cashFlowPayment: false,
        paymentTermMonths: undefined,
        monthlyPaymentAmount: undefined,
        variablePayment: undefined,
        extraordinaryPayment: false,
        extraordinaryPaymentDate: '',
        capitalReduction: false,
        capitalReductionPercent: undefined,
        insuranceOffering: '',
        forgiveAccruedInterest: false,
        forgiveFutureInterest: false,
        paymentOrder: undefined,
        hasClassPrivileges: false,
        classPrivilegesDescription: '',
        thirdPartyPaymentAuth: false,
        guaranteeSubstitution: false,
        // Spouse (synced from conyuge definitivo)
        spouseName: '',
        spouseIdNumber: '',
        spouseAddress: '',
        spousePhone: '',
        spouseEmail: '',
        // Legal
        requestedFee: '25 SMLMV',
        legalFoundations: '',
        notificationAddress: '',
        notificationCity: '',
        notificationPhone: '',
        notificationEmail: '',
        applicantSignatureName: '',
        applicantSignatureId: '',
        applicantSignature: '',
      });

      const loadData = async () => {
        setDataLoading(true);
        try {
          const [debtorsResult, , operatorsResult] = await Promise.all([
            getAllDebtors(),
            getAllCreditors(),
            getAssignableOperators(),
          ]);

          // No se corta la carga si falla: antes un `return` aca dejaba el
          // dialogo sin deudores ademas de sin usuarios. El selector avisa
          // por su cuenta cuando la lista viene vacia.
          if (operatorsResult.success) {
            setOperators(operatorsResult.data ?? []);
          } else {
            toast.error(
              operatorsResult.error ?? 'Error al cargar los usuarios',
            );
          }
          setDebtors(
            debtorsResult.data?.map((debtor) => ({
              id: debtor.id,
              name: debtor.name,
              idNumber: debtor.idNumber,
              email: debtor.email,
              phone: debtor.phone,
              address: debtor.address,
              city: debtor.city,
              department: debtor.department,
              monthlyIncome: Number(debtor.monthlyIncome),
              monthlyExpenses: Number(debtor.monthlyExpenses ?? 0),
            })) || [],
          );
        } catch {
          toast.error('Error al cargar los datos');
        } finally {
          setDataLoading(false);
        }
      };
      void loadData();
    }
  }, [open, form, initialType]);

  useEffect(() => {
    if (!showCreateDebtorDialog && open) {
      const reloadDebtors = async () => {
        try {
          const debtorsResult = await getAllDebtors();
          setDebtors(
            debtorsResult.data?.map((debtor) => ({
              id: debtor.id,
              name: debtor.name,
              idNumber: debtor.idNumber,
              email: debtor.email,
              phone: debtor.phone,
              address: debtor.address,
              city: debtor.city,
              department: debtor.department,
              monthlyIncome: Number(debtor.monthlyIncome),
              monthlyExpenses: Number(debtor.monthlyExpenses ?? 0),
            })) || [],
          );
        } catch {}
      };
      void reloadDebtors();
    }
  }, [showCreateDebtorDialog, open]);

  useEffect(() => {
    if (selectedDebtorId && debtors.length > 0) {
      const debtor = debtors.find((d) => d.id === selectedDebtorId);
      if (debtor) {
        setSelectedDebtor(debtor);
        form.setValue('debtorId', selectedDebtorId);
      }
    }
  }, [selectedDebtorId, debtors, form]);

  const handleCauseChange = (causa: string) => {
    // Se normaliza la lista entera, no solo la causa tocada: un expediente
    // guardado antes de la unificacion trae etiquetas, y tocar una casilla lo
    // deja con valores canonicos en vez de mezclar las dos formas.
    const actuales = normalizeCausas(form.getValues('causes') ?? []);
    const nuevas = actuales.includes(causa)
      ? actuales.filter((c) => c !== causa)
      : [...actuales, causa];
    form.setValue('causes', nuevas);
  };

  // Validate coherence and set warnings
  const validateCoherence = () => {
    const formData = form.getValues();
    const warnings: ValidationIssue[] = [];

    // Validate income vs expenses
    const incomeWarnings = validateIncomeExpenses(
      typeof formData.monthlyIncome === 'number'
        ? formData.monthlyIncome
        : undefined,
      typeof formData.monthlyExpenses === 'number'
        ? formData.monthlyExpenses
        : undefined,
    );
    warnings.push(...incomeWarnings.filter((w) => w.type === 'warning'));

    // Validate payment proposal
    const proposalWarnings = validatePaymentProposal(formData);
    warnings.push(...proposalWarnings.filter((w) => w.type === 'warning'));

    // Validate mínima cuantía → abogado obligatorio. Misma función que usa
    // el servidor (validateCaseBusinessRules), para que cliente y servidor
    // digan lo mismo — antes esta lógica estaba reimplementada acá, sin el
    // flag explícito que DocumentsSection inyecta.
    const totalDebt =
      parsearMonto(formData.totalDebt) || 0;
    const hasAttorney = caseHasAttorney(formData);
    if (totalDebt > 40 * SMMLV_2025 && !hasAttorney) {
      warnings.push({
        field: 'attorney',
        message: `La deuda total ($${totalDebt.toLocaleString('es-CO')}) supera la mínima cuantía (40 SMMLV). Es obligatorio contar con apoderado judicial.`,
        type: 'warning',
      });
    }

    setValidationWarnings(warnings);
  };

  // Cuántas libranzas había en la pasada anterior de la suscripción. Permite
  // distinguir "se agregó una fila" de "se editó una que ya estaba": el prefill
  // del pagador solo debe actuar en el primer caso (ver abajo).
  const libranzasCountRef = useRef(0);

  // Watch form changes to update warnings + auto-calculate totalDebt and credit fields
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      validateCoherence();

      // Prefill del pagador de libranza con el empleador de la Sección III.
      // La regla (cuándo actuar y sobre qué filas) vive en libranza-prefill.ts;
      // acá solo se aplica. shouldDirty:false → sigue siendo una sugerencia, no
      // un campo derivado: el usuario la sobrescribe y nada se la vuelve a pisar.
      if (name === EMPLOYER_FIELD || name?.startsWith(LIBRANZAS_FIELD)) {
        const { indices, value, nextCount } = resolvePayerPrefill({
          changedField: name,
          employerName: form.getValues(EMPLOYER_FIELD),
          libranzas: form.getValues('libranzas') ?? [],
          previousCount: libranzasCountRef.current,
        });
        libranzasCountRef.current = nextCount;

        for (const index of indices) {
          form.setValue(`libranzas.${index}.payerName`, value, {
            shouldDirty: false,
          });
        }
      }

      // Auto-calculate totalDebt and credit fields when debts change
      if (name?.startsWith('debts') || name === 'debts') {
        const debts = form.getValues('debts') || [];
        let totalCapital = 0;
        let totalInterest = 0;

        debts.forEach((debt: Record<string, unknown>, index: number) => {
          const capital =
            parsearMonto(debt?.capitalAmount) || 0;
          const interest =
            parsearMonto(debt?.interestAmount) || 0;
          totalCapital += capital;
          totalInterest += interest;

          // Auto-classify credit based on debt type
          const debtType = String(debt?.type || '');
          let classification = '';
          let creditorClass = '';
          if (debtType === 'HIPOTECARIA') {
            classification = 'Crédito Garantizado';
            creditorClass = 'Tercera';
          } else if (debtType === 'VEHICULAR') {
            classification = 'Crédito Garantizado';
            creditorClass = 'Tercera';
          } else if (
            debtType === 'TARJETA_CREDITO' ||
            debtType === 'PERSONAL' ||
            debtType === 'OTRA'
          ) {
            classification = 'Crédito Quirografario';
            creditorClass = 'Quinta';
          }
          if (classification && debt?.creditClassification !== classification) {
            form.setValue(
              `debts.${index}.creditClassification`,
              classification,
              { shouldDirty: false },
            );
          }
          if (creditorClass && debt?.creditorClass !== creditorClass) {
            form.setValue(`debts.${index}.creditorClass`, creditorClass, {
              shouldDirty: false,
            });
          }
        });

        // Auto-calculate percentageOfTotal for each debt
        const totalDebt = totalCapital + totalInterest;
        debts.forEach((debt: Record<string, unknown>, index: number) => {
          const capital =
            parsearMonto(debt?.capitalAmount) || 0;
          const interest =
            parsearMonto(debt?.interestAmount) || 0;
          const debtTotal = capital + interest;
          const percentage =
            totalDebt > 0 ? ((debtTotal / totalDebt) * 100).toFixed(2) : '0';
          if (debt?.percentageOfTotal !== percentage) {
            form.setValue(`debts.${index}.percentageOfTotal`, percentage, {
              shouldDirty: false,
            });
          }
        });

        // Update totalDebt
        const currentTotal = form.getValues('totalDebt');
        const newTotal = String(totalDebt);
        if (currentTotal !== newTotal) {
          form.setValue('totalDebt', newTotal, { shouldDirty: false });
        }
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler called when react-hook-form validation FAILS (zodResolver errors)
  const onInvalid = (errors: Record<string, unknown>) => {
    console.error('[CreateCase] Validation errors:', errors);

    // Collect user-friendly error messages
    const errorMessages: string[] = [];
    for (const [key, value] of Object.entries(errors)) {
      const friendly = FRIENDLY_ERROR_MESSAGES[key];
      if (friendly) {
        errorMessages.push(friendly);
      } else {
        const err = value as { message?: string };
        if (err?.message) {
          errorMessages.push(err.message);
        }
      }
    }

    // Navigate to the first tab that has an error
    const errorKeys = Object.keys(errors);
    for (const tabId of TAB_ORDER) {
      const hasError = errorKeys.some((key) => getTabForField(key) === tabId);
      if (hasError) {
        setActiveTab(tabId);
        break;
      }
    }

    if (errorMessages.length > 0) {
      toast.error('Campos incompletos', {
        description: errorMessages.slice(0, 4).join(' • '),
        duration: 8000,
      });
    } else {
      toast.error(
        'Por favor complete todos los campos requeridos antes de crear el caso.',
      );
    }
  };

  const handleSubmit = async (data: CreateCaseFormData) => {
    // Validate required documents before proceeding
    const uploadedDocKeys = documentsToUploadRef.current.map((d) => d.docKey);
    const docValidation = validateDocumentsComplete(uploadedDocKeys, data);
    if (!docValidation.isValid) {
      const missing = docValidation.missingDocuments
        .map((d) => d.name)
        .join(', ');
      toast.error('Documentos obligatorios faltantes', {
        description: missing,
        duration: 8000,
      });
      // Navigate to documents tab
      setActiveTab('documents');
      return;
    }

    // Count creditors from debts array
    const creditorsCount = data.debts?.length ?? 0;

    // --- SYNC: Cónyuge definitivo → legacy spouse fields ---
    const syncedSpouseName =
      [
        data.conyugePrimerNombre,
        data.conyugeSegundoNombre,
        data.conyugePrimerApellido,
        data.conyugeSegundoApellido,
      ]
        .filter(Boolean)
        .join(' ') ||
      data.spouseName ||
      '';

    // --- SYNC: Ingresos Tab 9 → legacy Tab 6 (si no fueron llenados en Tab 6) ---
    const syncedIncome =
      data.ingresoPrincipalMensual || data.monthlyIncome || 0;
    const syncedExpenses =
      data.totalGastosMensuales || data.monthlyExpenses || 0;

    // Send ALL form data to the server action, including arrays and formulario definitivo fields.
    // Spread validated data first, then override computed fields + synced values.
    const submitData = {
      ...data,
      creditors: creditorsCount,
      phase: data.phase ?? undefined,
      // Sync spouse legacy from definitivo
      spouseName: syncedSpouseName,
      spouseIdNumber: data.conyugeIdentificacion || data.spouseIdNumber || '',
      spouseAddress: data.spouseAddress || '',
      spousePhone: data.conyugeTelefono || data.spousePhone || '',
      spouseEmail: data.conyugeCorreo || data.spouseEmail || '',
      // Sync cónyuge nombre completo
      conyugeNombreCompleto:
        syncedSpouseName || data.conyugeNombreCompleto || '',
      // Sync income
      monthlyIncome: syncedIncome,
      monthlyExpenses: syncedExpenses,
    };

    startTransition(async () => {
      const { success, data: result, error } = await createCase(submitData);

      if (success && result) {
        // Upload files BEFORE closing dialog so File objects remain valid
        if (result.id && documentsToUploadRef.current.length > 0) {
          try {
            const payload = {
              caseId: result.id,
              personName: selectedDebtor?.name || 'Solicitante',
              documents: await Promise.all(
                documentsToUploadRef.current.flatMap(({ docName, files }) =>
                  files.map(async (f) => ({
                    docName,
                    fileName: f.name,
                    mimeType: f.type || 'application/octet-stream',
                    dataBase64: await fileToBase64(f),
                  })),
                ),
              ),
            } as const;
            const uploadResult = await uploadCaseDocuments(payload);
            if (uploadResult.success) {
              toast.success(
                `Caso creado y ${payload.documents.length} documento(s) subido(s) exitosamente`,
              );
            } else {
              toast.warning(
                'Caso creado, pero hubo un error al subir documentos: ' +
                  (uploadResult.error ?? 'Error desconocido'),
              );
            }
          } catch {
            toast.warning(
              'Caso creado, pero hubo un error al subir documentos',
            );
          }
        } else {
          toast.success('Caso creado exitosamente');
        }

        // Clear ref, reset form, and close dialog AFTER upload completes
        documentsToUploadRef.current = [];
        form.reset();
        onOpenChange(false);
        onCaseCreated?.();
      } else {
        // Map server errors to clear, user-friendly messages
        const errorMessage = error ?? 'Error al crear el caso';
        const errorMap: Array<{ match: string; msg: string }> = [
          {
            match: 'required',
            msg: 'Por favor complete todos los campos requeridos.',
          },
          {
            match: 'requerido',
            msg: 'Por favor complete todos los campos requeridos.',
          },
          {
            match: 'Deudor no encontrado',
            msg: 'El deudor seleccionado no existe. Seleccione otro.',
          },
          {
            match: 'Unknown argument',
            msg: 'Error en los datos enviados. Verifique todos los campos.',
          },
          {
            match: 'Unique constraint',
            msg: 'Ya existe un caso con estos datos. Verifique la cédula o radicado.',
          },
          {
            match: 'duplicate',
            msg: 'Ya existe un registro duplicado. Verifique los datos ingresados.',
          },
          {
            match: 'ECONNREFUSED',
            msg: 'No se pudo conectar con el servidor. Intente de nuevo en unos segundos.',
          },
          {
            match: 'timeout',
            msg: 'La operación tardó demasiado. Intente de nuevo.',
          },
          {
            match: 'Permission',
            msg: 'No tiene permisos para crear casos. Contacte al administrador.',
          },
        ];

        const mapped = errorMap.find((e) =>
          errorMessage.toLowerCase().includes(e.match.toLowerCase()),
        );
        toast.error(mapped?.msg ?? errorMessage, { duration: 8000 });
      }
    });
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleCreateDebtor = async (
    data: QuickDebtorFormData,
  ): Promise<string | null> => {
    setCreatingDebtor(true);
    try {
      const {
        success,
        data: result,
        error,
      } = await createDebtor({
        name: data.name,
        idNumber: data.idNumber,
        email: data.email,
        phone: data.phone,
        address: data.address ?? '',
        city: data.city ?? 'Bogotá',
        department: data.department ?? 'Cundinamarca',
        monthlyIncome: 0,
        monthlyExpenses: 0,
        idType: 'CC',
        occupation: 'Empleado',
        birthDate: undefined,
        dependents: 0,
        maritalStatus: 'SOLTERO',
        educationLevel: 'UNIVERSITARIO',
        emergencyContact: '',
        emergencyPhone: '',
        bankAccount: '',
        bankName: '',
        accountType: 'AHORROS',
        description: '',
      });

      if (!success || error) {
        return error ?? 'Error al crear el deudor';
      }

      toast.success('Deudor creado exitosamente');
      setShowCreateDebtorDialog(false);
      const debtorsResult = await getAllDebtors();
      setDebtors(
        debtorsResult.data?.map((debtor) => ({
          id: debtor.id,
          name: debtor.name,
          idNumber: debtor.idNumber,
          email: debtor.email,
          phone: debtor.phone,
          address: debtor.address,
          city: debtor.city,
          department: debtor.department,
          monthlyIncome: Number(debtor.monthlyIncome),
          monthlyExpenses: Number(debtor.monthlyExpenses ?? 0),
        })) || [],
      );
      if (result?.id) {
        setSelectedDebtorId(result.id);
      }
      return null;
    } catch {
      return 'Error inesperado al crear el deudor. Intente de nuevo.';
    } finally {
      setCreatingDebtor(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedDebtorId('');
      setSelectedDebtor(null);
    }
  }, [open]);

  // Function to fill form with test data (only in development)
  const fillTestData = () => {
    // Select first debtor if available
    if (debtors.length > 0) {
      const firstDebtor = debtors[0];
      setSelectedDebtorId(firstDebtor.id);
      setSelectedDebtor(firstDebtor);
      form.setValue('debtorId', firstDebtor.id);
    }

    // Fill all form fields with test data
    form.setValue('type', 'INSOLVENCY');
    // totalDebt se calcula automáticamente de los acreedores
    form.setValue('causes', [
      'SOBREENDEUDAMIENTO',
      'PERDIDA_EMPLEO',
      'DISMINUCION_INGRESOS',
    ]);
    form.setValue('phase', 'Inicial');
    form.setValue('attorney', 'Dr. Juan Pérez');
    form.setValue('hasLegalProcesses', true);

    // Applicant scope
    form.setValue('applicantScope', ['PERSONA_NATURAL_NO_COMERCIANTE']);

    // Income
    form.setValue('monthlyIncome', 3500000);
    form.setValue('monthlyExpenses', 2800000);
    form.setValue('otherIncomeDescription', 'Arriendos');
    form.setValue('otherIncomeAmount', 500000);
    form.setValue('hasEmployerCertification', true);

    // Debts
    form.setValue('debts', [
      {
        creditor: 'Banco ABC',
        type: 'CREDIT_CARD',
        interestRate: '28.5',
        creditorAddress: 'Calle 100 #15-20',
        creditorCity: 'Bogotá',
        creditorEmail: 'cobranzas@bancoabc.com',
        capitalAmount: '15000000',
        interestAmount: '3500000',
        isDeferred: false,
        documentType: 'Pagaré',
        grantDate: '2022-01-15',
        dueDate: '2024-01-15',
        creditClassification: 'Consumo',
        hasActiveLibranza: false,
        creditorClass: 'Quirografario',
        percentageOfTotal: '33',
        daysOverdue: 180,
        coDebtorName: '',
        coDebtorCity: '',
        coDebtorAddress: '',
        coDebtorPhone: '',
        coDebtorEmail: '',
      },
      {
        creditor: 'Financiera XYZ',
        type: 'PERSONAL_LOAN',
        interestRate: '24.0',
        creditorAddress: 'Av. El Dorado #68-51',
        creditorCity: 'Bogotá',
        creditorEmail: 'cartera@financieraxyz.com',
        capitalAmount: '20000000',
        interestAmount: '5000000',
        isDeferred: false,
        documentType: 'Contrato de mutuo',
        grantDate: '2021-06-01',
        dueDate: '2023-06-01',
        creditClassification: 'Consumo',
        hasActiveLibranza: true,
        creditorClass: 'Quirografario',
        percentageOfTotal: '44',
        daysOverdue: 240,
        coDebtorName: 'Pedro López',
        coDebtorCity: 'Medellín',
        coDebtorAddress: 'Cra 45 #30-12',
        coDebtorPhone: '3109876543',
        coDebtorEmail: 'pedro.lopez@ejemplo.com',
      },
    ]);

    // Assets
    form.setValue('assets', [
      {
        name: 'Apartamento',
        type: 'INMUEBLE',
        value: '180000000',
        description: 'Apartamento en conjunto residencial',
        propertyType: 'Apartamento',
        address: 'Calle 127 #20-45 Apto 302',
        registrationNumber: '50N-12345678',
        encumbrance: 'Hipoteca Banco Popular',
        affectation: 'Ninguna',
        precautionaryMeasure: 'Ninguna',
        proofDocument: 'Escritura pública',
        isFamilyHome: true,
        isInalienablePatrimony: false,
      },
      {
        name: 'Vehículo Mazda CX-5',
        type: 'VEHICULO',
        value: '35000000',
        description: 'Automóvil particular',
        brand: 'Mazda',
        model: 'CX-5 2020',
        condition: 'Bueno',
        licensePlate: 'ABC123',
        transitAuthority: 'Secretaría de Movilidad Bogotá',
        guaranteeInFavorOf: 'Banco de Occidente',
        guaranteeAmount: '25000000',
      },
    ]);

    // Libranzas
    form.setValue('libranzas', [
      {
        payerName: 'Empresa ABC S.A.S',
        payerAddress: 'Zona Industrial Calle 13 #65-10',
        payerEmail: 'nomina@empresaabc.com',
        payerPhone: '6012345678',
        deductedAmount: '800000',
        productAndCreditor: 'Crédito libre inversión - Financiera XYZ',
      },
    ]);

    // Suspended services
    form.setValue('suspendedServices', [
      {
        creditorName: 'ETB',
        address: 'Calle 72 #10-25',
        email: 'servicio@etb.com',
        phone: '6017777777',
        amountOwed: '450000',
        suspendedProduct: 'Internet y telefonía',
      },
    ]);

    // Dependents
    form.setValue('dependents', [
      { name: 'María Sofía Rodríguez', age: 12, relationship: 'Hija' },
      { name: 'Carlos Andrés Rodríguez', age: 8, relationship: 'Hijo' },
    ]);

    // Legal processes
    form.setValue('legalProcesses', [
      {
        processType: 'EJECUTIVO',
        processTypeOther: '',
        plaintiff: 'Banco XYZ',
        court: 'Juzgado 15 Civil del Circuito',
        courtEmail: 'j15cctobogota@cendoj.ramajudicial.gov.co',
        fileNumber: '2024-00123-00',
        precautionaryMeasure: 'Embargo de salarios',
      },
    ]);

    // Payment proposal
    form.setValue('gracePeriodRequested', true);
    form.setValue('gracePeriodMonths', 6);
    form.setValue('paymentInKind', false);
    form.setValue('assetSaleAuthorized', false);
    form.setValue('cashFlowPayment', true);
    form.setValue('paymentTermMonths', 60);
    form.setValue('monthlyPaymentAmount', 850000);
    form.setValue('extraordinaryPayment', true);
    form.setValue('extraordinaryPaymentDate', 'Diciembre de cada año');
    form.setValue('capitalReduction', true);
    form.setValue('capitalReductionPercent', 15);
    form.setValue('forgiveAccruedInterest', true);
    form.setValue('forgiveFutureInterest', true);
    form.setValue('paymentOrder', {
      primera: 'Gastos de administración',
      segunda: 'Créditos laborales',
      tercera: 'Créditos con garantía real',
      cuarta: 'Créditos fiscales',
      quinta: 'Créditos quirografarios',
    });
    form.setValue('hasClassPrivileges', false);
    form.setValue('thirdPartyPaymentAuth', false);
    form.setValue('guaranteeSubstitution', false);

    // Legal foundations
    form.setValue('requestedFee', '2 SMLMV');
    form.setValue(
      'legalFoundations',
      'Ley 1564 de 2012, Código General del Proceso. Ley 1116 de 2006. Decreto 2677 de 2012.',
    );

    // Notifications
    form.setValue('notificationAddress', 'Calle 127 #20-45 Apto 302');
    form.setValue('notificationCity', 'Bogotá D.C.');
    form.setValue('notificationPhone', '3101234567');
    form.setValue('notificationEmail', 'juanrodriguez@email.com');

    // Signature
    form.setValue('applicantSignatureName', 'Juan Carlos Rodríguez');
    form.setValue('applicantSignatureId', '1234567890');

    // =======================================
    // Tab 2: Situación — Cónyuge + Info laboral + Cesación
    // =======================================

    // Cónyuge Definitivo
    form.setValue('conyugeTipoIdentificacion', 'CC');
    form.setValue('conyugeIdentificacion', '52987654');
    form.setValue('conyugePrimerNombre', 'Ana');
    form.setValue('conyugeSegundoNombre', 'María');
    form.setValue('conyugePrimerApellido', 'López');
    form.setValue('conyugeSegundoApellido', 'Martínez');
    form.setValue('conyugeTelefono', '3109876543');
    form.setValue('conyugeCorreo', 'analopez@email.com');
    form.setValue('sociedadConyugalDisuelta', false);

    // Información Laboral y Económica
    form.setValue('deudorOcupacion', 'Empleado');
    form.setValue('deudorProfesion', 'Administrador de Empresas');
    form.setValue('deudorActividadEconomica', 'Servicios administrativos');
    form.setValue('deudorTipoVinculacion', 'Contrato a término indefinido');
    form.setValue('deudorNombreEmpleador', 'Empresa ABC S.A.S');
    form.setValue('deudorNitEmpleador', '900123456-1');
    form.setValue('ingresoPrincipalMensual', 3500000);
    form.setValue('otrosIngresosMensuales', 500000);
    form.setValue('totalIngresosMensuales', 4000000);
    form.setValue('ingresosVariablesPromedio', 200000);
    form.setValue('ingresosNoOperacionales', 0);
    form.setValue('gastosVivienda', 800000);
    form.setValue('gastosAlimentacion', 600000);
    form.setValue('gastosServiciosPublicos', 250000);
    form.setValue('gastosTransporte', 300000);
    form.setValue('gastosEducacion', 400000);
    form.setValue('gastosSalud', 150000);
    form.setValue('otrosGastos', 300000);
    form.setValue('totalGastosMensuales', 2800000);
    form.setValue('capacidadPagoEstimada', 1200000);
    form.setValue('patrimonioTotalEstimado', 215000000);
    form.setValue('pasivoTotalEstimado', 50000000);

    // Cesación de Pagos
    form.setValue('cesacionPagos', true);
    form.setValue('fechaCesacionPagos', '2024-06-15');
    form.setValue('numeroAcreedoresActual', 3);
    form.setValue('porcentajePasivoEnMora', 85);
    form.setValue('obligacionesEnMora90Dias', true);
    form.setValue('procesosEjecutivosVigentes', true);

    // Tab 7: Declaraciones y Legal
    form.setValue('declaracionVeracidadInformacion', true);
    form.setValue('manifestacionBuenaFe', true);
    form.setValue('manifestacionNoOcultamientoBienes', true);
    form.setValue('autorizacionNotificacionesCorreo', true);
    form.setValue('autorizacionConsultaCentralesRiesgo', true);
    form.setValue('autorizacionTratamientoDatos', true);

    // Propuesta Inicial de Pago (also in Tab 6)
    form.setValue('propuestaPlazoMeses', 60);
    form.setValue('propuestaPeriodicidadPago', 'Mensual');
    form.setValue('propuestaTasaInteres', 0);
    form.setValue('propuestaQuitaPromedio', 15);
    form.setValue(
      'propuestaFechaInicioPago',
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 2);
        return d.toISOString().split('T')[0];
      })(),
    );
    form.setValue(
      'propuestaObservaciones',
      'Se solicita condonación total de intereses causados y futuros. Pago mensual con recursos provenientes de salario y arriendos.',
    );

    // Tab 7: Apoderado
    form.setValue('apoderadoNombreCompleto', 'Dr. María Fernanda Torres Ruiz');
    form.setValue('apoderadoTipoIdentificacion', 'CC');
    form.setValue('apoderadoIdentificacion', '51876543');
    form.setValue('apoderadoTarjetaProfesional', 'TP-123456');
    form.setValue('apoderadoDireccion', 'Carrera 7 #45-67 Oficina 301, Bogotá');
    form.setValue('apoderadoTelefono', '3115678901');
    form.setValue('apoderadoCorreo', 'mftorres@abogados.com');
    form.setValue('existePoderOtorgado', true);

    toast.success('Datos de prueba cargados (Tabs 1-8)');
  };

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          className="max-h-[90vh] overflow-y-auto sm:max-w-6xl"
        >
          <DialogHeader>
            <DialogTitle>Crear Nuevo Caso</DialogTitle>
            <DialogDescription>
              Complete la información para crear un nuevo caso de insolvencia
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit, onInvalid)}>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="space-y-4"
              >
                <TabsList className="flex w-full flex-wrap gap-1">
                  {(watchedType === 'CONCILIATION'
                    ? [
                        { value: 'debtor', label: '1. Solicitante' },
                        { value: 'conc-parties', label: '2. Partes' },
                        { value: 'conc-details', label: '3. Solicitud' },
                      ]
                    : watchedType === 'SUPPORT_AGREEMENT'
                      ? [
                          { value: 'debtor', label: '1. Solicitante' },
                          { value: 'apoyo-parties', label: '2. Partes' },
                          { value: 'apoyo-details', label: '3. Acuerdo' },
                        ]
                      : [
                          { value: 'debtor', label: '1. Solicitante' },
                          { value: 'situation', label: '2. Situación' },
                          { value: 'creditors', label: '3. Acreedores' },
                          { value: 'assets', label: '4. Bienes' },
                          { value: 'proposal', label: '5. Propuesta' },
                          { value: 'legal', label: '6. Legal' },
                          { value: 'documents', label: '7. Documentos' },
                        ]
                  ).map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`relative text-xs ${tabsWithErrors.has(tab.value) ? 'text-red-600 dark:text-red-400' : ''}`}
                    >
                      {tab.label}
                      {tabsWithErrors.has(tab.value) && (
                        <AlertCircle className="ml-1 h-3 w-3 text-red-500" />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Tab 1: Solicitante — Deudor + Ámbito + Causas + Datos básicos */}
                <TabsContent value="debtor" className="space-y-6">
                  <DebtorSection
                    debtors={debtors}
                    selectedDebtorId={selectedDebtorId}
                    selectedDebtor={selectedDebtor}
                    onDebtorSelect={setSelectedDebtorId}
                    onCreateDebtorClick={() => setShowCreateDebtorDialog(true)}
                    onCauseChange={handleCauseChange}
                    loading={dataLoading}
                  />
                  <ApplicantScopeSection />
                  <CaseDetailsSection
                    operators={operators}
                    loadingOperators={dataLoading}
                  />
                </TabsContent>

                {/* Tab 2: Situación — Cónyuge + Info laboral + Cesación + Procesos */}
                <TabsContent value="situation" className="space-y-6">
                  <ConyugeDefinitivoSection />
                  <InfoLaboralSection />
                  <CesacionPagosSection />
                  <LegalProcessSection />
                </TabsContent>

                {/* Tab 3: Acreedores + Libranzas + Servicios Suspendidos */}
                <TabsContent value="creditors" className="space-y-6">
                  <CreditorsDetailedSection />
                  <LibranzasSection />
                  <SuspendedServicesSection />
                </TabsContent>

                {/* Tab 4: Bienes */}
                <TabsContent value="assets" className="space-y-6">
                  <AssetsSection />
                </TabsContent>

                {/* Tab 5: Propuesta de Pago */}
                <TabsContent value="proposal" className="space-y-6">
                  <PaymentProposalSection />
                </TabsContent>

                {/* Tab 6: Legal — Declaraciones + Notificaciones + Firma + Apoderado */}
                <TabsContent value="legal" className="space-y-6">
                  <DeclaracionesSection />
                  <LegalFoundationsSection />
                  <NotificationsSection />
                  <ApoderadoSection />
                  <SignatureSection />
                </TabsContent>

                {/* Tab 7: Documentos — Carga de archivos */}
                <TabsContent value="documents" className="space-y-6">
                  <DocumentsSection
                    applicantScope={form.watch('applicantScope') ?? []}
                    assets={form.watch('assets') ?? []}
                    apoderados={form.watch('apoderados') ?? []}
                    apoderadoNombreCompleto={form.watch('apoderadoNombreCompleto') ?? undefined}
                    existePoderOtorgado={form.watch('existePoderOtorgado') ?? undefined}
                    hasAttorney={
                      !!form.watch('apoderadoNombreCompleto') ||
                      !!form
                        .watch('apoderados')
                        ?.some((a) => a?.nombreCompleto?.trim())
                    }
                    onFilesSelected={(sel) => {
                      documentsToUploadRef.current = sel;
                    }}
                  />
                </TabsContent>

                {/* Conciliation-specific tabs */}
                <TabsContent value="conc-parties" className="space-y-6">
                  <ConciliationPartiesSection />
                </TabsContent>

                <TabsContent value="conc-details" className="space-y-6">
                  <ConciliationDetailsSection />
                </TabsContent>

                {/* Support agreement-specific tabs */}
                <TabsContent value="apoyo-parties" className="space-y-6">
                  <SupportAgreementPartiesSection />
                </TabsContent>

                <TabsContent value="apoyo-details" className="space-y-6">
                  <SupportAgreementDetailsSection />
                </TabsContent>
              </Tabs>

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (
                <Alert
                  variant="default"
                  className="border-amber-200 bg-amber-50"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    Advertencias de coherencia
                  </AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <ul className="mt-2 list-disc pl-4">
                      {validationWarnings.map((warning, index) => (
                        <li key={index}>{warning.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {isDevelopment && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fillTestData}
                    className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                  >
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Llenar datos de prueba
                  </Button>
                )}
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  {activeTab === lastTab ? (
                    <Button type="submit" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Caso'
                      )}
                    </Button>
                  ) : (
                    <Button type="button" onClick={goToNextTab}>
                      Siguiente
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <CreateDebtorDialog
        open={showCreateDebtorDialog}
        onOpenChange={setShowCreateDebtorDialog}
        creatingDebtor={creatingDebtor}
        onSubmit={handleCreateDebtor}
      />
    </>
  );
}
