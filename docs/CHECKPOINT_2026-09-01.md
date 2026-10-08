# Checkpoint de estado — INSOLVENTIC — 2026-09-01

> Diagnóstico de solo lectura. No se modificó ningún archivo del repositorio ni se hizo commit.
> Este documento es el único artefacto nuevo y queda **sin trackear** en `docs/`.
>
> **Actualizado 2026-10-08.** Este propio documento se commiteó el 2026-09-17 (`623f654`), junto con `scripts/verificar-deriva-esquema.sql`. El ítem 1 de §6 ("Recuperar los tres documentos... que faltan") quedó resuelto el 2026-10-08: `AUDITORIA_PREPRODUCCION_2026-08-25.md`, `IMPLEMENTACION_SEMANA_1.md` e `IMPLEMENTACION_SEMANA_2.md` se recuperaron del árbol local (habían vuelto a aparecer sin commitear) y se commitearon a `dev` (`5486fab`). El link de `RUNBOOK.md:323`, roto en el momento de este checkpoint, ya resuelve. La rama `fix/health-version-gated` —la otra mitad del mismo ítem— se había recuperado y mergeado antes, como PR #109.

---

## 1. Resumen de una línea

**En código estamos más cerca de lo que pensábamos; en producción estamos exactamente donde estábamos el 18 de agosto: los dos hallazgos críticos (C-1 gate de auth muerto, C-2 registro público abierto) siguen vivos en producción, y Sentry nunca se inicializa en ningún runtime, así que ninguna verificación de observabilidad hecha hasta hoy pudo haber sido real.**

---

## 2. Base de evidencia y límites de este checkpoint

Antes de la tabla, lo que pude y no pude verificar. Esto condiciona todo lo demás.

### 2.1 Los documentos de referencia NO existen en ningún lado accesible

| Documento pedido | `origin/dev` (f542f22) | Clon local `Documentos/GitHub/insolventic` | Disco completo (`C:\Users\user`) |
|---|---|---|---|
| `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md` | ❌ no existe | ❌ no existe | ❌ no existe |
| `docs/IMPLEMENTACION_SEMANA_1.md` | ❌ | ❌ | ❌ |
| `docs/IMPLEMENTACION_SEMANA_2.md` | ❌ | ❌ | ❌ |
| Rama `fix/health-version-gated` | ❌ (`git ls-remote`: solo `dev`, `main`, `vercel/react-server-components-cve-vu-8n1j1e`) | ❌ (ni en reflog) | — |
| `HEALTH_DETAILS_TOKEN` en código | ❌ cero referencias | ❌ | — |

`docs/RUNBOOK.md` línea 305 enlaza a la auditoría del 25/08 como si estuviera en el repo. No está.

**Consecuencia:** no pude leer el checklist original de 14 ❌ / 7 ✅. Reconstruí los hallazgos a partir de los IDs que sí aparecen en los mensajes de commit y en comentarios del código (C-1, C-2, A-1, A-2, A-3, A-4, A-5, A-7, M-8, M-9, M-10). Los IDs que no aparecen en ningún artefacto (A-6, M-1 a M-7, y los 7 ✅ originales) **no puedo evaluarlos** y así lo digo en la tabla. El trabajo de Semana 1 y 2 se hizo en una máquina o sesión que no es esta.

### 2.2 Estado real de git

| Qué | Valor |
|---|---|
| `origin/dev` | `f542f22` (2026-08-26) — 9 commits de Semana 1/2 sobre `c53fbc5` |
| `origin/main` | `70868c6` (2026-08-18) — **cero commits de Semana 1/2** |
| `origin/main..origin/dev` | 10 commits sin promover |
| Clon local `Documentos/GitHub/insolventic` | `dev` en `c53fbc5`, último fetch 18/08: **desactualizado 9 commits**, working tree limpio |
| Ramas locales sin mergear | ninguna |
| Sesión de Claude actual | abierta en el directorio de **LIFTRANK**, no de Insolventic |

Los 9 commits de Semana 1/2 se pushearon **directo a `dev` sin PR**. `pr.yml` solo dispara en `pull_request`, así que lint, `tsc`, jest y build **nunca corrieron en CI** para ese código. Los únicos runs de GitHub Actions posteriores al 13/08 son dos del workflow de smoke test.

Para compensar, cloné `origin/dev` en el scratchpad de la sesión (fuera de tus repos) y corrí la suite completa:

| Verificación local sobre `origin/dev` | Resultado |
|---|---|
| `npx jest --ci` | **31 suites / 504 tests verdes** |
| `npx tsc --noEmit` | ⟨ver §2.4⟩ |
| `npx eslint` | ⟨ver §2.4⟩ |
| `npm audit --audit-level=high` | ⟨ver §2.4⟩ |

### 2.3 Qué se desplegó realmente

Fuente: API de GitHub Deployments (lo que emite la integración nativa de Vercel) y logs de Actions.

| Fecha | Entorno | Commit | Resultado |
|---|---|---|---|
| 2026-08-18 22:09 | **Production** | `70868c6` | success — **es lo que sirve producción hoy** |
| 2026-08-26 15:37 | Preview | `f542f22` | success; smoke test con `startup_failure` (workflow recién creado en ese mismo commit) |
| 2026-08-27 17:01 | Preview (redeploy de `f542f22`) | `f542f22` | success; **smoke test OK**: `/api/health` 200 con BD ok, home 200, `/cases` → `/login`, `/register` → `/login` |

URL del preview verificado: `https://insolventic-rkfougz34-insolventics-projects.vercel.app`.

### 2.4 Resultados de type-check, lint y audit

| Comando (sobre `origin/dev`, clon aislado, hoy) | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 errores** |
| `npx eslint` | **0 errores, 23 warnings** (todos en `tests/`: unused-vars, un `import/no-anonymous-default-export` en `k6.config.js`, un `jsx-a11y` en `document-generation.test.tsx`) |
| `npm audit --audit-level=high` | **exit 1: 10 high, 3 moderate, 0 critical** (13 total). 9 de las high solo cierran con upgrade breaking (`prisma`, `puppeteer-core`, `html-to-docx`, `next`); **1 (`browserslist`) tiene fix no-breaking disponible**. El commit de A-1 decía "quedan 12 con `--force`": hoy son 13, o apareció un advisory nuevo o `browserslist` quedó fuera del `npm audit fix` original. |

Los cuatro comandos son los mismos que corre `pr.yml`; en CI nunca se ejecutaron para estos commits.

### 2.5 Accesos que NO tengo (y que tampoco tenés vos desde tu cuenta)

