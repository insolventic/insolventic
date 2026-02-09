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
              <p className="text-sm font-medium text-gray-600">
                Ingresos Mensuales Declarados
              </p>
              <p className="text-sm">
                ${(caseData?.monthlyIncome || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Gastos Mensuales
              </p>
              <p className="text-sm">
                ${(caseData?.monthlyExpenses || 0).toLocaleString()}
              </p>
            </div>
            {caseData?.otherIncomeDescription && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Otros Ingresos
                  </p>
                  <p className="text-sm">{caseData.otherIncomeDescription}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Valor Otros Ingresos
                  </p>
                  <p className="text-sm">
                    ${(caseData?.otherIncomeAmount || 0).toLocaleString()}
                  </p>
                </div>
              </>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">
                Recursos Disponibles
              </p>
              <p className="text-sm font-bold text-green-600">
                $
                {(
                  (caseData?.monthlyIncome || 0) +
                  (caseData?.otherIncomeAmount || 0) -
                  (caseData?.monthlyExpenses || 0)
                ).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
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
                      <p className="text-xs font-medium text-gray-600">
                        Nombre
                      </p>
                      <p className="text-sm">{dependent.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Edad</p>
                      <p className="text-sm">{dependent.age} años</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">
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
