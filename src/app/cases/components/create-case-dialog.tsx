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
  type NewDebtorForm,
} from '@/features/case/schemas';
import {
  validateIncomeExpenses,
  validatePaymentProposal,
  type ValidationIssue,
} from '@/features/case/validation-rules';

import { AssetsSection } from './create-case-dialog/assets-section';
import { CreateDebtorDialog } from './create-case-dialog/create-debtor-dialog';
import { CreditorsDetailedSection } from './create-case-dialog/creditors-detailed-section';
import { DebtorSection } from './create-case-dialog/debtor-section';
import { DocumentsSection } from './create-case-dialog/documents-section';
import { uploadCaseDocuments } from '@/features/document/actions';
import { CaseDetailsSection } from './create-case-dialog/case-details-section';
import { LegalProcessSection } from './create-case-dialog/legal-process-section';
import { ApplicantScopeSection } from './create-case-dialog/applicant-scope-section';
import { IncomeSection } from './create-case-dialog/income-section';
import { LibranzasSection } from './create-case-dialog/libranzas-section';
import { SuspendedServicesSection } from './create-case-dialog/suspended-services-section';
import { DependentsSection } from './create-case-dialog/dependents-section';
import { PaymentProposalSection } from './create-case-dialog/payment-proposal-section';
import { SpouseSection } from './create-case-dialog/spouse-section';
import { LegalFoundationsSection } from './create-case-dialog/legal-foundations-section';
import { NotificationsSection } from './create-case-dialog/notifications-section';
import { SignatureSection } from './create-case-dialog/signature-section';
// Formulario definitivo sections
import { ConyugeDefinitivoSection } from './create-case-dialog/conyuge-definitivo-section';
import { InfoLaboralSection } from './create-case-dialog/info-laboral-section';
import { CesacionPagosSection } from './create-case-dialog/cesacion-pagos-section';
import { AcreedoresSection } from './create-case-dialog/acreedores-section';
import { BienesSection } from './create-case-dialog/bienes-section';
import { ProcesosJudicialesSection } from './create-case-dialog/procesos-judiciales-section';
import { DeclaracionesSection } from './create-case-dialog/declaraciones-section';
import { PropuestaInicialSection } from './create-case-dialog/propuesta-inicial-section';
import { DocumentosAnexosSection } from './create-case-dialog/documentos-anexos-section';
import { ApoderadoSection } from './create-case-dialog/apoderado-section';
import { RadicacionInternaSection } from './create-case-dialog/radicacion-interna-section';

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated?: () => void;
}