- **Vercel:** el proyecto real vive en el team `insolventics-projects`. Tu cuenta de Vercel (`maximilianojaramillomalavera-3265`) **no es miembro** de ese team: solo ves tu scope personal. Por lo tanto no puedo (ni podés, con esa cuenta) leer las env vars ni los logs de runtime del proyecto real. Esto ya estaba anotado como pendiente en `CLAUDE.md` Session 3.
- **GitHub:** el repo es privado, el owner es la **cuenta de usuario** `insolventic` (no una organización), y tu usuario `MaxitoJM` tiene `push` pero **no `admin`**. Detalle en M-8.
- **Sentry / Upstash:** no hay credenciales en esta máquina (el `.env` del clon local no tiene ninguna de las variables `UPSTASH_*` ni `*SENTRY_DSN`; verifiqué solo presencia de nombres, no valores).

> **Incidente de esta sesión, ya revertido:** al intentar leer las env vars con `vercel link --yes --project insolventic` desde el clon del scratchpad, el CLI **creó un proyecto vacío `insolventic` en tu scope personal** de Vercel (sin deployments, sin repo enlazado). Lo verifiqué por API (`latestDeployments: 0`, `link: null`) y lo borré por ID (`prj_UKL9FPDBbKfx591WiF1lz6XxvqHT`, HTTP 204). Tu scope personal quedó como estaba. Lo dejo escrito porque el mandato era "cero efectos secundarios" y este lo hubo, aunque esté deshecho.

---

## 3. Checklist go-live actualizado

Leyenda: ✅ código + test + confirmado en preview · 🟡 en código pero no verificado en preview/prod · ⬜ no resuelto.
**Ningún ítem está en producción.** Los ✅ lo son respecto del preview `f542f22`.

### 3.1 Hallazgos identificables por ID

| ID | Hallazgo | Estado | Justificación (verificada en código) |
|---|---|---|---|
| **C-1** | Middleware trataba toda ruta como pública (`startsWith('/')`) | ✅ | `src/middleware.ts:33-37` matching exacto o sub-path; 12 tests en `tests/security/middleware-auth-gate.test.ts`; smoke del 27/08 confirma `/cases` → `/login` en preview. **Sigue abierto en producción.** |
| **C-2** | Registro público autoservicio abierto | ✅ | `registerUser` exige `P.CREAR_USUARIOS` (`src/features/auth/actions.ts:631-643`); `/register` fuera de `PUBLIC_ROUTES` y la página redirige a `/login`; smoke del 27/08 lo confirma en preview. **Sigue abierto en producción.** |
| **A-1** | CVEs high en Next y deps | 🟡 | Lockfile en Next 15.5.24 y build de preview verde: los advisories de Next que motivaron el hallazgo están cerrados. Pero `npm audit` hoy sigue en **exit 1 con 10 high** (§2.4): 9 requieren upgrade breaking (decisión tuya: aceptar el riesgo por escrito o planificar los upgrades) y 1 (`browserslist`) tiene fix no-breaking pendiente. No se puede llamar "resuelto" un ítem cuyo criterio de aceptación era `npm audit` limpio en high. |
| **A-2** | Rate limiting in-memory inútil en serverless | 🟡 | `src/lib/rate-limit.ts` implementa Upstash con fallback in-memory y flag `degraded`; 18 tests. **No puedo saber si el preview/prod usan Redis o el fallback**: depende de `UPSTASH_REDIS_REST_URL/TOKEN` en Vercel (sin acceso al team) y el resultado no se expone hacia afuera. Ver §5 cómo verificarlo. |
| **A-3** | JWT devueltos en el body de login/refresh | 🟡 | `authResultSchema` ya no tiene `accessToken`/`refreshToken` (`src/features/auth/schemas.ts:47-51`); 27 tests en `auth-actions.test.ts`. Nada automatizado lo verifica en preview. Ver §5. |
| **A-4** | Backup y restauración de BD sin verificar | ⬜ | `RUNBOOK.md` §3.1 lo declara "teórico" hasta que se ejecute una restauración de prueba. Depende del proveedor de Postgres (configuración externa, tu acción). |
| **A-5** | Sin health check ni verificación post-deploy | ✅ | `src/app/api/health/route.ts` (GET/HEAD, `SELECT 1` con timeout 5 s, 200/503, sin filtrar detalles); `scripts/smoke-test.sh`; `.github/workflows/smoke.yml` sobre `deployment_status`; 7 tests; run verde del 27/08 en preview. Nota: `/api/health` expone `environment` pero no versión; la variante "version gated" (`HEALTH_DETAILS_TOKEN`) no existe en el remoto. |
| **A-6** | (ID no referenciado en ningún commit ni archivo) | ❓ | No evaluable sin la auditoría original. |
| **A-7** | CSP bloqueaba el ingest de Sentry | ⬜ | La CSP sí incluye el origen del DSN (`src/lib/csp.ts`, 10 tests). **Pero es irrelevante hoy: `Sentry.init()` no se ejecuta en ningún runtime** (hallazgo nuevo N-1, §4). El objetivo real del hallazgo, "que los errores lleguen al dashboard", no está resuelto. |
| **M-8** | Sin branch protection en `main` | ⬜ | `GET /repos/insolventic/insolventic/branches/main/protection` → 404 (sin protección). `GET .../rulesets` → 403 "Upgrade to GitHub Pro or make this repository public". **Repo privado bajo cuenta de usuario en plan Free: branch protection no está disponible.** Además tu usuario no es admin. Depende de una decisión tuya (plan o proceso), ver §5. |
| **M-9** | 6 páginas sin guard server-side | 🟡 | `requirePageAuth()` en `src/lib/auth.ts:136-152`, aplicado a `/audit-log`, `/calendar`, `/documents`, `/notifications`, `/profile`, `/reports` (verificado por grep); 3 tests. El smoke solo prueba `/cases` y desde afuera el middleware (C-1) tapa el guard: no es verificable en preview sin bypass. Ver §5 para el chequeo mínimo. |
| **M-10** | Sin runbook operativo | 🟡 | `docs/RUNBOOK.md` existe (307 líneas) pero tiene 5 campos `⟨COMPLETAR⟩` (responsable, contactos de ambos centros, proveedor de Postgres, URL de Sentry), enlaza a un documento inexistente, y sus pasos de triage dependen de un Sentry que no reporta (N-1). |
| **M-1 … M-7** | (IDs no referenciados) | ❓ | No evaluables sin la auditoría original. |
| **7 ✅ originales** | (no identificables) | ❓ | Idem. |

### 3.2 Pendientes de decisión tuya, fuera de la numeración

