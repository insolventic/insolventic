# CLAUDE.md — INSOLVENTIC

Sistema web full-stack de gestión de expedientes de insolvencia (proyecto de tesis, en producción multi-tenant con casos legales reales).

## Stack

- **Framework:** Next.js 15 (App Router) — la API son **server actions** (`src/features/*/actions.ts`); solo existe una route handler (`/api/cron/alerts`)
- **BD:** PostgreSQL + Prisma (schema en `src/prisma/schema.prisma`, migraciones en `src/prisma/migrations/`)
- **Documentos:** plantillas HTML (`templates/{insolvency,conciliation,support-agreements}`) → placeholders → Puppeteer/Chromium (PDF) → **Google Drive** (no S3)
- **Auth:** JWT propio (jose) + middleware; RBAC por permisos; aislamiento multi-tenant por `tenantId` en cada query
- **Deploy:** Vercel (serverless — sin workers persistentes) vía GitHub Actions (`deploy.yml` corre `prisma migrate deploy` antes del build)
- **Tests:** Jest (unit/integration, mocks en `tests/__mocks__/`), Playwright (E2E), k6 (load)

## Comandos

```bash
npm run dev            # dev server (turbopack)
npm test               # suite completa (445 tests)
npx tsc --noEmit       # type-check
npm run lint           # eslint
npm run db:migrate     # prisma migrate dev
npm run test:e2e       # playwright
```

## Convenciones

- Toda server action: `authenticateUser()` → check de permiso (`P.*`) → queries scoped por `tenantId`.
- Datos de usuario que terminan en HTML de documentos: escapar con `escapePlaceholder` (placeholder-mapper.ts); los placeholders HTML del sistema van en `HTML_PLACEHOLDERS_ALLOWLIST`.
- Env vars: validar en el primer uso, **nunca en import** — `next build` recolecta page data sin secrets (`vercel pull` excluye las vars sensitive). Patrón: `email.ts`, `auth.ts`.
- Módulos compartidos entre actions van en archivos sin `'use server'` (ej. `persistence.ts`, `generation-request.ts`).

## Logger Pattern

Usar `logger` de `src/lib/logger.ts` — **nunca `console.*` directo** en código nuevo.

```ts
import { logger } from '@/lib/logger';

logger.error('Generation job failed', error, { action: 'generation-job', requestId, caseId });
logger.warn('Retry attempt', { action: 'drive-upload', attempt, maxAttempts, reason: err.message });
logger.info('Generation job completed', { requestId, duration });  // prod: solo con LOG_LEVEL=info
logger.debug('useAuth state', { hasUser, isLoading });             // solo desarrollo
```

- Niveles: ERROR/WARN → consola JSON + Sentry; INFO/DEBUG → consola JSON según `LOG_LEVEL` (default: `warn` en prod, `debug` en dev).
- El `context` pasa por redacción automática (password/token/email/phone/cedula → `[REDACTED]`); aun así no pasar payloads completos.
- Eventos **esperados** (token expirado, redirect de logout) van en `info`/`debug`, no `error` — no inundar Sentry.
- Sin dependencia de Pino/Winston a propósito: en Vercel serverless stdout es el transport; el interface permite introducir una librería después sin tocar call-sites.
- `beforeSend` de Sentry redacta cookies/headers/query params sensibles (`src/lib/sentry-scrub.ts`, compartido por los 3 configs).

## Architecture Decisions

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
5. **PENDIENTE post-reunión (2026-08-12):** evaluar los 3 pares de modelos EN/ES del schema (`Creditor`/`Acreedor`, `Asset`/`Bien`, `LegalProcess`/`ProcesoJudicial`). Diagnóstico confirmado por código: **no son duplicados** — `Creditor`/`Asset`/`LegalProcess` son el registro general (reutilizable entre casos, ej. `Creditor` con `Contact[]`/`Debt[]` propios); `Acreedor`/`Bien`/`ProcesoJudicial` son el snapshot detallado por caso de las Secciones V/VI/VII del "Formulario Definitivo" (ver comentarios en `schema.prisma` líneas 708–815 y `case-details-dialog/definitivo-section.tsx`, cards "Acreedores Definitivo"/"Bienes Definitivo"). Evaluar si vale la pena documentar esta distinción más explícitamente (naming, comentarios) para que no se malinterprete como redundancia en el MER — no requiere tocar el schema.

> Nota: dos items del roadmap original se descartaron por no corresponder al código real: la migración Float→Decimal (los montos ya usan `Decimal`) y el split del schema Prisma (tiene 1.041 líneas, no 2.516 — no urge).

## Referencias

- Auditoría integral: `docs/AUDITORIA_INSOLVENTIC_2026-07-11.md`
- Auditoría del módulo de documentos (P1–P9): `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`
- Arquitectura general: `docs/ARQUITECTURA.md`
