# Checkpoint de estado — INSOLVENTIC — 2026-09-09

> Estado tras el despliegue de emergencia de Semanas 1-2 a producción y el diagnóstico del bug de `/cases`.
> Sucede al `CHECKPOINT_2026-09-01.md`, cuyo hallazgo central (_"en producción estamos exactamente donde estábamos el 18 de agosto"_) **ya está resuelto**.

---

## 1. Resumen de una línea

**Producción dejó de estar congelada en el 18 de agosto: las Semanas 1-2 de seguridad están desplegadas y verificadas, `/cases` vuelve a mostrar los expedientes, y las tres ramas están sincronizadas. La causa raíz de `/cases` NO era el `ZodError` que se diagnosticó al principio, sino deriva de migraciones: 29 columnas `apoyo_*` que el schema declaraba desde abril y que nunca se crearon en la base. Queda pendiente la rotación de la contraseña de Neon y el mismo problema de deriva en otros 9 modelos.**

> **Actualizado 2026-09-10** con el cierre del incidente. Ver §8.

---

## 2. Estado por frente

| Frente                         | Estado                     | Detalle                                                              |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------- |
| Semanas 1-2 en producción      | 🟢 **Desplegado**          | PR #8 mergeado; `main` = `f2497a8`; smoke 4/4 en verde               |
| `DATABASE_URL` en Vercel       | 🟢 **Corregida**           | Contraseña desactualizada vs Neon; corregida en Production y Preview |
| Rotación de contraseña de Neon | 🔴 **PENDIENTE**           | Ver §4                                                               |
| Fix del 7º campo `Json?`       | 🟢 **Desplegado**          | `ebc500b`; smoke 4/4. Pendiente verificación visual de `/cases`      |
| Sincronización `main` → `dev`  | 🔴 **PENDIENTE**           | Ver §5                                                               |
| PR #4 (Semana 3)               | ⏸️ **Pendiente de review** | Sin tocar desde el 2026-09-04                                        |
| Issues abiertos                | 🟡                         | #3, #6, #7 — ver §6                                                  |

---

## 3. Lo que se desplegó, y lo que aún no

### 3.1 Primer despliegue — Semanas 1-2 (`f2497a8`)

PR #8 (`fix/promote-security-to-main`) mergeado con **merge commit**, 13 commits:

- **Semana 1:** `bfdeb47` gate de auth del middleware (C-1) · `9e037be` cierre del registro público (C-2) · `a9a1e4d` JWT fuera del body (A-3) · `c507501` CVEs high de Next (A-1) · `c588830` guards server-side (M-9)
- **Semana 2:** `8a8a1ae` rate limiting distribuido (A-2) · `c51ea96` CSP de Sentry (A-7) · `57fd2c5` health + smoke (A-5) · `f542f22` runbook (M-10)
- **Infra:** `1ad141b` fix del OOM de CI · `c53fbc5` docs de Vercel
- **Nuevos en ese PR:** `a54d92e` fix parcial de `/cases` · `ba24ec1` `instrumentation.ts` de Sentry

**Smoke post-deploy (run `34304782210`, sha `f2497a8bc`): 4/4 OK.**

```
[1/4] /api/health       → ok — app viva y BD respondiendo
[2/4] / (pública)       → ok — home responde 200
[3/4] /cases sin sesión → ok — ruta protegida redirige a login
[4/4] /register cerrado → ok — registro público cerrado
```

Los checks 3/4 y 4/4 verifican **en producción real** dos fixes de Semana 1 que hasta ese momento no estaban desplegados.

#### Nota operativa: el merge commit NO basta para desbloquear el deploy

El bloqueo del plan Hobby aplica al **commit HEAD del push**, y el merge commit que crea GitHub lleva el autor de quien mergea. `96308a7` quedó `Blocked` pese a que `ba24ec1` sí tenía el autor correcto. Se destrabó con un **commit vacío** (`f2497a8`) autorado por `Insolventic <insolvenic@gmail.com>`.

> **Para el próximo deploy:** ni squash ni merge commit preservan la autoría en la punta. La única vía fiable es un commit (aunque sea vacío) con el autor autorizado **como último commit de `main`** antes del push. Corregir esta nota en `CLAUDE.md` § Session 3, que hoy induce a error.

### 3.2 Segundo despliegue — el 7º campo (`ebc500b`, HEAD actual de `main`)

Tras el primer despliegue, `/cases` **seguía mostrando la tabla vacía**: `a54d92e` arregló 6 de 7 campos.

`apoyoClausulas` (`schema.prisma:379`, `Json?`) quedó con `.optional()` sin `.nullable()` porque aquel fix se buscó por el prefijo `conc*` y este campo es del bloque ACUERDO DE APOYO. Está en NULL en todo caso que no sea `SUPPORT_AGREEMENT` — los 28 de producción — así que `z.array(caseSchema)` seguía invalidando la lista entera.

