import { z } from 'zod';

export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
});

export type Permission = z.infer<typeof permissionSchema>;

export const getAllPermissionsSchema = z.array(permissionSchema);

export type GetAllPermissionsData = z.infer<typeof getAllPermissionsSchema>;
