# Auditoría Bloque 3 — Operación, documentación y entrega (2026-10-27)

Barrido pedido sobre operación/CI-CD, rendimiento, resiliencia, coherencia documental,
higiene del repo y plan de trabajo. Todo lo medible de abajo se **midió ejecutando**:
la suite completa tres veces, un `next build` de producción real, y las corridas de CI
leídas de la API de GitHub. Lo que no se puede medir desde el repositorio (latencias
contra Neon productivo, memoria real de Chromium en el lambda de Vercel, consumo del plan
Hobby) está marcado **⟨NO MEDIBLE AQUÍ⟩** con el motivo y cómo medirlo.

Rama auditada: `fix/smmlv-fuente-unica` (HEAD `268b077`), con `origin/dev` al día.

Estado por ítem del encargo:

| Ítem | Qué pedía                                                                                                       | Estado                                    |
| ---- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1    | CI/CD, despliegue y reversa, health, smoke, alertas/observabilidad, backups, cron, límites Hobby                | **hecho** (§1)                            |
| 2    | Bundles por ruta, tiempos de carga, N+1, PDF con Chromium, 5.000 casos                                          | **hecho, 2 tramos no medibles aquí** (§2) |
| 3    | Fallos de Drive, Gmail, Upstash, BD y Chromium; estados atascados; recuperación del operador                    | **hecho** (§3)                            |
| 4    | Coherencia CLAUDE.md / README / ARQUITECTURA / RUNBOOK / MANUAL, huecos de handover, documentos faltantes       | **hecho** (§4)                            |
| 5    | Ramas muertas, huérfanos, TODO/FIXME, `console.*`, tests omitidos, estabilidad ×3, cobertura, versión/CHANGELOG | **hecho** (§5)                            |
| 6    | Plan de trabajo priorizado con PRs, orden, horas y decisiones del dueño                                         | **hecho** (§6)                            |

**Resumen en una línea:** la operación (CI, deploy, smoke, runbooks de incidente) está
sólida y por encima de lo normal en un proyecto de tesis; lo que está mal no es cómo se
opera, sino **tres cosas que escalan mal y no avisan** (consultas sin paginar, el cron que
el plan mata antes de su propio timeout, Sentry sin source maps) y **un README que
instruye a configurar producción con las variables equivocadas**.

---

## 1. Operación (ítem 1)

### 1.1 Lo que está bien — medido, no leído

**CI real, verde y rápido.** Últimas 100 corridas de la API de GitHub:

| Workflow                   | Corridas | success | failure | Duración observada |
| -------------------------- | -------: | ------: | ------: | ------------------ |
| `CI` (`pr.yml`)            |       37 |      37 |       0 | 2m17s – 3m31s      |
| `E2E Tests` (`e2e.yml`)    |       20 |      20 |       0 | 2m55s – 9m8s       |
| `Smoke Test` (`smoke.yml`) |       43 |      16 |       0 | 10s – 17s          |

Cero fallos en las 57 corridas de gate. Eso no es suerte: el cacheo está bien hecho
(`setup-node` con `cache: npm`, y el cache de navegadores de Playwright **con la versión
de `@playwright/test` en la clave**, que es el detalle que casi nadie pone y que evita
servir binarios viejos tras un bump). El comentario de `e2e.yml` documenta la medición que
lo justificó (28s → 572s en cuatro corridas sin cache).

**El reemplazo del service container de Postgres por el Postgres preinstalado del runner**
es la decisión correcta y está documentada con la causa real (rate limit de Docker Hub por
IP compartida, que dejaba `test:db` en `skipped` y el gate a merced de una lotería
externa). Los dos detalles no obvios —`CREATEDB` en el rol y `OWNER` en la base por el
cambio de permisos de `public` en PG15— están resueltos y explicados.

**El doble candado de `CI_SKIP_BUILD_TYPECHECK`** (`CI === 'true'` estricto + la variable)
está bien razonado: Vercel define `CI='1'`, así que la comparación estricta lo deja fuera.
El aviso en `next.config.ts` explica por qué no relajarlo. Correcto y verificado.

**El smoke post-deploy prueba lo que importa**, no que la página devuelve 200: verifica
que la BD responde, que una ruta protegida redirige a `/login` (regresión C-1) y que
`/register` está cerrado (C-2). Son tres gates de seguridad, no un ping.

**`/api/health` y `/api/cron/alerts` están bien construidos:** comparación en tiempo
constante con `timingSafeEqual` en los dos, `fail closed` cuando falta el secreto (503, no
ejecución silenciosa), detalle del deploy detrás de token, `Cache-Control: no-store`, y el
timer del health se limpia en `finally` (si no, mantendría viva la lambda 5s después de
responder). Nada de versiones ni connection strings en la respuesta pública.

**`RUNBOOK.md` §5 (rotación de secretos)** cubre los 7 secretos con el impacto de rotar
cada uno, incluido el caso trampa: rotar solo `DATABASE_URL` y no `DIRECT_URL` deja una
falla silenciosa que rompe el _próximo_ build de producción. Eso es conocimiento operativo
real.

### 1.2 Hallazgos

**O-1 🔴 Sentry no sube source maps. Todos los stack traces de producción están
minificados.** No hay `withSentryConfig()` (deliberado: reabre el ENOENT de
`@opentelemetry/api` que rompió los deploys en agosto), pero tampoco hay la alternativa:
cero `SENTRY_AUTH_TOKEN`, cero `productionBrowserSourceMaps`, cero paso de
`sentry-cli sourcemaps upload` en los cuatro workflows. Grep sobre `next.config.ts`,
`package.json` y `.github/workflows/*`: el único hit de la palabra es el comentario que
explica por qué no se usa `withSentryConfig`.

El efecto no es "Sentry no sirve" —`instrumentation.ts` sí inicializa y el
`onRequestError` con `flush` explícito está muy bien resuelto, incluida la razón
documentada (`vercelWaitUntil` es no-op en Node y el evento se perdía)—. El efecto es que
cada error que llega al dashboard apunta a `chunks/740-79d2c44d906524ae.js:1:48213`. Con
expedientes legales reales en producción, un error que no se puede ubicar en el código es
un error que no se puede arreglar sin reproducirlo a ciegas.

La salida no es activar `withSentryConfig` (volvería a romper el deploy): es el upload
independiente con `@sentry/cli` en un paso de CI, que no toca el build de Vercel.

**O-2 🔴 El cron de alertas tiene un deadline interno de 60s pero el plan lo mata a los
10s.** `src/app/api/cron/alerts/route.ts:37`:

```ts
// Vercel Cron on Hobby caps functions at 10s / Pro at 5 min — we stay safely under either.
const CRON_TIMEOUT_MS = 60_000;
```

