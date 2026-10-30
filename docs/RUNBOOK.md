# Runbook operativo — INSOLVENTIC

Guía de respuesta a incidentes, rollback y operaciones de emergencia.
Escrita para que alguien que no tocó el código en semanas pueda actuar a las
2 de la mañana sin leer el repositorio entero.

> **Campos marcados `⟨COMPLETAR⟩`**: datos que dependen de las cuentas y no
> están en el código. Rellenarlos es parte de la preparación de go-live.

---

## 0. Datos de contacto y accesos

| Qué                              | Dónde / quién                            |
| -------------------------------- | ---------------------------------------- |
| Responsable técnico principal    | ⟨COMPLETAR: nombre + teléfono⟩           |
| Contacto en Centro Armonía       | ⟨COMPLETAR⟩                              |
| Contacto en Constructores de Paz | ⟨COMPLETAR⟩                              |
| Dashboard de Vercel              | https://vercel.com/insolventics-projects |
| Proveedor de PostgreSQL          | ⟨COMPLETAR: proveedor + URL del panel⟩   |
| Sentry                           | ⟨COMPLETAR: URL de la organización⟩      |
| Upstash (rate limiting)          | https://console.upstash.com              |
| Cuenta de Google (Drive + SMTP)  | `insolvenic@gmail.com`                   |

---

## 1. Triage: ¿qué está pasando?

Ante cualquier reporte de "no funciona", en este orden y sin saltear pasos:

1. **Health check** — dice en un request si la app y la BD están vivas:

   ```bash
   curl -s https://⟨DOMINIO-PRODUCCION⟩/api/health | jq
   ```

   - `200 {"status":"ok"}` → la app y la BD están bien; el problema es de
     una funcionalidad puntual (Drive, email, generación), no de la
     plataforma. Saltar a la sección correspondiente.
   - `503 {"status":"degraded"}` → la BD no responde. Ir a **§3.1**.
   - Sin respuesta / timeout → la app no está sirviendo. Ir a **§3.2**.

   **¿Qué commit está desplegado?** El detalle no es público: hay que
   mandar el header con el valor de `HEALTH_DETAILS_TOKEN`.

   ```bash
   curl -s -H "x-health-token: $HEALTH_DETAILS_TOKEN" \
     https://⟨DOMINIO-PRODUCCION⟩/api/health | jq .deployment
   # → { "version": "0.3.0", "commit": "abc123…", "branch": "main", "deploymentEnv": "production" }
   ```

   Sirve para confirmar si el rollback tomó efecto, o si producción está
   corriendo el commit que se cree. Si `commit` dice `unknown`, el proyecto
   en Vercel no tiene habilitado "Automatically expose System Environment
   Variables".

2. **Sentry** — errores de las últimas horas, agrupados. Un pico que arranca
   en un timestamp concreto casi siempre correlaciona con un deploy.

3. **Vercel → Deployments** — ¿hubo un deploy reciente? Si el incidente
   empezó justo después, el rollback (**§2**) es la primera medida, antes
   de diagnosticar la causa raíz.

4. **Vercel → Logs (Runtime)** — filtrar por `"level":"ERROR"`. Los logs
   son JSON estructurado y traen `requestId`: si un usuario reporta un
   error, pedirle el momento exacto y correlacionar.

---

## 2. Rollback de un deploy

**Cuándo:** el incidente empezó después de un deploy y no hay una causa
obvia y corregible en minutos. Rollback primero, diagnóstico después.

### 2.1 Rollback de la aplicación (rápido, ~1 min)

1. Vercel → proyecto → **Deployments**.
2. Buscar el último deploy **Ready** anterior al problemático (verificar la
   fecha/commit).
3. Menú `···` → **Promote to Production** (o **Instant Rollback** si está
   disponible).
4. Verificar con el smoke test:
   ```bash
   npm run test:smoke -- https://⟨DOMINIO-PRODUCCION⟩
   ```

### 2.2 ⚠️ El rollback NO revierte migraciones de base de datos

Las migraciones corren dentro del `buildCommand` de `vercel.json`, gateadas
por `$VERCEL_ENV=production`:

```
npx prisma generate && ( [ "$VERCEL_ENV" != "production" ] || npx prisma migrate deploy ) && next build
```

Consecuencias que hay que tener presentes:

- Si el build falla **después** de `migrate deploy`, la base queda adelantada
  respecto del código en producción.
