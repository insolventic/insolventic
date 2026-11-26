'use client';

import { useEffect, useState } from 'react';
import { FileCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getMisAceptaciones,
  type AceptacionDelUsuario,
} from '@/features/legal/actions';

/** Historial propio de aceptaciones de términos y lecturas de la política. */
export function HistorialAceptaciones() {
  const [filas, setFilas] = useState<AceptacionDelUsuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMisAceptaciones()
      .then((r) => {
        if (r.success) setFilas(r.data);
        else setError(r.error);
      })
      .catch(() => setError('No se pudo leer el historial.'));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Términos y privacidad
        </CardTitle>
        <CardDescription>
          Versiones que aceptó de los{' '}
          <a href="/terminos" className="text-primary hover:underline">
            términos de uso
          </a>{' '}
          y de la{' '}
          <a href="/privacidad" className="text-primary hover:underline">
            política de privacidad
          </a>
          . Este registro no se puede modificar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!error && filas === null && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {filas?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Todavía no hay aceptaciones registradas.
          </p>
        )}
        {filas && filas.length > 0 && (
          <ul className="divide-y" data-testid="historial-aceptaciones">
            {filas.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{f.titulo}</p>
                  <p className="text-muted-foreground">
                    Versión del {f.version} · aceptada el{' '}
                    {new Date(f.aceptadoEn).toLocaleString('es-CO')}
                  </p>
                </div>
                {f.vigente ? (
                  <Badge variant="outline">Vigente</Badge>
                ) : (
                  <Badge variant="secondary">Versión anterior</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
