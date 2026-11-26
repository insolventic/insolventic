'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  aceptarDocumentosLegales,
  getAceptacionesPendientes,
} from '@/features/legal/actions';
import type {
  DocumentoLegal,
  VersionDocumentoLegal,
} from '@/features/legal/documentos';
import { logger } from '@/lib/logger';

/**
 * Usuario (`centro:id`) que ya está al día en esta pestaña. El header se monta
 * en cada página: sin esto, cada navegación consultaría la base de nuevo. Se
 * guarda por usuario para que cerrar sesión y entrar con otra cuenta en la
 * misma pestaña vuelva a preguntar.
 */
let alDiaEnEstaPestana: string | null = null;

/** Solo para tests: olvida quién estaba al día. */
export function _olvidarAceptacionEnPestana(): void {
  alDiaEnEstaPestana = null;
}

/**
 * Pide aceptar los términos y leer la política mientras la versión vigente de
 * alguno no esté aceptada (N-G-07). Bloquea: el diálogo no se cierra con
 * Escape ni con un clic afuera, y la única salida sin aceptar es cerrar
 * sesión.
 *
 * Falla abierto: si no se puede consultar qué falta, no muestra nada. Una
 * caída de la base no tiene que dejar a un centro sin trabajar.
 */
export function AceptacionTerminosGate({
  usuario,
  onLogout,
}: Readonly<{ usuario: string; onLogout: () => void }>) {
  const [pendientes, setPendientes] = useState<VersionDocumentoLegal[]>([]);
  // Ya se sabe si hay que pedir algo (con éxito o fallando abierto). Lo marca
  // en el DOM para que los E2E esperen la consulta en vez de un tiempo fijo.
  const [verificado, setVerificado] = useState(
    () => alDiaEnEstaPestana === usuario,
  );

  useEffect(() => {
    if (alDiaEnEstaPestana === usuario) {
      setVerificado(true);
      return;
    }
    let cancelado = false;
    setVerificado(false);
    getAceptacionesPendientes()
      .then((r) => {
        if (cancelado || !r.success) return;
        if (r.data.length === 0) alDiaEnEstaPestana = usuario;
        setPendientes(r.data);
      })
      .catch((error: unknown) => {
        logger.warn('No se pudo consultar la aceptación de términos', {
          action: 'aceptacion-legal-gate',
          reason: error instanceof Error ? error.message : 'unknown',
        });
      })
      .finally(() => {
        if (!cancelado) setVerificado(true);
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  return (
    <>
      {verificado && <span hidden data-aceptacion-terminos="verificada" />}
      <AceptacionTerminosDialog
        pendientes={pendientes}
        onActualizado={(restantes) => {
          if (restantes.length === 0) alDiaEnEstaPestana = usuario;
          setPendientes(restantes);
        }}
        onLogout={onLogout}
      />
    </>
  );
}

export function AceptacionTerminosDialog({
  pendientes,
  onActualizado,
  onLogout,
}: Readonly<{
  pendientes: VersionDocumentoLegal[];
  onActualizado: (restantes: VersionDocumentoLegal[]) => void;
  onLogout: () => void;
}>) {
  const open = pendientes.length > 0;
  const [marcados, setMarcados] = useState<Set<DocumentoLegal>>(new Set());
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada apertura empieza limpia (regla de formularios de CLAUDE.md).
  useEffect(() => {
    if (open) {
      setMarcados(new Set());
      setIntento(false);
      setError(null);
    }
  }, [open, pendientes]);

  const faltaMarcar = pendientes.some((p) => !marcados.has(p.documento));

  const alternar = (documento: DocumentoLegal, marcado: boolean) => {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(documento);
      else next.delete(documento);
      return next;
    });
  };

  const aceptar = async () => {
    setIntento(true);
    setError(null);
    if (faltaMarcar) return;

    setEnviando(true);
    try {
      const r = await aceptarDocumentosLegales({
        aceptados: pendientes.map((p) => ({
          documento: p.documento,
          version: p.version,
        })),
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      if (r.data.length === 0) toast.success('Aceptación registrada');
      onActualizado(r.data);
    } catch {
      setError('No se pudo registrar la aceptación. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="aceptacion-terminos"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Términos de uso y política de privacidad
          </DialogTitle>
          <DialogDescription>
            Para usar INSOLVENTIC tiene que aceptar la versión vigente de estos
            documentos. Queda registrado con su usuario, la versión y la fecha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pendientes.map((doc) => {
            const id = `aceptar-${doc.documento}`;
            const invalido = intento && !marcados.has(doc.documento);
            return (
              <div
                key={doc.documento}
                className="space-y-2 rounded-md border p-3"
              >
                <a
                  href={doc.ruta}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  {doc.titulo}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-muted-foreground text-xs">
                  Versión del {doc.version}
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={id}
                    checked={marcados.has(doc.documento)}
                    onCheckedChange={(v) => alternar(doc.documento, v === true)}
                    aria-invalid={invalido || undefined}
                  />
                  <Label
                    htmlFor={id}
                    className="text-sm leading-snug font-normal"
                  >
                    {doc.casilla}
                  </Label>
                </div>
              </div>
            );
          })}

          {intento && faltaMarcar && (
            <p className="text-destructive text-sm" role="alert">
              Marque las casillas para continuar.
            </p>
          )}
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onLogout}>
            Cerrar sesión
          </Button>
          <Button type="button" onClick={aceptar} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Aceptar y continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
