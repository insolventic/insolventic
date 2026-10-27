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

### Prohibido: trailers de coautoría automática

**Nunca** añadir trailers de coautoría automática ni firmas de la herramienta con la que se escribe el commit. En concreto, y sin ser lista exhaustiva:

```
Co-Authored-By: <herramienta> <...>   ← NO
Generated with <herramienta>          ← NO
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
2. El cuerpo **no** contiene ningún trailer de coautoría automática.

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

- **Operativa.** El plan Hobby de Vercel bloquea el deployment si el autor del commit HEAD no está vinculado a la cuenta dueña del proyecto (ver `docs/DECISIONES.md` §Iteración 3 y el issue #7). Un autor equivocado en la punta = deploy `Blocked`.
- **De registro.** Es un proyecto de tesis con casos legales reales en producción. El historial debe atribuir el trabajo a personas identificables, no a la herramienta con la que se escribió.

## Convenciones

- Toda server action: `authenticateUser()` → check de permiso (`P.*`) → queries scoped por `tenantId`.
- Datos de usuario que terminan en HTML de documentos: escapar con `escapePlaceholder` (placeholder-mapper.ts); los placeholders HTML del sistema van en `HTML_PLACEHOLDERS_ALLOWLIST`.
- Env vars: validar en el primer uso, **nunca en import** — `next build` recolecta page data sin secrets (`vercel pull` excluye las vars sensitive). Patrón: `email.ts`, `auth.ts`.
- Módulos compartidos entre actions van en archivos sin `'use server'` (ej. `persistence.ts`, `generation-request.ts`).

### Formularios: los errores de validación se muestran solo después de la acción del usuario

Regla de producto (2026-10-27). Un campo muestra su error solo si el usuario **salió de él** (blur) o **intentó avanzar o guardar**. Nada valida al montar, y cerrar y reabrir un diálogo lo deja limpio (errores, "tocado" y valores). Cómo se cumple:

- **react-hook-form con `mode: 'onTouched'`**: valida al primer blur y desde ahí en cada cambio, así el error se va mientras se corrige. Nunca `mode: 'all'` / `'onChange'`, ni `trigger()` en un efecto de montaje.
- **Reset en cada apertura**: el `useForm` vive fuera de `DialogContent`, así que el estado sobrevive al cierre. Patrón: `useEffect(() => { if (open) form.reset(...) }, [open, ...])` — en alta a los `defaultValues`, en edición a la entidad. Resetear solo tras guardar con éxito, o con la entidad como única dependencia, deja los errores esperando a la próxima apertura.
- **`type="button"` en todo botón que no envía dentro de un `<form>`**: sin `type` es submit implícito. Ojo con los componentes de sección que se renderizan dentro de un form ajeno: `DebtorSection` vive en el form del alta **y** de la edición de casos.
- **`key` distinta en botones que se intercambian en el mismo lugar** (Siguiente ↔ Crear Caso): si React reutiliza el `<button>` y le cambia el `type` a submit en mitad del clic, el navegador envía el formulario. jsdom no lo reproduce; lo cubre el E2E `tests/e2e/case-wizard-errores.e2e.test.ts`.
- **Wizard de casos**: "Siguiente" valida la pestaña que se deja (mensajes + ícono de la pestaña) sin toast y **sin bloquear** el avance; el toast "Campos incompletos" es solo del envío. Un campo que se llena por código (deudor por `setValue`, operador por Select, deuda total calculada) se revalida si ya mostraba error.

**Hallazgo (2026-10-27, `fix/errores-solo-despues-de-accion`)**: los errores "al abrir" que se veían en producción no venían de validar al montar sino de **envíos involuntarios** (el botón "+" de deudor y el "Siguiente" de la penúltima pestaña) y de **estado no reiniciado** al reabrir. Detalle, tabla del barrido y lo que quedó fuera en la descripción del PR de esa rama. Tests: `create-case-dialog-errores.test.tsx`, `dialogos-errores-tras-accion.test.tsx`, `debtor-section-crear-deudor.test.tsx`, `payment-dialog-errores.test.tsx`.

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

## Trampas — leer antes de tocar estas áreas

Conocimiento que impide reintroducir bugs ya cerrados, violar una decisión deliberada o malinterpretar el estado del CI. El detalle completo de cada una está en `docs/ROADMAP.md` y `docs/DECISIONES.md`.

**Si abrís un PR apilado o lees el CI** — `pr.yml` y `e2e.yml` tienen `on: pull_request: branches: [dev, main]`, así que un PR cuya base es una rama de feature **no dispara ninguno de los dos**: `quality-checks` y `playwright` no fallan, **no existen**. Un check ausente o `skipped` se lee como verde de un vistazo (pasó con `test:db` en `#127` por el rate limit de Docker Hub, y con el stack `#133`/`#134`) — **confirmar que el check corrió, no que no está rojo**. Workaround: `gh workflow run e2e.yml --ref <rama>`; `pr.yml` no tiene `workflow_dispatch`, así que sus pasos van en local (`npm run lint`, `npx tsc --noEmit`, `npx jest --ci`, `npm run build`). Detalle: `docs/ROADMAP.md` §Quick Wins 7 y 8.

**Si mergeás un stack de PRs** — mergear el de abajo con `--delete-branch` **cierra** el de arriba (GitHub no lo retargetea), y un PR cerrado cuya base ya no existe no se puede reabrir ni retargetear: retargetear el de arriba a `dev` **antes** de mergear el de abajo. Cambiar la base no vuelve a disparar los workflows (`pull_request: edited` no está en el set por defecto); lo que dispara es un push, y tras un squash merge hay que rebasear igual: `git rebase --onto origin/dev <viejo-tip-del-padre>` + `push --force-with-lease`.

