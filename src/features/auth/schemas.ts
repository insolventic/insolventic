import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  tenantId: z.string().min(1, 'El tenant es requerido'),
});

export const sessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  permissions: z.array(z.string()),
  tenantId: z.string(),
  tenantName: z.string(),
  lastLogin: z.date(),
  iat: z.number(),
  exp: z.number(),
});

export const refreshTokenSchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export const authResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: sessionSchema.omit({ iat: true, exp: true }).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export const logoutResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const validateSessionResultSchema = z.object({
  valid: z.boolean(),
  user: sessionSchema.omit({ iat: true, exp: true }).optional(),
  error: z.string().optional(),
});

export const permissionCheckSchema = z.object({
  hasPermission: z.boolean(),
  userPermissions: z.array(z.string()),
  requiredPermission: z.string(),
});

export const permissionGuardPropsSchema = z.object({
  permission: z.string(),
});

// Registration schemas
export const registerSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('Email inválido'),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
    phone: z.string().min(1, 'El teléfono es requerido'),
    address: z.string().min(1, 'La dirección es requerida'),
    professionalCard: z.string().min(1, 'La tarjeta profesional es requerida'),
    tenantId: z.string().min(1, 'El tenant es requerido'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export const registerResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .optional(),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  tenantId: z.string().min(1, 'El tenant es requerido'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token es requerido'),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
    tenantId: z.string().min(1, 'El tenant es requerido'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export const passwordResetResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Change password schemas
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z
      .string()
      .min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export const changePasswordResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SessionData = z.infer<typeof sessionSchema>;
export type RefreshTokenData = z.infer<typeof refreshTokenSchema>;
export type AuthResult = z.infer<typeof authResultSchema>;
export type LogoutResult = z.infer<typeof logoutResultSchema>;
export type ValidateSessionResult = z.infer<typeof validateSessionResultSchema>;
export type PermissionCheck = z.infer<typeof permissionCheckSchema>;
export type PermissionGuardProps = z.infer<typeof permissionGuardPropsSchema>;

// New types
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterResult = z.infer<typeof registerResultSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PasswordResetResult = z.infer<typeof passwordResetResultSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePasswordResult = z.infer<typeof changePasswordResultSchema>;
