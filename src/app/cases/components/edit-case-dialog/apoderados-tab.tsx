'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import {
  addApoderadoToCase,
  removeApoderadoFromCase,
} from '@/features/case/actions';
import {
  addApoderadoToCaseSchema,
  type AddApoderadoToCaseData,
} from '@/features/case/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ApoderadosTabProps {
  caseId: string;
}

const EMPTY_FORM: AddApoderadoToCaseData = {
  caseId: '',
  nombreCompleto: '',
  tipoIdentificacion: 'CC',
  identificacion: '',
  tarjetaProfesional: '',
  direccion: '',
  telefono: '',
  correo: '',
  existePoderOtorgado: false,
};

export function ApoderadosTab({ caseId }: Readonly<ApoderadosTabProps>) {
  const form = useFormContext();
  const newApoderadoForm = useForm<AddApoderadoToCaseData>({
    resolver: zodResolver(addApoderadoToCaseSchema),
    defaultValues: { ...EMPTY_FORM, caseId },
  });

  const [isPending, startTransition] = useTransition();

  const handleAddApoderado = newApoderadoForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addApoderadoToCase(data);

      if (success && result) {
        toast.success('Apoderado agregado exitosamente');
        const current = form.getValues('apoderados') ?? [];
        form.setValue('apoderados', [
          ...current,
          {
            id: result.id,
            nombreCompleto: result.nombreCompleto,
            tipoIdentificacion: result.tipoIdentificacion,
            identificacion: result.identificacion,
            tarjetaProfesional: result.tarjetaProfesional,
            direccion: result.direccion,
            telefono: result.telefono,
            correo: result.correo,
            existePoderOtorgado: result.existePoderOtorgado,
          },
        ]);
        newApoderadoForm.reset({ ...EMPTY_FORM, caseId });
      } else {
        toast.error(error ?? 'Error al agregar apoderado');
      }
    });
  });

  const handleRemoveApoderado = (apoderadoId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeApoderadoFromCase({ apoderadoId });

      if (success && result) {
        toast.success('Apoderado eliminado exitosamente');
        const current = form.getValues('apoderados') ?? [];
        form.setValue(
          'apoderados',
          current.filter((a: { id: string }) => a.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar apoderado');
      }
    });
  };

  const apoderados = form.watch('apoderados') ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apoderados Existentes</CardTitle>
          <CardDescription>
            Apoderados registrados para este caso. Para corregir un dato,
            elimine el apoderado y agréguelo de nuevo con el dato correcto
            (mismo criterio que acreedores, bienes y libranzas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apoderados.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay apoderados agregados. Use el formulario abajo para agregar.
            </p>
          )}
          {apoderados.map(
            (
              apoderado: {
                id: string;
                nombreCompleto: string;
                tipoIdentificacion: string | null;
                identificacion: string | null;
                tarjetaProfesional: string | null;
                direccion: string | null;
                telefono: string | null;
                correo: string | null;
                existePoderOtorgado: boolean;
              },
              index: number,
            ) => (
              <div
                key={apoderado.id}
                className="bg-muted/50 space-y-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Apoderado #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveApoderado(apoderado.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nombre completo</p>
                    <p className="font-medium">{apoderado.nombreCompleto}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Identificación</p>
                    <p className="font-medium">
                      {apoderado.tipoIdentificacion ?? ''}{' '}
                      {apoderado.identificacion || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tarjeta profesional</p>
                    <p className="font-medium">
                      {apoderado.tarjetaProfesional || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dirección</p>
                    <p className="font-medium">
                      {apoderado.direccion || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Teléfono</p>
                    <p className="font-medium">{apoderado.telefono || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Correo</p>
                    <p className="font-medium">{apoderado.correo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Poder otorgado</p>
                    <p className="font-medium">
                      {apoderado.existePoderOtorgado ? 'Sí' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Nuevo Apoderado</CardTitle>
          <CardDescription>
            Complete el formulario para agregar un nuevo apoderado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombreCompleto">
                  Nombre completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombreCompleto"
                  {...newApoderadoForm.register('nombreCompleto')}
                  placeholder="Nombre completo"
                />
                {newApoderadoForm.formState.errors.nombreCompleto && (
                  <p className="text-destructive text-sm">
                    {newApoderadoForm.formState.errors.nombreCompleto.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de identificación</Label>
                <Select
                  value={newApoderadoForm.watch('tipoIdentificacion') || 'CC'}
                  onValueChange={(value) =>
                    newApoderadoForm.setValue('tipoIdentificacion', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                    <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                    <SelectItem value="NIT">NIT</SelectItem>
                    <SelectItem value="PA">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identificacion">Número de identificación</Label>
                <Input
                  id="identificacion"
                  {...newApoderadoForm.register('identificacion')}
                  placeholder="Número de documento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tarjetaProfesional">Tarjeta profesional</Label>
                <Input
                  id="tarjetaProfesional"
                  {...newApoderadoForm.register('tarjetaProfesional')}
                  placeholder="Número de tarjeta profesional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  {...newApoderadoForm.register('direccion')}
                  placeholder="Dirección de correspondencia"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  type="tel"
                  {...newApoderadoForm.register('telefono')}
                  placeholder="Ej: 3101234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  {...newApoderadoForm.register('correo')}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Poder otorgado</Label>
                <p className="text-muted-foreground text-sm">
                  ¿Existe poder otorgado al apoderado?
                </p>
              </div>
              <Switch
                checked={newApoderadoForm.watch('existePoderOtorgado') ?? false}
                onCheckedChange={(checked) =>
                  newApoderadoForm.setValue('existePoderOtorgado', checked)
                }
              />
            </div>

            <Button
              type="button"
              onClick={handleAddApoderado}
              disabled={isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Apoderado'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
