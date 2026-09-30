'use client';

import { useTransition } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { deleteCase } from '@/features/case/actions';

import type { CaseListItem } from '@/features/case/schemas';

interface DeleteCaseDialogProps {
  case: CaseListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseDeleted?: () => void;
}

export function DeleteCaseDialog({
  case: caseData,
  open,
  onOpenChange,
  onCaseDeleted,
}: Readonly<DeleteCaseDialogProps>) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const { success, error } = await deleteCase({ id: caseData.id });

      if (success) {
        toast.success('Caso eliminado exitosamente', {
          description: `El caso ${caseData.caseNumber} ha sido eliminado correctamente`,
        });
        onOpenChange(false);
        onCaseDeleted?.();
      } else {
        toast.error(error ?? 'Error al eliminar el caso');
      }
    });
  };

  const hasDocuments = (caseData._count?.documents ?? 0) > 0;
  const hasAssets = false;
  const hasDebts = false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Caso</DialogTitle>
          </div>
          <DialogDescription>
            ¿Está seguro de que desea eliminar el caso {caseData.caseNumber}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
            <h4 className="font-medium text-red-900">Información del Caso</h4>
            <div className="mt-2 space-y-1 text-sm text-red-700">
              <p>
                <strong>Caso:</strong> {caseData.caseNumber}
              </p>
              <p>
                <strong>Deudor:</strong> {caseData.debtorName}
              </p>
              <p>
                <strong>Tipo:</strong> {caseData.type}
              </p>
              <p></p>
              <p>
                <strong>Deuda Total:</strong> $
                {caseData.totalDebt.toLocaleString()}
              </p>
            </div>
          </div>

          {(hasDocuments || hasAssets || hasDebts) && (
            <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
              <h4 className="font-medium text-yellow-900">Advertencia</h4>
              <p className="mt-1 text-sm text-yellow-700">
                Este caso tiene información asociada que también será eliminada:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-yellow-700">
                {hasDocuments && (
                  <li>• {caseData._count.documents} documento(s)</li>
                )}
                {hasAssets && <li>• Activos asociados</li>}
                {hasDebts && <li>• Deudas asociadas</li>}
              </ul>
            </div>
          )}

          <div className="bg-muted rounded-lg p-4">
            <p className="text-muted-foreground text-sm">
              <strong>Nota:</strong> Esta acción no se puede deshacer. Una vez
              eliminado, toda la información del caso se perderá
              permanentemente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar Caso'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
