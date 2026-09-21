# Diccionario de Datos — INSOLVENTIC

> Generado desde `src/prisma/schema.prisma` (1.041 líneas, 27 modelos, PostgreSQL). Verificado campo por campo contra el schema real — sin datos inventados. Agosto 2026.

## Alcance de este documento

Describe el modelo de datos de la base de datos: tablas, columnas, tipos y relaciones, generado desde `src/prisma/schema.prisma`. Sirve para diseñar queries, migraciones y el MER — entender qué hay realmente en Postgres.

Es distinto de `docs/DICCIONARIO_PLACEHOLDERS.md`, que cataloga los _placeholders_ (`DEUDOR_NOMBRE`, `ACREEDOR_1_VALOR`...) que se inyectan en las plantillas HTML al generar un documento, con fuente en `src/features/document/placeholder-mapper.ts`. Para escribir o depurar una plantilla de documento legal, usar ese archivo.

---

## Cómo leer las tablas

- **Tipo**: tipo de Prisma tal como está en el schema (`String`, `Decimal`, `Boolean`, `DateTime`, `Json`, `Int`, `Float`, `String[]`). `?` al final = nullable.
- **Constraints**: `@id` (clave primaria), `@unique` / `@@unique(...)` (unicidad, a veces compuesta por tenant), `@@index(...)` (índice), `@default(...)`, `@map("...")` (nombre real de columna en Postgres cuando difiere del campo Prisma), `onDelete: Cascade/SetNull` en relaciones.
- **FK →**: modelo al que apunta la relación y su cardinalidad (`1:N`, `N:1`, `1:1`, `N:M` vía tabla intermedia).
- Todos los modelos tienen `tenantId → Tenant` (N:1) para aislamiento multi-tenant — se muestra en cada tabla pero no se repite la explicación.
- `cuid()` es el generador de IDs de Prisma (string corto, ordenable, sin colisión práctica) — todas las PK lo usan salvo que se indique lo contrario.

---

## Índice por grupo

