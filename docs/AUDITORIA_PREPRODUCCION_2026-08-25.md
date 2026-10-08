# Auditoría Integral Pre-Producción — INSOLVENTIC

**Fecha:** 2026-08-25 · **Auditor:** revisión técnica externa (solo lectura) · **Commit base:** `854e694` (main, limpio)
**Checks ejecutados:** `tsc --noEmit` ✅ (0 errores) · `jest` ✅ (447/447) · `eslint` ⚠️ (13 warnings) · `npm audit` ⚠️ (20 vulns: 18 high, 2 moderate) · `prisma validate` ✅

---

## 1. Resumen ejecutivo

El proyecto **no está listo para anunciar producción hoy, pero está cerca**. La base es sólida: server actions con autenticación + permiso + scope de `tenantId` disciplinado (auditado query por query), lock atómico de generación, logging estructurado con redacción de PII, CI con checks reales y 447 tests verdes. Sin embargo, existen **dos hallazgos críticos**: (1) el gate de autenticación del middleware es **código muerto** — `publicRoutes` incluye `'/'` y se compara con `startsWith`, por lo que *toda* ruta se trata como pública y ni la protección de rutas ni los checks de permiso por ruta se ejecutan jamás; y (2) el **registro abierto sin verificación de email**, combinado con la identidad `user.email → Debtor.email`, permite a cualquier persona en internet registrarse con el correo de un deudor real y acceder a su expediente completo (caso, deudas, documentos). Ambos son corregibles en horas, no semanas. El resto son riesgos altos operativos (sin estrategia de backup verificada, sin rollback de despliegue, Next.js con CVEs high conocidos, rate limiting inefectivo en serverless) y deuda media ya conocida. Con las 2 críticas + las ~8 altas resueltas, el go-live de septiembre es realista.

---

## 2. Tabla resumen de hallazgos

| # | Capa | Hallazgo | Severidad | Esfuerzo |
|---|------|----------|-----------|----------|
| C-1 | Seguridad | Gate de auth del middleware es código muerto (`'/'` + `startsWith`) | **Crítico** | 2–4h |
| C-2 | Seguridad | Registro abierto sin verificación de email + identidad por email → suplantación de deudor | **Crítico** | 8–16h |
| A-1 | Seguridad | Next.js 15.5.20 con CVEs high (DoS en Server Actions, cache confusion) | Alto | 2h |
| A-2 | Seguridad | Rate limiting in-memory inefectivo en Vercel serverless (login/reset sin protección real) | Alto | 4–8h |
| A-3 | Seguridad | `loginUser`/`refreshAccessToken` devuelven los JWT en el body además de las cookies httpOnly | Alto | 2h |
| A-4 | BD/Operación | Sin estrategia de backup/restore documentada ni probada | Alto | 8h + decisión |
| A-5 | CI/CD | `prisma migrate deploy` corre antes del build; sin rollback ni health check post-deploy | Alto | 6–8h |
| A-6 | Seguridad | Sin revocación de sesiones: cambio de contraseña/rol no invalida JWTs vigentes (24h) | Alto | 8h |
| A-7 | Observabilidad | CSP `connect-src` no incluye el dominio de ingest de Sentry → errores de cliente probablemente bloqueados | Alto | 1h |
| A-8 | Compliance | Sin política de retención/borrado (Ley 1581); `deleteCase` es borrado físico irrecuperable | Alto | 20h (Fase 3) |
| M-1 | BD | FKs sin índice (Debt, Asset, Contact, LegalProcess, Libranza, SuspendedService, Dependent, Document.tenantId, Case.tenantId/debtorId/operatorId/hearingDate) | Medio | 3h |
| M-2 | BD | `Debt.interestRate` es `Float` (resto de montos `Decimal`); `status`/`kind`/`phase` como String libre sin enums | Medio | 4–6h |
| M-3 | Arquitectura | Doble representación de acreedores (master `Creditor`+`Debt` vs snapshot `Acreedor`) sin regla de autoridad documentada en código | Medio | doc: 2h |
| M-4 | Backend | 305 refs `console.*` restantes (vs. convención logger); incluye `deleteCase` y hooks con emojis | Medio | 16h (ya en roadmap) |
| M-5 | Seguridad | CSP con `unsafe-inline`/`unsafe-eval`; enumeración de usuarios en `forgotPassword` (deliberada) | Medio | 4h / decisión |
| M-6 | Multi-tenant | Una sola credencial de Google Drive para ambos tenants; aislamiento en Drive depende 100% de lógica de app | Medio | decisión + 4h |
| M-7 | Testing | Sin tests E2E de aislamiento cross-tenant; k6 existe pero sin evidencia de ejecución contra staging | Medio | 8h |
| M-8 | CI/CD | Push directo a `main` despliega sin correr tests (deploy.yml no ejecuta jest/tsc; depende de branch protection no verificable en repo) | Medio | 1h + config GitHub |
| M-9 | Frontend | Páginas `/documents`, `/reports`, `/audit-log`, `/calendar`, `/notifications`, `/profile` sin guard server-side (hoy expuestas por C-1) | Medio | 3h |
| M-10 | Operación | Sin runbook de incidentes, sin guía de despliegue manual de emergencia, sin alertas de Sentry configuradas (no verificable en repo) | Medio | 8h |
| B-1 | Frontend | 13 warnings ESLint (2 `exhaustive-deps` en reportes → datos stale reales) | Bajo | 3h |
| B-2 | BD | `PasswordResetToken` sin limpieza de expirados; sin índice en `email` | Bajo | 1h |
| B-3 | Performance | Dashboard 342 kB First Load; diálogo de creación de casos (1.494 líneas) sin lazy-load | Bajo | 8h (ya en roadmap) |
| B-4 | Frontend | Polling de generación no cableado en UI (`getGenerationRequestStatus` sin consumidor) | Bajo | 3h (ya en roadmap) |
| B-5 | Docs | `ARQUITECTURA.md` dice "cierre abril 2026" — anterior a P3/P4, logger y CI fixes de julio | Bajo | 2h |

