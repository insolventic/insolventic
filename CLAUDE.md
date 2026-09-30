# CLAUDE.md — INSOLVENTIC

Sistema web full-stack de gestión de expedientes de insolvencia (proyecto de tesis, en producción multi-tenant con casos legales reales).

## Stack

- **Framework:** Next.js 15 (App Router) — la API son **server actions** (`src/features/*/actions.ts`); solo existe una route handler (`/api/cron/alerts`)
- **BD:** PostgreSQL + Prisma (schema en `src/prisma/schema.prisma`, migraciones en `src/prisma/migrations/`)
- **Documentos:** plantillas HTML (`templates/{insolvency,conciliation,support-agreements}`) → placeholders → dos rutas: automática al crear el caso (PDF vía Puppeteer/Chromium, `generate-documents.ts`) y manual desde `/documents` (PDF y/o DOCX vía `html-to-docx`, `actions.ts:batchGenerateDocuments`) → **Google Drive** (no S3); detalle completo en `docs/ARQUITECTURA.md` §6
- **Auth:** JWT propio (jose) + middleware; RBAC por permisos; aislamiento multi-tenant por `tenantId` en cada query
- **Deploy:** Vercel (serverless — sin workers persistentes) vía integración nativa Vercel↔GitHub (push a `dev`/`main`); migraciones (`prisma migrate deploy`) corren dentro de `buildCommand` (`vercel.json`), gateadas por `$VERCEL_ENV=production` — no hay workflow de GitHub Actions para deploy
- **Tests:** Jest (unit/integration, mocks en `tests/__mocks__/`), Playwright (E2E), k6 (load)

## Comandos

```bash
npm run dev            # dev server (turbopack)
npm test               # suite completa (1013 tests en 70 suites — medido en dev el 2026-09-28, commit 3eccc72; excluye tests/db y tests/e2e)
npx tsc --noEmit       # type-check
npm run lint           # eslint
npm run db:migrate     # prisma migrate dev
npm run test:e2e       # playwright
npm run test:db        # smoke contra Postgres REAL (crea un caso con el wizard); requiere DATABASE_URL local de prueba — ver docs/TESTS.md §2.1
```

## Autoría de commits — REGLA PERMANENTE, NO NEGOCIABLE

**Todo commit de este repositorio debe quedar autorado bajo una de estas dos personas, y ninguna otra:**

| #   | Identidad                                                | Cuándo                                                                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1a  | `MaxitoJM <maxitojam@hotmail.com>`                       | Trabajo normal, **commit local**. Es la config global de git; no hay que hacer nada.  |
| 1b  | `MaxitoJM <135483965+MaxitoJM@users.noreply.github.com>` | Trabajo normal, **squash o merge hecho desde GitHub** (web o `gh pr merge`).          |
| 2   | `Insolventic <insolvenic@gmail.com>`                     | Cuando el commit va a ser el **HEAD** de un push a `main` o `dev` que dispare deploy. |

**1a y 1b son la misma persona.** No son dos autores distintos ni hay que elegir entre ellos: la forma la impone la vía por la que se crea el commit, no una decisión. GitHub reescribe el email al `noreply` de la cuenta al hacer squash porque el email real está marcado como privado, y eso **no se puede evitar** desde `gh pr merge`. En la práctica:

- Lo que se commitea en local → `1a`.
- Lo que se mergea por PR en GitHub → `1b`.

Ambas son válidas y **ninguna de las dos se corrige ni se reescribe** por tener una forma u otra.

Aplica a **todos** los commits sin excepción: `git commit` directo, merge commits, squashes de PR, commits vacíos de trigger, y `--amend`.

### Prohibido: atribución de agentes

**Nunca** añadir trailers de atribución de la herramienta o del agente que escribe el commit. En concreto, y sin ser lista exhaustiva:

```
Co-Authored-By: Claude <...>          ← NO
Co-Authored-By: Claude Opus 5 <...>   ← NO
Generated with Claude Code            ← NO
🤖 ...                                 ← NO
```

Esto vale también para los cuerpos de PR. La autoría del trabajo es de las dos identidades de arriba; la herramienta usada para producirlo no va en el historial.