export function CreateCaseDialog({
  open,
  onOpenChange,
  onCaseCreated,
}: Readonly<CreateCaseDialogProps>) {
  const [dataLoading, setDataLoading] = useState(false);
  const [debtors, setDebtors] = useState<DebtorOption[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorOption | null>(
    null,
  );
  const [showCreateDebtorDialog, setShowCreateDebtorDialog] = useState(false);
  const [newDebtorForm, setNewDebtorForm] = useState<NewDebtorForm>({
    name: '',
    idNumber: '',
    email: '',
    phone: '',
    address: '',
    city: 'Bogotá',
    department: 'Cundinamarca',
    monthlyIncome: 0,
    monthlyExpenses: 0,
  });
  const [creatingDebtor, setCreatingDebtor] = useState(false);
  const documentsToUploadRef = useRef<
    Array<{ docName: string; files: File[] }>
  >([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationIssue[]>([]);

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

  useEffect(() => {
    if (open) {
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
        tramite: '',
        filingDate: '',
        debtorIdNumber: '',
        convened: '',
        attorney: '',
        owedCapital: '',
        designatedOperator: '',
        designationDate: '',
        positionAcceptanceDate: '',
        inadmissionDate: '',
        admissionDate: '',
        firstHearingDate: '',
        firstHearingTime: '',
        rejection: false,
        withdrawal: false,
        hasLegalProcesses: false,
        courtNumber: '',
        city: '',
        processType: '',
        plaintiff: '',
        judicialFileNumber: '',
        suspensionDate: '',
        resultDeliveryDate: '',
        resultType: '',
        resultDate: '',
        siccacNumber: '',
        riskCenterCommunication: false,
        // New fields from comprehensive form
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
        spouseName: '',
        spouseIdNumber: '',
        spouseAddress: '',
        spousePhone: '',
        spouseEmail: '',
        requestedFee: '',
        legalFoundations: '',
        notificationAddress: '',
        notificationPhone: '',
        notificationEmail: '',
        applicantSignatureName: '',
        applicantSignatureId: '',
        applicantSignature: '',
        // Zoom meeting info
        zoomMeetingId: '',
        zoomPassword: '',
        zoomLink: '',
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

          const operatorUser = usersResult.data?.find(
            (user) =>
              user.role?.name === 'Operadora de Insolvencia' ||
              user.role?.name === 'Abogado',
          );
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
      typeof formData.monthlyIncome === 'number' ? formData.monthlyIncome : undefined,
      typeof formData.monthlyExpenses === 'number' ? formData.monthlyExpenses : undefined
    );
    warnings.push(...incomeWarnings.filter(w => w.type === 'warning'));

    // Validate payment proposal
    const proposalWarnings = validatePaymentProposal(formData);
    warnings.push(...proposalWarnings.filter(w => w.type === 'warning'));

    setValidationWarnings(warnings);
  };

  // Watch form changes to update warnings
  // CORRECCIÓN: form.watch() retorna una función de suscripción estable
  // No se debe usar form.watch como dependencia - causa bucle infinito
  useEffect(() => {
    const subscription = form.watch(() => {
      validateCoherence();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (data: CreateCaseFormData) => {
    // Count creditors from debts array
    const creditorsCount = data.debts?.length ?? 0;

    const submitData = {
      debtorId: data.debtorId,
      type: data.type,
      totalDebt: data.totalDebt,
      creditors: creditorsCount,
      operatorId: data.operatorId,
      hearingDate: data.hearingDate,
      phase: data.phase ?? undefined,
      caseNumber: data.caseNumber,
      causes: data.causes,
      tramite: data.tramite,
      filingDate: data.filingDate,
      debtorIdNumber: data.debtorIdNumber,
      convened: data.convened,
      attorney: data.attorney,
      owedCapital: data.owedCapital,
      designatedOperator: data.designatedOperator,
      designationDate: data.designationDate,
      positionAcceptanceDate: data.positionAcceptanceDate,
      inadmissionDate: data.inadmissionDate,
      admissionDate: data.admissionDate,
      firstHearingDate: data.firstHearingDate,
      firstHearingTime: data.firstHearingTime,
      rejection: data.rejection,
      withdrawal: data.withdrawal,
      hasLegalProcesses: data.hasLegalProcesses,
      courtNumber: data.courtNumber,
      city: data.city,
      processType: data.processType,
      plaintiff: data.plaintiff,
      judicialFileNumber: data.judicialFileNumber,
      suspensionDate: data.suspensionDate,
      resultDeliveryDate: data.resultDeliveryDate,
      resultType: data.resultType,
      resultDate: data.resultDate,
      siccacNumber: data.siccacNumber,
      riskCenterCommunication: data.riskCenterCommunication,
      // New comprehensive fields
      applicantScope: data.applicantScope,
      monthlyIncome: data.monthlyIncome,
      monthlyExpenses: data.monthlyExpenses,
      otherIncomeDescription: data.otherIncomeDescription,
      otherIncomeAmount: data.otherIncomeAmount,
      hasEmployerCertification: data.hasEmployerCertification,
      libranzas: data.libranzas,
      suspendedServices: data.suspendedServices,
      dependents: data.dependents,
      gracePeriodRequested: data.gracePeriodRequested,
      gracePeriodMonths: data.gracePeriodMonths,
      paymentInKind: data.paymentInKind,
      paymentInKindDescription: data.paymentInKindDescription,
      assetSaleAuthorized: data.assetSaleAuthorized,
      assetSaleDescription: data.assetSaleDescription,
      cashFlowPayment: data.cashFlowPayment,
      paymentTermMonths: data.paymentTermMonths,
      monthlyPaymentAmount: data.monthlyPaymentAmount,
      variablePayment: data.variablePayment,
      extraordinaryPayment: data.extraordinaryPayment,
      extraordinaryPaymentDate: data.extraordinaryPaymentDate,
      capitalReduction: data.capitalReduction,
      capitalReductionPercent: data.capitalReductionPercent,
      insuranceOffering: data.insuranceOffering,
      forgiveAccruedInterest: data.forgiveAccruedInterest,
      forgiveFutureInterest: data.forgiveFutureInterest,
      paymentOrder: data.paymentOrder,
      hasClassPrivileges: data.hasClassPrivileges,
      classPrivilegesDescription: data.classPrivilegesDescription,
      thirdPartyPaymentAuth: data.thirdPartyPaymentAuth,
      guaranteeSubstitution: data.guaranteeSubstitution,
      spouseName: data.spouseName,
      spouseIdNumber: data.spouseIdNumber,
      spouseAddress: data.spouseAddress,
      spousePhone: data.spousePhone,
      spouseEmail: data.spouseEmail,
      requestedFee: data.requestedFee,
      legalFoundations: data.legalFoundations,
      notificationAddress: data.notificationAddress,
      notificationPhone: data.notificationPhone,
      notificationEmail: data.notificationEmail,
      applicantSignatureName: data.applicantSignatureName,
      applicantSignatureId: data.applicantSignatureId,
      applicantSignature: data.applicantSignature,
      // Zoom meeting info
      zoomMeetingId: data.zoomMeetingId,
      zoomPassword: data.zoomPassword,
      zoomLink: data.zoomLink,
      // Post-Acuerdo fields
      paymentStartDate: data.paymentStartDate,
      agreementValidityDate: data.agreementValidityDate,
      approvalPercentage: data.approvalPercentage,
      failureDate: data.failureDate,
      failureType: data.failureType,
      isBilateral: data.isBilateral,
      bilateralAgreementNumber: data.bilateralAgreementNumber,
      bilateralCreditorId: data.bilateralCreditorId,
    };

    startTransition(async () => {
      const { success, data: result, error } = await createCase(submitData);

      if (success && result) {
        toast.success('Caso creado exitosamente');
        form.reset();
        onOpenChange(false);
        onCaseCreated?.();

        // If case creation succeeded and there are selected files, upload them
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
            // Note: uploadCaseDocuments still uses the old zsa pattern
            await uploadCaseDocuments(payload);
          } catch {
            toast.error('Error al subir documentos');
          }
        }
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

  const handleCreateDebtor = async () => {
    if (
      !newDebtorForm.name ||
      !newDebtorForm.idNumber ||
      !newDebtorForm.email ||
      !newDebtorForm.phone
    ) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    setCreatingDebtor(true);
    try {
      const {
        success,
        data: result,
        error,
      } = await createDebtor({
        ...newDebtorForm,
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
        toast.error(error ?? 'Error al crear el deudor');
      } else {
        toast.success('Deudor creado exitosamente');
        setShowCreateDebtorDialog(false);
        setNewDebtorForm({
          name: '',
          idNumber: '',
          email: '',
          phone: '',
          address: '',
          city: 'Bogotá',
          department: 'Cundinamarca',
          monthlyIncome: 0,
          monthlyExpenses: 0,
        });
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
      }
    } catch {
      toast.error('Error al crear el deudor');
    } finally {
      setCreatingDebtor(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedDebtorId('');
      setSelectedDebtor(null);
      setNewDebtorForm({
        name: '',
        idNumber: '',
        email: '',
        phone: '',
        address: '',
        city: 'Bogotá',
        department: 'Cundinamarca',
        monthlyIncome: 0,
        monthlyExpenses: 0,
      });
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
    form.setValue('totalDebt', '50000000');
    form.setValue('causes', [
      'Sobreendeudamiento por falta de recursos',
      'Pérdida de empleo',
      'Disminución de ingresos',
    ]);
    form.setValue('phase', 'Inicial');
    form.setValue('tramite', 'Negociación de deudas');
    form.setValue('filingDate', new Date().toISOString().split('T')[0]);
    form.setValue('debtorIdNumber', '1234567890');
    form.setValue('convened', 'Acreedores varios');
    form.setValue('attorney', 'Dr. Juan Pérez');
    form.setValue('owedCapital', '45000000');
    form.setValue('designatedOperator', 'María García');
    form.setValue('designationDate', new Date().toISOString().split('T')[0]);
    form.setValue('positionAcceptanceDate', new Date().toISOString().split('T')[0]);
    form.setValue('admissionDate', new Date().toISOString().split('T')[0]);

    // Hearing date 30 days from now
    const hearingDate = new Date();
    hearingDate.setDate(hearingDate.getDate() + 30);
    form.setValue('firstHearingDate', hearingDate.toISOString().split('T')[0]);
    form.setValue('firstHearingTime', '10:00');

    form.setValue('hasLegalProcesses', true);
    form.setValue('courtNumber', 'Juzgado 15 Civil del Circuito');
    form.setValue('city', 'Bogotá');
    form.setValue('siccacNumber', 'SICCAC-2025-001');

    // Zoom info
    form.setValue('zoomMeetingId', '123 456 7890');
    form.setValue('zoomPassword', 'abc123');
    form.setValue('zoomLink', 'https://zoom.us/j/1234567890?pwd=abc123');

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

    // Spouse
    form.setValue('spouseName', 'Ana María López');
    form.setValue('spouseIdNumber', '52987654');
    form.setValue('spouseAddress', 'Calle 127 #20-45 Apto 302');
    form.setValue('spousePhone', '3109876543');
    form.setValue('spouseEmail', 'analopez@email.com');

    // Legal foundations
    form.setValue('requestedFee', '2 SMLMV');
    form.setValue(
      'legalFoundations',
      'Ley 1564 de 2012, Código General del Proceso. Ley 1116 de 2006. Decreto 2677 de 2012.',
    );

    // Notifications
    form.setValue('notificationAddress', 'Calle 127 #20-45 Apto 302, Bogotá');
    form.setValue('notificationPhone', '3101234567');
    form.setValue('notificationEmail', 'juanrodriguez@email.com');

    // Signature
    form.setValue('applicantSignatureName', 'Juan Carlos Rodríguez');
    form.setValue('applicantSignatureId', '1234567890');

    toast.success('Datos de prueba cargados correctamente');
  };

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Caso</DialogTitle>
            <DialogDescription>
              Complete la información para crear un nuevo caso de insolvencia
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <Tabs defaultValue="debtor" className="space-y-4">
                <TabsList className="flex w-full flex-wrap gap-1">
                  <TabsTrigger value="debtor" className="text-xs">1. Solicitante</TabsTrigger>
                  <TabsTrigger value="case-details" className="text-xs">2. Detalles</TabsTrigger>
                  <TabsTrigger value="legal-process" className="text-xs">3. Proceso</TabsTrigger>
                  <TabsTrigger value="creditors" className="text-xs">4. Acreedores</TabsTrigger>
                  <TabsTrigger value="assets" className="text-xs">5. Bienes</TabsTrigger>
                  <TabsTrigger value="income" className="text-xs">6. Ingresos</TabsTrigger>
                  <TabsTrigger value="payment" className="text-xs">7. Propuesta</TabsTrigger>
                  <TabsTrigger value="legal" className="text-xs">8. Legal</TabsTrigger>
                  <TabsTrigger value="definitivo-acreedores" className="text-xs">9. Acr. Def.</TabsTrigger>
                  <TabsTrigger value="definitivo-bienes" className="text-xs">10. Bienes Def.</TabsTrigger>
                  <TabsTrigger value="definitivo-extra" className="text-xs">11. Declaraciones</TabsTrigger>
                  <TabsTrigger value="definitivo-final" className="text-xs">12. Final</TabsTrigger>
                </TabsList>

                {/* Tab 1: Deudor + Ámbito de Aplicación */}
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
                  <div className="border-t pt-6">
                    <ApplicantScopeSection />
                  </div>
                </TabsContent>

                {/* Tab 2: Detalles del Caso */}
                <TabsContent value="case-details" className="space-y-4">
                  <CaseDetailsSection />
                </TabsContent>

                {/* Tab 3: Proceso Legal */}
                <TabsContent value="legal-process" className="space-y-4">
                  <LegalProcessSection />
                </TabsContent>

                {/* Tab 4: Acreedores + Libranzas + Servicios Suspendidos */}
                <TabsContent value="creditors" className="space-y-6">
                  <CreditorsDetailedSection />
                  <div className="border-t pt-6">
                    <LibranzasSection />
                  </div>
                  <div className="border-t pt-6">
                    <SuspendedServicesSection />
                  </div>
                </TabsContent>

                {/* Tab 5: Bienes + Documentos */}
                <TabsContent value="assets" className="space-y-6">
                  <AssetsSection />
                  <div className="border-t pt-6">
                    <DocumentsSection
                      onFilesSelected={(sel) => {
                        documentsToUploadRef.current = sel;
                      }}
                    />
                  </div>
                </TabsContent>

                {/* Tab 6: Ingresos + Gastos + Dependientes */}
                <TabsContent value="income" className="space-y-6">
                  <IncomeSection />
                  <div className="border-t pt-6">
                    <DependentsSection />
                  </div>
                </TabsContent>

                {/* Tab 7: Propuesta de Pago + Cónyuge */}
                <TabsContent value="payment" className="space-y-6">
                  <PaymentProposalSection />
                  <div className="border-t pt-6">
                    <SpouseSection />
                  </div>
                </TabsContent>

                {/* Tab 8: Legal + Notificaciones + Firma */}
                <TabsContent value="legal" className="space-y-6">
                  <LegalFoundationsSection />
                  <div className="border-t pt-6">
                    <NotificationsSection />
                  </div>
                  <div className="border-t pt-6">
                    <SignatureSection />
                  </div>
                </TabsContent>

                {/* Tab 9: Formulario Definitivo - Acreedores + Cónyuge + Info Laboral */}
                <TabsContent value="definitivo-acreedores" className="space-y-6">
                  <ConyugeDefinitivoSection />
                  <div className="border-t pt-6">
                    <InfoLaboralSection />
                  </div>
                  <div className="border-t pt-6">
                    <CesacionPagosSection />
                  </div>
                  <div className="border-t pt-6">
                    <AcreedoresSection />
                  </div>
                </TabsContent>

                {/* Tab 10: Formulario Definitivo - Bienes + Procesos Judiciales */}
                <TabsContent value="definitivo-bienes" className="space-y-6">
                  <BienesSection />
                  <div className="border-t pt-6">
                    <ProcesosJudicialesSection />
                  </div>
                </TabsContent>

                {/* Tab 11: Formulario Definitivo - Declaraciones + Propuesta Inicial */}
                <TabsContent value="definitivo-extra" className="space-y-6">
                  <DeclaracionesSection />
                  <div className="border-t pt-6">
                    <PropuestaInicialSection />
                  </div>
                </TabsContent>

                {/* Tab 12: Formulario Definitivo - Docs Anexos + Apoderado + Radicación */}
                <TabsContent value="definitivo-final" className="space-y-6">
                  <DocumentosAnexosSection />
                  <div className="border-t pt-6">
                    <ApoderadoSection />
                  </div>
                  <div className="border-t pt-6">
                    <RadicacionInternaSection />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (
                <Alert variant="default" className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Advertencias de coherencia</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <ul className="list-disc pl-4 mt-2">
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
                </div>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <CreateDebtorDialog
        open={showCreateDebtorDialog}
        onOpenChange={setShowCreateDebtorDialog}
        newDebtorForm={newDebtorForm}
        creatingDebtor={creatingDebtor}
        onFormChange={setNewDebtorForm}
        onSubmit={handleCreateDebtor}
      />
    </>
  );
}
