'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, FlaskConical } from 'lucide-react';
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
import { createCase } from '@/features/case/actions';
import { getAllCreditors } from '@/features/creditor/actions';
import { getAllDebtors, createDebtor } from '@/features/debtor/actions';
import { getAllUsers } from '@/features/user/actions';
import {
  createCaseFormSchema,
  type CreateCaseFormData,
  type DebtorOption,
} from '@/features/case/schemas';
import {
  validateIncomeExpenses,
  validatePaymentProposal,
  validateDocumentsComplete,
  validateMinimaCuantia,
  SMMLV_2025,
  type ValidationIssue,
} from '@/features/case/validation-rules';

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

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated?: () => void;
}

const TAB_ORDER = [
  'debtor',
  'situation',
  'creditors',
  'assets',
  'proposal',
  'legal',
  'documents',
] as const;

const LAST_TAB = TAB_ORDER[TAB_ORDER.length - 1];

export function CreateCaseDialog({
  open,
  onOpenChange,
  onCaseCreated,
}: Readonly<CreateCaseDialogProps>) {
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TAB_ORDER[0]);
  const [debtors, setDebtors] = useState<DebtorOption[]>([]);
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
      type: 'INSOLVENCY' as const,
      totalDebt: '',
      creditors: 1,
      operatorId: '',
      causes: [],
      debts: [],
      assets: [],
      legalProcesses: [],
      phase: 'Inicial',
      hearingDate: null,
      caseNumber: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const dialogContentRef = useRef<HTMLDivElement>(null);

  const goToNextTab = () => {
    const currentIndex = TAB_ORDER.indexOf(
      activeTab as (typeof TAB_ORDER)[number],
    );
    if (currentIndex < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[currentIndex + 1]);
    }
  };

  // Scroll to top when tab changes
  useEffect(() => {
    dialogContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (open) {
      setActiveTab(TAB_ORDER[0]);
      form.reset({
        debtorId: '',
        type: 'INSOLVENCY' as const,
        totalDebt: '',
        creditors: 1,
        operatorId: '',
        causes: [],
        debts: [],
        assets: [],
        phase: 'Inicial',
        hearingDate: null,
        caseNumber: '',
        filingDate: '',
        attorney: '',
        rejection: false,
        withdrawal: false,
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
        notificationOutsideBogota: false,
        outsideBogotaReason: '',
        applicantSignatureName: '',
        applicantSignatureId: '',
        applicantSignature: '',
      });

      const loadData = async () => {
        setDataLoading(true);
        try {
          const [debtorsResult, , usersResult] = await Promise.all([
            getAllDebtors(),
            getAllCreditors(),
            getAllUsers(),
          ]);

          if (usersResult.error) {
            toast.error('Error al cargar los usuarios');
            return;
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

          // Auto-populate operatorId: prefer specific roles, fallback to first available user
          const operatorUser =
            usersResult.data?.find(
              (user) =>
                user.role?.name === 'Operadora de Insolvencia' ||
                user.role?.name === 'Abogado',
            ) || usersResult.data?.[0]; // Fallback to first user if no specific role found
          if (operatorUser) {
            form.setValue('operatorId', operatorUser.id);
          }
        } catch {
          toast.error('Error al cargar los datos');
        } finally {
          setDataLoading(false);
        }
      };
      void loadData();
    }
  }, [open, form]);

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

  const insolvencyCauses = [
    'Sobreendeudamiento por falta de recursos',
    'Pérdida de empleo',
    'Divorcio',
    'Enfermedad',
    'Accidente',
    'Estafa',
    'Disminución de ingresos',
    'Falta de educación financiera',
    'Muerte de cónyuge',
    'Nuevos créditos para cubrir otros',
    'Mala inversión',
    'Otros',
  ];

  const handleCauseChange = (cause: string) => {
    const currentCauses = form.getValues('causes') ?? [];
    const newCauses = currentCauses.includes(cause)
      ? currentCauses.filter((c) => c !== cause)
      : [...currentCauses, cause];
    form.setValue('causes', newCauses);
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

    // Validate mínima cuantía → abogado obligatorio
    const totalDebt =
      parseFloat(String(formData.totalDebt || '0').replace(/[^0-9.-]/g, '')) ||
      0;
    const hasAttorney = !!(
      formData.attorney || formData.apoderadoNombreCompleto
    );
    if (totalDebt > 40 * SMMLV_2025 && !hasAttorney) {
      warnings.push({
        field: 'attorney',
        message: `La deuda total ($${totalDebt.toLocaleString('es-CO')}) supera la mínima cuantía (40 SMMLV). Es obligatorio contar con apoderado judicial.`,
        type: 'warning',
      });
    }

    setValidationWarnings(warnings);
  };

  // Watch form changes to update warnings + auto-calculate totalDebt and credit fields
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      validateCoherence();

      // Auto-calculate totalDebt and credit fields when debts change
      if (name?.startsWith('debts') || name === 'debts') {
        const debts = form.getValues('debts') || [];
        let totalCapital = 0;
        let totalInterest = 0;

        debts.forEach((debt: Record<string, unknown>, index: number) => {
          const capital =
            parseFloat(
              String(debt?.capitalAmount || '0').replace(/[^0-9.-]/g, ''),
            ) || 0;
          const interest =
            parseFloat(
              String(debt?.interestAmount || '0').replace(/[^0-9.-]/g, ''),
            ) || 0;
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
            parseFloat(
              String(debt?.capitalAmount || '0').replace(/[^0-9.-]/g, ''),
            ) || 0;
          const interest =
            parseFloat(
              String(debt?.interestAmount || '0').replace(/[^0-9.-]/g, ''),
            ) || 0;
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

    // Collect first-level error messages
    const errorMessages: string[] = [];
    for (const [key, value] of Object.entries(errors)) {
      const err = value as { message?: string };
      if (err?.message) {
        errorMessages.push(`${key}: ${err.message}`);
      }
    }

    if (errorMessages.length > 0) {
      toast.error('Error de validación', {
        description: errorMessages.slice(0, 3).join(', '),
        duration: 6000,
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
        // Show specific error message from server or generic error
        const errorMessage = error ?? 'Error al crear el caso';

        // Check if it's a validation error
        if (
          errorMessage.includes('required') ||
          errorMessage.includes('requerido')
        ) {
          toast.error('Por favor complete todos los campos requeridos');
        } else if (errorMessage.includes('Deudor no encontrado')) {
          toast.error(
            'El deudor seleccionado no existe. Por favor seleccione otro.',
          );
        } else if (errorMessage.includes('Unknown argument')) {
          toast.error(
            'Error en los datos enviados. Por favor verifique todos los campos.',
          );
        } else {
          toast.error(errorMessage);
        }
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
      'Sobreendeudamiento por falta de recursos',
      'Pérdida de empleo',
      'Disminución de ingresos',
    ]);
    form.setValue('phase', 'Inicial');
    form.setValue('filingDate', new Date().toISOString().split('T')[0]);
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
        processType: 'Ejecutivo singular',
        plaintiff: 'Banco XYZ',
        court: 'Juzgado 15 Civil del Circuito',
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

    // Tab 3: Acreedores Definitivo
    form.setValue('acreedores', [
      {
        acreedorTipo: 'Persona jurídica',
        acreedorNombreRazonSocial: 'Banco ABC S.A.',
        acreedorTipoIdentificacion: 'NIT',
        acreedorIdentificacion: '860000001-5',
        acreedorDireccion: 'Calle 100 #15-20, Bogotá',
        acreedorCiudad: 'Bogotá',
        acreedorCorreo: 'cobranzas@bancoabc.com',
        acreedorTelefono: '6013001234',
        tipoObligacion: 'Tarjeta de crédito',
        numeroObligacion: 'TC-2022-001234',
        naturalezaCredito: 'Quirografario',
        fechaOtorgamiento: '2022-01-15',
        fechaVencimiento: '2024-01-15',
        fechaMora: '2024-02-15',
        diasMora: 180,
        valorCapital: '15000000',
        valorInteresesCorrientes: '2500000',
        valorInteresesMora: '1000000',
        valorGastosCobranza: '500000',
        valorTotalObligacion: '19000000',
        obligacionCodeudores: false,
        nombreCodeudores: '',
        garantiaAsociada: false,
        tipoGarantia: '',
        descripcionGarantia: '',
        procesoJudicialEnCurso: true,
        tipoProcesoJudicial: 'Ejecutivo singular',
        juzgadoNombre: 'Juzgado 15 Civil del Circuito',
        juzgadoCiudad: 'Bogotá',
        procesoJudicialRadicado: '2024-00123-00',
        demandanteNombre: 'Banco ABC S.A.',
        etapaProcesal: 'Mandamiento de pago',
      },
      {
        acreedorTipo: 'Persona jurídica',
        acreedorNombreRazonSocial: 'Financiera XYZ S.A.',
        acreedorTipoIdentificacion: 'NIT',
        acreedorIdentificacion: '900456789-3',
        acreedorDireccion: 'Av. El Dorado #68-51, Bogotá',
        acreedorCiudad: 'Bogotá',
        acreedorCorreo: 'cartera@financieraxyz.com',
        acreedorTelefono: '6014567890',
        tipoObligacion: 'Crédito de libre inversión',
        numeroObligacion: 'CLI-2021-005678',
        naturalezaCredito: 'Quirografario',
        fechaOtorgamiento: '2021-06-01',
        fechaVencimiento: '2023-06-01',
        fechaMora: '2023-07-01',
        diasMora: 240,
        valorCapital: '20000000',
        valorInteresesCorrientes: '3500000',
        valorInteresesMora: '1500000',
        valorGastosCobranza: '800000',
        valorTotalObligacion: '25800000',
        obligacionCodeudores: true,
        nombreCodeudores: 'Pedro López Gómez - CC 79456123',
        garantiaAsociada: false,
        tipoGarantia: '',
        descripcionGarantia: '',
        procesoJudicialEnCurso: false,
        tipoProcesoJudicial: '',
        juzgadoNombre: '',
        juzgadoCiudad: '',
        procesoJudicialRadicado: '',
        demandanteNombre: '',
        etapaProcesal: '',
      },
    ]);

    // Tab 4: Bienes Definitivo
    form.setValue('bienes', [
      {
        bienTipo: 'Inmueble',
        bienDescripcion:
          'Apartamento en conjunto residencial Torres del Parque',
        bienUbicacion: 'Calle 127 #20-45 Apto 302, Bogotá',
        bienMatriculaInmobiliaria: '50N-12345678',
        bienPlaca: '',
        bienEntidadFinanciera: '',
        bienValorComercial: '180000000',
        bienValorCatastral: '120000000',
        bienValorLibros: '150000000',
        bienGravamenes: true,
        descripcionGravamen:
          'Hipoteca a favor de Banco Popular por $90.000.000',
        bienEmbargado: false,
        bienAfectadoViviendaFamiliar: true,
        bienEnLeasing: false,
      },
      {
        bienTipo: 'Vehiculo',
        bienDescripcion: 'Automóvil Mazda CX-5 modelo 2020',
        bienUbicacion: 'Bogotá D.C.',
        bienMatriculaInmobiliaria: '',
        bienPlaca: 'ABC123',
        bienEntidadFinanciera: '',
        bienValorComercial: '35000000',
        bienValorCatastral: '',
        bienValorLibros: '30000000',
        bienGravamenes: true,
        descripcionGravamen:
          'Prenda a favor de Banco de Occidente por $25.000.000',
        bienEmbargado: false,
        bienAfectadoViviendaFamiliar: false,
        bienEnLeasing: false,
      },
    ]);

    // Procesos Judiciales
    form.setValue('procesosJudiciales', [
      {
        tipoProceso: 'Ejecutivo singular',
        juzgadoNombre: 'Juzgado 15 Civil del Circuito',
        juzgadoCiudad: 'Bogotá',
        procesoJudicialRadicado: '2024-00123-00',
        demandanteNombre: 'Banco ABC S.A.',
        demandadoNombre: 'Juan Carlos Rodríguez',
        cuantiaProceso: '19000000',
        estadoProceso: 'Admitido',
      },
    ]);

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
                  <TabsTrigger value="debtor" className="text-xs">
                    1. Solicitante
                  </TabsTrigger>
                  <TabsTrigger value="situation" className="text-xs">
                    2. Situación
                  </TabsTrigger>
                  <TabsTrigger value="creditors" className="text-xs">
                    3. Acreedores
                  </TabsTrigger>
                  <TabsTrigger value="assets" className="text-xs">
                    4. Bienes
                  </TabsTrigger>
                  <TabsTrigger value="proposal" className="text-xs">
                    5. Propuesta
                  </TabsTrigger>
                  <TabsTrigger value="legal" className="text-xs">
                    6. Legal
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">
                    7. Documentos
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Solicitante — Deudor + Ámbito + Causas + Datos básicos */}
                <TabsContent value="debtor" className="space-y-6">
                  <DebtorSection
                    debtors={debtors}
                    selectedDebtorId={selectedDebtorId}
                    selectedDebtor={selectedDebtor}
                    insolvencyCauses={insolvencyCauses}
                    onDebtorSelect={setSelectedDebtorId}
                    onCreateDebtorClick={() => setShowCreateDebtorDialog(true)}
                    onCauseChange={handleCauseChange}
                    loading={dataLoading}
                  />
                  <ApplicantScopeSection />
                  <CaseDetailsSection />
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
                    hasAttorney={!!form.watch('apoderadoNombreCompleto')}
                    onFilesSelected={(sel) => {
                      documentsToUploadRef.current = sel;
                    }}
                  />
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
                  {activeTab === LAST_TAB ? (
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
