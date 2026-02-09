'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Users } from 'lucide-react';

import {
  addDependentToCase,
  removeDependentFromCase,
} from '@/features/case/actions';
import {
  addDependentToCaseSchema,
  type AddDependentToCaseData,
} from '@/features/case/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface DependentsTabProps {
  caseId: string;
}

export function DependentsTab({ caseId }: Readonly<DependentsTabProps>) {
  const form = useFormContext();
  const newDependentForm = useForm<AddDependentToCaseData>({
    resolver: zodResolver(addDependentToCaseSchema),
    defaultValues: {
      caseId,
      name: '',
      age: '',
      relationship: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleAddDependent = newDependentForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addDependentToCase(data);

      if (success && result) {
        toast.success('Beneficiario agregado exitosamente');
        const currentDependents = form.getValues('dependents') ?? [];
        form.setValue('dependents', [
          ...currentDependents,
          {
            id: result.id,
            name: result.name,
            age: result.age,
            relationship: result.relationship,
          },
        ]);
        newDependentForm.reset({
          caseId,
          name: '',
          age: '',
          relationship: '',
        });
      } else {
        toast.error(error ?? 'Error al agregar beneficiario');
      }
    });
  });

  const handleRemoveDependent = (dependentId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeDependentFromCase({ dependentId });

      if (success && result) {
        toast.success('Beneficiario eliminado exitosamente');
        const currentDependents = form.getValues('dependents') ?? [];
        form.setValue(
          'dependents',
          currentDependents.filter((d: { id: string }) => d.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar beneficiario');
      }
    });
  };

  const dependents = form.watch('dependents') ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Obligaciones Alimentarias
          </CardTitle>
          <CardDescription>
            Beneficiarios registrados para este caso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dependents.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay beneficiarios registrados. Use el formulario abajo para
              agregar.
            </p>
          )}
          {dependents.map(
            (
              dependent: {
                id: string;
                name: string;
                age: string;
                relationship: string;
              },
              index: number,
            ) => (
              <div
                key={dependent.id}
                className="bg-muted/50 space-y-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Beneficiario #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveDependent(dependent.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nombre</p>
                    <p className="font-medium">{dependent.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Edad</p>
                    <p className="font-medium">{dependent.age} años</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Parentesco</p>
                    <p className="font-medium">{dependent.relationship}</p>
                  </div>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Beneficiario</CardTitle>
          <CardDescription>
            Complete el formulario para agregar un nuevo beneficiario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...newDependentForm.register('name')}
                  placeholder="Nombre completo"
                />
                {newDependentForm.formState.errors.name && (
                  <p className="text-destructive text-sm">
                    {newDependentForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">
                  Edad <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="age"
                  type="number"
                  {...newDependentForm.register('age')}
                  placeholder="0"
                />
                {newDependentForm.formState.errors.age && (
                  <p className="text-destructive text-sm">
                    {newDependentForm.formState.errors.age.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">
                  Parentesco <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="relationship"
                  {...newDependentForm.register('relationship')}
                  placeholder="Hijo, Hija, etc."
                />
                {newDependentForm.formState.errors.relationship && (
                  <p className="text-destructive text-sm">
                    {newDependentForm.formState.errors.relationship.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAddDependent}
              disabled={isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Beneficiario'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
