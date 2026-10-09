-- AlterTable
ALTER TABLE "LegalProcess" ADD COLUMN     "processTypeOther" TEXT,
ADD COLUMN     "courtEmail" TEXT;

-- AlterTable
--
-- `IF EXISTS` agregado el 2026-10-08. Esta migración se editó DESPUÉS de haber
-- sido aplicada, lo que normalmente no se hace; el porqué, y por qué es seguro:
--
-- `procesos_judiciales` (tabla del Formulario Definitivo) NO la crea ninguna
-- migración del historial. Existía en la base real porque algún `db push` la
-- creó sin que quedara capturada en una migración, y se dropeó el 2026-10-02 en
-- 20261002000000_drop_formulario_definitivo_sin_ui. Resultado: contra una base
-- VACÍA, este ALTER moría con `P3018 / relation "procesos_judiciales" does not
-- exist` y la cadena completa quedaba inaplicable — rompiendo la restauración
-- de un backup a una base nueva y el levantado de cualquier entorno desde cero.
--
-- Con `IF EXISTS` el statement es correcto en los tres escenarios: desde cero
-- se saltea (la tabla nunca existió, y el DROP posterior ya usaba IF EXISTS);
-- sobre una base que sí tiene la tabla (como tenía producción antes del drop)
-- se aplica igual que antes; y sobre una base que ya aplicó esta migración no
-- se vuelve a ejecutar.
--
-- Por qué editar el archivo no rompe las bases que ya la aplicaron: Prisma
-- 6.19.3 no verifica el checksum de las migraciones ya aplicadas, ni en
-- `migrate deploy` ni en `migrate status`. Verificado empíricamente contra un
-- Postgres con las 11 migraciones aplicadas: tras editar este archivo, los dos
-- comandos reportan "up to date" sin ninguna queja. SI SE ACTUALIZA PRISMA,
-- hay que volver a verificarlo: una versión que sí valide checksums exigiría un
-- `migrate resolve` contra cada base ya migrada.
--
-- El replay desde cero lo cubre ahora `tests/db/migraciones-desde-cero.db.test.ts`.
ALTER TABLE IF EXISTS "procesos_judiciales" ADD COLUMN     "tipo_proceso_otro" TEXT,
ADD COLUMN     "juzgado_correo" TEXT;
