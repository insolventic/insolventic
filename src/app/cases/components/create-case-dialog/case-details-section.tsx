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
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import type { AssignableOperator } from '@/features/user/schemas';

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
  /**
   * Usuarios del centro que pueden quedar como operador del caso
   * (`getAssignableOperators`). Vacío mientras se cargan.
   */
  operators?: readonly AssignableOperator[];
  /** Deshabilita el selector mientras la lista está en vuelo. */
  loadingOperators?: boolean;
}

export function CaseDetailsSection({
  showFilingDate = false,
  operators = [],
  loadingOperators = false,
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
          {/*
            Antes no existía: el diálogo de alta autoasignaba `operatorId` al
            primer usuario con rol de operadora o abogado, y si no había
            ninguno, al primer usuario de la lista — sin que nadie lo eligiera
            ni lo viera (issue #83). De ese campo dependen a quién le llegan
            las alertas del cron, qué casos ve cada quien con "Ver casos
            propios", y si un usuario se puede borrar.
          */}
          <FormField
            control={form.control}
            name="operatorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operador del caso</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ''}
                  disabled={loadingOperators || operators.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingOperators
                            ? 'Cargando usuarios…'
                            : operators.length === 0
                              ? 'No hay usuarios disponibles'
                              : 'Seleccione quién lleva el caso'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} — {op.roleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Recibe las alertas de audiencia y de pago vencido de este
                  expediente.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </div>
      </CardContent>
    </Card>
  );
}
