# Semana 15 — Notificaciones de generación de documentos rompían la bandeja

**Fecha:** 2026-10-19
**Base:** `dev` @ `25d6d7e` (con el merge de #148 incluido) · **Rama:**
`fix/notificaciones-generacion` · **PR:** abierto hacia `dev`, **sin mergear**
**Origen:** hallazgo de la auditoría de promoción `dev` → `main` de hoy
(verificación E2E completa sobre `origin/dev`): el webServer de Playwright
logueó un `ZodError` real en `getNotifications` en cuanto una notificación
de generación de documentos aparecía en el resultado.

> **Este documento NO está commiteado.**

---

## 1. Resumen

El bug: `src/features/document/generation-job.ts` crea notificaciones con
`type: 'document_generation'` / `'document_generation_failed'` desde julio
(P4, Session 2), pero `NOTIFICATION_TYPES`
(`src/features/notification/schemas.ts`) no se tocó desde abril y no
incluía esos dos valores. `getNotifications` valida la fila completa contra
ese enum (`getNotificationsOutputSchema.parse(...)`) y revienta con
`ZodError` en cuanto aparece una — tumbando la bandeja **entera**, no solo
esa notificación. Ya estaba en `main`/producción tal cual (no es una
regresión de esta rama); no se disparó nunca porque producción tiene 0
casos. Se iba a disparar con el primer caso real que generara documentos.

| #   | Qué                                                                                                                                                          | Commit     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | Enum: agregar `document_generation`/`document_generation_failed`/`system` (genérico defensivo) + `getNotifications` ya no revienta con un `type` desconocido | _(ver §3)_ |
| 2   | Íconos/colores en `notification-item.tsx` para los dos tipos nuevos                                                                                          | _(ver §3)_ |
| 3   | Tests de regresión (unit + test:db)                                                                                                                          | _(ver §4)_ |

### Verificación local

| Check                                                | Resultado                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `npx tsc --noEmit`                                   | ✅ 0 errores                                                     |
| `npm run lint`                                       | ✅ 0 errores / 0 warnings                                        |
| `npm test` (jest)                                    | ✅ 157 suites, 2113 tests (antes: 156/2110 — +1 suite, +3 tests) |
| `npm run test:db`                                    | ✅ 12 suites, 130 tests (antes: 11/129 — +1 suite)               |
| `npx playwright test`                                | ✅ ver §5                                                        |
| Golden master                                        | ✅ sin cambios (el fix no toca ningún mapper de documentos)      |
| Verificación manual en navegador (bypass rate limit) | ✅ ver §6                                                        |

---

## 2. Barrido: todos los `type:` que el código crea en `Notification`

| Archivo                                                                    | `type`                                                                   | ¿Estaba en el enum?     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| `notification/actions.ts` (`createNotificationForAction`, vía `actionMap`) | 15 valores CRUD (`case_*`, `creditor_*`, `debtor_*`, `user_*`, `role_*`) | Sí                      |
| `notification/alerts.ts:157`                                               | `hearing_upcoming`                                                       | Sí                      |
| `notification/alerts.ts:273`                                               | `payment_overdue`                                                        | Sí                      |
| `document/generation-job.ts:51`                                            | `document_generation` / `document_generation_failed`                     | **No — causaba el bug** |
| `prisma/seed.ts`                                                           | 5 valores CRUD                                                           | Sí                      |

Ningún otro sitio de `src/` crea una `Notification`. No se encontró ningún
otro desajuste.

### UI (íconos/etiquetas/filtros)

- `notification-item.tsx` (`getNotificationTypeIcon`/`getNotificationTypeColor`):
  ya tenían fallback genérico (`Bell` / `bg-muted`) para cualquier `type` no
  reconocido — nunca rompían en runtime, solo se veían genéricos. Se les
  agregó un ícono/color propio a los dos tipos de generación (ver §3).
- `notification-management.tsx`: declara un filtro por `type` en su firma
  (`getNotificationsInputSchema.type`) pero **no hay ningún `<Select>` en el
  JSX que lo use** — no hay UI de filtro que tocar.

---

## 3. El fix

### `schemas.ts`

- `NOTIFICATION_TYPES` suma `document_generation`, `document_generation_failed`
  (los dos que ya emitía `generation-job.ts`) y `system` — un valor genérico
  que **ningún flujo de negocio emite**, reservado para la degradación
  defensiva de `getNotifications` (abajo).
- `CRUD_NOTIFICATION_TYPES` (el tipo que recibe `createNotificationForAction`)
  excluye los 3 nuevos además de los 2 de alertas — sigue siendo exactamente
  los 15 valores con entrada en `actionMap`.

### `actions.ts` — `getNotifications`

Antes castear `notification.type as NotificationType` sin validar. Ahora,
por cada fila: `notificationTypeSchema.safeParse(notification.type)`; si
falla, se registra con `logger.warn` (`action: 'get-notifications'`, el
`type` crudo y el id de la notificación) y la fila se muestra con
`type: 'system'` en vez de tumbar el `.parse()` final. Con esto, un `type`
futuro o una fila corrupta que hoy no podemos prever tampoco rompe la
bandeja — no solo los dos valores que motivaron el hallazgo.

### `notification-item.tsx`

`document_generation` → ícono `FileCheck`, color verde (éxito).
`document_generation_failed` → ícono `FileX`, color rojo (ya compartido con
`payment_overdue`). `system` no necesita entrada propia: cae en los
fallbacks genéricos ya existentes (`Bell` / `bg-muted`), que es exactamente
el aspecto que le corresponde.

---

## 4. Tests de regresión

- **Unit** (`tests/unit/notifications/get-notifications.test.ts`, nuevo):
  - Una notificación `document_generation` y una `document_generation_failed`
    se leen tal cual (el caso real de `generation-job.ts`).
  - Una fila con `type` fuera del enum se degrada a `'system'`, se registra
    con `logger.warn` (se afirma el mensaje exacto y los campos del
    contexto), y **el resto de la bandeja se sigue viendo** — se verificó
    junto a una fila `case_created` normal en el mismo resultado.
- **test:db** (`tests/db/notificaciones-generacion.db.test.ts`, nuevo):
  contra Postgres real, crea las dos notificaciones con el mismo shape
  exacto que `notifyRequester` (`generation-job.ts`) más una fila con `type`
  inventado, y lee las 3 con `getNotifications()` real (no mockeado):
  confirma `success: true`, los dos tipos de generación intactos y el
  desconocido como `'system'`.

---

## 5. Playwright (E2E completo)

**13/13 passed** (23.4s). El `ZodError` de `getNotifications` que motivó
este fix (visto en los logs del webServer de la corrida de auditoría de
hoy, antes del fix) **ya no aparece** — se confirmó con `grep` sobre el log
completo de esta corrida (`invalid_value`/`ZodError`: 0 ocurrencias). Los
`[Error: aborted]`/`ECONNRESET` que sí quedan son ruido preexistente del
webServer al cerrar conexiones entre tests, sin relación con este fix (ya
aparecían igual en la corrida de la auditoría, antes de tocar nada).

---

## 6. Verificación manual en navegador (bypass del rate limit)

`CI=true` + `E2E_DISABLE_RATE_LIMIT=1` agregados temporalmente a
`.env.local` (restaurado a su contenido original al terminar — no quedó
commiteado ni persistido). Contenedor `insolventic-db-verif` arriba,
servidor dev contra esa base.

1. Se insertó a mano una notificación `type: 'document_generation'` para
   `beatriz.malavera@insolventic.com` (tenant `armonia`, seed), simulando
   exactamente lo que crea `notifyRequester`.
2. Login en `/login?db=armonia` con esa usuaria — exitoso.
3. Dashboard: el panel lateral de notificaciones mostró **"Documentos
   generados"** (ícono verde `FileCheck`) junto a una notificación
   preexistente del seed, **"Falló la generación de documentos"** (ícono
   rojo `FileX`) — ambas con su ícono/color propio, sin genérico.
4. `/notifications` (Centro de Notificaciones completo): las 3
   notificaciones del usuario se listaron sin error —
   `Mostrando 1-3 de 3 notificaciones` — confirmando que `getNotifications`
   no revienta con la fila de generación real.
5. Logs del servidor dev: todas las consultas y respuestas
   (`GET /notifications`, `POST /notifications` × varias) en `200`, sin
   ningún `ZodError`.
6. Consola del navegador: sin errores relacionados (los únicos `[error]`
   son bloqueos de CSP de Vercel Analytics en dev local, preexistentes y
   sin relación con este fix).
7. Limpieza: se borró la notificación insertada a mano
   (`relatedId: 'req-verif-manual'`) antes de apagar el servidor — no quedó
   dato de prueba en la base local.

---

## 7. NO TOUCH respetado

`schema.prisma` y migraciones (no hizo falta ninguna — `Notification.type`
ya era `String` en Prisma, el enum vive solo en Zod), `templates/*.html`,
Vercel/Neon y servicios externos, `main`, `dev` (se trabajó en una rama
nueva desde `origin/dev`), historial — ninguno tocado. El commit de
autoría del CHANGELOG (`docs/changelog-144-148`, pendiente de la sesión
anterior) se dejó intacto, sin pushear.

## 8. Pendiente / decisiones abiertas

- Ninguna decisión de producto pendiente — este es un fix de corrección
  pura (la bandeja no debe romperse), no un cambio de comportamiento
  visible más allá de que ahora **se ve** la notificación de generación en
  vez de un error silencioso.
- El PR queda abierto hacia `dev`, sin mergear, a la espera de revisión.
