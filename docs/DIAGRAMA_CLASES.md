# Diagrama de Clases — INSOLVENTIC

> Basado en los mismos 27 modelos de `src/prisma/schema.prisma` que el MER (`docs/MODELO_ENTIDAD_RELACION.md`), pero con enfoque orientado a objetos: atributos representativos por clase + asociaciones/composiciones con cardinalidad, en vez de tablas/FKs. Comparten fuente pero responden preguntas distintas — el MER es para diseñar el esquema relacional, este diagrama es para entender la estructura de dominio como la vería un desarrollador.

**Convención de relación usada:**
- **Composición (`*--`)**: el hijo no puede existir sin el padre y se borra en cascada con él (`onDelete: Cascade` en el schema). Ej.: `Acreedor` no existe sin `Case`.
- **Asociación (`--`)**: relación por FK sin cascada explícita — el hijo referencia al padre pero Prisma no lo destruye automáticamente si el padre se borra.
- Misma división en 3 vistas que el MER, por la misma razón de legibilidad (27 clases en un solo diagrama no se lee).

---

## Vista 1 — Núcleo + Personas

```mermaid
classDiagram
    class Tenant {
        +String id
        +String name
        +String slug
    }
    class ConciliationCenter {
        +String id
        +String code
        +String displayName
        +Boolean isActive
    }
    class User {
        +String id
        +String email
        +String professionalCard
        +Boolean mustChangePassword
    }
    class Role {
        +String id
        +String name
        +String color
    }
    class Permission {
        +String id
        +String name
        +String category
    }
    class RolePermission {
        +String id
    }
    class Case {
        +String id
        +String caseNumber
        +String type
        +String phase
        +Decimal totalDebt
        +Int version
    }
    class Debtor {
        +String id
        +String idNumber
        +String name
        +Decimal totalDebt
    }
    class Creditor {
        +String id
        +String nit
        +String name
    }
    class Contact {
        +String id
        +String name
        +String role
    }
    class Dependent {
        +String id
        +String name
        +Int age
        +String relationship
    }

    Tenant "1" -- "many" ConciliationCenter : opera
    Tenant "1" -- "many" User : emplea
    Tenant "1" -- "many" Case : posee
    Tenant "1" -- "many" Role : define
    Tenant "1" -- "many" Permission : define
    Tenant "1" -- "many" Debtor : registra
    Tenant "1" -- "many" Creditor : registra

    Role "1" -- "many" User : "asignado a"
    Role "1" *-- "many" RolePermission : tiene
    Permission "1" *-- "many" RolePermission : "otorgado en"

    User "1" -- "many" Case : opera
    Debtor "1" -- "many" Case : "es titular de"
    Case "1" *-- "many" Dependent : "tiene a cargo"
    Creditor "1" -- "many" Contact : tiene
```

---

## Vista 2 — Financiero/Patrimonial + Capa Definitivo

**Distinción de dos capas (misma que en el MER, repetida aquí porque es la que más se presta a malinterpretación en la reunión):** `Debt`/`Asset`/`LegalProcess`/`Libranza`/`SuspendedService` son la capa general — asociaciones normales, sin cascada. `Acreedor`/`Bien`/`ProcesoJudicial` son **composiciones** de `Case` (`onDelete: Cascade`): existen únicamente como snapshot congelado de las Secciones V/VI/VII del Formulario Definitivo y mueren con el caso. La UML aquí hace explícita una diferencia que en el ERD solo se ve en el texto de la relación.

```mermaid
classDiagram
    class Case {
        +String id
        +String caseNumber
    }
    class Creditor {
        +String id
        +String name
    }
    class Debtor {
        +String id
        +String name
    }
    class Debt {
        +String id
        +Decimal amount
        +Float interestRate
    }
    class Asset {
        +String id
        +String name
        +String type
        +Decimal value
    }
    class LegalProcess {
        +String id
        +String description
    }
    class Libranza {
        +String id
        +String payerName
        +Decimal deductedAmount
    }
    class SuspendedService {
        +String id
        +String creditorName
        +Decimal amountOwed
    }
    class Acreedor {
        +String id
        +String acreedorNombreRazonSocial
        +Decimal valorTotalObligacion
        +Boolean procesoJudicialEnCurso
    }
    class Bien {
        +String id
        +String bienTipo
        +Decimal bienValorComercial
        +Boolean bienEmbargado
    }
    class ProcesoJudicial {
        +String id
        +String tipoProceso
        +Decimal cuantiaProceso
        +String estadoProceso
    }

    Case "1" -- "many" Debt : "tiene (capa general)"
    Creditor "1" -- "many" Debt : "es acreedor de"
    Debtor "0..1" -- "many" Debt : "es deudor de"
    Case "1" -- "many" Asset : "tiene (capa general)"
    Debtor "0..1" -- "many" Asset : posee
    Case "1" -- "many" LegalProcess : "tiene (capa general)"
    Case "1" -- "many" Libranza : tiene
    Case "1" -- "many" SuspendedService : tiene

    Case "1" *-- "many" Acreedor : "snapshot §V Definitivo"
    Case "1" *-- "many" Bien : "snapshot §VI Definitivo"
    Case "1" *-- "many" ProcesoJudicial : "snapshot §VII Definitivo"
```

---

## Vista 3 — Documentos + Pagos + Operación

```mermaid
classDiagram
    class Case {
        +String id
        +String caseNumber
    }
    class DocumentTemplate {
        +String id
        +String fileName
        +Json placeholders
    }
    class Document {
        +String id
        +String name
        +String status
        +Boolean isGenerated
        +String section
    }
    class DocumentGenerationRequest {
        +String id
        +String kind
        +String status
        +String activeKey
        +Int totalDocuments
        +Int successCount
        +Int errorCount
    }
    class Payment {
        +String id
        +Decimal amount
        +String status
        +Int paymentNumber
    }
    class User {
        +String id
        +String email
    }
    class Debtor {
        +String id
        +String name
    }
    class Notification {
        +String id
        +String type
        +Boolean read
    }

    Case "1" *-- "many" Document : genera
    DocumentTemplate "1" -- "many" Document : "instancia de"
    Document "0..1" -- "many" Document : "reemplaza a (versión anterior)"
    Case "1" *-- "many" DocumentGenerationRequest : "solicita generación"
    Case "1" *-- "many" Payment : programa
    Debtor "1" -- "many" Payment : realiza
    User "0..1" -- "many" Payment : registra
    User "1" *-- "many" Notification : recibe
    Case "0..1" *-- "many" Notification : origina
```

**No incluidas** (solo se relacionan con `Tenant`): `DocumentFromDrive`, `PasswordResetToken`, `AuditLog` — ver `docs/DICCIONARIO_DATOS.md`.

---

© 2025–2026 INSOLVENTIC — generado desde `src/prisma/schema.prisma`.
