'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * AssetItem - Componente memoizado para cada bien
 *
 * SOLUCIÓN al problema "Maximum update depth exceeded":
 * - useWatch se usa DENTRO del componente hijo, no en el padre
 * - Cada AssetItem solo se re-renderiza cuando SU tipo cambia
 * - El padre (AssetsSection) no se re-renderiza por cambios de tipo
 */
interface AssetItemProps {
  index: number;
  fieldId: string;
  onRemove: (index: number) => void;
}

const AssetItem = memo(function AssetItem({
  index,
  fieldId,
  onRemove,
}: AssetItemProps) {
  const form = useFormContext();

  // useWatch dentro del componente hijo - solo este componente se re-renderiza
  const assetType = useWatch({
    control: form.control,
    name: `assets.${index}.type`,
  });

  return (
    <div
      key={fieldId}
      className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-400">
          Bien #{index + 1} - {assetType || 'Sin tipo'}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name={`assets.${index}.type`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                Tipo de Bien <span className="text-red-500">*</span>
              </FormLabel>
              <Select
                onValueChange={formField.onChange}
                value={formField.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="INMUEBLE">Inmueble</SelectItem>
                  <SelectItem value="VEHICULO">Vehículo</SelectItem>
                  <SelectItem value="EQUIPO">
                    Equipo Eléctrico/Electrónico
                  </SelectItem>
                  <SelectItem value="MUEBLE">Mueble</SelectItem>
                  <SelectItem value="JOYA">Joya</SelectItem>
                  <SelectItem value="DINERO">Dinero/Efectivo</SelectItem>
                  <SelectItem value="ACCION">Acciones</SelectItem>
                  <SelectItem value="CUENTA_COBRAR">
                    Cuenta por Cobrar
                  </SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`assets.${index}.name`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                Nombre/Descripción <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input {...formField} placeholder="Ej: Casa, Carro Toyota" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`assets.${index}.value`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                Valor ($) <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input {...formField} type="number" placeholder="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {assetType === 'INMUEBLE' && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-foreground text-sm font-medium">
            Información del Inmueble
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name={`assets.${index}.propertyType`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Tipo de Inmueble</FormLabel>
                  <FormControl>
                    <Input
                      {...formField}
                      placeholder="Casa, Apartamento, Lote"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`assets.${index}.address`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input {...formField} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`assets.${index}.registrationNumber`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Matrícula Inmobiliaria</FormLabel>
                  <FormControl>
                    <Input {...formField} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`assets.${index}.encumbrance`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Gravamen</FormLabel>
                  <FormControl>
                    <Input {...formField} placeholder="Hipoteca" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name={`assets.${index}.isFamilyHome`}
              render={({ field: formField }) => (
                <FormItem className="flex items-center space-y-0 space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={formField.value}
                      onCheckedChange={formField.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    Vivienda Familiar (Ley 258/1996)
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
      {assetType === 'VEHICULO' && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-foreground text-sm font-medium">
            Información del Vehículo
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name={`assets.${index}.brand`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input {...formField} placeholder="Toyota" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`assets.${index}.licensePlate`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Placa</FormLabel>
                  <FormControl>
                    <Input {...formField} placeholder="ABC123" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`assets.${index}.model`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Modelo/Año</FormLabel>
                  <FormControl>
                    <Input {...formField} placeholder="2020" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export function AssetsSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'assets',
  });

  const addAsset = () => {
    append({
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
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Inventario de Bienes</CardTitle>
        <CardDescription>
          Registre los bienes muebles e inmuebles del deudor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, index) => (
          <AssetItem
            key={field.id}
            index={index}
            fieldId={field.id}
            onRemove={remove}
          />
        ))}
        <div className="pt-4">
          <Button type="button" variant="outline" size="sm" onClick={addAsset}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Bien
          </Button>
        </div>
        {fields.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p className="mb-4">No hay bienes registrados</p>
            <p className="text-sm">
              Use los botones para agregar bienes del deudor
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
