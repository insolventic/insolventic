'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';

interface CreditorsSectionProps {
  caseData: CaseWithRelations;
}

export function CreditorsSection({
  caseData,
}: Readonly<CreditorsSectionProps>) {
  const creditors =
    caseData.debts?.map((debt) => ({
      name: debt.creditor?.name || 'Acreedor no especificado',
      amount: Number(debt.amount),
      type: debt.type || 'No especificado',
      interestRate: Number(debt.interestRate || 0),
    })) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Acreedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {creditors.length > 0 ? (
              creditors.map((creditor) => (
                <div
                  key={creditor.name}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{creditor.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {creditor.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ${creditor.amount.toLocaleString()}
                    </p>
                    <Badge variant="secondary">{creditor.interestRate}%</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                No hay acreedores registrados
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Libranzas */}
      {caseData?.libranzas && caseData.libranzas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Libranzas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.libranzas.map((libranza, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Pagador
                      </p>
                      <p>{libranza.payerName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Suma Descontada
                      </p>
                      <p className="font-medium">
                        ${Number(libranza.deductedAmount).toLocaleString()}
                      </p>
                    </div>
                    {libranza.payerAddress && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Dirección
                        </p>
                        <p>{libranza.payerAddress}</p>
                      </div>
                    )}
                    {libranza.productAndCreditor && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Producto/Acreedor
                        </p>
                        <p>{libranza.productAndCreditor}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servicios Suspendidos */}
      {caseData?.suspendedServices && caseData.suspendedServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Servicios Públicos Suspendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.suspendedServices.map((service, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Acreedor/Entidad
                      </p>
                      <p>{service.creditorName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Suma Adeudada
                      </p>
                      <p className="font-medium">
                        ${Number(service.amountOwed).toLocaleString()}
                      </p>
                    </div>
                    {service.suspendedProduct && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Servicio
                        </p>
                        <p>{service.suspendedProduct}</p>
                      </div>
                    )}
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
