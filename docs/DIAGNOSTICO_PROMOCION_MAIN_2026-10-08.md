# Diagnóstico — ¿`dev` está lista para promoverse a `main`?

**Fecha:** 2026-10-08
**Alcance:** solo lectura. No se tocó `main`, no se hizo push, no se corrió ninguna migración contra una base real.
**Encargo:** evaluar si se puede promover `dev` → `main` ahora, dado que incluye los 5 PR críticos de documentos mergeados hoy.

---

## Resumen ejecutivo

**No promover todavía.** Hay un riesgo de producción real y reproducible, no teórico: `DEPLOY_PR40.md` describe un plan de despliegue en dos tiempos para evitar exactamente este riesgo, pero **ese plan nunca se ejecutó** — PR #40 se mergeó a `dev` entero, de un solo commit, código y migración juntos. Si `dev` se promueve a `main` en un solo push hoy, se reproduce el incidente que el plan fue escrito para prevenir (mismo patrón que el incidente de `apoyo_*`, documentado en `CHECKPOINT_2026-09-09.md` §8, pero al revés).

Además, la corrección de `main..dev` no es "106+ commits" — son **126** contra el `origin/main` real (`d2f7cef`, 2026-09-11). El número que tenías puede venir de comparar contra una copia local de `main` desactualizada; verificá siempre contra `origin/main`, no contra `main` local sin `fetch`.

---

## 1. ¿Sigue vigente el plan de `DEPLOY_PR40.md`?

**No.** El plan describe una secuencia de dos despliegues a `main` —primero el código que deja de usar `rejection`/`withdrawal`, después (en un push aparte) la migración que borra esas columnas— construida sobre una rama especial, `deploy/pr40-paso1`, hecha con cherry-pick para no reordenar la rama real de #40.

Lo que pasó en la práctica, el 2026-09-30:

```
a0ac5d7 feat(fases): 5 fases nuevas del expediente + Paso 5 (retiro de rejection/withdrawal, migracion con guarda) (#40)
```

El propio mensaje de ese commit dice **"NO PROMOVER A MAIN DE CORRIDO. El despliegue va en dos tiempos, según docs/DEPLOY_PR40.md"** — pero eso es una instrucción para cuando se promueva *esta rama* (`dev`) a `main`, no una descripción de cómo se mergeó a `dev`. Y a `dev` se mergeó **completo**: código y migración (`20260930000000_drop_rejection_withdrawal_from_case`) en el mismo commit, mezclado con el merge de las tandas 1–4 de `dev` y un reordenamiento de la migración para que corriera después de las aditivas de la Tanda 4.

Confirmado con los datos del repo:

```bash
$ git merge-base --is-ancestor origin/deploy/pr40-paso1 origin/dev
# NO es ancestro — la rama quedó huérfana, nunca se promovió por ese camino
$ git merge-base --is-ancestor origin/feat/fases-nuevas-case-phases origin/dev
# NO es ancestro — tampoco se usó el merge normal que describe el "Paso 2"
```

Las ramas `deploy/pr40-paso1` y `feat/fases-nuevas-case-phases` siguen existiendo en el remoto, pero son historia muerta: nadie las usó para llegar a este punto. **El documento describe un plan que no es el que terminó ejecutándose.** Hoy no sirve como procedimiento a seguir tal cual — sirve como diagnóstico de qué riesgo hay que mitigar, porque ese riesgo es el mismo exista o no la rama especial.

### El riesgo que describe §2 es real hoy, no hipotético

Verificado contra el código que está desplegado en este momento en `main` (`origin/main` = `d2f7cef`, 2026-09-11):

```ts
// src/features/case/actions.ts, al menos 5 sitios (líneas ~1254, 1405, 1577, 1767, 1907 de ese commit)
const caseData = await prisma.case.findUnique({
  where: { id: caseId, tenantId },
});              // SIN select NI include → Prisma trae TODAS las columnas escalares,
                  // incluidas rejection/withdrawal, que en ese commit siguen declaradas
                  // en schema.prisma (verificado, líneas 110-111)
```

Más otros 3 sitios con `include: { debtor: true, ... }` (que también trae todas las columnas escalares del modelo base).

**Lo que pasaría si se promueve `dev` → `main` en un solo push:** el `buildCommand` de `vercel.json` corre `prisma migrate deploy` (que aplicaría, entre otras, la migración que borra `rejection`/`withdrawal`) **antes** de `next build`, mientras el deployment **viejo** — el que está corriendo ahora mismo, con el código de arriba — sigue sirviendo tráfico real. En el instante en que la migración completa el `DROP COLUMN`, cualquier petición que toque esas 8 server actions falla contra Postgres hasta que el build nuevo termine y tome el tráfico. Es una ventana de error en producción, autoinfligida, exactamente la que el documento fue escrito para evitar.

