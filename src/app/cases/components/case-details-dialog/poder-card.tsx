'use client';

import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileSignature,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  PIEZAS_PODER,
  estadoDelPoder,
  type DocumentoDelCaso,
} from '@/features/case/poder';

/**
 * Estado del Poder en el detalle del caso: las dos piezas, cuáles están
 * cargadas y un enlace a cada archivo. Un poder subido como anexo único
 * (formato anterior) se muestra y cuenta como "poder firmado".
 */
export function PoderCard({
  documentos,
}: {
  documentos: readonly DocumentoDelCaso[];
}) {
  const estado = estadoDelPoder(documentos);
  const [captura, firmado] = PIEZAS_PODER;
  const filas = [
    { pieza: captura, docs: estado.capturaCorreo },
    { pieza: firmado, docs: [...estado.firmado, ...estado.firmadoAnterior] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileSignature className="h-5 w-5" aria-hidden="true" />
          Poder
          <Badge
            className={
              estado.completo
                ? 'bg-green-600 text-white hover:bg-green-600'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100'
            }
          >
            {estado.completo ? 'Completo' : 'Incompleto'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Se compone de dos archivos; está completo cuando se cargaron los dos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {filas.map(({ pieza, docs }) => (
            <li key={pieza.id} className="rounded border p-2">
              <div className="flex items-start gap-2">
                {docs.length > 0 ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleDashed
                    className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{pieza.nombre}</p>
                  {docs.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Sin cargar</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {docs.map((d, i) => (
                        <li
                          key={`${d.name}-${i}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-muted-foreground break-words">
                            {d.name}
                            {estado.firmadoAnterior.includes(d) &&
                              ' (anexo único, formato anterior)'}
                          </span>
                          {d.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(d.url!, '_blank')}
                              aria-label={`Ver ${d.name}`}
                            >
                              <ExternalLink
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
