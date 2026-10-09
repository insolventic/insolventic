# Runbook — Variables de entorno de la base de datos

Cómo se conecta INSOLVENTIC a PostgreSQL (Neon), qué variable de Vercel
alimenta cada conexión y cómo rotar la contraseña sin dejar producción ni
Preview rotos.

Complementa a `docs/RUNBOOK.md` (§3.1 y §5 remiten aquí). La rotación de
Google Drive está en `docs/RUNBOOK_ROTACION_DRIVE.md`.

> Verificado contra el código el 2026-09-19: `src/prisma/schema.prisma`
> (datasource), `src/lib/prisma.ts`, `vercel.json`, `src/app/api/health/route.ts`
> y `.github/workflows/e2e.yml`. Lo que **no** se puede comprobar desde el
> repositorio (valores reales, overrides por rama en Vercel) está marcado
> `⟨VERIFICAR⟩`.

---

## 1. `DATABASE_URL` vs `DIRECT_URL`

Son **el mismo usuario, la misma contraseña y la misma base**; cambia solo el
host. En Neon, el host del pooler lleva el sufijo `-pooler`:

```
DATABASE_URL → postgresql://neondb_owner:<pass>@ep-nombre-1234-pooler.<region>.aws.neon.tech/neondb?...
DIRECT_URL   → postgresql://neondb_owner:<pass>@ep-nombre-1234.<region>.aws.neon.tech/neondb?...
```

|                      | `DATABASE_URL`                                                                                                       | `DIRECT_URL`                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Conexión             | **Con pooler** (PgBouncer, host `-pooler`)                                                                           | **Directa**, sin pooler                                                                                          |
| Declarada en         | `datasource db { url = env("DATABASE_URL") }`                                                                        | `datasource db { directUrl = env("DIRECT_URL") }`                                                                |
| La usa               | La app **en runtime**: `new PrismaClient()` en `src/lib/prisma.ts`, todas las server actions, `/api/health`, el cron | **Solo** los comandos de migración del CLI: `prisma migrate deploy` / `migrate dev` / `db push` / `migrate diff` |
| Cuándo               | Cada invocación serverless                                                                                           | Una vez por build de producción (`vercel.json` → `buildCommand`) y cuando corrés migraciones a mano              |
| Por qué esa conexión | Serverless abre muchas conexiones cortas; el pooler las multiplexa                                                   | `migrate deploy` necesita sesión persistente y advisory locks; PgBouncer en modo transacción no los sostiene     |
| Si está mal          | La app no conecta: `/api/health` → 503                                                                               | La app **sigue funcionando**, pero el próximo build de producción falla en `migrate deploy`                      |

Punto clave: **`DIRECT_URL` no la lee el runtime**, así que una `DIRECT_URL`
vencida es una falla silenciosa: `/api/health` da `ok` y el problema aparece
recién en el siguiente deploy a producción. Por eso las dos se rotan siempre
juntas (§4) y la verificación post-rotación incluye una comprobación
específica de `DIRECT_URL` (§5.3).

Historial que justifica esta separación: antes de declarar `directUrl`,
`migrate deploy` iba por el pooler y fallaba de forma intermitente con
`P1002 — The database server was reached but timed out` (ver el comentario
del datasource en `schema.prisma`).

### 1.1 Otras variables de BD que existen en el repo (y que el runtime ignora)

`DATABASE_URL_ARMONIA` y `DATABASE_URL_CONSTRUCTORES_PAZ` figuran en
`.env.example` y las lee únicamente `src/scripts/run-prisma.ts` (script
manual) y el workflow de E2E. `src/lib/prisma.ts` crea **un solo**
`PrismaClient`, que toma `DATABASE_URL`. El aislamiento entre centros es por
`tenantId` dentro de una única base, no por base separada.