---

## 3. Detalle por capa

### 3.1 Arquitectura y diseño

**Estado general: sano, con deuda conocida y honesta.** El patrón server-actions-como-API con `authenticateUser() → permiso → tenantId` es consistente en los 15 módulos de `src/features/`. Los módulos compartidos sin `'use server'` (`persistence.ts`, `generation-request.ts`) siguen la convención documentada.

- **M-3 — Modelo de dos capas (masters vs. snapshots).** El schema materializa la dualidad: `Debtor`/`Creditor` son masters; `Case` embebe un snapshot del formulario definitivo (~250 columnas) y `Acreedor`/`Bien`/`ProcesoJudicial` son snapshots por caso. El problema: **conviven dos representaciones de acreedores** — la legacy (`Debt` → FK a master `Creditor`, con campos de acreedor denormalizados dentro de `Debt`) y la nueva (`Acreedor` snapshot). No hay en el código una regla de autoridad ("qué tabla manda para qué documento/pantalla"); el conocimiento vive en el placeholder-mapper de 2.877 líneas. Riesgo: divergencia silenciosa entre lo que muestra la UI (masters) y lo que imprime un documento legal (snapshots). *Resolución: documento corto de autoridad de datos + test de invariante que compare totales entre ambas capas al generar documentos.*
- **`Case` como god-model** (~250 columnas mezclando insolvencia, conciliación y apoyo con prefijos `conc*`/`apoyo*`). Funciona, pero cualquier query `SELECT *` arrastra todo y el modelo crecerá con cada trámite nuevo. Deuda aceptable a corto plazo; a mediano, extraer `conc*`/`apoyo*` a tablas 1:1.
- **Boundaries:** el split del placeholder-mapper (2.877 líneas) ya está en el roadmap (~4h) — sigue pendiente y es el archivo con mayor riesgo de regresión del sistema.
- **Escalabilidad multi-tenant:** shared-database/shared-schema con discriminador `tenantId` y tenants hard-coded en `src/lib/prisma.ts` (`'armonia' | 'constructores-paz'`). Para 2 tenants está bien; agregar un tercero requiere tocar código (el tipo `TenantId`, `tenantConfigs`, seeds). El modelo `ConciliationCenter` ya apunta a la dirección correcta; la migración de configuración hard-coded → BD queda como deuda declarada.

### 3.2 Seguridad

**C-1 — El gate de autenticación del middleware nunca se ejecuta.** [middleware.ts:61-69](src/middleware.ts:61): `publicRoutes` incluye `'/'` y el chequeo es `publicRoutes.some((route) => pathname.startsWith(route))`. **Todo pathname empieza con `/`**, así que la rama pública captura el 100% de los requests y retorna en la línea 86. Consecuencias verificadas:
  - El bloque de redirección a login (líneas 89-111), los checks de permiso por ruta (114-120) y los headers `x-user-*` (122-128) son **inalcanzables** (confirmado: ningún consumidor de `x-user-*` existe en `src/`).
  - Mitigante real: las server actions autentican por su cuenta y `/dashboard`, `/cases`, `/debtors`, `/creditors`, `/users` hacen guard server-side propio en la página. **Pero** `/documents`, `/reports`, `/audit-log`, `/calendar`, `/notifications` y `/profile` no tienen guard (M-9): un visitante no autenticado recibe el shell de la página (los fetches de datos fallan — no hay fuga de datos confirmada, sí superficie de ataque y UX rota).
  - Los gates de permiso por ruta (`getRoutePermissions()`) no se aplican en ninguna parte: un usuario autenticado sin `VER_AUDITORIA` puede navegar a `/audit-log` (la data está protegida por la action, la ruta no).
  - *Resolución: matchear rutas públicas con igualdad exacta (o `pathname === route || pathname.startsWith(route + '/')`), y agregar test de integración del middleware que pruebe una ruta protegida sin cookie.*
  - Nota adicional: [middleware.ts:17](src/middleware.ts:17) valida `JWT_SECRET` **en import** — contradice la convención del proyecto (lazy-init, patrón `auth.ts`/`email.ts`) y es el mismo patrón que rompió los builds entre abril y julio. Hoy compila porque el middleware no se evalúa en build, pero es una mina.

