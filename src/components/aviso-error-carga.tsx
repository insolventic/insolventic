'use client';

import { AlertCircle, Loader2, RotateCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface AvisoErrorCargaProps {
  titulo: string;
  descripcion?: string;
  onReintentar: () => void;
  reintentando?: boolean;
  className?: string;
}

/**
 * Aviso de "no se pudo cargar" con botón para reintentar.
 *
 * Existe para que una pantalla que lista algo no confunda un fallo de carga
 * con una lista vacía (el bug de `/cases` mostrando "Total Casos 0"). El
 * texto es siempre fijo: el `error` que devuelven las acciones puede ser el
 * mensaje crudo de Prisma, y eso va al log, no al usuario.
 */
export function AvisoErrorCarga({
  titulo,
  descripcion = 'Ocurrió un problema al consultar la información. Intente de nuevo en unos segundos; si el problema continúa, avise al administrador del sistema.',
  onReintentar,
  reintentando = false,
  className,
}: Readonly<AvisoErrorCargaProps>) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription>
        <p>{descripcion}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onReintentar}
          disabled={reintentando}
        >
          {reintentando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="mr-2 h-4 w-4" />
          )}
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
