'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

import { emailService } from '@/lib/email';
import { logger } from '@/lib/logger';
import { isNextRedirectError } from '@/lib/next-redirect';
import { P } from '@/lib/permissions';
import { seedRequestContextFromHeaders } from '@/lib/request-context';
import { headers } from 'next/headers';
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

import prisma from '@/lib/prisma';
import type { TenantId } from '@/lib/prisma';
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth';

import {
  loginSchema,
  validateSessionResultSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type AuthResult,
  type ValidateSessionResult,
  type PermissionCheck,
  type RegisterResult,
  type PasswordResetResult,
} from './schemas';

export async function authenticateUser() {
  // Siembra el requestId (header del middleware) en AsyncLocalStorage:
  // authenticateUser es el entry point de casi toda server action, así que
  // todos los logs posteriores de la action llevan requestId automático.
  await seedRequestContextFromHeaders();

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    throw new Error('No hay token de acceso');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    throw new Error('Token inválido');
  }

  const tenantId = payload.tenantId as TenantId;
  if (!tenantId) {
    throw new Error('Tenant no especificado en el token');
  }

  // Verify that the tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado');
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.id,
      tenantId: tenant.id,
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
    },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
      professionalCard: user.professionalCard || '',
      permissions: user.role.permissions.map((rp) => rp.permission.name),
    },
    tenantId: tenant.id,
  };
}

/**
 * Authenticate the user AND verify they have the required permission.
 * Use this in server actions as a one-liner authorization check.
 */
export async function requireActionPermission(permission: string) {
  const { user, tenantId } = await authenticateUser();
  if (!user.permissions.includes(permission)) {
    throw new Error(`No tiene permisos para: ${permission}`);
  }
  return { user, tenantId };
}

async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

export async function loginUser(input: unknown): Promise<AuthResult> {
  try {
    // Action no autenticada: sembrar el contexto aquí directamente.
    await seedRequestContextFromHeaders();

    // Rate limiting
    const ip = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      getRateLimitKey('login', ip),
      RATE_LIMIT_CONFIGS.login,
    );
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.resetInMs / 60000);
      return {
        success: false,
        message: `Demasiados intentos de inicio de sesión. Intente nuevamente en ${minutesRemaining} minutos.`,
      };
    }

    const validatedInput = loginSchema.parse(input);
    const { email, password, tenantId } = validatedInput;
    const tenantIdValue = tenantId as TenantId;

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado.',
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId: tenant.id,
        },
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
        tenant: true,
      },
    });

    if (!user?.password) {
      return {
        success: false,
        message: 'Credenciales inválidas. Verifique su correo y contraseña.',
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Credenciales inválidas. Verifique su correo y contraseña.',
      };
    }

    // Force password change for accounts created by admin
    if ((user as Record<string, unknown>).mustChangePassword) {
      return {
        success: false,
        message:
          'Debe establecer una nueva contraseña. Revise su correo para el enlace de activación, o solicite un nuevo enlace usando "¿Olvidaste tu contraseña?".',
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      tenantId: tenantIdValue,
      tenantName: user.tenant.name,
      lastLogin: new Date(),
    };

    const accessToken = await createAccessToken(sessionData);
    const refreshToken = await createRefreshToken({
      userId: user.id,
      tenantId: tenantIdValue,
    });

    await setAuthCookies(accessToken, refreshToken);

    revalidateTag('auth');

    // A-3: los tokens NO se devuelven en el body — viajan solo en las
    // cookies httpOnly seteadas arriba.
    return {
      success: true,
      message: 'Inicio de sesión exitoso',
      user: sessionData,
    };
  } catch (error) {
    logger.error('Login error', error);
    return {
      success: false,
      message: 'Error interno del servidor. Intente nuevamente.',
    };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await clearAuthCookies();
    revalidateTag('auth');
  } catch (error) {
    logger.error('Logout error', error);
  }

  // Always redirect to home page after logout, even on error
  // This prevents any authenticated pages from trying to fetch data
  // with cleared credentials, which would cause the "No hay token de acceso" error
  redirect('/');
}

