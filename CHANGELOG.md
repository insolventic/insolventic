# Changelog

All notable changes to INSOLVENTIC will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Papelera de casos.** Eliminar un caso ya no lo borra: lo manda a una papelera, desde donde se puede restaurar tal como estaba. Mientras está en la papelera no aparece en listados, búsquedas, reportes, alertas, pagos ni documentos, y no se puede modificar. La papelera la ve quien puede eliminar casos.
- **Eliminación definitiva** desde la papelera, con un permiso nuevo ("Eliminar casos definitivamente") que se asigna solo al rol Administrador. Pide escribir el número del caso y queda en la auditoría. Existe para poder cumplir una solicitud de supresión de datos.

### Changed

- **Eliminar un deudor ya no borra sus casos.** Antes se llevaba todos sus expedientes sin la confirmación ni la auditoría de eliminar un caso; ahora se niega si el deudor tiene casos, incluidos los de la papelera.
- La auditoría distingue "Restauración" y "Eliminación definitiva".
- **Ningún monto puede ser negativo ni superar $1.000.000.000.000.000** (capital, intereses, garantías, valor de bienes, libranzas, servicios, ingresos y gastos, pagos). Antes una deuda negativa se imprimía como `-$ 3` en el documento, y un monto enorme salía con dígitos basura.
- **El teléfono tiene formato**: entre 7 y 15 dígitos, con espacios, `+`, `-`, paréntesis y «ext.». Se exige al crear y, al editar, solo si el teléfono cambió.
- **Los textos tienen longitud máxima**: 200 caracteres en nombres, documentos y ciudades, 254 en correos, 500 en direcciones y 10.000 en texto libre. Al editar se valida solo lo que cambió, así que un registro viejo se sigue pudiendo editar.
- "Monto" (seguimiento de pagos del caso) y "Valor pagado" (Reportes) aceptan el separador de miles, como el resto de los montos.

### Seguridad

- **Un error interno ya no llega a la pantalla.** Cuando algo fallaba por dentro (la base de datos, la red, Google Drive), el aviso mostraba el detalle técnico del fallo; y un dato inválido devolvía la lista completa de errores de validación, en inglés. Ahora el aviso dice qué operación falló, el detalle queda en el registro de errores, y los avisos de validación salen en español, uno a la vez. Los mensajes pensados para el usuario (permisos, "no encontrado", el motivo de un cambio de fase no permitido) siguen igual.
- Dependencias al día dentro de sus versiones: `next` 15.5.29 y `@sentry/nextjs` 10.78, que cierran las dos vulnerabilidades críticas de `npm audit`. Las que quedan piden un cambio de versión mayor (`prisma` 7, `puppeteer-core` 25, `next` 16, `nodemailer` 10) y van aparte.
- `zod` queda fijado en 4.1.12 exacto: 4.6 cambia cómo se validan los campos opcionales con preprocess y `updateCase` empieza a rechazar ediciones válidas (58 tests en rojo). Subirlo es un cambio propio, no una actualización de rutina.

### Fixed

- **Crear un caso ya no borra los ingresos de la ficha del deudor.** El asistente de alta enviaba ingresos, gastos y otros ingresos en 0, y la certificación laboral en «no», aunque esos campos no se muestran ahí; al crear cualquier caso, la ficha del deudor quedaba con ingreso 0.
- Los montos de la interfaz salen sin decimales (antes, por ejemplo, `$8.916.666,667` en "Promedio por Caso").
- Tildes que faltaban en el formulario de datos previo a la generación (radicación, designación, aceptación, aprobación, Admisión).
- Accesibilidad: el buscador de casos y la deuda total del asistente tienen nombre para lectores de pantalla, y cada pantalla tiene un solo título principal.
- **Un caso con una fase antigua ya no queda sin salida.** Se mostraba como «Inicial» y a la vez decía «No hay transiciones disponibles»; ahora ofrece las mismas transiciones que «Inicial», que son las que el servidor ya aceptaba.
- El detalle del caso se titula con el número del expediente y no con su identificador interno.

## [1.0.0-rc.2] - 2026-11-08

### Seguridad

