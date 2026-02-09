'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Hash,
  Globe,
  Plus,
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Textarea } from '@/components/ui/textarea';

import { CreditorTypeSelect } from './creditor-type-select';
import { createCreditor } from '@/features/creditor/actions';
import { createCreditorSchema } from '@/features/creditor/schemas';

interface CreateCreditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreditorCreated?: () => void;
}

export function CreateCreditorDialog({
  open,
  onOpenChange,
  onCreditorCreated,
}: Readonly<CreateCreditorDialogProps>) {
  const form = useForm({
    resolver: zodResolver(createCreditorSchema),
    defaultValues: {
      name: '',
      nit: '',
      type: 'BANK',
      email: '',
      phone: '',
      address: '',
      city: '',
      department: '',
      representative: '',
      representativeEmail: '',
      representativePhone: '',
      website: '',
      description: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (data: unknown) => {
    startTransition(async () => {
      const { success, data: creditor, error } = await createCreditor(data);

      if (success && creditor) {
        toast.success('Acreedor creado exitosamente', {
          description: `El acreedor ${creditor.name} ha sido creado correctamente`,
        });
        form.reset();
        onOpenChange(false);
        onCreditorCreated?.();
      } else {
        const message = error || 'Error al crear el acreedor';
        if (
          message.includes('Unique constraint failed') ||
          message.includes('P2002') ||
          message.includes('unique constraint')
        ) {
          if (message.includes('nit') || message.includes('(`nit`)')) {
            toast.error(
              'Ya existe un acreedor con este NIT. Por favor verifique el número.',
            );
            return;
          }
          if (message.includes('email') || message.includes('(`email`)')) {
            toast.error(
              'Ya existe un acreedor con este email. Por favor use otro email.',
            );
            return;
          }
          toast.error(
            'Ya existe un acreedor con estos datos. Por favor verifique la información.',
          );
          return;
        }

        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear Nuevo Acreedor
          </DialogTitle>
          <DialogDescription>
            Complete la información del nuevo acreedor. Los campos marcados con
            * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Información General</TabsTrigger>
                <TabsTrigger value="contact">
                  Información de Contacto
                </TabsTrigger>
                <TabsTrigger value="representative">
                  Representante Legal
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building className="h-4 w-4" />
                      Datos de la Empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              Nombre *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nombre del acreedor"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Hash className="h-4 w-4" />
                              NIT *
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="123456789-0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Tipo *
                            </FormLabel>
                            <FormControl>
                              <CreditorTypeSelect
                                value={field.value ?? ''}
                                onValueChange={field.onChange}
                                placeholder="Seleccione el tipo"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              Sitio Web
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="www.ejemplo.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Descripción
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descripción del acreedor..."
                              className="resize-none"
                              rows={4}
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

              <TabsContent value="contact" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Phone className="h-4 w-4" />
                      Información de Contacto
                    </CardTitle>
                    <CardDescription>
                      Datos de contacto principal del acreedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email *
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="correo@ejemplo.com"
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
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Teléfono *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+57 300 123 4567"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 font-medium">
                        <MapPin className="h-4 w-4" />
                        Dirección
                      </h4>
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dirección Completa *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Calle 123 # 45-67"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="representative" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4" />
                      Representante Legal
                    </CardTitle>
                    <CardDescription>
                      Información del representante legal del acreedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="representative"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Nombre Completo *
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Juan Pérez García" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="representativeEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email del Representante
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="representante@ejemplo.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="representativePhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Teléfono del Representante
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+57 300 987 6543"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Acreedor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