**C-2 — Registro abierto + identidad por email sin verificación = suplantación de deudor.** Cadena completa verificada:
  1. `/register` es público y [registerUser](src/features/auth/actions.ts:630) crea el usuario **sin verificación de email** con rol `Usuario`.
  2. El seed ([seed.ts:494-501](src/prisma/seed.ts:494)) da a `Usuario` los permisos `Ver casos como cliente`, `Ver casos`, `Ver deudores`, `Ver acreedores`, `Ver documentos`.
  3. El modo cliente resuelve la identidad por `prisma.debtor.findFirst({ where: { email: user.email, tenantId } })` ([case/actions.ts:116](src/features/case/actions.ts:116), [debtor/actions.ts:131](src/features/debtor/actions.ts:131), [creditor/actions.ts:118](src/features/creditor/actions.ts:118), calendar, etc.).
  4. → Cualquiera que conozca el email de un deudor real (dato no secreto) puede registrarse con ese email y ver su expediente: caso, deudas, bienes, documentos, audiencias. En una plataforma con casos legales reales de dos centros, esto es una brecha de confidencialidad directa.
  - *Resolución (en orden de costo): (a) cerrar el registro público (los centros crean usuarios vía admin, que ya existe con `mustChangePassword`); o (b) verificación de email obligatoria antes de activar la cuenta + vínculo explícito Debtor↔User (FK) en lugar de matching por string de email. La opción (a) es 2h y probablemente el modelo de negocio correcto para 2 centros; (b) es la solución completa si el portal de deudores es requisito.*

**Resto de la capa — lo que está bien:** RBAC re-consultado en BD en cada action (revocar un permiso surte efecto inmediato en datos, no solo al expirar el token); bcrypt cost 12; tokens de reset single-use con expiración 30 min y scope por tenant; open-redirect validado (`isValidRedirectPath` + tests); cookies httpOnly/secure/sameSite=lax; XSS en documentos resuelto en Session 1 (escape en punto de fusión + allowlist); inyección en queries de Drive sanitizada ([google-drive.ts:8](src/lib/google-drive.ts:8)); cron protegido con `timingSafeEqual` y 503 sin secreto; sin secretos hardcodeados (grep limpio); headers de seguridad completos (HSTS, X-Frame-Options, nosniff); CSRF cubierto por el modelo de server actions de Next (verificación de Origin) + sameSite.

- **A-1 — `npm audit`:** 20 vulnerabilidades (18 high, 2 moderate). Las que importan en runtime de producción: **`next@15.5.20`** (DoS en App Router usando Server Actions — este proyecto es 100% server actions —, SSRF en custom servers [no aplica en Vercel], cache confusion), `fast-uri`, `ip-address`, `nanoid`. El resto (brace-expansion, extract-zip vía puppeteer, image-size, js-yaml, exceljs→uuid) son devDeps o rutas de build. *Resolución: `npm audit fix` + subir Next a la patch release que cierra GHSA-m99w-x7hq-7vfj; el fix de exceljs es breaking (evaluar aparte).*
- **A-2 — Rate limiting decorativo en serverless.** [rate-limit.ts](src/lib/rate-limit.ts:12) es un `Map` in-memory por instancia; en Vercel cada lambda/instancia tiene su propio store y las instancias se reciclan. Un atacante distribuido (o simplemente la rotación natural de instancias) obtiene N×5 intentos de login. El propio archivo lo admite ("replace with Upstash Redis"). Con C-2 abierto esto es más grave. *Resolución: Upstash Redis (`@upstash/ratelimit`) para login/register/forgot/reset como mínimo.*
- **A-3 — Tokens en el body de respuesta.** [auth/actions.ts:248-249](src/features/auth/actions.ts:248) y [497-491](src/features/auth/actions.ts:490): `loginUser` y `refreshAccessToken` retornan `accessToken`/`refreshToken` al cliente además de setear cookies httpOnly. Esto anula el beneficio de httpOnly: cualquier XSS futuro puede exfiltrar la sesión desde el estado de React. *Resolución: quitar ambos campos del retorno; la UI no los necesita (la cookie viaja sola).*
- **A-6 — Sin revocación de sesiones.** JWT stateless de 24h, refresh de 7 días con `jti` que no se persiste ni consulta. Cambiar contraseña, desactivar un usuario o borrarlo no mata sesiones vigentes (borrar usuario sí, porque `authenticateUser` re-consulta; pero cambio de contraseña no). *Resolución mínima: campo `tokenVersion`/`passwordChangedAt` en `User` verificado en `authenticateUser`; o denylist de `jti` para refresh.*
- **M-5 — CSP** con `'unsafe-inline' 'unsafe-eval'` en `script-src` ([next.config.ts:37](next.config.ts:37)) — típico en Next sin nonces, pero debilita la defensa XSS; y **enumeración de usuarios** en `forgotPassword` (mensaje explícito "correo no registrado", [auth/actions.ts:797-804](src/features/auth/actions.ts:797)) — decisión deliberada del usuario según el comentario; dejar registrada como riesgo aceptado o revertir a mensaje neutro.
- **PII en logs:** la redacción automática ([logger.ts:84-98](src/lib/logger.ts:84)) cubre password/token/email/phone/cedula a 2 niveles de profundidad, y `sentry-scrub.ts` limpia cookies/headers/query. Bien diseñado. Hueco: los **305 `console.*` restantes** (135 en features) no pasan por redacción — cualquier objeto con PII que se loguee ahí va crudo a los logs de Vercel (M-4).

