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
  userOutputSchema,
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
      // `select` y no `include`: un `include` trae la fila entera, contraseña
      // incluida, aunque esta pantalla no la use.
      select: {
        id: true,
        name: true,
        email: true,
        professionalCard: true,
        phone: true,
        address: true,
        roleId: true,
        lastLogin: true,
        createdDate: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            permissions: {
              select: { permission: { select: { name: true } } },
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

    const validated = userOutputSchema.array().parse(formattedUsers);
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

    // Validate role belongs to the same tenant
    const roleExists = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!roleExists) return { success: false, error: 'Rol no encontrado' };

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

/**
 * Campos de la cuenta cuyo cambio queda en la auditoría, solo por su nombre. El
 * correo es la excepción: además guarda las dos direcciones (ver `updateUser`).
 */
const CAMPOS_AUDITADOS = [
  'name',
  'email',
  'phone',
  'address',
  'professionalCard',
  'roleId',
] as const;

/**
 * Tope para esperar a SMTP: `email.ts` no define timeouts y nodemailer puede
 * tardar minutos en rendirse. Sin esto, la función serverless podría morir con
 * la edición ya guardada, y quien edita vería un error que no es cierto.
 */
const ESPERA_AVISO_CORREO_MS = 5_000;

/**
 * Avisa al correo anterior de una cuenta. Nunca lanza: la edición ya quedó
 * guardada y bloquearla impediría corregir un correo mal escrito, que es lo que
 * permite recuperar la clave a quien perdió acceso a ese buzón.
 *
 * Se espera y no se usa `void`: en Vercel la función puede terminar al devolver
 * la respuesta y matar el envío en vuelo. Si `sendEmail` devuelve `false` no hay
 * nada que registrar aquí, porque él ya lo reportó a Sentry.
 */
async function avisarCambioDeCorreo(
  correoAnterior: string,
  userId: string,
  changedBy: string,
): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      emailService.sendEmailChangedNotice(correoAnterior, {
        changedBy,
        date: new Date(),
      }),
      new Promise<'sin-respuesta'>((resolve) => {
        temporizador = setTimeout(
          () => resolve('sin-respuesta'),
          ESPERA_AVISO_CORREO_MS,
        );
      }),
    ]);
    if (resultado === 'sin-respuesta') {
      logger.warn('El aviso de cambio de correo no se confirmó a tiempo', {
        action: 'update-user.aviso-correo',
        userId,
        esperaMs: ESPERA_AVISO_CORREO_MS,
      });
    }
  } catch (error) {
    logger.error('No se pudo avisar el cambio de correo', error, {
      action: 'update-user.aviso-correo',
      userId,
    });
  } finally {
    clearTimeout(temporizador);
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

    // La fila anterior y no las claves recibidas: el diálogo de edición envía
    // todos los campos en cada guardado, hayan cambiado o no.
    const anterior = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        professionalCard: true,
        roleId: true,
      },
    });
    if (!anterior) return { success: false, error: 'Usuario no encontrado' };

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

    const cambiados: string[] = CAMPOS_AUDITADOS.filter(
      (campo) => updatedUser[campo] !== anterior[campo],
    );
    if (hashedPassword) cambiados.push('password');
    const cambioDeCorreo = updatedUser.email !== anterior.email;

    // Antes de la notificación: si esta lanza, la edición ya está guardada y
    // tiene que quedar el registro y el aviso. El resultado no se mira porque
    // `createAuditLog` ya reporta su propio fallo y la edición no se puede
    // deshacer.
    //
    // Las direcciones van solo cuando cambia el correo: sin ellas, quien pone
    // el suyo, restablece la clave y restaura el original deja dos cambios de
    // `email` que no dicen adónde fue, y no se distingue una corrección de una
    // toma de la cuenta. Los demás campos quedan solo por su nombre.
    await createAuditLog({
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
      metadata: {
        changedFields: cambiados.sort().join(', '),
        ...(cambioDeCorreo && {
          previousEmail: anterior.email,
          newEmail: updatedUser.email,
        }),
      },
    });

    if (cambioDeCorreo) {
      await avisarCambioDeCorreo(anterior.email, updatedUser.id, user.name);
    }

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

/**
 * A-6 (revocación de sesiones) — un administrador fuerza el cierre de TODAS
 * las sesiones vigentes de un usuario, sin esperar a que su JWT expire por
 * su cuenta (hasta 24h el access token, hasta 7 días el refresh token).
 *
 * Incrementa `tokenVersion`: `authenticateUser` y `refreshAccessToken`
 * (features/auth/actions.ts) rechazan cualquier token emitido con la versión
 * anterior la próxima vez que ese usuario intente usarlo o refrescarlo.
 *
 * Mismo permiso que `updateUser` (`P.EDITAR_USUARIOS`) — esto es una
 * modificación de la cuenta del usuario, no una eliminación.
 */
export async function revokeUserSessions(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.EDITAR_USUARIOS)) {
      throw new Error('No tiene permisos para: Editar usuarios');
    }

    // El `where` compuesto (id + tenantId) es lo que impide revocar las
    // sesiones de un usuario de OTRO tenant — mismo patrón que `deleteUser`.
    const target = await prisma.user.update({
      where: { id: userId, tenantId },
      data: { tokenVersion: { increment: 1 } },
    });

    createAuditLog({
      action: 'updated',
      entityType: 'user',
      entityId: target.id,
      entityName: target.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
      metadata: { changedFields: 'tokenVersion (revocación de sesiones)' },
    });

    return { success: true };
  } catch (error) {
    logger.error('Error revoking user sessions', error, {
      action: 'revoke-user-sessions',
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al revocar las sesiones del usuario',
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