export async function validateSession(): Promise<ValidateSessionResult> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token')?.value;

    if (!accessToken) {
      return {
        valid: false,
        error: 'No hay token de acceso',
      };
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return {
        valid: false,
        error: 'Token inválido',
      };
    }

    const tenantId = payload.tenantId as TenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantId },
    });

    if (!tenant) {
      return {
        valid: false,
        error: 'Tenant no encontrado',
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.id,
        tenantId: tenant.id,
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
        tenant: true,
      },
    });

    if (!user) {
      return {
        valid: false,
        error: 'Usuario no encontrado',
      };
    }

    const validatedResult = validateSessionResultSchema.parse({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        roleName: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
        tenantId: tenantId,
        tenantName: user.tenant.name,
        lastLogin: user.lastLogin || new Date(),
      },
    });

    return validatedResult;
  } catch (error) {
    logger.error('Session validation error', error);
    return {
      valid: false,
      error: 'Error al validar sesión',
    };
  }
}

export async function checkUserPermission(
  permission: string,
): Promise<PermissionCheck> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token')?.value;

    if (!accessToken) {
      return {
        hasPermission: false,
        userPermissions: [],
        requiredPermission: permission,
      };
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return {
        hasPermission: false,
        userPermissions: [],
        requiredPermission: permission,
      };
    }

    const hasPermission = payload.permissions.includes(permission);

    return {
      hasPermission,
      userPermissions: payload.permissions,
      requiredPermission: permission,
    };
  } catch (error) {
    logger.error('Permission check error', error);
    return {
      hasPermission: false,
      userPermissions: [],
      requiredPermission: permission,
    };
  }
}

export async function refreshAccessToken(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh-token')?.value;

    if (!refreshToken) {
      return {
        success: false,
        message: 'No hay token de actualización',
      };
    }

    const refreshPayload = await verifyRefreshToken(refreshToken);
    if (!refreshPayload) {
      return {
        success: false,
        message: 'Token de actualización inválido',
      };
    }

    const tenantIdValue = refreshPayload.tenantId as TenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado',
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        id: refreshPayload.userId,
        tenantId: tenant.id,
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
        tenant: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: 'Usuario no encontrado',
      };
    }

    // Block refresh if user must change password
    if ((user as Record<string, unknown>).mustChangePassword) {
      await clearAuthCookies();
      return {
        success: false,
        message:
          'Debe establecer una nueva contraseña antes de continuar. Revise su correo para el enlace de activación.',
      };
    }

    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      tenantId: tenantIdValue,
      tenantName: user.tenant.name,
      lastLogin: user.lastLogin || new Date(),
    };

    const newAccessToken = await createAccessToken(sessionData);
    const newRefreshToken = await createRefreshToken({
      userId: user.id,
      tenantId: tenantIdValue,
    });

    await setAuthCookies(newAccessToken, newRefreshToken);

    // A-3: los tokens NO se devuelven en el body — viajan solo en las
    // cookies httpOnly seteadas arriba.
    return {
      success: true,
      message: 'Token actualizado exitosamente',
      user: sessionData,
    };
  } catch (error) {
    logger.error('Token refresh error', error);
    return {
      success: false,
      message: 'Error al actualizar token',
    };
  }
}

export async function switchDatabase(): Promise<void> {
  try {
    await clearAuthCookies();
    revalidateTag('auth');
  } catch (error) {
    logger.error('Tenant switch error', error);
  }

  // redirect() señala la redirección lanzando NEXT_REDIRECT, así que NO puede
  // estar dentro del try: el catch lo registraría como un error falso y lo
  // confundiría con un fallo real de clearAuthCookies. Va fuera para que se
  // ejecute siempre — también tras un error — y el usuario no se quede en una
  // página autenticada (mismo patrón que logoutUser).
  redirect('/');
}