| Ítem | Estado | Detalle |
|---|---|---|
| `fix/health-version-gated` | ⬜ **pendiente de vos** | No existe en `origin` ni en el clon local. Si existe en otra máquina, hay que pushearla; si no, la decisión (exponer versión en `/api/health` detrás de `HEALTH_DETAILS_TOKEN`) está sin implementar. Hoy `/api/health` devuelve `status`, `environment`, `timestamp`, `checks.database`. |
| Promover `dev` → `main` | ⬜ **pendiente de vos** | Producción sirve `70868c6` del 18/08. Los 9 commits de Semana 1/2 no están en producción. |

---

## 4. Hallazgos nuevos de este checkpoint

Cosas que no estaban (o no podían estar) en la auditoría del 25/08 y cambian la lectura del checklist.

### N-1 — Sentry nunca se inicializa (afecta A-7, M-10 y toda la observabilidad)

Evidencia en `origin/dev`:

- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` existen y llaman `Sentry.init()` **pero nadie los importa**: grep en todo el repo no encuentra referencias salvo un comentario en `observability.ts`.
- No existe `src/instrumentation.ts` ni `instrumentation.ts` ni `instrumentation-client.ts` (tampoco existieron nunca: `git log --all` vacío para esas rutas).
- `next.config.ts` no usa `withSentryConfig()`; nunca lo usó (`git log -S withSentryConfig` solo trae commits que lo mencionan en comentarios).
- El SDK instalado (`@sentry/nextjs` 10.65.0) confirma el mecanismo: `sentry.client.config.ts` se inyecta únicamente por el loader de webpack de `withSentryConfig` (regex `sentry\.client\.config\.(jsx?|tsx?)|instrumentation-client`), y los configs server/edge deben importarse desde `instrumentation.ts`.
- `logger.error/warn` y `generation-job.ts` llaman `captureException`/`captureMessage` sobre un SDK sin `init()`: no hay cliente enlazado, no se envía nada.

Conclusión: **ningún error de cliente ni de servidor pudo haber llegado al dashboard desde este código**, con o sin DSN, con o sin CSP. Si viste eventos en Sentry, vinieron de otro código o de otro proyecto. La confirmación end-to-end la tenés que hacer vos en la consola de Sentry, pero por código el resultado esperado es "cero eventos".

La corrección (no la hice, no es alcance de este checkpoint) es crear `src/instrumentation.ts` con `register()` que importe el config server o edge según `NEXT_RUNTIME`, y `src/instrumentation-client.ts` con el contenido del config de cliente. Eso **no** requiere `withSentryConfig()`, así que no reabre el problema de `@opentelemetry/api` que rompió los deploys de agosto.

### N-2 — CI no corre en pushes directos a `dev`

`pr.yml` y `e2e.yml` solo disparan en `pull_request`. Semana 1 y 2 entraron por push directo. Sin branch protection (M-8) nada obliga a pasar por PR. Hoy la única red de seguridad automática post-push es el smoke test, que corre **después** del deploy.

### N-3 — Tu cuenta de Vercel no está en el team del proyecto

Ya documentado como pendiente en `CLAUDE.md`; lo repito porque bloquea directamente A-2 (verificar Upstash), A-7/N-1 (verificar DSN) y cualquier lectura de logs de runtime. Y explica el incidente del proyecto espurio (§2.5).

### N-4 — `JWT_REFRESH_SECRET` está documentado pero no se usa

`src/lib/auth.ts` firma access y refresh tokens con el mismo `JWT_SECRET` (`getJwtSecret()` en ambas funciones). `JWT_REFRESH_SECRET` aparece en `.env.example:33`, `README.md:236` y `e2e.yml:48`, con cero referencias en `src/`. El comentario del `.env.example` ("NO reusar entre access y refresh") describe una garantía que el código no da. Menor en severidad, pero es una promesa falsa en la documentación de seguridad.

### N-5 — Cifras de tests divergentes en cuatro lugares

| Fuente | Dice |
|---|---|
| `README.md:186` | 20 suites / 405 tests |
| `CLAUDE.md:18` | 445 tests |
| `docs/TESTS.md:3` | 27 suites / 447 tests |
| commit `c507501` (A-1) | 477 tests |
| **Real (`origin/dev`, jest local)** | **31 suites / 504 tests** |

---

## 5. Qué falta verificar en cada 🟡 y cómo

| Ítem | Qué verificar | Cómo |
|---|---|---|
| **A-2 Upstash** | ¿Redis o fallback in-memory en preview y prod? | 1) Vercel → team `insolventics-projects` → proyecto → Settings → Environment Variables: deben existir `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en **Production y Preview** (hoy no puedo verlo). 2) Vercel → Logs (Runtime) del deploy: buscar `"rate limiting degradado"`; si aparece `reason: "missing-env"`, está en fallback. 3) Prueba positiva: hacer 2 intentos de login fallidos en preview y mirar en Upstash Console → base → Data Browser: deben aparecer claves con prefijo `insolventic:rl`. Si no aparecen, está en fallback. |
| **A-3 JWT en body** | Que la respuesta de login no traiga tokens | En preview, DevTools → Network → login → request de la server action (POST con header `Next-Action`) → Response: no debe contener `accessToken` ni `refreshToken`; en Application → Cookies deben estar `access-token` y `refresh-token` como HttpOnly. |
| **M-9 guards de página** | Que las 6 páginas redirijan sin sesión | `for p in documents reports audit-log calendar notifications profile; do curl -s -o /dev/null -w "$p %{http_code} %{redirect_url}\n" https://⟨preview⟩/$p; done` → todas 307 a `/login?redirect=/…`. Esto prueba el middleware, no el guard; el guard solo lo cubren los 3 unit tests. Es defensa en profundidad: aceptable. |
| **M-10 runbook** | Completar los `⟨COMPLETAR⟩` y arreglar el enlace roto | Editar `docs/RUNBOOK.md` líneas 16-21 y 305. No hay nada que "verificar" en preview. |
| **M-8** | Ver §6, punto 4. | — |
| **A-7 / N-1 Sentry** | Después de implementar `instrumentation.ts`: que un error de prueba llegue | Server: `curl https://⟨preview⟩/api/health` con `DATABASE_URL` roto no es opción; alternativa: forzar un `logger.error` de prueba o un `throw` en una server action temporal. Client: `throw new Error('sentry-test')` desde la consola del navegador en una página de la app. Mirar Sentry → Issues filtrando por `environment` = valor de `NEXT_PUBLIC_APP_ENV` del deploy. Hoy, sin N-1 resuelto, esta prueba va a dar cero eventos. |

