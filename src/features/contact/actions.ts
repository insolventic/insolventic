'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';

import {
  contactSchema,
  contactWithCreditorSchema,
  updateContactSchema,
  deleteContactSchema,
  addContactToCreditorSchema,
  getAllContactsSchema,
  getContactByIdSchema,
} from './schemas';

import type { Contact, ContactWithCreditor } from './schemas';

export async function getAllContacts(): Promise<{
  success: boolean;
  data?: ContactWithCreditor[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver acreedores')) {
      throw new Error('No tiene permisos para: Ver acreedores');
    }

    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
      },
      include: {
        creditor: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const validated = getAllContactsSchema.parse(contacts);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener contactos',
    };
  }
}

export async function getContactById(id: string): Promise<{
  success: boolean;
  data?: ContactWithCreditor;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver acreedores')) {
      throw new Error('No tiene permisos para: Ver acreedores');
    }

    // Validate input
    const validatedId = getContactByIdSchema.parse(id);

    const contact = await prisma.contact.findUnique({
      where: {
        id: validatedId,
        tenantId,
      },
      include: {
        creditor: true,
      },
    });

    if (!contact) {
      throw new Error('Contacto no encontrado');
    }

    const validated = contactWithCreditorSchema.parse(contact);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error fetching contact:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener contacto',
    };
  }
}

export async function addContactToCreditor(input: unknown): Promise<{
  success: boolean;
  data?: Contact;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Crear acreedores')) {
      throw new Error('No tiene permisos para: Crear acreedores');
    }

    // Validate input
    const validatedInput = addContactToCreditorSchema.parse(input);
    const { creditorId, ...contactData } = validatedInput;

    const contact = await prisma.contact.create({
      data: {
        ...contactData,
        creditorId,
        tenantId,
      },
    });

    revalidatePath('/creditors');

    const validated = contactSchema.parse(contact);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error creating contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear contacto',
    };
  }
}

export async function updateContact(input: unknown): Promise<{
  success: boolean;
  data?: Contact;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Editar acreedores')) {
      throw new Error('No tiene permisos para: Editar acreedores');
    }

    // Validate input
    const validatedInput = updateContactSchema.parse(input);
    const { id, ...data } = validatedInput;

    const contact = await prisma.contact.update({
      where: {
        id,
        tenantId,
      },
      data,
    });

    revalidatePath('/contacts');
    revalidatePath('/creditors');

    const validated = contactSchema.parse(contact);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error updating contact:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al actualizar contacto',
    };
  }
}

export async function deleteContact(input: unknown): Promise<{
  success: boolean;
  data?: Contact;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Eliminar acreedores')) {
      throw new Error('No tiene permisos para: Eliminar acreedores');
    }

    // Validate input
    const { id } = deleteContactSchema.parse(input);

    const deletedContact = await prisma.contact.delete({
      where: {
        id,
        tenantId,
      },
    });

    revalidatePath('/contacts');
    revalidatePath('/creditors');

    const validated = contactSchema.parse(deletedContact);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error deleting contact:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al eliminar contacto',
    };
  }
}
