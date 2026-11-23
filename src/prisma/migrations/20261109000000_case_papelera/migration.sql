-- Papelera de expedientes (soft-delete). Aditiva: tres columnas que aceptan
-- NULL y un índice; ningún caso existente cambia (todos quedan con
-- deleted_at = NULL, o sea, activos). El DDL es el que produce
-- `prisma migrate diff` contra schema.prisma, para no ampliar la deriva
-- conocida entre migraciones y schema.

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deleted_by_name" TEXT;

-- CreateIndex
CREATE INDEX "Case_tenantId_deleted_at_idx" ON "Case"("tenantId", "deleted_at");

-- Datos: permiso nuevo "Eliminar casos definitivamente" (borrado físico desde
-- la papelera), uno por centro, asignado SOLO al rol Administrador. Los
-- demás roles no lo reciben: es una decisión del dueño del proyecto
-- (2026-11-08). Idempotente: si ya existe, no hace nada. En una base vacía
-- (sin centros) no inserta nada.
INSERT INTO "Permission" ("id", "name", "category", "createdAt", "updatedAt", "tenantId")
SELECT md5(t."id" || ':Eliminar casos definitivamente'),
       'Eliminar casos definitivamente',
       'Casos',
       NOW(),
       NOW(),
       t."id"
FROM "Tenant" t
ON CONFLICT ("name", "tenantId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "tenantId")
SELECT md5(r."id" || ':' || p."id"),
       r."id",
       p."id",
       r."tenantId"
FROM "Role" r
JOIN "Permission" p
  ON p."tenantId" = r."tenantId"
 AND p."name" = 'Eliminar casos definitivamente'
WHERE r."name" = 'Administrador'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
