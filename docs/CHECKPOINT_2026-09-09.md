# Checkpoint de estado — INSOLVENTIC — 2026-09-09

> Estado tras el despliegue de emergencia de Semanas 1-2 a producción y el diagnóstico del bug de `/cases`.
> Sucede al `CHECKPOINT_2026-09-01.md`, cuyo hallazgo central (_"en producción estamos exactamente donde estábamos el 18 de agosto"_) **ya está resuelto**.

---

## 1. Resumen de una línea

**Producción dejó de estar congelada en el 18 de agosto: las Semanas 1-2 de seguridad están desplegadas y verificadas, `/cases` vuelve a mostrar los expedientes, y las tres ramas están sincronizadas. La causa raíz de `/cases` NO era el `ZodError` que se diagnosticó al principio, sino deriva de migraciones: 29 columnas `apoyo_*` que el schema declaraba desde abril y que nunca se crearon en la base. Queda pendiente la rotación de la contraseña de Neon y el mismo problema de deriva en otros 9 modelos.**

> **Actualizado 2026-09-10** con el cierre del incidente. Ver §8.
>
> **De lo que este párrafo daba por pendiente, al cierre de la sesión del 2026-09-10 solo queda una cosa:** la rotación de la contraseña de Neon **ya se hizo** (§4). Sigue abierta únicamente la deriva de migraciones en los otros 9 modelos (§8). Se sumaron después dos cierres que este resumen no podía anticipar: los deploys de producción (§10) y la suite E2E del #6 (§9, 13/13).

---

## 2. Estado por frente

| Frente                         | Estado                     | Detalle                                                              |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------- |
| Semanas 1-2 en producción      | 🟢 **Desplegado**          | PR #8 mergeado; `main` = `f2497a8`; smoke 4/4 en verde               |
| `DATABASE_URL` en Vercel       | 🟢 **Corregida**           | Contraseña desactualizada vs Neon; corregida en Production y Preview |
| Rotación de contraseña de Neon | ~~🔴 PENDIENTE~~ → 🟢 **Hecha** | Resuelta el 2026-09-10 — ver §4                                  |
| Fix del 7º campo `Json?`       | 🟢 **Desplegado**          | `ebc500b`; smoke 4/4. Pendiente verificación visual de `/cases`      |
| Sincronización `main` → `dev`  | 🔴 **PENDIENTE**           | Ver §5                                                               |
| PR #4 (Semana 3)               | ~~⏸️ Pendiente~~ → 🟢 **Mergeado** | `17c7de2b` en `dev` el 2026-09-12 — ver §11                           |
| Issues abiertos                | 🟡                         | #3, #6, #7 — ver §6                                                  |

> **Esta tabla quedó atrás. Estado real al 2026-09-12:**
>
> | Frente | Estado |
> | ----------------------------- | ------------------------------------------------------------------ |
> | `main` | 🟢 `d2f7cef` — Semana 3 en producción, deploy `success`, smoke 4/4 (§11, §12) |
> | Sincronización `main` ↔ `dev` | 🟢 **Idénticas** (`d2f7cef`); ver §10 sobre cómo mantenerlo así |
> | Deploys de producción | 🟢 **Arreglados** — `DIRECT_URL` verificado con Build Log en 2 despliegues (§10, §12) |
> | `/cases` | 🟢 Cerrado (§8) |
> | E2E del #6 | 🟢 **Cerrado** — 13/13 en verde, issue #6 cerrado (§9) |
> | Rotación de contraseña de Neon | 🟢 **Hecha** el 2026-09-10, verificada con `/api/health` (§4) |
> | PR #4 | 🟢 **Mergeado** (`17c7de2b`, 2026-09-12) — §11 |
> | Issues abiertos | #3, #7, #9 y **#16**. El #6 se cerró (§9) |

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

## 4. ~~🔴 Rotación de la contraseña de Neon — PENDIENTE~~ → 🟢 HECHA

> **Resuelta el 2026-09-10 por el autor**, durante esta misma sesión. Rotada en Neon, actualizada en Vercel y verificada con `/api/health` en verde después del cambio. El texto de abajo se conserva como registro del motivo.

La contraseña de la BD **estuvo en texto plano varias veces** durante el diagnóstico del smoke fallido y del login roto. Ya está corregida en las env vars de Vercel (Production y Preview), pero **falta generar una nueva** ahora que el incidente está cerrado y nadie más necesita verla.

**Pasos:** rotar en Neon → actualizar `DATABASE_URL` en Vercel (**los dos entornos**) → redeploy → confirmar con el smoke.

No es un cambio de código; el repo no se toca.

