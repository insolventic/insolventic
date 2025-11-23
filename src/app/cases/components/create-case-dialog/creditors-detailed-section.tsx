'use client';

import { Plus, Trash2, Building2 } from 'lucide-react';
import { useFormContext, useFieldArray } from 'react-hook-form';
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

export function CreditorsDetailedSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'debts',
  });

  const addDebt = () => {
    append({
      creditor: '',
      creditorId: '',
      amount: '',
      type: '',
      interestRate: '',
      creditorAddress: '',
      creditorCity: '',
      creditorEmail: '',
      capitalAmount: '',
      interestAmount: '',
      isDeferred: false,
      documentType: '',
      grantDate: '',
      dueDate: '',
      creditClassification: '',
      hasActiveLibranza: false,
      creditorClass: '',
      percentageOfTotal: '',
      daysOverdue: 0,
      coDebtorName: '',
      coDebtorCity: '',
      coDebtorAddress: '',
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Información Detallada de Acreedores
        </CardTitle>
        <CardDescription>
          Complete la información detallada de cada acreedor y la deuda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, index) => {
          return (
            <div
              key={field.id}
              className="space-y-4 rounded-lg border bg-slate-50 p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-purple-700">
                  Acreedor #{index + 1}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Información Básica del Acreedor */}
              <div className="space-y-4">
                <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
                  Datos del Acreedor
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditor`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>
                          Nombre del Acreedor{' '}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Nombre de la entidad"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditorCity`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Domicilio</FormLabel>
                        <FormControl>
                          <Input {...formField} placeholder="Ciudad" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditorAddress`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Dirección completa"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditorEmail`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            type="email"
                            placeholder="correo@acreedor.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Información de la Deuda */}
              <div className="space-y-4">
                <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
                  Cuantía y Detalles de la Deuda
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`debts.${index}.capitalAmount`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Cuantía - Capital</FormLabel>
                        <FormControl>
                          <Input {...formField} type="number" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.interestAmount`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Cuantía - Intereses</FormLabel>
                        <FormControl>
                          <Input {...formField} type="number" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.interestRate`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>
                          Tasa de Interés (%){' '}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.type`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>
                          Tipo de Deuda <span className="text-red-500">*</span>
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
                            <SelectItem value="PERSONAL">Personal</SelectItem>
                            <SelectItem value="HIPOTECARIA">
                              Hipotecaria
                            </SelectItem>
                            <SelectItem value="VEHICULAR">Vehicular</SelectItem>
                            <SelectItem value="TARJETA_CREDITO">
                              Tarjeta de Crédito
                            </SelectItem>
                            <SelectItem value="OTRA">Otra</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditClassification`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Clasificación del Crédito</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Ej: Primera Clase"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.creditorClass`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Clase</FormLabel>
                        <FormControl>
                          <Input {...formField} placeholder="Clase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.percentageOfTotal`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>% Acreencia</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.daysOverdue`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Días Incumplidos</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            type="number"
                            placeholder="0"
                            onChange={(e) =>
                              formField.onChange(parseInt(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.documentType`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Documento en que Consta</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Ej: Pagaré, Contrato"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.grantDate`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Fecha Otorgamiento</FormLabel>
                        <FormControl>
                          <Input {...formField} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.dueDate`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Fecha Vencimiento</FormLabel>
                        <FormControl>
                          <Input {...formField} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name={`debts.${index}.isDeferred`}
                    render={({ field: formField }) => (
                      <FormItem className="flex items-center space-y-0 space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={formField.value}
                            onCheckedChange={formField.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-normal">
                          Postergado
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.hasActiveLibranza`}
                    render={({ field: formField }) => (
                      <FormItem className="flex items-center space-y-0 space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={formField.value}
                            onCheckedChange={formField.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-normal">
                          Libranza Activa
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Información Codeudor/Avalista */}
              <div className="space-y-4">
                <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
                  Información Codeudor/Avalista
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`debts.${index}.coDebtorName`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Nombre del codeudor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.coDebtorCity`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Domicilio</FormLabel>
                        <FormControl>
                          <Input {...formField} placeholder="Ciudad" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`debts.${index}.coDebtorAddress`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Dirección completa"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDebt}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Acreedor
        </Button>

        {fields.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <p className="mb-4">No hay acreedores registrados</p>
            <p className="text-sm">
              Use el botón para agregar la información detallada de cada
              acreedor
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
