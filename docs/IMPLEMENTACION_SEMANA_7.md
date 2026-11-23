# Semana 7 — Lotes en tandas (GD-A1) y revocación de sesiones (A-6)

**Fecha:** 2026-10-17
**Base:** `dev` @ `0a41c56` (con el merge de #139 incluido) · **Rama:**
`fix/lotes-y-sesiones` · **PR:** (abrir hacia `dev`, **sin mergear**)
**Origen:** dos riesgos de entrega pendientes: issue #3 (lotes grandes de
generación exceden `maxDuration=60s`) y A-6 (un cambio de contraseña no
invalida los JWT vigentes).
**Incluye migración de schema** (A-6, aditiva). GD-A1 no toca schema.

> **Este documento NO está commiteado.**

---

## 1. Resumen

3 commits.

| #   | Qué                                                                                           | Commit    |
| --- | --------------------------------------------------------------------------------------------- | --------- |
| 1   | GD-A1 — troceo en tandas, servidor (`generation-request.ts`, `actions.ts`, `batch-tandas.ts`) | `d4f9088` |
| 2   | GD-A1 — UI de `/documents` corre el lote por tandas                                           | `9caf151` |
| 3   | A-6 — `User.tokenVersion`, migración + enforcement + `revokeUserSessions`                     | `28cee08` |

### Verificación local

| Check              | Resultado                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | ✅ 0 errores                                                                                                                              |
| `npm run lint`     | ✅ 0 errores / 0 warnings                                                                                                                 |
| `npx jest --ci`    | ✅ **1995 tests / 140 suites** (venía de 1984/138 antes de esta rama)                                                                     |
| `npm run test:db`  | ✅ **111 / 111**, 7 suites, contra Postgres 16 real — guardián de migraciones sin cambios en la brecha conocida (3 tablas, 30 statements) |
| `npm run test:e2e` | ✅ **13 / 13** (login intacto, requisito explícito de A-6)                                                                                |
| Golden master      | ✅ sin cambios — ninguna de las dos tareas toca documentos                                                                                |

