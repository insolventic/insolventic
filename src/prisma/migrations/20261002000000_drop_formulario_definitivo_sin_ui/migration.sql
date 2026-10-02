-- Borra las tablas `acreedores`, `bienes` y `procesos_judiciales` (modelos
-- Prisma `Acreedor`, `Bien`, `ProcesoJudicial` — Secciones V, VI y VII del
-- "Formulario Definitivo").
--
-- POR QUÉ ES SEGURO BORRARLAS
--   Auditoría transversal formulario -> plantillas (2026-10-02): los 3
--   modelos se agregaron completos el 2026-02-21 (commit ba65470) para que el
--   sistema replicara, sección por sección, el formulario legal oficial. En
--   algún momento posterior el wizard de alta se reestructuró y las 6
--   secciones que los alimentaban (V, VI, VII, IX, X, XII) dejaron de estar en
--   ninguna pestaña activa; `#59` solo recogió los 6 componentes ya
--   inalcanzables. Desde entonces:
--     · Cero UI de captura para los 3 modelos (ni en alta ni en edición).
--     · Cero datos de seed (ni Armonía ni Constructores de Paz).
--     · La única vía que los llenaba era `fillTestData()`, solo development.
--     · Cero plantillas consumen ninguno de sus placeholders: se verificaron
--       una por una las ~100 claves que emitían `mapAcreedoresDefinitivo`,
--       `mapBienesDefinitivo`, `mapProcesosJudicialesDefinitivo` y
--       `mapFormularioDefinitivoFields` (las cuatro se borraron en este mismo
--       commit) contra los ~65 archivos de `templates/`: cero coincidencias.
--       El golden master de render (`render-hashes.json`) no cambió un byte al
--       borrarlas.
--
-- GUARDA CONTRA PÉRDIDA DE DATOS
--   Verificado el 2026-10-02 contra producción real (Neon), solo lectura
--   (BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;): 0 filas en las 3
--   tablas. La guarda de abajo repite esa misma comprobación en el momento de
--   aplicar la migración, para que un entorno distinto (otro tenant, otra
--   base, un seed futuro que las vuelva a poblar sin querer) no pierda datos
--   en silencio: si alguna tabla tiene filas, ABORTA con el detalle y no toca
--   nada (el DDL de Postgres es transaccional).
--
-- IDEMPOTENTE
--   `IF EXISTS` en cada DROP: estas 3 tablas son parte de la deriva de
--   migraciones documentada en `docs/CHECKPOINT_2026-09-09.md` (nacieron por
--   `db push`, sin migración propia) — si el historial de alguna base ya no
--   las tiene, esta migración no aborta.
--
-- ROLLBACK (Prisma no tiene migraciones "down"; se hace a mano)
--   Las 3 tablas no tienen ninguna fila que recuperar (ver guarda arriba). La
--   definición completa de los 3 modelos, para recrearlas si hiciera falta,
--   queda en el historial de git de `src/prisma/schema.prisma` justo antes de
--   este commit.

DO $$
DECLARE
  tabla text;
  cnt   bigint;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['acreedores', 'bienes', 'procesos_judiciales'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = tabla
    ) THEN
      EXECUTE format('SELECT count(*) FROM %I', tabla) INTO cnt;
      IF cnt > 0 THEN
        RAISE EXCEPTION
          'No se borra "%": tiene % fila(s) y el diseño asumía 0 (sin UI de captura en ningún entorno). Revisar esos datos antes de borrar la tabla.',
          tabla, cnt;
      END IF;
    END IF;
  END LOOP;
END
$$;

DROP TABLE IF EXISTS "acreedores" CASCADE;
DROP TABLE IF EXISTS "bienes" CASCADE;
DROP TABLE IF EXISTS "procesos_judiciales" CASCADE;