export async function switchTenant(targetTenantSlug: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Verify current user is authenticated
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token')?.value;

    if (!accessToken) {
      redirect('/login');
    }

    const currentPayload = await verifyToken(accessToken);
    if (!currentPayload) {
      redirect('/login');
    }

    // 2. Find the target tenant
    const targetTenant = await prisma.tenant.findUnique({
      where: { slug: targetTenantSlug as TenantId },
    });

    if (!targetTenant) {
      return { success: false, error: 'Organización no encontrada' };
    }

    // 3. Check if current tenant is the same
    if (currentPayload.tenantId === targetTenantSlug) {
      return { success: false, error: 'Ya estás en esta organización' };
    }

    // 4. Look up user by email in the target tenant
    const userInTarget = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: currentPayload.email,
          tenantId: targetTenant.id,
        },
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
      },
    });

    if (!userInTarget) {
      return {
        success: false,
        error: 'No tienes cuenta en esta organización',
      };
    }

    // Block tenant switch if user must change password
    if ((userInTarget as Record<string, unknown>).mustChangePassword) {
      return {
        success: false,
        error: 'Debe establecer una nueva contraseña antes de continuar.',
      };
    }

    // 5. Generate new tokens for the target tenant
    const permissions = userInTarget.role.permissions.map(
      (rp) => rp.permission.name,
    );

    const accessTokenNew = await createAccessToken({
      id: userInTarget.id,
      name: userInTarget.name,
      email: userInTarget.email,
      roleId: userInTarget.role.id,
      roleName: userInTarget.role.name,
      permissions,
      tenantId: targetTenantSlug,
      tenantName: targetTenant.name,
      lastLogin: new Date(),
    });

    const refreshTokenNew = await createRefreshToken({
      userId: userInTarget.id,
      tenantId: targetTenantSlug,
    });

    // 6. Set new auth cookies
    await setAuthCookies(accessTokenNew, refreshTokenNew);

    // 7. Update last login
    await prisma.user.update({
      where: { id: userInTarget.id },
      data: { lastLogin: new Date() },
    });

    revalidateTag('auth');
    redirect('/dashboard');
  } catch (error) {
    // redirect() señala la redirección lanzando un error por diseño: debe
    // propagarse. Se reconoce por su digest, no por el message.
    if (isNextRedirectError(error)) {
      throw error;
    }
    logger.error('Error switching tenant', error);
    return {
      success: false,
      error: 'Error al cambiar de organización',
    };
  }
}

export async function registerUser(input: unknown): Promise<RegisterResult> {
  try {
    // C-2 (auditoría 2026-08-25): el registro público está cerrado. Sin
    // verificación de email, cualquiera podía registrarse con el correo de
    // un deudor real y acceder a su expediente vía el modo cliente. Solo
    // una sesión con permiso de crear usuarios puede invocar esta action.
    try {
      await requireActionPermission(P.CREAR_USUARIOS);
    } catch {
      logger.warn('Public registration attempt blocked', {
        action: 'registerUser',
      });
      return {
        success: false,
        message:
          'El registro público está deshabilitado. Solicite su cuenta al administrador de su centro de conciliación.',
      };
    }

    const ip = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      getRateLimitKey('register', ip),
      RATE_LIMIT_CONFIGS.register,
    );
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.resetInMs / 60000);
      return {
        success: false,
        message: `Demasiados intentos de registro. Intente nuevamente en ${minutesRemaining} minutos.`,
      };
    }
    const validatedInput = registerSchema.parse(input);
    const {
      name,
      email,
      password,
      phone,
      address,
      professionalCard,
      tenantId,
    } = validatedInput;
    const tenantIdValue = tenantId as TenantId;

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado.',
      };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId: tenant.id,
        },
      },
    });

    if (existingUser) {
      return {
        success: false,
        message: 'Ya existe un usuario con este correo electrónico.',
      };
    }

    // Get default role (assuming there's a basic user role)
    const defaultRole = await prisma.role.findFirst({
      where: {
        name: 'Usuario',
        tenantId: tenant.id,
      }, // Adjust this to your default role name
    });

    if (!defaultRole) {
      return {
        success: false,
        message:
          'No se encontró el rol por defecto. Contacte al administrador.',
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        professionalCard,
        roleId: defaultRole.id,
        tenantId: tenant.id,
      },
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(
        newUser.email,
        newUser.name,
        tenantIdValue,
      );
    } catch (error) {
      logger.error('Failed to send welcome email', error);
      // Don't fail registration if email fails
    }

    return {
      success: true,
      message: 'Usuario registrado exitosamente. Puede iniciar sesión ahora.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((i) => i.message);
      return {
        success: false,
        message: messages.join('. '),
      };
    }
    logger.error('Registration error', error);
    return {
      success: false,
      message: 'Error interno del servidor. Intente nuevamente.',
    };
  }
}

