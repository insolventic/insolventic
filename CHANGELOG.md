# Changelog

All notable changes to INSOLVENTIC will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Un solo wrapper de Sentry**: `src/lib/observability.ts` (`reportError` / `reportMessage`) se elimina y sus llamadores (cron de alertas y scanners de `notification/alerts.ts`) pasan a `logger.error`, que ya tenía entrega garantizada en serverless (`waitUntil` + `flush`). `logger.error` ahora envía `action` como tag de Sentry (lo que `reportError` aportaba) y el contexto pasa por la redacción de PII. `generation-job.ts` deja de capturar además de forma directa: cada fallo de generación producía **dos** eventos en Sentry.

### Added

- **Logger estructurado (Fase 2.1)**: `src/lib/logger.ts` — niveles ERROR/WARN (→ Sentry) e INFO/DEBUG (consola JSON, gated por `LOG_LEVEL`), con redacción automática de PII/secrets en el contexto; `beforeSend` compartido de Sentry (`sentry-scrub.ts`) redacta cookies/headers/query params; boundary global de errores (`app/global-error.tsx`). Rutas críticas migradas (~50 refs): auth (actions, lib, hook `use-auth` — fuera los logs con emojis del build), generación de documentos (job, service, retry) y error boundaries.

- **Lock anti-duplicados de generación (P3)**: tabla `DocumentGenerationRequest` con unicidad parcial sobre `activeKey` — dos generaciones simultáneas del mismo tipo sobre un caso son imposibles a nivel de BD; la llamada perdedora recibe el `requestId` de la activa.
- **Generación inicial en background (P4)**: `createCase` responde de inmediato y el job corre post-response (`after()` de Next), con estado consultable (`getGenerationRequestStatus`), recuperación de locks huérfanos (timeout 10 min), retry con backoff en llamadas a Drive y notificación in-app al terminar o fallar.

### Fixed

- **Totales de bienes de la "Solicitud de Insolvencia" (`TOTAL_INMUEBLES`, `TOTAL_MUEBLES`, `TOTAL_BIENES` y los `MUEBLE_*_VALOR`)**: `mapAssets` sumaba los `Prisma.Decimal` de los activos con `+`, y `Decimal.valueOf()` devuelve un string, así que concatenaba en vez de sumar (un inmueble de $100M sin muebles salía como $1.000M; con más activos, cifras de 15 dígitos). Afectaba a todo documento generado por la ruta automática (creación de caso, generación inicial), que pasa la fila de Prisma sin convertir. Ahora cada sumando pasa por `Number()`. Test de regresión con `Prisma.Decimal` real y comparación de la salida completa del mapper entre `Decimal` y `number`.

### Changed

- **`generateFromTemplates` (generación automática de documentos) corre en 3 fases** — preparar (validar + rellenar HTML), renderizar en lote (`batchHtmlToPdf`, un solo Chromium), subir a Drive — en vez de lanzar y cerrar un navegador por documento (P1 de `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`). Medido con Chromium real (sin Drive): creación de caso (3 documentos) 1455ms → 945ms; admisión (6 documentos) 3426ms → 2133ms (~35-38% más rápido). Los dos lotes grandes que hoy exceden `maxDuration=60s` (Fracaso sin filtrar, paquete completo) siguen rotos — este cambio no los resuelve, ver Issue #3.

## [0.3.0] - 2026-04-15

### Added

- **Proactive alerts (in-app + email)**:
  - `hearing_upcoming` — notifica al operador asignado 48h antes de una audiencia.
  - `payment_overdue` — notifica al operador cuando un pago vence sin registrarse y marca el pago como `vencido`.
  - Scanners puros en `src/features/notification/alerts.ts`, deduplicados por `(type, relatedId, userId)` dentro de una ventana de 20h.
  - Cron endpoint `/api/cron/alerts` protegido con `CRON_SECRET` (Bearer). Schedule por defecto 08:00 UTC diario (`vercel.json`).
  - Email opcional (`ALERTS_EMAIL_ENABLED=true`) con plantilla genérica `emailService.sendAlertEmail(...)`.
- **Observabilidad — Sentry**: configs `sentry.{client,server,edge}.config.ts` + wrapper `src/lib/observability.ts` (`reportError` / `reportMessage`). Sin DSN → degrada a `console` (no-op).
- **Vercel Analytics + Speed Insights** inyectados en `app/layout.tsx`.
- **Exportación a Excel del reporte de Trazabilidad de Pagos** (`exportPaymentTrackingToExcel`, rate-limited, 2 hojas: Resumen + Pagos).
- **Workflow `e2e.yml`**: Playwright (chromium) con Postgres service + seed determinístico, PRs + manual dispatch, artefactos (HTML report + traces) en fallo.
- **Icons + colores** para notificaciones de alertas (Calendar ámbar / AlertTriangle rojo).

### Changed

