import { z } from 'zod';

const roleForUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  color: z.string(),
});

/**
 * Base de los esquemas de ENTRADA y del formulario de edición. Todavía declara
 * `password`, aunque crear y editar lo omiten y ninguna entrada lo acepta, así
 * que NO sirve para parsear lo que sale hacia el cliente: para eso están
 * `userOutputSchema` y `userSummarySchema`.
 *
 * Un campo nuevo acá no sale solo: la salida es una lista cerrada. Antes de
 * agregarlo a ella hay que revisar quién la recibe, en especial si es sensible,
 * como los datos de Zoom que se proponen para `User` (código de acceso incluido).
 */
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

/** Usuario tal como sale hacia el cliente. Nunca lleva `password`. */
export const userOutputSchema = userSchema.pick({
  id: true,
  name: true,
  email: true,
  professionalCard: true,
  phone: true,
  address: true,
  roleId: true,
  lastLogin: true,
  createdDate: true,
  role: true,
  assignedCases: true,
});

export type User = z.infer<typeof userOutputSchema>;

export const createUserSchema = userSchema.omit({
  id: true,
  role: true,
  lastLogin: true,
  createdDate: true,
  assignedCases: true,
  password: true,
});

export type CreateUserData = z.infer<typeof createUserSchema>;

/**
 * Sin `password`: editar un usuario no cambia su contraseña. Para eso están
 * `changePassword` y `forgotPassword`. `updateUser` rechaza el campo de forma
 * explícita, porque aquí Zod solo lo descartaría.
 */
export const updateUserSchema = userSchema
  .omit({
    role: true,
    lastLogin: true,
    createdDate: true,
    assignedCases: true,
    password: true,
  })
  .partial()
  .required({ id: true });

export type UpdateUserData = z.infer<typeof updateUserSchema>;

export const userSummarySchema = userOutputSchema.omit({
  role: true,
  assignedCases: true,
});

export type UserSummaryData = z.infer<typeof userSummarySchema>;

/**
 * Usuario tal como lo necesita el selector de operador de un caso.
 *
 * Lo mínimo para pintar la opción. A propósito sin correo, teléfono, cédula
 * profesional ni permisos del rol: el selector lo usan roles que NO tienen
 * `Ver usuarios`, así que exponerles el usuario completo sería darles por la
 * puerta de atrás lo que ese permiso les niega.
 */
export const assignableOperatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  roleName: z.string(),
});

export type AssignableOperator = z.infer<typeof assignableOperatorSchema>;
