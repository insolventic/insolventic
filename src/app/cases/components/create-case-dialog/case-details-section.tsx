'use client';

import { Calendar, FileText, Video } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

export function CaseDetailsSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Información Básica del Caso
          </CardTitle>
          <CardDescription>
            Datos fundamentales del trámite de insolvencia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="tramite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trámite</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ingrese el trámite"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="filingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Radicación</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="debtorIdNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula del Deudor</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número de cédula"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attorney"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apoderado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre del apoderado"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owedCapital"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capital Adeudado</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="designatedOperator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operador Designado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre del operador designado"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="convened"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Convocado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre del convocado"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Fechas Importantes
          </CardTitle>
          <CardDescription>
            Cronología del proceso de insolvencia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="designationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Designación</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="positionAcceptanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Aceptación del Cargo</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inadmissionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inadmisión</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="admissionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Admisión</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstHearingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Primera Audiencia</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstHearingTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de Primera Audiencia</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Datos de Audiencia Virtual (Zoom)
          </CardTitle>
          <CardDescription>
            Información para la audiencia virtual por Zoom
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="zoomMeetingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID de Reunión Zoom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: 123 456 7890"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zoomPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Acceso</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Código de la reunión"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zoomLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enlace de Zoom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://zoom.us/j/..."
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
