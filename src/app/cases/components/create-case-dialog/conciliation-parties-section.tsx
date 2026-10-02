'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp, UserPlus } from 'lucide-react';

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

export function ConciliationPartiesSection() {
  const { register, setValue, watch } = useFormContext();
  const [showRepLegal, setShowRepLegal] = useState(false);
  const [showApoderadoConvocante, setShowApoderadoConvocante] = useState(false);
  const [showApoderadoConvocado, setShowApoderadoConvocado] = useState(false);

  return (
    <div className="space-y-6">
      {/* Convocado (contraparte) */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Convocado (Contraparte)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nombre completo / Razón social *</Label>
            <Input
              {...register('concConvocadoName')}
              placeholder="Nombre del convocado"
            />
          </div>
          <div>
            <Label>Tipo de identificación</Label>
            <Select
              value={watch('concConvocadoTipoId') || 'CC'}
              onValueChange={(v) => setValue('concConvocadoTipoId', v)}
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
            <Input {...register('concConvocadoId')} placeholder="Número" />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              {...register('concConvocadoDireccion')}
              placeholder="Dirección del convocado"
            />
          </div>
          <div>
            <Label>Ciudad</Label>
            <Input {...register('concConvocadoCiudad')} placeholder="Ciudad" />
          </div>
          <div>
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              {...register('concConvocadoCorreo')}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <Label>Celular</Label>
            <Input {...register('concConvocadoCel')} placeholder="Teléfono" />
          </div>
        </div>
      </fieldset>

      {/* Representante Legal (optional) */}
      <button
        type="button"
        className="flex w-full items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        onClick={() => setShowRepLegal(!showRepLegal)}
      >
        <UserPlus className="h-4 w-4" />
        Representante Legal (opcional)
        {showRepLegal ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {showRepLegal && (
        <fieldset className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <legend className="px-2 text-sm font-semibold text-blue-700">
            Representante Legal
          </legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nombre completo</Label>
              <Input
                {...register('concRepLegalName')}
                placeholder="Nombre del representante legal"
              />
            </div>
            <div>
              <Label>Tipo ID</Label>
              <Select
                value={watch('concRepLegalTipoId') || 'CC'}
                onValueChange={(v) => setValue('concRepLegalTipoId', v)}
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
              <Label>Número ID</Label>
              <Input {...register('concRepLegalId')} placeholder="Número" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input {...register('concRepLegalDireccion')} />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input {...register('concRepLegalCiudad')} />
            </div>
            <div>
              <Label>Correo</Label>
              <Input type="email" {...register('concRepLegalCorreo')} />
            </div>
            <div>
              <Label>Celular</Label>
              <Input {...register('concRepLegalCel')} />
            </div>
          </div>
        </fieldset>
      )}

      {/* Apoderado Convocante (optional) */}
      <button
        type="button"
        className="flex w-full items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-800"
        onClick={() => setShowApoderadoConvocante(!showApoderadoConvocante)}
      >
        <UserPlus className="h-4 w-4" />
        Apoderado del Convocante (opcional)
        {showApoderadoConvocante ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {showApoderadoConvocante && (
        <fieldset className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
          <legend className="px-2 text-sm font-semibold text-purple-700">
            Apoderado del Convocante
          </legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nombre completo</Label>
              <Input
                {...register('concApoderadoConvocanteName')}
                placeholder="Dr(a). Nombre Completo"
              />
            </div>
            <div>
              <Label>Tipo ID</Label>
              <Select
                value={watch('concApoderadoConvocanteTipoId') || 'CC'}
                onValueChange={(v) =>
                  setValue('concApoderadoConvocanteTipoId', v)
                }
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
              <Label>Número ID</Label>
              <Input {...register('concApoderadoConvocanteId')} />
            </div>
            <div>
              <Label>Tarjeta Profesional</Label>
              <Input
                {...register('concApoderadoConvocanteTP')}
                placeholder="TP-XXXXXX"
              />
            </div>
            <div>
              <Label>Correo</Label>
              <Input
                type="email"
                {...register('concApoderadoConvocanteCorreo')}
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input {...register('concApoderadoConvocanteCel')} />
            </div>
          </div>
        </fieldset>
      )}

      {/* Apoderado Convocado (optional) */}
      <button
        type="button"
        className="flex w-full items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-800"
        onClick={() => setShowApoderadoConvocado(!showApoderadoConvocado)}
      >
        <UserPlus className="h-4 w-4" />
        Apoderado del Convocado (opcional)
        {showApoderadoConvocado ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {showApoderadoConvocado && (
        <fieldset className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
          <legend className="px-2 text-sm font-semibold text-purple-700">
            Apoderado del Convocado
          </legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="concApoderadoConvocadoName">
                Nombre completo
              </Label>
              <Input
                id="concApoderadoConvocadoName"
                {...register('concApoderadoConvocadoName')}
                placeholder="Dr(a). Nombre Completo"
              />
            </div>
            <div>
              <Label htmlFor="concApoderadoConvocadoTipoId">Tipo ID</Label>
              <Select
                value={watch('concApoderadoConvocadoTipoId') || 'CC'}
                onValueChange={(v) =>
                  setValue('concApoderadoConvocadoTipoId', v)
                }
              >
                <SelectTrigger id="concApoderadoConvocadoTipoId">
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
              <Label htmlFor="concApoderadoConvocadoId">Número ID</Label>
              <Input
                id="concApoderadoConvocadoId"
                {...register('concApoderadoConvocadoId')}
              />
            </div>
            <div>
              <Label htmlFor="concApoderadoConvocadoTP">
                Tarjeta Profesional
              </Label>
              <Input
                id="concApoderadoConvocadoTP"
                {...register('concApoderadoConvocadoTP')}
                placeholder="TP-XXXXXX"
              />
            </div>
            <div>
              <Label htmlFor="concApoderadoConvocadoCorreo">Correo</Label>
              <Input
                id="concApoderadoConvocadoCorreo"
                type="email"
                {...register('concApoderadoConvocadoCorreo')}
              />
            </div>
            <div>
              <Label htmlFor="concApoderadoConvocadoCel">Celular</Label>
              <Input
                id="concApoderadoConvocadoCel"
                {...register('concApoderadoConvocadoCel')}
              />
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );
}