> ⚠️ `docs/ARQUITECTURA.md §2` describe una base de datos por centro
> resolviendo `DATABASE_URL_ARMONIA`/`_CONSTRUCTORES_PAZ` en runtime. **Eso no
> coincide con el código actual** (`src/lib/prisma.ts`, `CLAUDE.md`). Para
> rotar credenciales, lo único que cuenta en producción es `DATABASE_URL` +
> `DIRECT_URL`. Si esas otras dos existen en Vercel `⟨VERIFICAR⟩`, no afectan
> a la app, pero conviene actualizarlas igual o borrarlas para que no
> queden con una contraseña vieja que confunda a la próxima persona.

---

## 2. Production y Preview: variables separadas y bases separadas

En Vercel → Project → Settings → Environment Variables, cada variable se
asigna a uno o más **Environments**: Production, Preview y Development.

- **Production** y **Preview** son entradas **independientes**: cambiar una
  no cambia la otra.
- Y desde el **2026-10-09** apuntan a **branches distintos de Neon**:
  Production al branch de producción, Preview a un branch `preview` propio.

> **Verificado el 2026-10-09.** Se abrió un PR no-op contra `dev` (`#125`,
> commit `dff4d43`, un comentario HTML en el `README.md`) solo para producir
> un Preview deployment, y se observó en el panel de Neon que **la actividad
> de conexión apareció en el branch `preview`, no en el de producción**. El
> `/api/health` de ese Preview dio `200` con `environment: "preview"` y
> `checks.database.status: "ok"` — pero ojo: ese endpoint **no** sirve para
> identificar la base (oculta host y connection string a propósito, ver el
> docblock de `src/app/api/health/route.ts`). La evidencia que cuenta es la
> del panel de Neon.

Esto cambió una vez (antes los dos Environments compartían la base física, y
esa confusión costó un incidente el 2026-09-19). Consecuencias prácticas:

1. **Un Preview ya NO opera sobre datos reales.** Hasta el 2026-10-09,
   cualquier acción en un Preview (crear/editar/borrar un caso) escribía en
   producción. Con el branch propio, un Preview escribe en datos de prueba.
   `⟨VERIFICAR antes de confiar en esto para TODA rama⟩`: lo medido fue un
   deployment de **una** rama. Si la `DATABASE_URL` de Preview se guardó con
   un override de rama específica (punto 5), el aislamiento aplicaría solo a
   esa rama y el resto seguiría pegándole a producción. Confirmar que la
   entrada de Preview está asignada a todas las ramas no productivas.
2. **Rotar la contraseña afecta a los dos Environments, pero los
   connection strings ya no son el mismo.** Cada branch de Neon tiene su
   propio host, así que **no se puede pegar el string de Production en
   Preview**: hay que sacar el de cada branch por separado.
   `⟨VERIFICAR⟩`: si un **Reset password** del rol `neondb_owner` se propaga
   a todos los branches del proyecto o es por branch. De eso depende si una
   rotación obliga a tocar las cuatro entradas (`DATABASE_URL` y
   `DIRECT_URL` × Production y Preview) o solo las dos de producción. **§4
   está escrito para un solo branch y todavía no refleja esto.**
3. **Las migraciones solo corren en el build de producción**
   (`[ "$VERCEL_ENV" != "production" ] || npx prisma migrate deploy`). Un
   Preview con una migración nueva en su rama **no** la aplica: corre el
   código nuevo contra el esquema viejo, salvo que la migración ya se haya
   aplicado a mano. Respetar la regla de migraciones aditivas de
   `RUNBOOK.md §2.2`.

   Con el branch propio esto se vuelve **más** filoso, no menos: el branch
   `preview` arranca con el esquema que tenía el de producción al crearse y
   **nadie le aplica migraciones nunca**, así que se va quedando atrás a
   medida que producción avanza. Un Preview puede fallar por un esquema
   viejo que ya no existe en ninguna parte. Si pasa, re-crear el branch de
   Neon desde producción es más barato que migrarlo a mano.