1. [Núcleo (multi-tenant, RBAC, caso)](#1-núcleo) — Tenant, ConciliationCenter, Case, User, Role, Permission, RolePermission
2. [Personas](#2-personas) — Debtor, Creditor, Contact, Dependent
3. [Financiero / Patrimonial (capa general)](#3-financiero--patrimonial-capa-general) — Debt, Asset, LegalProcess, Libranza, SuspendedService
4. [Capa Definitivo (snapshots por caso)](#4-capa-definitivo-snapshots-congelados-por-caso) — Acreedor, Bien, ProcesoJudicial
5. [Documentos](#5-documentos) — Document, DocumentTemplate, DocumentFromDrive, DocumentGenerationRequest
6. [Pagos](#6-pagos) — Payment
7. [Operación / Seguridad](#7-operación--seguridad) — Notification, PasswordResetToken, AuditLog

**Total: 27 modelos.** (Nota: `Calendar` es una _feature_ de UI — `src/features/calendar/` — no tiene modelo Prisma propio; opera sobre `Case.hearingDate`/`firstHearingDate`.)

---

## 1. Núcleo

### Tenant

Raíz del aislamiento multi-tenant. Cada centro de conciliación (Armonía, Constructores de Paz) es un `Tenant`.

| Campo       | Tipo     | Constraints       | FK → | Descripción            |
| ----------- | -------- | ----------------- | ---- | ---------------------- |
| id          | String   | `@id`             | —    | PK                     |
| name        | String   | `@unique`         | —    | Nombre del centro      |
| slug        | String   | `@unique`         | —    | Identificador URL-safe |
| description | String?  |                   | —    | Descripción libre      |
| logoUrl     | String?  |                   | —    | Logo del centro        |
| createdAt   | DateTime | `@default(now())` | —    |                        |
| updatedAt   | DateTime | `@updatedAt`      | —    |                        |

**Relaciones:** raíz `1:N` de los 26 modelos restantes vía su `tenantId` (aislamiento multi-tenant — ver `ARQUITECTURA.md` §2).

### ConciliationCenter

Reemplaza un mapping hard-coded de centros; resuelve la carpeta L2 de Drive por centro.

| Campo           | Tipo     | Constraints       | FK →         | Descripción                             |
| --------------- | -------- | ----------------- | ------------ | --------------------------------------- |
| id              | String   | `@id`             | —            | PK                                      |
| tenantId        | String   |                   | Tenant (N:1) |                                         |
| code            | String   |                   | —            | Identificador estable (ej. `"armonia"`) |
| displayName     | String   |                   | —            | Nombre visible                          |
| driveFolderName | String   |                   | —            | Ruta de carpeta L2 en Google Drive      |
| isActive        | Boolean  | `@default(true)`  | —            |                                         |
| createdAt       | DateTime | `@default(now())` | —            |                                         |
| updatedAt       | DateTime | `@updatedAt`      | —            |                                         |

Constraints de tabla: `@@unique([tenantId, code])`, `@@index([tenantId, isActive])`.

### Case

Entidad central del sistema — el expediente de insolvencia/conciliación/apoyo. ~180 campos escalares propios (no cuenta relaciones), acumulados en varias iniciativas del proyecto: campos "legacy" originales, y un bloque más reciente etiquetado explícitamente en el schema como **"FORMULARIO DEFINITIVO"** (Secciones II–IV, VIII–XII) que replica la estructura del formulario legal oficial. Se divide aquí en sub-tablas siguiendo exactamente los comentarios de sección del propio `schema.prisma` — no es una reorganización editorial.

**Identificación y estado (núcleo, sin tag de sección):**

| Campo                    | Tipo      | Constraints                            | FK →         | Descripción                                                      |
| ------------------------ | --------- | -------------------------------------- | ------------ | ---------------------------------------------------------------- |
| id                       | String    | `@id`                                  | —            | PK                                                               |
| caseNumber               | String    | `@@unique([caseNumber, tenantId])`     | —            | Número de expediente                                             |
| debtorName               | String    |                                        | —            | Nombre del deudor (denormalizado)                                |
| type                     | String    |                                        | —            | `INSOLVENCY` / `CONCILIATION` / `SUPPORT_AGREEMENT`              |
| totalDebt                | Decimal   |                                        | —            | Deuda total                                                      |
| creditors                | Int       |                                        | —            | Conteo de acreedores (denormalizado)                             |
| createdDate              | DateTime  | `@default(now())`                      | —            |                                                                  |
| hearingDate              | DateTime? |                                        | —            | Fecha de audiencia (usada por scanner de alertas)                |
| phase                    | String?   |                                        | —            | Solicitud / Admisión / Negociación / Acuerdo / Fracaso           |
| causes                   | String[]  | `@default([])`                         | —            | Causas de insolvencia                                            |
| debtorId                 | String    |                                        | Debtor (N:1) |                                                                  |
| operatorId               | String    |                                        | User (N:1)   | Operador asignado                                                |
| tenantId                 | String    |                                        | Tenant (N:1) |                                                                  |
| tramite                  | String?   |                                        | —            |                                                                  |
| filingDate               | DateTime? |                                        | —            | Fecha de radicación                                              |
| debtorIdNumber           | String?   |                                        | —            | Cédula del deudor (denormalizada)                                |
| convened                 | String?   |                                        | —            |                                                                  |
| attorney                 | String?   |                                        | —            |                                                                  |
| owedCapital              | Decimal?  |                                        | —            |                                                                  |
| designatedOperator       | String?   |                                        | —            |                                                                  |
| designationDate          | DateTime? |                                        | —            |                                                                  |
| positionAcceptanceDate   | DateTime? |                                        | —            |                                                                  |
| inadmissionDate          | DateTime? |                                        | —            |                                                                  |
| admissionDate            | DateTime? |                                        | —            |                                                                  |
| firstHearingDate         | DateTime? |                                        | —            | Fallback de `hearingDate` para el scanner de alertas             |
| firstHearingTime         | String?   |                                        | —            |                                                                  |
| hasLegalProcesses        | Boolean   | `@default(false)`                      | —            |                                                                  |
| courtNumber              | String?   |                                        | —            |                                                                  |
| city                     | String?   |                                        | —            |                                                                  |
| processType              | String?   |                                        | —            |                                                                  |
| plaintiff                | String?   |                                        | —            |                                                                  |
| judicialFileNumber       | String?   |                                        | —            |                                                                  |
| suspensionDate           | DateTime? |                                        | —            |                                                                  |
| resultDeliveryDate       | DateTime? |                                        | —            |                                                                  |
| resultType               | String?   |                                        | —            | `"acuerdo"` / `"fracaso"` — dirige la máquina de estados de fase |
| resultDate               | DateTime? |                                        | —            |                                                                  |
| siccacNumber             | String?   |                                        | —            |                                                                  |
| riskCenterCommunication  | Boolean   | `@default(false)`                      | —            |                                                                  |
| driveFolderId            | String?   |                                        | —            | Carpeta raíz del caso en Drive                                   |
| layoutVersion            | Int       | `@default(0)` `@map("layout_version")` | —            | 0 = layout flat legacy, 1 = seccionado                           |
| version                  | Int       | `@default(0)`                          | —            | Optimistic locking (ver ARQUITECTURA.md §5)                      |
| isBilateral              | Boolean   | `@default(false)`                      | —            |                                                                  |
| bilateralAgreementNumber | String?   |                                        | —            |                                                                  |
| bilateralCreditorId      | String?   |                                        | —            | (no es FK formal — string libre)                                 |

**Ámbito de Aplicación (legacy):** `applicantScope String[] @default([])`.

**Propuesta de Pago (legacy, 20 campos):** `gracePeriodRequested`, `gracePeriodMonths`, `paymentInKind` (+`Description`), `assetSaleAuthorized` (+`Description`), `cashFlowPayment`, `paymentTermMonths`, `monthlyPaymentAmount`, `variablePayment`, `extraordinaryPayment` (+`Date`), `capitalReduction` (+`Percent`), `insuranceOffering`, `forgiveAccruedInterest`, `forgiveFutureInterest`, `paymentOrder Json?`, `hasClassPrivileges` (+`Description`), `thirdPartyPaymentAuth`, `guaranteeSubstitution`.

**Sociedad Conyugal (legacy, 5 campos):** `spouseName`, `spouseIdNumber`, `spouseAddress`, `spousePhone`, `spouseEmail` — reemplazados funcionalmente por la Sección II del Formulario Definitivo (`conyuge*`, abajo); se conservan por compatibilidad con datos históricos.

**Tarifa / Notificaciones / Firma / Zoom (legacy, 11 campos):** `requestedFee`, `legalFoundations`, `notificationAddress/Phone/Email`, `applicantSignatureName/Id/Signature`, `zoomMeetingId`, `zoomPassword`, `zoomLink`.

**Ingresos/Gastos (legacy, 5 campos):** `monthlyIncome`, `monthlyExpenses`, `otherIncomeDescription`, `otherIncomeAmount`, `hasEmployerCertification` — reemplazados funcionalmente por la Sección III del Formulario Definitivo (más granular, abajo).

**Post-Acuerdo / Fracaso (5 campos):** `paymentStartDate`, `agreementValidityDate`, `approvalPercentage`, `failureDate`, `failureType`.

**FORMULARIO DEFINITIVO — Sección II: Cónyuge (10 campos, todos `@map` a snake_case):**

| Campo                                          | Tipo                      | Descripción |
| ---------------------------------------------- | ------------------------- | ----------- |
| conyugeTipoIdentificacion                      | String?                   |             |
| conyugeIdentificacion                          | String?                   |             |
| conyugePrimerNombre / conyugeSegundoNombre     | String?                   |             |
| conyugePrimerApellido / conyugeSegundoApellido | String?                   |             |
| conyugeNombreCompleto                          | String?                   |             |
| conyugeTelefono / conyugeCorreo                | String?                   |             |
| sociedadConyugalDisuelta                       | Boolean `@default(false)` |             |

**FORMULARIO DEFINITIVO — Sección III: Información Laboral y Económica (20 campos):** datos laborales (`deudorOcupacion`, `deudorProfesion`, `deudorActividadEconomica`, `deudorTipoVinculacion`, `deudorNombreEmpleador`, `deudorNitEmpleador`), ingresos (`ingresoPrincipalMensual`, `otrosIngresosMensuales`, `totalIngresosMensuales`, `ingresosVariablesPromedio`, `ingresosNoOperacionales` — todos `Decimal?`), gastos (`gastosVivienda/Alimentacion/ServiciosPublicos/Transporte/Educacion/Salud`, `otrosGastos`, `totalGastosMensuales` — todos `Decimal?`), capacidad económica (`capacidadPagoEstimada`, `patrimonioTotalEstimado`, `pasivoTotalEstimado` — `Decimal?`).

**FORMULARIO DEFINITIVO — Sección IV: Declaración de Cesación de Pagos (6 campos):** `cesacionPagos Boolean`, `fechaCesacionPagos DateTime?`, `numeroAcreedoresActual Int?`, `porcentajePasivoEnMora Decimal?`, `obligacionesEnMora90Dias Boolean`, `procesosEjecutivosVigentes Boolean`.

**FORMULARIO DEFINITIVO — Sección VIII: Declaraciones del Deudor (8 campos, todos `Boolean @default(false)`):** `declaracionVeracidadInformacion`, `manifestacionBuenaFe`, `manifestacionNoOcultamientoBienes`, `autorizacionNotificacionesCorreo`, `autorizacionConsultaCentralesRiesgo`, `autorizacionTratamientoDatos`, `declaracionNoOmisiones`, `declaracionConocimientoNorma`.

**CONCILIACIÓN — campos específicos del servicio (~65 campos, prefijo `conc`):** datos del caso (`concAsunto`, `concDescripcionHechos @db.Text`, `concPretensiones @db.Text`, `concCuantiaPesos/Letras`, `concRelacionPruebas @db.Text`, `concOtroMedioComunicacion`, `concFechaNacimiento`); cinco bloques de identificación con la misma forma (`Name`, `TipoId`, `Id`, `Direccion`, `Ciudad`, `Correo`, `Cel` [+`TP` para apoderados]) para **convocante**, **convocado**, **representante legal**, **apoderado convocante** y **apoderado convocado**; datos de la conciliadora (`concConciliadoraName/CC/TP`); acuerdo/acta (`concAcuerdoConciliatorio`, `concInfoAdicional` — `@db.Text`); cláusulas de alimentos (`concClausulaPrimero/Segundo/TerceroAlimentos @db.Text`, `concNombreMenor`); cláusulas adicionales genéricas (`concNumero/TextoClausula`, `concNumero/TextoClausulaAdicional`); situación de bienes/alimentos (`concSituacionBienes/Alimentos @db.Text`); resultado (`concDescripcionResultado`, `concTipoConstanciaSolicitada`, `concDescripcionCausaAnormal`, `concHoraProgramada`, `concCausaTerminacion`, `concResultadoInforme`); **6 campos `Json?`** para secciones repetibles vía `{{#each}}` de handlebars-lite: `concMenoresAlimentos`, `concMenoresUnion`, `concClausulasAdicionalesAlimentos/Union/Disolucion`, `concClausulasAcuerdo`.

**ACUERDO DE APOYO — campos específicos del servicio (~24 campos, prefijo `apoyo`):** datos del caso (`apoyoAsunto`, `apoyoDescripcionHechos/Pretensiones @db.Text`, `apoyoMontoMensual`, `apoyoPlazoMeses`, `apoyoCondiciones @db.Text`, `apoyoTipoApoyo`); dos bloques de identificación (misma forma que conciliación) para **beneficiario** y **prestador** (+`apoyoPrestadorRelacion`); conciliadora asignada; acuerdo/resultado (`apoyoAcuerdo/Resultado @db.Text`, `apoyoCausaTerminacion`); `apoyoClausulas Json?` (array `[{NUMERO_CLAUSULA, TEXTO_CLAUSULA}]`).

**FORMULARIO DEFINITIVO — Sección IX: Propuesta Inicial de Pago (6 campos):** `propuestaPlazoMeses Int?`, `propuestaPeriodicidadPago String?`, `propuestaTasaInteres/QuitaPromedio Decimal?`, `propuestaFechaInicioPago DateTime?`, `propuestaObservaciones String?`.

**FORMULARIO DEFINITIVO — Sección X: Documentos Anexos (7 campos, todos `Boolean @default(false)`):** `anexaSoporteIngresos`, `anexaExtractosBancarios`, `anexaCertificadosDeuda`, `anexaCertificadoTradicion`, `anexaRelacionProcesos`, `anexaDeclaracionRenta`, `anexaDocumentoIdentidad`.

**FORMULARIO DEFINITIVO — Sección XI: Información del Apoderado (8 campos):** `apoderadoNombreCompleto`, `apoderadoTipoIdentificacion`, `apoderadoIdentificacion`, `apoderadoTarjetaProfesional`, `apoderadoDireccion`, `apoderadoTelefono`, `apoderadoCorreo`, `existePoderOtorgado Boolean`. _(El apoderado no es un modelo propio — vive como campos planos en `Case`.)_

**FORMULARIO DEFINITIVO — Sección XII: Datos Radicación Interna (6 campos):** `expedienteNumero`, `expedienteAnio Int?`, `fechaRadicacion DateTime? @map("fecha_radicacion_interna")`, `centroConciliacionNombre`, `conciliadorAsignado`, `ciudadRadicacion`.

**Relaciones de `Case`:**

| Relación                                                                                                                                                               | Cardinalidad   | Modelo                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| debtor                                                                                                                                                                 | N:1            | Debtor                                                                                                                                                        |
| operator                                                                                                                                                               | N:1            | User                                                                                                                                                          |
| tenant                                                                                                                                                                 | N:1            | Tenant                                                                                                                                                        |
| assets, debts, documents, legalProcesses, Notification, libranzas, suspendedServices, dependents, acreedores, bienes, procesosJudiciales, payments, generationRequests | 1:N (cada uno) | Asset, Debt, Document, LegalProcess, Notification, Libranza, SuspendedService, Dependent, Acreedor, Bien, ProcesoJudicial, Payment, DocumentGenerationRequest |

### User

| Campo              | Tipo      | Constraints                                      | FK →         | Descripción                                          |
| ------------------ | --------- | ------------------------------------------------ | ------------ | ---------------------------------------------------- |
| id                 | String    | `@id`                                            | —            | PK                                                   |
| name               | String    |                                                  | —            |                                                      |
| email              | String    | `@@unique([email, tenantId])`                    | —            |                                                      |
| lastLogin          | DateTime? |                                                  | —            |                                                      |
| professionalCard   | String    |                                                  | —            | Tarjeta profesional (requerida por el dominio legal) |
| phone              | String    |                                                  | —            |                                                      |
| address            | String    |                                                  | —            |                                                      |
| createdDate        | DateTime  | `@default(now())`                                | —            |                                                      |
| roleId             | String    |                                                  | Role (N:1)   |                                                      |
| password           | String?   |                                                  | —            | Hash bcrypt; nullable durante invitación pendiente   |
| mustChangePassword | Boolean   | `@default(false)` `@map("must_change_password")` | —            | Fuerza cambio en primer login                        |
| tenantId           | String    |                                                  | Tenant (N:1) |                                                      |

**Relaciones:** `assignedCases` (1:N vía `Case.operatorId`), `Notification` (1:N como destinatario), `registeredPayments` (1:N vía `Payment.registeredById`).

### Role

| Campo       | Tipo   | Constraints                             | FK →         | Descripción            |
| ----------- | ------ | --------------------------------------- | ------------ | ---------------------- |
| id          | String | `@id`                                   | —            | PK                     |
| name        | String | `@@unique([name, tenantId])`            | —            |                        |
| description | String |                                         | —            |                        |
| color       | String | `@default("bg-gray-100 text-gray-800")` | —            | Clase Tailwind para UI |
| tenantId    | String |                                         | Tenant (N:1) |                        |

**Relaciones:** `users` (1:N), `permissions` (N:M vía `RolePermission`).

### Permission

| Campo                 | Tipo     | Constraints                      | FK →         | Descripción                |
| --------------------- | -------- | -------------------------------- | ------------ | -------------------------- |
| id                    | String   | `@id`                            | —            | PK                         |
| name                  | String   | `@@unique([name, tenantId])`     | —            | Nombre del permiso (`P.*`) |
| category              | String   |                                  | —            | Agrupación en UI           |
| createdAt / updatedAt | DateTime | `@default(now())` / `@updatedAt` | —            |                            |
| tenantId              | String   |                                  | Tenant (N:1) |                            |

**Relaciones:** `roles` (N:M vía `RolePermission`).

### RolePermission

Tabla intermedia N:M entre `Role` y `Permission`.

| Campo        | Tipo   | Constraints         | FK →             | Descripción |
| ------------ | ------ | ------------------- | ---------------- | ----------- |
| id           | String | `@id`               | —                | PK          |
| roleId       | String | `onDelete: Cascade` | Role (N:1)       |             |
| permissionId | String | `onDelete: Cascade` | Permission (N:1) |             |
| tenantId     | String |                     | Tenant (N:1)     |             |

Constraint: `@@unique([roleId, permissionId])`.

---

## 2. Personas

### Debtor

El deudor. Igual que `Case`, mezcla campos "generales" originales con un bloque **FORMULARIO DEFINITIVO — Sección I** más reciente y granular.

**Datos generales:**

| Campo                                      | Tipo               | Constraints                      | FK →         | Descripción                                                   |
| ------------------------------------------ | ------------------ | -------------------------------- | ------------ | ------------------------------------------------------------- |
| id                                         | String             | `@id`                            | —            | PK                                                            |
| name                                       | String             |                                  | —            |                                                               |
| idNumber                                   | String             | `@@unique([idNumber, tenantId])` | —            | Cédula                                                        |
| idType                                     | String             |                                  | —            |                                                               |
| email                                      | String             | `@@unique([email, tenantId])`    | —            |                                                               |
| phone                                      | String             |                                  | —            |                                                               |
| address / city / department                | String             |                                  | —            |                                                               |
| birthDate                                  | DateTime?          |                                  | —            |                                                               |
| maritalStatus                              | String?            |                                  | —            |                                                               |
| occupation                                 | String             |                                  | —            |                                                               |
| monthlyIncome                              | Decimal            |                                  | —            |                                                               |
| monthlyExpenses                            | Decimal?           |                                  | —            |                                                               |
| dependents                                 | Int?               |                                  | —            | Conteo denormalizado (no confundir con el modelo `Dependent`) |
| educationLevel                             | String?            |                                  | —            |                                                               |
| totalDebt                                  | Decimal            |                                  | —            |                                                               |
| emergencyContact / emergencyPhone          | String?            |                                  | —            |                                                               |
| bankAccount / bankName / accountType       | String?            |                                  | —            |                                                               |
| description                                | String?            |                                  | —            |                                                               |
| activeCases                                | Int                |                                  | —            | Conteo denormalizado                                          |
| createdDate                                | DateTime           | `@default(now())`                | —            |                                                               |
| lastUpdate                                 | DateTime           | `@updatedAt`                     | —            |                                                               |
| tenantId                                   | String             |                                  | Tenant (N:1) |                                                               |
| otherIncomeDescription / otherIncomeAmount | String? / Decimal? | (legacy)                         | —            |                                                               |
| hasEmployerCertification                   | Boolean            | `@default(false)` (legacy)       | —            |                                                               |

**FORMULARIO DEFINITIVO — Sección I: Identificación del Deudor (19 campos, todos `@map` a snake_case):**

| Campo                                                                                                 | Tipo                      | Descripción                                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| deudorTipoIdentificacion / deudorIdentificacion                                                       | String?                   |                                                                                  |
| deudorPrimerNombre / deudorSegundoNombre                                                              | String?                   |                                                                                  |
| deudorPrimerApellido / deudorSegundoApellido                                                          | String?                   |                                                                                  |
| deudorNombreCompleto                                                                                  | String?                   |                                                                                  |
| deudorFechaNacimiento                                                                                 | DateTime?                 |                                                                                  |
| deudorLugarNacimiento / deudorNacionalidad                                                            | String?                   |                                                                                  |
| deudorEstadoCivil / deudorRegimenMatrimonial                                                          | String?                   |                                                                                  |
| sociedadConyugalVigente / existeCapitulaciones                                                        | Boolean `@default(false)` |                                                                                  |
| deudorDireccionResidencia                                                                             | String?                   |                                                                                  |
| deudorCiudad (`@map("deudor_ciudad_form")`) / deudorDepartamento (`@map("deudor_departamento_form")`) | String?                   | Mapeados con sufijo `_form` para no colisionar con `city`/`department` de arriba |
| deudorCodigoPostal                                                                                    | String?                   |                                                                                  |
| deudorTelefonoFijo / deudorTelefonoCelular                                                            | String?                   |                                                                                  |
| deudorCorreoElectronico                                                                               | String?                   |                                                                                  |

**Relaciones:** `tenant` (N:1), `assets` `debts` `payments` (1:N), `cases` (**N:M** — un deudor puede tener varios casos, `Case.debtorId` es N:1 hacia `Debtor` pero `Debtor.cases` está declarado como lista sin campo inverso explícito de FK único, es decir la relación real es 1:N Debtor→Case a través de `Case.debtorId`).

### Creditor

Registro **maestro y reutilizable** del acreedor — independiente de un caso puntual. Ver nota de capas más abajo.

| Campo                                                        | Tipo      | Constraints                   | FK →         | Descripción |
| ------------------------------------------------------------ | --------- | ----------------------------- | ------------ | ----------- |
| id                                                           | String    | `@id`                         | —            | PK          |
| name                                                         | String    |                               | —            |             |
| type                                                         | String    |                               | —            |             |
| email                                                        | String    | `@@unique([email, tenantId])` | —            |             |
| phone                                                        | String    |                               | —            |             |
| address                                                      | String    |                               | —            |             |
| representative                                               | String    |                               | —            |             |
| nit                                                          | String    | `@@unique([nit, tenantId])`   | —            |             |
| website                                                      | String?   |                               | —            |             |
| city / department                                            | String?   |                               | —            |             |
| bankName                                                     | String?   |                               | —            |             |
| createdDate                                                  | DateTime? | `@default(now())`             | —            |             |
| lastUpdate                                                   | DateTime? | `@updatedAt`                  | —            |             |
| description                                                  | String?   |                               | —            |             |
| representativeId / representativeEmail / representativePhone | String?   |                               | —            |             |
| tenantId                                                     | String    |                               | Tenant (N:1) |             |

**Relaciones:** `contacts` (1:N), `debts` (1:N vía `Debt.creditorId`).

### Contact

Contacto de un `Creditor` (persona de enlace).

| Campo                       | Tipo   | Constraints | FK →           | Descripción |
| --------------------------- | ------ | ----------- | -------------- | ----------- |
| id                          | String | `@id`       | —              | PK          |
| name / role / email / phone | String |             | —              |             |
| creditorId                  | String |             | Creditor (N:1) |             |
| tenantId                    | String |             | Tenant (N:1)   |             |

### Dependent

Personas a cargo del deudor (distinto de `Debtor.dependents Int?`, que es solo el conteo).

| Campo        | Tipo   | Constraints | FK →         | Descripción |
| ------------ | ------ | ----------- | ------------ | ----------- |
| id           | String | `@id`       | —            | PK          |
| name         | String |             | —            |             |
| age          | Int    |             | —            |             |
| relationship | String |             | —            | Parentesco  |
| caseId       | String |             | Case (N:1)   |             |
| tenantId     | String |             | Tenant (N:1) |             |

---

## 3. Financiero / Patrimonial (capa general)

Estas cinco entidades capturan la información financiera/patrimonial **general** del caso, tal como se registra durante la negociación — a diferencia de la Capa Definitivo (§4), no son un snapshot congelado de una sección formal del formulario legal.

### Debt

Obligación de un caso frente a un acreedor.

| Campo                                          | Tipo      | Constraints       | FK →                   | Descripción                                              |
| ---------------------------------------------- | --------- | ----------------- | ---------------------- | -------------------------------------------------------- |
| id                                             | String    | `@id`             | —                      | PK                                                       |
| amount                                         | Decimal   |                   | —                      |                                                          |
| interestRate                                   | Float     |                   | —                      |                                                          |
| type                                           | String    |                   | —                      |                                                          |
| caseId                                         | String    |                   | Case (N:1)             |                                                          |
| creditorId                                     | String    |                   | Creditor (N:1)         |                                                          |
| debtorId                                       | String?   |                   | Debtor (N:1, opcional) |                                                          |
| tenantId                                       | String    |                   | Tenant (N:1)           |                                                          |
| creditorAddress / creditorCity / creditorEmail | String?   |                   | —                      | Copia denormalizada del acreedor al momento del registro |
| capitalAmount / interestAmount                 | Decimal?  |                   | —                      |                                                          |
| isDeferred                                     | Boolean   | `@default(false)` | —                      |                                                          |
| documentType                                   | String?   |                   | —                      |                                                          |
| grantDate / dueDate                            | DateTime? |                   | —                      |                                                          |
| creditClassification                           | String?   |                   | —                      |                                                          |
| hasActiveLibranza                              | Boolean   | `@default(false)` | —                      |                                                          |
| creditorClass                                  | String?   |                   | —                      |                                                          |
| percentageOfTotal                              | Decimal?  |                   | —                      |                                                          |
| daysOverdue                                    | Int?      |                   | —                      |                                                          |
| coDebtorName / coDebtorCity / coDebtorAddress  | String?   |                   | —                      | Codeudor                                                 |

### Asset

Bien del caso — registro general (contraparte de `Bien`, la versión Sección VI del Formulario Definitivo).

| Campo                                                                                                    | Tipo     | Constraints       | FK →                   | Descripción                       |
| -------------------------------------------------------------------------------------------------------- | -------- | ----------------- | ---------------------- | --------------------------------- |
| id                                                                                                       | String   | `@id`             | —                      | PK                                |
| name / type                                                                                              | String   |                   | —                      |                                   |
| value                                                                                                    | Decimal  |                   | —                      |                                   |
| caseId                                                                                                   | String   |                   | Case (N:1)             |                                   |
| debtorId                                                                                                 | String?  |                   | Debtor (N:1, opcional) |                                   |
| tenantId                                                                                                 | String   |                   | Tenant (N:1)           |                                   |
| propertyType, address, registrationNumber, encumbrance, affectation, precautionaryMeasure, proofDocument | String?  |                   | —                      | Campos específicos de inmueble    |
| isFamilyHome / isInalienablePatrimony                                                                    | Boolean  | `@default(false)` | —                      |                                   |
| brand, model, condition, licensePlate, transitAuthority, guaranteeInFavorOf, material, description       | String?  |                   | —                      | Campos específicos de bien mueble |
| guaranteeAmount                                                                                          | Decimal? |                   | —                      |                                   |

### LegalProcess

Proceso judicial — registro general (contraparte de `ProcesoJudicial`, Sección VII del Formulario Definitivo).

| Campo                                                           | Tipo    | Constraints | FK →         | Descripción |
| --------------------------------------------------------------- | ------- | ----------- | ------------ | ----------- |
| id                                                              | String  | `@id`       | —            | PK          |
| description                                                     | String  |             | —            |             |
| caseId                                                          | String  |             | Case (N:1)   |             |
| tenantId                                                        | String  |             | Tenant (N:1) |             |
| processType, plaintiff, court, fileNumber, precautionaryMeasure | String? |             | —            |             |

### Libranza

Deducción de nómina asociada a una deuda.

| Campo                                  | Tipo    | Constraints | FK →         | Descripción |
| -------------------------------------- | ------- | ----------- | ------------ | ----------- |
| id                                     | String  | `@id`       | —            | PK          |
| payerName                              | String  |             | —            |             |
| payerAddress / payerEmail / payerPhone | String? |             | —            |             |
| deductedAmount                         | Decimal |             | —            |             |
| productAndCreditor                     | String? |             | —            |             |
| caseId                                 | String  |             | Case (N:1)   |             |
| tenantId                               | String  |             | Tenant (N:1) |             |

### SuspendedService

Servicio suspendido por falta de pago.

| Campo                   | Tipo    | Constraints | FK →         | Descripción |
| ----------------------- | ------- | ----------- | ------------ | ----------- |
| id                      | String  | `@id`       | —            | PK          |
| creditorName            | String  |             | —            |             |
| address / email / phone | String? |             | —            |             |
| suspendedProduct        | String? |             | —            |             |
| amountOwed              | Decimal |             | —            |             |
| caseId                  | String  |             | Case (N:1)   |             |
| tenantId                | String  |             | Tenant (N:1) |             |

---

## 4. Capa Definitivo (snapshots congelados por caso)

**Nota de diseño (no son duplicados de §2/§3):** `Acreedor`, `Bien` y `ProcesoJudicial` replican, campo por campo, las Secciones V, VI y VII del **Formulario Definitivo** legal — un registro detallado y congelado por caso, distinto del dato general capturado en `Creditor`/`Asset`/`LegalProcess` (§2/§3), que es reutilizable entre casos. El propio `schema.prisma` los marca con el comentario `// FORMULARIO DEFINITIVO - Sección V/VI/VII` (líneas 708–815), y la UI los muestra en cards tituladas "Acreedores Definitivo" / "Bienes Definitivo" (`case-details-dialog/definitivo-section.tsx`). Los tres tienen `onDelete: Cascade` desde `Case` — se destruyen junto con el caso, reforzando que son datos derivados/congelados del caso, no un registro maestro independiente.

### Acreedor — Sección V: Relación Completa de Acreedores

`@@map("acreedores")`

| Campo                                                                                                            | Tipo      | Constraints                      | Descripción                      |
| ---------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------- | -------------------------------- |
| id                                                                                                               | String    | `@id`                            | PK                               |
| caseId                                                                                                           | String    | `onDelete: Cascade` → Case (N:1) |                                  |
| tenantId                                                                                                         | String    | → Tenant (N:1)                   |                                  |
| acreedorTipo                                                                                                     | String?   |                                  | 5.1 Identificación               |
| acreedorNombreRazonSocial                                                                                        | String    | (requerido)                      |                                  |
| acreedorTipoIdentificacion / acreedorIdentificacion                                                              | String?   |                                  |                                  |
| acreedorDireccion / acreedorCiudad                                                                               | String?   |                                  |                                  |
| acreedorCorreo / acreedorTelefono                                                                                | String?   |                                  |                                  |
| tipoObligacion / numeroObligacion                                                                                | String?   |                                  | 5.2 Información de la obligación |
| fechaOtorgamiento / fechaVencimiento / fechaMora                                                                 | DateTime? |                                  |                                  |
| diasMora                                                                                                         | Int?      |                                  |                                  |
| valorCapital, valorInteresesCorrientes, valorInteresesMora, valorGastosCobranza, valorTotalObligacion            | Decimal?  |                                  |                                  |
| naturalezaCredito                                                                                                | String?   |                                  |                                  |
| obligacionCodeudores                                                                                             | Boolean   | `@default(false)`                |                                  |
| nombreCodeudores                                                                                                 | String?   |                                  |                                  |
| garantiaAsociada                                                                                                 | Boolean   | `@default(false)`                |                                  |
| tipoGarantia / descripcionGarantia                                                                               | String?   |                                  |                                  |
| procesoJudicialEnCurso                                                                                           | Boolean   | `@default(false)`                | 5.3 Información judicial         |
| tipoProcesoJudicial / juzgadoNombre / juzgadoCiudad / procesoJudicialRadicado / demandanteNombre / etapaProcesal | String?   |                                  |                                  |

### Bien — Sección VI: Inventario Detallado de Bienes

`@@map("bienes")`

| Campo                                                     | Tipo     | Constraints                      | Descripción            |
| --------------------------------------------------------- | -------- | -------------------------------- | ---------------------- |
| id                                                        | String   | `@id`                            | PK                     |
| caseId                                                    | String   | `onDelete: Cascade` → Case (N:1) |                        |
| tenantId                                                  | String   | → Tenant (N:1)                   |                        |
| bienTipo                                                  | String   | (requerido)                      | 6.1 Identificación     |
| bienDescripcion / bienUbicacion                           | String?  |                                  |                        |
| bienMatriculaInmobiliaria / bienPlaca                     | String?  |                                  |                        |
| bienEntidadFinanciera                                     | String?  |                                  |                        |
| bienValorComercial / bienValorCatastral / bienValorLibros | Decimal? |                                  | 6.2 Valoración         |
| bienGravamenes                                            | Boolean  | `@default(false)`                | 6.3 Situación jurídica |
| descripcionGravamen                                       | String?  |                                  |                        |
| bienEmbargado                                             | Boolean  | `@default(false)`                |                        |
| bienAfectadoViviendaFamiliar                              | Boolean  | `@default(false)`                |                        |
| bienEnLeasing                                             | Boolean  | `@default(false)`                |                        |

### ProcesoJudicial — Sección VII: Relación de Procesos Judiciales

`@@map("procesos_judiciales")`

| Campo                              | Tipo     | Constraints                      | Descripción |
| ---------------------------------- | -------- | -------------------------------- | ----------- |
| id                                 | String   | `@id`                            | PK          |
| caseId                             | String   | `onDelete: Cascade` → Case (N:1) |             |
| tenantId                           | String   | → Tenant (N:1)                   |             |
| tipoProceso                        | String?  |                                  |             |
| juzgadoNombre / juzgadoCiudad      | String?  |                                  |             |
| procesoJudicialRadicado            | String?  |                                  |             |
| demandanteNombre / demandadoNombre | String?  |                                  |             |
| cuantiaProceso                     | Decimal? |                                  |             |
| estadoProceso                      | String?  |                                  |             |

---

## 5. Documentos

### Document

Documento generado o adjuntado a un caso.

| Campo                               | Tipo       | Constraints                                     | FK →                             | Descripción                                                        |
| ----------------------------------- | ---------- | ----------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| id                                  | String     | `@id`                                           | —                                | PK                                                                 |
| name / type / status                | String     |                                                 | —                                |                                                                    |
| uploadDate                          | DateTime   | `@default(now())`                               | —                                |                                                                    |
| url                                 | String     |                                                 | —                                |                                                                    |
| caseId                              | String     |                                                 | Case (N:1)                       |                                                                    |
| tenantId                            | String     |                                                 | Tenant (N:1)                     |                                                                    |
| templateId                          | String?    |                                                 | DocumentTemplate (N:1, opcional) |                                                                    |
| googleDriveId / fileName / mimeType | String?    |                                                 | —                                |                                                                    |
| isGenerated                         | Boolean    | `@default(false)`                               | —                                | Generado por el sistema vs. subido manualmente                     |
| templateFolderPath                  | String[]   | `@default([])`                                  | —                                |                                                                    |
| section                             | String?    | `@map("section")`                               | —                                | Layout seccionado v1: `GENERADO`/`ADJUNTO`/`EVIDENCIA`/`HISTORIAL` |
| supersededById                      | String?    | `@map("superseded_by_id")`, `onDelete: SetNull` | Document (N:1, auto-referencia)  | Apunta al documento que lo reemplazó al regenerarse                |
| supersedes                          | Document[] | (inversa de arriba)                             | Document (1:N, auto-referencia)  |                                                                    |

Constraint: `@@index([caseId, section])`.

### DocumentTemplate

Plantilla registrada en Drive (metadata, no el HTML fuente que vive en `templates/`).

| Campo                               | Tipo     | Constraints                      | FK →         | Descripción |
| ----------------------------------- | -------- | -------------------------------- | ------------ | ----------- |
| id                                  | String   | `@id`                            | —            | PK          |
| googleDriveId / fileName / mimeType | String   |                                  | —            |             |
| placeholders                        | Json     |                                  | —            |             |
| createdAt / updatedAt               | DateTime | `@default(now())` / `@updatedAt` | —            |             |
| folderPath                          | String[] | `@default([])`                   | —            |             |
| parentFolderId                      | String?  |                                  | —            |             |
| isFolder                            | Boolean  | `@default(false)`                | —            |             |
| tenantId                            | String   |                                  | Tenant (N:1) |             |

**Relaciones:** `documents` (1:N).

### DocumentFromDrive

Archivo o carpeta importado de Drive (no generado por el sistema).

| Campo                               | Tipo     | Constraints                           | FK →         | Descripción |
| ----------------------------------- | -------- | ------------------------------------- | ------------ | ----------- |
| id                                  | String   | `@id`                                 | —            | PK          |
| googleDriveId / fileName / mimeType | String   | `@@unique([googleDriveId, tenantId])` | —            |             |
| size                                | String?  |                                       | —            |             |
| createdAt / updatedAt               | DateTime | `@default(now())` / `@updatedAt`      | —            |             |
| folderPath                          | String[] | `@default([])`                        | —            |             |
| parentFolderId                      | String?  |                                       | —            |             |
| isFolder                            | Boolean  | `@default(false)`                     | —            |             |
| tenantId                            | String   |                                       | Tenant (N:1) |             |

### DocumentGenerationRequest

Estado del job de generación + lock anti-duplicados (P3/P4, ver `ARQUITECTURA.md` §6). `@@map("document_generation_requests")`.

| Campo                                      | Tipo      | Constraints             | FK →         | Descripción                                                                                                               |
| ------------------------------------------ | --------- | ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| id                                         | String    | `@id`                   | —            | PK                                                                                                                        |
| tenantId                                   | String    |                         | Tenant (N:1) |                                                                                                                           |
| caseId                                     | String    | `onDelete: Cascade`     | Case (N:1)   |                                                                                                                           |
| kind                                       | String    |                         | —            | `INITIAL` \| `ADMISSION` \| `AGREEMENT` \| `FAILURE`                                                                      |
| status                                     | String    | `@default("PENDING")`   | —            | `PENDING` → `PROCESSING` → `COMPLETED` / `COMPLETED_WITH_ERRORS` / `FAILED`                                               |
| activeKey                                  | String?   | `@@unique([activeKey])` | —            | `"{caseId}:{kind}"` mientras activa, `NULL` al terminar — unicidad parcial nativa de Postgres, es el lock anti-duplicados |
| requestedById                              | String?   |                         | —            | (no es FK formal)                                                                                                         |
| error                                      | String?   |                         | —            |                                                                                                                           |
| totalDocuments / successCount / errorCount | Int       | `@default(0)`           | —            |                                                                                                                           |
| createdAt                                  | DateTime  | `@default(now())`       | —            |                                                                                                                           |
| startedAt / finishedAt                     | DateTime? |                         | —            |                                                                                                                           |

Constraint adicional: `@@index([tenantId, caseId, createdAt])`.

---

## 6. Pagos

### Payment

`@@map("payments")`. No existe un modelo "cronograma" separado — el cronograma de pagos se deriva agrupando filas `Payment` por `caseId` + `paymentNumber`/`dueDate`.

| Campo                                            | Tipo      | Constraints                      | FK →                 | Descripción                                        |
| ------------------------------------------------ | --------- | -------------------------------- | -------------------- | -------------------------------------------------- |
| id                                               | String    | `@id`                            | —                    | PK                                                 |
| caseId                                           | String    | `onDelete: Cascade`              | Case (N:1)           |                                                    |
| debtorId                                         | String    |                                  | Debtor (N:1)         |                                                    |
| tenantId                                         | String    |                                  | Tenant (N:1)         |                                                    |
| amount                                           | Decimal   |                                  | —                    |                                                    |
| paymentDate / dueDate                            | DateTime? |                                  | —                    | `dueDate` es lo que consulta `scanOverduePayments` |
| paymentMethod                                    | String?   |                                  | —                    |                                                    |
| observations                                     | String?   | `@db.Text`                       | —                    |                                                    |
| registeredById                                   | String?   |                                  | User (N:1, opcional) |                                                    |
| status                                           | String    | `@default("pendiente")`          | —                    | `pendiente` / `pagado` / `parcial` / `vencido`     |
| receiptFileId / receiptFileName / receiptFileUrl | String?   |                                  | —                    | Comprobante en Drive                               |
| paymentNumber                                    | Int?      |                                  | —                    | Número de cuota                                    |
| createdAt / updatedAt                            | DateTime  | `@default(now())` / `@updatedAt` | —                    |                                                    |

Índices: `@@index([caseId])`, `@@index([tenantId, status])`, `@@index([tenantId, debtorId])`, `@@index([tenantId, paymentDate])`, `@@index([tenantId, registeredById])`, `@@index([tenantId, dueDate, status])`, `@@index([tenantId, caseId, status])` — el volumen de índices refleja los filtros del reporte de Trazabilidad de Pagos y del scanner de alertas.

---

## 7. Operación / Seguridad

### Notification

`@@map("notifications")`.

| Campo                  | Tipo     | Constraints         | FK →                 | Descripción                                                |
| ---------------------- | -------- | ------------------- | -------------------- | ---------------------------------------------------------- |
| id                     | String   | `@id`               | —                    | PK                                                         |
| type / title / message | String   |                     | —                    |                                                            |
| userId                 | String   | `onDelete: Cascade` | User (N:1)           | Destinatario                                               |
| caseId                 | String?  | `onDelete: Cascade` | Case (N:1, opcional) |                                                            |
| relatedId              | String?  |                     | —                    | ID del recurso relacionado (usado para deduplicar alertas) |
| read                   | Boolean  | `@default(false)`   | —                    |                                                            |
| createdDate            | DateTime | `@default(now())`   | —                    |                                                            |
| tenantId               | String   |                     | Tenant (N:1)         |                                                            |

Índice: `@@index([userId, read])`.

### PasswordResetToken

`@@map("password_reset_tokens")`.

| Campo     | Tipo     | Constraints       | FK →         | Descripción                                 |
| --------- | -------- | ----------------- | ------------ | ------------------------------------------- |
| id        | String   | `@id`             | —            | PK                                          |
| email     | String   |                   | —            |                                             |
| token     | String   | `@unique`         | —            |                                             |
| tenantId  | String   |                   | Tenant (N:1) |                                             |
| expiresAt | DateTime |                   | —            | Ventana de 1 hora (ver `MANUAL_USUARIO.md`) |
| createdAt | DateTime | `@default(now())` | —            |                                             |
| used      | Boolean  | `@default(false)` | —            |                                             |

### AuditLog

`@@map("audit_logs")`. Registro fire-and-forget de acciones críticas (ver `ARQUITECTURA.md` §10).

| Campo                          | Tipo     | Constraints       | FK →         | Descripción                                                                                     |
| ------------------------------ | -------- | ----------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| id                             | String   | `@id`             | —            | PK                                                                                              |
| action                         | String   |                   | —            | `created` / `updated` / `deleted`                                                               |
| entityType                     | String   |                   | —            | `case`, `debtor`, `creditor`, `user`, `role`, `contact`, `document`                             |
| entityId / entityName          | String   |                   | —            |                                                                                                 |
| userId / userName / userCedula | String   |                   | —            | **Copia desnormalizada**, no FK formal — preserva la traza aunque el usuario se elimine después |
| description                    | String   |                   | —            | Mensaje completo de auditoría                                                                   |
| metadata                       | Json?    |                   | —            | Cambios, IPs, etc.                                                                              |
| tenantId                       | String   |                   | Tenant (N:1) |                                                                                                 |
| createdAt                      | DateTime | `@default(now())` | —            |                                                                                                 |

Índices: `@@index([tenantId, createdAt])`, `@@index([tenantId, entityType])`, `@@index([tenantId, userId])`.

---

© 2025–2026 INSOLVENTIC — generado desde `src/prisma/schema.prisma`, no editar manualmente sin regenerar contra el schema real.