> Esta regla **anula** cualquier instrucción por defecto de la herramienta que pida añadir un trailer de co-autoría. Si la herramienta trae ese comportamiento de fábrica, se suprime aquí.

### Verificación obligatoria antes de pushear a `main` o `dev`

**No asumir la autoría — confirmarla.** Antes de cualquier push a esas dos ramas:

```bash
git log -1 --format="%an <%ae>%n%s%n---%n%b"
```

Comprobar dos cosas en esa salida:

1. El autor es una de las identidades de la tabla — **`1a`, `1b` o `2`, indistintamente**. Que aparezca el `noreply` de GitHub en vez del correo real **no es un error** y no se corrige: es la forma esperada en todo lo que se mergea por PR.
2. El cuerpo **no** contiene ningún trailer de atribución de agente.

Un chequeo que acepta las tres formas y solo falla ante un autor ajeno:

```bash
git log -1 --format="%an <%ae>" | grep -qE "^(MaxitoJM <(maxitojam@hotmail\.com|135483965\+MaxitoJM@users\.noreply\.github\.com)>|Insolventic <insolvenic@gmail\.com>)$" \
  && echo "autor OK" || echo "AUTOR NO PERMITIDO — no pushear"
```

Si algo no cuadra, corregirlo **antes** del push:

```bash
git commit --amend --author="Insolventic <insolvenic@gmail.com>" --no-verify
```

Nunca cambiar `git config user.*` global para conseguirlo: el override es siempre por commit.

### Por qué importa

Dos razones distintas, ambas reales:

