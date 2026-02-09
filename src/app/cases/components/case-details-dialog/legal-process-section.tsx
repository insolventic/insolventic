'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface LegalProcessSectionProps {
  caseData: CaseWithRelations;
}

export function LegalProcessSection({
  caseData,
}: Readonly<LegalProcessSectionProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Proceso Legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Número de Juzgado
              </p>
              <p className="text-sm">{caseData?.courtNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ciudad</p>
              <p className="text-sm">{caseData?.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Tipo de Proceso
              </p>
              <p className="text-sm">{caseData?.processType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Demandante</p>
              <p className="text-sm">{caseData?.plaintiff || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Número de Expediente
              </p>
              <p className="text-sm">{caseData?.judicialFileNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Abogado</p>
              <p className="text-sm">{caseData?.attorney || 'N/A'}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Fecha de Radicación
              </p>
              <p className="text-sm">
                {caseData?.filingDate
                  ? new Date(caseData.filingDate).toLocaleDateString('es-CO')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Fecha de Admisión
              </p>
              <p className="text-sm">
                {caseData?.admissionDate
                  ? new Date(caseData.admissionDate).toLocaleDateString('es-CO')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Primera Audiencia
              </p>
              <p className="text-sm">
                {caseData?.firstHearingDate
                  ? `${new Date(caseData.firstHearingDate).toLocaleDateString('es-CO')} ${caseData.firstHearingTime ? `a las ${caseData.firstHearingTime}` : ''}`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Operador Designado
              </p>
              <p className="text-sm">{caseData?.designatedOperator || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procesos Judiciales */}
      {caseData?.legalProcesses && caseData.legalProcesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Procesos Judiciales en Contra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.legalProcesses.map((process, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="mb-2">
                    <h4 className="font-medium">Proceso #{index + 1}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {process.processType && (
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Tipo de Proceso
                        </p>
                        <p>{process.processType}</p>
                      </div>
                    )}
                    {process.plaintiff && (
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Demandante
                        </p>
                        <p>{process.plaintiff}</p>
                      </div>
                    )}
                    {process.court && (
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Juzgado
                        </p>
                        <p>{process.court}</p>
                      </div>
                    )}
                    {process.fileNumber && (
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Expediente
                        </p>
                        <p>{process.fileNumber}</p>
                      </div>
                    )}
                    {process.precautionaryMeasure && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-gray-600">
                          Medida Cautelar
                        </p>
                        <p>{process.precautionaryMeasure}</p>
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