---

## 6. Esto depende de vos, Maxi

En orden de bloqueo.

1. ~~**Recuperar los tres documentos y la rama que faltan.**~~ → 🟢 **Resuelto.** `fix/health-version-gated` se recuperó y mergeó como PR #109. Los tres documentos (`AUDITORIA_PREPRODUCCION_2026-08-25.md`, `IMPLEMENTACION_SEMANA_1.md`, `IMPLEMENTACION_SEMANA_2.md`) se commitearon a `dev` el 2026-10-08 (`5486fab`) — ver la nota al inicio de este documento.
2. **Decidir cómo inicializar Sentry (N-1).** Recomendación: `src/instrumentation.ts` + `src/instrumentation-client.ts`, sin `withSentryConfig`. Después, vos mirás la consola de Sentry para confirmar el evento de prueba. Hasta entonces, A-7 y el runbook son teóricos.
3. **Acceso a Vercel.** Pedir que `insolvenic@gmail.com` invite a tu cuenta al team `insolventics-projects`, o loguear el CLI con esa cuenta. Sin esto no se puede confirmar Upstash (A-2), DSN (A-7), `NEXT_PUBLIC_APP_ENV`, `CRON_SECRET`, ni leer logs.
4. **M-8, branch protection: qué mirar exactamente en GitHub.** Con la cuenta owner `insolventic` (la tuya no es admin): `github.com/insolventic/insolventic` → **Settings** → **Branches** (menú izquierdo, sección "Code and automation"). Vas a ver una de dos cosas:
   - Un banner tipo *"Upgrade to GitHub Pro or make this repository public to enable this feature"*. Eso confirma lo que vi por API: **no se puede configurar** en plan Free con repo privado. Decisión: (a) GitHub Pro en la cuenta `insolventic`, o (b) aceptar que la protección sea de proceso (PR obligatorio por convención) hasta que haya plan.
   - Si el plan lo permite: **Add branch ruleset** (o *Add classic branch protection rule*) → Target: `main` → tildar **Require a pull request before merging** (≥1 approval), **Require status checks to pass** seleccionando `quality-checks` (de `pr.yml`) y `playwright` (de `e2e.yml`), **Require branches to be up to date before merging**, **Block force pushes**, **Restrict deletions**, y en rulesets **Bypass list: vacío** (o en reglas clásicas, *Include administrators*). Repetir para `dev` con al menos "Require a pull request".
5. **Promover `dev` → `main`.** Producción tiene C-1 y C-2 abiertos desde siempre. Antes: resolver N-1 (o aceptar deploy sin Sentry), confirmar env vars de Production (Upstash, `CRON_SECRET`), y recordar la regla del autor del commit HEAD (`Insolventic <insolvenic@gmail.com>`) para que Vercel no bloquee el deploy.
6. **A-4 backups.** Confirmar en el panel del proveedor de Postgres que hay backups/PITR y ejecutar una restauración de prueba a una instancia nueva. Anotar el resultado en el runbook §3.1.
7. **Completar `RUNBOOK.md`** (contactos, proveedor, URL de Sentry) y corregir el enlace de la línea 305.
8. **CI en pushes a `dev` (N-2).** Decidir: agregar `push: branches: [dev]` a `pr.yml`, o exigir PR por convención hasta tener M-8.
9. **A-1, las 10 high que quedan.** Decidir por escrito: aceptar el riesgo de las 9 que requieren upgrade breaking (`prisma`, `puppeteer-core`, `html-to-docx`, `next`) con fecha de revisión, o planificar los upgrades. La de `browserslist` se cierra con un `npm audit fix` normal.
10. **Higiene de entorno de trabajo.** `git pull` en `Documentos/GitHub/insolventic` (está 9 commits atrás) y abrir las sesiones de Claude en ese directorio, no en LIFTRANK. Esta sesión arrancó en el repo equivocado y tuve que clonar el remoto aparte.

---

## 7. Auditoría de documentación: inconsistencias encontradas

> **Estado: NINGUNA aplicada. Pendiente de revisión de Maxi.** Son 57 entradas en 9 archivos (§7.1 a §7.9) más 7 contradicciones cruzadas (§7.10); el "~40" que dije en el chat se quedó corto. Cuando las apruebes, se aplican en un PR aparte del de código.
>
> Nota posterior al fix de Sentry (`fix/sentry-init`, ver §9): las filas que hablan de "el SDK no se inicializa" (README, CLAUDE.md 45/49, ARQUITECTURA 331, RUNBOOK, DIAGRAMA_COMPONENTES, `.env.example` 90-95, `next.config.ts`) pasan a decir lo contrario una vez mergeada esa rama: la referencia correcta es `src/instrumentation.ts` + `src/instrumentation-client.ts`, y `sentry.client.config.ts` ya no existe.

Formato: archivo, línea aproximada, qué dice hoy, qué debería decir.

### 7.1 `README.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 92 | "Node.js 20.x o superior" | Node 24 (los tres workflows y Vercel usan 24.x) |
| 100 | `git clone https://github.com/Nick220505/insolventic.git` | `https://github.com/insolventic/insolventic.git` |
| 140 | workflows: "pr.yml, deploy.yml, release.yml" | `pr.yml`, `e2e.yml`, `release.yml`, `smoke.yml` (`deploy.yml` se eliminó el 18/08) |
| 152 | `api/` → "download, webhooks" | `api/cron/alerts` y `api/health` (no hay download ni webhooks) |
| 186 | "20 suites / 405 tests" | 31 suites / 504 tests |
| 203-209 | Pasos de `pr.yml`: sin type-check ni audit | Agregar `npx tsc --noEmit` y `npm audit` (informativo); aclarar que solo corre en PR |
| 211-217 | Sección "Deploy (`deploy.yml`)" completa, "baseline automático de `20260205212559_init`" | Deploy por integración nativa Vercel↔GitHub; migraciones en `buildCommand` gateadas por `VERCEL_ENV=production`; smoke test post-deploy vía `smoke.yml` |
| 226-241 | Tabla de env vars: incluye `JWT_REFRESH_SECRET`; faltan las nuevas | Quitar o implementar `JWT_REFRESH_SECRET` (N-4); agregar `UPSTASH_REDIS_REST_URL/TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`, `NEXT_PUBLIC_APP_ENV`, `CRON_SECRET`, `LOG_LEVEL` |
| 245-263 | Índice de docs sin `RUNBOOK.md` | Agregar `docs/RUNBOOK.md` |
| 60-68 | Sección Seguridad no menciona registro cerrado, rate limiting distribuido ni CSP | Agregar: registro solo por admin (C-2), rate limiting Upstash con fallback (A-2), health check público (A-5) |
| 175-183 | Comandos de test sin `test:smoke` | Agregar `npm run test:smoke -- <url>` |
| 278 | "sufijo `-dev` según `NODE_ENV`" | según `NEXT_PUBLIC_APP_ENV` (ver `src/config/version.ts:26-39`) |

