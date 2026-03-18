'use client';

import { useState } from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { memo } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronRight } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CreateCaseFormInput } from '@/features/case/schemas';

interface AcreedorItemProps {
  index: number;
  fieldId: string;
  onRemove: (index: number) => void;
}

const AcreedorItem = memo(function AcreedorItem({
  index,
  onRemove,
}: AcreedorItemProps) {
  const form = useFormContext<CreateCaseFormInput>();
  const [isOpen, setIsOpen] = useState(true);

  const acreedorNombre = useWatch({
    control: form.control,
    name: `acreedores.${index}.acreedorNombreRazonSocial`,
  });

  const obligacionCodeudores = useWatch({
    control: form.control,
    name: `acreedores.${index}.obligacionCodeudores`,
  });

  const garantiaAsociada = useWatch({
    control: form.control,
    name: `acreedores.${index}.garantiaAsociada`,
  });

  const procesoJudicialEnCurso = useWatch({
    control: form.control,
    name: `acreedores.${index}.procesoJudicialEnCurso`,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-2 text-left">
              {isOpen ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                Acreedor #{index + 1}
                {acreedorNombre ? ` - ${acreedorNombre}` : ''}
              </h3>
            </button>
          </CollapsibleTrigger>
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

        <CollapsibleContent className="space-y-6">
          {/* ============================================================ */}
          {/* 5.1 Identificación del Acreedor */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              5.1 Identificación del Acreedor
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorTipo`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Tipo de Acreedor</FormLabel>
                    <Select
                      onValueChange={formField.onChange}
                      value={formField.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ENTIDAD_FINANCIERA">
                          Entidad Financiera
                        </SelectItem>
                        <SelectItem value="COOPERATIVA">Cooperativa</SelectItem>
                        <SelectItem value="PERSONA_NATURAL">
                          Persona Natural
                        </SelectItem>
                        <SelectItem value="PERSONA_JURIDICA">
                          Persona Jurídica
                        </SelectItem>
                        <SelectItem value="ESTADO">
                          Estado / Entidad Pública
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
                name={`acreedores.${index}.acreedorNombreRazonSocial`}
                render={({ field: formField }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      Nombre o Razón Social{' '}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Nombre del acreedor o razón social"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorTipoIdentificacion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Tipo de Identificación</FormLabel>
                    <Select
                      onValueChange={formField.onChange}
                      value={formField.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                        <SelectItem value="CE">
                          Cédula de Extranjería
                        </SelectItem>
                        <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorIdentificacion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Número de Identificación</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Número de identificación"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorDireccion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Dirección del acreedor"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorCiudad`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...formField} placeholder="Ciudad" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorCorreo`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
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

              <FormField
                control={form.control}
                name={`acreedores.${index}.acreedorTelefono`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Teléfono de contacto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 5.2 Información de la Obligación */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              5.2 Información de la Obligación
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name={`acreedores.${index}.tipoObligacion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Tipo de Obligación</FormLabel>
                    <Select
                      onValueChange={formField.onChange}
                      value={formField.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CREDITO_PERSONAL">
                          Crédito Personal
                        </SelectItem>
                        <SelectItem value="CREDITO_HIPOTECARIO">
                          Crédito Hipotecario
                        </SelectItem>
                        <SelectItem value="CREDITO_VEHICULAR">
                          Crédito Vehicular
                        </SelectItem>
                        <SelectItem value="TARJETA_CREDITO">
                          Tarjeta de Crédito
                        </SelectItem>
                        <SelectItem value="PAGARE">Pagaré</SelectItem>
                        <SelectItem value="LETRA_CAMBIO">
                          Letra de Cambio
                        </SelectItem>
                        <SelectItem value="SERVICIOS_PUBLICOS">
                          Servicios Públicos
                        </SelectItem>
                        <SelectItem value="IMPUESTOS">Impuestos</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.numeroObligacion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Número de Obligación</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Número de obligación o crédito"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.naturalezaCredito`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Naturaleza del Crédito</FormLabel>
                    <Select
                      onValueChange={formField.onChange}
                      value={formField.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione naturaleza" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QUIROGRAFARIO">
                          Quirografario
                        </SelectItem>
                        <SelectItem value="PREFERENTE">Preferente</SelectItem>
                        <SelectItem value="CON_GARANTIA_REAL">
                          Con Garantía Real
                        </SelectItem>
                        <SelectItem value="LABORAL">Laboral</SelectItem>
                        <SelectItem value="FISCAL">Fiscal</SelectItem>
                        <SelectItem value="ALIMENTOS">Alimentos</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.fechaOtorgamiento`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Fecha de Otorgamiento</FormLabel>
                    <FormControl>
                      <Input {...formField} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.fechaVencimiento`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Fecha de Vencimiento</FormLabel>
                    <FormControl>
                      <Input {...formField} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.fechaMora`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Fecha de Mora</FormLabel>
                    <FormControl>
                      <Input {...formField} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`acreedores.${index}.diasMora`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Días en Mora</FormLabel>
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
            </div>

            {/* Valores monetarios */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name={`acreedores.${index}.valorCapital`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Valor Capital ($)</FormLabel>
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
                name={`acreedores.${index}.valorInteresesCorrientes`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Intereses Corrientes ($)</FormLabel>
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
                name={`acreedores.${index}.valorInteresesMora`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Intereses de Mora ($)</FormLabel>
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
                name={`acreedores.${index}.valorGastosCobranza`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Gastos de Cobranza ($)</FormLabel>
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
                name={`acreedores.${index}.valorTotalObligacion`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Valor Total Obligación ($)</FormLabel>
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
            </div>

            {/* Codeudores */}
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center space-x-3">
                <Switch
                  id={`acreedores.${index}.obligacionCodeudores`}
                  checked={obligacionCodeudores || false}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      `acreedores.${index}.obligacionCodeudores`,
                      checked,
                    )
                  }
                />
                <Label htmlFor={`acreedores.${index}.obligacionCodeudores`}>
                  La obligación tiene codeudores o avalistas
                </Label>
              </div>
              {obligacionCodeudores && (
                <FormField
                  control={form.control}
                  name={`acreedores.${index}.nombreCodeudores`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>Nombre(s) de Codeudores</FormLabel>
                      <FormControl>
                        <Input
                          {...formField}
                          placeholder="Nombres de codeudores o avalistas"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Garantía Asociada */}
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center space-x-3">
                <Switch
                  id={`acreedores.${index}.garantiaAsociada`}
                  checked={garantiaAsociada || false}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      `acreedores.${index}.garantiaAsociada`,
                      checked,
                    )
                  }
                />
                <Label htmlFor={`acreedores.${index}.garantiaAsociada`}>
                  La obligación tiene garantía asociada
                </Label>
              </div>
              {garantiaAsociada && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.tipoGarantia`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Tipo de Garantía</FormLabel>
                        <Select
                          onValueChange={formField.onChange}
                          value={formField.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="HIPOTECA">Hipoteca</SelectItem>
                            <SelectItem value="PRENDA">Prenda</SelectItem>
                            <SelectItem value="FIDUCIA">
                              Fiducia en Garantía
                            </SelectItem>
                            <SelectItem value="DEPOSITO">Depósito</SelectItem>
                            <SelectItem value="OTRO">Otra</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.descripcionGarantia`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Descripción de la Garantía</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Descripción del bien dado en garantía"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 5.3 Información Judicial */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              5.3 Información Judicial
            </h4>
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center space-x-3">
                <Switch
                  id={`acreedores.${index}.procesoJudicialEnCurso`}
                  checked={procesoJudicialEnCurso || false}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      `acreedores.${index}.procesoJudicialEnCurso`,
                      checked,
                    )
                  }
                />
                <Label htmlFor={`acreedores.${index}.procesoJudicialEnCurso`}>
                  Existe proceso judicial en curso relacionado con esta
                  obligación
                </Label>
              </div>
              {procesoJudicialEnCurso && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.tipoProcesoJudicial`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Tipo de Proceso</FormLabel>
                        <Select
                          onValueChange={formField.onChange}
                          value={formField.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                            <SelectItem value="ORDINARIO">Ordinario</SelectItem>
                            <SelectItem value="ABREVIADO">Abreviado</SelectItem>
                            <SelectItem value="MONITORIO">Monitorio</SelectItem>
                            <SelectItem value="VERBAL">Verbal</SelectItem>
                            <SelectItem value="OTRO">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.juzgadoNombre`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Nombre del Juzgado</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Ej: Juzgado 1 Civil Municipal"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.juzgadoCiudad`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Ciudad del Juzgado</FormLabel>
                        <FormControl>
                          <Input {...formField} placeholder="Ciudad" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.procesoJudicialRadicado`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Radicado</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Número de radicado"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.demandanteNombre`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Nombre del Demandante</FormLabel>
                        <FormControl>
                          <Input
                            {...formField}
                            placeholder="Nombre del demandante"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`acreedores.${index}.etapaProcesal`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Etapa Procesal</FormLabel>
                        <Select
                          onValueChange={formField.onChange}
                          value={formField.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione etapa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ADMISION">Admisión</SelectItem>
                            <SelectItem value="NOTIFICACION">
                              Notificación
                            </SelectItem>
                            <SelectItem value="PRUEBAS">Pruebas</SelectItem>
                            <SelectItem value="ALEGATOS">Alegatos</SelectItem>
                            <SelectItem value="SENTENCIA">Sentencia</SelectItem>
                            <SelectItem value="EJECUCION">Ejecución</SelectItem>
                            <SelectItem value="MEDIDAS_CAUTELARES">
                              Medidas Cautelares
                            </SelectItem>
                            <SelectItem value="OTRO">Otra</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

export function AcreedoresSection() {
  const form = useFormContext<CreateCaseFormInput>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'acreedores',
  });

  const addAcreedor = () => {
    append({
      acreedorTipo: '',
      acreedorNombreRazonSocial: '',
      acreedorTipoIdentificacion: '',
      acreedorIdentificacion: '',
      acreedorDireccion: '',
      acreedorCiudad: '',
      acreedorCorreo: '',
      acreedorTelefono: '',
      tipoObligacion: '',
      numeroObligacion: '',
      fechaOtorgamiento: '',
      fechaVencimiento: '',
      fechaMora: '',
      diasMora: 0,
      valorCapital: '',
      valorInteresesCorrientes: '',
      valorInteresesMora: '',
      valorGastosCobranza: '',
      valorTotalObligacion: '',
      naturalezaCredito: '',
      obligacionCodeudores: false,
      nombreCodeudores: '',
      garantiaAsociada: false,
      tipoGarantia: '',
      descripcionGarantia: '',
      procesoJudicialEnCurso: false,
      tipoProcesoJudicial: '',
      juzgadoNombre: '',
      juzgadoCiudad: '',
      procesoJudicialRadicado: '',
      demandanteNombre: '',
      etapaProcesal: '',
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sección V: Relación Completa de Acreedores
        </CardTitle>
        <CardDescription>
          Registre la información detallada de cada acreedor y sus obligaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, index) => (
          <AcreedorItem
            key={field.id}
            index={index}
            fieldId={field.id}
            onRemove={remove}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAcreedor}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Acreedor
        </Button>

        {fields.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p className="mb-4">No hay acreedores registrados</p>
            <p className="text-sm">
              Use el botón para agregar la relación completa de acreedores del
              deudor
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
