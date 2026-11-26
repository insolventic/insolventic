/**
 * Límites de lo que una cuenta puede hacer con roles y cuentas ajenas.
 *
 * `authenticateUser` lee los permisos de la base en cada request, así que un
 * cambio de rol o de los permisos de un rol vale de inmediato, sin volver a
 * iniciar sesión. Sin estos límites, `Editar usuarios` o `Editar roles` en un
 * rol hecho a medida bastaban para subirse a Administrador.
 *
 * Las reglas, que aplican `features/user/actions.ts` y `features/role/actions.ts`
 * después de `authenticateUser()` y del chequeo de permiso:
 *
 *  1. Nadie cambia su propio rol.
 *  2. Solo se da (al asignar un rol o al editarlo) lo que uno mismo tiene.
 *  3. No se modifica una cuenta ni un rol que tenga permisos que uno no tiene.
 *  4. El centro no se queda sin cuentas que administren usuarios y roles.
 *
 * Sin `'use server'`: lo comparten dos archivos de actions.
 */

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { logger } from '@/lib/logger';

/**
 * Lo que hace falta para que el centro se pueda seguir administrando: quien
 * los tiene todos puede crear, editar y asignar cualquier rol que él mismo
 * tenga. Se define por permisos y no por el nombre «Administrador» porque los
 * roles se renombran.
 */
export const PERMISOS_DE_ADMINISTRACION: readonly string[] = [
  P.VER_USUARIOS,
  P.CREAR_USUARIOS,
  P.EDITAR_USUARIOS,
  P.ELIMINAR_USUARIOS,
  P.VER_ROLES,
  P.CREAR_ROLES,
  P.EDITAR_ROLES,
  P.ELIMINAR_ROLES,
];

/** Los permisos de `pedidos` que no están en `propios`, sin repetir y en orden. */
export function permisosQueLeFaltan(
  pedidos: Iterable<string>,
  propios: readonly string[],
): string[] {
  const tiene = new Set(propios);
  return [...new Set(pedidos)].filter((p) => !tiene.has(p)).sort();
}

export function administraElCentro(permisos: Iterable<string>): boolean {
  const tiene = new Set(permisos);
  return PERMISOS_DE_ADMINISTRACION.every((p) => tiene.has(p));
}

/** Nombre y permisos de un rol del centro, o `null` si no es de este centro. */
export async function rolDelCentro(
  roleId: string,
  tenantId: string,
): Promise<{ name: string; permisos: string[] } | null> {
  const rol = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    select: {
      name: true,
      permissions: { select: { permission: { select: { name: true } } } },
    },
  });
  if (!rol) return null;
  return {
    name: rol.name,
    permisos: rol.permissions.map((rp) => rp.permission.name),
  };
}

export type CambioDeAdministracion =
  /** La cuenta pasa a `rolNuevo`, o se elimina si es `null`. */
  | { usuario: string; rolNuevo: string | null }
  /** El rol queda con estos permisos. */
  | { rol: string; permisosNuevos: readonly string[] };

/**
 * `true` si el cambio deja al centro sin ninguna cuenta que lo administre,
 * habiendo al menos una antes. Si ya no había ninguna, no bloquea: la regla
 * protege a la última, no impide trabajar a un centro mal configurado.
 *
 * No es atómico con la escritura que sigue: dos administradores que se quitan
 * el rol el uno al otro en el mismo instante podrían pasar los dos. Como nadie
 * cambia su propio rol, hace falta que dos cuentas lo intenten a la vez.
 */
export async function dejaSinAdministracion(
  tenantId: string,
  cambio: CambioDeAdministracion,
): Promise<boolean> {
  const roles = await prisma.role.findMany({
    where: { tenantId },
    select: {
      id: true,
      users: { select: { id: true } },
      permissions: { select: { permission: { select: { name: true } } } },
    },
  });

  const permisosPorRol = new Map(
    roles.map((r) => [r.id, r.permissions.map((rp) => rp.permission.name)]),
  );
  const rolPorUsuario = new Map<string, string>();
  for (const r of roles) {
    for (const u of r.users) rolPorUsuario.set(u.id, r.id);
  }

  const contar = (
    permisos: Map<string, readonly string[]>,
    cuentas: Map<string, string>,
  ) =>
    [...cuentas.values()].filter((roleId) =>
      administraElCentro(permisos.get(roleId) ?? []),
    ).length;

  const antes = contar(permisosPorRol, rolPorUsuario);
  if (antes === 0) return false;

  const permisosTras = new Map<string, readonly string[]>(permisosPorRol);
  const cuentasTras = new Map(rolPorUsuario);
  if ('rol' in cambio) {
    permisosTras.set(cambio.rol, cambio.permisosNuevos);
  } else if (cambio.rolNuevo === null) {
    cuentasTras.delete(cambio.usuario);
  } else {
    cuentasTras.set(cambio.usuario, cambio.rolNuevo);
  }

  return contar(permisosTras, cuentasTras) === 0;
}

export type MotivoDeRechazo =
  | 'propio-rol'
  | 'asigna-permisos-que-no-tiene'
  | 'cuenta-con-mas-permisos'
  | 'rol-con-mas-permisos'
  | 'ultima-administracion';

/**
 * Respuesta de un rechazo por estas reglas. Va a `warn` y no a `error`: es un
 * rechazo esperado, pero un intento de subirse de rol merece llegar a Sentry.
 * Se registra el motivo y los ids, no el mensaje, que lleva nombres.
 */
export function rechazoPorLimite(
  motivo: MotivoDeRechazo,
  error: string,
  contexto: { action: string; [clave: string]: unknown },
): { success: false; error: string } {
  logger.warn('Cambio rechazado por los límites de permisos', {
    ...contexto,
    motivo,
  });
  return { success: false, error };
}

export function noPuedeAsignar(rol: string, faltan: readonly string[]): string {
  return `No puede asignar el rol «${rol}»: incluye permisos que su rol no tiene (${faltan.join(', ')}).`;
}

export function noPuedeDarPermisos(faltan: readonly string[]): string {
  return `No puede dar a un rol permisos que su rol no tiene (${faltan.join(', ')}).`;
}

export function noPuedeModificarCuenta(
  nombre: string,
  verbo: 'modificar' | 'eliminar',
): string {
  return `No puede ${verbo} la cuenta de ${nombre}: su rol tiene permisos que el suyo no tiene.`;
}

export function noPuedeModificarRol(rol: string): string {
  return `No puede modificar el rol «${rol}»: tiene permisos que su rol no tiene.`;
}

export const PROPIO_ROL =
  'No puede cambiar su propio rol. Pídale el cambio a otra cuenta que administre el centro.';

export const ULTIMA_ADMINISTRACION =
  'El cambio dejaría al centro sin ninguna cuenta con todos los permisos de usuarios y roles. Asigne primero un rol con esos permisos a otra cuenta.';