### 7.2 `CLAUDE.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 7 | "solo existe una route handler (`/api/cron/alerts`)" | dos: `/api/cron/alerts` y `/api/health` |
| 18 | "suite completa (445 tests)" | 504 tests / 31 suites |
| 81 | "no hay Redis/BullMQ en producción" | Hay Upstash Redis solo para rate limiting (A-2); sigue sin haber cola de jobs |
| 51-98 | Architecture Decisions termina en Session 3 (18/08) | Falta la sesión de Semana 1/2 (26/08): C-1, C-2, A-1, A-2, A-3, A-5, A-7, M-9, M-10, y sus decisiones (degradación de rate limit, health público sin detalles, CSP derivada del DSN, no usar `withSentryConfig`) |
| 25-30 | Convenciones sin `requirePageAuth` ni `checkRateLimit` async | Agregar: páginas server → `requirePageAuth(path)`; `checkRateLimit` es async y devuelve `degraded` |
| 122-126 | Referencias sin runbook ni auditoría de preproducción | Agregar `docs/RUNBOOK.md` y `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md` (cuando exista en el repo) |
| 45, 49 | Describe Sentry como operativo (ERROR/WARN → Sentry) | Aclarar que el SDK no está inicializado hasta resolver N-1 |

### 7.3 `docs/ARQUITECTURA.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 3 | "Última actualización: julio 2026" | Agosto 2026 (Semana 1/2) |
| 15-20 | Diagrama §1: `API["API Routes (download, auth callback)"]`; sin Upstash ni Sentry en externos | `API["/api/cron/alerts, /api/health"]`; agregar `Upstash Redis (rate limiting)` y `Sentry` en "Servicios externos" |
| 133-138 | "Hardening aplicado" solo lista lo de abril | Agregar: matching exacto de rutas públicas (C-1), registro cerrado (C-2), tokens solo en cookies (A-3), `requirePageAuth` (M-9) |
| 271-283 | Diagrama §8 con `deploy.yml` (preview y `vercel --prod`) | Integración nativa Vercel; `smoke.yml` post-deploy; `pr.yml` con lint + tsc + jest + build |
| 289-294 | Tabla "Workflows activos" incluye `deploy.yml` | Reemplazar por `smoke.yml` (`deployment_status` + manual) |
| 331 | "`sentry.*.config.ts` inicializan Sentry por runtime" | Falso hoy: no se cargan (N-1). Debe describir `instrumentation.ts` cuando se implemente |
| 298-361 | §9 sin rate limiting ni health check | Agregar: rate limiting distribuido (Upstash, sliding window, fallback y flag `degraded`) y `/api/health` (contrato 200/503) |
| 374 | Decisión "docxtemplater + pdf-lib" | Contradice §6 líneas 210-215 (`pdf-lib` nunca existió, `docxtemplater` es dependencia muerta): debería decir "HTML + Puppeteer/Chromium (PDF) + html-to-docx (DOCX)" |
| 404 | "Colocar `.docx` en `src/features/document/templates/`" | Contradice §6 línea 209: plantillas HTML en `templates/{insolvency,conciliation,support-agreements}/` |
| 387 | "Drift entre schema e init migration — `prisma db push` en dev, baseline en deploy" | `prisma migrate deploy` en `buildCommand` (solo prod); existe `npm run check:schema-drift` |

### 7.4 `docs/TESTS.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 3 | "27 suites / 447 tests" | 31 suites / 504 tests |
| 28 | "`npx jest --ci` se ejecuta en `pr.yml` en cada pull request" | Cierto, pero aclarar que un push directo a `dev` no dispara CI (N-2) |
| 33-64 | Inventario sin `tests/security/csp.test.ts` (10), `middleware-auth-gate.test.ts` (12), `page-auth-guard.test.ts` (3), `tests/unit/health/health-route.test.ts` (7) | Agregar las 4 suites; `rate-limit.test.ts` ~11 → 18; `auth-actions.test.ts` ~23 → 27 |
| 83 | "Register con hash bcrypt + rol por defecto" | "Register exige permiso `Crear usuarios`; sin sesión o sin permiso se rechaza" |
| 170 | "Snapshot de schema vs migration: No existe" | Existe: `tests/schema/check-schema-drift.ts` y script `check:schema-drift` |
| 20-26 | Comandos sin smoke test | Agregar `npm run test:smoke -- <url>` y describir `scripts/smoke-test.sh` |

### 7.5 `docs/RUNBOOK.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 305 | Enlace a `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md` | El archivo no está en el repo: agregarlo o quitar el enlace |
| 16-21 | 5 campos `⟨COMPLETAR⟩` | Completar (acción tuya) |
| 41-42, 167, 187, 212, 292 | Pasos que asumen que Sentry recibe eventos | Hasta resolver N-1, Sentry está vacío por construcción: el triage debe apoyarse solo en `/api/health` y Vercel Logs |
| 227 | "`vercel login` cuenta insolvenic@gmail.com" | Correcto; agregar advertencia: con otra cuenta, `vercel link` puede crear un proyecto nuevo en el scope equivocado (pasó en esta sesión) |

### 7.6 `docs/DIAGRAMA_COMPONENTES.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 5 | "ARQUITECTURA.md §1 … se deja tal cual" | Hereda la desactualización de §1 (sin health, sin Upstash) |
| 38 | `InfraAuth: auth.ts + permissions.ts + rate-limit.ts` | Agregar `csp.ts` a infraestructura |
| 47-52 | Externos: PostgreSQL, Drive, SMTP, Sentry | Agregar `Upstash Redis` con edge desde `rate-limit.ts` |

### 7.7 `CHANGELOG.md`

| Línea | Dice hoy | Debería decir |
|---|---|---|
| 8-15 | `[Unreleased]` solo tiene logger y P3/P4 | Faltan las 9 entradas de Semana 1/2 (Security: C-1, C-2, A-3, M-9; Added: `/api/health`, smoke test, `smoke.yml`, runbook, `csp.ts`; Changed: rate limiting Upstash, CSP; Dependencies: Next 15.5.24) |

### 7.8 `.env.example` (cruce contra `process.env.*` en código)

