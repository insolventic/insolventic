-- Juzgado de origen de un proceso judicial. Aditiva: una columna TEXT que
-- acepta NULL; ninguna fila existente cambia. La columna existente "court"
-- conserva sus datos y pasa a representar el juzgado ACTUAL (solo cambia su
-- etiqueta en la interfaz).
--
-- Reversa (manual; Prisma no ejecuta migraciones hacia abajo):
--   ALTER TABLE "LegalProcess" DROP COLUMN "originCourt";
-- y borrar la fila de esta migración en "_prisma_migrations". Se pierde solo
-- el juzgado de origen cargado después de aplicarla.
--
-- El DDL es el que produce `prisma migrate diff` contra schema.prisma, para no
-- ampliar la deriva conocida entre migraciones y schema.

-- AlterTable
ALTER TABLE "LegalProcess" ADD COLUMN     "originCourt" TEXT;