**Verificado que no queda ninguno más:** se compararon los **216 campos nullable** del modelo `Case` en Prisma contra las **270 declaraciones** de `caseSchema`. `apoyoClausulas` era el único restante; los otros 215 correctos.

`ebc500b` contiene tres cambios:

1. `.nullable()` en `schemas.ts:788`.
2. Test de regresión reescrito para partir de la **fila real** que devuelve Prisma (los 7 campos derivados de `CAMPOS_JSON_NULLABLE`), no de los campos tocados por el fix. **Ese fue el error de origen:** el test anterior se construyó desde el fix y por eso pasaba en verde mientras producción seguía rota.
3. `apoyoClausulas` añadido a `JSON_ARRAY_FIELDS` de `sanitizeJsonFields`, cerrando el mismo descuido en el camino de escritura (latente: `Json?` exige `Prisma.DbNull`, no `null`).

14 tests en verde.

**Desplegado y verificado:** deployment de Production en `success`, smoke (run `34366358236`, sha `ebc500b69`) 4/4 OK. **Pendiente únicamente la verificación visual de `/cases`** por parte del autor.

El commit se autoró como `Insolventic` **antes** del push, aplicando la lección de §3.1 en vez de repetir el bloqueo.

---

## 4. 🔴 Rotación de la contraseña de Neon — PENDIENTE

La contraseña de la BD **estuvo en texto plano varias veces** durante el diagnóstico del smoke fallido y del login roto. Ya está corregida en las env vars de Vercel (Production y Preview), pero **falta generar una nueva** ahora que el incidente está cerrado y nadie más necesita verla.

**Pasos:** rotar en Neon → actualizar `DATABASE_URL` en Vercel (**los dos entornos**) → redeploy → confirmar con el smoke.

No es un cambio de código; el repo no se toca.

---

## 5. 🔴 Sincronización `main` → `dev` — PENDIENTE

`a54d92e`, `ba24ec1` y `ebc500b` viven solo en `main` (los dos primeros llegaron por la rama de emergencia; el tercero se commiteó directo). Son **tres** los commits que faltan en `dev`.

Sin esto, `dev` y la rama de Semana 3 no tienen el fix de `/cases` ni Sentry servidor, y el próximo PR #4 actualizado arrastraría la divergencia.

**Vía prevista:** merge de `main` a `dev`. Antes del incidente `main` era ancestro directo de `dev` (`dev..main` vacío), así que no debería haber conflicto — **reverificar** tras los commits nuevos.

---

## 6. PR e issues abiertos

| Ref       | Título                                                | Estado                                                                                                             |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **PR #4** | Semana 3 — blindaje de lógica de negocio (4 críticos) | ⏸️ Pendiente de review del autor desde el 2026-09-04. `quality-checks` verde (587 tests); `playwright` rojo por #6 |
| **#3**    | `batchHtmlToPdf` + troceo de lotes                    | 🟡 `semana-4` · lotes de 26 y 77 documentos no caben en `maxDuration=60s`                                          |
| **#6**    | E2E: 8 tests obsoletos post Semanas 1-2               | 🟡 `semana-4` · causa raíz identificada (`input[type="email"]` vs `type="text"`); uno falla _porque_ C-2 funcionó  |
| **#7**    | Vercel: bloqueo por autor de commit                   | 🟡 `infra` · vigente; ver la nota operativa de §3.1                                                                |

Rama `fix/login-email-input-type`: el fix de una línea (`type="text"` → `type="email"`) está **sin commitear**, guardado en un stash. Resolvería 6 de los 8 tests de #6 (verificado corriendo la suite E2E local: 6 fallos → 1).

---

## 7. Lo que sigue abierto y no está en ningún issue

