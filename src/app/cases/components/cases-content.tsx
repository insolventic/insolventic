'use client';

import {
  ChevronDown,
  FileText,
  Handshake,
  HeartHandshake,
  Plus,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  TablePagination,
  usePagination,
} from '@/components/ui/table-pagination';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';

import { DashboardHeader } from '../../dashboard/components/dashboard-header';

import { CaseDetailsDialog } from './case-details-dialog';
import { CaseFilters } from './case-filters';
import { CaseStats } from './case-stats';
import { CaseTable } from './case-table';
import { CreateCaseDialog } from './create-case-dialog';
import { DeleteCaseDialog } from './delete-case-dialog';
import { EditCaseDialog } from './edit-case-dialog';
import { PhaseTransitionDialog } from './phase-transition-dialog';

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
  const searchParams = useSearchParams();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedCaseWithRelations, setSelectedCaseWithRelations] =
    useState<CaseWithRelations | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showComingSoonDialog, setShowComingSoonDialog] = useState<
    'conciliation' | 'support_agreement' | null
  >(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get('search') ?? '',
  );
  const [selectedPhase, setSelectedPhase] = useState('all');

  const { checkPermission } = useAuth();
  const canCreateCases = checkPermission(P.CREAR_CASOS);
  const [loadingCaseDetails, setLoadingCaseDetails] = useState(false);

  const filteredCases = cases.filter((caseItem) => {
    const matchesSearch =
      caseItem.debtorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.debtor.idNumber.includes(searchTerm);
    const matchesPhase =
      selectedPhase === 'all' ||
      (caseItem.phase ?? 'Inicial') === selectedPhase;
    return matchesSearch && matchesPhase;
  });

  const { paginatedItems: paginatedCases, paginationProps } = usePagination(
    filteredCases,
    20,
  );

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

  const changePhase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowPhaseDialog(true);
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!canCreateCases}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear nuevo caso
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setShowCreateDialog(true)}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Insolvencia
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowComingSoonDialog('conciliation')}
                  className="cursor-pointer"
                >
                  <Handshake className="mr-2 h-4 w-4" />
                  Conciliación
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowComingSoonDialog('support_agreement')}
                  className="cursor-pointer"
                >
                  <HeartHandshake className="mr-2 h-4 w-4" />
                  Acuerdos de apoyo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  selectedPhase={selectedPhase}
                  onPhaseChange={setSelectedPhase}
                />
              </div>
            </CardHeader>
            <CardContent>
              <CaseTable
                cases={paginatedCases}
                onViewDetails={openCaseDetails}
                onEdit={editCase}
                onDelete={deleteCase}
                onChangePhase={changePhase}
              />
              <TablePagination {...paginationProps} itemLabel="casos" />
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

      {selectedCase && (
        <PhaseTransitionDialog
          open={showPhaseDialog}
          onOpenChange={setShowPhaseDialog}
          caseId={selectedCase.id}
          caseNumber={selectedCase.caseNumber}
          currentPhase={selectedCase.phase}
        />
      )}

      <Dialog
        open={showComingSoonDialog !== null}
        onOpenChange={(open) => !open && setShowComingSoonDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showComingSoonDialog === 'conciliation'
                ? 'Conciliación'
                : 'Acuerdos de apoyo'}
            </DialogTitle>
            <DialogDescription>
              Este tipo de caso estará disponible próximamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12">
            {showComingSoonDialog === 'conciliation' ? (
              <Handshake className="text-muted-foreground mb-4 h-16 w-16" />
            ) : (
              <HeartHandshake className="text-muted-foreground mb-4 h-16 w-16" />
            )}
            <p className="text-muted-foreground text-lg font-medium">
              Próximamente...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
