# Arquitectura — INSOLVENTIC

> Versión consolidada al cierre del proyecto (abril 2026). Este documento describe la arquitectura, los límites del sistema, los flujos críticos y las decisiones técnicas clave.

---

## 1. Vista de alto nivel

```mermaid
flowchart TB
    subgraph Client["🌐 Cliente (Browser)"]
        UI["Next.js App Router UI<br/>(React 19 + Shadcn)"]
    end

    subgraph Vercel["☁️ Vercel (Next.js Runtime)"]
        Middleware["Middleware<br/>(JWT verify + RBAC)"]
        Pages["Server Components<br/>+ Pages"]
        Actions["Server Actions<br/>(src/features/**/actions.ts)"]
        API["API Routes<br/>(download, auth callback)"]
    end

    subgraph Data["🗄️ Persistencia"]
        DB_A[("PostgreSQL / CockroachDB<br/>tenant: Armonía")]
        DB_C[("PostgreSQL / CockroachDB<br/>tenant: Constructores de Paz")]
    end

    subgraph External["🔌 Servicios externos"]
        Drive["Google Drive API<br/>(por centro)"]
        SMTP["Gmail SMTP<br/>(emails transaccionales)"]
    end

    UI -- "fetch / form actions" --> Middleware
    Middleware --> Pages
    Pages --> Actions
    UI -- "Server Action RPC" --> Actions
    UI --> API
    Actions -- "Prisma (tenantId)" --> DB_A
    Actions -- "Prisma (tenantId)" --> DB_C
    Actions --> Drive
    Actions --> SMTP
    API --> Drive
```

---

## 2. Multi-tenant por instancia de BD

Cada centro de conciliación opera con su propia base de datos aislada. El cliente Prisma se selecciona en tiempo de request:

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware
    participant PrismaResolver as "src/lib/prisma.ts"
    participant DB_Armonia as "BD Armonía"
    participant DB_Construpaz as "BD Constructores de Paz"

    Browser->>Middleware: Request + cookie "tenant=armonia"
    Middleware->>PrismaResolver: getPrismaClient(tenantSlug)
    alt tenant = armonia
        PrismaResolver->>DB_Armonia: PrismaClient(DATABASE_URL_ARMONIA)
    else tenant = constructores-de-paz
        PrismaResolver->>DB_Construpaz: PrismaClient(DATABASE_URL_CONSTRUCTORES_PAZ)
    end
    PrismaResolver-->>Middleware: client
    Middleware->>Browser: Response
```

**Garantías:**

- `tenantId` siempre presente en `where` de queries (no se comparte data entre centros).
- El JWT embebe `tenantId` → el usuario no puede forzar otro tenant sin re-login.
- `switchTenant` fuerza validación de `mustChangePassword` antes de emitir el nuevo token.

---

## 3. Capa de dominio (features/)

```
src/features/
├── auth/         ← login, logout, refresh, switchTenant, resetPassword, RBAC
├── case/         ← createCase, updateCase (optimistic lock), phase transitions
├── debtor/       ← CRUD deudores + historial de casos
├── creditor/     ← CRUD acreedores
├── document/     ← batchGenerateDocuments, templates, Google Drive upload
├── payment/      ← cronograma, registro manual, comprobantes, reportes
├── report/       ← estado de casos, trazabilidad de pagos
├── audit-log/    ← registro fire-and-forget de acciones críticas
├── notification/ ← notificaciones internas por usuario/rol
└── user/         ← CRUD usuarios, asignación de rol
```

Cada feature expone **server actions** (`'use server'`) con una firma canónica:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

Y siempre valida input con Zod antes de tocar Prisma.

---

## 4. Autenticación y sesión

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant App as Next.js
    participant Auth as Server Action "login"
    participant DB as Prisma/DB
    participant Cookies as HttpOnly cookies

    U->>App: POST /login (email, password, tenant)
    App->>Auth: login(input)
    Auth->>DB: findUser (email + tenantSlug)
    DB-->>Auth: user + role + permissions
    Auth->>Auth: bcrypt.compare(password)
    alt mustChangePassword
        Auth-->>App: { success:false, mustChangePassword:true }
    else OK
        Auth->>Auth: createAccessToken (24h)
        Auth->>Auth: createRefreshToken (7d)
        Auth->>Cookies: Set-Cookie access_token + refresh_token (httpOnly)
        Auth->>DB: update lastLogin + audit log
        Auth-->>App: { success:true }
    end
    App-->>U: redirect /dashboard
```

