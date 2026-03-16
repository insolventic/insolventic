'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { CaseWithRelations } from '@/features/case/schemas';

import { DebtorInfoSection } from './case-details-dialog/debtor-info-section';
import { CaseDetailsSection } from './case-details-dialog/case-details-section';
import { LegalProcessSection } from './case-details-dialog/legal-process-section';
import { CreditorsSection } from './case-details-dialog/creditors-section';
import { AssetsSection } from './case-details-dialog/assets-section';
import { IncomeSection } from './case-details-dialog/income-section';
import { PaymentSection } from './case-details-dialog/payment-section';
import { LegalFoundationsSection } from './case-details-dialog/legal-foundations-section';
import { DocumentsSection } from './case-details-dialog/documents-section';
import { DefinitivoSection } from './case-details-dialog/definitivo-section';

interface CaseDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  case: CaseWithRelations;
  loading?: boolean;
}

export function CaseDetailsDialog({
  open,
  onOpenChange,
  case: caseData,
  loading = false,
}: Readonly<CaseDetailsDialogProps>) {
  if (!caseData) return null;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cargando detalles del caso...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detalles del Caso {caseData?.id || 'N/A'}</DialogTitle>
          <DialogDescription>
            Información completa del caso de {caseData?.debtorName || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="debtor" className="space-y-4">
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="debtor">1. Solicitante</TabsTrigger>
            <TabsTrigger value="case-details">2. Detalles</TabsTrigger>
            <TabsTrigger value="legal-process">3. Proceso</TabsTrigger>
            <TabsTrigger value="creditors">4. Acreedores</TabsTrigger>
            <TabsTrigger value="assets">5. Bienes</TabsTrigger>
            <TabsTrigger value="income">6. Ingresos</TabsTrigger>
            <TabsTrigger value="payment">7. Propuesta</TabsTrigger>
            <TabsTrigger value="legal">8. Legal</TabsTrigger>
            <TabsTrigger value="documents">9. Documentos</TabsTrigger>
            <TabsTrigger value="definitivo" className="text-xs">
              10. Definitivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="debtor" className="space-y-4">
            <DebtorInfoSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="case-details" className="space-y-4">
            <CaseDetailsSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="legal-process" className="space-y-4">
            <LegalProcessSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="creditors" className="space-y-4">
            <CreditorsSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <AssetsSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <IncomeSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            <PaymentSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="legal" className="space-y-4">
            <LegalFoundationsSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsSection caseData={caseData} />
          </TabsContent>

          <TabsContent value="definitivo" className="space-y-4">
            <DefinitivoSection caseData={caseData} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
