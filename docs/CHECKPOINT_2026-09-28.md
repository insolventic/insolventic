# Checkpoint de estado — INSOLVENTIC — 2026-09-28

> Sucede al `CHECKPOINT_2026-09-09.md` (con su cierre del 2026-09-12: `main` y `dev` idénticas en `d2f7cef`, Semana 3 en producción). Desde entonces no hubo ninguna promoción a `main` — todo el trabajo de este período vive en `dev`, 58 commits adelante de `main`.

---

## 1. Resumen de una línea

**`dev` acumuló ~3 semanas de trabajo sin promoción a `main`: autenticación endurecida, la red de seguridad del mapper de documentos (golden master + contrato de colisiones), 5 hallazgos de placeholders corregidos, el bug real de los totales de bienes (`Decimal` concatenado como string), Fase 0 de lecturas explícitas de `Case`, CI ahora corre también en push a `dev`, y dos hallazgos de seguridad nuevos (hash de contraseña cargado de más, datos personales sin redactar en Sentry). Quedan 6 PRs abiertos — el más importante, #40, reescribe el modelo de fases del expediente y **exige una promoción a `main` en dos tiempos** por la migración que retira columnas. `main` sigue en `d2f7cef` (2026-09-12).**

---

## 2. Estado por frente

| Frente                                             | Estado                                  | Detalle                                                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promoción a `main`                                 | 🔴 **Pendiente**                        | `main` en `d2f7cef` desde el 2026-09-12; `dev` 58 commits adelante — ver §7                                                                                                       |
| CI en `dev`                                        | 🟢 **Nuevo**                            | `pr.yml` corre `quality-checks` también en `push` a `dev` (PR #53, mergeado) — antes un merge a `dev` no disparaba ningún CI                                                      |
| Red de seguridad del mapper                        | 🟢 **Mergeada**                         | Golden master (26 escenarios) + contrato estático de las colisiones de fusión (`mapper-merge-order.test.ts`) — base para dividir `placeholder-mapper.ts` sin romper nada a ciegas |
| División de `placeholder-mapper.ts`                | 🟡 **En curso**                         | Paso 1 (helpers de formato) mergeado; Paso 2 (sub-mappers de listas simples) es PR #52, abierto                                                                                   |
| Bug de totales de bienes (`Decimal`)               | 🟢 **Cerrado**                          | PR #41 mergeado — ver §3                                                                                                                                                          |
| `failureType` / generación automática de Fracaso   | 🟢 **Resuelto, sin mergear**            | La resolvió PR #40 como efecto colateral de su propio alcance — ver §5.1                                                                                                          |
| Hash de contraseña cargado de más                  | 🟡 **PR abierto**                       | #54, sin mergear                                                                                                                                                                  |
| Datos personales sin redactar en eventos de Sentry | 🟡 **PR abierto**                       | #55, sin mergear                                                                                                                                                                  |
| Hallazgo 3 (`TIPO_SOLICITANTE`)                    | 🔴 **Abierto, en pausa**                | Ver §5.1                                                                                                                                                                          |
| 29 columnas `conc_*` sin migración                 | 🔴 **Abierto, sin verificar**           | Ver §5.2 — NO TOCAR                                                                                                                                                               |
| Check List (3 párrafos)                            | 🔴 **Abierto, pendiente de la abogada** | Ver §5.3 — NO TOCAR                                                                                                                                                               |
| `{{#unless @last}}` / `{{#if @last}}`              | 🟡 **PR abierto**                       | #51, sin mergear — ver §5.4                                                                                                                                                       |

---

## 3. Qué está mergeado en `dev` desde el 2026-09-09

### 3.1 Autenticación (2026-09-20, PRs #20–#32)

Serie de fixes sobre `useAuth`/`switchDatabase`/`switchTenant`: el patrón de Next.js de señalizar un redirect exitoso lanzando una excepción especial (`NEXT_REDIRECT`) se estaba tragando como si fuera un error real, o reportándose como éxito cuando en realidad había fallado. Corregido reconociendo el redirect por su `digest`, no por su `message` (issue #9). De paso: el hook de pre-commit dejó de fallar en Windows por un problema de comillas en el PATH (issue #17, el mismo que obligaba a `--no-verify` puntual documentado en el checkpoint anterior); runbooks nuevos de rotación de credenciales (Drive, Neon).

### 3.2 Red de seguridad del mapper de documentos (PRs #43–#50, #45)

Antes de tocar `placeholder-mapper.ts` (2.877 líneas, candidato a división desde la Fase 2 del roadmap), se construyó una red de verificación:

- **Golden master** (`mapper-golden.test.ts`): output completo de `mapCaseToPlaceholders`/`buildConciliationContext` + HTML renderizado, por escenario y plantilla, comparado byte a byte contra un baseline committeado (`tests/unit/documents/golden/`).
- **Contrato de orden de fusión** (`mapper-merge-order.test.ts`): análisis estático (AST) del spread de `mapCaseToPlaceholders`, que documenta cada colisión de claves entre sub-mappers y verifica cuál gana.

Con esa red en verde, se corrigieron 5 hallazgos reales de la auditoría de documentos, cada uno con su propio PR apilado:

| Hallazgo | Qué                                                                                       | PR  |
| -------- | ----------------------------------------------------------------------------------------- | --- |
| 1        | Doble conversión de zona horaria en fechas                                                | #46 |
| 2        | `ANO_INICIO_PAGO`/`ANO_VIGENCIA` salían pisados                                           | #47 |
| 5        | Faltaba `NOMBRE_REPRESENTANTE` (no es lo mismo que `NOMBRE_REPRESENTANTE_LEGAL`)          | #48 |
| C        | `AC{n}_*` no se completaba cuando el acreedor no existía en esa posición                  | #49 |
| Bug B    | El detector de placeholders sin resolver no reconocía `{{#if}}`/`{{#each}}` de dos tokens | #50 |

Paso 1 de la división del mapper (extraer los 12 helpers de formato a `placeholders/format.ts`, sin cambiar su código) también mergeado (PR #45).

### 3.3 Bug real de totales de bienes — `Prisma.Decimal` concatenado como string (PR #41)

`mapAssets` sumaba los valores de los activos con `+`. `Decimal.valueOf()` devuelve un **string**, así que `sum + a.value` concatenaba en vez de sumar: un inmueble de $100M + un mueble de $500K daba `$1.000.000.500.000` en vez de `$100.500.000`. Afectaba a todo documento generado por la ruta automática (creación de caso), que le pasa al mapper la fila de Prisma sin convertir. Corregido envolviendo cada sumando en `Number()`. Con esto, **el bug del total de bienes queda corregido en `dev`.**

De paso, PR #34 reemplazó los `as unknown as CaseWithRelations` (doble cast sin verificación del compilador) por `asCaseWithRelations()`, una función que el compilador sí verifica — módulo separado del fix de Decimal, sin superposición.

### 3.4 Fase 0 de revisión del modelo `Case` — lecturas explícitas (PRs #37, #39, #42)

`Case` tiene 269 columnas; una lectura sin `select` trae todas (y una columna ausente invalida el registro completo con `caseSchema` — así se cayó `/cases` con las columnas `apoyo_*`, ver checkpoint anterior §8). Se auditaron todas las lecturas de `Case` en el repo: el listado ahora usa solo `CASE_LIST_COLUMNS`, las que solo comprueban existencia piden el `id`, y quedan 3 (antes 4 — ver §3.5) lecturas justificadas que sí traen la fila entera porque el mapper de documentos referencia 234 de las 269 columnas. Guardián estático (`case-reads-select.test.ts`) que falla si aparece una lectura nueva sin `select`. De paso: `x-request-id` ahora lo emite siempre el servidor (antes el cliente podía inyectar uno), y el buscador global (`cmdk`) y los gráficos del dashboard cargan de forma diferida (First Load 435→310 kB).

### 3.5 CI sobre push a `dev` (PR #53)

Hasta ahora ningún workflow corría después de un merge a `dev` — la única verificación posterior a un merge era local, a mano, por quien mergeaba. `pr.yml` ahora también corre `quality-checks` en `push` a `dev`. Verificado en producción: el run disparado por el push que trajo este mismo PR terminó `success`.

---

## 4. PRs abiertos y por qué

| PR      | Título                                                                               | Por qué sigue abierto                                                                                                  |
| ------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **#40** | 5 fases nuevas del expediente + retiro de `rejection`/`withdrawal`                   | Lo revisás vos. Requiere promoción a `main` **en dos tiempos** — ver §7. Actualizado hoy contra `dev` (ver §4.1)       |
| **#38** | Un solo wrapper de Sentry (el logger)                                                | Lo revisás vos. Actualizado hoy contra `dev` sin cambios de fondo (conflicto solo en un comentario de `docs/TESTS.md`) |
| **#52** | División del mapper, Paso 2 (sub-mappers de listas simples)                          | Bloquea el Paso 3 del plan (Tarea 4 de una sesión anterior sigue en espera de este merge)                              |
| **#51** | `handlebars-lite` reconoce `{{#unless @last}}`/`{{#if @last}}` dentro de `{{#each}}` | Lo revisás vos — ver §5.4                                                                                              |
| **#54** | `operator: true` en `batchGenerateDocuments` cargaba el hash de la contraseña        | Nuevo hoy — ver §6.1                                                                                                   |
| **#55** | Scrub de Sentry no cubría excepciones/breadcrumbs/extra                              | Nuevo hoy — ver §6.2                                                                                                   |

### 4.1 Qué se tocó al actualizar #40 y #38 contra `dev`

Ambos estaban `CONFLICTING` contra el `dev` actual. Se trajeron al día con un merge normal (sin rebase ni force-push), cada uno verificado con suite + `tsc` + `eslint` + golden master antes de pushear, sin mergearlos:

- **#38**: un solo conflicto, en el comentario de `docs/TESTS.md` (la tabla de inventario de tests, que #38 actualiza porque renombra `observability.test.ts` a `logger-sentry.test.ts`). Resuelto tomando la versión de la rama; sin conflicto de código.
- **#40**: conflicto de lógica real en `mapExtendedDates` (la rama traía de antes la fecha de desistimiento desde `resultDate`, y `dev` ya había sacado los stubs muertos de `*_FRACASO`/`ANO_INICIO_PAGO`/`ANO_VIGENCIA` — se combinaron ambos). Además, **se encontró un bug real, no relacionado con el conflicto**: el rename de plantilla `rechazo-inasistencia` → `inasistencia-deudor` (documentado en `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §3.1) había actualizado el config pero nunca movió el archivo físico — `generateOnFailure: true` habría fallado en silencio en producción. Nadie lo había detectado porque **el golden master no existía cuando se creó la rama de #40**: esta fue la primera vez que su código se comparó contra un baseline. Corregido (`git mv`, commit de rename puro) y agregado un test de invariante que faltaba (`template-files-exist.test.ts`, recorre `ALL_TEMPLATES` y falla si algún archivo no existe — Quick Win P9 ya anotado en `CLAUDE.md`, nunca implementado). También se actualizó `case-reads-select.test.ts`: `updateCasePhase` (reescrito por #40) dejó de ser una de las lecturas justificadas de fila entera, porque ahora delega en `fetchCaseForGeneration` en vez de leer la fila ella misma.

---

## 5. Hallazgos abiertos

### 5.1 Hallazgo 3 — `TIPO_SOLICITANTE`, contradice a `APLICACION_PEQUENA_COMERCIANTE`

Documentado en `mapper-merge-order.test.ts` (`describe('TIPO_SOLICITANTE: mapApplicantScope < mapAgreementResult'`). Cuando el alcance de la solicitud (`applicantScope`) se guarda como **texto libre** en vez del código reconocido, `mapAgreementResult` (que solo entiende el código) pisa a `mapApplicantScope` y produce `TIPO_SOLICITANTE: "Persona Natural No Comerciante"` mientras `APLICACION_PEQUENA_COMERCIANTE` sigue en `"SI"` — dos placeholders del mismo documento se contradicen. Identificado durante la división del mapper (PR #52) y dejado **a propósito en pausa**: arreglarlo implica decidir cuál de las dos fuentes es la autoritativa, decisión de negocio, no de código.

> Nota de contexto que sí se puede cerrar sin la abogada ni el cliente: el fallback `fullCase.failureType ?? 'general'` que una sesión anterior investigó (devolvía 0 documentos porque `'general'` no está en ningún subtipo) **queda resuelto por PR #40**, como efecto colateral de hacer `subtype` obligatorio al pasar a "Fracaso". Verificado hoy: cada subtipo genera como máximo 2 documentos (típicamente "fracaso-X" + "remision-juzgado-X"), muy lejos de las 26-27 plantillas sin filtro que el Issue #3 mide en ~64s de batching — el fix no solo corrige el "0 documentos", evita por diseño el lote grande que rompía en Vercel. Sigue sin mergear porque depende de #40.

### 5.2 29 columnas `conc_*` sin migración — NO TOCAR

`docs/DERIVA_MIGRACIONES_2026-09-10.md` documenta que `schema.prisma` declara las columnas `conc_*` de `Case` (todo el módulo de Conciliación) sin que ninguna migración las respalde — mismo patrón que rompió las columnas `apoyo_*` en agosto (checkpoint anterior §8). La diferencia: el cierre del 2026-09-17 verificó **0 columnas faltantes** contra `information_schema.columns` de producción real, pero esa verificación cubrió los 9 modelos listados en el checkpoint anterior (Acreedor, Debtor, Bien, Payment, ProcesoJudicial, AuditLog, ConciliationCenter, Document, Notification/User) — **no** volvió a verificar específicamente las columnas `conc_*` dentro de `Case` con ese mismo método. No se investigó más en esta sesión por instrucción explícita (requiere acceso a Neon de producción).

### 5.3 Check List — 3 párrafos sin resolver, pendiente de la abogada — NO TOCAR

Referenciado en el commit de PR #52 (`dbc8b9a`): `mapCheckList` "tiene el hallazgo de los 3 párrafos sin resolver, en pausa pendiente de la abogada" — por eso ese sub-mapper se dejó a propósito fuera del Paso 2 de la división, aunque moverlo de archivo no cambiaría su comportamiento. No se investigó el detalle en esta sesión (fuera de alcance, NO TOCAR).

### 5.4 `{{#unless @last}}` / `{{#if @last}}` dentro de `{{#each}}`

PR #51: `handlebars-lite.ts` no reconocía estas dos formas dentro de un bloque `{{#each}}`, lo que podía dejar un bloque padre sin resolver indefinidamente (el motor resuelve bloques de adentro hacia afuera, y un token no reconocido dentro del cuerpo bloquea al padre en cualquier nivel de anidamiento). Abierto, lo revisás vos.

---

## 6. Hallazgos nuevos de esta sesión (con PR)

### 6.1 `operator: true` cargaba el hash de la contraseña (PR #54)

Único punto de todo el repo que traía la relación `Case.operator` (→ `User`) completa vía `include: { operator: true }`, en `batchGenerateDocuments`. El mapper de placeholders solo lee `operator.name`/`operator.email`. Reemplazado por un `select` de `{ id, name, email }`, igual que el resto de las lecturas de esta relación. Agrega un guardián que deriva del propio `schema.prisma` qué campos apuntan a `User` (`operator`, `user`, `registeredBy`) y falla si alguno vuelve a leerse con `campo: true`.

### 6.2 Datos personales sin redactar en eventos de Sentry (PR #55)

`scrubSentryEvent` (el `beforeSend` compartido por los 3 configs) solo redactaba `event.request`. `logger.error` pasa el `Error` crudo a `Sentry.captureException`, y un `PrismaClientValidationError` imprime el payload completo de la operación fallida — así se vieron nombres, teléfonos y correos en la terminal el día del incidente de `notificationCity`. Extendido a excepciones, breadcrumbs y `extra`, redactando por clave exacta (no por subcadena, para no confundir `fileName`/`templateName`/`documentName` con datos personales). Compromiso documentado en el PR: se pierde el valor real de esos campos al depurar un caso puntual en Sentry; se conserva la estructura del error (qué argumento faltó, qué tipo se esperaba, la traza).

---

## 7. Orden de promoción a `main` que requiere #40

`main` sigue en `d2f7cef` (2026-09-12) — nada se promovió desde entonces. #40 retira las columnas `rejection`/`withdrawal` de `Case`, y su propio diseño (`docs/DISENO_FASES_NUEVAS_2026-09-11.md` §6) exige un despliegue **en dos tiempos**, no uno:

1. **Primer despliegue**: el código que deja de leer/escribir `rejection`/`withdrawal` (ya no quedan referencias vivas tras #40).
2. **Segundo despliegue, aparte**: la migración que hace `DROP COLUMN IF EXISTS` sobre esas dos columnas, con una guarda que aborta si algún caso real todavía tiene alguna de las dos en `true` (verificado: la migración solo tiene esas dos sentencias `DROP COLUMN`, nada más destructivo).

Motivo del orden: si el código y la migración se promovieran juntos, cualquier ventana entre "el build corrió la migración" y "el código nuevo está sirviendo tráfico" (o un rollback del código sin rollback de la migración) dejaría código viejo intentando leer columnas que ya no existen. Separarlos hace que cada paso sea reversible por sí solo.

**Antes de cualquier promoción**: `main` necesita los 58 commits de `dev` acumulados desde el 2026-09-12 (todo lo de §3), y el commit HEAD de ese push debe ser de `Insolventic <insolvenic@gmail.com>` (plan Hobby de Vercel, ver `CLAUDE.md` § Session 3) — no autorizado en esta sesión, ningún deploy ni promoción se hizo.

---

## 8. Lo que depende de personas

| Qué                                                                          | De quién                                | Bloquea                                                                                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Revisión y merge de #38, #40, #51                                            | El autor (vos)                          | La promoción a `main` (§7) y el Paso 3 de la división del mapper (bloqueado por #52, que si se mergea antes no depende de estos tres) |
| Decisión sobre Hallazgo 3 (`TIPO_SOLICITANTE`)                               | Negocio/cliente                         | Cuál de las dos fuentes (código vs. texto libre del alcance) es la autoritativa                                                       |
| Check List — 3 párrafos                                                      | La abogada                              | Terminar la división del mapper (Paso 2 ya evita tocar `mapCheckList` por esto)                                                       |
| Confirmación de texto legal de "Fracaso por reforma del acuerdo" (⓵ⓓ de #40) | La abogada                              | Uso de esa plantilla reclasificada — no bloquea el merge de #40, solo su contenido legal                                              |
| SMMLV 2026 transitorio (Decreto 0159, `validation-rules.ts`)                 | La abogada                              | Confirmar si hay fallo de fondo o decreto definitivo — sigue con `TODO(legal)`                                                        |
| Verificación de las 29 columnas `conc_*` contra producción real              | Acceso a Neon (NO TOCAR en esta sesión) | Cerrar §5.2 con la misma certeza que el resto de la deriva de migraciones                                                             |
| Aislar Preview con su propio branch de Neon                                  | Vos                                     | Que el cliente pueda probar sin tocar los datos de producción                                                                         |
| Prueba real de subida a Drive                                                | Vos                                     | Confirmar que la ruta automática de generación de documentos sube correctamente en un entorno real, no mockeado                       |

---

## Referencias

- `CHECKPOINT_2026-09-09.md` — checkpoint anterior, con el cierre del incidente de `/cases` y de los deploys de producción.
- `DISENO_FASES_NUEVAS_2026-09-11.md` — diseño completo de #40, incluida la nota de despliegue en dos tiempos (§6) y el hallazgo de la plantilla mal clasificada (§3.1.5).
- `DERIVA_MIGRACIONES_2026-09-10.md` — columnas de `schema.prisma` sin respaldo en ninguna migración (incluye el bloque `conc_*`).
- `TESTS.md` — inventario de suites, incluida la red de seguridad del mapper (§3.2 de este documento).
