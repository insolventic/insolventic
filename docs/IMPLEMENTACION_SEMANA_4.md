# Semana 4 — Cierre de los bloqueantes de seguridad pre-entrega

**Fecha:** 2026-10-17
**Base:** `dev` @ `53e1ecd` · **Rama:** `fix/pre-entrega-seguridad` · **PR:** [#137](https://github.com/insolventic/insolventic/pull/137) (abierto, **sin mergear**)
**Origen:** los 7 hallazgos de seguridad del diagnóstico del 2026-10-12.
**Sin cambios de schema ni migraciones.**

> **Este documento NO está commiteado.** Es el resumen para tu revisión, como pediste.
> Si te sirve como está, se commitea; si no, se descarta sin tocar el PR.

---

## 1. Resumen

8 commits atómicos: uno por hallazgo, más uno de fixtures de `test:db` (fallout de dos de ellos, separado porque el historial no se reescribe).

| # | Hallazgo | Sev. | Commit |
| --- | --- | --- | --- |
| 1 | **G-A1** — `globalSearch` sin permiso ni scoping | 🟠 Alto | `7d46fff` |
| 2 | **GC-A1 + GD-M4 + GC-M5** — visibilidad por fila en mutaciones, generación y reportes | 🟠/🟡 | `6b36d84` |
| 3 | **GC-M6** (interino) — `deleteCase`: confirmación escrita + auditoría previa | 🟡 Medio | `b5062ed` |
| 4 | **GC-M4** — la auditoría se espera; `updateCase` registra qué cambió | 🟡 Medio | `ad608e5` |
| 5 | **GC-M2** — el operador asignado tiene que ser del centro | 🟡 Medio | `fc3e555` |
| 6 | **GC-B2** — rate limit en `createCase` | 🔵 Bajo | `deea49e` |
| 7 | **nodemailer** + `npm audit fix` no-breaking | — | `4ddb5cd` |
| — | fixtures de `test:db` | — | `dbdab7a` |

### Verificación

| Check | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores / 0 warnings |
| `npx jest --ci` | ✅ **1912 tests / 130 suites** (venía de 1780 / 119) |
| `npm run test:db` | ✅ **105 / 105**, 5 suites, contra Postgres 16 real |
| Golden master | ✅ **sin cambios de hash** |

**+132 tests nuevos** en 10 suites. Todo el control es de servidor; la UI solo añade fricción.

### CI del PR #137 — estado final

| Check | Resultado |
| --- | --- |
| `quality-checks` (lint + tsc + jest + build) | ✅ **pass** — 3m 26s |
| `playwright` (E2E) | ✅ **pass** — 3m 6s |
| `Vercel Preview Comments` | ✅ pass |
| `smoke` | skipping — esperado, no hay deployment |
| `Vercel` | ❌ fail — **issue #7**, autoría del commit. Ver §5.5 |

Los dos checks que verifican el código están verdes. El único rojo es el bloqueo
de autoría del plan Hobby, que falla igual en `#133`, `#134` y `#135` — los tres
mergeados así.

---

## 2. Qué cambió, hallazgo por hallazgo

### 2.1 G-A1 — `globalSearch` (`7d46fff`)

Era **la única server action del sistema sin ningún check de permisos**: sacaba el `tenantId` de la sesión y nada más. Dos caracteres en la barra de búsqueda devolvían nombre, cédula y correo de **todos** los deudores del centro.

Dos capas:

1. **Permiso por categoría**, cada uno igual que su listado: `VER_CASOS` (como `getAllCases`), `VER_DEUDORES` (como `getAllDebtors`), `VER_ACREEDORES` (como `getAllCreditors`). Sin ninguno de los tres, la búsqueda no toca la base. La `Secretaria` pasa a encontrar casos y nada más.
2. **Visibilidad por fila en los casos**, con el mismo alcance que `getCaseById`.

**El rol cliente es el que motivó el hallazgo, y la capa 1 no lo detiene.** El rol `Usuario` del seed **tiene** `Ver deudores` y `Ver acreedores`, así que seguiría enumerando a todos los deudores. Cuando el alcance es `client`, las dos consultas se acotan también por fila: su propia ficha de deudor, y solo los acreedores que figuran en una deuda de sus expedientes.

Sale además `src/features/case/case-access.ts`, módulo compartido sin `'use server'`, con la regla de visibilidad que estaba escrita a mano en cinco lugares.

### 2.2 GC-A1 + GD-M4 + GC-M5 — el guard de fila (`6b36d84`)

El permiso decía **qué** puede hacer el rol; nada decía **sobre cuál** expediente. Un Abogado o Asistente Legal —que tienen `EDITAR_CASOS` y alcance "Ver casos propios"— podía editar, borrar o cambiar de fase **cualquier** expediente del centro pasando el id directo a la action. Sin tocar la UI, y sin que quedara rastro de que el expediente no era suyo.

- **Mutaciones de expediente: 15** (ver §4.1 — el encargo nombraba 7).
- **Acciones de generación: 7.** Cinco ya cargaban el caso completo, así que el guard va sobre la fila y no añade consulta.
- **Reportes: 3.** No contenían **ni una** referencia a `VER_CASOS_PROPIOS` ni a `operatorId`. En `getFinancialReport` el scope va dentro de `case`: una deuda es visible si su expediente lo es.
- `batchGenerateDocuments` tenía la regla copiada a mano —la quinta copia, y la única dentro de una mutación— y ahora sale del módulo compartido.

Un detalle que importa: **"no ver nada" no es un `where` vacío.** `caseWhereOrNothing` lo traduce a `id: { in: [] }`; un `{}` devolvería el centro entero, que es justo el bug que se quiere evitar. Un rol con `VER_REPORTES` sin alcance obtiene un reporte en ceros.

Las seis `remove*FromCase` reciben el id de la fila hija, no del expediente, así que necesitan subir al padre: para eso está `findParentCaseId`, con un `switch` explícito por modelo (los delegates de Prisma no comparten un tipo que acepte ese `select`, y resolverlo por índice obligaría a un `as any` — el patrón que deja pasar errores de campo).

### 2.3 GC-M6 interino — `deleteCase` (`b5062ed`)

El borrado **sigue siendo físico y en cascada**: el soft-delete es Fase 3 del roadmap (~20 h) y toca el schema. Lo que entra son las tres mitigaciones que caben sin tocarlo.

**(a) Qué roles tienen `ELIMINAR_CASOS`** — verificado contra `src/prisma/seed.ts`, **sin cambiar el seed**:

| Rol | `ELIMINAR_CASOS` |
| --- | --- |
| Administrador | **SÍ** |
| Operadora de Insolvencia | **SÍ** |
| Abogado | no |
| Asistente Legal | no |
| Secretaria | no |
| Usuario | no |

2 de 6, y los dos son de administración. **Ojo:** los roles se editan desde la propia app (`/users`), así que esta tabla describe el seed, no necesariamente lo que hay en producción hoy.

**Decisión (2026-10-17): NO se recorta.** `ELIMINAR_CASOS` queda como está —Administrador y Operadora de Insolvencia en los dos tenants—. Queda anotado como pendiente post-lanzamiento, junto al soft-delete (Fase 3 del roadmap, ~20 h): es la misma decisión de fondo (quién puede destruir un expediente legal) y conviene tomarla una sola vez, cuando el soft-delete ya exista y "eliminar" no sea irreversible.

**(b) Audit log antes de borrar, y esperado.** Estaba después del borrado y sin `await`. Ahora se escribe primero y se espera: si la auditoría falla, el expediente **no** se borra. El snapshot es deliberadamente **no sensible** —número, tipo, fase y conteos de documentos/deudas/bienes/dependientes—; nada de cédula, ingresos, dirección ni acreedores. Hay un test que recorre las claves del `metadata` y falla si aparece alguna de esas.

Se registra también `driveFolderId` y `driveFolderDeleted: false`, que es el pendiente real de GC-M6: **la carpeta no se borra ni se archiva**, y los PDFs con datos personales quedan huérfanos en Drive. Al menos queda anotado qué buscar.

**(c) Confirmación escrita, verificada en el servidor.** `confirmCaseNumber` es obligatorio en `deleteCaseSchema` y la action lo compara contra el `caseNumber` **que tiene la base**. Comparar contra otro campo del mismo payload no confirmaría nada: el cliente controla los dos lados. El diálogo pide teclear el número y mantiene el botón deshabilitado hasta que coincida, pero esa es la fricción, no el control.

### 2.4 GC-M4 — auditoría (`ad608e5`)

**Ver §4.2: el `await` que pedía el encargo no servía por sí solo.**

El registro de `updateCase` decía literalmente *"Se ha actualizado el caso INSOL-000042"* y nada más. No permitía responder *"¿quién le movió la fecha de audiencia?"*, que es exactamente lo que se le pregunta a una auditoría.

No alcanzaba con listar el payload: el formulario de edición reenvía **todos** sus campos, cambiados o no. Hay que comparar contra lo que había, y para eso se leen de la base **únicamente las columnas que el payload trae** — el `select` del diff se suma al que ya existía dentro de la transacción, sin consulta extra.

La comparación se equivoca **a propósito hacia un lado**: los valores llegan en formas distintas a las de la base (el formulario manda `"2026-03-15"` donde hay un `DateTime`, un entero donde hay un `Decimal`), así que un `!==` crudo marcaría todo. `normalizar` reduce las dos partes a algo comparable y, cuando no puede decidir, declara **cambiado**: un "cambió" de más es ruido, un "no cambió" de menos **esconde una edición real**.

Del `metadata` salen los **nombres** de todos los campos cambiados, y los **valores** solo de un allowlist de campos no personales (tipo, trámite, fase, fechas procesales). De `debtorName`, cédula, ingresos o montos queda que cambiaron, no a qué.

### 2.5 GC-M2 — operador del centro (`fc3e555`)

`operatorId` llegaba validado solo como `z.string()` y se escribía con `operator: { connect: { id: operatorId } }`. El `connect` de Prisma solo exige que el id **exista**, no que pertenezca al tenant: bastaba mandar el id de un usuario del otro centro para dejarle un expediente asignado.

Lo llamativo era la asimetría: el **deudor** sí se validaba contra `{ id, tenantId }`, dos líneas más abajo.

- `createCase`: siempre, justo después del parse, antes de buscar el deudor y antes de generar el consecutivo.
- `updateCase`: **solo cuando el payload lo trae.** `pre-generation-form.tsx` manda ediciones sin reenviarlo; exigirlo ahí rompería la pantalla de "Datos requeridos para Admisión". Hay un test explícito para esa regresión.

### 2.6 GC-B2 — rate limit en `createCase` (`deea49e`)

Era la única acción de su peso sin límite. Dispara la generación inicial vía `after()`, que lanza Chromium: un doble click, un reintento del cliente o un bucle dejaban N×Chromium contra el mismo presupuesto de 60 s.

`caseCreation: 10 intentos / 10 minutos, por usuario`. Va **después** del check de permiso, igual que `batchGenerateDocuments`: un rol sin `CREAR_CASOS` no puede gastarle la cuota a quien sí lo tiene.

### 2.7 nodemailer y `npm audit fix` (`4ddb5cd`)

**La advisory señalada no era alcanzable.** `GHSA-8m3c-c648-2xjj` (bypass de `disableFileAccess`/`disableUrlAccess` vía la firma legacy de `resolveContent`). Revisado `src/lib/email.ts` entero:

- No invoca `resolveContent` (0 coincidencias).
- No manda adjuntos: `sendMail` recibe solo `{ from, to, subject, text, html }`. Sin `attachments`, `alternatives`, `raw` ni `icalEvent`.
- No usa contenido por `path:` ni `href:`.
- De la librería solo toca `createTransport` y `sendMail`.

`disableFileAccess`/`disableUrlAccess` solo protegen contenido que referencia un archivo o una URL. Sin adjuntos no había nada que proteger, así que no había nada que puentear.

Verificado también el destinatario, porque varias de las otras advisories son del parser de direcciones: **todos** los `to` salen de la base (`user.email`, `createdUser.email`, `admin.email`), y en `forgotPassword` el correo se usa solo después de que `prisma.user.findUnique` lo encuentre.

**`npm audit fix` (sin `--force`). `package.json` no cambia: solo el lockfile.**

|  | antes | después |
| --- | ---: | ---: |
| total | 69 | 42 |
| critical | 1 | **0** |
| high | 59 | 19 |
| producción, total | 25 | 17 |
| producción, high | 19 | 14 |

`sharp` (CVE-2026-96889 vía librsvg) sale de la lista de high. De paso nodemailer subió 9.0.3 → **9.1.1** dentro del `^9.0.3` que ya había, y eso cierra la advisory de `resolveContent` (cubría `<9.1.0`) más la de IDN/Punycode y una del addressparser. El hallazgo queda cerrado por las dos vías.

Los 23 moderate que aparecen ahora (eran 9) son de la cadena de Jest/babel: dev, no producción. En producción los moderate bajan de 6 a 3.

---

## 3. Tests

| Suite nueva | Casos | Qué protege |
| --- | ---: | --- |
| `security/global-search-access` | 12 | G-A1: gate por categoría y acote del rol cliente |
| `security/case-access-guard` | 25 | el helper de visibilidad en aislamiento |
| `security/case-mutations-row-access` | 10 | que las **actions** llamen al guard |
| `security/report-role-scoping` | 9 | GC-M5: el `where` de los 3 reportes |
| `security/delete-case-confirmation` | 15 | GC-M6: confirmación y orden de la auditoría |
| `components/delete-case-dialog-confirmacion` | 9 | la fricción en la UI |
| `cases/audit-diff` | 23 | el diff: Date↔string, Decimal↔número, PII |
| `security/audit-log-await` | 8 | que el `await` espere, y el diff cableado |
| `security/operator-tenant-validation` | 8 | GC-M2 |
| `security/create-case-rate-limit` | 6 | GC-B2 |

Dos criterios, porque sin ellos los tests no prueban nada:

- **Los negativos afirman que NO se escribió**, no solo que la respuesta sea de error. Un guard puesto *después* de la escritura devolvería el mismo error con la base ya mutada.
- **Hay positivos por rol** (Abogado sobre su propio expediente, Administrador, cliente sobre el suyo). Un guard que bloquea de más rompe el trabajo diario de los dos roles que más usan el sistema.

Verificado que muerden: quitando el gate de categoría y el acote por fila de `globalSearch`, fallan 4 de los 12.

### Suites existentes que se actualizaron (16 archivos)

**Todas por el mismo motivo real, no para que pasaran.** Tres patrones:

1. **Fixtures con CRUD y sin permiso de alcance** (`case-actions`, `pre-generacion-paquetes`, `editar-conciliacion-apoyo`, `tenant.ts`, `case-wizard.db`). Un usuario con `EDITAR_CASOS` y ningún `VER_*_CASOS` **no corresponde a ningún rol del seed**. El usuario irreal era la fixture.
2. **Consultas nuevas sin mockear** (11 suites): el guard del operador y el del expediente padre consultan, y el mock por defecto devuelve `null`.
3. **El `select` de `deleteCase`** pasó de `{id}` a las tres columnas del guard (`case-list-query`). La intención original del test —no traer la fila de 265 columnas— se conserva; cambió cuáles son las tres.

---

## 4. Dos cosas que cambian la lectura del encargo

### 4.1 GC-A1 son 15 mutaciones, no 7 — **necesita tu aprobación**

El encargo nombraba `updateCase`, `deleteCase`, `updateCasePhase`, `addDebtToCase`, `removeDebtFromCase`, `addAssetToCase` y `addDependentToCase`.

Las otras ocho de `case/actions.ts` —`addLibranzaToCase`, `addSuspendedServiceToCase`, `addApoderadoToCase` y las cinco `remove*FromCase`— tenían el agujero **idéntico**, sobre el mismo recurso, con la misma línea de arreglo.

Cerrar 7 de 15 no me pareció un estado defendible: deja ocho puertas abiertas al mismo cuarto, y un revisor lo señalaría de inmediato. **Si preferís que el PR se ajuste a las 7, se saca en un commit aparte** — pero dejar las otras ocho abiertas no cierra GC-A1.

### 4.2 El `await` de GC-M4 no servía por sí solo

`createAuditLog` hacía `void prisma.auditLog.create(...)`: programaba el insert y volvía de inmediato. **Poner `await` en las 16 llamadas, tal cual pedía el encargo, habría esperado nada.** El arreglo real estaba un nivel más abajo.

En Vercel serverless no es teórico: la función puede terminar al devolver la respuesta y matar el insert en vuelo. Un expediente legal editado o borrado quedaba sin registro, de forma intermitente y silenciosa.

Ahora la función espera el insert. Lo que **no** cambia es que nunca lanza: devuelve `{ ok }`. Hay 8 módulos más que la invocan como `void createAuditLog(...)`, y si empezara a rechazar, cada uno de esos `void` sería una unhandled rejection. Devolver un resultado deja que cada llamador decida: `deleteCase` aborta el borrado si la auditoría no quedó; las altas siguen adelante y el fallo queda en Sentry.

---

## 5. Riesgos

### 5.1 🔴 Un rol sin permiso de alcance pierde la edición — **revisar antes de mergear**

Un rol creado a mano desde `/users` al que se le haya olvidado el permiso de alcance (`Ver todos los casos` / `Ver casos propios` / `Ver casos como cliente`) **podía, hasta ahora, editar cualquier expediente del centro; desde este PR no puede editar ninguno.**

*Fail closed* es lo correcto, y es lo que `getAllCases` ya hacía en las lecturas — este PR solo pone las mutaciones de acuerdo con los listados. Pero si existe un rol así en producción, a ese rol se le rompe la edición.

Los 6 roles del seed están bien. **No tengo acceso a producción para comprobar los creados a mano.** Se responde con una consulta de solo lectura: buscar roles con `Editar casos` y sin ninguno de los tres permisos de alcance.

### 5.2 🟡 `deleteCase` ahora puede fallar por la auditoría

Si el insert del audit log falla, el expediente **no** se borra. Es deliberado —un expediente legal destruido sin registro no se puede explicar— pero es un modo de falla nuevo: una caída de la tabla de auditoría bloquea los borrados. Las demás mutaciones no se bloquean.

### 5.3 🟡 El límite de `createCase` es un juicio, no una medida

10 por usuario cada 10 minutos. La carga normal de un centro es de unos pocos expedientes al día, y 10 deja margen para una jornada de carga de atrasos. Si resulta corto para digitar un lote grande, **se sube en una línea**.

Efecto lateral ya resuelto: el limitador in-memory guarda estado por proceso y `test:db` corre `--runInBand`, así que la suite más larga lo agotaba. Se reinicia en su `beforeEach`, y queda advertido en el docblock del test para quien escriba suites nuevas que creen casos.

### 5.4 🔵 Dos cosas que encontré y **no toqué**

- **`placeholder-mapper.test.ts`, el `benchmark … <100ms`:** falla de forma intermitente con la suite completa en paralelo y pasa 5 de 5 veces aislado, **con mis cambios y sin ellos**. Preexistente y ajeno a este PR, pero es un riesgo real para `pr.yml` en un runner compartido: un rojo que no significa nada entrena a ignorar los rojos. (En la corrida final pasó.)
- **`getDocumentsFromDrive`** conserva una sexta copia a mano de la regla de visibilidad. Es una lectura, filtra una lista de archivos de Drive por número de caso (no una fila) y hoy es correcta. Unificarla sería riesgo de comportamiento sin ganancia de seguridad.

### 5.5 El check `Vercel` del PR está en rojo, y es el issue #7

> `Git author MaxitoJM must have access to the project on Vercel to create deployments.`

Es el mensaje exacto del [issue #7](https://github.com/insolventic/insolventic/issues/7): el plan Hobby bloquea el deployment cuando el autor del commit no está vinculado a la cuenta dueña del proyecto.

**No lo toqué, a propósito.** Según `CLAUDE.md`, el autor de lo que se commitea en local es `MaxitoJM <maxitojam@hotmail.com>` (identidad 1a), y el override a `Insolventic <insolvenic@gmail.com>` aplica **solo al commit HEAD de un push a `dev`/`main` que deba disparar un deploy**. "Arreglar" este check exigiría cambiar el autor en una rama de feature —contra la regla— o reescribir historial, que está en el NO TOUCH.

`quality-checks` y `playwright` **sí** se encolaron (la base es `dev`, así que la
trampa del Quick Win 8 no aplica) y **los dos pasaron**: 3m 26s y 3m 6s. O sea
que todo lo que verifica el código está verde y el único rojo es el de autoría.

El `vercel[bot]` comentó en el PR ofreciendo tres salidas, y vale dejar escrito
el veredicto de cada una porque una es activamente mala:

| Opción del bot | Veredicto |
| --- | --- |
| **Hacer público el repositorio** | 🔴 **No.** Proyecto de tesis con expedientes legales reales. El repo tiene el histórico de `.env.example`, los runbooks con la estructura de secretos y los datos de membrete de los dos centros. Sería cambiar un rojo cosmético por una fuga real. |
| **Upgrade a Pro + agregar a `@MaxitoJM`** | 🟡 La salida de fondo. Cierra el issue #7 **y** levanta el techo de `maxDuration = 60 s`, que es el **issue #3** (los lotes de 27 y 49 documentos que hoy no caben). Dos bloqueantes por el mismo movimiento. Implica facturación: es tu decisión. |
| **Solicitar acceso** (link de invitación) | 🟡 Un click tuyo con la cuenta de `MaxitoJM`. Más barato, pero no resuelve el issue #3. |

Recomendación: la segunda, y no por el check de CI —ese es el síntoma menor—
sino porque el plan Hobby es lo que sostiene el issue #3, que sí es un
bloqueante real de entrega.

---

## 6. Lo que necesita tu decisión

| # | Decisión | Estado |
| --- | --- | --- |
| 1 | **¿Las 15 mutaciones o las 7 del encargo?** (§4.1) | ✅ **Aprobado 2026-10-17** — se quedan las 15 |
| 2 | **¿Se le quita `ELIMINAR_CASOS` a `Operadora de Insolvencia`?** | ✅ **Decidido 2026-10-17** — NO se recorta; pendiente post-lanzamiento junto al soft-delete (§2.3) |
| 3 | **¿10 por 10 minutos es el límite correcto para `createCase`?** | Pendiente — depende de cómo se digita en la práctica |
| 4 | **¿Hay roles en producción sin permiso de alcance?** (§5.1) | Pendiente — query lista y validada en `scripts/verificar-roles-sin-alcance.sql`, falta correrla contra producción |
| 5 | **¿Se commitea este documento** como `IMPLEMENTACION_SEMANA_4.md`? | Pendiente |
| 6 | **¿Se vincula la cuenta de Vercel de `MaxitoJM`, o se pasa a Pro?** (§5.5) | Pendiente — implica facturación y/o visibilidad del repo |

Para el punto 4: la query ampliada en `scripts/verificar-roles-sin-alcance.sql`
(sin commitear) cubre los 5 permisos cuya acción pasa por el guard de
visibilidad —`Editar casos`, `Eliminar casos`, `Generar documentos`,
`Ver documentos`, `Ver reportes`— y lista, por rol, cuáles de esos 5 tiene.
Validada contra el seed local: 0 falsos positivos, y detecta correctamente un
rol de control con solo `Generar documentos` y sin alcance.

La 1 y la 4 son las dos que conviene resolver **antes** de mergear. Las otras
cuatro no bloquean el merge.

---

## 7. Scope respetado

**No se tocaron:** `schema.prisma`, migraciones, plantillas, `validation-rules.ts`, seeds, servicios externos, Vercel, `main`. Sin reescritura de historial. El PR queda **abierto y sin mergear**.

Lo único que se levantó fuera del repo fue un Postgres 16 en Docker para `test:db`, en el puerto 54329, borrado al terminar (contenedor y volumen), con Docker Desktop devuelto a su estado inicial (detenido).