**+42 tests nuevos** desde la base (1953→1995 si se cuenta desde antes de
#139; 1984→1995 contando solo esta rama), en 5 suites nuevas y 2 archivos de
test existentes ampliados.

---

## 2. GD-A1 — Lotes grandes troceados en tandas (issue #3)

### 2.1 El problema, con números reales (no los de la etiqueta de la UI)

`docs/IMPLEMENTACION_SEMANA_3.md` §5.1 midió, con `batchHtmlToPdf` (que
`batchGenerateDocuments` ya usa): Admisión INSOLVENCY, 8 documentos, ~24s →
**~3s/documento**. "Paquete completo" medido ahí fueron 77 documentos
(~176s), "Fracaso sin filtrar" 26 (~64s) — ambos sobre el techo de 60s del
plan Hobby.

**Ojo con un detalle que solo se verificó al implementar esto:** la UI de
`/documents` etiqueta los paquetes como "Todos los paquetes (49 doc.)" y
"Paquete 5 - Fracaso (27 doc.)" — pero esos números son texto fijo, no se
recalculan contra `templates-config.ts`. Los reales, medidos con el mismo
archivo: **65** plantillas en total, **29** en el paquete 5. La diferencia
no afecta la corrección del troceo (que ahora se calcula siempre contra la
lista real, nunca contra la etiqueta), pero sí significa que la UI sigue
mostrando un número optimista — no se tocó esa etiqueta, queda anotado en
riesgos (§4).

### 2.2 El diseño: una `DocumentGenerationRequest`, N invocaciones

Cada tanda es una invocación de servidor independiente (nuevo ciclo de
`maxDuration`), pero las tres comparten la misma fila de
`DocumentGenerationRequest` — el "estado agregado" pedido, sin crear una fila
por tanda:

- `continueOrResumeGenerationRequest` — sigue sobre la fila si el lock ya
  está tomado (tanda normal), o lo retoma si la tanda anterior falló
  (reintento), sin crear nada nuevo.
- `recordBatchTandaProgress` — ACUMULA (`increment`) los conteos de la
  tanda. No libera el lock ni cambia `status`.
- `finalizeBatchGenerationRequest` — la tanda final la llama para fijar el
  estado terminal sobre el TOTAL acumulado y liberar el lock.

`claimGenerationRequest`/`completeGenerationRequest`/`failGenerationRequest`
no se tocaron — siguen siendo el camino de una sola tanda (INITIAL/ADMISSION/
AGREEMENT/FAILURE, y BATCH cuando cabe en una sola invocación: `requestId`
ausente se sigue comportando exactamente igual que antes de esta rama).

`TANDA_TEMPLATE_COUNT = 10` (`batch-tandas.ts`): 42s de presupuesto (60s ×
70%) / 3s por documento ≈ 14, redondeado hacia abajo a 10 porque el troceo
cuenta PLANTILLAS, no documentos ya expandidos por variante
(`suspension-juzgados` puede producir un oficio por juzgado distinto del
caso — la única plantilla con esa multiplicidad).

### 2.3 Reintento sin duplicar

Si una tanda falla a mitad de camino (ej. Chromium se cae), el lock se
libera (`failGenerationRequest`, sin tocar los conteos ya acumulados por las
tandas anteriores) y la UI ofrece "Reintentar", que reenvía **solo** los
`templateIds` de la tanda que faltó, con el mismo `requestId`. Las tandas
anteriores no se vuelven a ejecutar.

**Límite conocido, no nuevo de esta rama:** si una tanda falla DESPUÉS de
subir algunos documentos a Drive pero antes de terminar, reintentar esa
MISMA tanda puede volver a subir los que ya habían subido antes del fallo —
es la idempotencia de _regeneración_ que `IMPLEMENTACION_SEMANA_3.md` §5.1
ya dejó anotada como abierta ("🟠 Alto, no crítico"), orthogonal a esta
rama: GD-A1 resuelve la duplicación ENTRE tandas (no reprocesar una tanda ya
completada), no la idempotencia DENTRO de una tanda que falla a medias.

### 2.4 Rate limit

`batchDocumentGeneration` es 5 intentos / 10 min. Cobrarlo por tanda rompía
un lote de 7 tandas a la mitad; ahora solo se cobra en la primera tanda de
cada lote (`requestId` ausente).

---

## 3. A-6 — Revocación de sesiones

### 3.1 La migración exacta

`src/prisma/migrations/20261018000000_add_user_token_version/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;
```

`NOT NULL DEFAULT 0` (no nullable, a diferencia de las columnas de
conciliación de semanas anteriores): todo usuario tiene una versión, y
Postgres 11+ no reescribe la tabla fila por fila al agregar una columna
`NOT NULL` con `DEFAULT` sobre una tabla con filas existentes — sigue siendo
tan segura como las aditivas nullable de siempre.

### 3.2 Qué compara, y dónde

El JWT (access y refresh) lleva la versión vigente al emitirse.
`authenticateUser`, `refreshAccessToken` y `validateSession` —los tres
puntos que ya leen la fila del usuario en cada llamada— comparan esa versión
contra la columna y rechazan si no coincide. Un token sin el campo (emitido
antes de este cambio) se trata como versión 0, igual que cualquier usuario
existente por el `DEFAULT` de la migración.

**Por qué el refresh token también lleva versión, no solo el access:** sin
esto, un refresh token robado antes de una revocación podría seguir
emitiendo access tokens nuevos y válidos indefinidamente (cada uno con la
versión ACTUAL de la base, que lo volvería a validar). `refreshAccessToken`
es el único punto que compara la versión del REFRESH token — por eso es el
que de verdad cierra esa puerta.

`tokenVersion` se incrementa en:

- `resetPassword` — sin sesión propia que preservar (llega por el enlace del
  correo, no logueado).
- `changePassword` — SÍ reemite cookies frescas para la sesión que acaba de
  autenticarse correctamente con su contraseña actual, para no desloguearla
  por el mismo incremento que invalida sus otras sesiones (otro dispositivo,
  otra pestaña).
- `revokeUserSessions` (nueva, `src/features/user/actions.ts`) — un
  administrador fuerza el cierre de TODAS las sesiones de un usuario.
  Permiso `EDITAR_USUARIOS`, scopeada por tenant (`where: {id, tenantId}`,
  mismo patrón que `deleteUser`), con audit log.

### 3.3 Lo que el encargo pedía y no existe: "desactivar un usuario"

El encargo decía _"incrementa tokenVersion... al desactivar un usuario"_.
Verificado contra `schema.prisma`: `User` no tiene columna `active` ni
`isActive` — la única forma de quitarle acceso a un usuario hoy es
`deleteUser` (borrado duro). No se inventó esa funcionalidad: borrar la fila
ya hace que `authenticateUser`/`refreshAccessToken` rechacen con "Usuario no
encontrado" en el siguiente intento (el usuario ya no existe para comparar
ninguna versión), así que el caso está cubierto por el camino que ya
existía. `revokeUserSessions` es el equivalente real más cercano a lo que
sí pidió el encargo explícitamente ("una acción para que un administrador
cierre todas las sesiones de un usuario").

### 3.4 Límite arquitectónico: el middleware no se tocó

El encargo pedía que "el middleware/refresh rechacen tokens con versión
distinta". `refreshAccessToken` sí lo hace (§3.2). El middleware
(`src/middleware.ts`) corre en el runtime **Edge** de Next.js —
`jwtVerify` puro, sin Prisma— y no puede comparar contra la base en cada
request sin agregar infraestructura nueva (no hay Redis/KV en este
proyecto; agregar el runtime Node.js experimental a middleware metería una
consulta a Postgres en CADA navegación de página, no solo en las
mutaciones). No se tocó el middleware: la enforcement real vive en los tres
puntos que YA hacían ese round-trip por otra razón (§3.2), que es
exactamente donde vive cada mutación y cada refresco de sesión. Una sesión
revocada sigue pudiendo pasar el _gate_ de rutas del middleware (que solo
mira la firma del JWT) hasta que esa sesión intenta una acción real o
refresca su access token — que, en la práctica, ocurre dentro del ciclo
normal de uso de la app (el access token dura 24h, y cualquier acción que
toque datos pasa por `authenticateUser`).

---

## 4. Riesgos y qué verificar antes de promover a `main`

- **GD-A1 no toca producción desde esta sesión.** Todo lo de arriba se
  verificó contra el Postgres local de prueba y con Playwright local — nunca
  contra Neon ni un deployment real.
- **La migración de A-6 es la primera cosa que corre en producción** cuando
  esto se promueva. Es aditiva, `NOT NULL DEFAULT 0`, y el guardián de
  migraciones la verificó contra una base vacía sin ampliar la brecha
  conocida — pero, como con cualquier cambio de schema, vale confirmar en
  Neon (solo lectura) que `User` no tiene ya una columna `token_version` con
  otro tipo antes de mergear a `main`.
- **La etiqueta de la UI ("49 doc.", "27 doc.") sigue sin corregirse** —
  ver §2.1. No afecta la corrección del troceo (que usa los números reales),
  pero es una inconsistencia visual que alguien va a notar tarde o temprano.
  Candidata a Quick Win.
- **La idempotencia de regeneración dentro de una tanda que falla a medias
  sigue abierta** — ver §2.3. Preexistente a esta rama, no la introduce ni
  la agrava (el riesgo es exactamente del mismo tamaño que antes, ahora
  acotado a una tanda de ≤10 plantillas en vez de al lote completo).
- **El middleware no valida `tokenVersion`** — ver §3.4. Es una decisión
  consciente, no un olvido: cerrarlo del todo requeriría infraestructura que
  hoy no existe en el proyecto (Redis/KV, o mover middleware a runtime
  Node.js con el costo de una consulta a Postgres por navegación). Si en
  algún momento se decide que ese límite es inaceptable, es una decisión de
  arquitectura aparte, no un fix de esta rama.
- **"Desactivar un usuario" sigue sin existir como feature** — ver §3.3. Si
  se construye en el futuro (columna `active`/`isActive` + UI), hay que
  acordarse de incrementar `tokenVersion` en esa acción también — el patrón
  ya existe en `revokeUserSessions` para copiar.