### 3.3 Base de datos

**Estado: schema válido, integridad razonable, operación inmadura.**

- **A-4 — Backup y DR: no existe evidencia.** Nada en el repo (docs, scripts, workflows) describe estrategia de backup, PITR, ni prueba de restore. Con borrado físico de casos (A-8) y datos legales reales, esto es la brecha operativa más seria. *Resolución: verificar/activar PITR en el proveedor de Postgres, documentar RPO/RTO, y ejecutar UNA restauración de prueba antes del go-live.*
- **M-1 — Índices faltantes.** Postgres no indexa FKs automáticamente. Sin índice: `Debt.caseId/creditorId/tenantId`, `Asset.caseId`, `Contact.creditorId`, `LegalProcess.caseId`, `Libranza.caseId`, `SuspendedService.caseId`, `Dependent.caseId`, `Document.tenantId/caseId` (solo tiene `[caseId, section]`, que sí cubre caseId), y en `Case`: nada sobre `tenantId` solo, `debtorId`, `operatorId`, `hearingDate` (consulta del cron de alertas y calendario). Los listados principales filtran por `tenantId` → seq scan. Con volumen actual no duele; con 2 años de expedientes, sí. También hace lentos los `deleteMany` de `deleteCase`. *Resolución: una migración de índices (~10 índices), sin riesgo.*
- **M-2 — Tipos débiles.** `Debt.interestRate Float` (todo lo demás monetario es `Decimal` — la nota del roadmap "los montos ya usan Decimal" es casi cierta, este es el residuo); `Payment.status`, `DocumentGenerationRequest.status/kind`, `Case.phase/type` como `String` libre sin enum de Prisma ni CHECK — un typo en código escribe un estado inválido sin error. *Resolución: enums de Prisma (o al menos zod en el borde, que ya existe parcialmente).*
- **Migraciones:** solo 2 (init de febrero + generation-request de julio); el `migrate resolve --applied` de baseline en deploy.yml es un hack razonable post-incidente. Sin down-migrations (Prisma no las genera) ni práctica documentada de "expand-and-contract" para cambios destructivos — aceptable si se documenta (ver M-10).
- **Concurrencia:** bien cubierta donde importa — lock parcial por `activeKey` con unique parcial nativo (verificado en schema [1004](src/prisma/schema.prisma:1004)), optimistic locking `Case.version`, transacción en `deleteCase`. `caseNumber` se genera con `findFirst` + prefijo y confía en el `@@unique([caseNumber, tenantId])` para la carrera — hay ventana de colisión que produce error de unique en vez de retry; menor.
- **B-2 —** `PasswordResetToken` crece sin límite (no hay job de limpieza) y no tiene índice sobre `email`.

### 3.4 Backend / API

- **Manejo de errores: consistente y sin fuga de stack traces.** Patrón `{ success, error }` con mensajes genéricos; verificado que los `catch` no serializan `error.stack` al cliente. Ojo: [deleteCase:1904](src/features/case/actions.ts:1904) y otros devuelven `error.message` crudo — un error de Prisma puede filtrar nombres de tablas/constraints al usuario (cosmético, no crítico).
- **Validación de entrada:** zod en los bordes (38 `parse` en case, 11 en debtor, etc.), incluidos límites. Los 5 módulos muestreados validan antes de tocar BD. Bien.
- **Idempotencia:** generación de documentos idempotente vía lock + retry con backoff en Drive ([retry.ts](src/lib/retry.ts)); recuperación de locks huérfanos >10 min. `createPayment` no tiene clave de idempotencia (doble-click = doble pago registrado) — mitigado parcialmente por UI; anotar como edge case de UAT.
- **Timeouts y servicios externos:** cron con deadline de 60s ✅. **`email.ts` (nodemailer) sin timeouts explícitos** (`connectionTimeout`/`socketTimeout` por defecto son largos) — un SMTP colgado dentro de una server action consume el tiempo de la función; y Gmail SMTP con app password es frágil para producción (límites de envío diarios, sin bounces). Considerar Resend/SES post-launch. Google Drive: sin timeout explícito pero con retry — aceptable.
- **Casos borde de negocio:** los cálculos de acuerdos/propuestas viven en el placeholder-mapper y `validation-rules.ts` con tests unitarios (447 en verde, incluye `documents/` y `cases/`). No audité la corrección legal de cada fórmula (fuera de alcance técnico); el riesgo estructural es M-3 (dualidad master/snapshot).

