'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function LegalFoundationsSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">
        Tarifa Solicitada y Fundamentos de Derecho
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="requestedFee">Tarifa Solicitada</Label>
          <Input
            id="requestedFee"
            type="text"
            {...form.register('requestedFee')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="legalFoundations">Fundamentos de Derecho</Label>
          <Textarea
            id="legalFoundations"
            rows={6}
            {...form.register('legalFoundations')}
          />
        </div>
      </div>
    </div>
  );
}