| Línea | Variable | Situación | Debería |
|---|---|---|---|
| 33 | `JWT_REFRESH_SECRET` | **Documentada, no usada** (N-4) | Implementar en `createRefreshToken`/`verifyRefreshToken` o eliminar y corregir el comentario de la línea 30 |
| 50 | `NEXTAUTH_SECRET` | Documentada, no usada | Eliminar (no hay NextAuth) |
| 49 | `NEXTAUTH_URL` | 1 uso en código | Verificar si ese uso es vivo; si no, eliminar |
| 84 | `VERCEL_OIDC_TOKEN` | Documentada, no usada | Eliminar |
| 97-99 | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Documentadas, no usadas (sin `withSentryConfig` no hay upload de source maps) | Eliminar o marcar "reservadas para cuando se active el upload de source maps" |
| — | `LOG_LEVEL` | **Usada** (`logger.ts:69`), no documentada | Agregar sección Observabilidad: `LOG_LEVEL=error|warn|info|debug` |
| — | `HEALTH_DETAILS_TOKEN` | No existe en código de `origin/dev` | Nada que documentar hasta que se pushee la rama |
| 56-58 | `NEXT_PUBLIC_APP_ENV` "para badge de versión" | También alimenta `environment` de Sentry y de `/api/health` | Ampliar el comentario |
| 90-95 | `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Documentadas y usadas, pero el SDK no se inicializa | Nota hasta resolver N-1 |
| 126-135 | `UPSTASH_*` | ✅ correctas y consistentes con el código | — |
| 105-122 | `CRON_SECRET`, `ALERTS_*` | ✅ correctas | — |

### 7.9 `next.config.ts` y `package.json`

- `next.config.ts:6-11`: el comentario sobre `@opentelemetry/api` y `withSentryConfig` es exacto. Falta una nota de que, sin `withSentryConfig`, los `sentry.*.config.ts` no se cargan (N-1).
- `package.json:25` `test:smoke` existe pero no está documentado en README ni TESTS.md.
- `package.json:73` `next: ^15.5.12` con lockfile en 15.5.24: consistente (rango), pero conviene subir el mínimo para que un `npm install` limpio no pueda resolver una versión vulnerable.

### 7.10 Inconsistencias entre documentos sobre el mismo tema

| Tema | Doc A | Doc B |
|---|---|---|
| Cantidad de tests | README 405 · CLAUDE 445 · TESTS 447 | Real 504 |
| Deploy | README y ARQUITECTURA §8: `deploy.yml` | CLAUDE.md y RUNBOOK: integración nativa, `deploy.yml` eliminado |
| Pipeline de documentos | ARQUITECTURA §10 "docxtemplater + pdf-lib", §12 ".docx en templates/" | ARQUITECTURA §6, README, CLAUDE.md: HTML + Puppeteer + html-to-docx |
| Refresh token | README/.env.example: secreto propio `JWT_REFRESH_SECRET` | Código: mismo `JWT_SECRET` |
| Sentry | ARQUITECTURA §9, CLAUDE.md, DIAGRAMA_COMPONENTES: operativo | Código: `init()` nunca ejecutado |
| Route handlers | CLAUDE.md: uno | Código: dos |
| Auditoría de preproducción | RUNBOOK la enlaza | No existe en el repo |

---

## 8. Recomendación sobre la Semana 3

No conozco el plan original de la Semana 3 (está en los documentos que faltan), así que la recomendación es sobre prioridades, no sobre ítems concretos.

**No seguir con la Semana 3 tal como esté planeada hasta cerrar tres cosas que cambian el tablero:**

1. **N-1 (Sentry no inicializado).** Es un bug que invalida A-7 y vuelve teórico el runbook. Son dos archivos (`instrumentation.ts`, `instrumentation-client.ts`) más una prueba end-to-end que hacés vos en el dashboard. Debería ser lo primero de la semana.
2. **Promover a producción.** Semana 1 y 2 arreglaron dos críticos que **siguen abiertos en producción** desde hace dos semanas. Todo lo que se agregue a `dev` sin promover no reduce el riesgo real. Precondiciones: N-1 resuelto o aceptado, env vars de Production confirmadas (Upstash, `CRON_SECRET`, DSN), y la regla del autor del commit HEAD.
3. **Acceso a Vercel y decisión sobre M-8.** Sin acceso al team no se puede cerrar A-2 ni verificar nada de runtime. M-8 pasó de "configurar una opción" a "decisión de plan de GitHub": no es trabajo de código.

**Lo que sí cambió de prioridad respecto del plan original, según lo que vi:**

- **M-8** baja de "hacer" a "decidir": no se puede hacer en el plan actual.
- **A-7** vuelve a abrirse bajo otro nombre (N-1); el fix de CSP queda como prerequisito ya cumplido.
- **N-2 (CI en pushes a `dev`)** sube: es la única forma de que el próximo lote de commits no repita "verificado solo localmente".
- **Sincronización de documentación** (§7): son ~40 correcciones puntuales, la mayoría de 1 línea, y cuatro afirmaciones que hoy son falsas en temas de seguridad (registro, refresh secret, Sentry, deploy). Conviene hacerlas en el mismo PR que N-1 para que la documentación deje de describir un sistema que no existe.
- **`fix/health-version-gated`** queda en espera hasta que aparezca la rama; no vale la pena reimplementarla a ciegas.

En una frase: la Semana 3 debería ser "hacer real en producción lo que ya está en código", no agregar más código a `dev`.

---

## 9. Fix aplicado: inicialización de Sentry (`fix/sentry-init`)

Resumen sin commitear del trabajo hecho el 2026-09-01 después del checkpoint, a pedido de Maxi (prioridad sobre Semana 3).

### 9.1 Qué se hizo

| Ítem | Detalle |
|---|---|
| Rama | `fix/sentry-init`, creada desde `dev` local ya sincronizado con `origin/dev` (`f542f22`) |
| Commits | `1f06b33` — `fix(observability): inicializar Sentry via instrumentation.ts (N-1, reabre A-7)`; `416475c` — `chore(observability): endpoint TEMPORAL /api/sentry-test-temporal`. **Ambos pusheados a `origin/fix/sentry-init`** (rama nueva, push normal, autorizado por Maxi el 2026-09-01). |
| ⚠️ Endpoint TEMPORAL | `src/app/api/sentry-test-temporal/route.ts` + `tests/unit/observability/sentry-test-route.test.ts`. **Eliminar antes de promover a producción.** Responde 404 si `VERCEL_ENV=production`; exige `Authorization: Bearer <CRON_SECRET>`. Modo por defecto: `logger.error` → 200; `?mode=throw`: excepción → `onRequestError` → 500. Suite con el endpoint: 33 suites / 520 tests. |
| Nuevo `src/instrumentation.ts` | `register()` importa `sentry.server.config.ts` o `sentry.edge.config.ts` según `NEXT_RUNTIME`; exporta `onRequestError = Sentry.captureRequestError` (errores de Server Components, Route Handlers y Server Actions) |
| Nuevo `src/instrumentation-client.ts` | Misma configuración que tenía `sentry.client.config.ts` (`sendDefaultPii: false`, `beforeSend` con `scrubSentryEvent`, `tracesSampleRate` 0.1 solo en prod) + `onRouterTransitionStart` |
| Eliminado `sentry.client.config.ts` | Nunca se cargaba; dejarlo invitaría a un doble `init()` si algún día se agrega `withSentryConfig` |
| `src/lib/observability.ts` | Solo el comentario que apuntaba al archivo eliminado |
| Sin `withSentryConfig()` | Decisión mantenida: `serverExternalPackages: ['@opentelemetry/api']` sigue cubriendo el problema de tracing de agosto |
| Tests | `tests/unit/observability/instrumentation.test.ts`, 11 casos: init una vez por runtime con el DSN correcto, fallback a `NEXT_PUBLIC_SENTRY_DSN` en servidor, no-op sin DSN, runtime desconocido no carga nada, el navegador ignora `SENTRY_DSN`, `beforeSend` redacta cookies/`authorization`/`token=` en la URL, y los dos exports de Next |

### 9.2 Verificación local (todo verde)

| Comando | Resultado |
|---|---|
| `npx jest --ci` | 32 suites / 515 tests (antes 31 / 504) |
| `npx tsc --noEmit` | 0 errores |
| `npx eslint` (archivos tocados) | 0 errores |
| `npx next build` | exit 0; emite `.next/server/instrumentation.js` (antes no existía) y el init entra en `main-app-*.js` |
| Hook `pre-commit` (husky → lint-staged) | corrió: eslint --fix + prettier sobre los 4 archivos |

### 9.2b Preview desplegado (2026-09-02 00:55 UTC)

| Qué | Valor |
|---|---|
| Deploys de `1f06b33` y `416475c` | **Bloqueados por Vercel** ("Deployment was blocked", autor `MaxitoJM`, plan Hobby) |
| Commit `5593aa7` | vacío, autor `Insolventic <insolvenic@gmail.com>`, push normal autorizado por Maxi (opción A, sin amend ni force) |
| Preview | `https://insolventic-60f9vda8c-insolventics-projects.vercel.app` |
| Smoke test post-deploy | run 33577304935: **OK** (health, home, gate de auth, registro cerrado) |
| `/api/health` | 200, `environment: "preview"`, BD ok |
| CSP `connect-src` en el preview | incluye `https://o4511983700934656.ingest.us.sentry.io` → **`NEXT_PUBLIC_SENTRY_DSN` sí está configurado en Preview** (deducido del header, no del dashboard) |
| `/api/sentry-test-temporal` sin token | **503 "CRON_SECRET no configurado"** → falta `CRON_SECRET` en el entorno Preview; hasta que exista, el endpoint no dispara nada |

