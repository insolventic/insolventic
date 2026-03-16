'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import { addAssetToCase, removeAssetFromCase } from '@/features/case/actions';
import {
  addAssetToCaseSchema,
  type AddAssetToCaseData,
} from '@/features/case/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

interface AssetsTabProps {
  caseId: string;
}

export function AssetsTab({ caseId }: Readonly<AssetsTabProps>) {
  const form = useFormContext();

  const newAssetForm = useForm<AddAssetToCaseData>({
    resolver: zodResolver(addAssetToCaseSchema),
    defaultValues: {
      caseId,
      name: '',
      type: '',
      value: '',
      description: '',
      propertyType: '',
      address: '',
      registrationNumber: '',
      encumbrance: '',
      affectation: '',
      precautionaryMeasure: '',
      proofDocument: '',
      isFamilyHome: false,
      isInalienablePatrimony: false,
      brand: '',
      model: '',
      condition: '',
      licensePlate: '',
      transitAuthority: '',
      guaranteeInFavorOf: '',
      guaranteeAmount: '',
      material: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleAddAsset = newAssetForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addAssetToCase(data);

      if (success && result) {
        toast.success('Bien agregado exitosamente');
        const currentAssets = form.getValues('assets') ?? [];
        form.setValue('assets', [
          ...currentAssets,
          {
            id: result.id,
            name: result.name,
            type: result.type,
            value: result.value,
            description: result.description,
            propertyType: result.propertyType,
            address: result.address,
            registrationNumber: result.registrationNumber,
            encumbrance: result.encumbrance,
            affectation: result.affectation,
            precautionaryMeasure: result.precautionaryMeasure,
            proofDocument: result.proofDocument,
            isFamilyHome: result.isFamilyHome,
            isInalienablePatrimony: result.isInalienablePatrimony,
            brand: result.brand,
            model: result.model,
            condition: result.condition,
            licensePlate: result.licensePlate,
            transitAuthority: result.transitAuthority,
            guaranteeInFavorOf: result.guaranteeInFavorOf,
            guaranteeAmount: result.guaranteeAmount,
            material: result.material,
          },
        ]);
        newAssetForm.reset({
          caseId,
          name: '',
          type: '',
          value: '',
          description: '',
        });
      } else {
        toast.error(error ?? 'Error al agregar bien');
      }
    });
  });

  const handleRemoveAsset = (assetId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeAssetFromCase({ assetId });

      if (success && result) {
        toast.success('Bien eliminado exitosamente');
        const currentAssets = form.getValues('assets') ?? [];
        form.setValue(
          'assets',
          currentAssets.filter((a: { id: string }) => a.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar bien');
      }
    });
  };

  const assets = form.watch('assets') ?? [];
  const assetType = newAssetForm.watch('type');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bienes Existentes</CardTitle>
          <CardDescription>
            Inventario de bienes registrados para este caso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assets.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay bienes registrados. Use el formulario abajo para agregar.
            </p>
          )}
          {assets.map(
            (
              asset: {
                id: string;
                name: string;
                type: string;
                value: string;
                description?: string | null;
                propertyType?: string | null;
                address?: string | null;
                brand?: string | null;
                model?: string | null;
                licensePlate?: string | null;
              },
              index: number,
            ) => (
              <div
                key={asset.id}
                className="bg-muted/50 space-y-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Bien #{index + 1} - {asset.type}
                  </h4>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveAsset(asset.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nombre/Descripción</p>
                    <p className="font-medium">{asset.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-medium">
                      ${parseFloat(asset.value).toLocaleString()}
                    </p>
                  </div>
                  {asset.propertyType && (
                    <div>
                      <p className="text-muted-foreground">Tipo de Propiedad</p>
                      <p className="font-medium">{asset.propertyType}</p>
                    </div>
                  )}
                  {asset.address && (
                    <div>
                      <p className="text-muted-foreground">Dirección</p>
                      <p className="font-medium">{asset.address}</p>
                    </div>
                  )}
                  {asset.brand && (
                    <div>
                      <p className="text-muted-foreground">Marca</p>
                      <p className="font-medium">{asset.brand}</p>
                    </div>
                  )}
                  {asset.model && (
                    <div>
                      <p className="text-muted-foreground">Modelo</p>
                      <p className="font-medium">{asset.model}</p>
                    </div>
                  )}
                  {asset.licensePlate && (
                    <div>
                      <p className="text-muted-foreground">Placa</p>
                      <p className="font-medium">{asset.licensePlate}</p>
                    </div>
                  )}
                  {asset.description && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Descripción</p>
                      <p className="font-medium">{asset.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Nuevo Bien</CardTitle>
          <CardDescription>
            Complete el formulario para agregar un nuevo bien al inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">
                  Tipo de Bien <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={assetType}
                  onValueChange={(value) =>
                    newAssetForm.setValue('type', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INMUEBLE">Inmueble</SelectItem>
                    <SelectItem value="VEHICULO">Vehículo</SelectItem>
                    <SelectItem value="EQUIPO">
                      Equipo Eléctrico/Electrónico
                    </SelectItem>
                    <SelectItem value="MUEBLE">Mueble</SelectItem>
                    <SelectItem value="JOYA">Joya</SelectItem>
                    <SelectItem value="DINERO">Dinero/Efectivo</SelectItem>
                    <SelectItem value="ACCION">Acción/Título</SelectItem>
                    <SelectItem value="CUENTA_COBRAR">
                      Cuenta por Cobrar
                    </SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {newAssetForm.formState.errors.type && (
                  <p className="text-destructive text-sm">
                    {newAssetForm.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre/Descripción <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...newAssetForm.register('name')}
                  placeholder="Ej: Casa, Carro Toyota"
                />
                {newAssetForm.formState.errors.name && (
                  <p className="text-destructive text-sm">
                    {newAssetForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">
                  Valor ($) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="value"
                  type="number"
                  {...newAssetForm.register('value')}
                  placeholder="0"
                />
                {newAssetForm.formState.errors.value && (
                  <p className="text-destructive text-sm">
                    {newAssetForm.formState.errors.value.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción Adicional</Label>
                <Input
                  id="description"
                  {...newAssetForm.register('description')}
                  placeholder="Detalles adicionales"
                />
              </div>
            </div>

            {/* Campos específicos para INMUEBLE */}
            {assetType === 'INMUEBLE' && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-foreground text-sm font-medium">
                  Información del Inmueble
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Tipo de Inmueble</Label>
                    <Input
                      id="propertyType"
                      {...newAssetForm.register('propertyType')}
                      placeholder="Casa, Apartamento, Lote"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      {...newAssetForm.register('address')}
                      placeholder="Dirección completa"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">
                      Matrícula Inmobiliaria
                    </Label>
                    <Input
                      id="registrationNumber"
                      {...newAssetForm.register('registrationNumber')}
                      placeholder="Número de matrícula"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="encumbrance">Gravamen</Label>
                    <Input
                      id="encumbrance"
                      {...newAssetForm.register('encumbrance')}
                      placeholder="Hipoteca, prenda, etc."
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isFamilyHome"
                    checked={newAssetForm.watch('isFamilyHome')}
                    onCheckedChange={(checked) =>
                      newAssetForm.setValue('isFamilyHome', !!checked)
                    }
                  />
                  <Label htmlFor="isFamilyHome" className="cursor-pointer">
                    Vivienda Familiar (Ley 258/1996)
                  </Label>
                </div>
              </div>
            )}

            {/* Campos específicos para VEHICULO */}
            {assetType === 'VEHICULO' && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-foreground text-sm font-medium">
                  Información del Vehículo
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      {...newAssetForm.register('brand')}
                      placeholder="Toyota, Honda, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licensePlate">Placa</Label>
                    <Input
                      id="licensePlate"
                      {...newAssetForm.register('licensePlate')}
                      placeholder="ABC123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo/Año</Label>
                    <Input
                      id="model"
                      {...newAssetForm.register('model')}
                      placeholder="2020"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="condition">Condición</Label>
                    <Input
                      id="condition"
                      {...newAssetForm.register('condition')}
                      placeholder="Nuevo, Usado, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transitAuthority">
                      Autoridad de Tránsito
                    </Label>
                    <Input
                      id="transitAuthority"
                      {...newAssetForm.register('transitAuthority')}
                      placeholder="Ej: Secretaría de Tránsito"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guaranteeInFavorOf">
                      Garantía a Favor De
                    </Label>
                    <Input
                      id="guaranteeInFavorOf"
                      {...newAssetForm.register('guaranteeInFavorOf')}
                      placeholder="Banco o entidad"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddAsset}
              disabled={isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Bien'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
