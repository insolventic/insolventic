'use client';

import { useState } from 'react';
import { Mail, Phone, User, Edit, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { CreateContactButton } from './create-contact-button';
import { EditContactDialog } from './edit-contact-dialog';
import { DeleteContactDialog } from './delete-contact-dialog';

import type { Contact } from '@/features/contact/schemas';

interface ContactsTableProps {
  contacts: Contact[];
  creditorId: string;
  onContactAdded?: (newContact: Contact) => void;
  onContactDeleted?: (deletedContactId: string) => void;
  onContactUpdated?: (updatedContact: Contact) => void;
}

export function ContactsTable({
  contacts,
  creditorId,
  onContactAdded,
  onContactDeleted,
  onContactUpdated,
}: Readonly<ContactsTableProps>) {
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  const handleContactUpdated = (updatedContact: Contact) => {
    onContactUpdated?.(updatedContact);
    setEditingContact(null);
  };

  const handleContactDeleted = (deletedContactId: string) => {
    onContactDeleted?.(deletedContactId);
    setDeletingContact(null);
  };

  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contactos Adicionales
              </CardTitle>
              <CardDescription>
                Gestione los contactos adicionales del acreedor
              </CardDescription>
            </div>
            <CreateContactButton
              creditorId={creditorId}
              onContactAdded={onContactAdded}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <User className="text-muted-foreground mx-auto h-12 w-12" />
            <h3 className="mt-4 text-lg font-semibold">No hay contactos</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Comience agregando un contacto adicional para este acreedor.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contactos Adicionales ({contacts.length})
              </CardTitle>
              <CardDescription>
                Gestione los contactos adicionales del acreedor
              </CardDescription>
            </div>
            <CreateContactButton
              creditorId={creditorId}
              onContactAdded={onContactAdded}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="text-muted-foreground h-4 w-4" />
                        <span className="font-medium">{contact.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm">{contact.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="text-muted-foreground h-4 w-4" />
                          <span className="text-sm">{contact.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.role ? (
                        <Badge variant="outline">{contact.role}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingContact(contact);
                          }}
                          title="Editar contacto"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingContact(contact);
                          }}
                          title="Eliminar contacto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
          onContactUpdated={handleContactUpdated}
        />
      )}

      {deletingContact && (
        <DeleteContactDialog
          contact={deletingContact}
          open={!!deletingContact}
          onOpenChange={(open) => !open && setDeletingContact(null)}
          onContactDeleted={handleContactDeleted}
        />
      )}
    </>
  );
}
