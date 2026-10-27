# Decisiones de arquitectura — Insolventic

Historial de decisiones técnicas por iteración de trabajo. Material de consulta, separado de `CLAUDE.md`, que apunta aquí.

## Iteración 3 (2026-08-18) — Deploy: workflow roto → integración nativa de Vercel

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

## Iteración 2 (2026-07-11) — Document Generation P3/P4 + CI Stabilization

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

## Iteración 1 (2026-07-10) — P2 XSS en placeholders

- Escapado OWASP en el **punto de fusión** de `mapCaseToPlaceholders` (safe-by-default) + allowlist de 16 placeholders HTML del sistema; interpolaciones de usuario escapadas dentro de los builders y en `buildConciliationContext`.
- Razón: ~300 claves escalares en ~20 sub-mappers — escapar valor-por-valor garantizaba omisiones futuras.
