# Semana 6 — Columnas nuevas para C-1a (de fondo) y C-1c (completo)

**Fecha:** 2026-10-17
**Base:** `dev` @ `fe82fe6` (con el merge de #138 incluido) · **Rama:**
`fix/conciliacion-columnas-fechas` · **PR:**
[#139](https://github.com/insolventic/insolventic/pull/139) (abierto, **sin
mergear**)
**Origen:** los dos hallazgos de la auditoría del formulario de conciliación
que sí requerían cambio de schema (quedaron fuera de `#138`): C-1a de fondo
(las 3 fechas reales, no el blanco interino) y C-1c completo (Aclaración de
Acta + referencias de unión + desistimiento).
**Incluye migración de schema.** Aditiva e idempotente — ver §3.

> **Este documento NO está commiteado.**

---

## 1. Resumen

6 commits atómicos, uno por tarea del encargo (el diseño de las 11 columnas
quedó confirmado antes de empezar — ver el historial de esta conversación).

| #   | Qué                                                          | Commit    |
| --- | ------------------------------------------------------------ | --------- |
| 1   | Migración + `schema.prisma` — 11 columnas nuevas             | `756342d` |
| 2   | Zod — las 11, con fechas validadas y no futuras              | `1225801` |
| 3   | Formulario + persistencia (crear y editar)                   | `a6dc7a7` |
| 4   | Mapper — lee las 3 fechas reales, no más strings sin columna | `41d7ec0` |
| 5   | Cobertura bidireccional — cierra los 17 pendientes           | `434a7a3` |
| 6   | Auditoría escrita                                            | `114c75a` |

### Verificación local (idéntica a lo que corren los checks de CI)

| Check              | Resultado                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | ✅ 0 errores                                                                                                                                                                                                               |
| `npm run lint`     | ✅ 0 errores / 0 warnings                                                                                                                                                                                                  |
| `npx jest --ci`    | ✅ **1957 tests / 136 suites** (venía de 1933/134 tras #138) — corrido también completo bajo `TZ=UTC` y bajo `TZ=America/Bogota`, mismo resultado en los dos                                                               |
| `npm run test:db`  | ✅ **111 / 111**, 7 suites, contra Postgres 16 real — incluido el guardián de deriva de migraciones (`migraciones-desde-cero.db.test.ts`), que sigue viendo exactamente la misma brecha conocida (3 tablas, 30 statements) |
| `npm run test:e2e` | ✅ **13 / 13**                                                                                                                                                                                                             |
| Golden master      | ✅ confinado a `CONCILIATION/` — 9 claves de placeholders (3-4 escenarios) + 22 hashes de render (6 plantillas); 0 cambios fuera                                                                                           |

**+24 tests nuevos** desde la base (1933→1957), en 2 suites nuevas (Zod de la
fecha histórica, placeholders de las 3 fechas reales) y 1 suite db nueva
(ciclo crear→editar→leer de las 11 columnas).

---

## 2. Qué cambió, commit por commit

### 2.1 Migración + schema (`756342d`)

11 columnas nuevas en `Case`, todas `NULLABLE`, sin `DEFAULT`:

- **3 `DateTime?`** (C-1a): `concFechaSolicitud`, `concFechaCitacion`,
  `concFechaDesistimiento`. Una columna por fecha, no tres strings por
  componente (día/mes/año) — con una fecha real, Zod puede validar que
  exista y que no sea futura; con tres strings sueltos, el formulario
  aceptaría un "31 de febrero".
- **8 `String?`** (C-1c): `concCampoConError`, `concDescripcionError`,
  `concValorIncorrecto`, `concValorCorrecto` (qué corrige la Aclaración de
  Acta); `concNumeroActaUnionRef`, `concNumeroTramiteUnionRef` (a qué
  acta/trámite de unión se refiere); `concTipoSolicitanteDesistimiento`,
  `concApoderadoDesistimientoName` (quién desiste).

**NO incluidas, a propósito:** las fechas de unión, declaración de unión y
disolución (C-1b) — decisión de diseño pendiente con la abogada, no un hueco
de esta rama — ni las 5 columnas muertas de C-4.

### 2.2 Zod (`1225801`)

Helper nuevo, `fechaHistoricaOpcional` (`src/features/case/schemas.ts`):
cadena vacía/ausente aceptada, fecha de calendario real exigida (rechaza
`2026-02-31`, `2025-02-29` en año no bisiesto, etc.), y no puede ser futura
—comparada contra "hoy en Colombia" (`Intl.DateTimeFormat` con
`timeZone: 'America/Bogota'`), no contra la hora cruda del servidor. Los 8
campos de texto, `z.string().optional().nullable()` simple.

### 2.3 Formulario + persistencia (`a6dc7a7`)

- 4 fieldsets nuevos en `ConciliationDetailsSection` (compartida por
  `create-case-dialog` y `edit-case-dialog`): "Fechas reales del trámite" (3
  `<input type="date">`), "Aclaración de Acta" (4 campos), "Referencias del
  Acta de Unión" (2 campos) y "Desistimiento" (2 campos).
- **Las 3 fechas necesitaron tocar `actions.ts`.** El mecanismo genérico de
  `conc*`/`apoyo*` (PR #89) deja pasar esos campos tal cual al spread final
  — para las 8 de texto eso basta, pero las 3 fechas llegan como el string
  `"YYYY-MM-DD"` del input, y Prisma rechaza eso para una columna `DateTime`.
  Se extraen de `rest` ANTES del spread en `createCase`/`updateCase` y pasan
  por `parseDateOnly` — igual que `filingDate` y las demás fechas
  procesales. También se agregaron a `CAMPOS_CON_VALOR_AUDITABLE`
  (`audit-diff.ts`): son fechas procesales, mismo criterio que
  `filingDate`/`hearingDate`, no datos de la persona.
- `pickTypeSpecificFields` (`type-specific-fields.ts`, diálogo de edición)
  ahora convierte `Date → YYYY-MM-DD` para cualquier campo `conc*`/`apoyo*`
  — sin esto, editar un caso con una de estas 3 fechas ya guardada la
  mostraba en blanco en vez de precargarla.
- **Verificado contra Postgres real**
  (`tests/db/conciliacion-fechas-reales.db.test.ts`): ciclo crear → editar →
  leer para las 11 columnas — (1) crear con un valor A y leer, (2) editar a
  un valor B y leer (confirma que `updateCase` **actualiza**, no solo
  acepta), (3) editar sin reenviarlas y confirmar que **no se borran por
  omisión**. 3 tests, 3 pasan.

### 2.4 Mapper (`41d7ec0`)

`DIA_/MES_/ANO_SOLICITUD`, `_CITACION`, `_DESISTIMIENTO` y `FECHA_SOLICITUD`
dejan de leer `raw.concDiaSolicitud`/`concDiaCitacion`/`concDiaDesistimiento`
y hermanas (strings sin columna, que en producción llegaban siempre
`undefined`) y pasan a leer las 3 columnas `DateTime` reales, con los mismos
helpers de zona horaria que ya usan `DIA_AUDIENCIA`/`DIA_FRACASO`
(`getDayNumber`/`getMonthName`/`getYear`/`formatDateComplete`, todos sobre
`America/Bogota` vía `displayTimeZone`). Con dato, imprime la fecha real; sin
dato, sigue en el mismo blanco visible que dejó el interino de `#138` —
nunca "hoy".

**Test obligatorio de zona horaria**
(`tests/unit/documents/conciliacion-fechas-reales-placeholders.test.ts`):
una fecha guardada como `2026-03-01T12:00:00.000Z` imprime día 1, marzo,
2026 — corrido completo bajo `TZ=UTC` y `TZ=America/Bogota`, mismo resultado
en los dos, porque los helpers convierten a `America/Bogota` con
`toLocaleDateString(..., { timeZone })` sin importar el `TZ` del proceso.

**Efecto colateral en fixtures y golden master**, explicado y verificado
antes de regenerar: `tests/helpers/mapper-scenarios.ts` ya no simula las 9
lecturas `concDia/Mes/Ano{Citacion,Solicitud,Desistimiento}` (el mapper no
las lee más) — ahora fija las 3 columnas `concFecha*` reales, con un día
distinto cada una para que un test que las mezcle lo note. Los escenarios
`conciliacion-basica`/`varios-menores`/`xss` (que no fijan estas 3 columnas
explícitamente) pasan del blanco interino a una fecha real, porque el
fixture (`fill: 'full'`, el default) ahora puebla las 3 columnas nuevas como
cualquier otra columna real de `Case` — el mismo efecto que ya se vio en
`#138` con los 8 campos de texto cuando se agregaron como columnas.
`conciliacion-con-fechas`/`sin-fechas` prueban explícitamente la rama "hay
valor" y "sin valor". Confirmado con diff de claves que los únicos cambios
están dentro de `CONCILIATION/` — 0 fuera.

### 2.5 Cobertura bidireccional (`434a7a3`)

`conciliacion-formulario-cobertura.test.ts` traía inventariados, como
pendientes, exactamente los 17 campos que cierra esta rama (9 de las 3
fechas + 8 de C-1c) más `FECHA_SOLICITUD`. El test es bidireccional a
propósito — ya fallaba por "ya no está roto" antes de este commit, que lo
actualiza. Quedan solo los pendientes reales: fecha del acta original y los
de unión/disolución (C-1b, con la abogada).

### 2.6 Auditoría (`114c75a`)

`docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md`: C-1a pasa de
"cerrado interino" a "cerrado de fondo", C-1c pasa de abierto a cerrado.
Quedan abiertos C-1b y C-4, sin cambios de esta rama.

---

## 3. La migración exacta

`src/prisma/migrations/20261017000000_add_conciliacion_fechas_reales_y_aclaracion/migration.sql`:

```sql
-- C-1a: fechas reales (DateTime, no String)
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
```

**Por qué es segura:** solo `ADD COLUMN`, ninguna de las 11 tiene `DEFAULT`
ni es `NOT NULL` (no reescribe filas existentes, no bloquea la tabla más allá
del catálogo), y cada línea lleva `IF NOT EXISTS` — mismo patrón que
`20260910000000_add_apoyo_columns_to_case`. Ninguna fila de producción puede
tener hoy estos datos (no existían como columna), así que no hay nada que
rellenar hacia atrás.

**Verificado que no amplía la brecha conocida de migraciones:**
`tests/db/migraciones-desde-cero.db.test.ts` corrió `migrate deploy` real
contra una base vacía, con esta migración incluida, y sigue viendo
exactamente `BRECHA_CONOCIDA` (3 tablas, 30 statements) — ni la cerró ni
apareció una nueva.

---

## 4. Riesgos y qué verificar antes de promover a `main`

- **Nada toca producción desde esta sesión.** Todo lo de arriba se verificó
  contra el Postgres local de prueba (`insolventic-db-verif`, ya removido
  al terminar) y contra el build local de Playwright — nunca contra Neon ni
  contra un deployment real.
- **La migración es la primera cosa que corre en producción cuando esto se
  promueva.** Es aditiva e idempotente por diseño, pero **antes de mergear
  a `main`** vale la pena confirmar en Neon (solo lectura, como se hizo para
  el Quick Win 5) que ninguna de las 11 columnas existe ya con otro tipo —
  no debería, porque nunca se usaron sin columna salvo como strings
  `concDia*`/`concMes*`/`concAno*`, que son nombres distintos a los 11
  nuevos, pero es la verificación barata que vale hacer antes de un cambio
  de schema real.
- **Las 3 fechas nuevas entran al audit log** (`CAMPOS_CON_VALOR_AUDITABLE`).
  Si en algún momento se decide que una fecha procesal de conciliación NO
  debe quedar en el valor del log (hoy ninguna otra fecha procesal tiene esa
  restricción), hay que sacarlas de esa lista explícitamente — no pasa solo.
- **C-1b sigue pendiente de la abogada.** Las actas de unión marital y de
  disolución van a seguir saliendo con sus fechas de unión/declaración/
  disolución en blanco hasta que se decida esa captura — no es un defecto de
  esta rama, pero conviene que quien reciba el PR lo tenga presente si se
  está prometiendo "el sistema ya genera todo" para esos dos trámites.
- **C-4 (5 columnas muertas) sigue sin tocar**, igual que antes de esta
  rama — es trabajo de schema aparte, no de esta.
