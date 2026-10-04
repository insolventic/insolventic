# Plan y Reporte de Pruebas — INSOLVENTIC

> Estado: **27 suites / 447 tests ✅** (cifra de suites y de casos individuales verificada contra los archivos reales en `tests/` — ago-2026). El inventario de la sección 3 fue reconstruido en esta pasada: la tabla anterior (abril 2026, 23 suites) tenía rutas que ya no existen — varias suites se reorganizaron entre abril y julio (`tests/unit/case/` → `tests/unit/cases/`, CRUD de acreedor/deudor/usuario consolidado, etc.) y se sumaron `tests/security/` (5 suites) y las suites de P3/P4 (`tests/unit/documents/generation-job.test.ts`, `generation-request.test.ts`, `retry.test.ts`, `handlebars-lite.test.ts`, `tests/unit/observability/request-context.smoke.test.ts`) que no existían todavía.
>
> ⚠️ **La sección 4 (Cobertura funcional) no se re-verificó en esta pasada** — son afirmaciones semánticas sobre qué prueba cada suite y confirmarlas requiere leer el contenido de las 27 suites, no solo sus rutas. Dado que las rutas subyacentes cambiaron bastante, tratar la sección 4 como orientativa hasta una revisión dedicada.

---

## 1. Filosofía

- **Tests centrados en riesgo de negocio**, no en cobertura vanity.
- Cada suite cubre una superficie crítica: auth, RBAC, dominio, validaciones, integraciones.
- Mocks selectivos: Prisma, Google Drive, nodemailer, `next/headers`.
- Fixtures tipadas en `tests/helpers/fixtures.ts` (ADMIN_USER, TENANT, buildSessionPayload).

---

## 2. Ejecución

```bash
npm test                  # toda la suite (jest --verbose)
npm run test:unit         # solo unit tests
npm run test:integration  # solo integración
npm run test:coverage     # con reporte de cobertura
npm run test:e2e          # Playwright (pendiente CI)
npm run test:db           # smoke contra Postgres REAL (ver §2.1); NO forma parte de `npm test`
```

**CI:** `npx jest --ci` se ejecuta en `pr.yml` en cada pull request contra `dev` o `main` (solo dos ramas de larga vida — ver `ARQUITECTURA.md` §8; `stg` no existe en el workflow actual). `npm run test:db` corre en `e2e.yml`, que ya tiene el servicio de Postgres.

### 2.1 Tests contra Postgres real (`npm run test:db`)

**Para qué.** Los tests de `npm test` mockean Prisma (`tests/__mocks__/prisma.ts`), así que nunca ven un `Unknown argument`, una fecha que la base rechaza o un tipo mal mapeado. El bug de `apoderados` / `notificationCity` / `otherCauseDetail` rompió la creación de casos durante meses por eso. `tests/db/case-wizard.db.test.ts` crea un caso completo con el flujo del wizard usando el cliente de Prisma **real**: la entrada se parsea con `createCaseFormSchema` y se aplica la transformación de `handleSubmit`, se llama a `createCase` / `updateCase` reales y se lee lo guardado desde la base. Solo se simula lo que necesita el runtime de Next (cookies, `revalidateTag`, `after()`) y el job de generación de documentos (Drive/Chromium).

**Cómo correrlo en local** (un Postgres descartable, mismo que el del CI):

```bash
docker run -d --name insolventic-smoke-pg \
  -e POSTGRES_USER=insolventic_e2e -e POSTGRES_PASSWORD=insolventic_e2e -e POSTGRES_DB=insolventic_e2e \
  -p 127.0.0.1:54329:5432 postgres:16-alpine

export DATABASE_URL=postgresql://insolventic_e2e:insolventic_e2e@127.0.0.1:54329/insolventic_e2e
export DIRECT_URL=$DATABASE_URL
npx prisma db push --skip-generate     # aplica el esquema (igual que e2e.yml)
npm run test:db

docker rm -f insolventic-smoke-pg      # al terminar
```

**Seguridad (importante).** Estos tests crean y borran filas. `tests/db/db-guard.ts` (probada en `tests/unit/config/db-guard.test.ts`) aborta el runner, antes de importar Prisma, si `DATABASE_URL`/`DIRECT_URL`: (1) no está definida —no hay fallback al `.env`, que en `pr.yml` es el de Vercel con la URL real de Neon—; (2) no apunta a `localhost`/`127.0.0.1`/`::1`; o (3) la base no tiene `e2e`, `test` o `smoke` en el nombre. Cada corrida crea su propio tenant y lo borra al terminar (no depende del seed).