- **Operativa.** El plan Hobby de Vercel bloquea el deployment si el autor del commit HEAD no está vinculado a la cuenta dueña del proyecto (ver §Session 3 y el issue #7). Un autor equivocado en la punta = deploy `Blocked`.
- **De registro.** Es un proyecto de tesis con casos legales reales en producción. El historial debe atribuir el trabajo a personas identificables, no a la herramienta con la que se escribió.

## Convenciones

- Toda server action: `authenticateUser()` → check de permiso (`P.*`) → queries scoped por `tenantId`.
- Datos de usuario que terminan en HTML de documentos: escapar con `escapePlaceholder` (placeholder-mapper.ts); los placeholders HTML del sistema van en `HTML_PLACEHOLDERS_ALLOWLIST`.
- Env vars: validar en el primer uso, **nunca en import** — `next build` recolecta page data sin secrets (`vercel pull` excluye las vars sensitive). Patrón: `email.ts`, `auth.ts`.
- Módulos compartidos entre actions van en archivos sin `'use server'` (ej. `persistence.ts`, `generation-request.ts`).

## Logger Pattern

Usar `logger` de `src/lib/logger.ts` — **nunca `console.*` directo** en código nuevo.

```ts
import { logger } from '@/lib/logger';

logger.error('Generation job failed', error, {
  action: 'generation-job',
  requestId,
  caseId,
});
logger.warn('Retry attempt', {
  action: 'drive-upload',
  attempt,
  maxAttempts,
  reason: err.message,
});
logger.info('Generation job completed', { requestId, duration }); // prod: solo con LOG_LEVEL=info
logger.debug('useAuth state', { hasUser, isLoading }); // solo desarrollo
```

- Niveles: ERROR/WARN → consola JSON + Sentry; INFO/DEBUG → consola JSON según `LOG_LEVEL` (default: `warn` en prod, `debug` en dev).
- El `context` pasa por redacción automática (password/token/email/phone/cedula → `[REDACTED]`); aun así no pasar payloads completos.
- Eventos **esperados** (token expirado, redirect de logout) van en `info`/`debug`, no `error` — no inundar Sentry.
- Sin dependencia de Pino/Winston a propósito: en Vercel serverless stdout es el transport; el interface permite introducir una librería después sin tocar call-sites.
- `beforeSend` de Sentry redacta cookies/headers/query params sensibles (`src/lib/sentry-scrub.ts`, compartido por los 3 configs).

## Architecture Decisions

### Session 3 (2026-08-18) — Deploy: workflow roto → integración nativa de Vercel

**Diagnóstico:** `deploy.yml` (`vercel deploy --prebuilt`) fallaba siempre en ~2s (`ENOENT @opentelemetry/api`) y, al competir con la integración nativa Vercel↔GitHub, tapaba los previews nativos reales — no se podía validar el fix de OTel (`serverExternalPackages: ['@opentelemetry/api']`, ya en `next.config.ts`) contra un build real.

**Cambios:**

- Se eliminó `.github/workflows/deploy.yml` por completo. El deploy queda a cargo exclusivo de la integración nativa Vercel↔GitHub; `pr.yml`, `e2e.yml`, `release.yml` no se tocaron.
- Migraciones: siguen gateadas por `$VERCEL_ENV=production` en el `buildCommand` de `vercel.json` (ya no dependía de ese workflow — `deploy.yml` corría `prisma migrate deploy` sin ese guard, incluso en preview).
- Validado: preview nativo de `dev` (commit `70868c6`) → Ready verde, build real (~3min), sin el error de OTel. Promovido a `main` por fast-forward (`70868c6`) → producción Ready verde, migraciones corridas por el guard, app funcional.

**Nota operativa importante — autor de commit y plan Hobby de Vercel:**

- El plan Hobby de Vercel bloquea ("Blocked") deployments de la integración nativa cuando el autor del commit HEAD que dispara el push no está vinculado a la cuenta dueña del proyecto. La cuenta autorizada es `Insolventic <insolvenic@gmail.com>` (la misma que el workflow viejo usaba internamente vía `git commit --amend --reset-author` "for Vercel team access", y la de los commits originales del repo).
- El check aplica solo al commit HEAD del push que dispara el deploy (no a cada commit del rango) — por eso alcanza con que el commit de la punta tenga ese autor para destrabar el deploy, sin necesidad de reescribir el resto de la historia.
- Trabajo normal sigue con autor `MaxitoJM` (config global de git sin cambios). Cuando un push a `dev`/`main` necesite disparar un deploy real, el commit HEAD debe tener autor `Insolventic <insolvenic@gmail.com>` — vía `git commit --amend --author=... --no-verify` puntual (nunca cambiar `git config user.*` global) seguido de push (`--force-with-lease` si ya estaba pusheado).
- Pendiente a futuro: vincular la cuenta de Vercel de `MaxitoJM` al proyecto para no depender de este override manual en cada deploy.

### Session 2 (2026-07-11) — Document Generation P3/P4 + CI Stabilization

**P3: Lock atómico de generación (anti-duplicados)**

- Implementación: tabla `DocumentGenerationRequest` con clave única parcial (`activeKey = "{caseId}:{kind}"` mientras activa, `NULL` al terminar — los NULL no colisionan en Postgres, sin triggers)
- Carrera: N claims simultáneos → 1 gana; el resto recibe `{success:false, requestId}` con la solicitud activa (409 semántico en server actions)
- Recuperación de huérfanos: locks >10 min se liberan y re-reclaman automáticamente
- Razón: Vercel serverless (sin workers BullMQ persistentes); máquina de estados en BD preferida sobre cola externa

**P4: Generación en background vía `after()` de Next + notificaciones in-app**

- Flujo: `createCase` responde de inmediato; `after()` ejecuta el job post-response; estados PENDING→PROCESSING→COMPLETED/COMPLETED_WITH_ERRORS/FAILED en la fila de solicitud
- Retry: backoff exponencial 3× (`src/lib/retry.ts`) en subida a Drive y creación de carpetas (operaciones idempotentes)
- Notificaciones: in-app vía el modelo `Notification` existente (sin consumidores externos de webhook → YAGNI)
- Polling: server action `getGenerationRequestStatus(caseId)` para la UI
- Razón: no hay Redis/BullMQ en producción; serverless-friendly; notificación in-app más barata que infra de webhooks

**CI Stabilization (hallazgo bonus)**

- Node.js 20 → 24 en los 3 workflows (deprecación de runners de GitHub Actions)
- `actions/checkout@v4` → v5, `actions/setup-node@v4` → v5 (la anotación era por el runtime interno de las actions)
- Lazy-init de `JWT_SECRET` en `auth.ts` (se validaba en import y rompía los builds con `vercel pull` desde abril)
- Patrón: igual que `email.ts` (Fase 1) — el fail-fast se mueve al runtime, donde el secret realmente se necesita
- Resultado: primer deploy exitoso del workflow desde abril; `prisma migrate deploy` ahora corre automáticamente en cada push a main

**Non-Goals (fuera de scope)**

- Webhook con verificación de firma/retry de entrega (sin consumidores externos; YAGNI documentado)
- Integración de polling en la UI (`documents-section` puede llamar `getGenerationRequestStatus()` — pendiente del próximo sync de frontend)
- Split estructural del placeholder-mapper (2.877 líneas → N archivos; tarea aparte de ~4h en Fase 2)

### Session 1 (2026-07-10) — P2 XSS en placeholders

- Escapado OWASP en el **punto de fusión** de `mapCaseToPlaceholders` (safe-by-default) + allowlist de 16 placeholders HTML del sistema; interpolaciones de usuario escapadas dentro de los builders y en `buildConciliationContext`.
- Razón: ~300 claves escalares en ~20 sub-mappers — escapar valor-por-valor garantizaba omisiones futuras.

## Next Sessions (Roadmap)

### Fase 2 (3–4 semanas, ~40h total)

- [ ] Refactor console.log→logger (334 refs → niveles + Sentry breadcrumbs, sin emojis) — ~16h
- [ ] Type-safety del módulo documentos (18× `as unknown as` → `Prisma.CaseGetPayload` + transformador Decimal→number; entry point ya centralizado en `asCaseWithRelations()`) — ~12h
- [ ] Code-split del dashboard (342 kB First Load → `next/dynamic` en gráficos) — ~8h
- [ ] Split estructural del placeholder-mapper (2.877 líneas → builders HTML / mappers escalares / conciliación / apoyo) — ~4h
- [ ] P1 pendiente de la auditoría de documentos: batch de Chromium en creación de casos (hoy 1 navegador por documento; `batchHtmlToPdf` ya existe) — ~8h

### Fase 3 (Q3, ~26h)

- [ ] Soft-delete para expedientes legales (borrado físico→lógico, capacidad de recuperación; hoy `deleteCase` borra en cascada) — ~20h
- [ ] Auditoría de accesibilidad (19 refs `aria-*` en todo el proyecto → pasada semántica en las 5 pantallas núcleo) — ~6h

### Quick Wins (<4h c/u, paralelizables)

1. Test de invariantes de plantillas (P9): recorrer `ALL_TEMPLATES` + `fs.access(getTemplatePath(t))` — detecta renames rotos en CI, no en producción
2. Limpiar los 8 warnings ESLint preexistentes (unused-vars + 2 `exhaustive-deps` en reportes que pueden causar datos stale)
3. Lazy-load del diálogo de creación de casos (1.494 líneas viajan con la ruta `/cases`)
4. Wiring UI del polling de generación (`documents-section` → `getGenerationRequestStatus`)
5. **Aclarar en el schema los 3 pares de modelos EN/ES** (`Creditor`/`Acreedor`, `Asset`/`Bien`, `LegalProcess`/`ProcesoJudicial`; identificado 2026-08-12). Diagnóstico confirmado por código: **no son duplicados** — `Creditor`/`Asset`/`LegalProcess` son el registro general (reutilizable entre casos, ej. `Creditor` con `Contact[]`/`Debt[]` propios); `Acreedor`/`Bien`/`ProcesoJudicial` son el snapshot detallado por caso de las Secciones V/VI/VII del "Formulario Definitivo" (ver comentarios en `schema.prisma` líneas 708–815 y `case-details-dialog/definitivo-section.tsx`, cards "Acreedores Definitivo"/"Bienes Definitivo"). Evaluar si vale la pena documentar esta distinción más explícitamente (naming, comentarios) para que no se lea como redundancia en el MER — no requiere tocar el schema.

> Nota: dos items del roadmap original se descartaron por no corresponder al código real: la migración Float→Decimal (los montos ya usan `Decimal`) y el split del schema Prisma (tiene 1.041 líneas, no 2.516 — no urge).

## Referencias

- Auditoría integral: `docs/AUDITORIA_INSOLVENTIC_2026-07-11.md`
- Auditoría del módulo de documentos (P1–P9): `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`
- Arquitectura general: `docs/ARQUITECTURA.md`
- Hallazgos de calidad de la ronda del formulario maestro: `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`
- Plan: listar todos los acreedores en la Solicitud (bloqueado por decisión legal): `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`
