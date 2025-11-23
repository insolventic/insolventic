'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function NotificationsSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Notificaciones</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="notificationAddress">
            Dirección para Notificaciones
          </Label>
          <Input
            id="notificationAddress"
            type="text"
            {...form.register('notificationAddress')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notificationPhone">Teléfono</Label>
          <Input
            id="notificationPhone"
            type="text"
            {...form.register('notificationPhone')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notificationEmail">Correo Electrónico</Label>
          <Input
            id="notificationEmail"
            type="email"
            {...form.register('notificationEmail')}
          />
        </div>
      </div>
    </div>
  );
}
