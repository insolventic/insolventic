'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import type { CaseWithRelations } from '@/features/case/schemas';
import { updateCase } from '@/features/case/actions';

interface PreGenerationFormProps {
  caseData: CaseWithRelations;
  packageNumber: 2 | 3;
  onDataSaved: () => void;
}

function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function PreGenerationForm({
  caseData,
  packageNumber,
  onDataSaved,
}: PreGenerationFormProps) {
  const [saving, setSaving] = useState(false);

  // Package 2 fields
  const [filingDate, setFilingDate] = useState(
    formatDateForInput(caseData.filingDate),
  );
  const [designationDate, setDesignationDate] = useState(
    formatDateForInput(caseData.designationDate),
  );
  const [positionAcceptanceDate, setPositionAcceptanceDate] = useState(
    formatDateForInput(caseData.positionAcceptanceDate),
  );

  // Package 3 fields
  const [approvalPercentage, setApprovalPercentage] = useState(
    caseData.approvalPercentage != null
      ? String(caseData.approvalPercentage)
      : '',
  );
  const [agreementValidityDate, setAgreementValidityDate] = useState(
    formatDateForInput(caseData.agreementValidityDate),
  );

  const missingFields: string[] = [];

  if (packageNumber === 2) {
    if (!caseData.filingDate && !filingDate)
      missingFields.push('Fecha de radicacion');
    if (!caseData.designationDate && !designationDate)
      missingFields.push('Fecha de designacion');
    if (!caseData.positionAcceptanceDate && !positionAcceptanceDate)
      missingFields.push('Fecha de aceptacion del cargo');
  } else {
    if (caseData.approvalPercentage == null && !approvalPercentage)
      missingFields.push('Porcentaje de aprobacion');
    if (!caseData.agreementValidityDate && !agreementValidityDate)
      missingFields.push('Vigencia del acuerdo');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: Record<string, unknown> = { id: caseData.id };

      if (packageNumber === 2) {
        if (!filingDate || !designationDate || !positionAcceptanceDate) {
          toast.error('Todos los campos son obligatorios');
          setSaving(false);
          return;
        }
        updateData.filingDate = filingDate;
        updateData.designationDate = designationDate;
        updateData.positionAcceptanceDate = positionAcceptanceDate;
      } else {
        if (!approvalPercentage || !agreementValidityDate) {
          toast.error('Todos los campos son obligatorios');
          setSaving(false);
          return;
        }
        updateData.approvalPercentage = parseFloat(approvalPercentage);
        updateData.agreementValidityDate = agreementValidityDate;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateCase(updateData as any);

      if (result.success) {
        toast.success('Datos guardados correctamente');
        onDataSaved();
      } else {
        toast.error(result.error || 'Error al guardar los datos');
      }
    } catch (error) {
      toast.error('Error al guardar los datos');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
          {packageNumber === 2
            ? 'Datos requeridos para Admision'
            : 'Datos requeridos para Acuerdo'}
        </CardTitle>
        {missingFields.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Faltan los siguientes datos: {missingFields.join(', ')}. Complete la
            informacion para continuar con la generacion.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {packageNumber === 2 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="filingDate">Fecha de radicacion</Label>
                <Input
                  id="filingDate"
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designationDate">Fecha de designacion</Label>
                <Input
                  id="designationDate"
                  type="date"
                  value={designationDate}
                  onChange={(e) => setDesignationDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionAcceptanceDate">
                  Fecha de aceptacion del cargo
                </Label>
                <Input
                  id="positionAcceptanceDate"
                  type="date"
                  value={positionAcceptanceDate}
                  onChange={(e) => setPositionAcceptanceDate(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="approvalPercentage">
                  Porcentaje de aprobacion (%)
                </Label>
                <Input
                  id="approvalPercentage"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={approvalPercentage}
                  onChange={(e) => setApprovalPercentage(e.target.value)}
                  placeholder="Ej: 75.5"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agreementValidityDate">
                  Vigencia del acuerdo
                </Label>
                <Input
                  id="agreementValidityDate"
                  type="date"
                  value={agreementValidityDate}
                  onChange={(e) => setAgreementValidityDate(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar y continuar'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
