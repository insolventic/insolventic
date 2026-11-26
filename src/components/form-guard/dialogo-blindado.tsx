'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Diálogo para formularios largos que no se pierde por accidente.
 *
 * - `DialogBlindado` reemplaza a `Dialog`: todo intento de cierre que pase por
 *   Radix (la X, un `DialogClose` como el botón "Cancelar") se intercepta; si el
 *   formulario declaró cambios sin guardar, pide confirmación antes de cerrar.
 *   Los cierres programáticos del propio formulario (tras guardar con éxito,
 *   `onOpenChange(false)`) no pasan por aquí.
 * - `DialogContentBlindado` reemplaza a `DialogContent`: no cierra con clic
 *   fuera ni con Esc. Un Esc dentro de un Select o Popover lo atiende esa capa
 *   y nunca llega al diálogo.
 * - Mientras haya cambios, cerrar o recargar la pestaña pide confirmación del
 *   navegador (`beforeunload`).
 *
 * El formulario declara sus cambios con `useCambiosSinGuardar(hayCambios)`.
 * Fuera de un `DialogBlindado` (p. ej. si mañana el formulario vive en una
 * página) ese hook no hace nada: el contenido no depende del contenedor.
 */

interface ContextoBlindaje {
  setHayCambios: (valor: boolean) => void;
  intentarCerrar: () => void;
}

const BlindajeContext = React.createContext<ContextoBlindaje | null>(null);

/** El formulario informa si tiene cambios sin guardar. */
export function useCambiosSinGuardar(hayCambios: boolean): void {
  const ctx = React.useContext(BlindajeContext);
  const setHayCambios = ctx?.setHayCambios;
  React.useEffect(() => {
    setHayCambios?.(hayCambios);
  }, [setHayCambios, hayCambios]);
  React.useEffect(
    () => () => {
      setHayCambios?.(false);
    },
    [setHayCambios],
  );
}

/** Cierre que respeta la confirmación (para botones propios del formulario). */
export function useIntentarCerrar(): (() => void) | null {
  return React.useContext(BlindajeContext)?.intentarCerrar ?? null;
}

/** Pide confirmación del navegador al cerrar o recargar la pestaña. */
export function useAvisoAntesDeSalir(activo: boolean): void {
  React.useEffect(() => {
    if (!activo) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Requerido por algunos navegadores para mostrar el aviso.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [activo]);
}

export function DialogBlindado({
  open,
  onOpenChange,
  hayCambios: hayCambiosProp = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Cambios sin guardar, para los diálogos cuyo formulario vive en el mismo
   * componente que el diálogo (ahí `useCambiosSinGuardar` no alcanza al
   * contexto). Se suma a lo que informe el contenido.
   */
  hayCambios?: boolean;
  children: React.ReactNode;
}) {
  const [hayCambiosContenido, setHayCambios] = React.useState(false);
  const hayCambios = hayCambiosProp || hayCambiosContenido;
  const [confirmando, setConfirmando] = React.useState(false);
  const hayCambiosRef = React.useRef(false);
  hayCambiosRef.current = hayCambios;

  const intentarCerrar = React.useCallback(() => {
    if (hayCambiosRef.current) setConfirmando(true);
    else onOpenChange(false);
  }, [onOpenChange]);

  const contexto = React.useMemo(
    () => ({ setHayCambios, intentarCerrar }),
    [intentarCerrar],
  );

  useAvisoAntesDeSalir(open && hayCambios);

  return (
    <BlindajeContext.Provider value={contexto}>
      <Dialog
        open={open}
        onOpenChange={(abierto) => {
          if (abierto) onOpenChange(true);
          else intentarCerrar();
        }}
      >
        {children}
      </Dialog>
      <ConfirmarSalida
        abierto={confirmando}
        onSeguir={() => setConfirmando(false)}
        onSalir={() => {
          setConfirmando(false);
          setHayCambios(false);
          onOpenChange(false);
        }}
      />
    </BlindajeContext.Provider>
  );
}

export function DialogContentBlindado({
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      {...props}
      onInteractOutside={(e) => {
        e.preventDefault();
        onInteractOutside?.(e);
      }}
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        onEscapeKeyDown?.(e);
      }}
    />
  );
}

function ConfirmarSalida({
  abierto,
  onSeguir,
  onSalir,
}: {
  abierto: boolean;
  onSeguir: () => void;
  onSalir: () => void;
}) {
  const seguirRef = React.useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) onSeguir();
      }}
    >
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // El foco va a la opción segura.
          e.preventDefault();
          seguirRef.current?.focus();
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>¿Salir sin guardar?</DialogTitle>
          <DialogDescription>
            Los cambios no se han guardado en el sistema. Se conserva un
            borrador en este navegador durante 48 horas, que podrás restaurar al
            volver a abrir el formulario.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onSalir}>
            Salir
          </Button>
          <Button ref={seguirRef} type="button" onClick={onSeguir}>
            Seguir editando
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