export async function forgotPassword(
  input: unknown,
): Promise<PasswordResetResult> {
  try {
    const ip = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      getRateLimitKey('forgotPassword', ip),
      RATE_LIMIT_CONFIGS.forgotPassword,
    );
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.resetInMs / 60000);
      return {
        success: false,
        message: `Demasiados intentos. Intente nuevamente en ${minutesRemaining} minutos.`,
      };
    }
    const validatedInput = forgotPasswordSchema.parse(input);
    const { email, tenantId } = validatedInput;
    const tenantIdValue = tenantId as TenantId;

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado.',
      };
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId: tenant.id,
        },
      },
    });

    if (!user) {
      // User requested to show explicit error when email doesn't exist
      return {
        success: false,
        message:
          'El correo electrónico no está registrado en el sistema. Verifique la dirección de correo o registrese primero.',
      };
    }

    // Generate reset token
    const resetToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Token expires in 30 minutes

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token: resetToken,
        tenantId: tenant.id,
        expiresAt,
      },
    });

    // Send password reset email
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&db=${tenantIdValue}`;

    const emailSent = await emailService.sendPasswordResetEmail(email, {
      name: user.name,
      resetUrl,
      database: tenantIdValue,
      expiresIn: '30 minutos',
    });

    if (!emailSent) {
      // El email es PII: va en el contexto para que el logger lo redacte.
      logger.error('Failed to send password reset email', undefined, {
        action: 'forgotPassword',
        email,
      });
      return {
        success: false,
        message:
          'Error al enviar el correo de recuperación. Verifique la dirección de correo e intente nuevamente.',
      };
    }

    return {
      success: true,
      message:
        'Correo de recuperación enviado exitosamente. Revise su bandeja de entrada y siga las instrucciones.',
    };
  } catch (error) {
    logger.error('Forgot password error', error);
    return {
      success: false,
      message: 'Error interno del servidor. Intente nuevamente.',
    };
  }
}

export async function resetPassword(
  input: unknown,
): Promise<PasswordResetResult> {
  try {
    const ip = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      getRateLimitKey('resetPassword', ip),
      RATE_LIMIT_CONFIGS.resetPassword,
    );
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.resetInMs / 60000);
      return {
        success: false,
        message: `Demasiados intentos. Intente nuevamente en ${minutesRemaining} minutos.`,
      };
    }
    const validatedInput = resetPasswordSchema.parse(input);
    const { token, password, tenantId } = validatedInput;
    const tenantIdValue = tenantId as TenantId;

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado.',
      };
    }

    // Find and validate reset token
    const resetTokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (
      !resetTokenRecord ||
      resetTokenRecord.used ||
      resetTokenRecord.tenantId !== tenant.id
    ) {
      return {
        success: false,
        message: 'Token de recuperación inválido o expirado.',
      };
    }

    if (new Date() > resetTokenRecord.expiresAt) {
      return {
        success: false,
        message: 'El token de recuperación ha expirado.',
      };
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: resetTokenRecord.email,
          tenantId: tenant.id,
        },
      },
    });

    if (!user) {
      return {
        success: false,
        message: 'Usuario no encontrado.',
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear activation flag
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });

    return {
      success: true,
      message:
        'Contraseña actualizada exitosamente. Puede iniciar sesión con su nueva contraseña.',
    };
  } catch (error) {
    logger.error('Reset password error', error);
    return {
      success: false,
      message: 'Error interno del servidor. Intente nuevamente.',
    };
  }
}

export async function changePassword(input: unknown): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const ip = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      getRateLimitKey('changePassword', ip),
      RATE_LIMIT_CONFIGS.changePassword,
    );
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.resetInMs / 60000);
      return {
        success: false,
        message: `Demasiados intentos. Intente nuevamente en ${minutesRemaining} minutos.`,
      };
    }
    const validatedInput = changePasswordSchema.parse(input);
    const { currentPassword, newPassword } = validatedInput;

    // Get current user session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token')?.value;

    if (!accessToken) {
      return {
        success: false,
        message: 'Sesión no válida. Inicie sesión nuevamente.',
      };
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return {
        success: false,
        message: 'Sesión expirada. Inicie sesión nuevamente.',
      };
    }

    const tenantIdValue = payload.tenantId as TenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantIdValue },
    });

    if (!tenant) {
      return {
        success: false,
        message: 'Tenant no encontrado.',
      };
    }

    // Get user with current password
    const user = await prisma.user.findUnique({
      where: {
        id: payload.id,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
      },
    });

    if (!user || !user.password) {
      return {
        success: false,
        message: 'Usuario no encontrado.',
      };
    }

    // Verify current password

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: 'La contraseña actual es incorrecta.',
      };
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return {
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual.',
      };
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        lastLogin: new Date(), // Update last login to current time
      },
    });

    revalidateTag('auth');

    return {
      success: true,
      message: 'Contraseña cambiada exitosamente',
    };
  } catch (error) {
    logger.error('Error in changePassword', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Error al cambiar contraseña',
    };
  }
}
