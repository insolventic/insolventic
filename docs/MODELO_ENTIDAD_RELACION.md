# Modelo Entidad-Relación (MER) — INSOLVENTIC

> Generado desde `src/prisma/schema.prisma` (25 modelos). Para el detalle campo-por-campo, tipos y constraints ver `docs/DICCIONARIO_DATOS.md` — este documento se enfoca en entidades, atributos estructurales (PK/FK y algunos representativos) y cardinalidad.

## Por qué 3 vistas y no 1

Un solo diagrama con las ~25 entidades y sus relaciones no es legible (es el mismo problema que tendría cualquier ERD de un sistema con formularios legales de ~400 campos). Se divide en 3 vistas temáticas que comparten algunas entidades "puente" (`Case`, `Debtor`, `Tenant`) para que se puedan leer por separado sin perder el hilo:

1. **Núcleo + Personas** — multi-tenant, RBAC, el caso, y las personas del dominio.
2. **Financiero/Patrimonial** — las entidades reutilizables de deuda, bienes y procesos judiciales.
3. **Documentos + Pagos + Operación** — generación documental, trazabilidad de pagos, notificaciones y auditoría.

`Tenant` es la raíz de aislamiento multi-tenant para las entidades restantes (cada una tiene `tenantId → Tenant`, N:1) — se muestra completo solo en la Vista 1 para no repetir flechas idénticas en las otras dos vistas.

---

## Vista 1 — Núcleo + Personas

```mermaid
erDiagram
    Tenant ||--o{ ConciliationCenter : opera
    Tenant ||--o{ Case : posee
    Tenant ||--o{ User : emplea
    Tenant ||--o{ Role : define
    Tenant ||--o{ Permission : define
    Tenant ||--o{ Debtor : registra
    Tenant ||--o{ Creditor : registra

    Role ||--o{ User : "asignado a"
    Role ||--o{ RolePermission : tiene
    Permission ||--o{ RolePermission : "otorgado en"

    User ||--o{ Case : opera
    Debtor ||--o{ Case : "es titular de"
    Case ||--o{ Dependent : "tiene a cargo"
    Creditor ||--o{ Contact : tiene

    Tenant {
        string id PK
        string name
        string slug
    }
    ConciliationCenter {
        string id PK
        string tenantId FK
        string code
        string displayName
    }
    User {
        string id PK
        string tenantId FK
        string roleId FK
        string email
        boolean mustChangePassword
    }
    Role {
        string id PK
        string tenantId FK
        string name
    }
    Permission {
        string id PK
        string tenantId FK
        string name
        string category
    }
    RolePermission {
        string id PK
        string roleId FK
        string permissionId FK
    }
    Case {
        string id PK
        string tenantId FK
        string debtorId FK
        string operatorId FK
        string caseNumber
        string type
        string phase
        int version
    }
    Debtor {
        string id PK
        string tenantId FK
        string idNumber
        string name
        decimal totalDebt
    }
    Creditor {
        string id PK
        string tenantId FK
        string nit
        string name
    }
    Contact {
        string id PK
        string creditorId FK
        string tenantId FK
        string name
    }
    Dependent {
        string id PK
        string caseId FK
        string tenantId FK
        string name
        int age
    }
```

**Notas de cardinalidad:** `Debtor ||--o{ Case` — un deudor puede tener varios expedientes (no es 1:1); `User ||--o{ Case` es el operador asignado (`Case.operatorId`), no el creador.

---

## Vista 2 — Financiero/Patrimonial

```mermaid
erDiagram
    Case ||--o{ Debt : "tiene (capa general)"
    Creditor ||--o{ Debt : "es acreedor de"
    Debtor ||--o{ Debt : "es deudor de (opcional)"
    Case ||--o{ Asset : "tiene (capa general)"
    Debtor ||--o{ Asset : "posee (opcional)"
    Case ||--o{ LegalProcess : "tiene (capa general)"
    Case ||--o{ Libranza : "tiene"
    Case ||--o{ SuspendedService : "tiene"

    Case {
        string id PK
        string debtorId FK
        decimal totalDebt
    }
    Creditor {
        string id PK
        string name
        string nit
    }
    Debtor {
        string id PK
        string name
    }
    Debt {
        string id PK
        string caseId FK
        string creditorId FK
        string debtorId FK
        decimal amount
        float interestRate
    }
    Asset {
        string id PK
        string caseId FK
        string debtorId FK
        string name
        decimal value
    }
    LegalProcess {
        string id PK
        string caseId FK
        string description
    }
    Libranza {
        string id PK
        string caseId FK
        decimal deductedAmount
    }
    SuspendedService {
        string id PK
        string caseId FK
        decimal amountOwed
    }
```

---

## Vista 3 — Documentos + Pagos + Operación

```mermaid
erDiagram
    Case ||--o{ Document : genera
    DocumentTemplate ||--o{ Document : "instancia de"
    Document ||--o{ Document : "reemplaza a (versión anterior)"
    Case ||--o{ DocumentGenerationRequest : "solicita generación"
    Case ||--o{ Payment : programa
    Debtor ||--o{ Payment : realiza
    User ||--o{ Payment : registra
    User ||--o{ Notification : recibe
    Case ||--o{ Notification : "origina (opcional)"

    Case {
        string id PK
        string caseNumber
    }
    DocumentTemplate {
        string id PK
        string tenantId FK
        string fileName
        json placeholders
    }
    Document {
        string id PK
        string caseId FK
        string templateId FK
        string supersededById FK
        string name
        string status
        boolean isGenerated
    }
    DocumentGenerationRequest {
        string id PK
        string caseId FK
        string kind
        string status
        string activeKey UK
    }
    Payment {
        string id PK
        string caseId FK
        string debtorId FK
        string registeredById FK
        decimal amount
        string status
    }
    Notification {
        string id PK
        string userId FK
        string caseId FK
        string type
        boolean read
    }
```

**No incluidas en el diagrama** (relacionan solo con `Tenant`, sin FK hacia `Case`): `DocumentFromDrive`, `PasswordResetToken`, `AuditLog` — ver `docs/DICCIONARIO_DATOS.md` §5 y §7 para su detalle completo. `AuditLog.userId/userName/userCedula` son copias desnormalizadas, no una FK formal a `User` — se preserva la traza aunque el usuario se borre.

---

© 2025–2026 INSOLVENTIC — generado desde `src/prisma/schema.prisma`.
