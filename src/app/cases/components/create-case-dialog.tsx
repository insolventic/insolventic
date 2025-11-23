'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                  <TabsTrigger value="debtor">1. Solicitante</TabsTrigger>
                  <TabsTrigger value="case-details">2. Detalles</TabsTrigger>
                  <TabsTrigger value="legal-process">3. Proceso</TabsTrigger>
                  <TabsTrigger value="creditors">4. Acreedores</TabsTrigger>
                  <TabsTrigger value="assets">5. Bienes</TabsTrigger>
                  <TabsTrigger value="income">6. Ingresos</TabsTrigger>
                  <TabsTrigger value="payment">7. Propuesta</TabsTrigger>
                  <TabsTrigger value="legal">8. Legal</TabsTrigger>
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
              </Tabs>

              <DialogFooter>
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
