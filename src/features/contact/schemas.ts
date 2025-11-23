import { z } from 'zod';

const creditorForContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  nit: z.string(),
  type: z.string(),
});

export const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  creditorId: z.string(),
});

export type Contact = z.infer<typeof contactSchema>;

export const contactWithCreditorSchema = contactSchema.extend({
  creditor: creditorForContactSchema,
});

export type ContactWithCreditor = z.infer<typeof contactWithCreditorSchema>;

export const createContactSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  role: z.string().min(1, 'El rol es requerido'),
});

export type CreateContactData = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().min(1, 'El teléfono es requerido').optional(),
  role: z.string().min(1, 'El rol es requerido').optional(),
});

export type UpdateContactData = z.infer<typeof updateContactSchema>;

export const deleteContactSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
});

export type DeleteContactData = z.infer<typeof deleteContactSchema>;

export const addContactToCreditorSchema = createContactSchema.extend({
  creditorId: z.string().min(1, 'El ID del acreedor es requerido'),
});

export type AddContactToCreditorData = z.infer<
  typeof addContactToCreditorSchema
>;

export const getAllContactsSchema = z.array(contactWithCreditorSchema);
export const getContactByIdSchema = z.string();
