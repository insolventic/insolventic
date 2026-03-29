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
            placeholder="Ley 1564 de 2012 (CGP, Arts. 531-576), Ley 2445 de 2025, Decreto 2677 de 2012, Decreto 1069 de 2015."
            {...form.register('legalFoundations')}
          />
          <p className="text-muted-foreground text-xs">
            Normativa base: Ley 1564/2012 (CGP), Ley 2445/2025, Decreto
            2677/2012, Decreto 1069/2015
          </p>
        </div>
      </div>
    </div>
  );
}
