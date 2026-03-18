'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';

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
