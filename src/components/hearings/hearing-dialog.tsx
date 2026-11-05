'use client';

import { useEffect, useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelarAudiencia,
  programarAudiencia,
} from '@/features/calendar/actions';
import {
  claveDia,
  formatearAudiencia,
  hoyColombia,
  type Audiencia,
} from '@/features/calendar/audiencia';
import {
  datosAudienciaSchema,
  type DatosAudiencia,
} from '@/features/calendar/schemas';

interface HearingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  version?: number;
  /** La audiencia vigente del caso; `null` si no tiene ninguna. */
  audiencia: Audiencia | null;
  onSaved?: () => void;
}

export function HearingDialog({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  version,
  audiencia,
  onSaved,
}: Readonly<HearingDialogProps>) {
  const [isPending, startTransition] = useTransition();
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

  const form = useForm<DatosAudiencia>({
    resolver: zodResolver(datosAudienciaSchema),
    mode: 'onTouched',
    defaultValues: { fecha: '', hora: '' },
  });
  const { errors } = form.formState;

  // El formulario vive fuera de DialogContent y sobrevive al cierre: cada
  // apertura arranca limpia, con la audiencia que el caso tiene ahora.
  const fechaInicial = audiencia ? claveDia(new Date(audiencia.fecha)) : '';
  const horaInicial = audiencia?.hora ?? '';
  useEffect(() => {
    if (open) {
      form.reset({ fecha: fechaInicial, hora: horaInicial });
      setConfirmandoCancelacion(false);
    }
  }, [open, fechaInicial, horaInicial, form]);

  const fecha = form.watch('fecha');
  const fechaPasada = Boolean(fecha) && fecha < hoyColombia();

  const terminar = (mensaje: string) => {
    toast.success(mensaje);
    onSaved?.();
    onOpenChange(false);
  };

  const guardar = (datos: DatosAudiencia) => {
    startTransition(async () => {
      const resultado = await programarAudiencia({
        caseId,
        version,
        ...datos,
      });
      if (resultado.success) {
        terminar(audiencia ? 'Audiencia reprogramada' : 'Audiencia programada');
      } else {
        toast.error(resultado.error ?? 'Error al programar la audiencia');
      }
    });
  };

  const cancelar = () => {
    startTransition(async () => {
      const resultado = await cancelarAudiencia({ caseId, version });
      if (resultado.success) {
        terminar(
          resultado.faseNueva
            ? `Audiencia cancelada. El caso volvió a "${resultado.faseNueva}".`
            : 'Audiencia cancelada',
        );
      } else {
        toast.error(resultado.error ?? 'Error al cancelar la audiencia');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {audiencia ? 'Reprogramar audiencia' : 'Programar audiencia'}
          </DialogTitle>
          <DialogDescription>
            Caso {caseNumber}
            {audiencia &&
              ` · Audiencia actual: ${formatearAudiencia(audiencia)}`}
          </DialogDescription>
        </DialogHeader>

        <form
          id="hearing-form"
          onSubmit={form.handleSubmit(guardar)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hearing-fecha">Fecha *</Label>
              <Input
                id="hearing-fecha"
                type="date"
                aria-invalid={Boolean(errors.fecha)}
                {...form.register('fecha')}
              />
              {errors.fecha && (
                <p className="text-destructive text-sm">
                  {errors.fecha.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hearing-hora">Hora *</Label>
              <Input
                id="hearing-hora"
                type="time"
                aria-invalid={Boolean(errors.hora)}
                {...form.register('hora')}
              />
              {errors.hora && (
                <p className="text-destructive text-sm">
                  {errors.hora.message}
                </p>
              )}
            </div>
          </div>

          {fechaPasada && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Esta fecha ya pasó. Se guardará como registro, pero no generará
              alertas.
            </p>
          )}
        </form>

        {confirmandoCancelacion && (
          <p className="text-sm">
            ¿Cancelar la audiencia de este caso? Dejará de aparecer en el
            calendario y en las alertas.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {confirmandoCancelacion ? (
            <>
              <Button
                key="volver"
                type="button"
                variant="outline"
                onClick={() => setConfirmandoCancelacion(false)}
                disabled={isPending}
              >
                Volver
              </Button>
              <Button
                key="confirmar-cancelacion"
                type="button"
                variant="destructive"
                onClick={cancelar}
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sí, cancelar audiencia
              </Button>
            </>
          ) : (
            <>
              {audiencia ? (
                <Button
                  key="cancelar-audiencia"
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmandoCancelacion(true)}
                  disabled={isPending}
                >
                  Cancelar audiencia
                </Button>
              ) : (
                <span />
              )}
              <Button
                key="guardar"
                type="submit"
                form="hearing-form"
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
