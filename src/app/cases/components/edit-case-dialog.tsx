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
import { normalizeCausas } from '@/features/case/causas-insolvencia';

import { updateCase, getCaseById } from '@/features/case/actions';
import { uploadCaseDocuments } from '@/features/document/actions';
import {
  updateCaseFormSchema,
  type UpdateCaseFormData,
  type CaseListItem,
  type DebtorOption,
  type CreditorOption,
} from '@/features/case/schemas';
import { getAllCreditors } from '@/features/creditor/actions';
import { getAllDebtors, createDebtor } from '@/features/debtor/actions';
import { getAssignableOperators } from '@/features/user/actions';
import type { AssignableOperator } from '@/features/user/schemas';

import {
  CreateDebtorDialog,
  type QuickDebtorFormData,
} from './create-case-dialog/create-debtor-dialog';
import { DebtsTab } from './edit-case-dialog/debts-tab';
import { AssetsTab } from './edit-case-dialog/assets-tab';
import { DebtorSection } from './create-case-dialog/debtor-section';
import { ConciliationPartiesSection } from './create-case-dialog/conciliation-parties-section';
import { ConciliationDetailsSection } from './create-case-dialog/conciliation-details-section';
import { SupportAgreementPartiesSection } from './create-case-dialog/support-agreement-parties-section';
import { SupportAgreementDetailsSection } from './create-case-dialog/support-agreement-details-section';
import {
  pickTypeSpecificFields,
  pickTypeSpecificValues,
} from './edit-case-dialog/type-specific-fields';
import {
  pickGeneralFields,
  pickGeneralValues,
} from './edit-case-dialog/general-fields';
import { DocumentsSection } from './create-case-dialog/documents-section';
import { CaseDetailsSection } from './create-case-dialog/case-details-section';
import { LegalProcessSection } from './create-case-dialog/legal-process-section';
import { ApplicantScopeSection } from './create-case-dialog/applicant-scope-section';
import { IncomeSection } from './create-case-dialog/income-section';
import { LibranzasTab } from './edit-case-dialog/libranzas-tab';
import { SuspendedServicesTab } from './edit-case-dialog/suspended-services-tab';
import { DependentsTab } from './edit-case-dialog/dependents-tab';
import { PaymentProposalSection } from './create-case-dialog/payment-proposal-section';
import { LegalFoundationsSection } from './create-case-dialog/legal-foundations-section';
import { NotificationsSection } from './create-case-dialog/notifications-section';
import { SignatureSection } from './create-case-dialog/signature-section';
import { ConyugeDefinitivoSection } from './create-case-dialog/conyuge-definitivo-section';
import { InfoLaboralSection } from './create-case-dialog/info-laboral-section';
import { CesacionPagosSection } from './create-case-dialog/cesacion-pagos-section';
import { DeclaracionesSection } from './create-case-dialog/declaraciones-section';
import { ApoderadosTab } from './edit-case-dialog/apoderados-tab';

interface EditCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  case: CaseListItem;
  onCaseUpdated: () => void;
}

