'use client';

import {
  ChevronDown,
  FileText,
  Handshake,
  HeartHandshake,
  Plus,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
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
import { TablePagination } from '@/components/ui/table-pagination';
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

import { CASES_PAGE_SIZE_OPTIONS } from '@/features/case/schemas';

import type {
  CaseListItem,
  CasesPage,
  CaseStats as CaseStatsType,
  CaseWithRelations,
} from '@/features/case/schemas';

interface CasesContentProps {
  /** Una página del listado, ya filtrada por el servidor. */
  casesPage: CasesPage;
  /** Los filtros con los que el servidor armó esa página (vienen de la URL). */
  filtros: { search: string; phase: string; type: string };
  stats: CaseStatsType;
}

/** Cuánto se espera después de la última tecla antes de consultar. */
const DEBOUNCE_BUSQUEDA_MS = 350;

export function CasesContent({
  casesPage,
  filtros,
  stats,
}: Readonly<CasesContentProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedCase, setSelectedCase] = useState<CaseListItem | null>(null);
  const [selectedCaseWithRelations, setSelectedCaseWithRelations] =
    useState<CaseWithRelations | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<
    'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT'
  >('INSOLVENCY');
  const [showComingSoonDialog, setShowComingSoonDialog] = useState<
    'conciliation' | 'support_agreement' | null
  >(null);

  const openCreateDialog = (
    type: 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT',
  ) => {
    setCreateDialogType(type);
    setShowCreateDialog(true);
  };
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  // El input es local para que escribir no espere al servidor; lo que viaja a
  // la URL va con debounce. `filtros.search` es lo último que el servidor
  // aplicó, así que comparar contra eso evita navegar al montar y después de
  // cada navegación.
  const [searchTerm, setSearchTerm] = useState(filtros.search);

  const { checkPermission } = useAuth();
  const canCreateCases = checkPermission(P.CREAR_CASOS);
  const [loadingCaseDetails, setLoadingCaseDetails] = useState(false);

  /**
   * Escribe los filtros en la URL y deja que el servidor traiga la página.
   *
   * Un valor vacío o `'all'` borra el parámetro en vez de escribirlo: así la
   * URL del listado sin filtros queda limpia y el `?search=` que ya se usaba
   * sigue significando lo mismo.
   *
   * `navegacion`: cambiar de página va con `push`, porque el "atrás" del
   * navegador tiene que devolver a la página anterior de la tabla. Tipear en el
   * buscador va con `replace`, o el historial se llena de una entrada por
   * letra.
   */
  const aplicar = (
    cambios: Record<string, string | number | null>,
    navegacion: 'push' | 'replace' = 'replace',
  ) => {
    const qs = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === '' || valor === 'all') {
        qs.delete(clave);
      } else {
        qs.set(clave, String(valor));
      }
    }
    const query = qs.toString();
    const destino = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      if (navegacion === 'push') {
        router.push(destino, { scroll: false });
      } else {
        router.replace(destino, { scroll: false });
      }
    });
  };

  useEffect(() => {
    if (searchTerm === filtros.search) return;
    const id = setTimeout(
      () => aplicar({ search: searchTerm, page: null }),
      DEBOUNCE_BUSQUEDA_MS,
    );
    return () => clearTimeout(id);
    // `aplicar` se recrea en cada render; depender de él reprogramaría el
    // timer sin parar. Lo que importa es el texto y lo ya aplicado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filtros.search]);

  const paginatedCases = casesPage.items;

  const openCaseDetails = async (caseItem: CaseListItem) => {
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

  const editCase = (caseItem: CaseListItem) => {
    setSelectedCase(caseItem);
    setShowEditDialog(true);
  };

  const deleteCase = (caseItem: CaseListItem) => {
    setSelectedCase(caseItem);
    setShowDeleteDialog(true);
  };

  const changePhase = (caseItem: CaseListItem) => {
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
                  onClick={() => openCreateDialog('INSOLVENCY')}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Insolvencia
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openCreateDialog('CONCILIATION')}
                  className="cursor-pointer"
                >
                  <Handshake className="mr-2 h-4 w-4" />
                  Conciliación
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openCreateDialog('SUPPORT_AGREEMENT')}
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
                  selectedPhase={filtros.phase}
                  onPhaseChange={(valor) =>
                    aplicar({ phase: valor, page: null })
                  }
                  selectedType={filtros.type}
                  onTypeChange={(valor) => aplicar({ type: valor, page: null })}
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* `aria-busy` + opacidad: la tabla se repinta con datos del
                  servidor, y sin señal el cambio de página se siente colgado. */}
              <div
                aria-busy={isPending}
                className={isPending ? 'opacity-60 transition-opacity' : ''}
              >
                <CaseTable
                  cases={paginatedCases}
                  onViewDetails={openCaseDetails}
                  onEdit={editCase}
                  onDelete={deleteCase}
                  onChangePhase={changePhase}
                />
              </div>
              <TablePagination
                currentPage={casesPage.page}
                totalItems={casesPage.total}
                pageSize={casesPage.pageSize}
                onPageChange={(pagina) => aplicar({ page: pagina }, 'push')}
                onPageSizeChange={(tamanio) =>
                  aplicar({ pageSize: tamanio, page: null })
                }
                pageSizeOptions={[...CASES_PAGE_SIZE_OPTIONS]}
                itemLabel="casos"
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
        initialType={createDialogType}
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
