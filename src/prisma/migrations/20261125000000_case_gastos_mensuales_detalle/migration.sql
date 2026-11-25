-- Detalle de gastos mensuales por concepto (Sección III del formulario de
-- insolvencia). Aditiva: una columna JSONB que acepta NULL; ninguna fila
-- existente cambia. Las 7 columnas agregadas (gastos_vivienda … otros_gastos) y
-- total_gastos_mensuales se conservan con sus datos: un caso sin detalle se
-- sigue leyendo a partir de ellas (src/features/case/gastos-mensuales.ts).
--
-- Sin backfill a propósito: derivar el detalle de las columnas viejas se hace
-- al leer, así la migración no reescribe datos de casos reales.
--
-- Reversa (manual; Prisma no ejecuta migraciones hacia abajo):
--   ALTER TABLE "Case" DROP COLUMN "gastos_mensuales_detalle";
-- y borrar la fila de esta migración en "_prisma_migrations". Se pierde solo el
-- detalle cargado después de aplicarla; las columnas viejas quedan intactas.
--
-- El DDL es el que produce `prisma migrate diff` contra schema.prisma, para no
-- ampliar la deriva conocida entre migraciones y schema.

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "gastos_mensuales_detalle" JSONB;
