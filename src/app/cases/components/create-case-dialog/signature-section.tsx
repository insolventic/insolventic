'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function SignatureSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Firma del Solicitante</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="applicantSignatureName">Nombre Completo</Label>
          <Input
            id="applicantSignatureName"
            type="text"
            {...form.register('applicantSignatureName')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="applicantSignatureId">Cédula</Label>
          <Input
            id="applicantSignatureId"
            type="text"
            {...form.register('applicantSignatureId')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="applicantSignature">Firma</Label>
          <Input
            id="applicantSignature"
            type="text"
            placeholder="Espacio para firma"
            {...form.register('applicantSignature')}
          />
        </div>
      </div>
    </div>
  );
}
