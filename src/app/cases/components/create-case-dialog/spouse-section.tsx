'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function SpouseSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Sociedad Conyugal/Patrimonial</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="spouseName">Nombre</Label>
          <Input id="spouseName" type="text" {...form.register('spouseName')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spouseIdNumber">Cédula</Label>
          <Input
            id="spouseIdNumber"
            type="text"
            {...form.register('spouseIdNumber')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spouseAddress">Dirección</Label>
          <Input
            id="spouseAddress"
            type="text"
            {...form.register('spouseAddress')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spousePhone">Teléfono</Label>
          <Input
            id="spousePhone"
            type="text"
            {...form.register('spousePhone')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spouseEmail">Correo Electrónico</Label>
          <Input
            id="spouseEmail"
            type="email"
            {...form.register('spouseEmail')}
          />
        </div>
      </div>
    </div>
  );
}
