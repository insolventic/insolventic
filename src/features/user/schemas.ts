import { z } from 'zod';

const roleForUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  color: z.string(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  professionalCard: z
    .string()
    .refine((val) => val.length > 0, 'La tarjeta profesional es requerida'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  roleId: z.string().min(1, 'El rol es requerido'),
  password: z.string().nullable(),
  lastLogin: z.date().nullable(),
  createdDate: z.date(),
  role: roleForUserSchema,
  assignedCases: z.array(z.object({ id: z.string() })),
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.omit({
  id: true,
  role: true,
  lastLogin: true,
  createdDate: true,
  assignedCases: true,
  password: true,
});

export type CreateUserData = z.infer<typeof createUserSchema>;

export const updateUserSchema = userSchema
  .omit({
    role: true,
    lastLogin: true,
    createdDate: true,
    assignedCases: true,
  })
  .partial()
  .required({ id: true });

export type UpdateUserData = z.infer<typeof updateUserSchema>;

export const userSummarySchema = userSchema.omit({
  role: true,
  assignedCases: true,
});

export type UserSummaryData = z.infer<typeof userSummarySchema>;