**Hardening aplicado:**

- Refresh token **7 días** (antes 30).
- `refresh` y `switchTenant` revalidan `mustChangePassword` y limpian cookies si falla.
- `validateSession` corre en middleware: token inválido o expirado → redirect a `/login`.
- Logout revoca ambas cookies + audita la acción.

---

## 5. Ciclo de vida de un caso

```mermaid
stateDiagram-v2
    [*] --> Solicitud: createCase
    Solicitud --> Admision: admitir (fecha, operador designado)
    Solicitud --> Inadmision: rechazar
    Admision --> Negociacion: programar audiencia
    Negociacion --> Acuerdo: resultType = "acuerdo"
    Negociacion --> Fracaso: resultType = "fracaso"
    Acuerdo --> [*]
    Fracaso --> [*]
    Inadmision --> [*]
```

**Optimistic locking** (campo `version` en `Case`):

```mermaid
sequenceDiagram
    participant User1 as Usuario A
    participant User2 as Usuario B
    participant DB

    User1->>DB: getCase(id) → version=5
    User2->>DB: getCase(id) → version=5
    User1->>DB: updateCase(id, {...}, version=5)
    DB-->>User1: OK, version=6
    User2->>DB: updateCase(id, {...}, version=5)
    DB-->>User2: ❌ "modificado por otro usuario"
```

El dialog de edición captura el error y cierra con toast rojo invitando a recargar.

---

## 6. Generación de documentos

```mermaid
flowchart LR
    A[Usuario selecciona caso + paquete + formato] --> B[batchGenerateDocuments]
    B --> C{Paquete?}
    C -- "all" --> D[49 plantillas]
    C -- "1..5" --> E[Plantillas del paquete]
    D --> F[Cargar .docx de templates]
    E --> F
    F --> G[docxtemplater: inyectar placeholders]
    G --> H{Formato?}
    H -- "docx" --> I[Guardar .docx]
    H -- "pdf" --> J[pdf-lib: convertir a PDF]
    H -- "both" --> I
    H -- "both" --> J
    I --> K[Upload a Google Drive]
    J --> K
    K --> L[Persistir Document + URL]
    L --> M[Retornar resumen: éxitos, fallos]
```

**Decisiones:**

- Los documentos se generan a demanda, no en tiempo de creación del caso.
- Layout de Drive: `{caseFolder}/01-Generados/`, `02-Adjuntos/`, `03-Evidencias/`, `04-Historial/`.
- `layoutVersion` permite convivir layouts flat (legacy) y seccionado.

---

## 7. Capa de datos (Prisma)

**Modelos principales:**

```mermaid
erDiagram
    Tenant ||--o{ User : has
    Tenant ||--o{ Case : owns
    Role ||--o{ User : assigned
    Role ||--o{ RolePermission : has
    Permission ||--o{ RolePermission : in
    User ||--o{ Case : operates
    User ||--o{ AuditLog : performs
    Case ||--|| Debtor : concerns
    Case ||--o{ Creditor : has
    Case ||--o{ Debt : owes
    Case ||--o{ Asset : holds
    Case ||--o{ Document : generates
    Case ||--o{ Payment : schedules
    Case ||--o{ LegalProcess : links
    Debtor ||--o{ Dependent : supports
    User ||--o{ Notification : receives
```