### 3.5 Frontend

- **M-9 — Guards por página inconsistentes** (detallado en C-1): 5 páginas con guard server-side, 6 sin él. Unificar con un helper o (mejor) arreglar el middleware y dejar los guards como defensa en profundidad.
- **Sesión expirada:** manejada — `use-session-timeout` (auto-logout 15 min + warning) y `use-auth` con refresh; los eventos esperados se loguean en info/debug según convención. Los hooks todavía tienen `console.log` con emojis ([use-session-timeout.ts:54](src/hooks/use-session-timeout.ts:54)) — parte de M-4.
- **B-1 — Los 2 warnings `exhaustive-deps` en reportes** ([case-status-report.tsx:72](src/app/reports/components/case-status-report.tsx:72), [payment-tracking-report.tsx:211](src/app/reports/components/payment-tracking-report.tsx:211)) son bugs reales de datos stale (el reporte no se refresca al cambiar filtros), no ruido de linter.
- **Validación cliente/servidor:** react-hook-form + resolvers zod compartiendo schemas de `features/*/schemas.ts` — consistencia por construcción. Bien.
- **A11y:** 19 refs `aria-*` en todo el proyecto (dato del roadmap, consistente con lo observado); Radix aporta semántica base pero las 5 pantallas núcleo no han tenido pasada a11y. Ya planificado Fase 3; no bloqueante para go-live con 2 clientes conocidos, sí para tesis/calidad.
- **Estados de carga/error/vacío:** existe `loading.tsx` global y patrones de toast (sonner); no se auditó pantalla por pantalla — incluir en el guion de UAT.

### 3.6 Multi-tenancy

- **Aislamiento de datos: es la capa mejor ejecutada del proyecto.** 476 referencias a `tenantId` en 22 archivos de features; el muestreo exhaustivo de `findUnique`/`update`/`delete`/`findFirst` no encontró **ninguna** query de datos de negocio sin scope. Las únicas sin `tenantId` son legítimas: lookups por PK de usuario autenticado, `role.findUnique` inmediatamente después de crear el rol, token de reset (validado contra tenant en la línea siguiente), y lookups de operador en el cron (el `operatorId` proviene de un scan ya scoped).
- **Tenant bleed en background/caché:** el job de generación hereda `tenantId` de la fila de solicitud ✅; el cron itera tenants explícitamente ✅; `revalidateTag('cases')` es global entre tenants — inofensivo (solo invalida caché, el refetch re-scopea) pero conceptualmente impreciso.
- **M-6 — Drive compartido:** una sola credencial OAuth y un solo árbol de carpetas para ambos centros; la separación es por carpeta (`ConciliationCenter.driveFolderName`). Un bug de resolución de carpeta subiría el documento de un centro al Drive del otro, y cualquier persona con acceso a la cuenta Google ve ambos centros. *Resolución: mínimo, documentar la gobernanza de esa cuenta (quién tiene acceso, 2FA); ideal, una unidad compartida por centro con permisos separados.*
- **Gobernanza de configuración por tenant:** hard-coded en `prisma.ts` + seeds (ver 3.1). La dualidad `.env.example` (que sugiere una BD por tenant: `DATABASE_URL_ARMONIA`/`_CONSTRUCTORES_PAZ`) vs. la realidad (una sola `DATABASE_URL` compartida, per-tenant URLs solo usadas por `scripts/run-prisma.ts`) es confusa y merece limpieza del `.env.example` (B-5).

### 3.7 Observabilidad y operación