El comentario y el valor se contradicen: 60.000 ms no está por debajo de 10s. Y la ruta
**no exporta `maxDuration`** — confirmado en el manifiesto del build real:

```json
"/api/cron/alerts": {},          ← sin maxDuration → default del plan (10s)
"/cases":    { "maxDuration": 60 },
"/documents":{ "maxDuration": 60 }
```

Las dos páginas que lo necesitaban lo pusieron; la ruta del cron se quedó sin él. O sea:
el `deadline`, el flag `timedOut` y la respuesta agregada que el código construye con
cuidado **son inalcanzables** — la plataforma corta la función antes de que ninguno de los
tres se evalúe. El operador no ve un `ok: false` con `timedOut: true`; ve una invocación
cortada en los logs de Vercel.

Agravante en §2 (O-3): los escaneos no están acotados, así que esto empeora solo.

**O-3 🟠 Los dos escaneos del cron son N+1 sin cota, y la deuda crece de forma
monótona.** `scanUpcomingHearings` (`alerts.ts:108`) y `scanOverduePayments`
(`alerts.ts:221`) hacen `findMany` **sin `take`**, y después, por cada ítem:
`wasRecentlyNotified` (1 `findFirst`) + `payment.update` condicional +
`notification.create` + lookup del operador ⇒ ~3–4 round trips secuenciales por pago
vencido, × 2 tenants.

El problema no es el número de hoy, es la pendiente: un pago vencido **sigue vencido**
hasta que se paga, así que el conjunto que el cron recorre cada mañana crece mes a mes.
Con 500 pagos vencidos acumulados son ~2.000 round trips secuenciales contra Neon a través
del pooler. A 20–50 ms cada uno son 40–100s, contra un techo de 10s (O-2). El cron empieza
a fallar por crecimiento de datos, sin que nada cambie en el código, y **sin alerta**: no
hay monitor sobre el resultado del cron.

