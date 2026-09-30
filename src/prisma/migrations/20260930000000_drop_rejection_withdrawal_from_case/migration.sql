-- Retira las columnas `rejection` y `withdrawal` de "Case".
--
-- Paso 5 de docs/DISENO_FASES_NUEVAS_2026-09-11.md, sección 6: "la fase es la
-- única fuente de verdad" de un Rechazo o un Retiro. Con las fases nuevas
-- (`Rechazo`, `Retiro`) estos dos booleanos quedan redundantes y competirían
-- con ellas.
--
-- POR QUÉ ES SEGURO BORRARLAS
--   · Ninguna lógica las lee: solo las escribía el formulario de edición, y
--     ni siquiera tenían un control visible. Estaban siempre en `false`.
--   · El código que las usaba ya se retiró en el commit anterior de esta rama
--     (schema.prisma, schemas Zod, formularios, seed, fixtures).
--
-- GUARDA CONTRA PÉRDIDA DE DATOS
--   El diseño afirma que siempre valen `false`, pero borrar una columna es
--   irreversible. Por eso, antes del DROP, se comprueba que ningún caso tenga
--   `true` en ninguna de las dos; si alguno lo tiene, la migración ABORTA con
--   el detalle y no se toca nada (el DDL de Postgres es transaccional).
--   Verificación equivalente, de solo lectura, antes de promover:
--     SELECT count(*) FILTER (WHERE rejection)  AS rejection_true,
--            count(*) FILTER (WHERE withdrawal) AS withdrawal_true
--     FROM "Case";                                  -- debe dar 0 y 0
--
-- IDEMPOTENTE
--   La guarda solo consulta las columnas que existan y el DROP usa IF EXISTS:
--   si el historial de migraciones de la base está desalineado (ver
--   docs/DERIVA_MIGRACIONES_2026-09-10.md) y alguna ya no está, no aborta.
--
-- ORDEN DE PROMOCIÓN (importante — expandir y luego contraer)
--   `findMany` con `include` (no `select`) trae TODAS las columnas escalares
--   del modelo. El build de producción corre `prisma migrate deploy` ANTES de
--   `next build`, y el deployment anterior sigue sirviendo hasta que termina el
--   build. Si esta migración y el código que ya no usa las columnas llegan
--   juntos, durante esos minutos el código VIEJO consulta columnas que ya no
--   existen y /cases falla (mismo tipo de incidente que el de `apoyo_*`, al
--   revés). Por eso:
--     1. Promover primero el commit que retira el código y el schema.
--     2. Con ese deployment ya en producción, promover este commit.
--
-- ROLLBACK (Prisma no tiene migraciones "down"; se hace a mano). Como todos
-- los valores eran `false`, restaurarlas no pierde información:
--   ALTER TABLE "Case"
--     ADD COLUMN "rejection"  BOOLEAN NOT NULL DEFAULT false,
--     ADD COLUMN "withdrawal" BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  col text;
  cnt bigint;
BEGIN
  FOREACH col IN ARRAY ARRAY['rejection', 'withdrawal'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Case'
        AND column_name = col
    ) THEN
      EXECUTE format('SELECT count(*) FROM "Case" WHERE %I IS TRUE', col) INTO cnt;
      IF cnt > 0 THEN
        RAISE EXCEPTION
          'No se retira "Case"."%": % caso(s) lo tienen en true y el diseño asumía 0. Revisar esos casos antes de borrar la columna.',
          col, cnt;
      END IF;
    END IF;
  END LOOP;
END
$$;

ALTER TABLE "Case"
  DROP COLUMN IF EXISTS "rejection",
  DROP COLUMN IF EXISTS "withdrawal";
