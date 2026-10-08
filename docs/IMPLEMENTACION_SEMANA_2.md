# Implementación Semana 2 — Operación y Observabilidad

**Rama:** `fix/semana-2-operacion` (desde `dev` @ `c588830`) · **Fecha:** 2026-08-26
**Referencia:** `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md` (A-2, A-7, A-5, M-10)
**Estado final:** tsc ✅ · eslint 24 warnings = línea base de `dev`, ninguno nuevo ✅ · jest **504/504** ✅ (487 base + 17 nuevos) · `next build` ✅

> **Sin push.** La rama es local. No se ejecutó ninguna migración ni escritura contra base de datos, y no se tocó `main`. Ninguna operación reescribió historial.

## Commits

| Commit | Hallazgo | Título |
|---|---|---|
| `8a8a1ae` | A-2 | feat(security): rate limiting distribuido con Upstash Redis |
| `c51ea96` | A-7 | fix(observability): permitir el ingest de Sentry en la CSP |
| `57fd2c5` | A-5 | feat(ops): health check + smoke test post-deploy |
| `f542f22` | M-10 | docs(ops): runbook de incidentes, rollback y despliegue de emergencia |

> Los hashes cambiaron respecto de los originales al corregir el mensaje del commit de A-2 (ver más abajo): reescribir un commit recalcula el hash de todos sus descendientes. Contenido verificado idéntico — mismo tree hash en los cuatro.

---

## 1. A-2 — Rate limiting distribuido (Upstash)

**Archivos:** `src/lib/rate-limit.ts` · 5 archivos de `src/features/**` (call-sites) · `.env.example` · `package.json` · `tests/security/rate-limit.test.ts`

- `checkRateLimit` pasa a **async** y usa la ventana deslizante de `@upstash/ratelimit` cuando `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` están definidas. **9 call-sites migrados** a `await`: auth ×5 (login, register, forgot, reset, changePassword), documentos ×2, pagos, reportes. `checkGenerationRateLimit` pasó a async y sus 5 llamadores también.
- Un limiter cacheado por combinación de config (no se crea cliente por request); env vars validadas en el primer uso, nunca en import.
- `.env.example` documenta las dos variables con el enlace a la consola de Upstash.

**Decisión de diseño — degradación en vez de fail-closed.** Si Upstash no está configurado, o si Redis falla en runtime, el sistema cae al limitador in-memory en lugar de bloquear el login. Fundamento: dejar a los dos centros sin poder entrar por un hipo de Redis es peor que degradar temporalmente la protección, y el fallback sigue frenando el abuso dentro de cada instancia. La degradación es **visible**: se loguea `warn` (llega a Sentry) y viaja en el campo `degraded` de cada resultado.

**Tests (18, +7 sobre los 11 previos):** los 11 originales pasaron a async y ahora ejercitan el fallback; los nuevos cubren el camino distribuido con los SDK mockeados — delegación a Redis, bloqueo cuando Redis dice que la ventana se agotó, ventana compartida entre instancias (lo que el in-memory *no* hacía), reutilización del limiter, y fallback cuando Redis lanza. Estos tests fallan contra el código anterior porque antes no existía backend distribuido.

## 2. A-7 — Sentry bloqueado por la CSP

**Archivos:** `src/lib/csp.ts` (nuevo) · `next.config.ts` · `tests/security/csp.test.ts` (nuevo)

- La CSP se construye ahora en un módulo puro y testeable; `next.config.ts` la consume. El origen de ingest se **deriva del propio DSN** (`new URL(dsn).origin`), así que no se hardcodea la región ni la organización, y si no hay DSN la política no se ensancha.
- **No se usó `tunnelRoute`** aunque la auditoría lo ofrecía como alternativa: requiere envolver `next.config` con `withSentryConfig()`, que es exactamente lo que reabre el problema de tracing de `@opentelemetry/api` que rompió los deploys en agosto (Session 3). Ensanchar `connect-src` es la opción de menor riesgo.
- **Tests (10):** derivación del origen desde DSN con y sin región, DSN ausente/malformado (devuelve null en vez de lanzar), y —lo importante— que el origen entra **solo** en `connect-src` sin aflojar `script-src` ni `default-src`, y que nunca aparece un wildcard.
- Verificado con un `next build` real pasando un DSN, para confirmar que el import desde `src/` funciona dentro de `next.config.ts`.

## 3. A-5 — Health check + smoke test post-deploy

**Archivos:** `src/app/api/health/route.ts` (nuevo) · `scripts/smoke-test.sh` (nuevo) · `.github/workflows/smoke.yml` (nuevo) · `package.json` · `tests/unit/health/health-route.test.ts` (nuevo)

