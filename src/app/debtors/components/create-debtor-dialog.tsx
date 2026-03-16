'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { User, MapPin, CreditCard, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createDebtor } from '@/features/debtor/actions';
import { createDebtorSchema } from '@/features/debtor/schemas';
import { parseCurrencyInput } from '@/lib/utils';

interface CreateDebtorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebtorCreated?: () => void;
}

export function CreateDebtorDialog({
  open,
  onOpenChange,
  onDebtorCreated,
}: Readonly<CreateDebtorDialogProps>) {
  const form = useForm({
    resolver: zodResolver(createDebtorSchema),
    defaultValues: {
      name: '',
      idNumber: '',
      idType: 'CC',
      email: '',
      phone: '',
      address: '',
      city: '',
      department: '',
      occupation: '',
      monthlyIncome: 0,
      monthlyExpenses: 0,
      dependents: 0,
      maritalStatus: '',
      educationLevel: '',
      emergencyContact: '',
      emergencyPhone: '',
      bankAccount: '',
      bankName: '',
      accountType: 'AHORROS',
      description: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (data: unknown) => {
    startTransition(async () => {
      const { success, data: debtor, error } = await createDebtor(data);

      if (success && debtor) {
        toast.success('Deudor creado exitosamente', {
          description: `El deudor ${debtor.name} ha sido creado correctamente`,
        });
        form.reset();
        onOpenChange(false);
        onDebtorCreated?.();
      } else {
        const message = error || 'Error al crear el deudor';

        if (
          message &&
          (message.includes('Unique constraint failed') ||
            message.includes('P2002') ||
            message.includes('unique constraint'))
        ) {
          if (
            message.includes('idNumber') ||
            message.includes('(`idNumber`)')
          ) {
            toast.error(
              'Ya existe un deudor con este número de documento. Por favor verifique el número.',
            );
            return;
          }
          if (message.includes('email') || message.includes('(`email`)')) {
            toast.error(
              'Ya existe un deudor con este email. Por favor use otro email.',
            );
            return;
          }
          toast.error(
            'Ya existe un deudor con estos datos. Por favor verifique la información.',
          );
          return;
        }

        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Nuevo Deudor</DialogTitle>
          <DialogDescription>
            Registre la información personal y financiera del deudor
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="financial">Financiero</TabsTrigger>
                <TabsTrigger value="contact">Contacto</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <User className="mr-2 h-5 w-5" />
                      Información Personal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="María González Pérez"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CC">
                                Cédula de Ciudadanía
                              </SelectItem>
                              <SelectItem value="CE">
                                Cédula de Extranjería
                              </SelectItem>
                              <SelectItem value="PA">Pasaporte</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento</FormLabel>
                          <FormControl>
                            <Input placeholder="52123456" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Civil</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione estado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SOLTERO">
                                Soltero(a)
                              </SelectItem>
                              <SelectItem value="CASADO">Casado(a)</SelectItem>
                              <SelectItem value="UNION_LIBRE">
                                Unión Libre
                              </SelectItem>
                              <SelectItem value="DIVORCIADO">
                                Divorciado(a)
                              </SelectItem>
                              <SelectItem value="VIUDO">Viudo(a)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dependents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personas a Cargo</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              value={field.value as number}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financial" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <CreditCard className="mr-2 h-5 w-5" />
                      Información Financiera
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ocupación</FormLabel>
                          <FormControl>
                            <Input placeholder="Empleado" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="educationLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nivel Educativo</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione nivel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PRIMARIA">Primaria</SelectItem>
                              <SelectItem value="SECUNDARIA">
                                Secundaria
                              </SelectItem>
                              <SelectItem value="TECNICO">Técnico</SelectItem>
                              <SelectItem value="UNIVERSITARIO">
                                Universitario
                              </SelectItem>
                              <SelectItem value="POSTGRADO">
                                Postgrado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthlyIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ingresos Mensuales</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                                $
                              </span>
                              <Input
                                type="text"
                                className="pl-8"
                                placeholder="2.500.000"
                                value={
                                  field.value
                                    ? Number(field.value).toLocaleString(
                                        'es-CO',
                                      )
                                    : ''
                                }
                                onChange={(e) => {
                                  const value = parseCurrencyInput(
                                    e.target.value,
                                  );
                                  field.onChange(value ? parseInt(value) : 0);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthlyExpenses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gastos Mensuales</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                                $
                              </span>
                              <Input
                                type="text"
                                className="pl-8"
                                placeholder="2.000.000"
                                value={
                                  field.value
                                    ? Number(field.value).toLocaleString(
                                        'es-CO',
                                      )
                                    : ''
                                }
                                onChange={(e) => {
                                  const value = parseCurrencyInput(
                                    e.target.value,
                                  );
                                  field.onChange(value ? parseInt(value) : 0);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banco</FormLabel>
                          <FormControl>
                            <Input placeholder="Bancolombia" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Cuenta</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AHORROS">Ahorros</SelectItem>
                              <SelectItem value="CORRIENTE">
                                Corriente
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankAccount"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Número de Cuenta</FormLabel>
                          <FormControl>
                            <Input placeholder="1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <MapPin className="mr-2 h-5 w-5" />
                      Información de Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="maria@email.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+57 300 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Dirección</FormLabel>
                          <FormControl>
                            <Input placeholder="Calle 45 #12-34" {...field} />
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
                            <Input placeholder="Bogotá" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <FormControl>
                            <Input placeholder="Cundinamarca" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contacto de Emergencia</FormLabel>
                          <FormControl>
                            <Input placeholder="Pedro González" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono de Emergencia</FormLabel>
                          <FormControl>
                            <Input placeholder="+57 311 234-5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Notas Adicionales</FormLabel>
                          <FormControl>
                            <textarea
                              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                              rows={3}
                              placeholder="Información adicional..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Deudor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
