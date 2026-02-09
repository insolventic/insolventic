'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { CreateContactDialog } from './create-contact-dialog';

import type { Contact } from '@/features/contact/schemas';

interface CreateContactButtonProps {
  creditorId: string;
  onContactAdded?: (newContact: Contact) => void;
  variant?: 'default' | 'outline';
}

export function CreateContactButton({
  creditorId,
  onContactAdded,
  variant = 'outline',
}: Readonly<CreateContactButtonProps>) {
  const [showDialog, setShowDialog] = useState(false);

  const handleContactAdded = (newContact: Contact) => {
    onContactAdded?.(newContact);
    setShowDialog(false);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowDialog(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Contacto
      </Button>
      <CreateContactDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        creditorId={creditorId}
        onContactAdded={handleContactAdded}
      />
    </>
  );
}