- **A-7 — Sentry cliente probablemente bloqueado por la propia CSP.** `connect-src` ([next.config.ts:41](next.config.ts:41)) solo permite `'self'` + Google; el SDK de Sentry envía a `*.ingest.sentry.io` (o `.de`). Si el DSN está configurado, el navegador bloquea el envío y **ningún error de frontend llega a Sentry**. *Resolución: agregar el dominio de ingest a `connect-src`, o usar `tunnelRoute` de `@sentry/nextjs`. Verificar en prod con un error de prueba.*
- **Logging estructurado:** el diseño (niveles, JSON, redacción, requestId vía AsyncLocalStorage sembrado en `authenticateUser`) es bueno. Huecos: los 305 `console.*` (M-4) y que las actions no autenticadas que no llaman `seedRequestContextFromHeaders` pierden correlación (login/register sí lo llaman; verificado).
- **Trazabilidad requestId:** funciona edge→node vía header `x-request-id` ✅. Los headers `x-user-*` del middleware son código muerto (nadie los consume) — limpiar junto con C-1.
- **Alertas:** existen alertas *de negocio* (cron: audiencias próximas, pagos vencidos). No hay evidencia de alertas *operativas* (Sentry alert rules, uptime monitoring, fallo del cron). El cron devuelve JSON con `totalErrors` pero nadie lo mira si falla. *Resolución: alerta de Sentry sobre `cron.alerts.*`, y un uptime check externo al endpoint del cron o a un `/api/health` (que hoy no existe).*
- **Métricas:** Vercel Analytics + Speed Insights instalados; sin métricas de negocio (casos creados/semana, generaciones fallidas). No bloqueante.

### 3.8 CI/CD y despliegue

- **PR checks (pr.yml): completos** — lint, tsc, jest, build, audit informativo. ✅
- **M-8 —** `deploy.yml` se dispara en push a `main` y **no corre tests ni tsc** — la calidad depende de que todo entre por PR. Si la branch protection de GitHub no exige PR + checks (no verificable desde el repo), un push directo despliega código sin testear. *Resolución: verificar branch protection; barato agregar `npx jest --ci` al deploy.yml como cinturón.*
- **A-5 — Migraciones antes del build, sin rollback.** deploy.yml aplica `prisma migrate deploy` y *después* construye; si el build/deploy falla, la BD queda adelantada respecto del código en producción. No hay estrategia de rollback documentada (ni instant-rollback de Vercel mencionado, ni práctica expand-contract para migraciones). No hay health check ni smoke test post-deploy. *Resolución: documentar runbook de rollback (Vercel "promote previous deployment" + regla "migraciones solo aditivas"), agregar `/api/health` (checa BD) y un curl post-deploy en el workflow.*
- **Ambientes:** dev→preview, main→production, secrets vía `vercel pull` — correcto post-incidente de julio. No existe staging con datos aislados; preview comparte las env de development. Aceptable, documentarlo.
- **Detalle:** el paso `git commit --amend --reset-author` en deploy.yml funciona pero es frágil (fallaría en repos con firmas obligatorias); dejar como está con nota.

### 3.9 Testing