- **Deriva del historial de migraciones.** El schema declara 70 columnas `conc_*` (+ `layout_version`, `section`, `superseded_by_id`, secciones del Formulario Definitivo) y **ninguna migración las contiene**. Solo existen 2 migraciones: `20260205212559_init` y `20260711000000_add_document_generation_request`. Producción se construyó con `db push`. Consecuencia: el camino de recuperación del RUNBOOK **no reconstruye la base real** — restaurar y migrar da un schema de febrero de 2026.
- **`src/app/api/sentry-test-temporal/`** sigue en `dev` marcado _"ELIMINAR ANTES DE PRODUCCIÓN"_. No entró en el despliegue (excluido a propósito del PR #8), pero sigue en la rama.
- **SMMLV 2026 transitorio.** El valor cargado ($1.750.905) viene del Decreto 0159 de 2026, que lo fija _transitoriamente_ tras la suspensión del 1469 de 2025 por el Consejo de Estado. Documentado con TODO(legal) en `validation-rules.ts`. Revisar si hay fallo de fondo o decreto definitivo.

---

## 8. Cierre del incidente de `/cases` (2026-09-10)

### La causa raíz NO era la que se diagnosticó

Durante dos rondas se atribuyó el problema a un `ZodError`: campos `Json?` que Prisma devuelve como `null` y que `caseSchema` rechazaba por declararlos `.optional()` sin `.nullable()`. Se corrigieron 6 campos (`a54d92e`) y luego el 7º (`ebc500b`). **El síntoma persistió idéntico tras ambos despliegues.**

La causa real, revelada tras instrumentar el `catch` de `getAllCases` (`44f98d8`):

```
PrismaClientKnownRequestError: Invalid `prisma.case.findMany()` invocation:
The column `Case.apoyo_asunto` does not exist in the current database.
```

**Por qué el diagnóstico anterior falló:** se reprodujo contra una BD local construida con `db push`, que **sí tenía todas las columnas**. Allí Prisma devolvía filas y Zod rechazaba los `null` — un bug real, pero no el de producción. Producción nunca llegaba a Zod: Prisma revienta antes.

**Por qué nadie lo vio antes:** el `catch` de `getAllCases` solo hacía `console.error`, que en Vercel va únicamente a los Runtime Logs. `src/features/case/actions.ts` tiene 21 `console.error` y 0 usos de `logger`. El error era estructuralmente invisible en Sentry.

**Desde cuándo:** `findMany` usa `include`, no `select`, así que Prisma siempre pidió todas las columnas escalares. La consulta nunca cambió. `/cases` llevaba roto desde el primer despliegue posterior al **2026-04-20** (commit `19e4227`, módulo Acuerdos de Apoyo) — meses, no desde los fixes recientes.

### El arreglo

Migración `8ec70d6`: 29 `ADD COLUMN` sobre `Case`, todas nullable y sin default (28 `TEXT` + 1 `JSONB`), con `IF NOT EXISTS`. Cero `DROP`, cero `ALTER TYPE`, cero `RENAME`.

Alcance verificado por dos vías independientes antes de escribirla:

|                                            |                                           |
| ------------------------------------------ | ----------------------------------------- |
| `schema.prisma` declara (`Case`)           | 267 columnas                              |
| `information_schema.columns` en producción | 238                                       |
| Diferencia                                 | **29** = exactamente el bloque `apoyo_*`  |
| Confirmación directa                       | cero columnas `apoyo_*` presentes         |
| `_prisma_migrations`                       | sana: 2 migraciones, en orden, sin huecos |

Aplicada vía `prisma migrate deploy` dentro del `buildCommand`, de modo que la creación de columnas y su registro ocurren en el mismo paso — evitando repetir la desincronización que originó todo. El `&&` del buildCommand la hace fail-safe: si la migración falla, `next build` no corre y no se crea deployment.

**Verificado:** `/cases` muestra los expedientes reales en ambos tenants (10 Armonía, 18 Constructores de Paz), y Sentry sin nuevos `PrismaClientKnownRequestError`.

### Qué se conserva de los fixes anteriores

`a54d92e` y `ebc500b` **no fueron desperdicio**: corrigen un bug latente real que se habría manifestado en cuanto las columnas existieran. De hecho, hoy que existen, son los que impiden que el `ZodError` aparezca. Se quedan, con sus 14 tests de regresión.

### La lección de fondo, que sigue abierta

Este incidente es un síntoma de un problema mayor: **el historial de migraciones no describe la base de datos real.** Solo existen 2 migraciones (`20260205212559_init` y `20260711000000_add_document_generation_request`); todo lo posterior se aplicó con `db push` sin dejar rastro.

Consecuencias vivas:

1. **El camino de recuperación del RUNBOOK no reconstruye la base real.** Restaurar y migrar produce un schema de febrero de 2026.
2. **Quedan 9 modelos con columnas sin respaldo en migraciones** (`Acreedor`, `Debtor`, `Bien`, `Payment`, `ProcesoJudicial`, `AuditLog`, `ConciliationCenter`, `Document`, `Notification`/`User`). Cualquier ruta de código que lea uno de ellos sin `select` puede romper igual que rompió `/cases`.
3. **La estimación por diff contra migraciones sobreestima mucho.** Para `Case` predijo 186 columnas faltantes y el alcance real era 29, porque el `db push` histórico ya había creado las de conciliación. El método fiable es comparar contra `information_schema.columns` de la base real, modelo por modelo.

**No se abordan aquí por decisión explícita:** se planifican aparte, con calma. Análisis de partida en `docs/DERIVA_MIGRACIONES_2026-09-10.md` (con la salvedad del punto 3).

### Estado de ramas al cierre

| Rama                                  | Commit    | Estado                                     |
| ------------------------------------- | --------- | ------------------------------------------ |
| `main`                                | `8ec70d6` | Desplegado y verificado                    |
| `dev`                                 | `8ec70d6` | Fast-forward desde `main`, sin divergencia |
| `fix/semana-3-logica-negocio`         | `5a963ab` | Actualizada con `dev`; 621 tests en verde  |
| `chore/remove-sentry-instrumentation` | `c5446ea` | PR #10 abierto, sin mergear                |