- **~60 modelos** en total, incluyendo entidades específicas (Libranza, SuspendedService, Apoderado, ProcesoJudicial, Bien).
- **~400 campos** en `Case` cubren los 9 bloques del formulario maestro.
- Migraciones en `src/prisma/migrations/` gestionadas con `prisma migrate`.

---

## 8. CI/CD

```mermaid
flowchart LR
    PR[Pull Request] --> CI["pr.yml<br/>lint + jest --ci + build"]
    PR --> E2E["e2e.yml<br/>Playwright (chromium)"]
    CI -->|green| Merge[Merge a dev]
    Merge --> DevDeploy["deploy.yml<br/>prisma migrate deploy<br/>+ vercel deploy (preview)"]
    DevDeploy --> Preview[Vercel preview]
    Preview -->|aprobado| MainPR[PR dev → main]
    MainPR --> ProdDeploy["deploy.yml<br/>vercel --prod"]
    ProdDeploy --> Prod[Producción]
    MainPR --> Tag[npm version + tag v*]
    Tag --> Release["release.yml<br/>GitHub Release"]
```

> **Estrategia de ramas:** sólo dos ramas de larga vida — `dev` (integración) y `main` (producción).

**Workflows activos:**

| Workflow      | Trigger                  | Corre                                                                  |
| ------------- | ------------------------ | ---------------------------------------------------------------------- |
| `pr.yml`      | PR a dev / main          | `npm run lint` + `npx jest --ci` + `npm run build`                     |
| `e2e.yml`     | PR a dev / main + manual | Playwright (chromium) con Postgres service + seed determinístico       |
| `deploy.yml`  | Push a dev / main        | `prisma migrate deploy` + Vercel deploy (preview en dev, prod en main) |
| `release.yml` | Tag `v*`                 | Genera GitHub Release con el changelog                                 |

---

## 9. Observabilidad y alertas proactivas

```mermaid
flowchart TD
    subgraph App["Next.js runtime"]
        Action["Server Action"]
        Wrapper["reportError()<br/>src/lib/observability.ts"]
    end
    subgraph Obs["Observabilidad"]
        Sentry["Sentry<br/>(no-op si DSN vacío)"]
        Vercel["Vercel Analytics<br/>+ Speed Insights"]
    end
    subgraph Cron["Cron (08:00 UTC diario)"]
        VC["Vercel Cron"]
        Route["/api/cron/alerts<br/>Bearer CRON_SECRET"]
        Scan1["scanUpcomingHearings"]
        Scan2["scanOverduePayments"]
        Notif["Notification<br/>(+ email opcional)"]
    end
    Action -- catch --> Wrapper
    Wrapper --> Sentry
    App --> Vercel
    VC --> Route
    Route --> Scan1
    Route --> Scan2
    Scan1 --> Notif
    Scan2 --> Notif
```

**Errores**

- Toda feature importa `reportError` / `reportMessage` desde `src/lib/observability.ts`.
- Cuando `SENTRY_DSN` está vacío (dev / staging sin proyecto), el helper degrada a `console.error` — nunca lanza.
- `sentry.client.config.ts`, `sentry.server.config.ts` y `sentry.edge.config.ts` inicializan Sentry por runtime. `sendDefaultPii: false` y `beforeSend` limpia cookies.
- `@vercel/analytics` y `@vercel/speed-insights` se importan en `src/app/layout.tsx`; activos automáticamente al desplegar en Vercel.

**Alertas proactivas**

- `src/features/notification/alerts.ts` expone dos scanners puros (reciben un `PrismaClient` y un `tenantId`).
  - `scanUpcomingHearings(prisma, tenantId)` — busca casos con `hearingDate` (o `firstHearingDate` si el primero es null) dentro de `ALERTS_HEARING_LOOKAHEAD_HOURS` (default 48h).
  - `scanOverduePayments(prisma, tenantId)` — busca `Payment` con `status in ('pendiente','parcial')` y `dueDate < now`; los `pendiente` se marcan automáticamente como `vencido`.
