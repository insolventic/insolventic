'use server';

import { revalidateTag } from 'next/cache';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { authenticateUser } from '@/features/auth/actions';
import { emailService } from '@/lib/email';

import { createNotificationForAction } from '@/features/notification/actions';

import {
  createUserSchema,
  updateUserSchema,
  userSchema,
  userSummarySchema,
} from './schemas';

import type { User, UserSummaryData } from './schemas';

export async function getAllUsers(): Promise<{
  success: boolean;
  data?: User[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.VER_USUARIOS)) {
      throw new Error('No tiene permisos para: Ver usuarios');
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        assignedCases: { select: { id: true } },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedUsers = users.map((user) => ({
      ...user,
      role: {
        ...user.role,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
    }));

    const validated = userSchema.array().parse(formattedUsers);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener usuarios',
    };
  }
}

export async function createUser(input: unknown): Promise<{
  success: boolean;
  data?: UserSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.CREAR_USUARIOS)) {
      throw new Error('No tiene permisos para: Crear usuarios');
    }

    // Validate input
    const validatedInput = createUserSchema.parse(input);
    const { roleId, ...rest } = validatedInput;

    const finalPassword = randomUUID().replaceAll('-', '').slice(0, 12);
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const createdUser = await prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
        role: { connect: { id: roleId } },
        tenant: { connect: { id: tenantId } },
      },
      include: {
        role: true,
      },
    });

    revalidateTag('users');

    await createNotificationForAction(
      'user_created',
      createdUser.name,
      prisma,
      tenantId,
      createdUser.id,
    );

    await emailService.sendUserCreatedEmail(createdUser.email, {
      name: createdUser.name,
      email: createdUser.email,
      password: finalPassword,
      roleName: createdUser.role.name,
      database: tenantId,
      createdBy: user.name,
    });

    const validated = userSummarySchema.parse(createdUser);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear usuario',
    };
  }
}

export async function updateUser(input: unknown): Promise<{
  success: boolean;
  data?: UserSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.EDITAR_USUARIOS)) {
      throw new Error('No tiene permisos para: Editar usuarios');
    }

    // Validate input
    const validatedInput = updateUserSchema.parse(input);
    const { id, roleId, password, ...rest } = validatedInput;

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const updatedUser = await prisma.user.update({
      where: {
        id,
        tenantId,
      },
      data: {
        ...rest,
        ...(hashedPassword && { password: hashedPassword }),
        ...(roleId && { role: { connect: { id: roleId } } }),
      },
    });

    revalidateTag('users');

    await createNotificationForAction(
      'user_updated',
      updatedUser.name,
      prisma,
      tenantId,
      updatedUser.id,
    );

    const validated = userSummarySchema.parse(updatedUser);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al actualizar usuario',
    };
  }
}

export async function deleteUser(id: string): Promise<{
  success: boolean;
  data?: UserSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.ELIMINAR_USUARIOS)) {
      throw new Error('No tiene permisos para: Eliminar usuarios');
    }

    const deletedUser = await prisma.user.delete({
      where: {
        id,
        tenantId,
      },
    });

    revalidateTag('users');

    await createNotificationForAction(
      'user_deleted',
      deletedUser.name,
      prisma,
      tenantId,
      deletedUser.id,
    );

    const validated = userSummarySchema.parse(deletedUser);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al eliminar usuario',
    };
  }
}
