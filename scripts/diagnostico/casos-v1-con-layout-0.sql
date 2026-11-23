-- Solo lectura. Casos con carpeta de Drive guardada y layout_version = 0 cuya
-- carpeta puede no ser la v0 que ese valor indica.
--
-- Por qué puede pasar, dos orígenes conocidos (los dos cerrados en
-- fix/case-drive-folder):
--  - "Generar documentos iniciales" (generateInitialDocuments, en main) crea la
--    carpeta v1 (Insolventic/..., con 01-Generados) pero guarda solo
--    driveFolderId, sin layout_version. El caso queda v1 con layout 0, y
--    después las etapas, /documents y los adjuntos lo tratan como v0.
--  - El primer comprobante de pago de un caso sin carpeta la creaba en la raíz
--    de Drive, por número de caso, y la guardaba sin layout_version.
--
-- Cómo los separa, sin mirar Drive: una carpeta v0 de verdad la crea /documents
-- y queda registrada en el índice de la pestaña Drive ("DocumentFromDrive",
-- mismo googleDriveId y centro, isFolder). Las otras dos no se registran nunca.
-- Un caso con layout 0 cuya carpeta NO está en el índice es un candidato: para
-- confirmarlo hay que abrir su carpeta en Drive (¿tiene 01-Generados? ¿cuelga
-- de Insolventic/ o de la raíz?). Las columnas con_comprobantes y
-- con_generados orientan sobre el origen: solo comprobantes apunta a la raíz.
--
-- Qué muestra: ids de caso, slug del centro, conteos y marcas sí/no. No
-- muestra ids de carpeta, números de caso ni datos del deudor.
--
-- No escribe nada: corre en una transacción de solo lectura y termina en
-- ROLLBACK.
--
-- Uso: psql "$DATABASE_URL" -f scripts/diagnostico/casos-v1-con-layout-0.sql

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Resumen por centro.
WITH con_layout_0 AS (
  SELECT
    c.id,
    c."tenantId",
    EXISTS (
      SELECT 1 FROM "DocumentFromDrive" d
      WHERE d."googleDriveId" = c."driveFolderId"
        AND d."tenantId" = c."tenantId"
        AND d."isFolder"
    ) AS en_indice_v0
  FROM "Case" c
  WHERE c."driveFolderId" IS NOT NULL
    AND c.layout_version = 0
)
SELECT
  t.slug                                      AS centro,
  COUNT(*)                                    AS casos_con_layout_0,
  COUNT(*) FILTER (WHERE l.en_indice_v0)      AS en_indice_v0,
  COUNT(*) FILTER (WHERE NOT l.en_indice_v0)  AS a_revisar_en_drive
FROM con_layout_0 l
JOIN "Tenant" t ON t.id = l."tenantId"
GROUP BY t.slug
ORDER BY t.slug;

-- 2. Los candidatos, uno por renglón.
SELECT
  c.id                                         AS caso,
  t.slug                                       AS centro,
  (c.deleted_at IS NOT NULL)                   AS en_papelera,
  EXISTS (
    SELECT 1 FROM payments p
    WHERE p."caseId" = c.id AND p."receiptFileId" IS NOT NULL
  )                                            AS con_comprobantes,
  (
    SELECT COUNT(*) FROM "Document" d
    WHERE d."caseId" = c.id AND d."isGenerated"
  )                                            AS con_generados,
  (
    SELECT COUNT(*) FROM "Case" o
    WHERE o."driveFolderId" = c."driveFolderId" AND o.id <> c.id
  )                                            AS otros_casos_con_la_misma_carpeta
FROM "Case" c
JOIN "Tenant" t ON t.id = c."tenantId"
WHERE c."driveFolderId" IS NOT NULL
  AND c.layout_version = 0
  AND NOT EXISTS (
    SELECT 1 FROM "DocumentFromDrive" d
    WHERE d."googleDriveId" = c."driveFolderId"
      AND d."tenantId" = c."tenantId"
      AND d."isFolder"
  )
ORDER BY t.slug, c.id;

ROLLBACK;
