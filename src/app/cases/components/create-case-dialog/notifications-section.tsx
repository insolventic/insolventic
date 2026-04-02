'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

export function NotificationsSection() {
  const form = useFormContext();

  const fueraDeBogota = useWatch({
    control: form.control,
    name: 'notificationOutsideBogota',
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Notificaciones</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notificationAddress">
            Dirección para Notificaciones
          </Label>
          <Input
            id="notificationAddress"
            type="text"
            placeholder="Ej: Calle 127 #20-45 Apto 302"
            {...form.register('notificationAddress')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notificationCity">Ciudad</Label>
          <Input
            id="notificationCity"
            type="text"
            placeholder="Ej: Bogotá D.C."
            {...form.register('notificationCity')}
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

      {/* Fuera de Bogotá */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="notificationOutsideBogota"
            checked={fueraDeBogota || false}
            onCheckedChange={(checked) =>
              form.setValue('notificationOutsideBogota', checked)
            }
          />
          <Label
            htmlFor="notificationOutsideBogota"
            className="cursor-pointer font-normal"
          >
            El trámite se realiza fuera de Bogotá D.C.
          </Label>
        </div>
        {fueraDeBogota && (
          <div className="space-y-2">
            <Label htmlFor="outsideBogotaReason">
              Motivo / Centro de conciliación
            </Label>
            <Textarea
              id="outsideBogotaReason"
              rows={2}
              placeholder="Indique el centro de conciliación y la ciudad donde se adelantará el trámite"
              {...form.register('outsideBogotaReason')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
