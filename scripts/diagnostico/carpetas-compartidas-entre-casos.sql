-- Solo lectura. Casos que comparten la misma carpeta de Google Drive
-- ("Case"."driveFolderId"), sobre todo entre centros distintos.
--
-- Por qué puede pasar: hasta fix/case-drive-folder, el primer comprobante de
-- pago de un caso sin carpeta guardada la buscaba o creaba en la RAÍZ de Drive
-- con el número del caso (findOrCreateCaseFolder), sin la carpeta del centro.
-- Los números de caso son una secuencia por centro, así que dos INSOL-000007
-- de centros distintos podían recibir la misma carpeta, y desde la carpeta
-- única por caso todo el expediente la adopta.
--
-- Qué muestra: un grupo por carpeta compartida, con los ids de los casos, el
-- slug de su centro y conteos. No muestra el id de la carpeta, números de caso
-- ni datos del deudor. Los casos en la papelera cuentan: su carpeta sigue en
-- Drive.
--
-- Qué NO puede ver: un caso con la carpeta en la raíz que todavía no comparte
-- con nadie. Desde la base es igual a cualquier otro caso con carpeta; para
-- esos, ver casos-v1-con-layout-0.sql (columna en_indice_v0).
--
-- No escribe nada: corre en una transacción de solo lectura y termina en
-- ROLLBACK.
--
-- Uso: psql "$DATABASE_URL" -f scripts/diagnostico/carpetas-compartidas-entre-casos.sql

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Resumen: cuántas carpetas se comparten y entre cuántos casos y centros.
WITH compartidas AS (
  SELECT
    c."driveFolderId",
    COUNT(*)                     AS casos,
    COUNT(DISTINCT c."tenantId") AS centros
  FROM "Case" c
  WHERE c."driveFolderId" IS NOT NULL
  GROUP BY c."driveFolderId"
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*)                                AS carpetas_compartidas,
  COUNT(*) FILTER (WHERE centros > 1)     AS entre_centros_distintos,
  COUNT(*) FILTER (WHERE centros = 1)     AS dentro_de_un_mismo_centro,
  COALESCE(SUM(casos), 0)                 AS casos_afectados
FROM compartidas;

-- 2. Detalle: un renglón por carpeta compartida. `grupo` es un número de
-- orden, no el id de la carpeta.
WITH compartidas AS (
  SELECT c."driveFolderId"
  FROM "Case" c
  WHERE c."driveFolderId" IS NOT NULL
  GROUP BY c."driveFolderId"
  HAVING COUNT(*) > 1
)
SELECT
  DENSE_RANK() OVER (ORDER BY s."driveFolderId")             AS grupo,
  COUNT(DISTINCT c."tenantId")                                AS centros,
  COUNT(*)                                                    AS casos,
  string_agg(DISTINCT t.slug, ', ' ORDER BY t.slug)           AS slugs_de_centro,
  string_agg(c.id || ' (' || t.slug || ')', ', ' ORDER BY t.slug, c.id)
                                                              AS casos_y_centro,
  COUNT(*) FILTER (WHERE c.deleted_at IS NOT NULL)            AS en_papelera,
  string_agg(DISTINCT c.layout_version::text, ', ')           AS layout_version
FROM compartidas s
JOIN "Case" c   ON c."driveFolderId" = s."driveFolderId"
JOIN "Tenant" t ON t.id = c."tenantId"
GROUP BY s."driveFolderId"
ORDER BY centros DESC, casos DESC, grupo;

ROLLBACK;
