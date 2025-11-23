'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';

import { updateContact } from '@/features/contact/actions';
import { updateContactSchema } from '@/features/contact/schemas';
import type { UpdateContactData, Contact } from '@/features/contact/schemas';

interface EditContactDialogProps extends React.ComponentProps<typeof Dialog> {
  contact: Contact | null;
  onContactUpdated?: (updatedContact: Contact) => void;
}

export function EditContactDialog({
  contact,
  onContactUpdated,
  onOpenChange,
  ...props
}: Readonly<EditContactDialogProps>) {
  const form = useForm<UpdateContactData>({
    resolver: zodResolver(updateContactSchema),
    defaultValues: {
      id: '',
      name: '',
      email: '',
      phone: '',
      role: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (data: UpdateContactData) => {
    startTransition(async () => {
      const {
        success,
        data: updatedContact,
        error,
      } = await updateContact(data);

      if (success && updatedContact) {
        toast.success('Contacto actualizado exitosamente', {
          description: `El contacto ${updatedContact.name} ha sido actualizado correctamente`,
        });
        onContactUpdated?.(updatedContact);
        onOpenChange?.(false);
      } else {
        toast.error(error || 'Error al actualizar el contacto');
      }
    });
  };

  useEffect(() => {
    if (contact) {
      form.reset({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
      });
    }
  }, [contact, form]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange?.(open);
  };

  if (!contact) return null;

  return (
    <Dialog onOpenChange={handleOpenChange} {...props}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Contacto</DialogTitle>
          <DialogDescription>
            Modifique la información del contacto
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del contacto"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cargo o posición"
                        {...field}
                        disabled={isPending}
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contacto@ejemplo.com"
                        {...field}
                        disabled={isPending}
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
                      <Input
                        placeholder="+57 300 123 4567"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar Contacto
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