- **`GET`/`HEAD /api/health`**: ejecuta `SELECT 1` con timeout de 5s. `200 {"status":"ok"}` o `503 {"status":"degraded"}`, sin caché. Es público a propósito (un health check detrás de auth no sirve para verificar un deploy) y por eso **deliberadamente pobre en información**: nunca devuelve mensajes del driver, hosts, credenciales ni stack. Hay un test que lo afirma explícitamente inyectando un error con IP y nombre de base.
- **`scripts/smoke-test.sh`**: 4 verificaciones — health, home 200, y **dos gates de seguridad** (`/cases` sin sesión redirige a `/login`, `/register` cerrado). Reintenta el health check 6 veces por el cold start del deploy nuevo. Corre también local: `npm run test:smoke -- <url>`.
- **`.github/workflows/smoke.yml`**: se dispara con `deployment_status` cuando el estado es `success`, más `workflow_dispatch` para correrlo a mano tras un rollback.
- **Tests (7)** del route handler: 200/503, reporte a Sentry ante fallo de BD, no filtración de infraestructura, no-caché, y el contrato de `HEAD`.
- **Bug encontrado y corregido durante el desarrollo:** el `setTimeout` del `Promise.race` quedaba pendiente cuando ganaba la query, manteniendo viva la lambda hasta 5s después de responder. Lo detectó Jest al no cerrar. Ahora se limpia en un `finally`.

**Verificación real:** corrí el script contra el preview de la Semana 1. Falló correctamente en el paso 1 (ese deploy no tiene aún `/api/health`) con exit 1, y los pasos 2–4 dieron exactamente lo esperado — `/` → 200, `/cases` → 307 a `/login?redirect=%2Fcases`, `/register` → 307 a `/login`. De paso confirma en producción que C-1 y C-2 de la Semana 1 están actuando.

## 4. M-10 — Runbook operativo

**Archivo:** `docs/RUNBOOK.md` (nuevo, 307 líneas)

Triage (health → Sentry → Vercel), rollback, incidentes por componente (BD, app, generación de documentos, Drive, email, cron, rate limiting), despliegue manual de emergencia, rotación de secretos con su impacto, y checklist de verificación post-incidente.

Dos cosas que no eran obvias y quedan escritas:

- **El rollback de Vercel no revierte migraciones.** Corren dentro del `buildCommand` de `vercel.json` gateadas por `VERCEL_ENV=production`, así que promover un deploy anterior deja el código viejo corriendo contra el esquema nuevo. De ahí la regla de migraciones aditivas y el patrón expand/contract, ambos documentados.
- **El remedio del deploy "Blocked"** por autor de commit, con la advertencia explícita de que reescribe historial y requiere confirmación.

Los datos que dependen de las cuentas (contactos de los centros, proveedor de Postgres, URL de Sentry) quedaron marcados `⟨COMPLETAR⟩`: no los inventé.

---

## Requiere acción tuya antes de que esto sirva en producción

1. **Crear la base de Upstash** (tier gratuito) y cargar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Vercel, en producción y preview. **Sin esto, A-2 no cambia nada en la práctica**: el código funciona pero sigue degradado a in-memory. Es el único item de la semana que queda inerte sin configuración.
2. **Verificar que Sentry recibe errores** después del deploy: disparar un error de cliente y uno de servidor y confirmar que llegan. La CSP ya lo permite, pero nadie comprobó todavía que el DSN esté bien configurado en producción.
3. **Completar los `⟨COMPLETAR⟩` del runbook** (contactos, proveedor de BD, URL de Sentry).
4. **A-4 (backups) sigue abierto** — era de la Semana 2 en el plan original pero depende de accesos al proveedor, no de código. Hasta que se ejecute una restauración de prueba, la sección §3.1 del runbook es teórica. Es el hallazgo alto más importante que queda sin cerrar.
5. **M-8 (branch protection)** tampoco es código: verificar en GitHub que `main` exige PR + checks.

## Resuelto tras la revisión

- **Mensaje dañado del commit de A-2** (bash interpretó los backticks de `` `degraded` `` como sustitución de comando): corregido con autorización explícita. Como no era el commit de punta, reescribirlo obligó a recalcular el hash de los 3 descendientes — consecuencia mecánica inevitable. Verificado que el contenido no se tocó: los 4 tree hashes son idénticos a los originales y el diff entre la punta vieja y la nueva es vacío. De acá en adelante los mensajes van con `git commit -F` para evitar la interpolación del shell.
- **Autoría del commit de punta**: amendada a `Insolventic <insolvenic@gmail.com>` para el check del plan Hobby de Vercel. Al hacerlo **antes** del primer push, no hizo falta force-push: el push a `dev` fue normal (`c588830..f542f22`). Tree hash idéntico, diff vacío.

## Fuera de alcance — visto, no tocado

- Los 24 warnings de ESLint son la línea base de `dev` (13 en `src` + 11 en tests); no agregué ninguno.
- Siguen las 12 vulnerabilidades de npm que solo se cierran con `--force` (exceljs→uuid, extract-zip, image-size, deepmerge-ts, postcss).
- El build sigue emitiendo warnings preexistentes: módulo `encoding` de `html-to-docx`, y los `console.log` con emoji del hook de sesión (parte de M-4).
- `/api/health` no expone la versión de la app a propósito. Si querés que el smoke test verifique *qué* commit está desplegado, hay que agregarlo — decisión tuya, no la tomé.

## Próximo paso

Semana 2 terminada. **Paro acá** y espero tu revisión. Cuando quieras desplegar a preview, el merge fast-forward a `dev` y el push los hago cuando me lo indiques — y te recuerdo que, por el check de autor de Vercel, el commit de la punta necesitará autoría `Insolventic <insolvenic@gmail.com>`, lo que implica amend + force-push: **no lo voy a ejecutar sin tu confirmación explícita de esa operación puntual.**
