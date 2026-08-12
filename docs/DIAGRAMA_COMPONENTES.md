# Diagrama de Componentes — INSOLVENTIC

## Decisión de partida

`docs/ARQUITECTURA.md` §1 ("Vista de alto nivel") ya funciona como diagrama de componentes de alto nivel (Cliente → Middleware → Pages/Actions/API → Prisma → BD por tenant → Drive/SMTP) — **se deja tal cual, no se reemplaza**. Lo que faltaba, y es lo que aporta este documento, es el **desglose de la capa de dominio**: los 15 módulos de `src/features/*` como componentes propios, con sus dependencias reales hacia `src/lib/*` y hacia los servicios externos. Es un *zoom-in* de un solo recuadro ("Actions") del diagrama de ARQUITECTURA.md §1, no un diagrama nuevo desde cero.

---

## Diagrama

```mermaid
flowchart TB
    subgraph Presentacion["Capa de Presentación"]
        Pages["App Router Pages<br/>src/app/**"]
        UI["Componentes UI<br/>Shadcn + Radix Primitives"]
        Middleware["Middleware<br/>JWT verify + RBAC<br/>src/middleware.ts"]
    end

    subgraph Dominio["Capa de Dominio — src/features/* (15 módulos, server actions)"]
        Auth[auth]
        Case[case]
        Debtor[debtor]
        Creditor[creditor]
        Contact[contact]
        Document[document]
        Payment[payment]
        Report[report]
        Notification[notification]
        AuditLog["audit-log"]
        User[user]
        Role[role]
        Permission[permission]
        Calendar[calendar]
        Search[search]
    end

    subgraph Infra["Capa de Infraestructura — src/lib/*"]
        InfraAuth["auth.ts + permissions.ts<br/>+ rate-limit.ts"]
        InfraData["prisma.ts"]
        InfraDocs["google-drive.ts + html-to-pdf.ts<br/>+ html-to-docx.ts"]
        InfraObs["logger.ts + observability.ts<br/>+ request-context.ts + sentry-scrub.ts"]
        InfraRetry["retry.ts"]
        InfraUtil["case-phases.ts + centro-conciliacion.ts<br/>+ date-colombia.ts + tenant-theme.ts + utils.ts"]
        InfraEmail["email.ts"]
    end

    subgraph Externos["Servicios externos"]
        DB[("PostgreSQL ×2<br/>(una BD por tenant)")]
        Drive["Google Drive API<br/>(por centro)"]
        SMTP["Gmail SMTP"]
        Sentry["Sentry<br/>(no-op si DSN vacío)"]
    end

    UI --> Pages
    Pages -- "fetch / form actions" --> Middleware
    Middleware -- "Server Action RPC" --> Dominio
    Middleware --> InfraObs

    Auth --> InfraAuth
    User --> InfraAuth
    Role --> InfraAuth
    Permission --> InfraAuth
    Case --> InfraUtil
    Document --> InfraDocs
    Document --> InfraRetry
    Document --> InfraUtil
    Notification --> InfraEmail
    Notification --> InfraRetry
    AuditLog --> InfraData
    Report --> InfraData
    Calendar --> InfraData
    Calendar --> InfraUtil

    Dominio -. "todas las features<br/>(acceso a datos)" .-> InfraData
    Dominio -. "todas las features<br/>(logging estructurado)" .-> InfraObs

    InfraAuth --> InfraData
    InfraData --> DB
    InfraDocs --> Drive
    InfraEmail --> SMTP
    InfraObs --> Sentry
```

---

## Leyenda de capas

| Capa | Contiene | Responsabilidad |
|---|---|---|
| **Presentación** | `src/app/**` (App Router), `src/components/ui/*` (Shadcn/Radix) | Renderizado, formularios, llamadas a server actions vía RPC |
| **Dominio** | 15 módulos en `src/features/*`, cada uno con `actions.ts` (`'use server'`) + `schemas.ts` (Zod) | Lógica de negocio; toda acción valida input y pasa por `authenticateUser()` + check de permiso antes de tocar Prisma (ver `CLAUDE.md` → Convenciones) |
| **Infraestructura** | `src/lib/*`, agrupado aquí por responsabilidad (no son 18 nodos porque no cabría legible) | Utilidades transversales sin `'use server'` propio, compartidas entre features |
| **Externos** | PostgreSQL, Google Drive, Gmail SMTP, Sentry | Servicios fuera del runtime de Vercel |

**Edges punteados** (`-.->`) = dependencia transversal que aplica a las 15 features por igual (acceso a datos vía Prisma, logging estructurado) — dibujarla 15 veces no aportaría legibilidad. Las edges sólidas son dependencias específicas de una feature puntual (ej. solo `document` usa `google-drive.ts`/`html-to-pdf.ts`/`html-to-docx.ts`; solo `notification` usa `email.ts`, para el envío opcional de alertas por correo).

**No incluido en el diagrama** (para no duplicar `ARQUITECTURA.md` §1): el resolver de Prisma por tenant (`getPrismaClient(tenantSlug)`), el cron `/api/cron/alerts`, y el flujo de `after()` de P3/P4 — están documentados con su propio diagrama de secuencia en `ARQUITECTURA.md` §2, §6 y §9.

---

© 2025–2026 INSOLVENTIC.
