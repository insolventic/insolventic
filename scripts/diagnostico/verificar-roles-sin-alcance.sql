-- Solo lectura. Lista, por tenant, los roles que tienen AL MENOS UNO de los
-- permisos cuya accion ahora pasa por el guard de visibilidad por fila
-- (assertCaseAccess / assertCaseAccessOnRow / resolveCaseVisibility del PR
-- #137), y que NO tienen ninguno de los tres permisos de alcance. Esos roles
-- pasaban el check de PERMISO pero ahora se resuelven a "no ve ningun caso" en
-- TODAS las acciones listadas.
--
-- Los 5 permisos y de donde sale cada uno (derivado del codigo del PR, no de
-- memoria -- verificado con grep contra cada archivo):
--
--   'Editar casos'       -> case/actions.ts: updateCase, updateCasePhase,
--                           addDebtToCase, removeDebtFromCase,
--                           addAssetToCase, removeAssetFromCase,
--                           addDependentToCase, removeDependentFromCase,
--                           addLibranzaToCase, removeLibranzaFromCase,
--                           addSuspendedServiceToCase,
--                           removeSuspendedServiceFromCase,
--                           addApoderadoToCase, removeApoderadoFromCase
--   'Eliminar casos'     -> case/actions.ts: deleteCase
--   'Generar documentos' -> document/actions-generation.ts: regenerateCaseDocument,
--                           generateInitialDocuments, generateAdmissionDocuments,
--                           generateAgreementDocuments, generateFailureDocuments;
--                           document/actions.ts: batchGenerateDocuments
--   'Ver documentos'     -> document/actions-generation.ts: getCaseDocumentStatus,
--                           getGenerationRequestStatus
--   'Ver reportes'       -> report/actions.ts: getCaseStatusReport,
--                           getFinancialReport, exportCasesToExcel
--
-- Los nombres son literales (P.* de src/lib/permissions.ts == columna `name`
-- de Permission == lo que muestra /users).
--
-- Uso: psql "$DATABASE_URL" -f scripts/diagnostico/verificar-roles-sin-alcance.sql
WITH permisos_afectados AS (
  SELECT unnest(ARRAY[
    'Editar casos',
    'Eliminar casos',
    'Generar documentos',
    'Ver documentos',
    'Ver reportes'
  ]) AS nombre
),
permisos_de_alcance AS (
  SELECT unnest(ARRAY[
    'Ver todos los casos',
    'Ver casos propios',
    'Ver casos como cliente'
  ]) AS nombre
)
SELECT
  t.name  AS tenant,
  t.slug  AS tenant_slug,
  r.name  AS rol,
  r.id    AS rol_id,
  COUNT(DISTINCT u.id) AS usuarios_con_este_rol,
  -- Cuales de los 5 permisos afectados tiene este rol, para saber qué se le
  -- rompe exactamente (no solo que "algo" se le rompe).
  string_agg(DISTINCT p.name, ', ' ORDER BY p.name) AS permisos_afectados_que_tiene
FROM "Role" r
JOIN "Tenant" t ON t.id = r."tenantId"
LEFT JOIN "User" u ON u."roleId" = r.id
JOIN "RolePermission" rp ON rp."roleId" = r.id
JOIN "Permission" p ON p.id = rp."permissionId" AND p.name IN (SELECT nombre FROM permisos_afectados)
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" rp2
  JOIN "Permission" p2 ON p2.id = rp2."permissionId"
  WHERE rp2."roleId" = r.id AND p2.name IN (SELECT nombre FROM permisos_de_alcance)
)
GROUP BY t.name, t.slug, r.name, r.id
ORDER BY t.name, r.name;
