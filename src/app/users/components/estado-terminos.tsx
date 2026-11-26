'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  getEstadoAceptacionesDelCentro,
  type EstadoAceptacionUsuario,
} from '@/features/legal/actions';
import { DOCUMENTOS_LEGALES } from '@/features/legal/documentos';

/**
 * Estado de aceptación de términos de cada usuario del centro, por `userId`.
 * `null` mientras carga o si no se pudo leer (la columna muestra "—").
 */
export function useEstadoTerminosDelCentro(habilitado: boolean) {
  const [estado, setEstado] = useState<Record<
    string,
    EstadoAceptacionUsuario
  > | null>(null);

  useEffect(() => {
    if (!habilitado) return;
    getEstadoAceptacionesDelCentro()
      .then((r) => {
        if (r.success) setEstado(r.data);
      })
      .catch(() => undefined);
  }, [habilitado]);

  return estado;
}

const ETIQUETA_DOC = { terminos: 'Términos', privacidad: 'Privacidad' };
const ETIQUETA_ESTADO = {
  'al-dia': 'aceptada',
  'version-anterior': 'versión anterior',
  pendiente: 'pendiente',
};

export function EstadoTerminosCelda({
  estado,
  cargado,
}: Readonly<{
  estado: EstadoAceptacionUsuario | undefined;
  cargado: boolean;
}>) {
  if (!cargado) return <span className="text-muted-foreground">—</span>;

  if (!estado) {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700">
        Pendiente
      </Badge>
    );
  }

  return (
    <div className="space-y-1">
      {estado.alDia ? (
        <Badge variant="outline" className="border-green-500 text-green-700">
          Al día
        </Badge>
      ) : (
        <Badge variant="outline" className="border-amber-400 text-amber-700">
          Pendiente
        </Badge>
      )}
      {DOCUMENTOS_LEGALES.map((doc) => {
        const d = estado[doc];
        return (
          <p key={doc} className="text-muted-foreground text-xs">
            {ETIQUETA_DOC[doc]}: {ETIQUETA_ESTADO[d.estado]}
            {d.version && d.aceptadoEn && (
              <>
                {' '}
                (v. {d.version},{' '}
                {new Date(d.aceptadoEn).toLocaleDateString('es-CO')})
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}
