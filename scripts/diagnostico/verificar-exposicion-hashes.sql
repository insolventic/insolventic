-- Solo lectura. Evalúa la exposición de los hashes de contraseña que /users
-- entregó al navegador hasta el deploy de 1.0.0-rc.2 (2026-11-09 02:21 UTC,
-- commit ef43432; el arreglo es #172).
--
-- No imprime ningún hash: de la columna `password` solo sale el prefijo de
-- 7 caracteres ("$2b$10$" / "$2b$12$"), que dice el algoritmo y el costo, no
-- la contraseña.
--
-- Qué entregaba el hash al navegador en 8b817c5 (verificado en el código):
--   'Ver usuarios'                         -> /users, getAllUsers (todos los del centro)
--   'Ver roles'                            -> /users, getAllRoles (usuarios de cada rol del centro)
--   'Crear/Editar/Eliminar roles'          -> respuesta de create/update/deleteRole (usuarios del rol)
--   'Crear/Editar/Eliminar usuarios'       -> respuesta de create/update/deleteUser (ese usuario)
--   updateProfile devolvía el hash propio (sin riesgo); getAssignableOperators
--   (formularios de casos) ya usaba select y no lo exponía.
--
-- Uso: psql "$DATABASE_URL" -f scripts/diagnostico/verificar-exposicion-hashes.sql

-- 1. QUIÉN PODÍA VER HASHES AJENOS: roles con alguno de los 8 permisos.
--    Con el seed de fábrica solo "Administrador" los tiene; esto detecta roles
--    editados desde la pantalla.
SELECT
  t.slug                                              AS centro,
  r.name                                              AS rol,
  string_agg(DISTINCT p.name, ', ' ORDER BY p.name)   AS permisos_que_exponian,
  string_agg(DISTINCT u.email, ', ' ORDER BY u.email) AS usuarios_con_este_rol
FROM "Role" r
JOIN "Tenant" t          ON t.id = r."tenantId"
JOIN "RolePermission" rp ON rp."roleId" = r.id
JOIN "Permission" p      ON p.id = rp."permissionId"
LEFT JOIN "User" u       ON u."roleId" = r.id
WHERE p.name IN (
  'Ver usuarios', 'Ver roles',
  'Crear usuarios', 'Editar usuarios', 'Eliminar usuarios',
  'Crear roles', 'Editar roles', 'Eliminar roles'
)
GROUP BY t.slug, r.name
ORDER BY t.slug, r.name;

-- 2. CONTRASEÑA DEL SEED TODAVÍA VIGENTE. La app hashea siempre con costo 12
--    (auth/actions.ts, user/actions.ts); solo src/prisma/seed.ts usa costo 10,
--    y lo usa con la contraseña '123456', que está en el repositorio público.
--    Un usuario con prefijo "$2b$10$" nunca cambió esa contraseña.
SELECT
  t.slug                         AS centro,
  u.email,
  r.name                         AS rol,
  left(u.password, 7)            AS prefijo_hash,
  (left(u.password, 7) = '$2b$10$') AS contrasena_del_seed,
  u."must_change_password"         AS debe_cambiarla,
  u."lastLogin"                  AS ultimo_acceso
FROM "User" u
JOIN "Tenant" t ON t.id = u."tenantId"
JOIN "Role" r   ON r.id = u."roleId"
ORDER BY contrasena_del_seed DESC, t.slug, u.email;

-- 3. USUARIOS CON UN ROL DE OTRO CENTRO (el hueco que cerró #170). Sus hashes
--    salían también en /users del centro dueño del rol. Debería dar 0 filas.
SELECT
  tu.slug  AS centro_del_usuario,
  u.email,
  tr.slug  AS centro_del_rol,
  r.name   AS rol
FROM "User" u
JOIN "Role" r    ON r.id = u."roleId"
JOIN "Tenant" tu ON tu.id = u."tenantId"
JOIN "Tenant" tr ON tr.id = r."tenantId"
WHERE u."tenantId" <> r."tenantId";

-- 4. CONTEXTO: cuántos expedientes hay por centro, para dimensionar qué
--    protegen esas cuentas.
SELECT t.slug AS centro, COUNT(c.id) AS expedientes
FROM "Tenant" t
LEFT JOIN "Case" c ON c."tenantId" = t.id
GROUP BY t.slug
ORDER BY t.slug;
