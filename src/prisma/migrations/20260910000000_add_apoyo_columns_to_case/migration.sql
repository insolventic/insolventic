-- Reconcilia las 29 columnas `apoyo_*` que el modelo `Case` declara desde el
-- commit 19e4227 (2026-04-20, "feat(apoyo): implementar modulo Acuerdos de
-- Apoyo completo") pero que NUNCA se crearon en la base de datos: aquel cambio
-- se hizo sin migración formal.
--
-- Síntoma en producción:
--   PrismaClientKnownRequestError: Invalid `prisma.case.findMany()` invocation:
--   The column `Case.apoyo_asunto` does not exist in the current database.
--
-- `findMany` con `include` (no `select`) trae TODAS las columnas escalares del
-- modelo, así que cualquier lectura de casos falla. `/cases` lleva roto desde
-- el primer despliegue posterior al 2026-04-20.
--
-- ALCANCE — verificado por dos vías independientes:
--   · schema.prisma declara 267 columnas para `Case`.
--   · `information_schema.columns` en producción devuelve 238.
--   · Diferencia: 29 — exactamente el número de columnas con prefijo `apoyo_`.
--
-- SEGURIDAD DE ESTA MIGRACIÓN:
--   · Solo ADD COLUMN. Ni un solo DROP, ALTER TYPE ni RENAME.
--   · Las 29 son NULLABLE y sin DEFAULT: no reescribe filas existentes, no
--     bloquea la tabla más allá del catálogo, y no altera ningún dato.
--   · `IF NOT EXISTS` en cada línea: si el `db push` histórico dejó alguna ya
--     creada, la sentencia se omite en vez de abortar la migración.
--   · Postgres ejecuta DDL de forma transaccional y Prisma envuelve cada
--     migración en una transacción: es todo-o-nada.
--
-- Esto NO cierra la deriva de migraciones completa (quedan ~255 columnas en
-- otros 9 modelos sin respaldo en migraciones). Cubre solo lo que rompe hoy.
-- Ver docs/DERIVA_MIGRACIONES_2026-09-10.md.

-- Datos generales del acuerdo de apoyo
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_asunto" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_descripcion_hechos" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_pretensiones" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_monto_mensual" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_plazo_meses" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_condiciones" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_tipo_apoyo" TEXT;

-- Beneficiario del apoyo
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_name" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_tipo_id" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_id" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_direccion" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_ciudad" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_correo" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_beneficiario_cel" TEXT;

-- Prestador del apoyo
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_name" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_tipo_id" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_id" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_direccion" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_ciudad" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_correo" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_cel" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_prestador_relacion" TEXT;

-- Conciliadora asignada
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_conciliadora_name" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_conciliadora_cc" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_conciliadora_tp" TEXT;

-- Resultado del trámite
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_acuerdo" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_resultado" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_causa_terminacion" TEXT;

-- Cláusulas repetibles (Json? en Prisma -> JSONB)
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "apoyo_clausulas" JSONB;
