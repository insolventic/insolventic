'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIPO_ID_OPTIONS = ['CC', 'CE', 'NIT', 'TI', 'PP', 'PEP'] as const;

const RELACION_OPTIONS = [
  'Cónyuge / Compañero(a)',
  'Padre / Madre',
  'Hijo(a)',
  'Hermano(a)',
  'Familiar',
  'Empleador',
  'Amigo(a)',
  'Otro',
] as const;

export function SupportAgreementPartiesSection() {
  const { register, setValue, watch } = useFormContext();
  const [showPrestadorExtra, setShowPrestadorExtra] = useState(false);

  return (
    <div className="space-y-6">
      {/* Beneficiario (quien recibe el apoyo) */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Beneficiario (quien recibe el apoyo)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nombre completo / Razón social *</Label>
            <Input
              {...register('apoyoBeneficiarioName')}
              placeholder="Nombre del beneficiario"
            />
          </div>
          <div>
            <Label>Tipo de identificación</Label>
            <Select
              value={watch('apoyoBeneficiarioTipoId') || 'CC'}
              onValueChange={(v) => setValue('apoyoBeneficiarioTipoId', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_ID_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número de identificación *</Label>
            <Input
              {...register('apoyoBeneficiarioId')}
              placeholder="Número de documento"
            />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              {...register('apoyoBeneficiarioDireccion')}
              placeholder="Dirección de contacto"
            />
          </div>
          <div>
            <Label>Ciudad / Municipio</Label>
            <Input
              {...register('apoyoBeneficiarioCiudad')}
              placeholder="Ciudad"
            />
          </div>
          <div>
            <Label>Correo electrónico</Label>
            <Input
              {...register('apoyoBeneficiarioCorreo')}
              type="email"
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <Label>Teléfono / Celular</Label>
            <Input
              {...register('apoyoBeneficiarioCel')}
              placeholder="Número de contacto"
            />
          </div>
        </div>
      </fieldset>

      {/* Prestador de apoyo (quien se compromete) */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Prestador de apoyo (quien se compromete)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nombre completo / Razón social *</Label>
            <Input
              {...register('apoyoPrestadorName')}
              placeholder="Nombre del prestador"
            />
          </div>
          <div>
            <Label>Tipo de identificación</Label>
            <Select
              value={watch('apoyoPrestadorTipoId') || 'CC'}
              onValueChange={(v) => setValue('apoyoPrestadorTipoId', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_ID_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número de identificación *</Label>
            <Input
              {...register('apoyoPrestadorId')}
              placeholder="Número de documento"
            />
          </div>
          <div>
            <Label>Relación con el beneficiario</Label>
            <Select
              value={watch('apoyoPrestadorRelacion') || ''}
              onValueChange={(v) => setValue('apoyoPrestadorRelacion', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar relación" />
              </SelectTrigger>
              <SelectContent>
                {RELACION_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Teléfono / Celular</Label>
            <Input
              {...register('apoyoPrestadorCel')}
              placeholder="Número de contacto"
            />
          </div>
          <div>
            <Label>Correo electrónico</Label>
            <Input
              {...register('apoyoPrestadorCorreo')}
              type="email"
              placeholder="correo@ejemplo.com"
            />
          </div>

          {/* Datos adicionales del prestador (colapsable) */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setShowPrestadorExtra((v) => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              {showPrestadorExtra ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {showPrestadorExtra
                ? 'Ocultar datos adicionales'
                : 'Agregar dirección y ciudad del prestador'}
            </button>
          </div>

          {showPrestadorExtra && (
            <>
              <div>
                <Label>Dirección</Label>
                <Input
                  {...register('apoyoPrestadorDireccion')}
                  placeholder="Dirección del prestador"
                />
              </div>
              <div>
                <Label>Ciudad / Municipio</Label>
                <Input
                  {...register('apoyoPrestadorCiudad')}
                  placeholder="Ciudad"
                />
              </div>
            </>
          )}
        </div>
      </fieldset>

      {/* Conciliadora asignada */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Conciliadora asignada
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label>Nombre completo</Label>
            <Input
              {...register('apoyoConciliadoraName')}
              placeholder="Nombre de la conciliadora"
            />
          </div>
          <div>
            <Label>Cédula</Label>
            <Input {...register('apoyoConciliadoraCC')} placeholder="C.C." />
          </div>
          <div>
            <Label>Tarjeta profesional</Label>
            <Input
              {...register('apoyoConciliadoraTP')}
              placeholder="No. T.P."
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
