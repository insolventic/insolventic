'use client';

import { Scale, FileCheck } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { LegalProcessesSection } from './legal-processes-section';

export function LegalProcessSection() {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      {/* Dynamic Legal Processes */}
      <LegalProcessesSection />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Detalles del Proceso Legal
          </CardTitle>
          <CardDescription>
            Información sobre procesos judiciales en contra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="courtNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Juzgado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Juzgado 1 Civil"
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
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ciudad del proceso"
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
              name="processType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Proceso</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de proceso" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                        <SelectItem value="ORDINARIO">Ordinario</SelectItem>
                        <SelectItem value="ABREVIADO">Abreviado</SelectItem>
                        <SelectItem value="MONITORIO">Monitorio</SelectItem>
                        <SelectItem value="VERBAL">Verbal</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plaintiff"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Demandante</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre del demandante"
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
              name="judicialFileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No. Radicado Judicial</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número de radicado"
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
              name="suspensionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Suspensión</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resultDeliveryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Entrega de Resultado</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
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
            <FileCheck className="h-5 w-5" />
            Información del Resultado
          </CardTitle>
          <CardDescription>
            Detalles sobre el resultado del proceso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="resultType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Resultado</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el resultado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FRACASO">Fracaso</SelectItem>
                        <SelectItem value="ACUERDO">Acuerdo</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resultDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Resultado</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siccacNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de SICCAC</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número de SICCAC"
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