**Qué hacer con esto — y qué NO alcanza.** La primera idea obvia, "promover `dev` hasta el commit justo antes de `a0ac5d7`", **no sirve**: ese commit padre (`c4be312`, 2026-09-29) todavía declara `rejection`/`withdrawal` en `schema.prisma` —verificado, `grep` encuentra las dos líneas—, así que el Prisma Client generado a partir de ese commit **sigue pidiendo esas columnas** en cualquier `findUnique`/`include` sin `select`. Promover hasta ahí no mitiga nada: deja a `main` exactamente tan expuesta como está hoy, solo que con 100 commits más encima.

El commit `a0ac5d7` mezcla dos cosas que el plan original mantenía separadas a propósito: el cambio de código (`schema.prisma` deja de declarar los dos campos, y el resto del código deja de leerlos/escribirlos) y el archivo de la migración que los borra de la base. Lo que hace falta para un "Paso 1" real es **el primero sin el segundo** — y eso sí es trivial de reconstruir hoy, sin tocar el historial de nadie, porque Prisma rastrea qué migraciones aplicar por la presencia de la carpeta en `src/prisma/migrations/`, no por ningún commit:

1. Rama nueva desde `origin/dev` (el tip actual, `47a6c2e`).
2. `git rm -r src/prisma/migrations/20260930000000_drop_rejection_withdrawal_from_case/` — un solo commit, revierte únicamente ese directorio. El resto de `dev` (schema sin los dos campos, código que no los usa, los otros 7 commits de migración) queda intacto.
3. Promover esa rama a `main` como primer push. La base sigue teniendo las columnas (nadie las borró), pero el código nuevo no las pide — conviven sin problema, que es exactamente la garantía que describe `DEPLOY_PR40.md` para `f8cb595`.
4. Confirmar el deploy sirviendo tráfico (health check, smoke test).
5. Segundo push: `origin/dev` completo (con la carpeta de la migración restaurada). `prisma migrate deploy` la va a ver como pendiente y la va a aplicar recién ahí, con el código que ya no las necesita sirviendo tráfico desde el paso 3.

Esto reemplaza a `deploy/pr40-paso1` sin reconstruirla: mismo resultado, usando el `dev` real de hoy en vez de una foto del 2026-09-28, y sin ningún cherry-pick ni reescritura de historia.

---

## 2. Estado real de la infraestructura

### 2.1 Preview de Vercel vs. producción — Neon

**Siguen compartiendo la misma base física.** Confirmado en `docs/RUNBOOK_ENV_VARS.md` (verificado contra el código el 2026-09-19, sin cambios desde entonces):

> "Pero ambas apuntan **a la misma base de datos física en Neon**. No hay un branch de Neon distinto para Preview."

Consecuencia operativa citada en el propio runbook: "Un Preview opera sobre datos reales. Cualquier acción hecha en un Preview (crear/editar/borrar un caso) escribe en producción." Está marcado como "decisión de negocio/arquitectura pendiente, no un fix técnico" — no es un bug, es una decisión no tomada. `CHECKPOINT_2026-09-28.md` §8 la vuelve a listar como pendiente de "vos" (el dueño del producto), sin resolver.

**No cambió nada desde entonces** — no hay commits ni migraciones de infraestructura (Neon no se versiona en este repo) que lo toquen.

### 2.2 Cuenta de Vercel vinculada — issue #7

**Sigue sin vincularse.** El issue está `OPEN`, sin comentarios, desde su creación. Verificado además en vivo, contra el commit de punta real de `dev` en este mismo momento:

```bash
$ gh api repos/insolventic/insolventic/commits/47a6c2e/status
{"state":"failure","statuses":[{"state":"failure","description":"Deployment was blocked", ...,"context":"Vercel"}]}
```

El commit `47a6c2e` (el HEAD actual de `dev`, autor `MaxitoJM <maxitojam@hotmail.com>` — una identidad válida según la tabla de `CLAUDE.md`) tiene su Preview deployment **bloqueado ahora mismo** por el plan Hobby de Vercel. Esto es exactamente el síntoma del issue #7, ocurriendo en vivo sobre el estado actual — no es un recuerdo de hace semanas.

Esto no bloquea per se la promoción a `main` (el protocolo ya existente — amend puntual a `Insolventic <insolvenic@gmail.com>` en el commit HEAD del push a `main`, sin tocar `git config` global — sigue siendo válido y sigue funcionando), pero confirma que **cada uno de los dos pushes a `main`** del plan en dos tiempos va a necesitar ese amend por separado (ya lo advierte `DEPLOY_PR40.md` §6, nota del despliegue 2).