**O-4 🟠 No hay alerta sobre nada de lo que el cron o el smoke detectan.** El smoke corre
post-deploy y falla el workflow; `/api/health` devuelve 503. Pero nada vigila
**continuamente**: no hay monitor de uptime configurado contra `/api/health` (el endpoint
está construido para eso, con `HEAD` y todo, y nadie lo llama), y el resultado del cron
diario no se compara contra nada. Si el cron deja de correr el martes, se descubre cuando
un operador nota que no le llegaron avisos. El runbook §3.6 ("El cron de alertas no
corre") describe cómo diagnosticarlo, lo que confirma que el hueco es la **detección**, no
el procedimiento.

**O-5 🟡 Backups: el procedimiento de restauración está escrito pero nunca se probó, y el
propio runbook lo dice.** `RUNBOOK.md:141`:

> ⚠️ **Pendiente de go-live:** la estrategia de backup y la prueba de restauración
> (hallazgo A-4) siguen sin verificarse. Hasta que se ejecute una restauración de prueba,
> esta sección es teórica.

Esto es honesto y está bien señalado, pero sigue abierto en un sistema **con casos legales
reales en producción**, y combina mal con dos cosas ya conocidas: `deleteCase` borra en
cascada sin soft-delete (trampa de CLAUDE.md, Fase 3 sin hacer), y la deriva de
migraciones hace que el replay desde cero quede a ~30 statements del schema — que es
exactamente el camino que recorrería una restauración a una base nueva. Un backup no
probado + un borrado irreversible + un replay con brecha conocida es la combinación que
convierte un error de operador en pérdida de un expediente.

**O-6 🟡 El 63% de las corridas de "Smoke Test" son `skipped` y se ven igual que un
pase.** 43 corridas, 16 `success`, 27 ni éxito ni fallo. La causa es correcta —el `if:`
filtra `deployment_status` que no sea `success`, y cada deploy emite varios eventos
(`pending`, `building`, …)—, pero el resultado es justo lo que CLAUDE.md advierte como
trampa: _"un `skipped` se lee como verde de un vistazo"_. En el listado de Actions el
workflow aparece 43 veces con ✓ gris. Si el gate real deja de correr, el listado no cambia
de aspecto.

**O-7 🟢 Límites del plan Hobby frente al uso real — compatible, con un margen fino.**

| Límite Hobby                        | Uso real                                                      | Veredicto                  |
| ----------------------------------- | ------------------------------------------------------------- | -------------------------- |
| Crons: 2 jobs, 1 invocación/día     | 1 job, `0 8 * * *` (diario)                                   | ✅ holgado                 |
| `maxDuration` default 10s, máx. 60s | `/cases` y `/documents` en 60 (el máximo); cron en el default | ⚠️ ver O-2                 |
| Memoria de función                  | Chromium + `@sparticuz/chromium`                              | ⟨NO MEDIBLE AQUÍ⟩ ver §2.4 |

`/cases` y `/documents` ya están **en el techo del plan** (60s, no hay más). El comentario
de `src/app/cases/page.tsx:3` lo dice: `after()` consume el mismo presupuesto, y con el
default de 10s el job se cortaba a mitad. No queda margen para crecer sin pasar a Pro: es
una decisión de producto, no técnica (§6).

---

## 2. Rendimiento (ítem 2)

### 2.1 Bundles por ruta — medido con `next build` de producción

```
Route (app)                        Size   First Load JS
┌ ○ /                            2.96 kB        213 kB
├ ƒ /api/cron/alerts               170 B        196 kB
├ ƒ /api/health                    170 B        196 kB
├ ƒ /audit-log                    6.5 kB        309 kB
├ ƒ /calendar                    3.88 kB        299 kB
├ ƒ /cases                       72.4 kB        385 kB   ← la más pesada, con diferencia
├ ƒ /creditors                   12.2 kB        318 kB
├ ƒ /dashboard                   11.3 kB        307 kB
├ ƒ /debtors                     9.94 kB        316 kB
├ ƒ /documents                   19.5 kB        325 kB
├ ƒ /reports                     11.6 kB        314 kB
└ ƒ /users                         13 kB        319 kB
+ First Load JS shared by all                   196 kB
  ├ chunks/4bd1b696…js           54.2 kB
  ├ chunks/740-79d2c44d…js         138 kB       ← el 70% de la línea base
```

Lectura: **la línea base de 196 kB es el verdadero costo**, no las rutas. Toda ruta
autenticada arranca en ~196 kB antes de su propio código, y un solo chunk compartido
(138 kB) es el 70% de eso. `/cases` suma 72.4 kB propios — 6× la siguiente— porque el
wizard de creación, el diálogo de detalle y sus secciones entran en el bundle de la ruta.

Nada aquí es patológico para una app interna de escritorio (385 kB de First Load es
aceptable), y no recomiendo tocarlo antes que §2.3: dividir `/cases` ahorra ~50 kB de
descarga una vez, mientras que la consulta sin paginar cuesta megabytes **en cada carga**.

### 2.2 Tiempos de carga de `/cases`, `/documents`, `/reports`, `/dashboard`

⟨NO MEDIBLE AQUÍ⟩ — las cuatro son `ƒ` (dinámicas, `force-dynamic`) y su tiempo lo domina
la consulta contra Neon, no el bundle. Medirlo desde este repositorio daría el tiempo
contra una base local vacía, que no informa nada sobre producción. El arnés para medirlo
**ya existe y está sin usar**: `tests/load/k6.config.js` tiene tres escenarios
(`smoke` 1 VU/30s, `average` 10 VUs, `peak` 50 VUs) y Trends dedicados
(`login_duration_ms`, `cases_page_duration_ms`, `reports_page_duration_ms`) — exactamente
las rutas del encargo. Falta correrlo contra un entorno con datos:
`k6 run -e SCENARIO=average --env BASE_URL=<preview> tests/load/k6.config.js`.

### 2.3 Consultas N+1 y falta de paginación — el hallazgo de rendimiento del bloque

**P-1 🔴 `/cases` trae TODOS los casos del tenant en una consulta y pagina en el
cliente.** Es el camino completo, verificado de punta a punta:

1. `src/app/cases/page.tsx` → `await getAllCases()` sin argumentos.
2. `src/features/case/actions.ts:208` → `prisma.case.findMany({ where, select, orderBy })`
   — **cero `take`, cero `skip`**. Confirmado: en todo `case/actions.ts` no aparece
   ninguno de los dos.
3. El `select` acota bien las columnas de `Case` (17 de `CASE_LIST_COLUMNS`, el comentario
   presume de no traer las 269 — hoy son 293), pero pide **`debtor: true`**, que trae los
   **56 campos** del deudor por fila, más `operator` (3) y un subquery `_count` de
   documentos **por caso**.
4. `getAllCasesSchema.parse(cases)` — Zod valida las 5.000 filas en el servidor.
5. Las 5.000 filas enteras se serializan al payload RSC y viajan al navegador.
6. `cases-content.tsx:112` → `usePagination(...)` pagina **en memoria del cliente**.

Con los 5.000 casos del encargo: ~77 campos/fila × 5.000 ≈ **7–15 MB de payload RSC** por
carga de página, más 5.000 subqueries de `_count`, más el `parse` de Zod sobre todo el
conjunto — dentro de un presupuesto de 60s que ya es el techo del plan (O-7). La página no
se degrada: se cae, y el síntoma será un timeout de función, no un mensaje.

Lo mismo en escala menor en el resto: **48 `findMany` en las server actions, solo 4 con
`take`**. Los que sí acotan (`audit-log` con `take`/`skip` reales, `payment` en 500,
`search` con `TAKE`, `notification` con `limit`/`offset`) muestran que el patrón se conoce;
simplemente no se aplicó a los listados principales.

**P-2 🟠 `syncDocumentsFromDrive` es un N+1 doble contra la BD.**
`src/features/document/actions.ts:574` y `:633`: por **cada carpeta** y por **cada
archivo** del árbol de Drive hace un `findUnique` y después un `update` o `create`,
secuencialmente. Para un tenant con 5.000 casos × ~10 documentos son ~50.000 archivos ⇒
~100.000 round trips en una sola server action con techo de 60s. Es `upsert` de libro:
`prisma.documentFromDrive.upsert()` por ítem reduce a la mitad, y `createMany`/
`updateMany` por lotes lo deja en decenas de consultas.

**P-3 🟡 N+1 menor en el wizard.** `case/actions.ts:715`: `tx.creditor.findFirst` por
acreedor dentro del bucle de creación. Acotado por diseño (un caso tiene 1–12 acreedores,
según los sintéticos de `tests/db/helpers/casos-sinteticos.ts`), así que es ruido
comparado con P-1/P-2. Anotado para no redescubrirlo, no para arreglarlo ahora.

### 2.4 Generación de PDF con Chromium

**Lo que está bien, y es lo difícil:** `batchHtmlToPdf` reutiliza **un solo proceso de
Chromium** para todo el lote (abre y cierra una `page` por documento, no un browser), que
es la diferencia entre un lote viable y uno imposible en serverless. Los assets se
inlinean antes de renderizar (CSS, `@import` anidados, imágenes a base64) y por eso el
`waitUntil` puede ser `domcontentloaded` en vez de `networkidle` — otra decisión correcta
que ahorra segundos por documento. El troceo en tandas existe y está razonado con números
en `batch-tandas.ts`: ~3 s/documento medidos sobre Admisión INSOLVENCY (8 docs en ~24 s),
42s de presupuesto útil sobre los 60, y `TANDA_TEMPLATE_COUNT = 10` deliberadamente
conservador porque el troceo cuenta **plantillas** y `suspension-juzgados` puede expandir a
varios documentos.

Para el lote de 10 del encargo, la propia medición del proyecto da **~30 s**, dentro del
presupuesto de 42 s. Consistente.

**Tiempo y memoria reales por lote de 10 en el lambda:** ⟨NO MEDIBLE AQUÍ⟩ — en local
`getExecutablePath()` usa el Chrome del sistema y `getBrowserArgs()` devuelve flags
distintos; `@sparticuz/chromium` solo entra con `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`. Medir
en local daría un número que no aplica. Se mide con un `logger.info` de `duration` y
`process.memoryUsage().rss` alrededor de `batchHtmlToPdf` en un preview, por tanda.

**P-4 🟠 `batchHtmlToPdf` descarta documentos fallidos en silencio.** El `catch` por
documento registra en consola y **continúa sin empujar nada a `results`** (comentario:
"Continue with other documents - don't break the batch"). La decisión de no romper el lote
es correcta; el problema es que la función devuelve un array **más corto** que el de
entrada y **no dice cuáles faltaron**. El contrato no distingue "generé 10" de "generé 7 y
3 se cayeron". Aguas arriba `generation-job.ts` sí cuenta `status === 'error'` sobre
`result.documents`, así que el conteo final puede sobrevivir — pero depende de que el
llamador reconstruya la correspondencia por nombre de archivo, no de que la función lo
informe. Debería devolver `{ ok, failed[] }`.

---

## 3. Resiliencia (ítem 3)

### 3.1 Tabla por dependencia

| Falla             | Qué le pasa al usuario                                 | Reintentos        | Estado residual                   | ¿Se recupera solo el operador?                |
| ----------------- | ------------------------------------------------------ | ----------------- | --------------------------------- | --------------------------------------------- |
| **Google Drive**  | Error genérico "Error al subir archivo a Google Drive" | **Ninguno** (R-1) | Documento en BD sin archivo       | Reintentando desde `/documents`; runbook §3.4 |
| **Gmail / SMTP**  | Nada: la acción devuelve `false` y sigue               | Ninguno           | Email perdido, sin cola           | No se enteró de que falló (R-2)               |
| **Upstash Redis** | Nada: degrada a limitador in-memory                    | n/a (fallback)    | Ventana por instancia             | ✅ Sí, transparente                           |
| **Base de datos** | 503 en `/api/health`; errores en pantalla              | Pooler de Neon    | —                                 | Runbook §3.1, el mejor documentado            |
| **Chromium**      | Documento ausente del lote, sin señalar cuál (P-4)     | Ninguno           | Solicitud `COMPLETED_WITH_ERRORS` | Reintentando el paquete                       |

### 3.2 Lo que está bien

**El anti-duplicados es correcto y la decisión de no usar Redis/BullMQ está bien
fundada.** El lock vive en `DocumentGenerationRequest.activeKey` (`"{caseId}:{kind}"`
mientras está activa, `NULL` al terminar; los `NULL` no colisionan en el índice único de
Postgres, así que no hacen falta triggers). Un claim simultáneo choca con P2002 y recibe la
solicitud ya activa en lugar de duplicar. La recuperación de huérfanas está implementada:
pasados `STALE_GENERATION_TIMEOUT_MS` (10 min) el siguiente claim marca la vieja `FAILED`,
libera el lock y reintenta una vez —con `activeKey` en el `where` para que una carrera
entre dos liberadores dé `count = 0` en vez de corromper el estado—.

**`Upstash` degrada abierto, documentado y a propósito:** si Redis falla cae al limitador
in-memory en vez de bloquear logins, con la razón escrita ("dejar a los dos centros sin
poder entrar por un hipo de Redis es peor que degradar la precisión"). Es la elección
correcta para este producto, y el `ok` del flag `degradado` permite verlo en los logs.

**El job de generación no lanza nunca:** todo error termina en la fila de la solicitud
(`failGenerationRequest`) y en una notificación in-app con texto accionable ("Puede
reintentarla desde la sección Documentos del caso"). La notificación es best-effort y no
puede tumbar el job. El `catch` del `failGenerationRequest` comenta correctamente que si
eso también falla, el timeout de claim recupera la fila.

**`RUNBOOK.md` §3.1–§3.7 tiene una entrada por cada componente de la tabla de arriba.** Es
cobertura completa del lado del procedimiento.

### 3.3 Hallazgos

**R-1 🟠 Drive no tiene un solo reintento, y cada `catch` destruye la causa.** Las 13
rutas de error de `src/lib/google-drive.ts` siguen todas el mismo patrón:

```ts
} catch (error) {
  // …
  throw new Error('Error al subir archivo a Google Drive');
}
```

Dos problemas en una línea. **Sin reintentos:** la Drive API devuelve 429 y 5xx
transitorios con normalidad, y son exactamente el caso que un backoff de 2–3 intentos
resuelve sin que nadie se entere. **Y sin causa:** el `Error` nuevo no lleva `cause`, así
que a Sentry y al operador les llega el mismo texto para un token expirado, una cuota
agotada, un 429 y una carpeta borrada a mano — cuatro incidentes con cuatro
procedimientos distintos en el runbook. El runbook §3.4 pide diagnosticar justo lo que el
código acaba de borrar.

CLAUDE.md documenta `logger.warn('Retry attempt', { action: 'drive-upload', attempt, maxAttempts })`
como patrón de la casa. Ese `action: 'drive-upload'` no existe en el código: el patrón está
escrito pero no implementado.

**R-2 🟠 Un email que no sale no deja rastro para nadie.** `src/lib/email.ts` devuelve
`false` en el `catch` (líneas 134, 926) sin lanzar y sin cola. Si el llamador no mira el
booleano —y en varios sitios es best-effort— la notificación simplemente no existió. No hay
reintento, no hay dead-letter, no hay forma de responder "¿le llegó el aviso al deudor?".
En un expediente legal con términos que corren, eso puede importar.

**R-3 🟠 Una solicitud atascada se desatasca sola solo si alguien la vuelve a intentar.**
La recuperación de huérfanas es **pasiva**: vive dentro de `claimGenerationRequest`, así
que se dispara cuando llega un claim nuevo, no por el paso del tiempo. Si la lambda muere a
mitad y nadie reintenta, la fila se queda en `PROCESSING` **indefinidamente**, y la UI
sigue mostrando "generación en curso". Nada la barre: el único cron del proyecto escanea
audiencias y pagos, no solicitudes.

Para el operador el síntoma es "lleva dos horas generando" y la acción correcta es
"esperá 10 minutos y volvé a darle", que **no está escrita en ningún lado** —ni en la UI,
ni en `MANUAL_USUARIO.md`, ni en el runbook §3.3—. Es el caso más probable de llamada al
desarrollador, y el encargo pregunta exactamente por eso: _"cómo se recupera un operador
sin ayuda del desarrollador"_. Hoy, no puede.

Dos arreglos, ambos chicos: barrer huérfanas en el cron que ya corre (reusando
`STALE_GENERATION_TIMEOUT_MS`), y poner el "reintentar" en la UI cuando la solicitud lleva
más de 10 minutos en `PROCESSING`.

---

## 4. Documentación y entrega (ítem 4)

Cada afirmación de abajo se contrastó contra el código ejecutando la comprobación.

### 4.1 `README.md` — cuatro afirmaciones falsas, una peligrosa

**D-1 🔴 El README manda configurar producción con las variables que el runtime
ignora.** Su tabla "Variables de Entorno / Variables críticas" encabeza con:

| Variable                         | Descripción (README)                           |
| -------------------------------- | ---------------------------------------------- |
| `DATABASE_URL_ARMONIA`           | "Conn string de la BD del centro Armonía"      |
| `DATABASE_URL_CONSTRUCTORES_PAZ` | "Conn string de la BD de Constructores de Paz" |

`ARQUITECTURA.md:85` ya corrigió esto el 2026-10-09, con estas palabras: _"**Eso no existe
en el código.** […] las lee únicamente `src/scripts/run-prisma.ts` (script manual) y
`.github/workflows/e2e.yml`; el runtime las ignora. Para configurar o rotar credenciales en
Vercel, las únicas que cuentan son `DATABASE_URL` y `DIRECT_URL`"_. El README no se
actualizó, y **ninguna de esas dos aparece en su tabla**. Quien levante un entorno
siguiendo el README configura dos variables inertes y omite las dos que importan. Es el
hallazgo documental más dañino del bloque porque **induce un error de operación**, no solo
desinforma.

Además la tabla lista `JWT_REFRESH_SECRET` como crítica: grep sobre todo `src/` → **ningún
archivo lo lee**. Igual `NEXTAUTH_SECRET` (presente en `e2e.yml`, leído por nadie). Son
secretos fantasma: se rotan, se custodian y no hacen nada.

**D-2 🔴 El README documenta un workflow de deploy que se eliminó a propósito.** Sección
"### Deploy (`.github/workflows/deploy.yml`)", con detalle: push a `dev` → preview, push a
`main` → producción, "Baseline automático de `20260205212559_init`". Ese archivo **no
existe** (`.github/workflows/` tiene `pr.yml`, `e2e.yml`, `release.yml`, `smoke.yml`), y
CLAUDE.md lo marca como trampa explícita: _"no hay workflow de deploy **a propósito**:
`deploy.yml` se eliminó y el deploy lo hace solo la integración nativa Vercel↔GitHub"_. El
README contradice de frente la decisión registrada.

La misma sección omite `e2e.yml` y `smoke.yml` por completo, y su lista de pasos de
`pr.yml` (5 pasos) le falta `vercel pull`, `tsc --noEmit` y el `npm audit` informativo.

**D-3 🟡 "49 plantillas" en el título de una sección; son 65.** Medido:
`templates/insolvency` 50 + `templates/conciliation` 12 + `templates/support-agreements` 3
= **65**. `docs/TESTS.md:62` ya dice "las 65 plantillas" y la auditoría del Bloque 1 también
— el README es el único desalineado.

### 4.2 El conteo de tests dice cuatro cosas distintas, y ninguna es la correcta

| Fuente            | Afirma                 | Real (medido 2026-10-27, `268b077`) |
| ----------------- | ---------------------- | ----------------------------------- |
| `README.md:185`   | 20 suites / 405 tests  | **164 suites / 2219 tests**         |
| `docs/TESTS.md:3` | 27 suites / 447 tests  | idem                                |
| `CLAUDE.md`       | 97 suites / 1448 tests | idem                                |

**D-4 🟠** Las tres están desfasadas, y CLAUDE.md —la que más pesa, porque se carga en cada
sesión— por **53%**, presentada con falsa precisión ("medido en dev el 2026-10-01, commit
f233b24"). Un número con commit y fecha se cree; este ya no es cierto. Las otras dos
afirmaciones numéricas de CLAUDE.md derivaron menos pero derivaron: `schema.prisma` "1.041
líneas" → **1.094**; `Case` "283 campos" → **293**; "57 archivos de `docs/`" → **58**
(61 contando subdirectorios).

La raíz no es el descuido: es que **ningún check de CI compara esos números con la
realidad**, así que envejecen en silencio. Un paso que falle cuando el conteo se despega
más de un 10% cuesta media hora y cierra la clase entera de hallazgo.

### 4.3 Variables de entorno: 35 en uso, ningún documento las lista todas

**D-5 🟠** El código lee **35** variables (grep de `process.env.*` sobre `src/`).
`RUNBOOK_ENV_VARS.md` —que por el nombre parece el inventario— cubre **solo las de base de
datos**; su propio título lo dice ("Variables de entorno **de la base de datos**") y está
bien hecho para ese alcance, con la rotación paso a paso y los `⟨VERIFICAR⟩` marcados.
`RUNBOOK.md` nombra las operativas. Entre los dos quedan sin documentar en ningún lado:

`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`,
`NEXT_PUBLIC_SENTRY_DSN`, `LOG_LEVEL`, `ALERTS_EMAIL_ENABLED`,
`ALERTS_HEARING_LOOKAHEAD_HOURS`, `ALERTS_DEDUPE_WINDOW_HOURS`, `APP_URL`, `NEXTAUTH_URL`.

Las tres `ALERTS_*` son **parámetros de negocio** (ventana de aviso de audiencias, ventana
de deduplicación) que hoy solo se descubren leyendo `alerts.ts`. Quien reciba el sistema no
sabe que puede ajustar cuántas horas antes avisa de una audiencia.

### 4.4 Huecos de handover

**D-6 🔴 `RUNBOOK.md` §0 "Datos de contacto y accesos" tiene 5 de 9 celdas sin
rellenar:**

| Qué                              | Dónde / quién                            |
| -------------------------------- | ---------------------------------------- |
| Responsable técnico principal    | `⟨COMPLETAR: nombre + teléfono⟩`         |
| Contacto en Centro Armonía       | `⟨COMPLETAR⟩`                            |
| Contacto en Constructores de Paz | `⟨COMPLETAR⟩`                            |
| Proveedor de PostgreSQL          | `⟨COMPLETAR: proveedor + URL del panel⟩` |
| Sentry                           | `⟨COMPLETAR: URL de la organización⟩`    |

Es la primera sección que alguien abre a las 3 de la mañana. Vercel, Upstash y la cuenta de
Google sí están. Rellenar esto son 10 minutos y es el ítem con mejor relación
valor/esfuerzo de toda la auditoría.

**Servicios y cuentas a transferir** — inventario reconstruido desde el código y los
runbooks, porque no existe como documento: Vercel (`insolventics-projects`), Neon
(PostgreSQL), Google Cloud (OAuth de Drive) + la cuenta `insolvenic@gmail.com` (Drive +
SMTP), Upstash, Sentry, GitHub (repo + la identidad de autoría que CLAUDE.md fija). Siete
servicios, ninguno con dueño, plan ni fecha de renovación anotados.

**Procedimientos que faltan por completo:** alta de un usuario nuevo (hay seed de roles y
permisos, y UI en `/users`, pero ningún procedimiento escrito), **alta de un tercer
centro** (y aquí hay una trampa ya documentada en `CHECKPOINT_2026-10-09.md`: el branding
por centro nunca eligió por centro, porque `Case.tenantId` es un cuid y no el slug — quien
intente agregar un centro se choca con eso), y la prueba de restauración (O-5).

**D-7 🟠 Documentos que faltan.** Comprobado por nombre sobre los 58 `.md` de `docs/`:

| Documento                   | Estado    | Para qué hace falta                                                                         |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| Manual de administrador     | **falta** | `MANUAL_USUARIO.md` cubre al operador; nadie cubre roles, permisos, alta de usuarios, Drive |
| Guía de soporte / triage N1 | **falta** | `RUNBOOK.md` §1 es triage técnico, no "qué le digo al operador"                             |
| Preguntas frecuentes        | **falta** | Absorbería las llamadas de R-3 ("lleva horas generando")                                    |
| Acta de entrega             | **falta** | Cierre formal de un proyecto de tesis con producción real                                   |
| Criterios de aceptación     | **falta** | No hay definición escrita de "terminado" contra la cual entregar                            |

Los dos últimos no son opcionales en una entrega académica con casos reales: sin criterios
de aceptación no hay forma de declarar el sistema entregado, y sin acta no queda registro
de qué se transfirió y con qué estado conocido.

### 4.5 Lo que sí está coherente

Para que el balance sea justo: `ARQUITECTURA.md` **se autocorrige con fecha** cuando
describía algo que no existe (el §85 sobre la BD por centro es un modelo de cómo hacerlo).
`RUNBOOK_ENV_VARS.md` declara contra qué archivos se verificó y marca `⟨VERIFICAR⟩` lo que
no se puede comprobar desde el repo. `RUNBOOK.md` §2.2 advierte que el rollback **no**
revierte migraciones. `docs/TESTS.md` marca su propia §4 como no re-verificada en vez de
dejarla pasar por cierta. `CLAUDE.md` mantiene las trampas con la causa real y el número de
PR. Esa disciplina es la que hace que los hallazgos de §4 sean sorprendentes: el problema
no es la cultura documental, es que **el README se quedó en 2026-04 mientras todo lo demás
avanzó**.

---

## 5. Higiene del repo (ítem 5)

### 5.1 Estabilidad de la suite — medida 3 veces

```
RUN 1   164 suites / 2219 tests   todos verdes   22.464 s
RUN 2   164 suites / 2219 tests   todos verdes   18.844 s
RUN 3   164 suites / 2219 tests   todos verdes   17.884 s
```

**Cero flakes en 6.657 ejecuciones de test.** Es un resultado muy bueno y conviene decirlo
sin matizarlo.

**H-1 🟡 Un único síntoma, en la primera corrida:** `"A worker process has failed to exit
gracefully […] tests leaking due to improper teardown"`. No apareció en las corridas 2 y 3
(cache de Jest caliente). No rompe nada hoy; es un handle sin cerrar que en CI se traduce
en segundos de cierre y, el día que se vuelva determinista, en un job colgado. Se localiza
con `npx jest --detectOpenHandles`.

**H-2 🟢 Cero tests omitidos.** Grep de `it.skip`, `describe.skip`, `test.skip`, `.todo`,
`.only`, `xit`, `xdescribe` sobre `tests/`: **0 ocurrencias**. No hay cobertura fingida
desactivando lo que molesta.

### 5.2 Cobertura de las rutas críticas

| Área                      | Suites |
| ------------------------- | -----: |
| `tests/unit/`             |    141 |
| `tests/db/` (Prisma real) |     12 |
| `tests/integration/`      |     10 |
| `tests/security/`         |      8 |
| `tests/form-request/`     |      4 |
| `tests/e2e/` (Playwright) |  **3** |

**H-3 🟠 El E2E es el eslabón fino: 3 archivos para toda la aplicación.** No es un
descuido de prioridad —los `tests/db/` con Prisma real cubren precisamente el agujero que
el mock de Prisma dejaba, y la razón está escrita en `TESTS.md`: el bug de `apoderados` /
`notificationCity` / `otherCauseDetail` rompió la creación de casos durante meses porque
`npm test` mockea Prisma y nunca vio un `Unknown argument`—. Pero las rutas que el encargo
llama críticas (`/documents` end-to-end, `/reports`, el ciclo de pagos) no tienen E2E, y
`db-guard.ts` solo protege de correr contra una base que no sea local. Dicho esto: con 164
suites verdes y 12 suites contra Postgres real, el riesgo residual está más en lo que §2
describe (comportamiento a escala, que ningún test ejerce) que en la lógica.

### 5.3 `console.*` en producción

**H-4 🔴 291 llamadas a `console.*` en `src/` (sin contar tests), y una de ellas inunda el
navegador de cada operador.** CLAUDE.md es explícito: _"Usar `logger` de
`src/lib/logger.ts` — \*\*nunca `console._` directo\*_ en código nuevo"_. La regla dice "en
código nuevo", así que el volumen heredado no la viola de forma retroactiva — pero hay un
caso que no es deuda pasiva:

`src/hooks/use-session-timeout.ts` tiene **30 `console.log`** con emoji
(`🔧 [SessionTimeout]`, `🔍 [SessionTimeout] Auth state:`) y **ninguna guarda de entorno**:
grep de `NODE_ENV` / `development` / `isDev` sobre el archivo → cero hits. Es un hook de
cliente que corre en cada página autenticada y en cada reset del temporizador. **No es
teórico: apareció en mi `next build` de producción**, durante el prerender:

```
🔍 [SessionTimeout] Auth state: { isAuthenticated: false, hasUser: false, userName: 'N/A', … }
🔧 [SessionTimeoutProvider] Initialized with: { timeoutMinutes: 15, … }
```

En producción eso mismo corre en el navegador del operador, y entre lo que imprime está
`userName`. Dos problemas: ruido en la consola de un sistema con expedientes legales, y
datos de sesión en un sitio donde no hacen falta.

Concentración del resto (top 6): `features/document/actions.ts` 46,
`scripts/update-remaining-actions.ts` 31, `lib/email.ts` 27, `features/case/actions.ts` 21,
`lib/google-drive.ts` 13, `lib/html-to-pdf.ts` 9. Los tres del medio son justo los módulos
donde un fallo necesita contexto estructurado en Sentry (R-1, R-2) — ahí migrar a `logger`
no es cosmético, es lo que haría diagnosticables los hallazgos de §3.

No hay regla de ESLint que lo frene: `eslint.config.mjs` extiende
`next/core-web-vitals` + `next/typescript` y no activa `no-console`. Sin regla, el conteo
solo puede subir.

### 5.4 TODO/FIXME — limpio

**H-5 🟢** 29 hits de `TODO|FIXME|HACK` en `src/`, y al revisarlos **28 son falsos
positivos del español**: `P.VER_TODOS_CASOS`, `SI_TODOS_ACREEDORES`, "escapa TODO valor
string". El único real es intencional y ejemplar:
`src/features/case/validation-rules.ts:47` → `TODO(legal) — SMMLV 2026 ESTÁ FIJADO POR UNA
NORMA TRANSITORIA`, con la referencia al Decreto 0159 de 2026 y el procedimiento anual en
`RUNBOOK.md` §7.1. Así se deja un TODO.

### 5.5 Ramas, huérfanos y código muerto

**H-6 🟡 Tres ramas locales sin remoto** (verificado con `git fetch` previo, no contra un
snapshot viejo): `docs/mapa-e-indice-contexto`, `feat/normalizacion-cargo-operadora` y
`main` desactualizada respecto de `origin/main`. Las dos primeras no tienen `origin/*`
correspondiente — o se mergearon y quedó el puntero, o se abandonaron. En remoto solo hay 4
ramas (`main`, `dev`, `fix/smmlv-fuente-unica`, `chore/hook-bloquear-atribucion-agente`):
el remoto está limpio. **No las toco**: borrar ramas es irreversible y es decisión del
dueño (§6).

**H-7 🟡 Dos scripts huérfanos en `src/scripts/`** (del 2026-07-06, sin tocar desde
entonces):

- `update-remaining-actions.ts` — su propio encabezado dice que es un codemod de
  diagnóstico para una migración ya terminada ("identify and update remaining action files
  that need database client updates"). 31 `console.*`. Trabajo hecho, script olvidado.
- `test-database-separation.ts` — prueba la separación por BD que `ARQUITECTURA.md:85`
  declara inexistente en el código. Prueba algo que no existe.

Ninguno está en `package.json` ni referenciado en docs (`run-prisma.ts`, el tercero, **sí**
lo está en tres documentos: ese se queda).

**H-8 🟡 19 archivos sin trackear en el árbol de trabajo**, entre ellos 12
`docs/IMPLEMENTACION_SEMANA_*.md`, `AGENTS.md`, la auditoría del Bloque 1, y
`docs/diseno/`, `docs/gantt/`, `docs/jira/`. Dos consecuencias concretas:

1. Hay dos archivos **modificados** sin commitear (`documents-section.tsx`,
   `validation-rules.ts`) mezclados con 19 sin trackear: el riesgo es perderlos o
   commitearlos sin querer en el PR equivocado.
2. **`docs/gantt/simple/generar.mjs` y `docs/jira/generar.mjs` meten 5 warnings de
   ESLint.** Medido: `npx eslint` sobre el árbol actual da `5 problems (0 errors, 5
warnings)`. En un checkout limpio son 0 —los 5 vienen de archivos sin trackear—, pero el
   día que se commiteen así, se rompe el invariante de CLAUDE.md (_"`npm run lint` debe
   quedar en 0 warnings"_). Los `ignores` de `eslint.config.mjs` no cubren `docs/`.

### 5.6 Versión y CHANGELOG

**H-9 🟠 `1.0.0-rc.1` no está etiquetada: no hay release desde abril.** `package.json` dice
`1.0.0-rc.1`, `CHANGELOG.md` tiene su entrada fechada 2026-10-18, y los tags del repo son
`v0.1.0` y `v0.3.0`. `release.yml` funciona perfectamente —4 corridas, todas en `success`—
pero su última ejecución fue el **2026-04-25**. Seis meses de versión avanzando sin
release, en el proyecto que está a punto de entregarse.

**H-10 🟡 `## [Unreleased]` está vacío con 8 commits encima.** Desde la fecha de `rc.1`
hay 8 commits (correcciones de plantillas, el golden master del mapper, la fuente única del
SMMLV) y ninguno aparece en el CHANGELOG. El bloque existe y no se llena. Para una entrega
académica el CHANGELOG es parte del registro, y `release.yml` **extrae las notas del
release de esa sección** con `awk`: un `[Unreleased]` vacío significa que el próximo
release sale con notas vacías.

Hay además tags de operación (`prod-2026-10-08-aa72050`, `prod-2026-10-10-8e48769`,
`prod-2026-10-19-8b817c5`) y de archivo (`archive/deploy/*`, `archive/vercel/*`) que
conviven con los semánticos. Son útiles, pero mezclar tres convenciones en el mismo espacio
de nombres hace que `git tag` no responda "¿qué versión hay en producción?". Vale una línea
en el README.

---

## 6. Plan de trabajo priorizado (ítem 6)

Criterio de orden: primero lo que **cuesta poco y evita un error de operación ajeno**;
después lo que **rompe por crecimiento sin avisar**; después lo que **hace diagnosticable**
lo anterior; al final la entrega formal. Las horas son de trabajo efectivo con tests,
asumiendo el conocimiento que ya hay en el repo.

### Tanda 1 — Antes de cualquier otra cosa (≈5 h)

| #   | PR                                | Qué incluye                                                                                                                                                                                                                                                                                          | Hallazgos             | Horas |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----: |
| 1   | `docs/readme-al-dia`              | Reescribir la tabla de env vars (`DATABASE_URL` + `DIRECT_URL`; quitar las `_ARMONIA`/`_CONSTRUCTORES_PAZ` como críticas y los secretos fantasma `JWT_REFRESH_SECRET`/`NEXTAUTH_SECRET`); borrar la sección `deploy.yml`; documentar `e2e.yml` y `smoke.yml`; 49→65 plantillas; conteo de tests real | D-1, D-2, D-3, D-4    |     2 |
| 2   | `docs/handover-contactos`         | Rellenar las 5 celdas de `RUNBOOK.md` §0 + inventario de los 7 servicios con dueño y plan                                                                                                                                                                                                            | D-6                   |     1 |
| 3   | `fix/cron-maxduration`            | `export const maxDuration = 60` en `/api/cron/alerts` y alinear `CRON_TIMEOUT_MS` (o el comentario) con el techo real                                                                                                                                                                                | O-2                   |     1 |
| 4   | `fix/session-timeout-sin-console` | Guardar los 30 `console.log` de `use-session-timeout.ts` detrás de `logger.debug`                                                                                                                                                                                                                    | H-4 (la parte activa) |     1 |

PR 1 y 3 son los dos que **evitan un error ajeno**: uno impide configurar producción mal,
el otro impide que el cron muera callado. PR 3 es una línea y es el mejor retorno de toda
la auditoría.

### Tanda 2 — Lo que rompe por crecimiento (≈20 h)

| #   | PR                       | Qué incluye                                                                                                                                                                                                                         | Hallazgos | Horas |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----: |
| 5   | `perf/paginar-casos`     | `take`/`skip` server-side en `getAllCases`; mover `usePagination` a paginación real; quitar `debtor: true` a favor de un `select` de los 4–5 campos que la tabla usa; test que falle si vuelve un `findMany` sin cota en el listado | P-1       |     8 |
| 6   | `perf/upsert-sync-drive` | `upsert` por ítem y lotes en `syncDocumentsFromDrive`                                                                                                                                                                               | P-2       |     4 |
| 7   | `fix/cron-acotado`       | `take` en los dos escaneos + barrido de solicitudes huérfanas en el mismo cron (reusando `STALE_GENERATION_TIMEOUT_MS`)                                                                                                             | O-3, R-3  |     4 |
| 8   | `fix/retry-drive`        | Backoff de 3 intentos en las subidas/creaciones de Drive + `cause` preservada en los 13 `catch` + `logger` con `action: 'drive-upload'`                                                                                             | R-1       |     4 |

PR 5 antes que 6 porque `/cases` lo paga **cada operador en cada carga**, y
`syncDocumentsFromDrive` es una acción puntual. PR 7 cierra O-3 y R-3 en el mismo sitio:
ya hay que tocar el cron.

### Tanda 3 — Hacer diagnosticable lo demás (≈14 h)

| #   | PR                               | Qué incluye                                                                                                                                                                                 | Hallazgos          | Horas |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----: |
| 9   | `obs/sourcemaps-sentry`          | `sentry-cli sourcemaps upload` en CI (**sin** `withSentryConfig`, para no reabrir el ENOENT de `@opentelemetry/api`) + `SENTRY_AUTH_TOKEN`                                                  | O-1                |     4 |
| 10  | `obs/monitor-health-y-cron`      | Monitor de uptime externo contra `/api/health` (el `HEAD` ya existe) + verificación del resultado del cron                                                                                  | O-4                |     3 |
| 11  | `fix/logger-en-modulos-criticos` | `console.*` → `logger` en `document/actions.ts`, `email.ts`, `google-drive.ts`, `html-to-pdf.ts` (~95 llamadas) + regla `no-console` en `eslint.config.mjs` con `src/scripts/**` exceptuado | H-4, R-2           |     4 |
| 12  | `fix/batch-pdf-reporta-fallos`   | `batchHtmlToPdf` devuelve `{ ok, failed[] }` en vez de un array más corto                                                                                                                   | P-4                |     2 |
| 13  | `chore/limpieza-repo`            | Borrar los 2 scripts huérfanos; commitear o descartar los 19 sin trackear; `ignores` de ESLint para `docs/**/*.mjs`; `--detectOpenHandles` para el leak                                     | H-1, H-6, H-7, H-8 |     1 |

PR 9 antes que 11: una vez que los source maps funcionan, migrar a `logger` rinde el doble,
porque el contexto estructurado llega a un stack trace legible.

### Tanda 4 — Entrega (≈24 h, en paralelo con las anteriores)

| #   | PR                            | Qué incluye                                                                                                                                 | Hallazgos | Horas |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----: |
| 14  | `docs/inventario-env-vars`    | Las 35 variables en un solo documento, con las 3 `ALERTS_*` explicadas como parámetros de negocio                                           | D-5       |     2 |
| 15  | `docs/manual-admin-y-soporte` | Manual de administrador (roles, permisos, alta de usuario, Drive) + guía de soporte N1 + FAQ (empezando por "lleva horas generando" de R-3) | D-7       |    10 |
| 16  | `docs/criterios-y-acta`       | Criterios de aceptación + acta de entrega con el estado conocido (incluida la deriva de migraciones y el soft-delete pendiente)             | D-7       |     4 |
| 17  | `chore/release-1.0.0-rc.2`    | Llenar `[Unreleased]`, tag, release; documentar la convención de los tres espacios de tags                                                  | H-9, H-10 |     2 |
| 18  | `test/k6-contra-preview`      | Correr los 3 escenarios de k6 ya escritos contra un preview con datos y anotar los números                                                  | §2.2      |     6 |

**Total ≈63 h.** Si solo hay presupuesto para una tanda, la 1 (5 h) cubre el 80% del riesgo
operativo inmediato. Las tandas 1 y 2 juntas (25 h) dejan el sistema en condiciones de
crecer sin sorpresas.

### 6.1 Lo que tiene que decidir el dueño del producto

Siete decisiones que **no son técnicas** y que bloquean trabajo de arriba:

1. **¿Hobby o Pro?** `/cases` y `/documents` ya están en `maxDuration = 60`, el **techo**
   del plan. La paginación (PR 5) recupera margen, pero si se espera crecer en volumen de
   casos o en tamaño de lote de PDF, Pro (5 min, más memoria, más crons) deja de ser
   opcional. Decidir esto antes de PR 5 cambia su diseño.
2. **¿Cuándo se hace la prueba de restauración?** (O-5) Requiere acceso a Neon y una
   ventana. Es la única forma de convertir `RUNBOOK` §3.1 de teoría en procedimiento. Con
   expedientes reales en producción, un backup no probado no es un backup. **Recomiendo
   tratarla como bloqueante de la entrega.**
3. **Los 5 contactos de `RUNBOOK.md` §0** (D-6): solo el dueño los tiene. 10 minutos de su
   tiempo desbloquean PR 2.
4. **¿Se entrega como `1.0.0`?** (H-9) Hay que decidir si la entrega sale como
   `1.0.0-rc.2` o se promueve a `1.0.0`, y qué se considera dentro del alcance entregado.
   Alimenta directamente PR 16 y 17.
5. **Soft-delete de casos** (Fase 3, sin hacer): `deleteCase` borra en cascada y sin
   recuperación. ¿Entra en el alcance de la entrega o se entrega documentado como riesgo
   aceptado en el acta? No es decisión del desarrollador.
6. **Las 3 ramas locales sin remoto** (H-6): confirmar que `docs/mapa-e-indice-contexto` y
   `feat/normalizacion-cargo-operadora` están mergeadas o abandonadas antes de borrar nada.
   No las toqué por eso.
7. **¿Hay un tercer centro en el horizonte?** Si sí, el procedimiento de alta hay que
   escribirlo **y** resolver primero lo que `CHECKPOINT_2026-10-09.md` ya detectó: el
   branding por centro nunca eligió por centro, porque `Case.tenantId` es un cuid y no el
   slug. Eso es trabajo de código, no de documentación, y no está estimado arriba.

---

## 7. Cómo reproducir

```bash
# Estabilidad de la suite (§5.1) — 3 corridas
for i in 1 2 3; do npx jest --ci --silent 2>&1 | tail -5; done

# Bundles por ruta (§2.1)
NODE_OPTIONS=--max-old-space-size=4096 npx next build

# maxDuration real por función (O-2)
cat .next/server/functions-config-manifest.json

# Salud y duración del CI (§1.1)
gh run list --limit 100 --json name,conclusion,createdAt,updatedAt

# console.* en producción (H-4)
grep -rn "console\.\(log\|warn\|error\|info\|debug\)" src/ --include=*.ts --include=*.tsx \
  | grep -v "__tests__" | awk -F: '{print $1}' | sort | uniq -c | sort -rn

# findMany sin cota (P-1)
grep -rn "findMany" src/features/*/actions.ts | wc -l      # 48
grep -rn -A12 "findMany" src/features/*/actions.ts | grep -c "take:"   # 4

# Variables de entorno en uso vs. documentadas (D-5)
grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*" src/ --include=*.ts --include=*.tsx \
  | sed 's/process\.env\.//' | sort -u

# Tests omitidos (H-2) — debe dar 0
grep -rn "it\.skip\|describe\.skip\|test\.skip\|\.todo\|\.only" tests/ --include=*.ts --include=*.tsx | wc -l

# Source maps de Sentry (O-1) — solo debe aparecer el comentario de next.config.ts
grep -rn "withSentryConfig\|SENTRY_AUTH_TOKEN\|productionBrowserSourceMaps" \
  next.config.ts package.json .github/workflows/*.yml
```
