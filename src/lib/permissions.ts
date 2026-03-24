/**
 * Centralized permission constants and module configuration.
 *
 * This file is the single source of truth for:
 * - Permission string constants (type-safe, no magic strings)
 * - Module definitions (route, gate permission, related permissions)
 * - Helpers for route protection and module visibility
 *
 * IMPORTANT: This file must NOT import Prisma or any Node-only module
 * because it is used in the Edge Runtime middleware.
 */

// ---------------------------------------------------------------------------
// Permission Constants
// ---------------------------------------------------------------------------

export const P = {
  // Usuarios y Roles
  VER_USUARIOS: 'Ver usuarios',
  CREAR_USUARIOS: 'Crear usuarios',
  EDITAR_USUARIOS: 'Editar usuarios',
  ELIMINAR_USUARIOS: 'Eliminar usuarios',
  VER_ROLES: 'Ver roles',
  CREAR_ROLES: 'Crear roles',
  EDITAR_ROLES: 'Editar roles',
  ELIMINAR_ROLES: 'Eliminar roles',

  // Casos
  VER_CASOS: 'Ver casos',
  CREAR_CASOS: 'Crear casos',
  EDITAR_CASOS: 'Editar casos',
  ELIMINAR_CASOS: 'Eliminar casos',
  VER_TODOS_CASOS: 'Ver todos los casos',
  VER_CASOS_PROPIOS: 'Ver casos propios',
  VER_CASOS_CLIENTE: 'Ver casos como cliente',

  // Acreedores
  VER_ACREEDORES: 'Ver acreedores',
  CREAR_ACREEDORES: 'Crear acreedores',
  EDITAR_ACREEDORES: 'Editar acreedores',
  ELIMINAR_ACREEDORES: 'Eliminar acreedores',

  // Deudores
  VER_DEUDORES: 'Ver deudores',
  CREAR_DEUDORES: 'Crear deudores',
  EDITAR_DEUDORES: 'Editar deudores',
  ELIMINAR_DEUDORES: 'Eliminar deudores',

  // Documentos
  VER_DOCUMENTOS: 'Ver documentos',
  GENERAR_DOCUMENTOS: 'Generar documentos',

  // Notificaciones
  VER_NOTIFICACIONES: 'Ver notificaciones',
  EDITAR_NOTIFICACIONES: 'Editar notificaciones',
  GESTIONAR_NOTIFICACIONES: 'Gestionar notificaciones',

  // Auditoría
  VER_AUDITORIA: 'Ver auditoría',

  // Calendario
  VER_CALENDARIO: 'Ver calendario',

  // Reportes
  VER_REPORTES: 'Ver reportes',
} as const;

export type PermissionString = (typeof P)[keyof typeof P];

// ---------------------------------------------------------------------------
// Module Definitions
// ---------------------------------------------------------------------------

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  gatePermission: PermissionString;
  permissions: readonly PermissionString[];
}

export const MODULES = {
  cases: {
    key: 'cases',
    label: 'Gestión de Casos',
    description: 'Revisar y actualizar casos activos',
    route: '/cases',
    icon: 'FileText',
    gatePermission: P.VER_CASOS,
    permissions: [
      P.VER_CASOS,
      P.CREAR_CASOS,
      P.EDITAR_CASOS,
      P.ELIMINAR_CASOS,
      P.VER_TODOS_CASOS,
      P.VER_CASOS_PROPIOS,
      P.VER_CASOS_CLIENTE,
    ],
  },
  users: {
    key: 'users',
    label: 'Gestión de Usuarios y Permisos',
    description: 'Administrar usuarios del sistema',
    route: '/users',
    icon: 'Users',
    gatePermission: P.VER_USUARIOS,
    permissions: [
      P.VER_USUARIOS,
      P.CREAR_USUARIOS,
      P.EDITAR_USUARIOS,
      P.ELIMINAR_USUARIOS,
      P.VER_ROLES,
      P.CREAR_ROLES,
      P.EDITAR_ROLES,
      P.ELIMINAR_ROLES,
    ],
  },
  creditors: {
    key: 'creditors',
    label: 'Gestión de Acreedores',
    description: 'Gestionar entidades financieras',
    route: '/creditors',
    icon: 'Building',
    gatePermission: P.VER_ACREEDORES,
    permissions: [
      P.VER_ACREEDORES,
      P.CREAR_ACREEDORES,
      P.EDITAR_ACREEDORES,
      P.ELIMINAR_ACREEDORES,
    ],
  },
  debtors: {
    key: 'debtors',
    label: 'Gestión de Deudores',
    description: 'Personas en proceso de insolvencia',
    route: '/debtors',
    icon: 'Users',
    gatePermission: P.VER_DEUDORES,
    permissions: [
      P.VER_DEUDORES,
      P.CREAR_DEUDORES,
      P.EDITAR_DEUDORES,
      P.ELIMINAR_DEUDORES,
    ],
  },
  documents: {
    key: 'documents',
    label: 'Documentos',
    description: 'Gestionar documentos legales',
    route: '/documents',
    icon: 'FileSearch',
    gatePermission: P.VER_DOCUMENTOS,
    permissions: [P.VER_DOCUMENTOS, P.GENERAR_DOCUMENTOS],
  },
  notifications: {
    key: 'notifications',
    label: 'Notificaciones',
    description: 'Centro de notificaciones',
    route: '/notifications',
    icon: 'Bell',
    gatePermission: P.VER_NOTIFICACIONES,
    permissions: [
      P.VER_NOTIFICACIONES,
      P.EDITAR_NOTIFICACIONES,
      P.GESTIONAR_NOTIFICACIONES,
    ],
  },
  auditLog: {
    key: 'auditLog',
    label: 'Auditoría',
    description: 'Registro de auditoría del sistema',
    route: '/audit-log',
    icon: 'Shield',
    gatePermission: P.VER_AUDITORIA,
    permissions: [P.VER_AUDITORIA],
  },
  calendar: {
    key: 'calendar',
    label: 'Calendario',
    description: 'Calendario de audiencias programadas',
    route: '/calendar',
    icon: 'Calendar',
    gatePermission: P.VER_CALENDARIO,
    permissions: [P.VER_CALENDARIO],
  },
  reports: {
    key: 'reports',
    label: 'Reportes',
    description: 'Reportes y exportación de datos',
    route: '/reports',
    icon: 'BarChart3',
    gatePermission: P.VER_REPORTES,
    permissions: [P.VER_REPORTES],
  },
} as const satisfies Record<string, ModuleDefinition>;

export type ModuleKey = keyof typeof MODULES;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the route → gate-permission map used by the middleware.
 */
export function getRoutePermissions(): Record<string, string> {
  return Object.fromEntries(
    Object.values(MODULES).map((m) => [m.route, m.gatePermission]),
  );
}

/**
 * Given a pathname, return the module whose route matches (prefix match).
 */
export function getModuleForRoute(
  pathname: string,
): ModuleDefinition | undefined {
  return Object.values(MODULES).find((m) => pathname.startsWith(m.route));
}

/**
 * Return only the modules the user is allowed to see, based on their
 * permission array.
 */
export function getVisibleModules(
  userPermissions: string[],
): ModuleDefinition[] {
  return Object.values(MODULES).filter((m) =>
    userPermissions.includes(m.gatePermission),
  );
}

/**
 * Find which module a specific permission belongs to.
 */
export function getModuleForPermission(
  permission: string,
): ModuleDefinition | undefined {
  return Object.values(MODULES).find((m) =>
    (m.permissions as readonly string[]).includes(permission),
  );
}