### 9.3 Lo que falta y es tuyo, Maxi

1. **Push de la rama** (no lo hice; git remoto es acción tuya según lo acordado):
   ```bash
   git push -u origin fix/sentry-init
   ```
   Eso dispara un preview de Vercel para la rama. Recordá que el commit HEAD tiene autor `MaxitoJM`: si el plan Hobby lo bloquea ("Blocked"), aplica el remedio de `RUNBOOK.md` §4.1.
2. **Env vars en Vercel (Preview):** `NEXT_PUBLIC_SENTRY_DSN` y `SENTRY_DSN` deben existir en el entorno Preview del proyecto del team. Sin DSN el fix es correcto pero sigue siendo no-op por diseño.
3. **Prueba end-to-end en el preview** (vos, en el navegador):
   - Cliente: abrir el preview, DevTools → Console → `throw new Error('sentry-client-test')` (o `setTimeout(() => { throw new Error('sentry-client-test') })` para que no lo trague la consola). En Network debería aparecer un POST a `o<org>.ingest.<region>.sentry.io/api/<id>/envelope/` con status 200. Si aparece **bloqueado por CSP**, A-7 no está bien derivado para ese DSN.
   - Servidor: cualquier `logger.error` real llega. Forma no invasiva: pegarle a `/api/health` con la BD caída no aplica; alternativa: un error 500 forzado desde una server action de prueba **no** está en la rama a propósito. Si querés una prueba limpia, decime y agrego un endpoint `/api/sentry-test` temporal detrás de `CRON_SECRET` en un commit aparte que se revierte después.
   - Dashboard: Sentry → Issues → filtrar `environment` = valor de `NEXT_PUBLIC_APP_ENV` del preview. Deberían verse los eventos con `request.cookies` vacío y `authorization` redactado.
4. **Merge a `dev`** cuando el punto 3 confirme eventos. Después, §7 tiene las filas de documentación que cambian de sentido con este fix.

### 9.4 Problema de entorno detectado en tu máquina (no lo toqué)

El hook de husky fallaba con `""node"" no se reconoce como un comando` tanto desde Git Bash como desde PowerShell. Causa: la variable de sistema `MAVEN_HOME` está definida **con comillas** (`"C:\Users\user\Desktop\Instalaciones\apache-maven-3.9.11-bin\apache-maven-3.9.11\bin"`) y el PATH la incorpora como `"…\bin"\bin`. Esa comilla suelta rompe el parseo de `npx.cmd` cuando lo invoca `sh`. Para el commit saneé el PATH solo en el proceso del commit. Arreglo permanente (tuyo, es configuración del sistema): Variables de entorno → `MAVEN_HOME` sin comillas, y en `Path` reemplazar la entrada `%MAVEN_HOME%\bin` para que quede `C:\Users\user\Desktop\Instalaciones\apache-maven-3.9.11-bin\apache-maven-3.9.11\bin`. Mientras tanto, cualquier `npx` desde Git Bash en esta máquina va a fallar igual.

---

---

## 10. Sesión 2026-09-02: por qué los eventos de servidor no llegaban (Tarea 1)

### 10.1 El síntoma

En el preview de `5593aa7`, con `CRON_SECRET` ya cargado: el error de cliente
apareció en Sentry, y los dos caminos de servidor devolvieron lo esperado
(200 el del logger, 500 el de la excepción) **sin generar ningún evento** en
el dashboard, con filtro "All Envs" y rango 14D.

