'use server';

import { revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { createNotificationForAction } from '@/features/notification/actions';

import { createRoleSchema, updateRoleSchema, roleSchema } from './schemas';
import type { Role } from './schemas';

export async function getAllRoles(): Promise<{
  success: boolean;
  data?: Role[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver roles')) {
      throw new Error('No tiene permisos para: Ver roles');
    }

    const roles = await prisma.role.findMany({
      where: {
        tenantId,
      },
      include: {
        users: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const formattedRoles = roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission.name),
    }));

    const validated = roleSchema.array().parse(formattedRoles);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error fetching roles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener roles',
    };
  }
}

export async function createRole(input: unknown): Promise<{
  success: boolean;
  data?: Role;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Crear roles')) {
      throw new Error('No tiene permisos para: Crear roles');
    }

    // Validate input
    const validatedInput = createRoleSchema.parse(input);
    const { permissions, ...roleData } = validatedInput;

    const newRole = await prisma.role.create({
      data: {
        ...roleData,
        tenantId,
      },
    });

    const permissionRecords = await prisma.permission.findMany({
      where: {
        name: {
          in: permissions,
        },
      },
    });

    await prisma.rolePermission.createMany({
      data: permissionRecords.map((permission) => ({
        roleId: newRole.id,
        permissionId: permission.id,
        tenantId,
      })),
    });

    const roleWithRelations = await prisma.role.findUnique({
      where: { id: newRole.id },
      include: {
        users: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    revalidateTag('roles');

    await createNotificationForAction(
      'role_created',
      newRole.name,
      prisma,
      tenantId,
      newRole.id,
    );

    const formattedRole = {
      ...roleWithRelations!,
      permissions: roleWithRelations!.permissions.map(
        (rp) => rp.permission.name,
      ),
    };

    const validated = roleSchema.parse(formattedRole);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error creating role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear rol',
    };
  }
}

export async function updateRole(input: unknown): Promise<{
  success: boolean;
  data?: Role;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Editar roles')) {
      throw new Error('No tiene permisos para: Editar roles');
    }

    // Validate input
    const validatedInput = updateRoleSchema.parse(input);
    const { id, permissions, ...roleData } = validatedInput;

    if (!id) {
      throw new Error('Role ID is required');
    }

    await prisma.role.update({
      where: {
        id,
        tenantId,
      },
      data: roleData,
    });

    if (permissions) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: id,
          tenantId,
        },
      });

      const permissionRecords = await prisma.permission.findMany({
        where: {
          name: {
            in: permissions,
          },
        },
      });

      await prisma.rolePermission.createMany({
        data: permissionRecords.map((permission) => ({
          roleId: id,
          permissionId: permission.id,
          tenantId,
        })),
      });
    }

    const roleWithRelations = await prisma.role.findUnique({
      where: {
        id,
        tenantId,
      },
      include: {
        users: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    revalidateTag('roles');

    await createNotificationForAction(
      'role_updated',
      roleWithRelations!.name,
      prisma,
      tenantId,
      roleWithRelations!.id,
    );

    const formattedRole = {
      ...roleWithRelations!,
      permissions: roleWithRelations!.permissions.map(
        (rp) => rp.permission.name,
      ),
    };

    const validated = roleSchema.parse(formattedRole);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error updating role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar rol',
    };
  }
}

export async function deleteRole(id: string): Promise<{
  success: boolean;
  data?: Role;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Eliminar roles')) {
      throw new Error('No tiene permisos para: Eliminar roles');
    }

    const usersWithRole = await prisma.user.count({
      where: {
        roleId: id,
        tenantId,
      },
    });

    if (usersWithRole > 0) {
      throw new Error(
        'No se puede eliminar el rol porque tiene usuarios asignados',
      );
    }

    const roleToDelete = await prisma.role.findUnique({
      where: {
        id,
        tenantId,
      },
      include: {
        users: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!roleToDelete) {
      throw new Error('Rol no encontrado');
    }

    await prisma.role.delete({
      where: {
        id,
        tenantId,
      },
    });

    revalidateTag('roles');

    await createNotificationForAction(
      'role_deleted',
      roleToDelete.name,
      prisma,
      tenantId,
      roleToDelete.id,
    );

    const formattedRole = {
      ...roleToDelete,
      permissions: roleToDelete.permissions.map((rp) => rp.permission.name),
    };

    const validated = roleSchema.parse(formattedRole);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error deleting role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar rol',
    };
  }
}
