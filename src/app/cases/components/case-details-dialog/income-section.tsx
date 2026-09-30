'use client';

import { Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';
import { servicioManutencionLabel } from '@/features/case/servicios-manutencion';

interface IncomeSectionProps {
  caseData: CaseWithRelations;
}

export function IncomeSection({ caseData }: Readonly<IncomeSectionProps>) {
  return (
    <>
      {/* Ingresos y Gastos */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos y Gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ingresos Mensuales Declarados
              </p>
              <p className="text-sm">
                ${(caseData?.monthlyIncome || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Gastos Mensuales
              </p>
              <p className="text-sm">
                ${(caseData?.monthlyExpenses || 0).toLocaleString()}
              </p>
            </div>
            {caseData?.otherIncomeDescription && (
              <>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Otros Ingresos
                  </p>
                  <p className="text-sm">{caseData.otherIncomeDescription}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Valor Otros Ingresos
                  </p>
                  <p className="text-sm">
                    ${(caseData?.otherIncomeAmount || 0).toLocaleString()}
                  </p>
                </div>
              </>
            )}
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Recursos Disponibles
              </p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                $
                {(
                  (caseData?.monthlyIncome || 0) +
                  (caseData?.otherIncomeAmount || 0) -
                  (caseData?.monthlyExpenses || 0)
                ).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Certificación de Empleador
              </p>
              <Badge
                variant={
                  caseData?.hasEmployerCertification ? 'default' : 'secondary'
                }
              >
                {caseData?.hasEmployerCertification ? 'Sí' : 'No'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Servicios de manutención — desglose interno del operador.
          No aparece en ningún documento generado (ver
          src/features/case/servicios-manutencion.ts). */}
      {caseData?.serviciosManutencion &&
        caseData.serviciosManutencion.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Servicios de Manutención
                <Badge variant="secondary" className="font-normal">
                  <Lock className="mr-1 h-3 w-3" />
                  Uso interno
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {caseData.serviciosManutencion.map((servicio, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1fr_2fr]"
                  >
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Servicio
                      </p>
                      <p className="text-sm">
                        {servicioManutencionLabel(servicio)}
                      </p>
                    </div>
                    {servicio.descripcion?.trim() && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Descripción
                        </p>
                        <p className="text-sm">{servicio.descripcion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Este desglose no se incluye en los documentos generados. El
                monto total declarado es el de &quot;Gastos Mensuales&quot;.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Obligaciones Alimentarias (Dependientes) */}
      {caseData?.dependents && caseData.dependents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Obligaciones Alimentarias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.dependents.map((dependent, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Nombre
                      </p>
                      <p className="text-sm">{dependent.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Edad
                      </p>
                      <p className="text-sm">{dependent.age} años</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Parentesco
                      </p>
                      <p className="text-sm">{dependent.relationship}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
