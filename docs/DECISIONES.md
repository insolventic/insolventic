# Decisiones de arquitectura — Insolventic

Historial de decisiones técnicas por iteración de trabajo. Material de consulta, separado de `CLAUDE.md`, que apunta aquí.

## 2026-11-05 — Cambio de centro: solo por el login

**Diagnóstico:** `switchTenant` elegía la cuenta destino solo por el correo del token, y `updateUser` deja poner en la propia cuenta un correo que existe en otro centro, porque la unicidad es por centro. Con `P.EDITAR_USUARIOS` del centro A se podía entrar a la cuenta de un usuario del centro B sin su clave. Confirmado contra Postgres real en `tests/db/switch-tenant-correo-ajeno.db.test.ts`.

**Decisión:** eliminar la action. Ninguna pantalla la llamaba: "Cambiar Organización" usa `switchDatabase`, que cierra la sesión y lleva al login. Quien tiene cuenta en dos centros cambia entrando con la clave de la cuenta destino.

**Descartado:**

- Pedir la clave de destino dentro de `switchTenant`: exigía una pantalla nueva y mantener una segunda puerta de login para un flujo que ya existe.
- Un vínculo explícito entre cuentas: exigía migración y definir quién lo aprueba y cómo se prueba que ambas cuentas son de la misma persona.

**Non-goal:** cambiar de centro sin volver a poner la clave. Si algún día hace falta, se construye con alguna de esas dos opciones; nunca a partir del correo del token, porque el usuario puede editarlo.

## 2026-11-05 — Documentos del caso: un archivo por llamada y el mismo límite que los comprobantes

**Diagnóstico:** la UI y el esquema prometían 10 MB por archivo, pero `uploadCaseDocuments` recibía todos los archivos del caso en una sola server action y en base64. Reproducido contra `next dev`: un lote de 2 + 1 MB pasa, 2 + 2 MB rechaza la promesa con `Body exceeded 4.25mb limit`, y un solo archivo de 3,5 MB también, porque en base64 ocupa 4,89 MB. El caso ya estaba creado cuando la subida fallaba, y al editar el fallo era silencioso.

**Medición del tope real** (2026-11-05, `File` en una server action real, Chromium):

| Cuerpo o archivo                        | `next dev`                               | Preview de Vercel                     |
| --------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `File` de 4 MB (cuerpo 4.194.627)       | pasa, 10 de 10 (también en `next start`) | llega a la función, 5 de 5            |
| Cuerpo de 4.456.448 (`bodySizeLimit`)   | es el borde; un byte más rechaza         | llega a la función                    |
| Cuerpo de 4.493.312                     | rechazado por `bodySizeLimit`            | último que pasa; uno más responde 413 |
| `File` de 4 MB + 261 KB de otros campos | pasa                                     | sin medir                             |
| `File` de 4 MB + 267 KB de otros campos | rechazado                                | sin medir                             |

Un `File` cuesta su tamaño más 323 bytes de multipart. El preview se midió con `curl` y un id de acción falso, sin sesión: prueba el corte de la plataforma, no una acción completa.

**Decisión:** una llamada por archivo y como `File` (`uploadCaseDocument`), con `MAX_ARCHIVO_MB = 4` en `src/lib/limite-archivos.ts`, compartido con los comprobantes. El límite de los 3 MB por lote era de base64 y del envío conjunto, no del archivo. Quedan 261 KB de margen sobre `bodySizeLimit`, de sobra para los pocos bytes que acompañan al archivo. Los archivos se suben de a uno, porque cada llamada busca o crea la carpeta de adjuntos, y un fallo no detiene a los siguientes.

**Rechazo de la plataforma:** el 413 de Vercel llega como `text/plain; charset=utf-8`, y el cliente de Next solo copia el texto si el tipo es exactamente `text/plain`: la promesa rechaza con "An unexpected response was received from the server.". El rechazo de `bodySizeLimit` llega enmascarado en producción. `errorDeTamanoTrasRechazo` (`limite-archivos.ts`) los traduce al mensaje del límite por los bytes enviados (`new Blob([file]).size`) y, si no, por el texto del rechazo.

## 2026-11-05 — Comprobantes de pago: 4 MB por server action, sin subida directa a Drive

**Diagnóstico:** la UI y el manual prometían 10 MB, pero el comprobante viajaba en base64 dentro de una server action sin `bodySizeLimit`. Next corta en 1 MB: reproducido contra `next dev`, 760 KB reales pasan y 780 KB rechazan la promesa en el cliente, que mostraba "Error al registrar pago".

**Decisión:** 4 MB (hoy `MAX_ARCHIVO_MB`, `src/lib/limite-archivos.ts`) y `bodySizeLimit: '4.25mb'` (`next.config.ts`). El techo es de la plataforma: Vercel corta el cuerpo de las funciones cerca de 4,49 MB (medido). El archivo pasa a viajar como `File` y no en base64, que con ese mismo techo solo dejaría 3 MB.

**Descartado por ahora — subida directa con sesión reanudable de Drive** (la única forma de mantener 10 MB):

- El servidor deja de ver los bytes: tamaño y tipo solo se pueden comprobar después de subidos, y un fallo entre la subida y el registro del pago deja archivos huérfanos que hay que limpiar.
- El flujo pasa de una llamada a tres (abrir sesión, subir, confirmar), y su parte crítica (CORS de la sesión de Drive) no se puede probar sin el Drive real.

Se reabre si 4 MB resulta poco en uso real, por ejemplo con fotos de celular. Que `bodySizeLimit`, la constante y el manual sigan de acuerdo lo vigila `tests/unit/payments/comprobante-limite-tamano.test.ts`.

## 2026-11-03 — Calendario: quién puede abrirlo (solución por ahora)

- Regla: abre el calendario quien tenga `Ver calendario` **o** `Editar casos` (`MODULES.calendar.alternateGatePermissions`). La usan las cuatro puertas: middleware, página, dashboard y `getHearings`. Lo que cada quien ve lo sigue acotando `getHearings`, por centro y por alcance de fila.
- Razón: quien programa audiencias tiene que poder verlas. Se resolvió en código porque los roles de producción son filas en la base y el seed no les llega; asignar el permiso habría exigido una migración de datos que corre sola en el deploy.
- **Limitación aceptada:** un administrador **no puede quitarle el calendario a un rol que edita casos**, aunque el editor de roles lo muestre desmarcado. Mientras el rol tenga `Editar casos`, desmarcar "Calendario" no tiene efecto.
- Estado: aceptada por ahora para cualquier rol con `Editar casos`. Separar el permiso queda como tarea aparte.

## Iteración 3 (2026-08-18) — Deploy: workflow roto → integración nativa de Vercel

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

## Iteración 2 (2026-07-11) — Document Generation P3/P4 + CI Stabilization

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

## Iteración 1 (2026-07-10) — P2 XSS en placeholders

- Escapado OWASP en el **punto de fusión** de `mapCaseToPlaceholders` (safe-by-default) + allowlist de 16 placeholders HTML del sistema; interpolaciones de usuario escapadas dentro de los builders y en `buildConciliationContext`.
- Razón: ~300 claves escalares en ~20 sub-mappers — escapar valor-por-valor garantizaba omisiones futuras.