- **La pantalla de Usuarios enviaba al navegador el hash de la contraseña de todos los usuarios del centro.** Ya no sale del servidor. (#172)
- **Los avisos de expediente de la campana llegaban a todo el centro.** Ahora llegan solo a quien puede ver ese expediente: un abogado ya no recibe avisos de casos que no tiene asignados. (#169)
- Se elimina el cambio de centro sin contraseña: con permiso para editar usuarios, alguien podía ponerse el correo de un usuario de otro centro y entrar a ese centro. "Cambiar Organización" sigue funcionando igual, pidiendo la clave de la cuenta destino. (#176)
- Editar un usuario ya no cambia su contraseña por esa vía; para eso están "Cambiar contraseña" y el restablecimiento por correo. (#175)
- Controles de centro que faltaban: no se puede asignar a un caso un deudor de otro centro (#168), crear un usuario con un rol de otro centro (#170), ni dar a un rol permisos de otro centro (#179).
- Lo que le pasa a una cuenta (alta, baja, cierre de sesiones, cambio y restablecimiento de contraseña) queda en el registro de auditoría antes de responder; antes algunas de esas entradas se podían perder. (#173)
- Lo mismo para contactos, acreedores, deudores, documentos, pagos y roles: sus cambios quedan en el registro de auditoría antes de responder, y no se pierden si la función termina antes de escribirlo. (#177)

### Fixed

- **Documentos del caso y comprobantes de pago: límite real de 4 MB por archivo.** La pantalla prometía 10 MB, pero un archivo de más de unos 3 MB hacía fallar el alta o la edición entera con un error de la plataforma, sin decir qué archivo era. Ahora el límite se avisa al elegir el archivo, los documentos se suben de a uno y, si alguno falla, el caso queda guardado y el aviso dice cuál no se subió y por qué. Vale para el alta y la edición de casos, el seguimiento de pagos del caso y "Registrar pago" en Reportes. (#182)
- Los comprobantes de pago quedaban en Drive en una carpeta con el primer carácter del nombre esperado; ahora quedan en `{número del caso}/Comprobantes/`. (#178)
- **Editar un caso de insolvencia fallaba con un error de base de datos** por las fechas de cesación de pagos, de inicio de pago propuesto y de radicación. (#183)
- **Una sola fuente para el salario mínimo (SMMLV) y los umbrales de cuantía.** El formulario de alta, el servidor y los documentos usaban tres valores distintos y podían contradecirse sobre el mismo expediente (por ejemplo, exigir apoderado en pantalla y no en el servidor, o imprimir $1.300.000 como salario mínimo). Ahora el año del SMMLV sale de la fecha de radicación del expediente. (#154)
- **Los formularios ya no muestran errores antes de que el usuario haga algo.** Al trabajar en "Crear nuevo caso" podían aparecer avisos en rojo —"La deuda total es requerida", el ícono de error en "1. Solicitante" y el mensaje "Campos incompletos"— sin que nadie hubiera intentado guardar. Ahora un error aparece solo cuando el usuario sale de un campo, pulsa "Siguiente" o pulsa "Crear" / "Guardar". Se corrigen en concreto (#151):
  - El botón para crear un deudor nuevo desde el formulario del caso, además de abrir su ventana, intentaba guardar el caso a la vez. En la edición de un caso podía llegar a guardarlo.
  - "Siguiente" en la penúltima pestaña intentaba crear el caso y devolvía al usuario a la primera pestaña con errores. En Conciliación y Acuerdo de apoyo eso impedía llegar a la última pestaña con "Siguiente".
  - El formulario de Acuerdo de apoyo exigía una "deuda total" que no tenía dónde escribirse, y por eso no dejaba crear el caso.
  - Las ventanas de nuevo deudor, nuevo acreedor, nuevo usuario, nuevo rol y edición de deudor o de rol volvían a abrirse con los errores —y los cambios descartados— de la vez anterior.
  - La ventana de registrar un pago podía abrirse con un mensaje de error que no le correspondía.
- Cuando la generación de documentos falla en parte, el sistema dice cuáles documentos no pudo generar (#163), y los errores de Google Drive conservan su causa para que el reintento decida bien (#162).
- La tarea diaria de alertas tiene un tiempo máximo declarado (#155), acota sus búsquedas y libera las generaciones de documentos que quedaron colgadas (#161).

### Changed

- El listado de casos se pagina en el servidor: ya no se cargan todos los casos para mostrar una página. (#159)
- La sincronización de documentos con Drive se hace por lotes y no fila por fila. (#160)

### Observabilidad

- Aviso cuando la aplicación deja de responder o la tarea diaria no corre (monitor de `/api/health` cada 30 minutos y monitor de cron en Sentry). (#165)
- Los errores de correo y de generación de PDF, y las trazas del cierre de sesión por inactividad, pasan por el logger con redacción de datos personales. (#164, #156)

### Interno

- Documentación y handover al día: README, runbook y CLAUDE.md. (#152, #153, #157, #158)
- Hook `commit-msg` que rechaza trailers de atribución de herramientas, y lint en 0 warnings tras borrar dos scripts huérfanos. (#150, #166)

## [1.0.0-rc.1] - 2026-10-18

### Changed

- **Un solo wrapper de Sentry**: `src/lib/observability.ts` (`reportError` / `reportMessage`) se elimina y sus llamadores (cron de alertas y scanners de `notification/alerts.ts`) pasan a `logger.error`, que ya tenía entrega garantizada en serverless (`waitUntil` + `flush`). `logger.error` ahora envía `action` como tag de Sentry (lo que `reportError` aportaba) y el contexto pasa por la redacción de PII. `generation-job.ts` deja de capturar además de forma directa: cada fallo de generación producía **dos** eventos en Sentry.

### Removed

- **Campos `rejection` y `withdrawal` de `Case`** (Paso 5 de `docs/DISENO_FASES_NUEVAS_2026-09-11.md`): la fase (`Rechazo` / `Retiro`) es la única fuente de verdad. Ninguna lógica los leía y estaban siempre en `false`. Se retiran del código y del schema, y una migración escrita a mano borra las columnas (con guarda: aborta si algún caso las tuviera en `true`). **Promover en dos tiempos**: primero el commit que retira el código, después el de la migración (ver el encabezado de la migración `20260930000000_drop_rejection_withdrawal_from_case`).

### Added

- **Logger estructurado (Fase 2.1)**: `src/lib/logger.ts` — niveles ERROR/WARN (→ Sentry) e INFO/DEBUG (consola JSON, gated por `LOG_LEVEL`), con redacción automática de PII/secrets en el contexto; `beforeSend` compartido de Sentry (`sentry-scrub.ts`) redacta cookies/headers/query params; boundary global de errores (`app/global-error.tsx`). Rutas críticas migradas (~50 refs): auth (actions, lib, hook `use-auth` — fuera los logs con emojis del build), generación de documentos (job, service, retry) y error boundaries.

- **Lock anti-duplicados de generación (P3)**: tabla `DocumentGenerationRequest` con unicidad parcial sobre `activeKey` — dos generaciones simultáneas del mismo tipo sobre un caso son imposibles a nivel de BD; la llamada perdedora recibe el `requestId` de la activa.
- **Generación inicial en background (P4)**: `createCase` responde de inmediato y el job corre post-response (`after()` de Next), con estado consultable (`getGenerationRequestStatus`), recuperación de locks huérfanos (timeout 10 min), retry con backoff en llamadas a Drive y notificación in-app al terminar o fallar.

### Fixed

- **Totales de bienes de la "Solicitud de Insolvencia" (`TOTAL_INMUEBLES`, `TOTAL_MUEBLES`, `TOTAL_BIENES` y los `MUEBLE_*_VALOR`)**: `mapAssets` sumaba los `Prisma.Decimal` de los activos con `+`, y `Decimal.valueOf()` devuelve un string, así que concatenaba en vez de sumar (un inmueble de $100M sin muebles salía como $1.000M; con más activos, cifras de 15 dígitos). Afectaba a todo documento generado por la ruta automática (creación de caso, generación inicial), que pasa la fila de Prisma sin convertir. Ahora cada sumando pasa por `Number()`. Test de regresión con `Prisma.Decimal` real y comparación de la salida completa del mapper entre `Decimal` y `number`.
- Los totales de ingresos y deudas del formulario de creación de casos podían mostrar "NaN" (un error en pantalla, no un número) cuando el monto se escribía con coma decimal en vez de punto. (#144)
- Se corrige un error que impedía generar los documentos de un caso, en los dos centros. (#146)

### Changed

- **`generateFromTemplates` (generación automática de documentos) corre en 3 fases** — preparar (validar + rellenar HTML), renderizar en lote (`batchHtmlToPdf`, un solo Chromium), subir a Drive — en vez de lanzar y cerrar un navegador por documento (P1 de `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`). Medido con Chromium real (sin Drive): creación de caso (3 documentos) 1455ms → 945ms; admisión (6 documentos) 3426ms → 2133ms (~35-38% más rápido). Los dos lotes grandes que hoy exceden `maxDuration=60s` (Fracaso sin filtrar, paquete completo) siguen rotos en esta entrada — resuelto después, ver Issue #3 y los PR posteriores.

### Seguridad

- **Búsqueda global**: era la única función del sistema sin control de permisos — cualquier usuario con sesión podía escribir dos letras y ver nombre, cédula y correo de todos los deudores del centro. Ahora exige el mismo permiso que cada listado (casos, deudores, acreedores) y, para el rol de cliente, limita el resultado a sus propios expedientes. (#137)
- **Verificación de acceso por expediente** añadida en las operaciones que cambian datos, generan documentos o producen reportes — antes esa verificación existía en unos lugares y en otros no. (#137)
- **Eliminar un expediente** ahora exige escribir su número para confirmar, y la acción queda en el registro de auditoría antes de ejecutarse, no después. (#137)
- **El registro de auditoría de una edición de caso** ahora detalla qué campos cambiaron, no solo que "se editó el caso". (#137)
- Se valida que el operador que se asigna a un caso pertenezca al mismo centro de conciliación. (#137)
- Límite de intentos al crear casos, para frenar un uso abusivo de la función. (#137)
- **Revocación de sesiones**: cambiar la contraseña, o que un administrador fuerce el cierre de sesión de un usuario, ahora invalida de verdad las sesiones abiertas en otros dispositivos — antes seguían activas hasta por 24 horas más, sin importar el cambio de contraseña. (#140)

### Documentos y conciliación

- **Membrete y firma propios por centro de conciliación**: cada centro genera sus documentos con su propio logo, nombre y firma de la conciliadora — antes todos los documentos salían con el membrete de un solo centro, incluso los del otro. (#126, #132, #133, #134, #135)
- Se corrige un error de fondo que hacía que ese membrete por centro **nunca** funcionara en la práctica: el sistema comparaba un identificador interno que no era el que correspondía, así que siempre caía al membrete por defecto. (#128)
- **Registro de apoderados de un acreedor**: se puede capturar quién representa a cada acreedor al crear el caso. (#130, #131)
- Se agrega una referencia legal genérica (Ley 2220 de 2022) en 3 plantillas de conciliación que no citaban ninguna norma: Aclaración de Acta, Auto de Desistimiento e Informe Conciliador. (#129)
- **Separador de miles en los 27 campos de dinero del formulario** (se escribe "1.500.000" en vez de "1500000"), y se corrige un error de cálculo relacionado que ese mismo cambio habría hecho más visible. (#136)
- **Formulario de conciliación ampliado**: datos de la audiencia virtual por Zoom, las fechas reales de solicitud, citación y desistimiento (antes el sistema asumía, por error, que esos hechos habían ocurrido "hoy" si no se informaban), y los datos de la Aclaración de Acta (qué se corrige y los valores correcto/incorrecto). (#138, #139)
- El campo de cuantía de la audiencia de conciliación y el monto mensual del acuerdo de apoyo ahora aceptan el formato colombiano de dinero (1.234,56) como el resto de los campos del sistema; antes un monto no numérico se guardaba en el documento como "$0" sin ningún aviso. (#145)
- El apoderado (representante legal) del deudor ahora se registra en un solo lugar del formulario; se quita un campo duplicado que ya no hacía falta. (#147)
- El selector para registrar un bien del deudor ahora se elige en dos pasos (primero la categoría, después el tipo exacto), para evitar confusiones. De paso se corrige que un bien de tipo "Equipo" guardado con la versión anterior del formulario podía desaparecer de la tabla de bienes de la Solicitud de Insolvencia, aunque sí se sumaba al total. (#148)
- Se corrige que la bandeja de notificaciones podía quedar vacía, con un error, cuando llegaba el aviso de que los documentos de un caso terminaron de generarse (o fallaron). (#149)

### Operación

- **Generación de documentos por lotes grandes troceada en tandas**, con progreso visible y la opción de reintentar solo la tanda que falló — antes un lote grande (por ejemplo, generar todos los documentos de un caso de una vez) podía no completarse sin ninguna forma de reintentar solo la parte que faltaba. (#140)
- Las pruebas automáticas de extremo a extremo dejan de depender de un servicio externo (Docker Hub) que fallaba por un límite ajeno al proyecto y dejaba pruebas importantes sin correr sin que se notara con claridad. (#127)
- Ajuste en la integración continua para que un cambio que depende de otro cambio todavía no incorporado también dispare las pruebas automáticas correspondientes — antes se quedaba sin verificar en silencio. (#142)

### Documentación

- **Páginas públicas de política de privacidad y términos de uso** (borrador, pendiente de revisión legal), accesibles sin necesidad de iniciar sesión. (#141)
- **Procedimiento interno** para atender una solicitud de una persona sobre sus propios datos (conocerlos, corregirlos o pedir que se eliminen). (#141)
- Manual de usuario actualizado a lo que el sistema hace hoy. (#141)

## [0.3.0] - 2026-04-15

### Added

- **Proactive alerts (in-app + email)**:
  - `hearing_upcoming` — notifica al operador asignado 48h antes de una audiencia.
  - `payment_overdue` — notifica al operador cuando un pago vence sin registrarse y marca el pago como `vencido`.
  - Scanners puros en `src/features/notification/alerts.ts`, deduplicados por `(type, relatedId, userId)` dentro de una ventana de 20h.
  - Cron endpoint `/api/cron/alerts` protegido con `CRON_SECRET` (Bearer). Schedule por defecto 08:00 UTC diario (`vercel.json`).
  - Email opcional (`ALERTS_EMAIL_ENABLED=true`) con plantilla genérica `emailService.sendAlertEmail(...)`.
- **Observabilidad — Sentry**: configs `sentry.{client,server,edge}.config.ts` + wrapper `src/lib/observability.ts` (`reportError` / `reportMessage`). Sin DSN → degrada a `console` (no-op).
- **Vercel Analytics + Speed Insights** inyectados en `app/layout.tsx`.
- **Exportación a Excel del reporte de Trazabilidad de Pagos** (`exportPaymentTrackingToExcel`, rate-limited, 2 hojas: Resumen + Pagos).
- **Workflow `e2e.yml`**: Playwright (chromium) con Postgres service + seed determinístico, PRs + manual dispatch, artefactos (HTML report + traces) en fallo.
- **Icons + colores** para notificaciones de alertas (Calendar ámbar / AlertTriangle rojo).

### Changed

- **Notificaciones — schema**: `notificationTypeSchema` ahora se genera desde una tupla única (`NOTIFICATION_TYPES`). `getNotificationStats.byType` pasó de 15 counts paralelos a un solo `groupBy` — escala automáticamente al agregar tipos.
- **Notificaciones — API tipada**: `createNotificationForAction` acepta únicamente `CrudNotificationType`; las alertas proactivas fluyen por `alerts.ts` (fuera del action-map).
- **`vercel.json`**: añade sección `crons` con el endpoint de alertas.
- **`.env.example`**: nueva sección "Alertas Proactivas (Cron)" con `CRON_SECRET`, `ALERTS_HEARING_LOOKAHEAD_HOURS`, `ALERTS_DEDUPE_WINDOW_HOURS`, `ALERTS_EMAIL_ENABLED`.
- **Cron endpoint**: comparación de `CRON_SECRET` ahora usa `crypto.timingSafeEqual` (constant-time) en lugar de `!==`.
- **Tenant config consolidada**: 4 formularios de auth (`login`, `register`, `forgot-password`, `reset-password`) ahora importan de `@/lib/tenant-theme` — eliminado `databaseInfo` local duplicado.
- **Estrategia de ramas simplificada**: solo `main` + `dev`. Eliminada rama `stg` de todos los workflows (`pr.yml`, `deploy.yml`, `e2e.yml`) y docs.
- **`deploy.yml`**: `dev` → preview, `main` → producción. Renombrado de "Deploy to Staging & Production" → "Deploy".

### Removed

- Dependencias no utilizadas: `cookies`, `libreoffice-convert`, `pizzip`, `jsdom`.
- Referencias a rama `stg` en workflows, README, y documentación de arquitectura.

### Fixed

- `.gitignore`: excluye artefactos de tesis (`*.docx`, `*.pptx`, diagramas PNG) de la raíz del repo.
- `.vercelignore`: excluye `tests/`, `docs/`, `.github/`, configs de test y artefactos académicos del bundle de producción.

### Tests

- **+17 tests** (unit/alerts.test.ts × 7, unit/observability.test.ts × 3, unit/cron/alerts-route.test.ts × 7) — **23 suites / 422 tests verdes**.
- E2E Playwright realineado con los usuarios del seed (`beatriz.malavera@insolventic.com` / `123456`, tenant `armonia`) y navegación vía `?db=<tenant>` URL param.

### Security

- `CRON_SECRET` se compara con `crypto.timingSafeEqual` (constant-time).
- Cron endpoint emite `requestId` en toda respuesta (éxito o fallo) para trazabilidad en logs.
- Cron endpoint aplica timeout duro de 60s por ejecución; si se excede devuelve `ok: false, timedOut: true` sin reventar el deployment.

## [0.2.0] - 2026-04-14

### Added

- **Case edit with optimistic locking**: `version` field propagado al Zod schema + `edit-case-dialog`. Conflictos muestran toast y cierran el diálogo.
- **Case type filter** en el listado de casos (Insolvencia / Conciliación / Acuerdo de Apoyo).
- **Inline document preview** para PDFs e imágenes usando Google Drive embedded viewer.
- **Empty states** en tablas de casos, deudores y acreedores.
- **Payment receipt upload** con soporte PDF/JPG/PNG hacia Google Drive (`/Comprobantes/`).
- **Documentación completa**: README, ARQUITECTURA (con diagramas Mermaid), MANUAL_USUARIO, TESTS.
- **Tests en CI**: `jest --ci` ejecutado en cada pull request contra `dev`/`stg`/`main`.

### Changed

- **Refresh token security hardening**: expiración reducida de 30 días → 7 días.
- **`mustChangePassword` enforcement**: ahora se valida también en `refresh` y `switchTenant`, no solo en login.
- **Documentos requeridos**: Tradición y libertad + Poder pasan a ser condicionales (no siempre requeridos).
- **Reporte Estado de Casos**: Conciliación y Acuerdo de Apoyo ya no muestran montos engañosos (campo `showMonetary`).
- **.env.example**: documentado exhaustivamente con comentarios por sección.

### Fixed

- Prisma mock en tests: agregados modelos faltantes (auditLog, payment, paymentReceipt, etc.) para evitar `Cannot read properties of undefined`.
- Drive centro tests: alineados a nombres canónicos "Armonía" y "Constructores de Paz".
- Document generation tests: 36 tests verdes (antes: 31/36) tras alinear mock de Select con nueva UI de paquete + formato.

### Tests

- **20 suites / 405 tests verdes** (antes: 7 suites fallando).

## [0.1.0] - 2026-03-08

### Added

- **Authentication module**: Login, register, forgot/reset password with JWT sessions, RBAC (6 roles, 30+ permissions), session timeout with auto-logout.
- **Case management**: Full CRUD for insolvency, conciliation, and support agreement cases. Multi-tenant with `tenantId` isolation. Case creation form with validation rules and document requirements.
- **Debtor management**: Debtor profiles with personal/financial data, linked to cases.
- **Creditor management**: Creditor registry with debt tracking per case.
- **Document generation**: 49 HTML templates organized in 5 packages (Solicitud, Admision, Negociacion, Terminacion, Fracaso). Placeholder mapper with 300+ variables. Batch PDF generation via Puppeteer. Google Drive storage with automatic folder hierarchy.
- **Document upload**: Secure file upload with MIME type validation, filename sanitization, and size limits (10MB).
- **Google Drive integration**: OAuth2 authentication, folder hierarchy management, template sync, document sync.
- **Dashboard**: 6 task modules (Cases, Creditors, Debtors, Documents, Notifications, Users) with help tooltips for onboarding.
- **Drive folder separation**: Separate Google Drive folders per conciliation center (Armonia/Construpaz) with cross-center security validation.
- **Security hardening**: Rate limiting, input sanitization, XSS prevention, CSRF protection, secure headers (CSP, HSTS, X-Frame-Options). 90 security tests.
- **Form validation**: Complete insolvency form validation with document requirements. 75 validation tests.
- **Versioning system**: Semantic versioning with centralized config, UI version badge, environment labeling, CHANGELOG, GitHub release workflow.
- **Test suite**: 384+ automated tests across unit, integration, and component testing.
- **Deployment**: Vercel deployment pipeline with CI/CD.
