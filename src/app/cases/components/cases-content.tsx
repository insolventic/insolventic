'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getCaseById } from '@/features/case/actions';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

import { DashboardHeader } from '../../dashboard/components/dashboard-header';

import { CaseDetailsDialog } from './case-details-dialog';
import { CaseFilters } from './case-filters';
import { CaseStats } from './case-stats';
import { CaseTable } from './case-table';
import { CreateCaseDialog } from './create-case-dialog';
import { DeleteCaseDialog } from './delete-case-dialog';
import { EditCaseDialog } from './edit-case-dialog';

import type {
  Case,
  CaseStats as CaseStatsType,
  CaseWithRelations,
} from '@/features/case/schemas';

interface CasesContentProps {
  cases: Case[];
  stats: CaseStatsType;
}

export function CasesContent({ cases, stats }: Readonly<CasesContentProps>) {
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedCaseWithRelations, setSelectedCaseWithRelations] =
    useState<CaseWithRelations | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { checkPermission } = useAuth();
  const canCreateCases = checkPermission('Crear casos');
  const [loadingCaseDetails, setLoadingCaseDetails] = useState(false);

  const filteredCases = cases.filter((caseItem) => {
    const matchesSearch =
      caseItem.debtorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.debtor.idNumber.includes(searchTerm);
    return matchesSearch;
  });

  const openCaseDetails = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    setLoadingCaseDetails(true);
    setShowDetailsDialog(true);

    try {
      const { success, data: fullCase, error } = await getCaseById(caseItem.id);
      if (success && fullCase) {
        setSelectedCaseWithRelations(fullCase);
      } else {
        toast.error(error ?? 'Error al cargar los detalles del caso');
      }
    } catch (error) {
      toast.error('Error al cargar los detalles del caso');
      console.error('Error fetching case details:', error);
    } finally {
      setLoadingCaseDetails(false);
    }
  };

  const editCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowEditDialog(true);
  };

  const deleteCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowDeleteDialog(true);
  };

  const handleCreateDialogChange = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      setSelectedCase(null);
    }
  };

  const handleEditDialogChange = (open: boolean) => {
    setShowEditDialog(open);
    if (!open) {
      setSelectedCase(null);
    }
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setShowDeleteDialog(open);
    if (!open) {
      setSelectedCase(null);
    }
  };

  const handleCaseCreated = () => {
    setShowCreateDialog(false);
  };

  const handleCaseUpdated = () => {
    setShowEditDialog(false);
    setSelectedCase(null);
  };

  const handleCaseDeleted = () => {
    setShowDeleteDialog(false);
    setSelectedCase(null);
  };

  return (
    <div className="bg-muted min-h-screen">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">
                Gestión de Casos
              </h1>
              <p className="text-muted-foreground">
                Administre casos de insolvencia, conciliación y acuerdos de
                apoyo
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={!canCreateCases}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Caso
            </Button>
          </div>

          <CaseStats stats={stats} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Casos Activos</CardTitle>
                  <CardDescription>
                    Lista completa de casos en el sistema
                  </CardDescription>
                </div>
                <CaseFilters
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                />
              </div>
            </CardHeader>
            <CardContent>
              <CaseTable
                cases={filteredCases}
                onViewDetails={openCaseDetails}
                onEdit={editCase}
                onDelete={deleteCase}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      {selectedCaseWithRelations && (
        <CaseDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          case={selectedCaseWithRelations}
          loading={loadingCaseDetails}
        />
      )}

      <CreateCaseDialog
        open={showCreateDialog}
        onOpenChange={handleCreateDialogChange}
        onCaseCreated={handleCaseCreated}
      />

      {selectedCase && (
        <EditCaseDialog
          open={showEditDialog}
          onOpenChange={handleEditDialogChange}
          case={selectedCase}
          onCaseUpdated={handleCaseUpdated}
        />
      )}

      {selectedCase && (
        <DeleteCaseDialog
          case={selectedCase}
          open={showDeleteDialog}
          onOpenChange={handleDeleteDialogChange}
          onCaseDeleted={handleCaseDeleted}
        />
      )}
    </div>
  );
}