- Al promover un deploy anterior, el esquema **sigue migrado**. El código
  viejo corre contra el esquema nuevo.

Por eso la regla operativa es: **las migraciones deben ser siempre
aditivas** (agregar tablas/columnas nullable; nunca renombrar ni borrar en
el mismo release que las deja de usar). Con migraciones aditivas, el código
viejo sigue funcionando contra el esquema nuevo y el rollback de app es
suficiente.

Si una migración destructiva ya se aplicó y hay que volver atrás:

1. **Parar** — no improvisar SQL contra producción.
2. Restaurar desde backup / PITR (**§3.1**), asumiendo pérdida de los datos
   escritos desde el punto de restauración.
3. Recién entonces promover el deploy anterior.

Un cambio destructivo se hace en dos releases (expand → contract): primero
se agrega lo nuevo y el código escribe en ambos; cuando ese release está
estable, un segundo release borra lo viejo.

---

## 3. Incidentes por componente

### 3.1 La base de datos no responde (`/api/health` → 503)

1. Confirmar en el panel del proveedor: ¿instancia arriba, límite de
   conexiones, mantenimiento?
2. Si es saturación de conexiones: los deploys serverless abren pools por
   instancia; un pico de tráfico puede agotarlas. Mitigación inmediata:
   reducir tráfico (Vercel → pausar el proyecto solo si el negocio lo
   justifica) y escalar el plan de la BD.
3. Si hay pérdida o corrupción de datos → **restauración**:
   - Identificar el punto de restauración (timestamp anterior al incidente).
   - Restaurar a una **instancia nueva**, nunca encima de la productiva.
   - Verificar contra la instancia restaurada antes de repuntar
     `DATABASE_URL`.
   - Cambiar la env var en Vercel y **redeploy** (obligatorio: Vercel aplica
     los cambios de variables solo a deployments nuevos; ver
     `docs/RUNBOOK_ENV_VARS.md` §2).
   - Avisar a ambos centros: los expedientes creados después del punto de
     restauración se perdieron y hay que recargarlos.

> ⚠️ **Pendiente de go-live:** la estrategia de backup y la prueba de
> restauración (hallazgo A-4) siguen sin verificarse. Hasta que se ejecute
> una restauración de prueba, esta sección es teórica.

### 3.2 La app no responde / error 500 generalizado

1. Vercel → Deployments: ¿el último deploy quedó **Error** o **Building**?
   - Si el deploy falló, producción sigue sirviendo el anterior: el problema
     es otro.
2. Vercel → Logs: buscar excepciones al inicio de la función. Causa típica:
   una env var faltante que revienta en el primer uso (patrón de
   lazy-init del proyecto: el fallo aparece en runtime, no en build).
3. Verificar que las env vars críticas existan en el entorno correcto:
   `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_DRIVE_*`, `SMTP_*`.
4. Si no hay causa clara → rollback (**§2**).

### 3.3 Los documentos no se generan

La generación corre en background (`after()` de Next) con una máquina de
estados en la tabla `document_generation_requests`.

1. Estado de las solicitudes recientes:
   ```sql
   SELECT id, "caseId", kind, status, error, "createdAt", "finishedAt"
   FROM document_generation_requests
   ORDER BY "createdAt" DESC LIMIT 20;
   ```
2. Interpretación:
   - `FAILED` con `error` → leer el mensaje; casi siempre es Drive (§3.4).
   - `PROCESSING` hace más de 10 minutos → job huérfano. El sistema los
     recupera solo: el lock se libera a los 10 min y la siguiente solicitud
     lo re-reclama. Si el usuario no puede esperar, reintentar desde la UI.
   - `COMPLETED_WITH_ERRORS` → parte de los documentos se generaron;
     regenerar los faltantes individualmente desde el caso.
3. Si fallan **todas** las generaciones, sospechar Chromium/memoria: la
   generación levanta un navegador por documento (deuda conocida, P1). Un
   caso con muchos documentos puede agotar la memoria de la función.
   Mitigación: generar por tandas más chicas desde la UI.

### 3.4 Google Drive falla (subidas, carpetas)

Síntoma típico: errores `invalid_grant`, `401` o `403`. Sentry los muestra
como `Error generating document` con `action: 'generate-documents'`; el
error original de Google (`invalid_grant`) está en Vercel → Logs (Runtime),
porque `src/lib/google-drive.ts` lo registra con `console.error`.