- Ambos scanners **deduplican** contra `Notification` existente (mismo `type + relatedId + userId`) dentro de `ALERTS_DEDUPE_WINDOW_HOURS` (default 20h) para que correr el cron más de una vez al día no genere spam.
- `/api/cron/alerts` (Node runtime, no Edge) itera tenants, ejecuta ambos scanners y responde con un JSON agregado para los logs de Vercel.
- Vercel Cron se registra vía `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/alerts", "schedule": "0 8 * * *" }] }
  ```
- La autenticación es `Authorization: Bearer $CRON_SECRET`. Si `CRON_SECRET` está vacío, el endpoint responde **503** en lugar de ejecutar silenciosamente.
- Email opcional (`ALERTS_EMAIL_ENABLED=true`) usa `emailService.sendAlertEmail(...)` — requiere SMTP configurado.

---

## 10. Decisiones técnicas clave

| Decisión                                      | Justificación                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| **Next.js App Router + Server Actions**       | RPC-like typesafe, sin necesidad de boilerplate de API routes.          |
| **Prisma con cliente por tenant**             | Aislamiento fuerte de datos entre centros; sin compartir conexión.      |
| **JWT HS256 con `jose`**                      | Edge-compatible (Next middleware), menos dependencias que jsonwebtoken. |
| **Cookies httpOnly**                          | Mitiga XSS; token nunca expuesto a JS del cliente.                      |
| **Optimistic locking (campo version)**        | Evita race conditions en edición simultánea sin bloquear UX.            |
| **docxtemplater + pdf-lib**                   | Librerías maduras, sin dependencias nativas (funciona en Vercel).       |
| **Google Drive como storage**                 | Los centros ya usan Drive; cero costo de infra adicional.               |
| **RBAC por permiso nombrado (`P.VER_CASOS`)** | Granularidad fina sin explosión de roles.                               |
| **Audit log fire-and-forget**                 | No bloquea la acción principal si el log falla.                         |
| **Zod en todo input**                         | Contrato tipado entre cliente y servidor; mensajes de error claros.     |

---

## 11. Riesgos residuales

| Riesgo                                                     | Mitigación actual                           | Recomendación futura                |
| ---------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Drive API rate limits en generación masiva                 | Retry con backoff en `google-drive.ts`      | Worker/queue si crece el volumen    |
| Drift entre schema.prisma e init migration                 | `prisma db push` en dev, baseline en deploy | Consolidar migraciones formales     |
| Google Drive refresh token expira si no se usa 6+ meses    | Alerta proactiva pendiente de implementar   | Rotación programada + health-check  |
| Cron de alertas depende de Vercel Cron (hobby: 1/día máx.) | Schedule diario a las 08:00 UTC             | Upgrade a Pro si se requiere >1/día |
| `CRON_SECRET` en Vercel como única defensa del endpoint    | Autorización `Bearer` comparada en código   | Rotación periódica del token        |

---

## 12. Para extender el sistema

**Agregar un nuevo permiso:**

1. Añadir a `src/lib/permissions.ts` objeto `P`.
2. Añadir al seed (`src/prisma/seed.ts`) y re-seedear.
3. Asignar al rol correspondiente en `adminPermissions` o vía UI.

**Agregar una nueva plantilla documental:**

1. Colocar `.docx` en `src/features/document/templates/`.
2. Registrarla en el manifiesto de paquetes.
3. Declarar sus placeholders en `docs/DICCIONARIO_VARIABLES.md`.

**Agregar un nuevo tenant/centro:**

1. Crear BD, añadir `DATABASE_URL_<SLUG>` al entorno.
2. Añadir el tenant en `src/lib/prisma.ts` resolver.
3. Seed específico con el rol Admin y usuario inicial.
4. Configurar carpeta raíz de Drive y credenciales OAuth del centro.

---

© 2025–2026 INSOLVENTIC
