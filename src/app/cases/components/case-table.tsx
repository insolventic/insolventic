'use client';

import { Eye, Edit, Trash2, ArrowRightLeft, FolderOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';
import { getPhaseBadgeClass, getPhaseLabel } from '@/lib/case-phases';

import type { CaseListItem } from '@/features/case/schemas';

interface CaseTableProps {
  cases: CaseListItem[];
  onViewDetails: (caseItem: CaseListItem) => void;
  onEdit: (caseItem: CaseListItem) => void;
  onDelete: (caseItem: CaseListItem) => void;
  onChangePhase?: (caseItem: CaseListItem) => void;
  isLoading?: boolean;
}

export function CaseTable({
  cases,
  onViewDetails,
  onEdit,
  onDelete,
  onChangePhase,
  isLoading = false,
}: Readonly<CaseTableProps>) {
  const { checkPermission } = useAuth();

  const canViewCases = checkPermission(P.VER_CASOS);
  const canEditCases = checkPermission(P.EDITAR_CASOS);
  const canDeleteCases = checkPermission(P.ELIMINAR_CASOS);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Insolvencia':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'Conciliación':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Acuerdo de Apoyo':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const formatIdNumber = (idNumber: string) => {
    const cleaned = idNumber.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) {
      return `${cleaned.slice(0, -3)}.${cleaned.slice(-3)}`;
    }
    return `${cleaned.slice(0, -6)}.${cleaned.slice(-6, -3)}.${cleaned.slice(-3)}`;
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Caso</TableHead>
              <TableHead>Deudor</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Monto Total</TableHead>
              <TableHead>Acreedores</TableHead>
              <TableHead>Próxima Audiencia</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Caso</TableHead>
            <TableHead>Deudor</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Monto Total</TableHead>
            <TableHead>Acreedores</TableHead>
            <TableHead>Próxima Audiencia</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2">
                  <FolderOpen className="text-muted-foreground h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    No se encontraron casos
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {cases.map((caseItem) => (
            <TableRow key={caseItem.id}>
              <TableCell className="font-medium">
                {caseItem.caseNumber}
              </TableCell>
              <TableCell>{caseItem.debtorName}</TableCell>
              <TableCell>{formatIdNumber(caseItem.debtor.idNumber)}</TableCell>
              <TableCell>
                <Badge className={getTypeColor(caseItem.type)}>
                  {caseItem.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={getPhaseBadgeClass(caseItem.phase)}>
                  {getPhaseLabel(caseItem.phase)}
                </Badge>
              </TableCell>
              <TableCell>{formatCurrency(caseItem.totalDebt)}</TableCell>
              <TableCell>{caseItem.creditors}</TableCell>
              <TableCell>
                {caseItem.hearingDate
                  ? new Date(caseItem.hearingDate).toLocaleDateString('es-CO')
                  : 'No programada'}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(caseItem)}
                    title="Ver detalles"
                    disabled={!canViewCases}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(caseItem)}
                    title="Editar caso"
                    disabled={!canEditCases}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {onChangePhase && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChangePhase(caseItem)}
                      title="Cambiar fase"
                      disabled={!canEditCases}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(caseItem)}
                    title="Eliminar caso"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                    disabled={!canDeleteCases}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