export function EditCaseDialog({
  open,
  onOpenChange,
  case: caseData,
  onCaseUpdated,
}: Readonly<EditCaseDialogProps>) {
  const [dataLoading, setDataLoading] = useState(false);
  const [debtors, setDebtors] = useState<DebtorOption[]>([]);
  const [operators, setOperators] = useState<AssignableOperator[]>([]);
  const [creditors, setCreditors] = useState<CreditorOption[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorOption | null>(
    null,
  );
  const [showCreateDebtorDialog, setShowCreateDebtorDialog] = useState(false);
  const [creatingDebtor, setCreatingDebtor] = useState(false);
  const [initializedCaseId, setInitializedCaseId] = useState<string | null>(
    null,
  );
  const documentsToUploadRef = useRef<
    Array<{ docName: string; files: File[] }>
  >([]);

  const form = useForm({
    resolver: zodResolver(updateCaseFormSchema),
    defaultValues: {
      id: caseData.id,
      debtorId: caseData.debtorId,
      type: caseData.type as
        | 'INSOLVENCY'
        | 'CONCILIATION'
        | 'SUPPORT_AGREEMENT',

      totalDebt: caseData.totalDebt.toString(),
      creditors: caseData.creditors,
      operatorId: caseData.operatorId,
      causes: caseData.causes ?? [],
      debts: [],
      assets: [],
      legalProcesses: [],
      phase: caseData.phase ?? 'Inicial',
      hearingDate: caseData.hearingDate
        ? caseData.hearingDate.toISOString().split('T')[0]
        : null,
    },
  });

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (
      open &&
      caseData &&
      (initializedCaseId !== caseData.id || !initializedCaseId)
    ) {
      const loadData = async () => {
        setDataLoading(true);
        try {
          const [debtorsResult, creditorsResult, caseResult, operatorsResult] =
            await Promise.all([
              getAllDebtors(),
              getAllCreditors(),
              getCaseById(caseData.id),
              // El dialogo de edicion no cargaba usuarios: no habia nada
              // que elegir. Ahora el operador se puede reasignar, que es
              // la unica via para corregir una asignacion vieja (#83).
              getAssignableOperators(),
            ]);
          setOperators(operatorsResult.data ?? []);
          setDebtors(
            (debtorsResult.data || []).map((debtor) => ({
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
            })),
          );
          setCreditors((creditorsResult.data || []) as CreditorOption[]);
          const fullCase = caseResult.data;
          if (fullCase) {
            setSelectedDebtorId(fullCase.debtorId);

            let caseTypeValue = '';
            if (fullCase.type === 'Insolvencia') caseTypeValue = 'INSOLVENCY';
            else if (fullCase.type === 'Conciliación')
              caseTypeValue = 'CONCILIATION';
            else if (fullCase.type === 'Acuerdo de Apoyo')
              caseTypeValue = 'SUPPORT_AGREEMENT';

            form.reset({
              id: fullCase.id,
              version: fullCase.version ?? 1,
              debtorId: fullCase.debtorId,
              type: caseTypeValue as
                | 'INSOLVENCY'
                | 'CONCILIATION'
                | 'SUPPORT_AGREEMENT',

              creditors: fullCase.creditors,
              debts: (fullCase.debts ?? []).map((debt) => ({
                id: debt.id,
                creditor: debt.creditor.name,
                creditorId: debt.creditorId,
                amount: debt.amount.toString(),
                type: debt.type,
                interestRate: debt.interestRate.toString(),
                creditorAddress: debt.creditorAddress ?? '',
                creditorCity: debt.creditorCity ?? '',
                creditorEmail: debt.creditorEmail ?? '',
                capitalAmount: debt.capitalAmount?.toString() ?? '',
                interestAmount: debt.interestAmount?.toString() ?? '',
                isDeferred: debt.isDeferred ?? false,
                documentType: debt.documentType ?? '',
                grantDate: debt.grantDate
                  ? debt.grantDate.toISOString().split('T')[0]
                  : '',
                dueDate: debt.dueDate
                  ? debt.dueDate.toISOString().split('T')[0]
                  : '',
                creditClassification: debt.creditClassification ?? '',
                hasActiveLibranza: debt.hasActiveLibranza ?? false,
                creditorClass: debt.creditorClass ?? '',
                percentageOfTotal: debt.percentageOfTotal?.toString() ?? '',
                daysOverdue: debt.daysOverdue ?? 0,
                coDebtorName: debt.coDebtorName ?? '',
                coDebtorCity: debt.coDebtorCity ?? '',
                coDebtorAddress: debt.coDebtorAddress ?? '',
                coDebtorPhone: debt.coDebtorPhone ?? '',
                coDebtorEmail: debt.coDebtorEmail ?? '',
              })),
              assets: (fullCase.assets ?? []).map((asset) => ({
                id: asset.id,
                name: asset.name,
                type: asset.type,
                value: asset.value.toString(),
                description: '',
                location: '',
                registrationNumber: '',
                encumbered: false,
                encumbranceDetails: '',
              })),
              phase: fullCase.phase ?? 'Inicial',
              hearingDate: fullCase.hearingDate
                ? fullCase.hearingDate.toISOString().split('T')[0]
                : null,

              // Ingresos y Gastos (from debtor)
              monthlyIncome: fullCase.debtor?.monthlyIncome?.toString() ?? '',
              monthlyExpenses:
                fullCase.debtor?.monthlyExpenses?.toString() ?? '',
              otherIncomeDescription:
                fullCase.debtor?.otherIncomeDescription ?? '',
              otherIncomeAmount:
                fullCase.debtor?.otherIncomeAmount?.toString() ?? '',
              hasEmployerCertification:
                fullCase.debtor?.hasEmployerCertification ?? false,

              // Libranzas
              libranzas: (fullCase.libranzas ?? []).map((libranza) => ({
                id: libranza.id,
                payerName: libranza.payerName,
                payerAddress: libranza.payerAddress ?? '',
                payerEmail: libranza.payerEmail ?? '',
                payerPhone: libranza.payerPhone ?? '',
                deductedAmount: libranza.deductedAmount.toString(),
                productAndCreditor: libranza.productAndCreditor ?? '',
              })),

              // Servicios Suspendidos
              suspendedServices: (fullCase.suspendedServices ?? []).map(
                (service) => ({
                  id: service.id,
                  creditorName: service.creditorName,
                  address: service.address ?? '',
                  email: service.email ?? '',
                  phone: service.phone ?? '',
                  suspendedProduct: service.suspendedProduct ?? '',
                  amountOwed: service.amountOwed.toString(),
                }),
              ),

              // Dependientes
              dependents: (fullCase.dependents ?? []).map((dependent) => ({
                id: dependent.id,
                name: dependent.name,
                age: dependent.age,
                relationship: dependent.relationship,
              })),

              // Procesos Judiciales
              legalProcesses: (fullCase.legalProcesses ?? []).map(
                (process) => ({
                  id: process.id,
                  processType: process.processType ?? '',
                  processTypeOther: process.processTypeOther ?? '',
                  plaintiff: process.plaintiff ?? '',
                  court: process.court ?? '',
                  courtEmail: process.courtEmail ?? '',
                  fileNumber: process.fileNumber ?? '',
                  precautionaryMeasure: process.precautionaryMeasure ?? '',
                }),
              ),

              // Apoderados — alta/baja vía ApoderadosTab, no edición en el
              // lugar (mismo criterio que libranzas/dependientes/procesos).
              apoderados: (fullCase.apoderados ?? []).map((apoderado) => ({
                id: apoderado.id,
                nombreCompleto: apoderado.nombreCompleto,
                tipoIdentificacion: apoderado.tipoIdentificacion ?? '',
                identificacion: apoderado.identificacion ?? '',
                tarjetaProfesional: apoderado.tarjetaProfesional ?? '',
                direccion: apoderado.direccion ?? '',
                telefono: apoderado.telefono ?? '',
                correo: apoderado.correo ?? '',
                existePoderOtorgado: apoderado.existePoderOtorgado ?? false,
              })),

              // Todo lo demás del caso (propuesta de pago, cónyuge, info
              // laboral, cesación de pagos, declaraciones, apoderado legacy,
              // tarifa, notificaciones, firma, etc.): se deriva de
              // GENERAL_SCALAR_FIELDS en vez de enumerarse a mano. Enumerar a
              // mano es exactamente cómo 19 campos de Sección III, 10 de
              // cónyuge, 6 de cesación, 8 de declaraciones, 8 del apoderado
              // legacy y `notificationCity`/`otherCauseDetail` quedaron
              // afuera sin que nada avisara (hallazgo de la auditoría
              // transversal, 2026-10-02).
              ...pickGeneralFields(
                fullCase as unknown as Record<string, unknown>,
              ),

              // Campos propios de Conciliacion y Acuerdo de Apoyo. Van por
              // prefijo y no enumerados: son 100 columnas y listarlas a mano
              // es como se llego a que ninguna estuviera (hallazgo A1).
              ...pickTypeSpecificFields(
                fullCase as unknown as Record<string, unknown>,
              ),
            });
            setInitializedCaseId(caseData.id);
          }
        } catch {
          toast.error('Error al cargar los datos');
        } finally {
          setDataLoading(false);
        }
      };
      void loadData();
    }
  }, [open, caseData, form, initializedCaseId]);

  useEffect(() => {
    if (!showCreateDebtorDialog && open) {
      const reloadDebtors = async () => {
        try {
          const debtorsResult = await getAllDebtors();
          setDebtors((debtorsResult.data || []) as DebtorOption[]);
        } catch {}
      };
      void reloadDebtors();
    }
  }, [showCreateDebtorDialog, open]);

  useEffect(() => {
    if (selectedDebtorId && debtors.length > 0) {
      const debtor = debtors.find(
        (d: DebtorOption) => d.id === selectedDebtorId,
      );
      if (debtor) {
        setSelectedDebtor(debtor);

        form.setValue('debtorId', debtor.id);
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

  const handleSubmit = (data: UpdateCaseFormData) => {
    startTransition(async () => {
      const creditorsCount = data.debts?.length ?? caseData.creditors;

      const submitData = {
        id: caseData.id,
        version: data.version,
        debtorId: data.debtorId,
        type: data.type,
        creditors: creditorsCount,
        hearingDate: data.hearingDate,
        phase: data.phase ?? undefined,

        // Ingresos y Gastos (update debtor separately if needed)
        monthlyIncome: data.monthlyIncome,
        monthlyExpenses: data.monthlyExpenses,
        otherIncomeDescription: data.otherIncomeDescription,
        otherIncomeAmount: data.otherIncomeAmount,
        hasEmployerCertification: data.hasEmployerCertification,

        // Libranzas
        libranzas: data.libranzas,

        // Servicios Suspendidos
        suspendedServices: data.suspendedServices,

        // Dependientes
        dependents: data.dependents,

        // Todo lo demás del caso (propuesta de pago, cónyuge, info laboral,
        // cesación de pagos, declaraciones, apoderado legacy, tarifa,
        // notificaciones, firma, etc.): se deriva de GENERAL_SCALAR_FIELDS en
        // vez de enumerarse a mano, mismo motivo que en el reset de arriba.
        ...pickGeneralValues(data as unknown as Record<string, unknown>),

        // Conciliacion y Acuerdo de Apoyo. Sin esto el payload no llevaba
        // ni un `conc*` ni un `apoyo*`, y como `updateCase` deja intacta la
        // columna ausente, esos campos eran de escritura unica: se cargaban
        // al crear el caso y no habia forma de corregirlos (hallazgo A1).
        ...pickTypeSpecificValues(data as unknown as Record<string, unknown>),
      };

      const { success, error } = await updateCase(submitData);

      if (success) {
        toast.success('Caso actualizado exitosamente');
        onCaseUpdated();
        onOpenChange(false);
        form.reset();

        // Upload documents if there are any
        if (documentsToUploadRef.current.length > 0) {
          try {
            const payload = {
              caseId: caseData.id,
              personName:
                (selectedDebtor?.name as string) || caseData.debtorName,
              documents: await Promise.all(
                documentsToUploadRef.current.flatMap(({ docName, files }) =>
                  files.map(async (f) => ({
                    docName,
                    fileName: f.name,
                    mimeType: f.type || 'application/pdf',
                    dataBase64: await fileToBase64(f),
                  })),
                ),
              ),
            } as const;

            // Temporary: uploadCaseDocuments hasn't been migrated yet
            await uploadCaseDocuments(payload);
          } catch {}
        }
      } else if (error?.includes('modificado por otro usuario')) {
        toast.error(
          'Este caso fue modificado por otro usuario. Recargue y vuelva a intentarlo.',
          { duration: 6000 },
        );
        onOpenChange(false);
      } else {
        toast.error(error ?? 'Error al actualizar el caso');
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
        (debtorsResult.data || []).map((debtor) => ({
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
        })),
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
      form.reset();
      setInitializedCaseId(null);
    }
  }, [open, form]);

  // Que pestañas mostrar. El dialogo era de insolvencia y nada mas: un caso
  // de conciliacion se abria con las 8 pestañas de insolvencia y ninguna de
  // las suyas (hallazgo A1).
  const tipoDelCaso = form.watch('type');
  const esConciliacion = tipoDelCaso === 'CONCILIATION';
  const esApoyo = tipoDelCaso === 'SUPPORT_AGREEMENT';
  const esInsolvencia = !esConciliacion && !esApoyo;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Editar Caso {caseData.caseNumber}</DialogTitle>
            <DialogDescription>
              Modifique la información del caso de {caseData.debtorName}. Los
              cambios se aplicarán inmediatamente.
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <Tabs defaultValue="debtor" className="space-y-4">
                <TabsList className="flex w-full flex-wrap gap-1">
                  <TabsTrigger value="debtor">1. Solicitante</TabsTrigger>
                  {esConciliacion && (
                    <>
                      <TabsTrigger value="conc-parties">2. Partes</TabsTrigger>
                      <TabsTrigger value="conc-details">
                        3. Conciliación
                      </TabsTrigger>
                    </>
                  )}
                  {esApoyo && (
                    <>
                      <TabsTrigger value="apoyo-parties">2. Partes</TabsTrigger>
                      <TabsTrigger value="apoyo-details">
                        3. Acuerdo de Apoyo
                      </TabsTrigger>
                    </>
                  )}
                  {esInsolvencia && (
                    <>
                      <TabsTrigger value="situation">2. Situación</TabsTrigger>
                      <TabsTrigger value="creditors">3. Acreedores</TabsTrigger>
                      <TabsTrigger value="assets">4. Bienes</TabsTrigger>
                      <TabsTrigger value="income">5. Ingresos</TabsTrigger>
                      <TabsTrigger value="proposal">6. Propuesta</TabsTrigger>
                      <TabsTrigger value="legal">7. Legal</TabsTrigger>
                    </>
                  )}
                  <TabsTrigger value="documents">
                    {esInsolvencia ? '8. Documentos' : '4. Documentos'}
                  </TabsTrigger>
                </TabsList>

                {/* Pestañas propias de Conciliación (hallazgo A1) */}
                {esConciliacion && (
                  <>
                    <TabsContent value="conc-parties" className="space-y-6">
                      <ConciliationPartiesSection />
                    </TabsContent>
                    <TabsContent value="conc-details" className="space-y-6">
                      <ConciliationDetailsSection />
                    </TabsContent>
                  </>
                )}

                {/* Pestañas propias de Acuerdo de Apoyo */}
                {esApoyo && (
                  <>
                    <TabsContent value="apoyo-parties" className="space-y-6">
                      <SupportAgreementPartiesSection />
                    </TabsContent>
                    <TabsContent value="apoyo-details" className="space-y-6">
                      <SupportAgreementDetailsSection />
                    </TabsContent>
                  </>
                )}

                {/* Tab 1: Solicitante — DebtorSection + ApplicantScopeSection + CaseDetailsSection */}
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
                  <div className="border-t pt-6">
                    <ApplicantScopeSection />
                  </div>
                  <div className="border-t pt-6">
                    <CaseDetailsSection
                      showFilingDate
                      operators={operators}
                      loadingOperators={dataLoading}
                    />
                  </div>
                </TabsContent>

                {/* Tab 2: Situación — ConyugeDefinitivoSection + InfoLaboralSection + CesacionPagosSection + LegalProcessSection */}
                <TabsContent value="situation" className="space-y-6">
                  <ConyugeDefinitivoSection />
                  <div className="border-t pt-6">
                    <InfoLaboralSection />
                  </div>
                  <div className="border-t pt-6">
                    <CesacionPagosSection />
                  </div>
                  <div className="border-t pt-6">
                    <LegalProcessSection />
                  </div>
                </TabsContent>

                {/* Tab 3: Acreedores — DebtsTab + LibranzasTab + SuspendedServicesTab */}
                <TabsContent value="creditors" className="space-y-6">
                  <DebtsTab caseId={caseData.id} creditors={creditors} />
                  <div className="border-t pt-6">
                    <LibranzasTab caseId={caseData.id} />
                  </div>
                  <div className="border-t pt-6">
                    <SuspendedServicesTab caseId={caseData.id} />
                  </div>
                </TabsContent>

                {/* Tab 4: Bienes — AssetsTab */}
                <TabsContent value="assets" className="space-y-6">
                  <AssetsTab caseId={caseData.id} />
                </TabsContent>

                {/* Tab 5: Ingresos — IncomeSection + DependentsTab */}
                <TabsContent value="income" className="space-y-6">
                  <IncomeSection />
                  <div className="border-t pt-6">
                    <DependentsTab caseId={caseData.id} />
                  </div>
                </TabsContent>

                {/* Tab 6: Propuesta — PaymentProposalSection */}
                <TabsContent value="proposal" className="space-y-6">
                  <PaymentProposalSection />
                </TabsContent>

                {/* Tab 7: Legal — DeclaracionesSection + LegalFoundationsSection + NotificationsSection + ApoderadosTab + SignatureSection */}
                <TabsContent value="legal" className="space-y-6">
                  <DeclaracionesSection />
                  <div className="border-t pt-6">
                    <LegalFoundationsSection />
                  </div>
                  <div className="border-t pt-6">
                    <NotificationsSection />
                  </div>
                  <div className="border-t pt-6">
                    <ApoderadosTab caseId={caseData.id} />
                  </div>
                  <div className="border-t pt-6">
                    <SignatureSection />
                  </div>
                </TabsContent>

                {/* Tab 8: Documentos — DocumentsSection (file upload) */}
                <TabsContent value="documents" className="space-y-6">
                  <DocumentsSection
                    onFilesSelected={(sel) => {
                      documentsToUploadRef.current = sel;
                    }}
                  />
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
                      Guardando Cambios...
                    </>
                  ) : (
                    'Guardar Cambios'
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
        creatingDebtor={creatingDebtor}
        onSubmit={handleCreateDebtor}
      />
    </>
  );
}
