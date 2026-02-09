'use client';

import type { Contact } from '@/features/contact/schemas';

import { ContactsTable } from './contacts-table';

interface ContactManagementProps {
  contacts: Contact[];
  creditorId: string;
  onContactAdded?: (newContact: Contact) => void;
  onContactDeleted?: (deletedContactId: string) => void;
  onContactUpdated?: (updatedContact: Contact) => void;
}

export function ContactManagement({
  contacts,
  creditorId,
  onContactAdded,
  onContactDeleted,
  onContactUpdated,
}: Readonly<ContactManagementProps>) {
  return (
    <ContactsTable
      contacts={contacts}
      creditorId={creditorId}
      onContactAdded={onContactAdded}
      onContactDeleted={onContactDeleted}
      onContactUpdated={onContactUpdated}
    />
  );
}
