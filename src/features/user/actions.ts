'use server';

import { revalidateTag } from 'next/cache';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { authenticateUser } from '@/features/auth/actions';
import { emailService } from '@/lib/email';
import { logger } from '@/lib/logger';

import { createNotificationForAction } from '@/features/notification/actions';
import { createAuditLog } from '@/features/audit-log/actions';

import {
  createUserSchema,
  updateUserSchema,
  userSchema,
  userSummarySchema,
} from './schemas';

import type { User, UserSummaryData, AssignableOperator } from './schemas';

/**
 * Usuarios del centro que pueden quedar asignados como operador de un caso.
 *
 * Existe aparte de `getAllUsers` por un motivo de permisos, no de comodidad:
 * `getAllUsers` exige `Ver usuarios`, que **solo tiene el Administrador**.
 * Los dos roles que crean y editan casos —`Operadora de Insolvencia` y
 * `Abogado`— no lo tienen, así que si el selector de operador se alimentara de
 * ahí, se quedaría vacío justo para quienes lo necesitan (y hoy, de hecho, el
 * diálogo de alta falla para ellos: ver issue #83).
 *
 * Por eso esta acción se guarda por el permiso del trabajo que se está
 * haciendo —crear o editar casos— y no por el de administrar usuarios.
 *
 * Devuelve lo mínimo para pintar el selector: id, nombre y rol. En particular
 * NO devuelve correos, teléfonos, cédulas profesionales ni la lista de
 * permisos del rol, que es lo que `getAllUsers` sí expone.
 */
export async function getAssignableOperators(): Promise<{
  success: boolean;
  data?: AssignableOperator[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    const puedeAsignar =
      user.permissions.includes(P.CREAR_CASOS) ||
      user.permissions.includes(P.EDITAR_CASOS);

    if (!puedeAsignar) {
      return {
        success: false,
        error: 'No tiene permisos para asignar el operador de un caso',
      };
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        role: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        roleName: u.role.name,
      })),
    };
  } catch (error) {
    logger.error('No se pudieron obtener los operadores asignables', error, {
      action: 'getAssignableOperators',
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener usuarios',
    };
  }
}

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

    // Temporary random password — user will set their own via activation link
    const tempPassword = randomUUID().replaceAll('-', '').slice(0, 16);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const createdUser = await prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
        mustChangePassword: true,
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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'created',
      entityType: 'user',
      entityId: createdUser.id,
      entityName: createdUser.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    // Generate activation token (reuses PasswordResetToken infrastructure)
    const activationToken = randomUUID();
    const activationExpires = new Date();
    activationExpires.setHours(activationExpires.getHours() + 48); // 48h for activation

    await prisma.passwordResetToken.create({
      data: {
        email: createdUser.email,
        token: activationToken,
        tenantId,
        expiresAt: activationExpires,
      },
    });

    const activationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${activationToken}&db=${tenantId}`;

    await emailService.sendUserCreatedEmail(createdUser.email, {
      name: createdUser.name,
      email: createdUser.email,
      activationUrl,
      roleName: createdUser.role.name,
      database: tenantId,
      createdBy: user.name,
      expiresIn: '48 horas',
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

    // Validate role belongs to the same tenant
    if (roleId) {
      const roleExists = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
      });
      if (!roleExists) return { success: false, error: 'Rol no encontrado' };
    }

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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'updated',
      entityType: 'user',
      entityId: updatedUser.id,
      entityName: updatedUser.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

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

    // Prevent self-deletion
    if (id === user.id) {
      return { success: false, error: 'No puede eliminar su propia cuenta' };
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
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'deleted',
      entityType: 'user',
      entityId: deletedUser.id,
      entityName: deletedUser.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

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

export async function getProfile(): Promise<{
  success: boolean;
  data?: {
    name: string;
    email: string;
    phone: string;
    address: string;
    professionalCard: string;
    roleName: string;
    createdDate: Date;
    lastLogin: Date | null;
  };
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    const profile = await prisma.user.findUnique({
      where: { id: user.id, tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        professionalCard: true,
        createdDate: true,
        lastLogin: true,
        role: { select: { name: true } },
      },
    });

    if (!profile) {
      return { success: false, error: 'Perfil no encontrado' };
    }

    return {
      success: true,
      data: {
        ...profile,
        roleName: profile.role.name,
      },
    };
  } catch (error) {
    console.error('Error getting profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener perfil',
    };
  }
}

export async function updateProfile(input: unknown): Promise<{
  success: boolean;
  data?: UserSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Users can only update their own profile - no special permission needed
    const profileSchema = z.object({
      name: z.string().min(1, 'El nombre es requerido'),
      phone: z.string().min(1, 'El teléfono es requerido'),
      address: z.string().min(1, 'La dirección es requerida'),
      professionalCard: z
        .string()
        .min(1, 'La tarjeta profesional es requerida'),
    });

    const validatedInput = profileSchema.parse(input);

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
        tenantId,
      },
      data: validatedInput,
    });

    revalidateTag('users');

    const validated = userSummarySchema.parse(updatedUser);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error updating profile:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al actualizar perfil',
    };
  }
}