---

## 3. PRs/commits mergeados a `dev` desde la última promoción (`d2f7cef`, 2026-09-11) que tocan algo no trivialmente reversible

126 commits en total (`git rev-list --count origin/main..origin/dev`). De ahí, lo que no es "código puro":

### 3.1 Migraciones (8 nuevas)

| Migración | Tipo | Reversible con rollback de código solo |
| --- | --- | --- |
| `20260918000000_add_notification_city_other_cause_and_apoderados` | Aditiva (`ADD COLUMN` + `CREATE TABLE apoderados`) | Sí |
| `20260928000000_add_codebtor_phone_and_email` | Aditiva (`ADD COLUMN`) | Sí |
| `20260928010000_add_process_type_other_and_court_email` | Aditiva (`ADD COLUMN` × 2 tablas) | Sí |
| `20260928020000_add_servicios_manutencion` | Aditiva (`ADD COLUMN JSONB`) | Sí |
| `20260928030000_add_asset_pending_fines_or_taxes` | Aditiva (`ADD COLUMN NOT NULL DEFAULT false`) | Sí |
| **`20260930000000_drop_rejection_withdrawal_from_case`** | **Destructiva** (`DROP COLUMN`, con guarda) | **No** — requiere el plan en dos tiempos (§1) |
| **`20261002000000_drop_formulario_definitivo_sin_ui`** | **Destructiva** (`DROP TABLE` × 3, con guarda) | Ya verificada contra prod: 0 filas (2026-10-02). Segura en un solo push — no tiene el problema de "código viejo esperando la columna", porque ningún código activo en `main` (ni en `dev`) lee esas 3 tablas (`Acreedor`/`Bien`/`ProcesoJudicial`): nunca tuvieron UI de captura en ningún entorno |
| `20261003000000_add_debt_unknown_flags` (mía, de hoy) | Aditiva (`ADD COLUMN × 3 NOT NULL DEFAULT false`) | Sí |

**Solo una de las 8 es el problema real**: `20260930000000_drop_rejection_withdrawal_from_case`. La otra destructiva (`drop_formulario_definitivo_sin_ui`) es segura en un solo push porque el código que la acompaña **nunca** llegó a leer esas tablas en ningún commit de `main` ni de `dev` — no hay código viejo en riesgo, a diferencia de `rejection`/`withdrawal`, que **sí** se leían (vía `include`/whole-row) en el código que está en `main` ahora mismo.

### 3.2 Variables de entorno

