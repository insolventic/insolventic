-- 11 columnas nuevas en `Case` para conciliación — auditoría del formulario
-- de conciliación, 2026-10-12 (hallazgos C-1a y C-1c).
--
-- QUÉ RESUELVE
--   C-1a (el más grave): DIA_/MES_/ANO_SOLICITUD, _CITACION, _DESISTIMIENTO
--   caían a `getDayNumber/getMonthName/getYear(now)` cuando no había dato —
--   cada documento afirmaba que la solicitud, la citación o el desistimiento
--   ocurrieron HOY, sin que nada lo advirtiera. Un commit anterior de esta
--   misma rama ya cambió el default de "hoy" a un blanco visible (`____`);
--   esta migración es el cierre de fondo: ahora hay una columna real donde
--   guardar la fecha, y el blanco solo aparece cuando de verdad no se
--   informó.
--
--   C-1c: la Aclaración de Acta se generaba sin decir QUÉ se estaba
--   corrigiendo (4 columnas) y sin las referencias del acta/trámite al que
--   corresponde la aclaración o el desistimiento (4 columnas más).
--
-- POR QUÉ 3 DATETIME Y NO 9 STRINGS (día/mes/año por separado)
--   El patrón ya existente para fechas sin columna propia
--   (`concDiaInicioUnion` y hermanas) es tres columnas String — pero ESE
--   patrón es precisamente el que esta migración evita para estos tres casos:
--   con tres strings sueltos el formulario acepta un "31 de febrero" y el
--   documento lo imprime tal cual. Con una columna DateTime, Zod valida que
--   la fecha exista y que no sea futura (las tres son hechos ya ocurridos),
--   y el mapper deriva DIA_/MES_/ANO_ con los MISMOS helpers de zona horaria
--   que ya usan `DIA_AUDIENCIA`/`DIA_CONSTANCIA` — nada nuevo que inventar.
--
-- LO QUE ESTA MIGRACIÓN NO TOCA, A PROPÓSITO
--   Las fechas de unión, declaración de unión y disolución (C-1b) siguen sin
--   columna: es una decisión de diseño previa a esta auditoría, pendiente de
--   la abogada, no un bug de esta rama. Tampoco se tocan las 5 columnas
--   muertas identificadas en C-4 (`concNombreMenor` y las 4 de cláusulas
--   legacy) — quedan post-lanzamiento, decisión explícita.
--
-- SEGURIDAD DE ESTA MIGRACIÓN
--   · Solo ADD COLUMN. Ni un DROP, ALTER TYPE ni RENAME.
--   · Las 11 son NULLABLE y SIN DEFAULT: no reescribe ninguna fila
--     existente, no bloquea la tabla más allá del catálogo.
--   · `IF NOT EXISTS` en cada línea — mismo patrón que
--     `20260910000000_add_apoyo_columns_to_case`: si algún entorno ya tuviera
--     alguna (no debería, pero el histórico de este proyecto ya tuvo un caso
--     de columnas creadas por `db push` sin migración), la sentencia se omite
--     en vez de abortar.
--   · Ninguna fila de producción puede tener hoy estos datos: no hay nada
--     que rellenar hacia atrás.

-- C-1a: fechas reales (DateTime, no String — ver nota de arriba)
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_fecha_solicitud" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_fecha_citacion" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_fecha_desistimiento" TIMESTAMP(3);

-- C-1c: qué corrige la Aclaración de Acta
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_campo_con_error" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_descripcion_error" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_valor_incorrecto" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_valor_correcto" TEXT;

-- C-1c: referencias del acta/trámite de unión, y desistimiento sin fecha
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_numero_acta_union_ref" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_numero_tramite_union_ref" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_tipo_solicitante_desistimiento" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "conc_apoderado_desistimiento_name" TEXT;