**Si tocás un campo de dinero** — `parseFloat("1.500.000")` da **1.5**. No alcanza con pasar el input a `type="text"`. Reusar `parsearMonto` (`src/features/case/monto.ts`) y `MoneyInput` (`src/components/ui/money-input.tsx`), **no reescribirlos**. Es el bug de `#136`, que vivía en tres capas y solo lo cerró un test que llega hasta Prisma. Quedan 2 campos sin normalizar (`case-details-dialog/payment-tracking-section.tsx`, `reports/components/payment-tracking-report.tsx`); los otros `type="number"` del proyecto (`dependents`, `approvalPercentage`, el `XAxis` de Recharts en `dashboard-charts.tsx`) **no** son dinero y no llevan separador.

**Si corrés lint y ves los 2 `eslint-disable-next-line` de `exhaustive-deps` en reportes** — están ahí **a propósito**, con la razón escrita al lado. Agregar `fetchReport` a las deps da bucle infinito de fetches (efecto → `setLoading` → re-render → efecto), y memoizarlo con `useCallback` tampoco es neutro: el reporte refetchearía ante cada cambio de fecha, cuando la pantalla tiene un botón "Filtrar" explícito para que el refetch lo decida el usuario. **No arreglarlos.** `npm run lint` debe quedar en 0 warnings.

**Si tocás migraciones o `schema.prisma`** — hay una deriva conocida: el replay desde cero queda a ~30 statements del schema (3 tablas, 5 columnas, 14 índices, 7 FKs, 1 DropEnum), objetos que existen en `schema.prisma` y en la base real porque los creó algún `db push`, pero que **ninguna migración crea**. 🔴 **Bloqueado**: necesita acceso a Neon y decidir entre migración de catch-up idempotente o baseline/squash del historial. No afecta producción ni el camino feliz; muerde al restaurar un backup a una base nueva o levantar un entorno desde cero. Lo sostiene `tests/db/migraciones-desde-cero.db.test.ts` con la brecha inventariada en `BRECHA_CONOCIDA`, patrón **bidireccional**: si cerrás la deriva el test falla por "ya no está roto", así que hay que actualizarlo en el mismo cambio. El `statements: 30` no es literal: cuenta líneas `^--` de `migrate diff --script`. Detalle: `docs/ROADMAP.md` §Fase 3.

**Si tocás generación de documentos** — el anti-duplicados es un lock en BD: `DocumentGenerationRequest.activeKey` (`"{caseId}:{kind}"` mientras está activa, `NULL` al terminar — los NULL no colisionan en Postgres, sin triggers); los locks huérfanos >10 min se liberan solos. **No proponer Redis, BullMQ ni cola externa**: Vercel serverless no tiene workers persistentes y la máquina de estados en BD fue la decisión deliberada. El webhook con verificación de firma también se descartó por YAGNI (sin consumidores externos); las notificaciones van in-app. Detalle: `docs/DECISIONES.md` §Iteración 2.

**Si tocás el escapado de placeholders** — el escapado va en el **punto de fusión** de `mapCaseToPlaceholders` (safe-by-default), **no valor por valor**: son ~300 claves escalares en ~20 sub-mappers y escapar una por una garantizaba omisiones futuras. No mover el escapado hacia los call-sites.

**Si buscás los modelos `Acreedor` / `Bien` / `ProcesoJudicial`** — se borraron a propósito el 2026-10-02, tras verificar 0 filas en producción, que ninguna plantilla consumía sus placeholders y que nunca tuvieron UI de captura. **No recrearlos**: `Creditor` / `Asset` / `LegalProcess` es la única fuente si algún día se construye el Formulario Definitivo de verdad.

**Si tocás `deleteCase`** — hoy borra **en cascada**, sin soft-delete. Es un sistema con expedientes legales reales en producción: no hay recuperación. El soft-delete está en Fase 3, sin hacer.

**Si tocás deploy o `next.config.ts`** — no hay workflow de deploy **a propósito**: `deploy.yml` se eliminó y el deploy lo hace solo la integración nativa Vercel↔GitHub. `serverExternalPackages: ['@opentelemetry/api']` es load-bearing — sin eso el build rompe con `ENOENT @opentelemetry/api`.

**Dos cosas que no hay que hacer**, porque no corresponden al código real: migrar Float→Decimal (los montos ya usan `Decimal`) y hacer split de `schema.prisma` (tiene 1.041 líneas, no 2.516 — no urge).

## Punteros — qué hay en cada archivo y cuándo leerlo

| Archivo                                                               | Qué tiene                                                                                                                                             | Cuándo leerlo                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/MAPA.md`                                                        | dónde está cada cosa: módulo por dominio, UI por ruta, camino crítico de documentos, dónde va cada tipo de test, índice de los 57 archivos de `docs/` | **antes de buscar en el código**, y al empezar en un área nueva                |
| `docs/DECISIONES.md`                                                  | decisiones de arquitectura por iteración, con su porqué y sus non-goals                                                                               | **antes de proponer un cambio estructural** o de reabrir algo ya decidido      |
| `docs/ROADMAP.md`                                                     | Fase 2, Fase 3 y Quick Wins, con el detalle completo de cada trampa de arriba                                                                         | antes de tomar un pendiente, o cuando una trampa de arriba necesita su detalle |
| `docs/RUNBOOK.md`, `RUNBOOK_ENV_VARS.md`, `RUNBOOK_ROTACION_DRIVE.md` | operación, variables de entorno, rotación de credenciales de Drive                                                                                    | antes de tocar producción o credenciales                                       |
| `docs/CHECKPOINT_2026-10-09.md`                                       | estado más reciente; incluye que el branding por centro nunca eligió por centro (`Case.tenantId` es un cuid, no el slug)                              | al retomar el proyecto tras una pausa                                          |