---

## 5. ~~🔴 Sincronización `main` → `dev` — PENDIENTE~~ → RESUELTO

> **Resuelto el 2026-09-10.** `main` y `dev` están en `c73454d`, idénticas.
>
> La divergencia se reabrió **tres veces** en la misma sesión, siempre por el mismo motivo: un PR mergeado contra `main` que no se propagaba de vuelta, o un commit vacío de autoría puesto sobre `main` después del fast-forward. La forma que lo evita —commit de punta sobre `dev` **antes** del fast-forward— está en §10.
>
> El texto de abajo se conserva como registro de aquel momento.

`a54d92e`, `ba24ec1` y `ebc500b` viven solo en `main` (los dos primeros llegaron por la rama de emergencia; el tercero se commiteó directo). Son **tres** los commits que faltan en `dev`.

Sin esto, `dev` y la rama de Semana 3 no tienen el fix de `/cases` ni Sentry servidor, y el próximo PR #4 actualizado arrastraría la divergencia.

**Vía prevista:** merge de `main` a `dev`. Antes del incidente `main` era ancestro directo de `dev` (`dev..main` vacío), así que no debería haber conflicto — **reverificar** tras los commits nuevos.

---

## 6. PR e issues abiertos

| Ref       | Título                                                | Estado                                                                                                             |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **PR #4** | Semana 3 — blindaje de lógica de negocio (4 críticos) | 🟢 **Mergeado** el 2026-09-12 (`17c7de2b`). Ver §11 |
| **#3**    | `batchHtmlToPdf` + troceo de lotes                    | 🟡 `semana-4` · lotes de 26 y 77 documentos no caben en `maxDuration=60s`                                          |
| **#6**    | E2E: 8 tests obsoletos post Semanas 1-2               | 🟡 `semana-4` · causa raíz identificada (`input[type="email"]` vs `type="text"`); uno falla _porque_ C-2 funcionó  |
| **#7**    | Vercel: bloqueo por autor de commit                   | 🟡 `infra` · vigente; ver la nota operativa de §3.1                                                                |

Rama `fix/login-email-input-type`: el fix de una línea (`type="text"` → `type="email"`) está **sin commitear**, guardado en un stash. Resolvería 6 de los 8 tests de #6 (verificado corriendo la suite E2E local: 6 fallos → 1).