### 2.2 Verificación de punta a punta: formulario → BD → documento

`case-wizard.db.test.ts` comprueba que el wizard **guarda** bien. Estas dos
suites comprueban lo siguiente: que lo guardado **llega al documento**. Son dos
preguntas distintas, y la segunda no la cubría nada — ni los unitarios (que
mockean Prisma y arman el caso a mano), ni el golden master (que congela la
salida actual, errores incluidos), ni el E2E de Playwright.

| Suite                                    | Qué hace                                                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/db/documentos-e2e.db.test.ts`     | Crea 8 expedientes sintéticos con datos realistas (los tres trámites, con y sin apoderado, con y sin cónyuge, de 1 a 12 acreedores) y renderiza **las 65 plantillas** contra cada uno. |
| `tests/db/persistencia-casos.db.test.ts` | Pruebas de **un campo a la vez**: parte de un payload que funciona y le agrega exactamente una cosa, de modo que el fallo sea atribuible a esa cosa.                                   |

Los expedientes viven en `tests/db/helpers/casos-sinteticos.ts`. Cada valor es
distintivo a propósito —direcciones con número, montos irrepetibles, nombres con
segundo apellido, placas— para poder buscarlo **literalmente** en el documento
renderizado. Es lo contrario del relleno automático de desarrollo, donde cada
campo vale su propio nombre y nada se distingue de nada.

**Qué detecta, sin que nadie mire.** Cinco familias:

1. Una plantilla que referencia un placeholder que el mapper no produce. No es
   cosmético: las dos rutas de generación cortan, así que esa plantilla no
   produce documento para ningún expediente.
2. Marcadores `«FALTA:»`, llaves sin resolver, `NaN`, `undefined`,
   `[object Object]`, `Invalid Date`.
3. Un valor cargado en el formulario que no aparece en ningún documento.
4. Una fecha impresa con un día distinto al que se cargó.
5. Un campo escalar o una lista anidada que se pierde entre el formulario y la
   fila de `Case`.

**No genera PDF.** Todo lo anterior vive en el HTML renderizado; el PDF solo
agrega el paso de Chromium, que es lento y no aporta señal. La ronda manual de
2026-10-03 sí los generó, para revisarlos a ojo.

#### El inventario de pendientes

`tests/db/helpers/pendientes-conocidos.ts` lista los hallazgos de
`VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md` que todavía **no** están arreglados
—el Check List, las cláusulas del Acuerdo de Apoyo, las listas truncadas, los
campos capturados que ninguna plantilla usa—.

No es una lista de excepciones para que los tests pasen: la suite exige que
coincida **exactamente**. Si alguien arregla uno y no lo borra de la lista, el
test falla por "ya no está roto"; si aparece uno nuevo, también. Las dos
direcciones importan, y así el backlog queda verificado por máquina en vez de
dormido en un documento.

#### De dónde salieron

La ronda de verificación del 2026-10-03 encontró 17 defectos, 4 críticos. Este
harness los detecta sin intervención humana: contra el `dev` anterior a los
arreglos deja **20 tests en rojo**, y cada uno nombra su hallazgo.

---

## 3. Inventario de suites

| #   | Suite                                                    | Foco                                                                                | Tests   |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| 1   | `tests/form-request/document-requirements.test.ts`       | Reglas required / conditional / optional                                            | ~24     |
| 2   | `tests/form-request/drive-storage.test.ts`               | Resolución de storage/Drive por request                                             | ~8      |
| 3   | `tests/form-request/file-validation.test.ts`             | Validación de archivos adjuntos (tipo, tamaño)                                      | ~19     |
| 4   | `tests/form-request/form-validation.test.ts`             | Validación de formularios de caso                                                   | ~24     |
| 5   | `tests/integration/case-creation-flow.test.ts`           | createCase → updateCase → transitionPhase                                           | ~6      |
| 6   | `tests/integration/drive-centro.test.ts`                 | Resolución de folder root por centro                                                | ~65     |
| 7   | `tests/security/auth-hardening.test.ts`                  | Hardening de autenticación                                                          | ~13     |
| 8   | `tests/security/input-validation.test.ts`                | Sanitización de inputs                                                              | ~12     |
| 9   | `tests/security/password-policy.test.ts`                 | Política de contraseñas                                                             | ~8      |
| 10  | `tests/security/rate-limit.test.ts`                      | Rate limiting                                                                       | ~11     |
| 11  | `tests/security/redirect-validation.test.ts`             | Validación de redirects (open redirect)                                             | ~11     |
| 12  | `tests/unit/auth/auth-actions.test.ts`                   | login / register / validateSession / logout                                         | ~23     |
| 13  | `tests/unit/auth/auth-schemas.test.ts`                   | Validación Zod de esquemas de auth                                                  | ~27     |
| 14  | `tests/unit/auth/auth-tokens.test.ts`                    | JWT (create/verify/expire/wrong secret)                                             | ~16     |
| 15  | `tests/unit/cases/case-actions.test.ts`                  | CRUD y transiciones de caso                                                         | ~12     |
| 16  | `tests/unit/components/document-generation.test.tsx`     | UI de generación (paquete + formato)                                                | ~36     |
| 17  | `tests/unit/components/help-tooltip.test.tsx`            | Tooltip de ayuda contextual                                                         | ~6      |
| 18  | `tests/unit/cron/alerts-route.test.ts`                   | 401/503 auth + constant-time compare + per-tenant isolation                         | ~7      |
| 19  | `tests/unit/debtors/debtor-actions.test.ts`              | CRUD deudores                                                                       | ~5      |
| 20  | `tests/unit/documents/generation-job.test.ts`            | P4: job de generación en background (`after()`)                                     | ~3      |
| 21  | `tests/unit/documents/generation-request.test.ts`        | P3: lock anti-duplicados (`activeKey`, huérfanos)                                   | ~8      |
| 22  | `tests/unit/documents/handlebars-lite.test.ts`           | Motor de placeholders (reemplaza a `docxtemplater` en la doc vieja)                 | ~20     |
| 23  | `tests/unit/documents/placeholder-mapper.test.ts`        | `mapCaseToPlaceholders` + escapado OWASP (P2)                                       | ~35     |
| 24  | `tests/unit/documents/retry.test.ts`                     | Backoff exponencial (Drive uploads)                                                 | ~4      |
| 25  | `tests/unit/notifications/alerts.test.ts`                | scanUpcomingHearings / scanOverduePayments + dedupe                                 | ~7      |
| 26  | `tests/unit/observability/logger-sentry.test.ts`         | Logger como único wrapper de Sentry: waitUntil + flush, tag `action`, no-op sin DSN | ~13     |
| 27  | `tests/unit/observability/request-context.smoke.test.ts` | Propagación de `requestId` vía `AsyncLocalStorage`                                  | ~2      |
|     | **TOTAL**                                                |                                                                                     | **447** |

> Conteos `~N`: recuento estático de llamadas `it(`/`test(` por archivo (415 en total) — jest reporta 447 al ejecutar; la diferencia son casos generados dinámicamente en loops de código (este proyecto no usa `it.each`, así que no es eso). La cifra de suites (27) y el total (447) están verificados; los conteos por fila son una aproximación razonable, igual que en la versión anterior de este documento.
>
> **Ya no existe** `tests/integration/batch-document-generation.test.ts` (mencionado en versiones previas de este documento) — nunca hubo un archivo con ese nombre en el árbol actual. La cobertura real de generación de documentos vive en las filas 16 y 20–24 de esta tabla.

---

## 4. Cobertura funcional

### ✅ Autenticación

- [x] Creación de access token (24h) + payload correcto
- [x] Creación de refresh token (7d, hardening aplicado)
- [x] Verificación de token expirado → `null`
- [x] Verificación con secret incorrecto → `null`
- [x] Token inválido / vacío → `null`
- [x] `lastLogin` parseado como Date
- [x] Login exitoso con set-cookie
- [x] Login con `mustChangePassword` → flag retornado
- [x] Register con hash bcrypt + rol por defecto
- [x] Reset password con token válido / expirado / usado

### ✅ RBAC

- [x] Permiso presente → `true`
- [x] Permiso ausente → `false`
- [x] Sin access token → `false`
- [x] Token inválido → `false`

### ✅ Dominio de casos

- [x] createCase valida schema y rellena defaults
- [x] updateCase incrementa `version` y falla con versión obsoleta
- [x] Transición Solicitud → Admisión requiere operador designado
- [x] Transición Negociación → Terminación fija resultDate
- [x] Filtro por tipo (Insolvencia / Conciliación / Acuerdo de Apoyo)

### ✅ Validaciones documentales

- [x] 3 documentos **siempre requeridos** (cédula, REDAM, certificado de ingresos)
- [x] Tradición y libertad es **condicional** (hasRealEstate)
- [x] Poder es **condicional** (hasAttorney)
- [x] Matrícula mercantil requerida para pequeño comerciante
- [x] Documentos opcionales no bloquean validación
- [x] `validateDocumentsComplete` retorna nombres de los faltantes

### ✅ Generación de documentos (UI)

- [x] Default package = `all`
- [x] Envío de `packageNumber: undefined` cuando se selecciona "Todos"
- [x] Envío de `packageNumber: 1..5` cuando se selecciona paquete específico
- [x] `packageNumber` pasado como number tipado, no string
- [x] Warning de "casos con documentos previos"
- [x] Toast de error cuando falla
- [x] Toggle de detalles de errores
- [x] Generación limpia resultado al cambiar caso

### ✅ Integración Google Drive por centro

- [x] "Armonía" (con tilde) mapea al folder de Armonía
- [x] "Constructores de Paz" (no "Construpaz") mapea a su folder
- [x] Comparación case-insensitive
- [x] Mayúsculas / minúsculas / slugs soportados

### ✅ Reportes

- [x] Solo Insolvencia muestra montos
- [x] Conciliación y Acuerdo de Apoyo muestran "N/A"
- [x] `totalAmount` del reporte suma solo casos de Insolvencia

---

## 5. Mocks clave

### `tests/__mocks__/prisma.ts`

Cliente Prisma stub con **todos los modelos** (~22): tenant, user, role, case, debtor, creditor, debt, asset, document, payment, notification, passwordResetToken, auditLog, etc. Cada método retorna por defecto:

- `findUnique / findFirst`: `null`
- `findMany`: `[]`
- `create / update / upsert / delete`: `{}`
- `count`: `0`
- `aggregate`: `{ _count: 0, _sum: {}, _avg: {} }`

`$transaction` ejecuta la función recibida o aplica `Promise.all` a arrays.

`resetAllMocks()` restaura todos los mocks y los defaults entre tests.

### `tests/__mocks__/nodemailer.ts`

Stub con `createTransport().sendMail` que resuelve `{ messageId: 'mock-id' }`.

### `jest.mock('next/headers')`

Para que `cookies()` retorne `get/set/delete` mockeables en server actions.

---

## 6. Pendientes de ampliación futura

| Superficie                                       | Estado       | Recomendación                                                                                                                            |
| ------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright E2E en CI                             | ✅ Ya en CI  | `e2e.yml` corre en cada PR a `dev`/`main` (chromium + Postgres service) — fila obsoleta                                                  |
| Rate-limit en login                              | ✅ Ya existe | `tests/security/rate-limit.test.ts` — fila obsoleta                                                                                      |
| Test de conversión PDF real (Puppeteer/Chromium) | Mockeado     | Suite separada con archivos de fixture (nota: la doc vieja decía `pdf-lib`, que nunca existió en el proyecto — ver `ARQUITECTURA.md` §6) |
| Snapshot de schema vs migration                  | No existe    | Script que compare `prisma migrate diff --from-schema-datasource --to-schema-datamodel`                                                  |
| Tests de carga / concurrencia (jest)             | Parcial      | k6 ya existe (`tests/load/`, scripts `test:load:*`) para carga; falta concurrencia real contra el lock P3 (`DocumentGenerationRequest`)  |

---

## 7. Cómo agregar un nuevo test

1. **Unit**: colocar en `tests/unit/<feature>/<descripcion>.test.ts`.
2. **Integration**: `tests/integration/<flujo>.test.ts`.
3. **UI**: sufijo `.test.tsx` + `@jest-environment jsdom` al inicio.
4. Importar fixtures desde `tests/helpers/fixtures` (no inline).
5. Si necesitas Prisma → `import prisma from '../../__mocks__/prisma'` y configurar `mockResolvedValue` en `beforeEach`.
6. Si el test toca `cookies()` / `next/headers` → añadir `jest.mock('next/headers', ...)` al inicio.

---

## 8. Troubleshooting

| Síntoma                                                  | Causa probable                                          | Fix                                                         |
| -------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| `Cannot read properties of undefined (reading 'create')` | Modelo Prisma no mockeado                               | Agregarlo a `tests/__mocks__/prisma.ts`                     |
| `Found multiple elements by: [data-testid="..."]`        | Varios componentes mockeados reutilizan el mismo testid | Distinguir por `value` o `placeholder` (ver mock de Select) |
| `Expected 30 days, got 7`                                | Test desactualizado post-hardening                      | Ajustar assertion a 7 días                                  |
| Tests pasan localmente pero fallan en CI                 | `JWT_SECRET` no definido                                | Ya se expone en `pr.yml`; verificar `env:`                  |

---

© 2025–2026 INSOLVENTIC