- **`invalid_grant`** → el refresh token de OAuth se revocó o expiró. Es la
  causa más común y requiere **rotar el token**. Procedimiento completo
  (OAuth Playground, variables, verificación y el aviso sobre el modo
  "Testing" de Google, que expira el token a los 7 días):
  `docs/RUNBOOK_ROTACION_DRIVE.md`. Resumen: regenerar el token con la cuenta
  `insolvenic@gmail.com`, actualizar `GOOGLE_DRIVE_REFRESH_TOKEN` en Vercel
  (Production y Preview) y redeployar.
- **`403 quota`** → límite de la API de Drive. Esperar la ventana o pedir
  aumento de cuota en Google Cloud Console.
- Las subidas ya tienen reintento con backoff exponencial (3 intentos), así
  que un error aislado que llega a Sentry significa que los 3 fallaron.

### 3.5 No salen los emails

- El envío usa Gmail SMTP con app password (`SMTP_USER` / `SMTP_PASSWORD`).
- Causas frecuentes: app password revocada, límite diario de envío de Gmail
  alcanzado, o la cuenta pidió reverificación.
- Verificar en Sentry errores con `action` de email.
- **Impacto**: el registro de usuarios por admin depende del email de
  activación. Si el email está caído, un usuario nuevo no puede activarse.
  Workaround: generar el enlace de reset manualmente desde
  "¿Olvidó su contraseña?" una vez restablecido el envío.

### 3.6 El cron de alertas no corre

- Endpoint: `GET /api/cron/alerts`, programado 08:00 diario (`vercel.json`).
- `503` → falta `CRON_SECRET` en el entorno.
- `401` → el token que manda Vercel no coincide con el configurado.
- Prueba manual:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://⟨DOMINIO⟩/api/cron/alerts
  ```
- La respuesta trae `totalCreated`, `totalErrors` y `requestId`. Un
  `timedOut: true` indica que el escaneo excedió los 60s.
- **Impacto**: sin cron no salen avisos de audiencias próximas ni pagos
  vencidos. No corrompe datos; se puede disparar a mano.

**Cómo se detecta** (antes no se detectaba: se descubría cuando un operador
notaba que no le llegaban avisos). Dos cosas distintas vigilan dos cosas
distintas:

| Qué vigila                         | Quién                                           | Cómo avisa                                    |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Que la **app y la base** respondan | `monitor.yml`, cada 30 min contra `/api/health` | GitHub manda un mail cuando el workflow falla |
| Que el **cron corra**              | Cron monitor de Sentry (`cron-alertas`)         | Sentry alerta si el check-in **no llega**     |

El monitor de Sentry se crea solo con el primer check-in del cron: no hay que
configurarlo a mano. La corrida se cierra como `error` —no solo ante una
excepción— también si se cortó por el deadline (`timedOut`) o si algún tenant
acumuló errores, porque en los dos casos el resultado no es el que esta
sección espera.

Si el cron dejó de correr, el check-in que **no llega** es la señal: un cron
que no corre no produce ningún error que reportar, así que sin esto el
síntoma era silencio. `monitor.yml` también se puede correr a mano desde
Actions contra cualquier URL (`workflow_dispatch`), útil durante un incidente
o contra un preview.

> Un servicio de uptime externo (Better Stack, UptimeRobot, el monitor de
> Vercel en Pro) sigue siendo mejor herramienta: chequea desde varias regiones
> y avisa por SMS. `monitor.yml` es lo que se puede tener sin abrir otra cuenta.
> Y ojo con su límite: GitHub no garantiza la puntualidad de `schedule`, así
> que detecta una caída sostenida, no un pico de un minuto.

### 3.7 Rate limiting degradado

- Si Upstash no está configurado o Redis falla, el sistema **cae al
  limitador in-memory** y sigue funcionando (decisión deliberada: es
  preferible a dejar a los centros sin poder entrar).
- Señal en Sentry: warn `Upstash no configurado — rate limiting degradado`
  o `Redis falló — rate limiting degradado a in-memory`.
- Mientras esté degradado, la protección contra fuerza bruta es por
  instancia, no global: atender pronto, pero no es una emergencia que
  justifique rollback.

---

## 4. Despliegue manual de emergencia

**Cuándo:** la integración Vercel↔GitHub no dispara, o hay que publicar un
fix sin pasar por el repositorio.

```bash
npm i -g vercel          # si no está instalado
vercel login             # cuenta insolvenic@gmail.com
vercel link              # vincular al proyecto (una sola vez)