> **Superado el 2026-09-10 — ver §9.** El fix ya está mergeado (PR #11, `767bd32`) y el stash se descartó. La cifra de este párrafo es incorrecta: medido en CI, el resultado es **8 → 3**, no 6 → 1.

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

---

## 9. Ronda E2E del #6 (2026-09-10) — números reales y hallazgo nuevo

### El fix de login se mergeó: PR #11 (`767bd32`, squash a `dev`)

`type="text"` → `type="email"` en `src/app/login/components/login-form.tsx:161`. El cambio venía sobreviviendo como stash sin respaldo remoto; se commiteó y el stash se descartó.

### Corrección del número: **8 → 3**, no "6 → 1"

El §6 de este checkpoint registraba, desde una corrida local, que el fix bajaba los fallos "de 6 a 1". **Medido en CI es 8 → 3.** Recupera 5 tests, no 6, y quedan 3, no 1.

La comparación es limpia porque hay baseline: la rama de PR #4 corre la misma suite sin este cambio.

| | PR #4 (sin el fix) | PR #11 (con el fix) |
| ---------- | ------------------ | ------------------- |
| Fallando   | **8**              | **3**               |
| Pasando    | 5                  | **10**              |
| Duración   | 10.3 min           | 2.0 min             |

Confirmación de que el selector era el problema: `auth.e2e.test.ts:44 › login with seeded credentials reaches /dashboard` **ahora pasa**. El login real funciona.

### Los 3 fallos restantes: uno conocido, dos nuevos

**Conocido — `auth.e2e.test.ts:67 › registration page renders its fields`**
`locator('input#name')` → `element(s) not found`. Falla *porque* C-2 (cierre del registro público) funcionó. Se arregla actualizando la expectativa del test, no el código.

**NUEVO — `cases.e2e.test.ts:19` y `:28`.** No son el mismo bug que el resto del #6 y no los causó el fix de login: estaban tapados detrás de él. Son **dos problemas encadenados**:

1. **Selector mal formado en el test** (causa raíz, `cases.e2e.test.ts:24`):

   ```
   Error: Unexpected token "=" while parsing css selector
   "table, [data-testid="cases-table"], text=/caso/i"
   ```

   No se pueden mezclar motores CSS y `text=` en una lista separada por comas. Es un **bug del test, no de la app**: el primer intento de `:19` falló en 1.2s y su snapshot muestra la app cargando normalmente (`"Cargando casos..."`) — o sea, el login había funcionado y se había llegado a `/cases`.

2. **Rate limiting que enmascara todo lo demás** (efecto secundario). `RATE_LIMIT_CONFIGS.login` es `{ windowMs: 15 min, maxAttempts: 5 }` con clave por IP (`src/lib/rate-limit.ts:43`, `src/features/auth/actions.ts:146`); en CI todos los tests comparten la IP del runner. `auth.e2e.test.ts` gasta 5 intentos (3 `loginAs` + 2 fills directos, uno con credenciales inválidas que también cuenta) antes de que arranque `cases.e2e.test.ts`. Confirmado con el texto literal en pantalla del artefacto de Playwright:

   > Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.

   Desde el retry #1 de `:19` en adelante, **todos** los intentos mueren aquí. `:28` ya nació bloqueado ("en 14 minutos"), así que **su estado real sigue sin observarse**: puede ser el mismo selector, u otra cosa.

### Cómo NO arreglarlo

El límite de 5 intentos/15 min **no se toca**. Existe por una razón de seguridad real en un sistema con expedientes legales; relajarlo en producción para hacer pasar un test sería exactamente el intercambio equivocado. El arreglo va en el entorno de test — desactivar o relajar el limitador solo bajo `NODE_ENV=test`, o dar identidad distinta por test.

Orden sugerido: arreglar primero el selector, luego neutralizar el limitador en test, y recién entonces volver a medir `:28`, cuyo fallo real todavía nadie ha visto.

---

## 10. Cierre del incidente de deploys de producción — `DIRECT_URL` (2026-09-10)

**Cerrado con evidencia directa del Build Log, no por inferencia.**

### La causa raíz

Los deploys de Production fallaban de forma intermitente. El Build Log lo dijo sin ambigüedad:

```
Error: P1002
The database server was reached but timed out.
```

Ocurría en `prisma migrate deploy`, contra el host **con** `-pooler`. PgBouncer en modo transacción no sostiene la sesión persistente ni los advisory locks que `migrate` necesita, y la rechaza.

Explica el patrón que se venía observando sin entender:

| Deploy | Production | Nota |
| --------- | ---------- | -------------------------------------- |
| `8ec70d6` | ✅ | aplicó la migración `apoyo_*` |
| `702e9ff` | ❌ → ✅ | falló y solo pasó al reintentar |
| `cc33d2e` | ❌ | sin reintento — quedó como HEAD de `main` |

Los tres corrían `migrate deploy` porque el `buildCommand` de `vercel.json` lo gatea con `VERCEL_ENV=production`. **Los previews lo saltan**, y por eso el Preview de `cc33d2e` salió verde con el mismo código — el experimento que aisló el problema antes de tener el log.

### El arreglo (PR #13, `e9dd65a`)

`directUrl` en el datasource: solo los comandos de migración usan la conexión sin pooler. El runtime de la app sigue por `DATABASE_URL` y el pooler, que es lo correcto en serverless.

| Archivo | Qué |
| --------------------------- | ----------------------------------------------------------- |
| `src/prisma/schema.prisma` | `directUrl = env("DIRECT_URL")`, con el porqué documentado |
| `.env.example` | `DIRECT_URL` + regla de derivación en Neon (sin `-pooler`) |
| `.github/workflows/e2e.yml` | `DIRECT_URL` en el job; sin ella `prisma db push` corta |

`DIRECT_URL` ya existía en Vercel (Production y Preview).

> **`prisma format` no se corrió, a propósito.** Reformatea las 1041 líneas del schema —nunca había pasado por `format`— y convertía un cambio de 4 líneas en un diff de 917. El bloque nuevo se alineó a mano al estilo que el propio `format` produce. Si alguna vez se quiere normalizar el schema entero, que sea un PR aislado.

### La promoción a producción

`main` estaba congelada en `cc33d2e`, con su deploy en `failure`. Se promovieron **7 commits** por fast-forward hasta `c73454d`.

De 167 líneas, **solo 3 archivos tocan la app**: `schema.prisma` (el `directUrl`), `login-form.tsx` (`type="email"`) y `cases.e2e.test.ts` (que no viaja al runtime). El resto es documentación y CI.

**Sobre el commit de punta:** `c73454d` es un commit vacío autorado por `Insolventic <insolvenic@gmail.com>`, necesario porque el HEAD de `dev` era `MaxitoJM` y el plan Hobby habría dejado el deployment en `Blocked` — sin llegar siquiera a ejecutar `migrate deploy`, que era lo que había que probar.

A diferencia de `f2497a8`, este commit vacío se puso **sobre `dev` antes del fast-forward**, no sobre `main` después. Resultado: `main` y `dev` quedan idénticos y no se reabre la divergencia que hubo que cerrar tres veces en la misma sesión. **Es la forma preferida de aquí en adelante.**

### Verificación

**Estado final del deployment: `success` a la primera.** Deployment `6382037648`, sha `c73454d`, 2026-09-10 22:03:46Z. Una sola entrada en la lista de statuses: sin fallo previo ni reintento, a diferencia de `702e9ff`.

**Build Log — la evidencia directa que cierra el caso:**

- Datasource contra `ep-proud-dream-aioxh4ny.c-4.us-east-1.aws.neon.tech` — **sin el sufijo `-pooler`**. El `directUrl` hizo exactamente lo que debía.
- Encontró las **3 migraciones**.
- `No pending migrations to apply`.
- **Sin `P1002`.**

**Smoke test 4/4** (run `34535502669`), contra la URL de este deployment:

```
[1/4] /api/health       → ok — app viva y BD respondiendo
[2/4] / (pública)       → ok — home responde 200
[3/4] /cases sin sesión → ok — ruta protegida redirige a login
[4/4] /register cerrado → ok — registro público cerrado
```

**En vivo:** `/api/health` responde `{"status":"ok","environment":"production","checks":{"database":{"status":"ok","latencyMs":3}}}`.

### La salvedad que queda viva

Este deploy corrió `migrate deploy` **sin migraciones pendientes** — `8ec70d6` ya había aplicado las `apoyo_*`. Fue un no-op.

Eso no invalida el cierre: los fallos anteriores **también** eran sobre no-ops, y es precisamente lo que apuntaba a la conexión y no a la migración en sí. El log confirma el host correcto, que es la parte que importa.

Pero **la prueba de fuego real será el próximo deploy que traiga una migración nueva que aplicar**, con una transacción y advisory locks de verdad. Hasta entonces, lo verificado es que la conexión va por donde debe.

> **Actualizado el 2026-09-12 (§12).** Hay una segunda promoción a producción verificada con el Build Log. La salvedad de arriba **sigue en pie**: las dos verificaciones fueron sobre `migrate deploy` sin migraciones pendientes.

### Nota operativa: el Build Log no es accesible desde la cuenta de trabajo

`vercel inspect --logs` falla con `Can't find the deployment ... under the context "maximilianos-projects-839f5103"`, y `vercel teams ls` devuelve un solo team. **La cuenta de Vercel de `MaxitoJM` no es miembro de `insolventics-projects`** — el alcance del issue #7 es mayor que su título: no es solo que el check rechace commits de ese autor, es que la cuenta no pertenece al equipo.

Consecuencia práctica: cualquier diagnóstico que necesite un Build Log depende de la cuenta `Insolventic`. Vincular la cuenta de `MaxitoJM` al proyecto resolvería el bloqueo de deploys **y** este punto ciego de observabilidad de una sola vez.

---

## 11. PR #4 mergeado — Semana 3 en `dev` (2026-09-12)

**Los 4 críticos de la auditoría pre-launch están en `dev`.** PR #4 se mergeó con squash: `17c7de2b`.

| | |
| ------------------------- | ----------------------------------------------------------- |
| CI al mergear             | `quality-checks` ✅ · `playwright` ✅ 13/13 · 627 tests       |
| Vercel                    | ❌ `Deployment was blocked` — bloqueo por autor (#7)          |
| Contenido validado por CI | Idéntico al que corrió en `656ea34`; `dev` solo añadía el documento de diseño |

Los cuatro hallazgos compartían la misma causa: **la validación existía, pero no se invocaba en el servidor**. Estaba escrita y probada, solo que colgada de componentes de React o de una ruta que casi nadie usa, así que un POST directo a una server action las saltaba todas. El PR no escribe reglas nuevas: las cablea donde son obligatorias.

- **C-1** — `validatePhaseTransition()` como fuente única, sin Prisma ni I/O. `updateCase` deja de ser la puerta trasera de la máquina de estados y los casos nacen siempre en `Inicial`.
- **C-2** — Las reglas del trámite se aplican en `createCase` y `updateCase`. Además, el SMMLV cargado era el de 2024, con lo que la mínima cuantía se calculaba un **35% por debajo** del umbral real.
- **C-3** — `renderDocumentHtml` reporta los placeholders que la plantilla pide y el mapper no produce, y bloquea la generación en vez de subir a Drive un PDF con huecos.
- **C-4** — La generación por lotes de `/documents` era la única ruta sin lock anti-duplicados. Se añade `maxDuration=60` y una generación que no produjo ningún documento deja de contar como exitosa.

### Decisiones tomadas en el review

**El `PHASE_TRANSITIONS` actual se aprueba como paso intermedio, no como modelo definitivo.** El modelo final añade 5 fases —`Rechazo`, `Retiro`, `Desistimiento`, `Acuerdo impugnado`, `Acuerdo reformado`— y elimina `Inicial → Fracaso` y `Admisión → Fracaso`. El diseño está cerrado en `docs/DISENO_FASES_NUEVAS_2026-09-11.md` y se implementa sobre esta base ya mergeada.

**El tope de 150 SMMLV se queda como aviso, no como bloqueo.** Confirmado por el cliente: las deudas no tienen tope real y puede haber montos altos legítimos.

**La regex de `{{#each}}` del detector de C-3 se acepta como deuda menor, no bloqueante.** No coincide con la sintaxis real de las plantillas, que llevan argumento. Hoy es inofensiva **por coincidencia**: la única variable dentro de un `each` (`NOMBRE_MENOR`) también existe en el contexto raíz. El día que alguien añada un `{{#each}}` con un campo que solo exista dentro del bloque, el documento se bloquearía sin motivo.

### Lo que sigue abierto de este frente

- **Validación jurídica del SMMLV 2026** ($1.750.905): viene del Decreto 0159 de 2026, transitorio tras la suspensión del 1469 de 2025. Queda con `TODO(legal)` en el código.
- **Completitud de documentos adjuntos**: `validateDocumentsComplete` necesita la lista de archivos subidos, que el servidor no conoce al crear el caso.
- **Lotes grandes**: `maxDuration=60` compra margen pero no elimina el problema. Seguimiento en **#3**.

---

## 12. `DIRECT_URL` — segunda verificación en producción (2026-09-12)

**Dos promociones consecutivas a producción con `directUrl`, ambas verificadas leyendo el Build Log**, no por ausencia de fallo.

| | Deploy 1 | Deploy 2 |
| ------------------- | -------------------------- | -------------------------- |
| Commit              | `c73454d` (2026-09-10)     | `d2f7cef` (2026-09-12)     |
| Estado              | `success` a la primera     | `success` a la primera     |
| Host del datasource | **sin** `-pooler`          | **sin** `-pooler`          |
| Migraciones         | 3 encontradas, sin pendientes | sin pendientes           |
| `P1002`             | ausente                    | ausente                    |
| Smoke               | 4/4                        | 4/4                        |

Antes del arreglo el patrón era: `702e9ff` rojo y verde solo al reintentar, `cc33d2e` rojo sin reintento. Después del arreglo, dos despliegues seguidos en verde al primer intento.

### Lo que falta para el cierre total

Las dos verificaciones fueron sobre un `migrate deploy` **sin migraciones pendientes**: confirman que la conexión va por el host correcto, no que una migración real se aplique bien por esa vía.

**La pieza que cierra el incidente es la próxima promoción que traiga una migración de verdad.** Lo más probable es que sea la del diseño de fases nuevas (`docs/DISENO_FASES_NUEVAS_2026-09-11.md`), porque retira las columnas `rejection` y `withdrawal`. Ahí habrá transacción y advisory locks reales, que es justo lo que PgBouncer en modo transacción rechazaba.

### Descartado por el camino: la hipótesis de la reutilización del build

Al ver que el deployment de Production se creaba y pasaba a `success` en el mismo segundo, se sospechó que Vercel pudiera estar reutilizando el build del preview del mismo commit — lo que habría significado que `migrate deploy` no corrió, porque los previews lo saltan por el gate `VERCEL_ENV=production`.

**La hipótesis es falsa, por dos motivos independientes:**

1. Vercel crea el registro de deployment en GitHub **cuando el build termina**, no cuando empieza. Por eso `created_at` y el estado coinciden; el patrón se repite en todos los deployments, incluido el fallido de `702e9ff`. La marca de tiempo no significaba nada.
2. El Preview y el Production de `d2f7cef` tienen **URLs distintas** (`…jnem764xb…` y `…c5lqbpj9c…`), o sea dos builds independientes.

La deduplicación por SHA que sí existe pertenece a la **API REST** (`POST /v13/deployments`, con el parámetro `forceNew` para desactivarla), no a la integración con Git, que despliega cada push. Las otras vías de reutilización —*Promote*, *Instant Rollback*— son acciones manuales. Y la caché de build **no salta el `buildCommand`**: acelera, pero `migrate deploy` se ejecuta igual.
