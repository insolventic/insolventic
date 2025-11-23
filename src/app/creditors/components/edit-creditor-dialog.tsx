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
  Edit,
  Building2,
  Users,
  Loader2,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { ContactManagement } from './contact-management';
import { CreditorTypeSelect } from './creditor-type-select';
import { updateCreditor } from '@/features/creditor/actions';
import { updateCreditorSchema } from '@/features/creditor/schemas';

import type { Creditor } from '@/features/creditor/schemas';
import type { Contact } from '@/features/contact/schemas';

interface EditCreditorDialogProps {
  creditor: Creditor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreditorUpdated?: () => void;
}

export function EditCreditorDialog({
  creditor,
  open,
  onOpenChange,
  onCreditorUpdated,
}: Readonly<EditCreditorDialogProps>) {
  const form = useForm({
    resolver: zodResolver(updateCreditorSchema),
    defaultValues: {
      id: '',
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

  const [localContacts, setLocalContacts] = useState<Contact[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (data: unknown) => {
    startTransition(async () => {
      const {
        success,
        data: updatedCreditor,
        error,
      } = await updateCreditor(data);

      if (success && updatedCreditor) {
        toast.success('Acreedor actualizado exitosamente', {
          description: `El acreedor ${updatedCreditor.name} ha sido actualizado correctamente`,
        });
        onOpenChange(false);
        onCreditorUpdated?.();
      } else {
        const message = error || 'Error al actualizar el acreedor';
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

  useEffect(() => {
    if (creditor) {
      let creditorType: 'BANK' | 'COOPERATIVE' | 'OTHER' = 'OTHER';
      if (creditor.type === 'Entidad Financiera') {
        creditorType = 'BANK';
      } else if (creditor.type === 'Cooperativa') {
        creditorType = 'COOPERATIVE';
      }

      form.reset({
        id: creditor.id,
        name: creditor.name,
        nit: creditor.nit,
        type: creditorType,
        email: creditor.email,
        phone: creditor.phone,
        address: creditor.address,
        city: creditor.city ?? '',
        department: creditor.department ?? '',
        representative: creditor.representative,
        representativeEmail: creditor.representativeEmail ?? '',
        representativePhone: creditor.representativePhone ?? '',
        website: creditor.website ?? '',
        description: creditor.description ?? '',
      });

      setLocalContacts(creditor.contacts || []);
    }
  }, [creditor, form]);

  const handleContactAdded = (newContact: Contact) => {
    setLocalContacts((prev) => [...prev, newContact]);
  };

  const handleContactDeleted = (deletedContactId: string) => {
    setLocalContacts((prev) =>
      prev.filter((contact) => contact.id !== deletedContactId),
    );
  };

  const handleContactUpdated = (updatedContact: Contact) => {
    setLocalContacts((prev) =>
      prev.map((contact) =>
        contact.id === updatedContact.id ? updatedContact : contact,
      ),
    );
  };

  if (!creditor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Acreedor
          </DialogTitle>
          <DialogDescription>
            Modifique la información del acreedor. Los campos marcados con * son
            obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">Información General</TabsTrigger>
                <TabsTrigger value="contact">
                  Información de Contacto
                </TabsTrigger>
                <TabsTrigger value="representative">
                  Representante Legal
                </TabsTrigger>
                <TabsTrigger value="contacts">Contactos</TabsTrigger>
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
                    <FormField
                      control={form.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem className="hidden">
                          <FormControl>
                            <Input type="hidden" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
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
                                placeholder="+57 300 123 4567"
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

              <TabsContent value="contacts" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Contactos Adicionales
                    </CardTitle>
                    <CardDescription>
                      Gestione los contactos adicionales del acreedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ContactManagement
                      contacts={localContacts}
                      creditorId={creditor.id}
                      onContactAdded={handleContactAdded}
                      onContactDeleted={handleContactDeleted}
                      onContactUpdated={handleContactUpdated}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
