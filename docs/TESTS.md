# Plan y Reporte de Pruebas — INSOLVENTIC

> Estado al cierre: **23 suites / 422 tests ✅ (100% verdes)**
> Última ejecución: `npx jest` local en abril 2026 (tras release 0.3.0)

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
```

**CI:** `npx jest --ci` se ejecuta en `pr.yml` en cada pull request contra `dev`, `stg` o `main`.

---

## 3. Inventario de suites

| #   | Suite                                                 | Foco                                                        | Tests   |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- | ------- |
| 1   | `tests/unit/auth/auth-tokens.test.ts`                 | JWT (create/verify/expire/wrong secret)                     | 15      |
| 2   | `tests/unit/auth/auth-actions.test.ts`                | login / register / validateSession / logout                 | ~20     |
| 3   | `tests/unit/auth/rbac.test.ts`                        | checkUserPermission en todas las ramas                      | ~8      |
| 4   | `tests/unit/auth/reset-password.test.ts`              | forgotPassword / resetPassword / token expirado             | ~6      |
| 5   | `tests/unit/case/create-case.test.ts`                 | createCase con validación Zod                               | ~10     |
| 6   | `tests/unit/case/update-case.test.ts`                 | updateCase + optimistic locking (version++)                 | ~8      |
| 7   | `tests/unit/case/phase-transitions.test.ts`           | Solicitud → Admisión → Negociación → Terminación            | ~10     |
| 8   | `tests/unit/case/case-filters.test.ts`                | Filtros por estado, fase, tipo, texto libre                 | ~6      |
| 9   | `tests/unit/creditor/creditor-crud.test.ts`           | CRUD acreedores                                             | ~6      |
| 10  | `tests/unit/debtor/debtor-crud.test.ts`               | CRUD deudores + historial                                   | ~6      |
| 11  | `tests/unit/user/user-crud.test.ts`                   | CRUD usuarios + asignación de rol                           | ~6      |
| 12  | `tests/unit/components/document-generation.test.tsx`  | UI de generación (paquete + formato)                        | 36      |
| 13  | `tests/unit/components/case-edit-dialog.test.tsx`     | Dialog edit con conflict toast                              | ~6      |
| 14  | `tests/unit/components/empty-states.test.tsx`         | Tablas vacías muestran empty state                          | ~5      |
| 15  | `tests/form-request/document-requirements.test.ts`    | Reglas required / conditional / optional                    | 20      |
| 16  | `tests/integration/drive-centro.test.ts`              | Resolución de folder root por centro                        | ~12     |
| 17  | `tests/integration/login-flow.test.ts`                | Flujo completo login + setCookies                           | ~8      |
| 18  | `tests/integration/case-creation-flow.test.ts`        | createCase → updateCase → transitionPhase                   | ~7      |
| 19  | `tests/integration/batch-document-generation.test.ts` | generación real con docxtemplater (mock Drive)              | ~6      |
| 20  | `tests/unit/report/report-actions.test.ts`            | getCaseStatusReport + filtros                               | ~6      |
| 21  | `tests/unit/notifications/alerts.test.ts`             | scanUpcomingHearings / scanOverduePayments + dedupe         | 7       |
| 22  | `tests/unit/observability/observability.test.ts`      | reportError / reportMessage / Sentry no-op                  | 3       |
| 23  | `tests/unit/cron/alerts-route.test.ts`                | 401/503 auth + constant-time compare + per-tenant isolation | 7       |
|     | **TOTAL**                                             |                                                             | **422** |

> Los conteos `~N` son aproximados; la cifra exacta la reporta `jest --verbose`.

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

| Superficie                            | Estado    | Recomendación                                                                           |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| Playwright E2E en CI                  | Manual    | Añadir workflow `e2e.yml` con browser matrix                                            |
| Test de conversión PDF real (pdf-lib) | Mockeado  | Suite separada con archivos de fixture                                                  |
| Test de rate-limit en login           | No existe | Implementar rate-limiter + test                                                         |
| Snapshot de schema vs migration       | No existe | Script que compare `prisma migrate diff --from-schema-datasource --to-schema-datamodel` |
| Tests de carga / concurrencia         | No existe | k6 / artillery contra el endpoint de creación                                           |

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
