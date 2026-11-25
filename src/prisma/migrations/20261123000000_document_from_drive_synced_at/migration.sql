-- Cuándo la sincronización de la pestaña Drive leyó completa la carpeta de un
-- caso. Aditiva: una columna que acepta NULL; ninguna fila existente cambia
-- (todas quedan en NULL, que la sincronización trata como "nunca leída" y lee
-- primero). El DDL es el que produce `prisma migrate diff` contra
-- schema.prisma, para no ampliar la deriva conocida entre migraciones y schema.

-- AlterTable
ALTER TABLE "DocumentFromDrive" ADD COLUMN     "synced_at" TIMESTAMP(3);