- **Notificaciones — schema**: `notificationTypeSchema` ahora se genera desde una tupla única (`NOTIFICATION_TYPES`). `getNotificationStats.byType` pasó de 15 counts paralelos a un solo `groupBy` — escala automáticamente al agregar tipos.
- **Notificaciones — API tipada**: `createNotificationForAction` acepta únicamente `CrudNotificationType`; las alertas proactivas fluyen por `alerts.ts` (fuera del action-map).
- **`vercel.json`**: añade sección `crons` con el endpoint de alertas.
- **`.env.example`**: nueva sección "Alertas Proactivas (Cron)" con `CRON_SECRET`, `ALERTS_HEARING_LOOKAHEAD_HOURS`, `ALERTS_DEDUPE_WINDOW_HOURS`, `ALERTS_EMAIL_ENABLED`.
- **Cron endpoint**: comparación de `CRON_SECRET` ahora usa `crypto.timingSafeEqual` (constant-time) en lugar de `!==`.
- **Tenant config consolidada**: 4 formularios de auth (`login`, `register`, `forgot-password`, `reset-password`) ahora importan de `@/lib/tenant-theme` — eliminado `databaseInfo` local duplicado.
- **Estrategia de ramas simplificada**: solo `main` + `dev`. Eliminada rama `stg` de todos los workflows (`pr.yml`, `deploy.yml`, `e2e.yml`) y docs.
- **`deploy.yml`**: `dev` → preview, `main` → producción. Renombrado de "Deploy to Staging & Production" → "Deploy".

### Removed

- Dependencias no utilizadas: `cookies`, `libreoffice-convert`, `pizzip`, `jsdom`.
- Referencias a rama `stg` en workflows, README, y documentación de arquitectura.

### Fixed

- `.gitignore`: excluye artefactos de tesis (`*.docx`, `*.pptx`, diagramas PNG) de la raíz del repo.
- `.vercelignore`: excluye `tests/`, `docs/`, `.github/`, configs de test y artefactos académicos del bundle de producción.

### Tests

- **+17 tests** (unit/alerts.test.ts × 7, unit/observability.test.ts × 3, unit/cron/alerts-route.test.ts × 7) — **23 suites / 422 tests verdes**.
- E2E Playwright realineado con los usuarios del seed (`beatriz.malavera@insolventic.com` / `123456`, tenant `armonia`) y navegación vía `?db=<tenant>` URL param.

### Security

- `CRON_SECRET` se compara con `crypto.timingSafeEqual` (constant-time).
- Cron endpoint emite `requestId` en toda respuesta (éxito o fallo) para trazabilidad en logs.
- Cron endpoint aplica timeout duro de 60s por ejecución; si se excede devuelve `ok: false, timedOut: true` sin reventar el deployment.

## [0.2.0] - 2026-04-14

### Added

- **Case edit with optimistic locking**: `version` field propagado al Zod schema + `edit-case-dialog`. Conflictos muestran toast y cierran el diálogo.
- **Case type filter** en el listado de casos (Insolvencia / Conciliación / Acuerdo de Apoyo).
- **Inline document preview** para PDFs e imágenes usando Google Drive embedded viewer.
- **Empty states** en tablas de casos, deudores y acreedores.
- **Payment receipt upload** con soporte PDF/JPG/PNG hacia Google Drive (`/Comprobantes/`).
- **Documentación completa**: README, ARQUITECTURA (con diagramas Mermaid), MANUAL_USUARIO, TESTS.
- **Tests en CI**: `jest --ci` ejecutado en cada pull request contra `dev`/`stg`/`main`.

### Changed

- **Refresh token security hardening**: expiración reducida de 30 días → 7 días.
- **`mustChangePassword` enforcement**: ahora se valida también en `refresh` y `switchTenant`, no solo en login.
- **Documentos requeridos**: Tradición y libertad + Poder pasan a ser condicionales (no siempre requeridos).
- **Reporte Estado de Casos**: Conciliación y Acuerdo de Apoyo ya no muestran montos engañosos (campo `showMonetary`).
- **.env.example**: documentado exhaustivamente con comentarios por sección.

### Fixed

- Prisma mock en tests: agregados modelos faltantes (auditLog, payment, paymentReceipt, etc.) para evitar `Cannot read properties of undefined`.
- Drive centro tests: alineados a nombres canónicos "Armonía" y "Constructores de Paz".
- Document generation tests: 36 tests verdes (antes: 31/36) tras alinear mock de Select con nueva UI de paquete + formato.

### Tests

- **20 suites / 405 tests verdes** (antes: 7 suites fallando).

## [0.1.0] - 2026-03-08

### Added

- **Authentication module**: Login, register, forgot/reset password with JWT sessions, RBAC (6 roles, 30+ permissions), session timeout with auto-logout.
- **Case management**: Full CRUD for insolvency, conciliation, and support agreement cases. Multi-tenant with `tenantId` isolation. Case creation form with validation rules and document requirements.
- **Debtor management**: Debtor profiles with personal/financial data, linked to cases.
- **Creditor management**: Creditor registry with debt tracking per case.
- **Document generation**: 49 HTML templates organized in 5 packages (Solicitud, Admision, Negociacion, Terminacion, Fracaso). Placeholder mapper with 300+ variables. Batch PDF generation via Puppeteer. Google Drive storage with automatic folder hierarchy.
- **Document upload**: Secure file upload with MIME type validation, filename sanitization, and size limits (10MB).
- **Google Drive integration**: OAuth2 authentication, folder hierarchy management, template sync, document sync.
- **Dashboard**: 6 task modules (Cases, Creditors, Debtors, Documents, Notifications, Users) with help tooltips for onboarding.
- **Drive folder separation**: Separate Google Drive folders per conciliation center (Armonia/Construpaz) with cross-center security validation.
- **Security hardening**: Rate limiting, input sanitization, XSS prevention, CSRF protection, secure headers (CSP, HSTS, X-Frame-Options). 90 security tests.
- **Form validation**: Complete insolvency form validation with document requirements. 75 validation tests.
- **Versioning system**: Semantic versioning with centralized config, UI version badge, environment labeling, CHANGELOG, GitHub release workflow.
- **Test suite**: 384+ automated tests across unit, integration, and component testing.
- **Deployment**: Vercel deployment pipeline with CI/CD.