4. **Los cambios de variables no llegan a deployments ya creados.** Vercel
   aplica un cambio de env vars solo a deployments **nuevos**. Un deployment
   viejo (de Production o de Preview) conserva las credenciales con las que
   se construyó y, tras rotar la contraseña, deja de conectar para siempre.
   Después de rotar hay que **redeployar** (§4, paso 4).
5. **Overrides por rama.** Una variable de Preview puede asignarse a _todas_
   las ramas no productivas o a **una rama específica**, y la específica
   pisa a la general. Si tras rotar un Preview sigue fallando, buscar
   `DATABASE_URL`/`DIRECT_URL` duplicadas con una rama asignada
   `⟨VERIFICAR en el panel⟩`.
6. **Variables "Sensitive".** Si están marcadas como sensibles, Vercel no
   permite volver a leer su valor después de guardarlas y `vercel pull` no
   las baja. No se puede "copiar el valor de Production a Preview": hay que
   pegar el connection string nuevo en cada entrada.

> **~~Decisión pendiente~~ → implementado el 2026-10-09.** Aislar Preview con
> un branch de Neon propio figuraba acá como decisión de negocio sin tomar
> (cambiaba el modelo de costos y de datos de prueba). Se hizo, y se verificó
> con el PR `#125` como se describe arriba. El punto 1 queda eliminado.
>
> Lo que **no** cubrió ese cambio y sigue abierto:
>
> - **§4 (rotación de contraseña) está escrito para un solo branch**: los
>   pasos 1 y 2 dicen "elegir la branch (la de producción)" y "la misma", lo
>   que ahora deja a Preview con la contraseña vieja. Hay que reescribirlo
>   para los dos branches, una vez resuelto el `⟨VERIFICAR⟩` del punto 2
>   sobre si el reset del rol se propaga entre branches.
> - **`DIRECT_URL` de Preview** `⟨VERIFICAR⟩`: el health check solo ejercita
>   `DATABASE_URL` por el pooler (§5.3), así que la verificación del 2026-10-09
>   **no** prueba que la `DIRECT_URL` de Preview apunte al branch `preview`.
>   Como en Preview no corre `migrate deploy`, una `DIRECT_URL` mal apuntada
>   ahí no rompe nada visible — pero es exactamente el tipo de falla
>   silenciosa que describe §1.

---

## 3. Mapa de variables por Environment

Lo que tiene que existir, con la contraseña **vigente**, en cada Environment
que use la base real:

| Variable                           | Production                                               | Preview                                                                                              | Development ⟨VERIFICAR si existe⟩               |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL` (pooler, `-pooler`) | ✔ obligatoria                                           | ✔ obligatoria                                                                                       | solo si se usa `vercel env pull` / `vercel dev` |
| `DIRECT_URL` (sin pooler)          | ✔ **obligatoria** (la usa `migrate deploy` en el build) | ✔ recomendada (el schema la referencia; cualquier comando Prisma que valide el datasource la exige) | igual que `DATABASE_URL`                        |

Regla simple: **si un Environment tiene `DATABASE_URL`, debe tener también
`DIRECT_URL` con la misma contraseña.**

`Development` solo importa si trabajás con `vercel env pull` (que baja las
variables de Development a un `.env` local) o `vercel dev`. Si no lo usás,
tu `.env` local es independiente (§4, paso 5).

CI **no** usa la base real: `e2e.yml` levanta un Postgres de servicio y
define sus propias `DATABASE_URL`/`DIRECT_URL` locales. No hay secretos de
BD en GitHub Actions que rotar.

---

## 4. Rotar la contraseña del rol `neondb_owner`

**Cuándo:** sospecha de exposición (secreto en un log, screenshot, chat o
repo), salida de alguien con acceso, o rotación periódica.

**Impacto:** Neon documenta que la contraseña vieja "deja de funcionar en la
próxima conexión". Entre el reset (paso 1) y el redeploy (paso 4) la app
**no puede conectar**: hay downtime. Hacerlo de corrido, en una ventana de
poco uso, con todas las pestañas ya abiertas, y avisar antes a Armonía y
Constructores de Paz (`RUNBOOK.md §0`).

### Antes de empezar

- [ ] Acceso a Neon (dueño del proyecto) y a Vercel (proyecto `insolventic`).
- [ ] Abrir en pestañas: Neon Console, Vercel → Settings → Environment
      Variables, Vercel → Deployments.
- [ ] Anotar cómo están hoy `DATABASE_URL` y `DIRECT_URL` en Vercel
      (parámetros de query como `sslmode`, `connect_timeout`, `pgbouncer`,
      etc.). El valor nuevo debe conservar esos parámetros: no se ven desde
      el repo, así que la referencia es lo que ya está cargado.

### Paso 1 — Resetear la contraseña en Neon

1. Neon Console → tu proyecto.
2. Elegir la **branch** en el selector (la de producción).
3. En **Postgres database** → **Roles**.
4. Menú del rol `neondb_owner` → **Reset password** → **Reset**.

### Paso 2 — Obtener los dos connection strings

Con la contraseña ya rotada:

1. En el proyecto, botón **Connect**.
2. En el modal elegir **Branch** (la misma), **Compute**, **Database**
   (`neondb`) y **Role** (`neondb_owner`).
3. Con **Connection pooling ACTIVADO** → copiar el string. Es el nuevo
   **`DATABASE_URL`**. El host tiene `-pooler`.
4. Con **Connection pooling DESACTIVADO** → copiar el string. Es el nuevo
   **`DIRECT_URL`**. El host **no** tiene `-pooler`.
5. Comprobar a ojo antes de pegar: los dos deben tener el **mismo usuario,
   contraseña y base**, y diferir **solo** en `-pooler` en el host.

> No pegar estos strings en chats, issues, PRs ni commits. Si se filtra uno,
> hay que volver a rotar.

### Paso 3 — Actualizar Vercel (los tres Environments que correspondan)

Vercel → Project → Settings → Environment Variables. Para **cada** fila,
editar y pegar el valor nuevo:

| Variable       | Valor a pegar         | Production | Preview | Development |
| -------------- | --------------------- | :--------: | :-----: | :---------: |
| `DATABASE_URL` | string **con** pooler |     ✔     |   ✔    |  si existe  |
| `DIRECT_URL`   | string **sin** pooler |     ✔     |   ✔    |  si existe  |

Checks durante la edición:

- [ ] No confundirlos: `DATABASE_URL` ← con `-pooler`; `DIRECT_URL` ← sin.
- [ ] Revisar si hay **entradas duplicadas** de la misma variable asignadas
      a una rama específica de Preview (§2, punto 5) y actualizarlas también.
- [ ] Si existen `DATABASE_URL_ARMONIA` / `DATABASE_URL_CONSTRUCTORES_PAZ`
      (§1.1), actualizarlas o borrarlas.
- [ ] Ningún valor con comillas ni espacios al final.

### Paso 4 — Redeployar (obligatorio)

Los cambios de variables **no** afectan a deployments existentes.

- **Production:** Vercel → Deployments → el deploy de producción vigente →
  menú `···` → **Redeploy**. Este build corre `prisma migrate deploy` con la
  `DIRECT_URL` nueva; si termina en verde y el log dice que no hay
  migraciones pendientes, `DIRECT_URL` quedó bien (§5.3).
- **Preview:** los previews viejos no se recuperan (conservan la contraseña
  vieja). Generar uno nuevo: push de un commit a la rama del PR, o Redeploy
  del último deployment de esa rama.

### Paso 5 — Otros lugares donde vive la contraseña vieja

- [ ] Tu `.env` / `.env.local` locales si apuntan a esta base
      (`prisma.config.ts` carga solo `.env`; Next.js además lee `.env.local`).
- [ ] Cualquier cliente SQL que uses (Prisma Studio, DBeaver, TablePlus…)
      con credenciales guardadas.
- [ ] Cualquier otra app o script que use `neondb_owner` `⟨VERIFICAR⟩`.

---

## 5. Checklist de verificación post-rotación

Todos los ítems deben pasar. Anotar la hora y quién lo verificó.

### 5.1 `/api/health` en Production

```bash
curl -s https://⟨DOMINIO-PRODUCCION⟩/api/health | jq
```

Esperado: HTTP **200** y

```json
{
  "status": "ok",
  "checks": { "database": { "status": "ok", "latencyMs": 42 } }
}
```

El campo pedido es `checks.database.status` (el objeto `database` cuelga de
`checks`). `503` con `"status":"degraded"` y `database.status:"error"` = la
app no conecta: revisar §6.

- [ ] Production → `checks.database.status == "ok"`

### 5.2 `/api/health` en el Preview más reciente

Usar la URL del **último** deployment de Preview (Vercel → Deployments →
filtro Preview), no una vieja.

```bash
curl -s https://⟨URL-DEL-PREVIEW⟩/api/health | jq
```

Si responde `401` o redirige al login de Vercel, es la protección de
deployments de Vercel, no la base: abrir la URL en el navegador con la
sesión de Vercel iniciada.

- [ ] Preview más reciente → `checks.database.status == "ok"`

### 5.3 `DIRECT_URL` (el health check NO la cubre)

`/api/health` hace `SELECT 1` por el pooler, o sea que solo prueba
`DATABASE_URL`. `DIRECT_URL` se comprueba aparte:

- [ ] El build del Redeploy de Production (paso 4) terminó en verde y su log
      muestra `prisma migrate deploy` sin error de autenticación
      (`P1000`) ni de timeout (`P1002`).
- [ ] Opcional, desde tu máquina con el `.env` ya actualizado
      (solo lectura): `npx prisma migrate status`.

### 5.4 Funcionalidad real

- [ ] Login y logout en **ambos** centros (`RUNBOOK.md §6`).
- [ ] Un caso existente abre.
- [ ] Sentry sin errores nuevos `P1000` / `P1001` / `P1002` / `P1017` en
      los últimos 15 minutos.
- [ ] Vercel → Logs (Runtime), filtro `"level":"ERROR"`: sin errores de
      conexión a la base.

---

## 6. Diagnóstico rápido

| Síntoma                                                                       | Causa probable                                                                                                    | Arreglo                                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/api/health` 503 en Production tras rotar; Sentry `P1000`                    | `DATABASE_URL` de Production con la contraseña vieja, **o** deployment anterior a la rotación que no se redeployó | Corregir la variable y Redeploy (paso 4)                  |
| Production ok, Preview 503 (o al revés)                                       | Se actualizó un solo Environment                                                                                  | Actualizar el otro (paso 3) y generar un deployment nuevo |
| Preview sigue mal con la variable "correcta"                                  | Override de la variable asignado a una rama específica                                                            | Buscar la entrada duplicada por rama (§2.5)               |
| App ok, pero el **build de producción falla** en `migrate deploy` con `P1000` | `DIRECT_URL` con la contraseña vieja (el runtime no la usa, por eso nadie lo notó)                                | Actualizar `DIRECT_URL` en Production y Redeploy          |
| Build de producción falla con `P1002` (timeout)                               | `DIRECT_URL` apunta al host `-pooler`                                                                             | Pegar el string **sin** pooler                            |
| Build falla con "Environment variable not found: DIRECT_URL"                  | Falta `DIRECT_URL` en ese Environment                                                                             | Crearla (§3)                                              |
| Error de autenticación intermitente justo después del reset                   | Instancias/deployments viejos aún con la contraseña vieja                                                         | Redeploy; los previews viejos se descartan                |

> Cualquier `migrate deploy` que falle **después** de aplicar parte de una
> migración se trata como incidente de base de datos: ver `RUNBOOK.md §2.2`
> y no improvisar SQL contra producción.
