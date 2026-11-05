# Decisiones de arquitectura — Insolventic

Historial de decisiones técnicas por iteración de trabajo. Material de consulta, separado de `CLAUDE.md`, que apunta aquí.

## 2026-11-05 — Comprobantes de pago: 4 MB por server action, sin subida directa a Drive

**Diagnóstico:** la UI y el manual prometían 10 MB, pero el comprobante viajaba en base64 dentro de una server action sin `bodySizeLimit`. Next corta en 1 MB: reproducido contra `next dev`, 760 KB reales pasan y 780 KB rechazan la promesa en el cliente, que mostraba "Error al registrar pago".

**Decisión:** `MAX_COMPROBANTE_MB = 4` (`src/features/payment/constants.ts`) y `bodySizeLimit: '4.25mb'` (`next.config.ts`). El techo es de la plataforma: Vercel corta el cuerpo de las funciones en 4,5 MB. El archivo pasa a viajar como `File` y no en base64, que con ese mismo techo solo dejaría 3 MB.

**Descartado por ahora — subida directa con sesión reanudable de Drive** (la única forma de mantener 10 MB):

- El servidor deja de ver los bytes: tamaño y tipo solo se pueden comprobar después de subidos, y un fallo entre la subida y el registro del pago deja archivos huérfanos que hay que limpiar.
- El flujo pasa de una llamada a tres (abrir sesión, subir, confirmar), y su parte crítica (CORS de la sesión de Drive) no se puede probar sin el Drive real.

Se reabre si 4 MB resulta poco en uso real, por ejemplo con fotos de celular. Que `bodySizeLimit`, la constante y el manual sigan de acuerdo lo vigila `tests/unit/payments/comprobante-limite-tamano.test.ts`.

**Fuera de este cambio:** `uploadCaseDocuments` (alta y edición de casos) tiene el mismo problema y es peor: promete 10 MB por archivo y manda todos los archivos en una sola server action, en base64. `bodySizeLimit` es global, así que ahora le caben unos 3 MB en total, no 10 MB por archivo.

## 2026-11-05 — ¿Alcanzan 4 MB? Drive no lo puede responder; se mide hacia adelante

**Por qué no se midió Drive:** lo que hay guardado no dice cuánto pesa lo que la gente quiere subir, solo lo que cupo.

- Antes de este límite no había `bodySizeLimit`, así que Next cortaba el cuerpo en 1 MB: por la app solo entraban archivos de hasta unos 760 KB. Lo que pase de eso en Drive se subió a mano.
- Los comprobantes fallan desde el 2026-03-24 (`e777c30`): `uploadReceiptToDrive` recibía como carpeta el primer carácter del id. Lo corrige `#178`. Por la app no debería haber ninguno en Drive.

Cualquier porcentaje "sobre 4 MB" calculado con esos datos saldría cerca de cero por construcción, y se leería como evidencia a favor de 4 MB sin serlo. Por eso no se tocó producción.

**Decisión:** registrar cada archivo rechazado por tamaño (`registrarRechazoPorTamano`, `src/lib/rechazo-tamano.ts`) y decidir con esa cifra. Sale el origen, un intervalo y una categoría de tipo, de listas cerradas. No sale el nombre del archivo, ni el peso exacto, ni nada del caso.

- **El contador es el issue de Sentry.** El repo no tiene otra forma de contar eventos. Cada combinación es un mensaje fijo, Sentry agrupa por mensaje, y el número de eventos del issue es la cuenta.
- **Va en `warn` aunque sea un evento esperado.** El rechazo ocurre en el navegador: en `info` no saldría de la consola del usuario. Y va en el mensaje porque `logger.warn` no le pasa el contexto a Sentry.
- **`scrubSentryEvent` les quita la URL, las migas de pan, el usuario, los tags, los contextos y la ruta.** El SDK los agrega por su cuenta y pueden traer datos del expediente. Comprobado con el SDK real contra un receptor local: el evento de rechazo sale solo con mensaje, nivel y metadatos del SDK, y uno de control desde la misma página sí llevaba URL y migas con esos datos.
- **Solo se registra el rechazo de la UI.** `validateReceiptFile` no registra, para no contar dos veces; a esa validación solo se llega saltándose la UI.

**Qué no cuenta:** quien ni lo intenta porque la pantalla ya dice "Máximo 4 MB", y quien comprime y vuelve a subir (cuenta el primer intento). Mientras `documents-section` siga en 10 MB, un documento de 4 a 10 MB no se rechaza al elegirlo, sino que falla al enviarse, y no queda registrado.

**`bodySizeLimit` frente a los topes:**

| Cifra                      | Bytes            | Fuente                                                                                                                                                                        | Estado                                                                                          |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Archivo máximo (4 MB)      | 4.194.304        | `MAX_COMPROBANTE_BYTES`                                                                                                                                                       | Comprobado en `next dev`: pasa con 2.000 caracteres más en el formulario                        |
| Sobrecosto multipart       | 442 más el texto | Medido con `FormData` en Node                                                                                                                                                 | Medido en local                                                                                 |
| `bodySizeLimit` (`4.25mb`) | 4.456.448        | `next.config.ts`, leído con `bytes` como Next                                                                                                                                 | Comprobado en `next dev`: 4,25 MB exactos se rechazan, 3 KB menos pasan                         |
| Tope de Vercel             | 4.493.312        | Preview de `#180`, bisección con `curl` (detalle en `#182`). La [documentación](https://vercel.com/docs/functions/limitations) dice 4,5 MB y `413 FUNCTION_PAYLOAD_TOO_LARGE` | Medido una vez, sin sesión y con un id de acción falso. Con una cookie de 4 KB baja a 4.490.297 |

El tope medido es menor que los 4.500.000 de leer "4,5 MB" en decimal, así que esa lectura no es la más estricta. `bodySizeLimit` queda 33.849 bytes por debajo del tope con esa cookie, y el cuerpo de un `File` de 4 MB (4.194.627 bytes) unos 295 KB por debajo. **Sin verificar:** una subida completa con sesión en un despliegue, y que `NEXT_PUBLIC_SENTRY_DSN` esté definido en producción, sin lo cual el registro no llega a Sentry.

**Cómo decidir:** revisión pendiente en `docs/ROADMAP.md`, Quick Win 10.

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
