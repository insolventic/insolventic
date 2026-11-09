'use client';

import { useEffect, useState, useTransition } from 'react';
import { ArchiveRestore, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getDeletedCases,
  purgeCase,
  restoreCase,
  type CasoEnPapelera,
} from '@/features/case/actions-papelera';
import { formatDateColombia } from '@/lib/date-colombia';

const TIPOS: Record<string, string> = {
  INSOLVENCY: 'Insolvencia',
  CONCILIATION: 'Conciliación',
  SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
};

interface PapeleraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `Eliminar casos definitivamente`: muestra el botón de borrado físico. */
  puedeEliminarDefinitivamente: boolean;
}

/**
 * Papelera de expedientes. La abre quien tiene `Eliminar casos`; restaurar
 * usa el mismo permiso. Eliminar definitivamente pide su propio permiso (solo
 * Administrador) y la misma confirmación escrita que mandar a la papelera.
 * Los permisos los vuelve a comprobar el servidor: esto solo decide qué se
 * muestra.
 */
export function PapeleraDialog({
  open,
  onOpenChange,
  puedeEliminarDefinitivamente,
}: Readonly<PapeleraDialogProps>) {
  const [casos, setCasos] = useState<CasoEnPapelera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aPurgar, setAPurgar] = useState<CasoEnPapelera | null>(null);
  const [confirmacion, setConfirmacion] = useState('');

  // Cada apertura vuelve a consultar y empieza sin confirmación a medias.
  useEffect(() => {
    if (!open) return;
    setCasos(null);
    setError(null);
    setAPurgar(null);
    setConfirmacion('');
    startTransition(async () => {
      const resultado = await getDeletedCases();
      if (resultado.success) {
        setCasos(resultado.data ?? []);
      } else {
        setCasos([]);
        setError(resultado.error ?? 'No se pudo cargar la papelera');
      }
    });
  }, [open]);

  const restaurar = (caso: CasoEnPapelera) => {
    startTransition(async () => {
      const { success, error: fallo } = await restoreCase({ id: caso.id });
      if (success) {
        toast.success('Caso restaurado', {
          description: `${caso.caseNumber} vuelve a estar en Gestión de Casos.`,
        });
        setCasos((actuales) =>
          (actuales ?? []).filter((c) => c.id !== caso.id),
        );
      } else {
        toast.error(fallo ?? 'No se pudo restaurar el caso');
      }
    });
  };

  const confirmacionCorrecta =
    aPurgar !== null && confirmacion.trim() === aPurgar.caseNumber;

  const purgar = () => {
    if (!aPurgar || !confirmacionCorrecta) return;
    const caso = aPurgar;
    startTransition(async () => {
      const { success, error: fallo } = await purgeCase({
        id: caso.id,
        confirmCaseNumber: confirmacion.trim(),
      });
      if (success) {
        toast.success('Caso eliminado definitivamente', {
          description: `${caso.caseNumber} ya no se puede recuperar.`,
        });
        setCasos((actuales) =>
          (actuales ?? []).filter((c) => c.id !== caso.id),
        );
        setAPurgar(null);
        setConfirmacion('');
      } else {
        toast.error(fallo ?? 'No se pudo eliminar el caso');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Papelera</DialogTitle>
          <DialogDescription>
            Casos eliminados. No aparecen en ninguna parte del sistema hasta que
            se restauran.
          </DialogDescription>
        </DialogHeader>

        {aPurgar ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
              <h4 className="font-medium text-red-900 dark:text-red-200">
                Eliminar definitivamente {aPurgar.caseNumber}
              </h4>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                Se borran el caso y todo lo que cuelga de él: deudas, bienes,
                documentos, pagos y avisos.{' '}
                <strong>No se puede deshacer.</strong> Úselo solo cuando
                corresponda una supresión de datos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-purga">
                Para confirmar, escriba el número del caso:{' '}
                <span className="font-mono font-semibold">
                  {aPurgar.caseNumber}
                </span>
              </Label>
              <Input
                id="confirmar-purga"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder={aPurgar.caseNumber}
                autoComplete="off"
                disabled={isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setAPurgar(null);
                  setConfirmacion('');
                }}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={purgar}
                disabled={isPending || !confirmacionCorrecta}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar definitivamente
              </Button>
            </DialogFooter>
          </div>
        ) : casos === null ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando la papelera...
          </div>
        ) : error ? (
          <p className="py-8 text-sm text-red-600">{error}</p>
        ) : casos.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">
            La papelera está vacía.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caso</TableHead>
                  <TableHead>Deudor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Eliminado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {casos.map((caso) => (
                  <TableRow key={caso.id}>
                    <TableCell className="font-mono">
                      {caso.caseNumber}
                    </TableCell>
                    <TableCell>{caso.debtorName}</TableCell>
                    <TableCell>{TIPOS[caso.type] ?? caso.type}</TableCell>
                    <TableCell className="text-sm">
                      {formatDateColombia(caso.deletedAt)}
                      {caso.deletedByName && (
                        <span className="text-muted-foreground block text-xs">
                          por {caso.deletedByName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => restaurar(caso)}
                        >
                          <ArchiveRestore className="mr-1 h-4 w-4" />
                          Restaurar
                        </Button>
                        {puedeEliminarDefinitivamente && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => {
                              setConfirmacion('');
                              setAPurgar(caso);
                            }}
                            aria-label={`Eliminar definitivamente ${caso.caseNumber}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
