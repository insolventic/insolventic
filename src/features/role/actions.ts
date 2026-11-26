'use server';

import { revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { authenticateUser } from '@/features/auth/actions';
import { createNotificationForAction } from '@/features/notification/actions';
import { createAuditLog } from '@/features/audit-log/actions';

import {
  dejaSinAdministracion,
  noPuedeDarPermisos,
  noPuedeModificarRol,
  permisosQueLeFaltan,
  rechazoPorLimite,
  rolDelCentro,
  ULTIMA_ADMINISTRACION,
} from './limites-de-permisos';

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
    if (!user.permissions.includes(P.VER_ROLES)) {
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
    if (!user.permissions.includes(P.CREAR_ROLES)) {
      throw new Error('No tiene permisos para: Crear roles');
    }

    // Validate input
    const validatedInput = createRoleSchema.parse(input);
    const { permissions, ...roleData } = validatedInput;

    // Antes de crear nada: el catálogo del centro decide qué permisos existen,
    // y de esos solo se dan los que quien crea el rol ya tiene.
    const permissionRecords = await prisma.permission.findMany({
      where: {
        tenantId,
        name: {
          in: permissions,
        },
      },
    });
    const faltan = permisosQueLeFaltan(
      permissionRecords.map((p) => p.name),
      user.permissions,
    );
    if (faltan.length > 0) {
      return rechazoPorLimite(
        'asigna-permisos-que-no-tiene',
        noPuedeDarPermisos(faltan),
        { action: 'create-role', actorId: user.id },
      );
    }

    const newRole = await prisma.role.create({
      data: {
        ...roleData,
        tenantId,
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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    await createAuditLog({
      action: 'created',
      entityType: 'role',
      entityId: newRole.id,
      entityName: newRole.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

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
    if (!user.permissions.includes(P.EDITAR_ROLES)) {
      throw new Error('No tiene permisos para: Editar roles');
    }

    // Validate input
    const validatedInput = updateRoleSchema.parse(input);
    const { id, permissions, ...roleData } = validatedInput;

    if (!id) {
      throw new Error('Role ID is required');
    }

    const actual = await rolDelCentro(id, tenantId);
    if (!actual) throw new Error('Rol no encontrado');

    const contexto = { action: 'update-role', actorId: user.id, roleId: id };

    // Un rol con permisos que quien edita no tiene no se toca: vaciarlo sería
    // quitárselos a quienes lo tienen, y renombrarlo, confundir al asignarlo.
    if (permisosQueLeFaltan(actual.permisos, user.permissions).length > 0) {
      return rechazoPorLimite(
        'rol-con-mas-permisos',
        noPuedeModificarRol(actual.name),
        contexto,
      );
    }

    // El catálogo del centro decide qué permisos existen; de esos solo se dan
    // los que quien edita ya tiene, y el cambio no puede dejar al centro sin
    // quien lo administre (editar el rol propio es la forma de hacerlo).
    const permissionRecords = permissions
      ? await prisma.permission.findMany({
          where: {
            tenantId,
            name: {
              in: permissions,
            },
          },
        })
      : null;

    if (permissionRecords) {
      const nuevos = permissionRecords.map((p) => p.name);
      const faltan = permisosQueLeFaltan(nuevos, user.permissions);
      if (faltan.length > 0) {
        return rechazoPorLimite(
          'asigna-permisos-que-no-tiene',
          noPuedeDarPermisos(faltan),
          contexto,
        );
      }
      if (
        await dejaSinAdministracion(tenantId, {
          rol: id,
          permisosNuevos: nuevos,
        })
      ) {
        return rechazoPorLimite(
          'ultima-administracion',
          ULTIMA_ADMINISTRACION,
          contexto,
        );
      }
    }

    await prisma.role.update({
      where: {
        id,
        tenantId,
      },
      data: roleData,
    });

    if (permissionRecords) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: id,
          tenantId,
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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    await createAuditLog({
      action: 'updated',
      entityType: 'role',
      entityId: roleWithRelations!.id,
      entityName: roleWithRelations!.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

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
    if (!user.permissions.includes(P.ELIMINAR_ROLES)) {
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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    await createAuditLog({
      action: 'deleted',
      entityType: 'role',
      entityId: roleToDelete.id,
      entityName: roleToDelete.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

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