- **Suite actual: 447 tests, 27 suites, todos verdes, ~6s.** Cubre: auth (registro, RBAC, reset), seguridad dedicada (`tests/security/`: hardening, input validation, password policy, rate limit, redirect), documentos, casos, cron, observabilidad, form-request. Integración: flujo de creación de caso y drive-centro. E2E: auth y cases con Postgres real en CI. Es un balance sano unit/integration/E2E para el tamaño del proyecto.
- **Huecos concretos:**
  - **M-7 — Cero tests de aislamiento cross-tenant** (el riesgo #1 del diseño): un test de integración que cree datos en tenant A y verifique que las actions con sesión de tenant B no los ven. Alta relación valor/costo.
  - **Ningún test habría atrapado C-1** (middleware): falta test del middleware con rutas protegidas/públicas.
  - Flujos financieros: hay tests de validación de formularios y mappers; no vi tests que fijen los **cálculos** de propuesta de pago/quitas contra valores esperados conocidos (golden tests). Para documentos legales, un golden-file test del HTML generado por trámite detectaría regresiones del mapper de 2.877 líneas.
  - Carga: k6 bien diseñado (smoke/average/peak) pero no está en CI ni hay resultados registrados — no hay evidencia de que se haya corrido nunca contra un entorno real (ver 3.10).
  - Test de invariantes de plantillas (P9 del roadmap) sigue pendiente — sigue siendo el quick win #1.
- **Cobertura numérica:** no ejecuté `--coverage` (tarda y el número engaña); el hueco relevante es cualitativo (arriba).

### 3.10 Performance

- **Generación de documentos:** P1 del roadmap sigue abierto — creación de caso lanza **un Chromium por documento** (~8 documentos) aunque `batchHtmlToPdf` ya existe; en serverless esto es el punto de degradación más probable bajo carga (memoria/tiempo de lambda). Mitigado porque ahora corre en background (`after()`), pero sigue costando duración de función y puede exceder límites con casos grandes.
- **Queries:** no encontré N+1 flagrantes en los listados muestreados (usan `include` correctamente); el costo real futuro es M-1 (seq scans por falta de índices) y `authenticateUser` que agrega 2 queries (tenant + user/role/permissions) a cada action — aceptable, cacheable después.
- **Frontend:** dashboard 342 kB First Load y diálogo de creación de 1.494 líneas viajando con `/cases` — ya cuantificado en roadmap (B-3).
- **k6 sin ejecutar (M-7):** antes de septiembre correr al menos `average` (10 VUs) contra preview, con especial atención a login (bcrypt cost 12 × serverless cold start) y a la creación de casos con generación.

### 3.11 Documentación

- **Fortaleza:** el nivel de documentación (9 docs, CLAUDE.md operativo, CHANGELOG, decisiones fechadas) está muy por encima de lo normal para un proyecto de este tamaño.
- **B-5 — Desactualizaciones:** `ARQUITECTURA.md` declara "cierre abril 2026" — anterior al lock P3/P4, al logger de Fase 2.1 y al fix del pipeline; el diagrama menciona "API Routes (download, auth callback)" que no coinciden con el único route handler actual (`/api/cron/alerts`) — hay rutas descritas que no existen o ya no existen. `.env.example` sugiere arquitectura BD-por-tenant que no es la real, y menciona CockroachDB y `NEXTAUTH_*` (¿se usa NextAuth? No — el auth es JWT propio; esas vars parecen residuo).
- **M-10 — Documentación operativa faltante:** no existe runbook de incidentes (qué hacer si cae la BD / Drive / SMTP / deploy roto), guía de despliegue manual de emergencia (deploy sin GitHub Actions), ni procedimiento de rotación de secretos (el refresh token de Drive expira/se revoca y hoy la receta vive solo en la sección 9 de ARQUITECTURA.md).

### 3.12 Cumplimiento normativo (Colombia)

- **Ley 1581/2012:** el consentimiento está modelado (`autorizacionTratamientoDatos`, `autorizacionConsultaCentralesRiesgo`, etc. en `Case`) ✅. Faltan: **(a)** política de tratamiento de datos visible en la app (aviso de privacidad en registro/login); **(b)** procedimiento para derechos ARCO (consulta/rectificación/supresión) — hoy "supresión" solo puede cumplirse con `deleteCase` físico, que a la vez contradice retención documental; **(c)** registro de bases de datos ante la SIC si aplica a los centros (decisión del negocio, no del código).
- **A-8 — Retención vs. borrado:** los centros de conciliación tienen obligaciones de conservación de actas/expedientes (el marco aplicable a conciliación exige archivo por años). `deleteCase` borra físicamente caso + deudas + documentos (filas; los archivos de Drive quedan huérfanos — inconsistencia adicional). El soft-delete de Fase 3 deja de ser "mejora" y pasa a ser requisito de compliance: **recomiendo subirlo a pre-launch o, como mínimo, restringir `ELIMINAR_CASOS` a un rol de administrador y dejar constancia en auditoría** (el audit log del delete ya existe ✅).
- **No repudio en documentos:** los PDFs generados no llevan hash ni sello de tiempo; el audit log registra la generación (quién/cuándo) y las versiones se archivan con `supersededById` ✅ — trazabilidad razonable. Firma electrónica/estampado cronológico: mejora futura, no bloqueante (los documentos se firman físicamente en audiencia).
- **PII a terceros:** datos de deudores fluyen a Google (Drive) y Gmail (SMTP) — para 1581 esto es transmisión a encargado en EE.UU.; debería estar cubierto en la política de tratamiento y en los contratos con los centros.

### 3.13 Preparación para UAT y lanzamiento

Para que el UAT sea ejecutable y significativo falta:
1. Resolver C-1 y C-2 primero (si no, el UAT valida un sistema con la puerta abierta).
2. **Entorno de UAT definido:** hoy preview comparte env de development; decidir si el UAT corre sobre preview con BD propia sembrada o sobre producción con tenant de prueba (recomiendo lo primero; un tenant de prueba en prod contamina datos reales).
3. **Guion de UAT por rol** (operador, conciliador, cliente/deudor si sobrevive el modo cliente): crear caso completo → generar los 8 documentos → registrar pagos → audiencia → acta → cierre; incluir los estados de error (generación fallida, Drive caído).
4. Datos semilla realistas por centro (el seed actual es de fixtures).
5. Wiring del polling de generación en UI (B-4) — sin él, el usuario de UAT no ve el estado del background job y reportará "no pasó nada".

---

## 4. Plan de acción priorizado (rumbo a septiembre)

**Semana 1 — Bloqueantes de seguridad (secuencial, ~3 días):**
1. C-1: fix del matching de `publicRoutes` + test de middleware + quitar headers `x-user-*` muertos + lazy-init de `JWT_SECRET` en middleware. *(medio día)*
2. **Decisión tuya requerida →** C-2: ¿cerrar registro público (opción a, 2h) o verificación de email + FK Debtor↔User (opción b, 2 días)? Mi recomendación: (a) ahora, (b) si el portal de deudores es objetivo de la tesis.
3. A-3: dejar de devolver tokens en el body. *(1h)*
4. A-1: `npm audit fix` + bump de Next patch; correr suite completa. *(2h)*
5. M-9: guard server-side en las 6 páginas sin él (defensa en profundidad tras C-1). *(3h)*

**Semana 2 — Operación y resiliencia (paralelizable):**
6. A-4: verificar PITR/backups del proveedor Postgres + **una restauración de prueba documentada**. *(1 día; puede hacerlo otra persona)*
7. A-5 + M-10: `/api/health`, smoke test post-deploy en deploy.yml, runbook de rollback e incidentes. *(1–2 días)*
8. A-7: CSP + Sentry tunnel; disparar error de prueba cliente y servidor y verificar llegada. *(2h)*
9. A-2: Upstash Redis para rate limiting de auth. *(1 día)* — **decisión tuya:** agregar dependencia externa (gratis en tier hobby) vs. aceptar el riesgo con registro cerrado.
10. M-8: verificar branch protection en GitHub (PR + checks obligatorios para main).

**Semana 3 — Robustez de datos y pruebas (paralelizable):**
11. M-1: migración de índices. *(3h)*
12. M-7: test de aislamiento cross-tenant + golden test de un documento por trámite. *(1–2 días)*
13. k6 `average` contra preview; registrar resultados. *(medio día)*
14. A-6: `passwordChangedAt` en User + check en `authenticateUser`. *(1 día)*
15. Quick wins del roadmap que siguen vigentes: test de invariantes de plantillas (P9), limpiar 13 warnings ESLint (los 2 `exhaustive-deps` primero), wiring del polling en UI.

**Semana 4 — Compliance y UAT:**
16. **Decisión tuya requerida →** A-8: ¿soft-delete pre-launch (20h) o restricción de `ELIMINAR_CASOS` a admin + riesgo aceptado documentado (2h) con soft-delete en Fase 3? Legalmente recomiendo al menos la restricción ya.
17. Aviso de privacidad / política de tratamiento en la app (texto lo aportan los centros). *(1 día de integración)*
18. UAT con guion por rol sobre preview con BD sembrada.
19. B-5: sincronizar ARQUITECTURA.md y `.env.example` con la realidad.

**Explícitamente NO urgente para septiembre** (deuda aceptada con plan): refactor console→logger completo (M-4, hacerlo incremental), split del placeholder-mapper, type-safety de documentos, code-split del dashboard, batch de Chromium (P1 — mitigado por background), a11y (Fase 3), enums de BD (M-2).

---

## 5. Checklist Go-Live

**Seguridad**
- [ ] ❌ Middleware protege rutas realmente (C-1 corregido + test)
- [ ] ❌ Registro público cerrado o con verificación de email (C-2)
- [ ] ❌ Tokens fuera del body de respuesta (A-3)
- [ ] ❌ Next.js sin CVEs high conocidos (A-1)
- [ ] ❌ Rate limiting efectivo en login/reset (A-2) — o riesgo aceptado por escrito con registro cerrado
- [ ] ✅ Server actions: auth + permiso + tenantId en todas (verificado en esta auditoría)
- [ ] ✅ XSS en documentos escapado + allowlist
- [ ] ✅ Secretos solo en env vars; cron con token constant-time

**Datos y operación**
- [ ] ❌ Backup automático verificado + una restauración de prueba ejecutada (A-4)
- [ ] ❌ Runbook: rollback de deploy, caída de BD/Drive/SMTP, deploy manual de emergencia (M-10)
- [ ] ❌ `/api/health` + smoke test post-deploy (A-5)
- [ ] ❌ Índices sobre FKs y tenantId (M-1)
- [ ] ❌ `ELIMINAR_CASOS` restringido a admin (mínimo de A-8)
- [ ] ✅ Migraciones automáticas en deploy (funcionando desde julio)

**Observabilidad**
- [ ] ❌ Error de prueba cliente y servidor visible en Sentry (A-7)
- [ ] ❌ Alerta configurada para fallos del cron y errores de generación
- [ ] ✅ Logging estructurado con requestId y redacción de PII en rutas críticas

**Calidad**
- [ ] ✅ 447 tests verdes, tsc limpio, pipeline PR completo
- [ ] ❌ Branch protection en main verificada (M-8)
- [ ] ❌ Test de aislamiento cross-tenant (M-7)
- [ ] ❌ k6 `average` corrido contra preview con resultados aceptables
- [ ] ❌ UAT ejecutado con guion por rol y firmado por ambos centros

**Compliance**
- [ ] ❌ Aviso de privacidad / política de tratamiento visible (Ley 1581)
- [ ] ❌ Decisión documentada sobre retención vs. borrado de expedientes (A-8)
- [ ] ✅ Consentimientos modelados en el formulario; audit log de mutaciones

---

*Auditoría de solo lectura: no se modificó código, BD, git ni dependencias. Este archivo queda sin commitear para tu revisión.*