Una sola variable nueva, y opcional: **`HEALTH_DETAILS_TOKEN`** (PR #109, "exponer el commit desplegado en `/api/health` detrás de un header"). Si no se define en Vercel, la funcionalidad simplemente no se activa — no rompe nada por omisión. No es bloqueante, pero si se quiere la funcionalidad en producción hay que cargarla a mano en Vercel → Settings → Environment Variables (Production) después del deploy; no la trae ninguna migración ni ningún paso automático.

`vercel.json` (el `buildCommand` que gatea la migración por `$VERCEL_ENV=production`) **no cambió** — la mitigación que ya existe sigue intacta.

### 3.3 Otros cambios no triviales

- **Borrado de los modelos `Creditor`/`Asset`/`LegalProcess` EN↔ES muertos** (2026-10-02, junto con `drop_formulario_definitivo_sin_ui`): ya cubierto en 3.1.
- **Renombre de plantilla** `rechazo-inasistencia` → `inasistencia-deudor` (parte de #40): cambia qué documento se genera para ese subtipo de fracaso, efecto en Drive (nombre de archivo), no en la base. Reversible con rollback de código.
- Nada más en el rango toca `prisma.config.ts`, workflows de deploy, ni secretos.

---

## 4. ¿Algo de lo mergeado hoy (5 PR críticos + 2 commits de rescate) necesita un paso manual?

**Nada propio de hoy agrega riesgo nuevo.** Desglose:

| PR / commit | Toca schema/migración | Paso manual |
| --- | --- | --- |
| #112 — fechas date-only | No | Ninguno |
| #113 — causas enum único | No (solo golden master) | Ninguno |
| #117 (ex-#114) — "Desconozco" + transacción | **Sí** — `add_debt_unknown_flags`, aditiva | Ninguno — corre sola en `prisma migrate deploy`, sin ventana de riesgo (código nuevo espera columnas nuevas, pero la migración corre *antes* de que el build nuevo sirva tráfico) |
| #118 (ex-#115) — Paquetes 2 y 3 | No | Ninguno |
| #116 — suite permanente (`tests/db/`) | No (no corre en producción, es solo test) | Ninguno |
| 2 commits de rescate (docs) | No | Ninguno — son 3 archivos `.md` sin UI de captura asociada, cero código |

La única migración que agregué hoy (`add_debt_unknown_flags`) es puramente aditiva y **no está en el mismo tipo de riesgo** que `rejection`/`withdrawal`: no hay código viejo en `main` que necesite esas 3 columnas nuevas para seguir funcionando (es al revés: código *nuevo* que las necesita, y para cuando ese código sirve tráfico la migración ya corrió). Es seguro promoverla junto con su código en un solo push.

**Lo que sí sigue pendiente, y no es de hoy:** la query de solo lectura que `DEPLOY_PR40.md` §3 (Despliegue 2, paso 1) pide correr contra Neon antes de promover la migración de `rejection`/`withdrawal`, para confirmar `0` y `0` antes de confiar en que la guarda no va a abortar el build:

```sql
SELECT count(*) FILTER (WHERE rejection)  AS rejection_true,
       count(*) FILTER (WHERE withdrawal) AS withdrawal_true
FROM "Case";
```

No hay registro en ningún documento de que esto se haya corrido todavía. No pasa nada si no se corre antes —la guarda de la migración hace exactamente esa misma comprobación y aborta sola, sin tocar nada, si da distinto de cero— pero correrla antes evita enterarse durante un build en vez de con tiempo.

---

## 5. Recomendación

**No promover en un solo push.** El bloqueante es uno solo, conocido, y con mitigación ya diseñada (aunque la rama que la implementaba quedó obsoleta). Priorizado por riesgo:

### Bloqueante (antes de cualquier promoción)

1. **Separar el push a `main` en dos, por la migración `20260930000000_drop_rejection_withdrawal_from_case`.** No alcanza con cortar el historial antes de `a0ac5d7` (ese commit padre todavía declara las columnas en `schema.prisma` — no mitiga nada, ver §1). Hace falta una rama derivada de `dev` sin esa única carpeta de migración:
   - Rama nueva desde `origin/dev` (`47a6c2e`), con `git rm -r src/prisma/migrations/20260930000000_drop_rejection_withdrawal_from_case/` en un commit aparte.
   - Primer push a `main`: esa rama. El código ya no lee `rejection`/`withdrawal`; la base todavía las tiene (nadie las borró) — conviven sin problema.
   - Confirmar el deploy sirviendo tráfico (health check + smoke test, §4 de `DEPLOY_PR40.md`).
   - Segundo push a `main`: `origin/dev` completo, con la carpeta de la migración restaurada. `prisma migrate deploy` la aplica recién en este momento, con el código que ya no la necesita sirviendo tráfico desde el paso anterior.
   - Es el mismo mecanismo de `deploy/pr40-paso1` (cherry-pick de código sin la migración), reconstruido sobre el `dev` de hoy en vez de reanimar la rama vieja.

2. **Correr la query de solo lectura de la sección 4 contra Neon producción**, antes del segundo push, para no depender de que la guarda aborte el build si algo salió mal.

### No bloqueante, pero hacerlo en la misma ventana

3. **Confirmar autoría del commit HEAD en cada uno de los dos pushes** por separado (`Insolventic <insolvenic@gmail.com>`, vía `--amend` puntual) — el plan Hobby de Vercel bloqueará cualquiera de los dos si no.
4. **Cargar `HEALTH_DETAILS_TOKEN` en Vercel** (Production) después del deploy, si se quiere esa funcionalidad activa — es opcional, no rompe nada si se omite.

### Fuera de alcance de este deploy (no bloquea, pero quedan abiertos)

5. Vincular la cuenta de Vercel de `MaxitoJM` al proyecto (issue #7) — elimina la necesidad del `--amend` puntual en cada push futuro, pero no es requisito para promover hoy.
6. Aislar Preview con su propio branch de Neon — decisión de negocio pendiente, no técnica; no afecta la seguridad de este despliegue puntual.
7. `AGENTS.md` sigue sin trackear en el árbol de trabajo (visto desde el inicio de la sesión anterior) — no es nada del deploy, es un archivo suelto de otra sesión.

### Lo que SÍ está listo

- Los 126 commits salvo la migración de `rejection`/`withdrawal` son seguros para un solo push (aditivos, o destructivos ya verificados contra producción con guarda).
- Los 5 PR de hoy no agregan ningún riesgo nuevo de los que describe `DEPLOY_PR40.md` — su única migración es aditiva.
- CI en verde en los últimos pushes a `dev`.
- `vercel.json` y el gate de `$VERCEL_ENV=production` siguen intactos.

**En una frase:** `dev` está lista en código y en tests; lo único que falta es ejecutar el deploy en dos tiempos que el propio proyecto ya diseñó para esto, porque esa parte del plan se saltó al mergear #40 a `dev` de corrido.
