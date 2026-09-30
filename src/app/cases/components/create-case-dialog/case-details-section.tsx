'use client';

import { FileText } from 'lucide-react';
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

interface CaseDetailsSectionProps {
  /**
   * Muestra la fecha de radicación.
   *
   * Apagado por defecto: la radicación la hace el centro de conciliación, no el
   * deudor, así que en el wizard de alta el campo no tiene quién lo responda y
   * salía en blanco o con la fecha equivocada. Su lugar es la pantalla del
   * operador (`case-details-dialog/pre-generation-form.tsx`), que la exige antes
   * de generar el paquete de Admisión.
   *
   * El diálogo de edición sí lo enciende: es una pantalla de operador y ahí
   * corregir la fecha de un expediente ya creado es legítimo.
   */
  showFilingDate?: boolean;
}

export function CaseDetailsSection({
  showFilingDate = false,
}: Readonly<CaseDetailsSectionProps> = {}) {
  const form = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Datos del Caso
        </CardTitle>
        <CardDescription>
          Información complementaria de la solicitud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {showFilingDate && (
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
          )}

          <FormField
            control={form.control}
            name="attorney"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apoderado</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nombre del apoderado (si aplica)"
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
  );
}