### 10.2 Causa raíz — confirmada leyendo el SDK, no por deducción

La sospecha inicial (que el endpoint atrapaba el error y respondía 500 a mano,
sin relanzarlo, por lo que `onRequestError` nunca se disparaba) quedó
**descartada**: el endpoint hace `throw` real (`route.ts`, `mode === 'throw'`),
Next lo propaga y `base-server.js:450` llama a `onRequestError` con `await`.

La causa real es otra, y son **dos causas distintas, una por camino**:

| Camino | Por qué no llegaba |
|---|---|
| `?mode=throw` → `onRequestError` | `instrumentation.ts` exportaba `Sentry.captureRequestError` directo. Ese helper programa el flush con `vercelWaitUntil`, que en el SDK **es un no-op fuera del runtime edge**: `@sentry/core/build/cjs/utils/vercelWaitUntil.js` arranca con `if (typeof EdgeRuntime !== "string") return;`. En el runtime **Node** el evento queda encolado, la función responde el 500 y Vercel la congela antes de que salga el envío. |
| camino logger | `logger.error/warn` devuelven `void` y disparaban `import('@sentry/nextjs')` + `captureException` sin esperar nada ni registrar la tarea en ningún `waitUntil`. Mismo final: la función se congela con el envío en vuelo. |

Los puntos 2 y 3 de la investigación pedida quedaron **descartados como causa**:

- **DSN del servidor:** `sentry.server.config.ts` lee `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN`, y el fallback funciona. El header CSP del preview ya probaba que el DSN público existe. El endpoint ahora lo confirma por respuesta (`sentry.dsnConfigured`).
- **Muestreo / `beforeSend`:** `tracesSampleRate` solo afecta *traces*, nunca errores; no hay `sampleRate` configurado (default 1.0); y `scrubSentryEvent` siempre devuelve el evento, nunca `null`. Ninguno descarta eventos.

### 10.3 Verificación local (no fue deducción)

Se levantó un **ingest falso** en `localhost:9911`, se compiló con `next build`
y se corrió `next start` apuntando el DSN a ese listener. Antes del fix, los
tres caminos enviaban con el proceso vivo (local no congela nada, por eso el
bug es invisible fuera de serverless). Después del fix, midiendo el envío
contra el instante de la respuesta HTTP:

| Modo | HTTP | Envelope |
|---|---|---|
| `?mode=direct` | 200 | **antes** de la respuesta (−3 ms) |
| `?mode=throw` | 500 | **antes** de la respuesta (−1 ms) |
| logger (por defecto) | 200 | después (+4 ms) — local no expone `waitUntil`; en Vercel sí |

### 10.4 El fix (commits `2cf9520` y `94387f2`)

| Archivo | Cambio |
|---|---|
| `src/instrumentation.ts` | `onRequestError` deja de ser el helper del SDK y pasa a ser una función propia: captura y **espera el flush** (2 s) antes de devolver. Next la espera, así que el evento sale antes del 500. `register()` no se tocó. |
| `src/lib/logger.ts` | La cadena captura + flush se registra en el `waitUntil` del contexto de request de la plataforma (símbolos `@next/request-context` y `@vercel/request-context`, el mismo mecanismo que usa `after()`). Fuera de la plataforma, comportamiento idéntico al anterior. Nuevo export `hasServerlessWaitUntil()` para diagnóstico. |
| `src/app/api/sentry-test-temporal/route.ts` | Nuevo `?mode=direct` (captura explícita + flush esperado) como camino de referencia, y diagnóstico booleano en las respuestas 200: `initialized`, `dsnConfigured`, `waitUntilAvailable`. Nunca expone el DSN (hay un test que lo verifica). |

### 10.5 Tests de regresión agregados

Cubren exactamente la clase de bug "el servidor responde bien pero no reporta":

- `tests/unit/observability/logger-sentry.test.ts` (**nuevo**, 9 casos): la tarea se registra en `waitUntil` con ambos símbolos, el orden es captura→flush, nunca rechaza aunque el flush falle, sigue siendo no-op sin DSN, y un contexto roto no rompe el logger.
- `instrumentation.test.ts`: `onRequestError` **no resuelve** hasta que el flush termina (con el flush pendiente, la promesa que Next espera sigue abierta).
- `sentry-test-route.test.ts`: modo `direct` (captura + flush + `eventId`), `flushed:false` si vence el timeout, y que el diagnóstico no filtre el DSN.

| Verificación | Resultado |
|---|---|
| `npx jest --ci` | **34 suites / 532 tests** (antes 33 / 520) |
| `npx tsc --noEmit` | 0 errores |
| `npx eslint` (archivos tocados) | 0 errores |
| `npx next build` | exit 0 |

### 10.6 Estado de la rama y lo que sigue

`fix/sentry-init` **pusheada a `origin/fix/sentry-init` = `3591790`**
(autorizado explícitamente por Maxi el 2026-09-02). Tres commits nuevos sobre
`5593aa7`:

| Commit | Autor | Qué |
|---|---|---|
| `2cf9520` | MaxitoJM | El fix de entrega (`instrumentation.ts` + `logger.ts` + tests) |
| `94387f2` | MaxitoJM | Modo `direct` y diagnóstico en el endpoint TEMPORAL |
| `3591790` | Insolventic | Commit vacío de trigger — el HEAD debía tener ese autor o el plan Hobby bloquea el preview. Mismo patrón de `5593aa7`, **sin reescribir historial** |

`dev` (`f542f22`) y `main` (`70868c6`) **sin tocar**.

Pendiente inmediato (Maxi): esperar el preview, probar los **tres** modos
(`?mode=direct`, sin parámetro y `?mode=throw`) desde la consola del navegador
con `Authorization: Bearer <CRON_SECRET>`, y confirmar en Sentry → Issues
(All Envs, 14D). Recién con esa confirmación arranca la Tarea 2 (borrar el
endpoint temporal, actualizar `RUNBOOK.md`, merge a `dev`).

**Si `direct` llega pero el del logger no**, el dato que lo explica está en la
respuesta del endpoint: `waitUntilAvailable`. Si viene `false` en Vercel, el
camino del logger necesita otro mecanismo (envolver el handler en `after()`);
si viene `true` y aun así no llega, el problema no es la entrega.

---

*Generado el 2026-09-01 a partir de `origin/dev` (`f542f22`), `origin/main` (`70868c6`), la API de GitHub, la API de Vercel (scope personal) y una ejecución local de la suite de tests en un clon aislado. No se modificó ningún archivo existente del repositorio.*
