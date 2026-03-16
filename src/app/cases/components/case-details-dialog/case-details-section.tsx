'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface CaseDetailsSectionProps {
  caseData: CaseWithRelations;
}

export function CaseDetailsSection({
  caseData,
}: Readonly<CaseDetailsSectionProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles del Caso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              Número de Caso
            </p>
            <p className="text-sm">{caseData?.caseNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              Tipo de Caso
            </p>
            <p className="text-sm">{caseData?.type || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              Monto Total
            </p>
            <p className="text-sm">
              ${(caseData?.totalDebt || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              Número de Acreedores
            </p>
            <p className="text-sm">{caseData?.creditors || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              Fecha de Creación
            </p>
            <p className="text-sm">
              {caseData?.createdDate
                ? new Date(caseData.createdDate).toLocaleDateString('es-CO')
                : 'N/A'}
            </p>
          </div>
        </div>
        <Separator />
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            Causas de Insolvencia
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {caseData?.causes?.map((cause) => (
              <Badge key={cause} variant="secondary">
                {cause}
              </Badge>
            )) || (
              <span className="text-muted-foreground text-sm">
                No hay causas registradas
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-sm font-medium">Trámite</p>
          <p className="text-sm">{caseData?.tramite || 'Sin especificar'}</p>
        </div>
      </CardContent>
    </Card>
  );
}
