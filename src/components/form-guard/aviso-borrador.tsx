'use client';

import { History, Paperclip, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { EstadoBorrador } from '@/hooks/use-borrador-formulario';

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * Aviso al abrir un formulario con un borrador guardado: "Restaurar" o
 * "Empezar de cero". Después de restaurar, recuerda qué adjuntos hay que volver
 * a cargar (los archivos no se guardan en el borrador).
 */
export function AvisoBorrador({ borrador }: { borrador: EstadoBorrador }) {
  if (borrador.pendiente) {
    const { guardadoEn, adjuntos } = borrador.pendiente;
    return (
      <Alert role="status" aria-live="polite" data-testid="aviso-borrador">
        <History className="h-4 w-4" aria-hidden="true" />
        <AlertTitle className="line-clamp-none">
          Tienes un borrador sin guardar de {formatoFecha.format(guardadoEn)}
        </AlertTitle>
        <AlertDescription>
          <p>
            Se guardó automáticamente en este navegador. Puedes continuar donde
            lo dejaste o empezar con el formulario vacío.
            {adjuntos.length > 0 &&
              ' Los archivos adjuntos no se guardan: tendrás que volver a cargarlos.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={borrador.restaurar}>
              Restaurar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={borrador.empezarDeCero}
            >
              Empezar de cero
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (borrador.adjuntosPorRecargar.length > 0) {
    return (
      <Alert role="status" aria-live="polite">
        <Paperclip className="h-4 w-4" aria-hidden="true" />
        <AlertTitle className="line-clamp-none">Borrador restaurado</AlertTitle>
        <AlertDescription>
          Vuelve a cargar estos archivos, que no se guardan en el borrador:{' '}
          {borrador.adjuntosPorRecargar.join(', ')}.
        </AlertDescription>
      </Alert>
    );
  }

  if (borrador.descartadoPorVersion) {
    return (
      <Alert role="status" aria-live="polite">
        <History className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          Se descartó un borrador anterior porque el registro o el formulario
          cambiaron desde que se guardó.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/** Botón explícito para borrar el borrador guardado y volver a empezar. */
export function BotonDescartarBorrador({
  borrador,
}: {
  borrador: EstadoBorrador;
}) {
  if (!borrador.hayBorradorGuardado || borrador.pendiente) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={borrador.descartar}
      className="text-muted-foreground mr-auto"
    >
      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
      Descartar borrador
    </Button>
  );
}
