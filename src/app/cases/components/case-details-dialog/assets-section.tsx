'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';

interface AssetsSectionProps {
  caseData: CaseWithRelations;
}

export function AssetsSection({ caseData }: Readonly<AssetsSectionProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bienes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {caseData?.assets && caseData.assets.length > 0 ? (
            caseData.assets.map((asset, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">
                    Bien #{index + 1} - {asset.type}
                  </h4>
                  <Badge variant="outline">
                    ${Number(asset.value).toLocaleString()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      Nombre/Descripción
                    </p>
                    <p>{asset.name}</p>
                  </div>
                  {asset.propertyType && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Tipo de Propiedad
                      </p>
                      <p>{asset.propertyType}</p>
                    </div>
                  )}
                  {asset.address && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Dirección
                      </p>
                      <p>{asset.address}</p>
                    </div>
                  )}
                  {asset.brand && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Marca
                      </p>
                      <p>{asset.brand}</p>
                    </div>
                  )}
                  {asset.licensePlate && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Placa
                      </p>
                      <p>{asset.licensePlate}</p>
                    </div>
                  )}
                  {asset.description && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs font-medium">
                        Descripción
                      </p>
                      <p>{asset.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No hay bienes registrados
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
