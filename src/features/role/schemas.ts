import { z } from 'zod';

import { userSummarySchema } from '@/features/user/schemas';

export const roleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre del rol es obligatorio'),
  description: z.string(),
  permissions: z
    .array(z.string())
    .min(1, 'Debe seleccionar al menos un permiso'),
  color: z.string().min(1, 'El color es requerido'),
  users: z.array(userSummarySchema),
});

export type Role = z.infer<typeof roleSchema>;

export const createRoleSchema = roleSchema.omit({ id: true, users: true });

export type CreateRoleData = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = roleSchema.omit({ users: true }).partial();

export type UpdateRoleData = z.infer<typeof updateRoleSchema>;
