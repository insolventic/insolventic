'use server';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { getAllPermissionsSchema } from './schemas';
import type { Permission } from './schemas';

export async function getAllPermissions(): Promise<{
  success: boolean;
  data?: Permission[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver roles')) {
      throw new Error('No tiene permisos para: Ver roles');
    }

    const permissions = await prisma.permission.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const validated = getAllPermissionsSchema.parse(permissions);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener permisos',
    };
  }
}