vercel --prod            # build y deploy directo a producción
```

Consideraciones:

- `vercel --prod` construye en la infraestructura de Vercel usando el
  `buildCommand` de `vercel.json`, así que **corre las migraciones** si
  `VERCEL_ENV=production`. Tener presente §2.2.
- Un deploy manual **no** queda reflejado como commit: apenas pase la
  emergencia, llevar el cambio al repositorio para no perderlo.

### 4.1 El deploy queda "Blocked"

El plan Hobby de Vercel bloquea deploys de la integración nativa cuando el
autor del commit HEAD no está vinculado a la cuenta dueña del proyecto. La
cuenta autorizada es `Insolventic <insolvenic@gmail.com>`.

El check aplica **solo al commit HEAD** del push. Remedio documentado:

```bash
git commit --amend --author='Insolventic <insolvenic@gmail.com>' --no-verify --no-edit
git push --force-with-lease origin ⟨RAMA⟩
```

> Reescribe historial: confirmar antes de ejecutarlo sobre una rama
> compartida. Pendiente de fondo: vincular la cuenta de Vercel del
> desarrollador al proyecto para no depender de este override.

---

## 5. Rotación de secretos

Rotar ante sospecha de exposición (secreto en un log, en un screenshot, en
un repositorio público, o salida de una persona con acceso).

| Secreto                       | Cómo se rota                                                                                                                                 | Impacto de rotar                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`                  | Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`                                                          | **Cierra todas las sesiones activas.** Todos los usuarios deben volver a entrar. Avisar antes.                                             |
| `GOOGLE_DRIVE_REFRESH_TOKEN`  | Rehacer el flujo OAuth: `docs/RUNBOOK_ROTACION_DRIVE.md`                                                                                     | Ninguno si se hace de corrido; entre medio fallan las subidas.                                                                             |
| `SMTP_PASSWORD`               | Nueva app password en https://myaccount.google.com/apppasswords                                                                              | Ninguno; los emails en vuelo pueden fallar.                                                                                                |
| `CRON_SECRET`                 | Generar random y actualizar en Vercel                                                                                                        | El cron falla hasta que Vercel tome el valor nuevo (redeploy).                                                                             |
| `UPSTASH_REDIS_REST_TOKEN`    | Rotar en la consola de Upstash                                                                                                               | Rate limiting degrada a in-memory hasta actualizar (no bloquea usuarios).                                                                  |
| `HEALTH_DETAILS_TOKEN`        | Generar random y actualizar en Vercel                                                                                                        | Ninguno para los usuarios; hasta actualizarlo, `/api/health` deja de devolver el detalle del deploy.                                       |
| `DATABASE_URL` + `DIRECT_URL` | Reset de la contraseña de `neondb_owner` en Neon y actualizar **ambas** variables en Production **y** Preview: `docs/RUNBOOK_ENV_VARS.md` §4 | Requiere redeploy; hay downtime breve. Rotar solo una deja una falla silenciosa (`DIRECT_URL` vieja rompe el próximo build de producción). |

Después de cualquier rotación: actualizar en Vercel → **redeploy** →
smoke test.

---

## 6. Verificación post-incidente

Antes de dar por cerrado cualquier incidente:

```bash
npm run test:smoke -- https://⟨DOMINIO-PRODUCCION⟩
```

Y a mano, con una sesión real:

- [ ] Login y logout funcionan en **ambos** centros.
- [ ] Un caso existente abre y muestra sus documentos.
- [ ] `/api/health` responde `200 ok`.
- [ ] Sentry no muestra errores nuevos en los últimos 15 minutos.
- [ ] Si hubo restauración de BD: ambos centros confirman que sus
      expedientes recientes están.

Dejar registrado en un post-mortem breve: qué pasó, desde cuándo hasta
cuándo, qué se hizo, y qué haría falta para que no vuelva a pasar.

---

## 7. Referencias

- Arquitectura y flujos: `docs/ARQUITECTURA.md`
- Auditoría pre-producción y hallazgos abiertos:
  `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md`
- Convenciones de código y decisiones por sesión: `CLAUDE.md`
- Variables de entorno: `.env.example`
- Conexión a la base (`DATABASE_URL` / `DIRECT_URL`) y rotación de la
  contraseña de Neon: `docs/RUNBOOK_ENV_VARS.md`
- Rotación del refresh token de Google Drive:
  `docs/RUNBOOK_ROTACION_DRIVE.md`
