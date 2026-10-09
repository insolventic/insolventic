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
npm test               # suite completa (1448 tests en 97 suites — medido en dev el 2026-10-01, commit f233b24; excluye tests/db y tests/e2e)
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
- ~~Reintentos en la ruta manual de generación (`batchGenerateDocuments`)~~ → 🟢 **Resuelto.** La subida a Drive (`uploadDocumentToCase`) ahora usa `withRetry`, mismo patrón que la ruta automática. La creación de subcarpeta sigue el patrón de `createDocumentSubfolder` (degrada a la carpeta del caso si falla, sin reintento propio — no vale la pena bloquear la subida por eso). Los dos `console.*` que tocaba este cambio pasaron a `logger`.

### Fase 3 (Q3, ~32h)

- [ ] Soft-delete para expedientes legales (borrado físico→lógico, capacidad de recuperación; hoy `deleteCase` borra en cascada) — ~20h
- [ ] Auditoría de accesibilidad (19 refs `aria-*` en todo el proyecto → pasada semántica en las 5 pantallas núcleo) — ~6h
- [ ] **Cerrar la deriva entre el historial de migraciones y `schema.prisma`** — ~6h · 🔴 **bloqueado: necesita acceso a Neon + decidir el camino**

  Medido el 2026-10-08 al arreglar el replay desde cero (#122, `fix/migraciones-desde-cero`). Con la cadena de migraciones corriendo contra una base vacía, el schema reconstruido sigue a **30 statements** de `src/prisma/schema.prisma`:

  | Qué falta                                                        | Cuánto |
  | ---------------------------------------------------------------- | ------ |
  | Tablas enteras (`ConciliationCenter`, `audit_logs`, `payments`)  | 3      |
  | Columnas (`Case`, `Debtor`, `Document`, `User`, `notifications`) | 5      |
  | Índices                                                          | 14     |
  | Foreign keys                                                     | 7      |
  | DropEnum                                                         | 1      |

  Son objetos que viven en `schema.prisma` **y en la base real** (los creó algún `db push`) pero que **ninguna migración crea**. Es la misma clase de deriva que el incidente de las 29 columnas `apoyo_*` (`docs/CHECKPOINT_2026-09-09.md` §8), vista desde el otro lado: allá faltaban en la base, acá faltan en el historial.

  **No afecta producción ni el camino feliz.** Muerde en los dos escenarios que ya rompió #122: restaurar un backup a una base nueva (A-4, que sigue sin probarse) y levantar un entorno desde cero.

  **Las dos salidas, y por qué no se elige sola:**
  - _Migración de catch-up idempotente_ (`IF NOT EXISTS` en todo): no-op en producción, rellena desde cero. Más conservadora, pero deja el historial con una migración de "parche" que no refleja ninguna intención de diseño.
  - _Baseline/squash del historial_: es lo que Prisma recomienda para exactamente esta situación. Más limpio a futuro, pero necesita `migrate resolve --applied` contra cada base ya migrada — y un error ahí sí toca producción.

  Las dos necesitan Neon, así que la decisión se toma cuando haya acceso y ventana. **No decidir no es gratis pero sí es seguro:** el estado actual es estable mientras nadie reconstruya una base.

  **Qué lo sostiene mientras tanto:** `tests/db/migraciones-desde-cero.db.test.ts` corre `migrate deploy` real contra una base vacía por corrida y tiene la brecha inventariada en `BRECHA_CONOCIDA`, con el patrón bidireccional de `pendientes-conocidos.ts`: si alguien la cierra, el test falla por "ya no está roto"; si aparece deriva nueva, falla por "apareció algo". Ojo con leer el `statements: 30` como literal: cuenta líneas `^--` de `migrate diff --script`, que es un proxy del número de statements, no el número.

### Quick Wins (<4h c/u, paralelizables)

1. Test de invariantes de plantillas (P9): recorrer `ALL_TEMPLATES` + `fs.access(getTemplatePath(t))` — detecta renames rotos en CI, no en producción
2. ~~**Limpiar los 8 warnings ESLint preexistentes**~~ → 🟢 **Resuelto el 2026-10-09 en `#124`, y no eran 8 sino 23.** `npm run lint` queda en 0. No fueron todos borrados triviales: **tres escondían algo**.
   - **`available` (`placeholder-mapper.ts`)**: duplicado **stale** de lo que `RECURSOS_DISPONIBLE` ya calcula inline, y **omitía `otherIncomeAmount`** — que el cálculo vivo sí incluye. Nunca llegó a imprimir nada porque no tenía consumidores, pero el primero que lo hubiera usado habría puesto una cifra equivocada en un documento que se radica. Bug latente, no activo.
   - **`verb` (`notification/actions.ts`)**: sin consumidor porque el mensaje se arma en voz pasiva ("Se ha creado el caso X"). Se borró la variable **y los 15 campos `verb` del mapa**, que no los leía nadie. Código muerto, no bug.
   - **Los 3 de `debts` (`cesacion-pagos-section`, `payment-proposal-section`)**: `useWatch(...) || []` como dependencia de `useMemo`. Fix real (`useMemo(() => debtsRaw ?? [], [debtsRaw])`), no silenciado. **Pero el diagnóstico original estaba sobredimensionado y conviene no repetirlo:** `[]` es truthy, así que con el array presente `||` devolvía **la misma referencia** — y el form inicializa `debts: []` en los defaults (`create-case-dialog.tsx:247`, `:305`; `edit-case-dialog.tsx:117`), de modo que el fallback casi nunca disparaba y los memos **sí memoizaban**. Lo que se sacó fue un footgun condicional, no un bug vivo. Verificado además que en RHF 7.65 `useWatch` clona profundo en cada emisión, así que tampoco puede devolver el mismo array mutado (el riesgo que el PR temía).

   Los 2 `exhaustive-deps` de reportes **no se "arreglaron" a propósito**: quedaron con `eslint-disable-next-line` y la razón escrita en el código. Agregar `fetchReport` a las deps da bucle infinito de fetches (efecto → `setLoading` → re-render → efecto), y memoizarlo con `useCallback([dateFrom, dateTo])` tampoco es neutro: el reporte pasaría a refetchear ante cada cambio de fecha, cuando la pantalla tiene un botón "Filtrar" explícito para que el refetch lo decida el usuario.

   Cobertura nueva: `tests/unit/components/cesacion-pagos-recalculo.test.tsx` (4 casos) — el componente no tenía ninguna. Tiene dientes: forzando el memo a deps vacías fallan exactamente los 2 casos de regresión. Queda pendiente, anotado en `#124`, agregarle el caso de **mutación anidada** (`debts.0.daysOverdue`), que es la ruta que usa el formulario en producción; hoy solo cubre reemplazo del array completo.

3. Lazy-load del diálogo de creación de casos (1.494 líneas viajan con la ruta `/cases`)
4. Wiring UI del polling de generación (`documents-section` → `getGenerationRequestStatus`)
5. ~~**Aclarar en el schema los 3 pares de modelos EN/ES**~~ → 🟢 **Resuelto el 2026-10-02, borrando el lado muerto en vez de documentarlo.** Identificado 2026-08-12 como "no son duplicados" (`Creditor`/`Asset`/`LegalProcess` registro general vs. `Acreedor`/`Bien`/`ProcesoJudicial` snapshot del Formulario Definitivo). Una auditoría transversal formulario → plantillas encontró que el segundo lado del par nunca tuvo UI de captura en producción (las 6 secciones del wizard que los alimentaban — V, VI, VII, IX, X, XII — quedaron huérfanas tras una reestructuración del wizard y `#59` solo recogió los componentes ya inalcanzables) y que **ninguna plantilla consume ninguno de sus placeholders** (verificado exhaustivamente, incluidas las ~92 claves de `mapFormularioDefinitivoFields` para las 12 secciones, no solo V/VI/VII). Verificado además contra producción real (Neon, solo lectura): las 3 tablas tenían 0 filas. Se borraron los 3 modelos, su migración (`DROP TABLE`, con guarda que aborta si alguna base tiene filas), los 3 schemas Zod, el nested-create de `createCase`, las 4 funciones del mapper y las 3 cards de solo lectura. El `Creditor`/`Asset`/`LegalProcess` vivo sigue siendo la única fuente para el Formulario Definitivo si algún día se decide construirlo de verdad.

6. ~~**Cachear `~/.cache/ms-playwright` en `e2e.yml`**~~ → 🟢 **Resuelto.** Identificado 2026-10-01: el workflow corría `playwright install --with-deps chromium` en cada ejecución, sin caché, y ese paso se venía degradando (28 s → 79 s → 228 s → 572 s en cuatro corridas consecutivas, y en la quinta se comió el `timeout-minutes: 25` del job antes de correr un solo test). `actions/cache` sobre `~/.cache/ms-playwright`, clave por versión de `@playwright/test`; en cache-hit se salta la descarga del browser y corre solo `playwright install-deps` (las dependencias de sistema no viven en esa carpeta, así que el cache no las cubre).

> Nota: dos items del roadmap original se descartaron por no corresponder al código real: la migración Float→Decimal (los montos ya usan `Decimal`) y el split del schema Prisma (tiene 1.041 líneas, no 2.516 — no urge).

## Referencias

- Auditoría integral: `docs/AUDITORIA_INSOLVENTIC_2026-07-11.md`
- Auditoría del módulo de documentos (P1–P9): `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`
- Arquitectura general: `docs/ARQUITECTURA.md`
- Hallazgos de calidad de la ronda del formulario maestro: `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`
- Plan: listar todos los acreedores en la Solicitud (bloqueado por decisión legal): `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`
