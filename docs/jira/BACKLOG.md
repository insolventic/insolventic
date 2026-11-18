> **Team-managed:** el CSV asume proyecto company-managed; en team-managed `Story Points` se mapea a _Story point estimate_, `Components` no existe (mapear a labels o ignorar) y el vínculo épica→hijo usa igualmente la columna `Parent` con el `Issue ID`.

# Backlog Jira — INSOLVENTIC

> Generado por `docs/jira/generar.mjs` desde `docs/jira/data/*.json` (fuente única). **No editar a mano**: editar el JSON y regenerar. Corte de evidencia: 2026-10-21.

## Notas de importación

- **Jerarquía:** `Parent` contiene el `Issue ID` numérico del padre (Epic → Story/Bug/Task → Sub-task). Las filas van ordenadas épicas → ítems → sub-tasks, como pide el importador.
- **Sprint:** Jira Cloud espera el **ID numérico** del sprint, no su nombre. La columna `Sprint` trae el nombre (`INS 2026-W35`) y conviene dejarla sin mapear. Cada fila lleva además en **Labels** la etiqueta de su sprint (`sprint-2026-W35`) para moverla en bloque al sprint real después de importar (tabla en PROCESO_SCRUM.md §5.6).
- **Resolution:** vale `Done` solo en las filas con Status Done (incluidas las épicas cerradas) y queda vacía en las demás, para que Jira no deje ítems cerrados como "Unresolved".
- **Resolved de épicas:** una épica cerrada no tiene fecha propia; su Resolved es **derivado** = fecha del último hijo cerrado (marcado en el JSON con `resueltoDerivado`): E00 → 2026-02-01, E08 → 2026-04-16.
- **Prioridad:** este documento usa la escala del audit (Crítica/Alta/Media/Baja); el CSV ya emite los nombres de Jira (Crítica → Highest, Alta → High, Media → Medium, Baja → Low).
- **Resolved:** formato `yyyy-MM-dd` (configurarlo en el paso de fechas del asistente).
- **Labels / Components / Blocks:** columnas repetidas con el mismo encabezado = valores múltiples. `Blocks` es el vínculo saliente (_este ítem bloquea a_) por `Issue ID`.
- **Spike:** no existe como tipo estándar; va como Task con label `spike`. **MoSCoW / Rank / Clave temporal / Evidencia:** mapear a campos personalizados o dejar sin mapear (quedan también dentro de la Description).
- **Features:** se modelan como Épicas (capacidades de negocio multi-sprint); una mejora puntual dentro de una capacidad es una Story con label `feature`, no una épica propia.

## Resumen

| Métrica                        | Valor                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Épicas                         | 15                                                                                                      |
| Historias                      | 126                                                                                                     |
| Bugs                           | 68 (5 triviales sin puntos)                                                                             |
| Tasks                          | 92 (de ellas 9 spikes)                                                                                  |
| Sub-tasks                      | 31                                                                                                      |
| Puntos totales                 | 901 (Done: 729 · pendientes: 172)                                                                       |
| Distribución de puntos         | 1: 32 · 2: 80 · 3: 86 · 5: 71 · 8: 12                                                                   |
| Ítems `inferido`               | 16                                                                                                      |
| Historia de referencia (3 pts) | E01-30 — Montos en formato colombiano en todos los campos de dinero fuera del formulario maestro (#145) |

**Por qué es la referencia:** Bug real, acotado y completo: causa raíz conocida (parseo de '1.500.000' como 1.5), barrido de 4 campos en 3 archivos reusando MoneyInput/parsearMonto, tests de regresión y verificación manual en navegador + base local. Representa el trabajo típico de una jornada de Maxi con IA: poco código, mucha verificación.

**Regla de bugs:** Un bug se puntúa solo si NO es trivial: requiere investigar causa raíz, toca más de un archivo o necesita test de regresión nuevo. Los triviales (una línea, causa evidente) quedan sin puntos y no cuentan para la velocidad.

## Épicas

| Épica       | Título                                | Ítems | Done | Puntos | Pendientes (pts) |
| ----------- | ------------------------------------- | ----: | ---: | -----: | ---------------: |
| [E00](#e00) | Análisis y Diseño                     |     8 |    8 |     36 |                0 |
| [E01](#e01) | Gestión de Casos y Máquina de Estados |    43 |   37 |    168 |               24 |
| [E02](#e02) | Generación de Documentos              |    37 |   32 |    140 |               15 |
| [E03](#e03) | Autenticación y Seguridad             |    33 |   29 |     94 |                8 |
| [E04](#e04) | Multi-tenant y Branding por Centro    |    16 |   14 |     52 |                4 |
| [E05](#e05) | Deudores, Acreedores y Apoderados     |    16 |   14 |     59 |               10 |
| [E06](#e06) | Pagos y Trazabilidad                  |     3 |    2 |     11 |                3 |
| [E07](#e07) | Notificaciones y Alertas Proactivas   |     8 |    7 |     21 |                2 |
| [E08](#e08) | Reportes y Analítica                  |     6 |    6 |     19 |                0 |
| [E09](#e09) | Operación y Observabilidad            |    20 |   15 |     43 |                6 |
| [E10](#e10) | CI/CD e Infraestructura               |    30 |   23 |     72 |               17 |
| [E11](#e11) | Cumplimiento Legal                    |    18 |    6 |     34 |               24 |
| [E12](#e12) | Nuevas Fases del Ciclo de Vida        |     8 |    6 |     31 |               10 |
| [E13](#e13) | Deuda Técnica                         |    23 |   14 |     69 |               29 |
| [E14](#e14) | Testing / QA                          |    17 |    9 |     52 |               20 |

---

<a id="e00"></a>

## E00 — Análisis y Diseño

Fases 1 (análisis de requisitos y entendimiento del negocio) y 2 (diseño de arquitectura de la aplicación) del Diagrama de Gantt del proyecto: requisitos, casos de uso, product backlog, modelo BPMN AS-IS/TO-BE, documento de arquitectura, modelo de datos y diagramas, y mockups. Es lo primero que se hizo en el proyecto, antes de la construcción (fase 3, que cubren las épicas E01-E14).

**Objetivo de negocio:** Entender el proceso de insolvencia y conciliación de los centros y fijar requisitos, arquitectura y modelo de datos antes de escribir código.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (fases 1 y 2, semanas 1-14) · docs/REQUISITOS_INSOLVENTIC.xlsx · docs/ARQUITECTURA.md · docs/MODELO_ENTIDAD_RELACION.md · docs/DIAGRAMA_CLASES.md · docs/DIAGRAMA_COMPONENTES.md

| ID     | Tipo | Título                                                     | Pts | Estado | Sprint      | Versión |
| ------ | ---- | ---------------------------------------------------------- | --: | ------ | ----------- | ------- |
| E00-01 | Task | Planificar el proyecto en un diagrama de Gantt por fases   |   2 | Done   | Fase-Diseno | v0.0.0  |
| E00-02 | Task | Documento de requisitos funcionales y no funcionales       |   5 | Done   | Fase-Diseno | v0.0.0  |
| E00-03 | Task | Diagrama de casos de uso                                   |   3 | Done   | Fase-Diseno | v0.0.0  |
| E00-04 | Task | Product backlog inicial con historias de usuario           |   3 | Done   | Fase-Diseno | v0.0.0  |
| E00-05 | Task | Modelo BPMN del proceso actual (AS-IS) y propuesto (TO-BE) |   5 | Done   | Fase-Diseno | v0.0.0  |
| E00-06 | Task | Documento de arquitectura de la aplicación                 |   5 | Done   | Fase-Diseno | v0.0.0  |
| E00-07 | Task | Modelo de datos y diagramas de diseño                      |   8 | Done   | Fase-Diseno | v0.0.0  |
| E00-08 | Task | Mockups o prototipos de interfaz                           |   5 | Done   | Fase-Diseno | v0.0.0  |

### E00-01 · Task · Planificar el proyecto en un diagrama de Gantt por fases

**Estado:** Done (2025-11-09) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** inferido · **Components:** Infra-CI/CD

- **Objetivo:** Fijar el cronograma del proyecto de tesis en 25 semanas y 5 fases.
- **Alcance:** Fases: análisis de requisitos, diseño de arquitectura, construcción, pruebas y validación, cierre y entrega.
- **Definición de terminado:** Diagrama de Gantt con tareas por fase y semana.

> La planificación ocurre en la semana 1. La versión del diagrama que está en docs/diseno/ está fechada el 2026-06-03 (actualización posterior para el documento de tesis).

**Criterios de aceptación:**

- Dado el Gantt Cuando se revisa Entonces cada fase tiene sus tareas y semanas asignadas
- Dado la fase de construcción Cuando se ubica en el Gantt Entonces empieza en la semana 14, después del diseño

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png

### E00-02 · Task · Documento de requisitos funcionales y no funcionales

**Estado:** Done (2025-11-23) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Levantar con los centros los requisitos del sistema.
- **Alcance:** Requisitos funcionales (RF) y no funcionales (RNF) del proceso de insolvencia, conciliación y acuerdos de apoyo.
- **Definición de terminado:** Documento de requisitos revisado (Gantt: semanas 1-3).

> La versión publicada en el repo para revisión del cliente es posterior (660fffd, 2026-08-12, E09-13).

**Criterios de aceptación:**

- Dado el documento Cuando se revisa Entonces cada requisito tiene identificador y tipo (RF o RNF)
- Dado los tres servicios del centro Cuando se revisan los requisitos Entonces cada servicio tiene los suyos

**Justificación de la estimación:** Levantamiento de dominio legal con los dos centros; la mayor incertidumbre del proyecto está acá.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Documento requisitos, semanas 1-3) · docs/REQUISITOS_INSOLVENTIC.xlsx · 660fffd docs: add functional/non-functional requirements (Excel)

### E00-03 · Task · Diagrama de casos de uso

**Estado:** Done (2025-11-23) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** inferido · **Components:** Infra-CI/CD

- **Objetivo:** Representar qué hace cada actor (operadora, abogado, conciliadora, administrador, deudor) con el sistema.
- **Alcance:** Casos de uso de los módulos de casos, documentos, pagos, reportes y administración.
- **Definición de terminado:** Diagrama de casos de uso entregado junto con el documento de requisitos (Gantt: semanas 1-3).

> El archivo del diagrama todavía no está en el repo: agregarlo a docs/diseno/ para cerrar el inferido.

**Criterios de aceptación:**

- Dado cada actor del sistema Cuando se revisa el diagrama Entonces tiene sus casos de uso
- Dado cada caso de uso Cuando se compara con los requisitos Entonces corresponde a al menos un RF

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Documento requisitos, casos de uso — semanas 1-3)

### E00-04 · Task · Product backlog inicial con historias de usuario

**Estado:** Done (2025-12-07) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** inferido · **Components:** Infra-CI/CD

- **Objetivo:** Traducir los requisitos a historias de usuario priorizadas.
- **Alcance:** Backlog inicial por módulo, previo a la construcción.
- **Definición de terminado:** Product backlog con historias de usuario (Gantt: semanas 2-5).

> No hay archivo de ese backlog inicial en el repo; el backlog de Jira actual lo reemplaza.

**Criterios de aceptación:**

- Dado cada requisito funcional Cuando se revisa el backlog Entonces tiene al menos una historia
- Dado el backlog Cuando se prioriza Entonces el módulo de autenticación y control de accesos queda primero (inicio de la fase 3)

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Product backlog con historias de usuario, semanas 2-5)

### E00-05 · Task · Modelo BPMN del proceso actual (AS-IS) y propuesto (TO-BE)

**Estado:** Done (2025-12-14) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Entender cómo tramitan hoy los centros un caso y cómo lo harán con el sistema.
- **Alcance:** Diagrama AS-IS del proceso manual y TO-BE con el sistema.
- **Definición de terminado:** Diagramas AS-IS y TO-BE (Gantt: semanas 3-6).

> Los PNG existieron en la raíz del repo pero están excluidos por .gitignore y hoy no están en la carpeta: agregarlos a docs/diseno/.

**Criterios de aceptación:**

- Dado el AS-IS Cuando se revisa con el centro Entonces refleja el trámite manual actual
- Dado el TO-BE Cuando se compara con el AS-IS Entonces muestra qué pasos automatiza el sistema

**Justificación de la estimación:** Dos modelos de proceso validados con usuarios de dos centros distintos.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Modelo BPMN AS-IS / TO-BE, semanas 3-6) · .gitignore:58-59 (Diagrama_AS-IS_Insolventic.png, Diagrama_TO-BE_Insolventic.png)

### E00-06 · Task · Documento de arquitectura de la aplicación

**Estado:** Done (2026-01-11) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Infra-CI/CD, Backend

- **Objetivo:** Decidir el stack y la estructura del sistema antes de construir.
- **Alcance:** Next.js App Router con server actions, PostgreSQL + Prisma, multi-tenant por tenantId, JWT propio con RBAC, generación de documentos desde plantillas y almacenamiento en Google Drive.
- **Definición de terminado:** Documento de arquitectura (Gantt: semanas 5-10).

> docs/ARQUITECTURA.md es la versión vigente, actualizada varias veces después (por ejemplo c6ee3d0 y E09-15).

**Criterios de aceptación:**

- Dado el documento Cuando se revisa Entonces describe capas, módulos y el aislamiento por centro
- Dado una decisión de arquitectura Cuando se documenta Entonces incluye su motivo

**Justificación de la estimación:** Decisiones de stack, multi-tenant, seguridad y generación documental que condicionan todo lo demás.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Documento arquitectura, semanas 5-10) · docs/ARQUITECTURA.md

### E00-07 · Task · Modelo de datos y diagramas de diseño

**Estado:** Done (2026-02-01) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** — · **Components:** Base-de-Datos, Backend

- **Objetivo:** Fijar el modelo de datos y la estructura del sistema en diagramas.
- **Alcance:** Modelo entidad-relación, diccionario de datos, diagrama de clases y diagrama de componentes.
- **Definición de terminado:** Diagramas entregados (Gantt: semanas 7-13).

> Las versiones en el repo se publicaron el 2026-08-12 para revisión del cliente (849d96b, 7280aa9; ítem E09-13) y reflejan el sistema construido.

**Criterios de aceptación:**

- Dado el modelo entidad-relación Cuando se compara con el diccionario Entonces las tablas y relaciones coinciden
- Dado el diagrama de componentes Cuando se revisa Entonces muestra los módulos y sus dependencias

**Justificación de la estimación:** Cuatro artefactos de diseño interdependientes sobre un modelo de más de 20 entidades.

**Sub-tasks:**

- `E00-07.1` Modelo entidad-relación y diccionario de datos — MODELO_ENTIDAD_RELACION.md y DICCIONARIO_DATOS.md.
- `E00-07.2` Diagrama de clases — DIAGRAMA_CLASES.md.
- `E00-07.3` Diagrama de componentes — DIAGRAMA_COMPONENTES.md.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Modelo de datos, diagramas — semanas 7-13) · docs/MODELO_ENTIDAD_RELACION.md · docs/DICCIONARIO_DATOS.md · docs/DIAGRAMA_CLASES.md · docs/DIAGRAMA_COMPONENTES.md

### E00-08 · Task · Mockups o prototipos de interfaz

**Estado:** Done (2026-02-01) · **Sprint:** INS Fase-Diseno · **Versión:** v0.0.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** inferido · **Components:** Frontend

- **Objetivo:** Validar con los usuarios las pantallas principales antes de construirlas.
- **Alcance:** Prototipos de las pantallas núcleo (casos, formulario de creación, documentos).
- **Definición de terminado:** Mockups revisados (Gantt: semanas 8-14).

> El Gantt lo extiende hasta la semana 14, que coincide con el inicio de la construcción (W06); se cierra con la fase. No hay archivos de mockups en el repo.

**Criterios de aceptación:**

- Dado cada pantalla núcleo Cuando se revisa con el centro Entonces tiene su prototipo
- Dado los comentarios del centro Cuando se incorporan Entonces el prototipo queda aprobado para construir

**Justificación de la estimación:** Prototipos de varias pantallas con una ronda de validación con usuarios.

**Evidencia:** docs/diseno/Diagrama de Gantt - Insolventic.png (Mockups o prototipos de interfaz, semanas 8-14)

---

<a id="e01"></a>

## E01 — Gestión de Casos y Máquina de Estados

Ciclo de vida del expediente para los tres servicios (Insolvencia, Conciliación, Acuerdo de Apoyo): formulario maestro (~400 campos), creación por tipo, edición con bloqueo optimista, fases y transiciones validadas en el servidor, reglas del trámite colombiano (Ley 1564/2012 arts. 531 y ss., Decreto 2677/2012) y bienes del deudor.

**Objetivo de negocio:** Que cada expediente nazca y evolucione cumpliendo los requisitos formales del trámite, sin depender de que la UI sea la única barrera.

**Evidencia:** README.md §Gestión de Casos · src/features/case/ · docs/FORMULARIO_MAESTRO.md · docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §2

| ID     | Tipo  | Título                                                                            | Pts | Estado | Sprint   | Versión     |
| ------ | ----- | --------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E01-01 | Story | Crear y listar expedientes de insolvencia aislados por centro                     |   8 | Done   | 2026-W06 | v0.1.0      |
| E01-02 | Bug   | Bucle infinito de renderizado en la app                                           |   2 | Done   | 2026-W07 | v0.1.0      |
| E01-03 | Story | Formulario definitivo completo del caso de insolvencia                            |   8 | Done   | 2026-W08 | v0.1.0      |
| E01-04 | Bug   | Creación de casos, eliminación en cascada y conversión Decimal fallaban           |   3 | Done   | 2026-W09 | v0.1.0      |
| E01-05 | Story | Validación completa del formulario de insolvencia y documentos obligatorios       |   5 | Done   | 2026-W10 | v0.1.0      |
| E01-06 | Story | Fases del expediente con transiciones y calendario de audiencias                  |   5 | Done   | 2026-W13 | v0.2.0      |
| E01-07 | Story | Búsqueda global de expedientes, deudores y acreedores                             |   3 | Done   | 2026-W13 | v0.2.0      |
| E01-08 | Story | Simplificar el formulario del caso de 12 a 8 pestañas                             |   5 | Done   | 2026-W13 | v0.2.0      |
| E01-09 | Story | Flujo de creación separado por tipo de caso                                       |   5 | Done   | 2026-W14 | v0.2.0      |
| E01-10 | Story | Errores visibles por pestaña y mensajes de validación claros en el formulario     |   8 | Done   | 2026-W14 | v0.2.0      |
| E01-11 | Story | Formulario de creación de casos de Conciliación con listas dinámicas              |   5 | Done   | 2026-W15 | v0.2.0      |
| E01-12 | Story | Edición de casos con bloqueo optimista                                            |   3 | Done   | 2026-W16 | v0.2.0      |
| E01-13 | Story | Filtro por tipo de caso y estados vacíos en los listados                          |   2 | Done   | 2026-W16 | v0.2.0      |
| E01-14 | Story | Módulo completo de Acuerdos de Apoyo                                              |   8 | Done   | 2026-W17 | v0.4.0      |
| E01-15 | Bug   | El listado /cases salía vacío en producción                                       |   5 | Done   | 2026-W37 | v0.5.0      |
| E01-16 | Story | Máquina de estados del expediente validada en el servidor                         |   5 | Done   | 2026-W37 | v0.5.0      |
| E01-17 | Story | Reglas del trámite colombiano aplicadas en el servidor con SMMLV por año          |   5 | Done   | 2026-W37 | v0.5.0      |
| E01-18 | Bug   | La edición no persistía la otra causa de cesación (otherCauseDetail)              |   — | Done   | 2026-W38 | v0.6.0      |
| E01-19 | Story | Bienes con valor comercial, patrimonio de familia y comparendos del vehículo      |   3 | Done   | 2026-W40 | v0.6.0      |
| E01-20 | Bug   | El formulario de bienes arrastraba datos entre un bien y el siguiente             |   2 | Done   | 2026-W40 | v0.6.0      |
| E01-21 | Story | Procesos judiciales con lista única de 7 tipos y correo del juzgado               |   3 | Done   | 2026-W40 | v0.6.0      |
| E01-22 | Story | Fecha de radicación desde el wizard y empleador como pagador de libranzas         |   3 | Done   | 2026-W40 | v0.6.0      |
| E01-23 | Story | Desglose de gastos de manutención visible solo para la operadora                  |   2 | Done   | 2026-W40 | v0.6.0      |
| E01-24 | Story | Selector real de operador en el alta y la edición del caso                        |   3 | Done   | 2026-W40 | v0.6.0      |
| E01-25 | Story | Editar casos de conciliación y de acuerdo de apoyo                                |   5 | Done   | 2026-W40 | v0.6.0      |
| E01-26 | Bug   | El diálogo de edición de insolvencia perdía campos entre el reset y el submit     |   3 | Done   | 2026-W40 | v0.6.0      |
| E01-27 | Story | Suma adeudada de servicios suspendidos en el alta                                 |   2 | Done   | 2026-W40 | v0.6.0      |
| E01-28 | Bug   | Las casillas Desconozco reventaban la creación y dejaban un caso huérfano         |   3 | Done   | 2026-W41 | v0.6.0      |
| E01-29 | Story | Separador de miles en los 27 campos de dinero del formulario maestro              |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E01-30 | Story | Montos en formato colombiano en los campos de dinero fuera del formulario maestro |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-31 | Bug   | Los totales de ingresos y deudas del wizard daban NaN con coma decimal            |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-32 | Bug   | Las fechas históricas de conciliación se imprimían con la fecha de hoy            |   5 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-33 | Story | Datos de la audiencia virtual por Zoom en la conciliación                         |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-34 | Story | Inputs para los 5 campos de conciliación que ya tenían columna                    |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-35 | Story | Aclaración de Acta con valores correcto e incorrecto                              |   5 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E01-36 | Story | Selector de bienes en dos niveles: categoría y tipo                               |   3 | Done   | 2026-W43 | v1.0.0-rc.1 |
| E01-37 | Bug   | Los bienes tipo Equipo desaparecían de la tabla de la Solicitud                   |   2 | Done   | 2026-W43 | v1.0.0-rc.1 |
| E01-38 | Bug   | El bloqueo optimista es opcional y no atómico                                     |   3 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E01-39 | Bug   | Dos casos creados a la vez pueden recibir el mismo número                         |   3 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E01-40 | Story | Borrado lógico de expedientes                                                     |   5 | To Do  | Backlog  | v1.1.0      |
| E01-41 | Story | Papelera y restauración de expedientes                                            |   5 | To Do  | Backlog  | v1.1.0      |
| E01-42 | Story | Borrado coordinado de la carpeta del expediente en Drive                          |   3 | To Do  | Backlog  | v1.1.0      |
| E01-43 | Story | Validar en el servidor los documentos adjuntos obligatorios                       |   5 | To Do  | Backlog  | v1.1.0      |

### E01-01 · Story · Crear y listar expedientes de insolvencia aislados por centro

**Estado:** Done (2026-02-08) · **Sprint:** INS 2026-W06 · **Versión:** v0.1.0 · **Prioridad:** Crítica · **Estimación:** 8 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar un expediente con los datos del deudor y verlo en el listado de mi centro, para dejar de llevar los casos en hojas sueltas y tener un único registro consultable.

**Criterios de aceptación:**

- Dado que estoy autenticada en Armonía Cuando creo un caso con los datos obligatorios Entonces el caso queda guardado con el tenantId de Armonía y aparece en mi listado
- Dado un caso creado en Constructores de Paz Cuando consulto el listado desde Armonía Entonces ese caso no aparece
- **(error)** Dado un formulario con campos obligatorios vacíos Cuando intento guardar Entonces el caso no se crea y se señalan los campos faltantes
- Dado un caso existente Cuando lo abro Entonces veo sus datos y su fase actual

**Justificación de la estimación:** Setup inicial del dominio completo (schema, server actions, UI de listado/detalle) sobre un stack nuevo; mucha superficie y aprendizaje.

**Sub-tasks:**

- `E01-01.1` Modelo Case/Debtor en Prisma con tenantId — Schema inicial y migración base.
- `E01-01.2` Server actions de creación y lectura scoped por tenant — authenticateUser → permiso → query con tenantId.
- `E01-01.3` UI de listado y detalle de casos — Tabla de casos y diálogo de detalle.

**Evidencia:** 83d2d71 feat: initial full project setup · CHANGELOG.md [0.1.0] Case management

### E01-02 · Bug · Bucle infinito de renderizado en la app

**Estado:** Done (2026-02-12) · **Sprint:** INS 2026-W07 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** inferido · **Components:** Frontend

- **Entorno:** Desarrollo local, febrero 2026 (pre-v0.1.0)
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir la aplicación en una vista afectada
  2. Observar re-renderizados continuos
- **Esperado:** La vista renderiza una vez por cambio de estado
- **Actual:** La vista entra en un ciclo de renderizado infinito
- **Causa raíz:** No registrada en el mensaje del commit (solo describe el síntoma). A confirmar con git show e6cdeb1.
- **Fix:** e6cdeb1 fix: corregir bucle infinito de renderizado y mejorar generación de documentos
- **Test de regresión:** No hay test asociado identificable en el commit.

**Criterios de aceptación del fix:**

- Dado la vista afectada Cuando se carga Entonces no se producen renderizados en bucle
- Dado el fix aplicado Cuando se navega entre vistas Entonces no aparecen advertencias de actualización de estado infinita en consola

**Evidencia:** e6cdeb1 fix: corregir bucle infinito de renderizado

### E01-03 · Story · Formulario definitivo completo del caso de insolvencia

**Estado:** Done (2026-02-21) · **Sprint:** INS 2026-W08 · **Versión:** v0.1.0 · **Prioridad:** Crítica · **Estimación:** 8 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero capturar en un solo formulario todas las secciones de la solicitud (solicitante, cónyuge, ingresos, gastos, cesación de pagos, declaraciones), para que la solicitud de insolvencia se pueda radicar sin volver a pedirle datos al deudor.

**Criterios de aceptación:**

- Dado el formulario de creación Cuando completo todas las secciones Entonces se guardan en el caso y alimentan los placeholders de las plantillas
- Dado un deudor con cónyuge Cuando marco la sección de cónyuge Entonces sus campos se habilitan y se persisten
- **(borde)** Dado un deudor sin ingresos adicionales Cuando dejo esa sección vacía Entonces el caso se guarda sin errores
- Dado el caso guardado Cuando lo reabro Entonces todas las secciones muestran lo capturado

**Justificación de la estimación:** ~400 campos en múltiples secciones con su modelo de datos; el formulario más grande del sistema.

**Evidencia:** ba65470 feat: agregar formulario definitivo completo para casos de insolvencia · README.md (~400 campos)

### E01-04 · Bug · Creación de casos, eliminación en cascada y conversión Decimal fallaban

**Estado:** Done (2026-02-28) · **Sprint:** INS 2026-W09 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** inferido · **Components:** Backend, Base-de-Datos

- **Entorno:** Desarrollo/preview, febrero 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Crear un caso con montos
  2. Eliminar un caso con relaciones
- **Esperado:** El caso se crea con montos correctos y se elimina con sus relaciones
- **Actual:** Fallos en creación, en el borrado en cascada y en la conversión de montos Decimal
- **Causa raíz:** Según el commit: manejo incorrecto de Prisma.Decimal y de relaciones sin cascada. Detalle no documentado.
- **Fix:** 6fb7ae1 fix: corregir creación de casos, eliminación cascada y conversión Decimal
- **Test de regresión:** No identificado en el commit.

**Criterios de aceptación del fix:**

- Dado un caso con montos decimales Cuando se guarda Entonces los montos se conservan sin pérdida
- Dado un caso con deudas y bienes Cuando se elimina Entonces no quedan filas huérfanas

**Evidencia:** 6fb7ae1 fix: corregir creación de casos, eliminación cascada y conversión Decimal

### E01-05 · Story · Validación completa del formulario de insolvencia y documentos obligatorios

**Estado:** Done (2026-03-04) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend, Testing

Como **operadora de insolvencia**, quiero que el formulario me impida guardar una solicitud incompleta y me diga qué documentos son obligatorios, para no radicar solicitudes que el centro rechazaría por requisitos formales.

**Criterios de aceptación:**

- Dado un caso sin un campo obligatorio Cuando intento guardar Entonces veo el error en ese campo
- Dado un caso que requiere poder del apoderado Cuando no adjunto el poder Entonces se marca como documento faltante
- **(borde)** Dado un documento condicional que no aplica al caso Cuando guardo Entonces no se exige
- Dado el set de reglas Cuando corre la suite Entonces los 75 tests de validación pasan

**Justificación de la estimación:** Reglas de dominio legal con casos condicionales y 75 tests; incertidumbre de interpretación normativa.

**Evidencia:** a45f940 feat: validación completa formulario de insolvencia + documentos obligatorios · CHANGELOG.md [0.1.0] Form validation

### E01-06 · Story · Fases del expediente con transiciones y calendario de audiencias

**Estado:** Done (2026-03-23) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero mover el caso por sus fases (Solicitud, Admisión, Negociación, Terminación) y ver las audiencias en un calendario, para saber en qué punto está cada trámite y no perder una audiencia.

**Criterios de aceptación:**

- Dado un caso en Solicitud Cuando lo paso a Admisión Entonces la fase cambia y queda registrada
- Dado un caso con fecha de audiencia Cuando abro el calendario Entonces la audiencia aparece en su día
- **(error)** Dado un usuario sin permiso de edición Cuando intenta cambiar la fase Entonces la acción se rechaza
- Dado un rol limitado a sus casos Cuando abre el calendario Entonces solo ve las audiencias de sus casos

**Justificación de la estimación:** Dos módulos (fases y calendario) con reglas de visibilidad por rol.

**Evidencia:** 82812b5 feat: módulos completos — dashboard dinámico, fases, calendario, reportes, pagos, búsqueda global · docs/AUDITORIA_CIERRE_2026-09-12.md §5.7 (calendario aplica los 3 permisos)

### E01-07 · Story · Búsqueda global de expedientes, deudores y acreedores

**Estado:** Done (2026-03-23) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **abogado del centro**, quiero buscar por nombre, cédula o número de caso desde cualquier pantalla, para encontrar un expediente en segundos durante una llamada o audiencia.

> Salió sin control de permisos; eso se corrigió después en E03-22 (G-A1).

**Criterios de aceptación:**

- Dado un deudor existente Cuando escribo dos letras de su nombre Entonces aparece en los resultados
- Dado un número de caso Cuando lo busco Entonces el resultado abre el expediente
- **(borde)** Dado un texto sin coincidencias Cuando busco Entonces veo un estado vacío, no un error

**Evidencia:** 82812b5 (búsqueda global) · src/features/search/actions.ts

### E01-08 · Story · Simplificar el formulario del caso de 12 a 8 pestañas

**Estado:** Done (2026-03-29) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero un formulario con menos pestañas y el número de trámite generado automáticamente, para cargar un caso más rápido y sin campos que nadie usa.

**Criterios de aceptación:**

- Dado el formulario de creación Cuando lo abro Entonces tiene 8 pestañas
- Dado un caso nuevo Cuando lo guardo Entonces el número de trámite se genera solo
- **(borde)** Dado un campo eliminado del formulario Cuando se genera un documento Entonces ninguna plantilla depende de él

**Justificación de la estimación:** Reestructuración del wizard más grande con riesgo de romper placeholders.

**Evidencia:** 5f11bf0 feat: simplificar formulario de caso — 12 a 8 tabs, auto-generar trámite

### E01-09 · Story · Flujo de creación separado por tipo de caso

**Estado:** Done (2026-03-31) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **conciliadora**, quiero que al crear un caso el formulario dependa del servicio elegido, para no ver campos de insolvencia cuando registro una conciliación.

**Criterios de aceptación:**

- Dado que elijo Conciliación Cuando avanzo Entonces solo veo las secciones de conciliación
- Dado que elijo Insolvencia Cuando avanzo Entonces veo el formulario maestro de insolvencia
- **(error)** Dado un tipo de caso no soportado Cuando se envía al servidor Entonces se rechaza

**Justificación de la estimación:** Separación de flujos y reestructuración de plantillas por tipo.

**Evidencia:** 6ef0bc9 feat: separar flujo de creación por tipo de caso, reestructurar plantillas

### E01-10 · Story · Errores visibles por pestaña y mensajes de validación claros en el formulario

**Estado:** Done (2026-04-02) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 8 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero ver en qué pestaña está el error y un mensaje que explique qué corregir, para no tener que recorrer las 8 pestañas buscando por qué no guarda.

**Criterios de aceptación:**

- Dado un error en la pestaña Ingresos Cuando intento guardar Entonces la pestaña Ingresos muestra un indicador
- Dado un campo inválido Cuando pierdo el foco Entonces veo un mensaje en español que dice qué se espera
- **(borde)** Dado que corrijo el último error de una pestaña Cuando paso a otra Entonces el indicador desaparece
- Dado el formulario refactorizado Cuando genero la solicitud Entonces los 12 issues reportados de la Solicitud de Insolvencia no reaparecen

**Justificación de la estimación:** Tres commits grandes (Bloques 1-6, 7 páginas refactorizadas, indicadores) sobre todo el wizard.

**Sub-tasks:**

- `E01-10.1` Bloques 1-6 del formulario — Mejoras de campos, fechas y validaciones (77898bd).
- `E01-10.2` Refactor de 7 páginas del formulario — 3a1621e.
- `E01-10.3` Indicadores de error por pestaña — e430e10.

**Evidencia:** 77898bd feat: mejoras integrales formulario (Bloques 1-6) · 684304c fix: correcciones integrales Solicitud de Insolvencia — 12 issues · 3a1621e feat: 7 páginas refactorizadas · e430e10 feat: indicadores de error en tabs

### E01-11 · Story · Formulario de creación de casos de Conciliación con listas dinámicas

**Estado:** Done (2026-04-09) · **Sprint:** INS 2026-W15 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **conciliadora**, quiero registrar una conciliación con varias partes, menores y cláusulas, para generar el acta sin redactar a mano las listas.

**Criterios de aceptación:**

- Dado una conciliación con dos convocados Cuando los agrego Entonces ambos se guardan como arreglo
- Dado cláusulas adicionales Cuando las agrego y reordeno Entonces se conservan en ese orden
- **(borde)** Dado una conciliación sin menores Cuando guardo Entonces la lista vacía no rompe la generación

**Justificación de la estimación:** Formulario dinámico con arrays más el motor que los consume.

**Evidencia:** 52eda1a feat(conciliation): activar formulario de creación de casos de conciliación · 4613a98 feat(conciliation): motor handlebars-lite + formulario dinámico con arrays

### E01-12 · Story · Edición de casos con bloqueo optimista

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero que si otra persona editó el caso mientras yo lo tenía abierto me avise, para no pisar sin saberlo los cambios de una compañera.

> La implementación era opcional y no atómica; queda pendiente en E01-38 (GC-A2).

**Criterios de aceptación:**

- Dado que abro un caso en versión 5 Cuando guardo sin que nadie más lo haya tocado Entonces se guarda y pasa a versión 6
- **(error)** Dado que otra persona guardó la versión 6 Cuando guardo mi copia de la versión 5 Entonces veo un aviso de conflicto y el diálogo se cierra
- Dado el campo version Cuando se envía el formulario Entonces viaja en el schema Zod

**Evidencia:** CHANGELOG.md [0.2.0] Case edit with optimistic locking

### E01-13 · Story · Filtro por tipo de caso y estados vacíos en los listados

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend

Como **administrador del centro**, quiero filtrar el listado por Insolvencia, Conciliación o Acuerdo de Apoyo, para revisar la carga de cada servicio por separado.

**Criterios de aceptación:**

- Dado casos de los tres tipos Cuando filtro por Conciliación Entonces solo veo conciliaciones
- **(borde)** Dado un filtro sin resultados Cuando lo aplico Entonces veo un estado vacío explicativo
- Dado los listados de deudores y acreedores vacíos Cuando los abro Entonces veo el estado vacío

**Evidencia:** CHANGELOG.md [0.2.0] Case type filter, Empty states

### E01-14 · Story · Módulo completo de Acuerdos de Apoyo

**Estado:** Done (2026-04-20) · **Sprint:** INS 2026-W17 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos, Documentos-PDF

Como **operadora de insolvencia**, quiero registrar y documentar un acuerdo de apoyo, para atender el tercer servicio del centro dentro del mismo sistema.

**Criterios de aceptación:**

- Dado el tipo Acuerdo de Apoyo Cuando creo el caso Entonces veo su formulario específico
- Dado un acuerdo guardado Cuando genero documentos Entonces se usan las plantillas de support-agreements
- **(borde)** Dado un acuerdo sin monto mensual Cuando genero Entonces el documento no imprime un monto inventado
- Dado los campos apoyo\_\* Cuando se despliega Entonces existen en la base de producción

**Justificación de la estimación:** Servicio nuevo de punta a punta (formulario, persistencia, plantillas).

**Sub-tasks:**

- `E01-14.1` Formulario y schema del acuerdo de apoyo — Campos apoyo\_\* en Case.
- `E01-14.2` Plantillas de support-agreements — Plantillas y mapper de apoyo.

**Evidencia:** 19e4227 feat(apoyo): implementar modulo Acuerdos de Apoyo completo

### E01-15 · Bug · El listado /cases salía vacío en producción

**Estado:** Done (2026-09-09) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** bug-regresion · **Components:** Backend, Base-de-Datos

- **Entorno:** Producción (Vercel + Neon), detectado septiembre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Iniciar sesión en producción
  2. Abrir /cases
- **Esperado:** El listado muestra los casos del centro
- **Actual:** El listado sale vacío, sin error visible y sin evento en Sentry
- **Causa raíz:** Dos defectos encadenados: (1) caseSchema rechazaba null en 7 campos Json? y el catch devolvía lista vacía; (2) 29 columnas apoyo\_\* existían en schema.prisma (creadas con db push) pero ninguna migración las creaba, así que no estaban en producción.
- **Fix:** a54d92e (6 arrays Json? aceptan null) + ebc500b (7º campo) + 8ec70d6 (migración de las 29 columnas apoyo\_\*)
- **Test de regresión:** Verificación de deriva contra information_schema (scripts/verificar-deriva-esquema.sql) y smoke contra Postgres real (E14-05).

**Criterios de aceptación del fix:**

- Dado casos con campos Json? nulos Cuando se lista /cases Entonces aparecen todos
- Dado la base de producción Cuando se compara con schema.prisma Entonces las columnas apoyo\_\* existen
- **(error)** Dado un fallo en getAllCases Cuando ocurre Entonces llega a Sentry en vez de devolver una lista vacía silenciosa

**Justificación de la estimación:** Diagnóstico mal encaminado dos veces (la base local se construía con db push); requirió comparar contra producción.

**Evidencia:** a54d92e · ebc500b · 8ec70d6 fix(db): migración que crea las 29 columnas apoyo\_\* · docs/CHECKPOINT_2026-09-09.md §8 · docs/AUDITORIA_CIERRE_2026-09-12.md §3

### E01-16 · Story · Máquina de estados del expediente validada en el servidor

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** seguridad, doc-semana-3 · **Components:** Backend, Testing

Como **administrador del centro**, quiero que ninguna fase se pueda saltar ni reabrir por fuera de las transiciones válidas, para que el estado de un expediente legal sea siempre jurídicamente coherente.

**Criterios de aceptación:**

- **(error)** Dado un caso en Inicial Cuando se envía por POST directo a updateCase un cambio a Terminado Entonces el servidor lo rechaza
- Dado un caso nuevo Cuando se crea Entonces nace siempre en fase Inicial aunque el cliente envíe otra
- Dado una transición válida Cuando se usa updateCasePhase Entonces la fase cambia y se audita fase anterior y nueva
- **(error)** Dado una fase inexistente Cuando se envía Entonces se rechaza por no pertenecer a CASE_PHASES

**Justificación de la estimación:** Extraer guards puros compartidos por dos rutas y escribir los tests de bypass que faltaban.

**Hallazgos:** GC-C1, GC-M3

**Evidencia:** PR #4 17c7de2 (commit 9e0ed99) · docs/IMPLEMENTACION_SEMANA_3.md §2 · src/features/case/actions.ts:565

### E01-17 · Story · Reglas del trámite colombiano aplicadas en el servidor con SMMLV por año

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** doc-semana-3 · **Components:** Backend, Testing

Como **abogado del centro**, quiero que los topes legales (150 acreedores, 150 SMMLV, mínima cuantía de 40 SMMLV, 24 meses de gracia) se apliquen al crear y editar, para que no se radiquen expedientes que violan los requisitos formales de la Ley 1564/2012.

> Cerrado con pendiente jurídico: el SMMLV 2026 es transitorio (E11-09) y los umbrales requieren validación de abogado (E11-18).

**Criterios de aceptación:**

- **(error)** Dado un caso que supera el tope de 150 SMMLV Cuando se crea por POST directo Entonces el servidor lo rechaza con el error de la regla
- Dado un caso radicado en 2025 Cuando se calcula la mínima cuantía Entonces se usa el SMMLV de 2025 ($1.423.500)
- **(borde)** Dado un año sin decreto cargado Cuando se resuelve el SMMLV Entonces se usa el último año conocido y se marca como no confirmado
- Dado una advertencia de regla Cuando se guarda el caso Entonces se devuelve al cliente sin bloquear

**Justificación de la estimación:** Cablear el módulo de reglas al servidor más corregir la base SMMLV (estaba en el valor de 2024); 23 tests.

**Hallazgos:** GC-C2, GC-A4

**Evidencia:** PR #4 17c7de2 (commit ea5000f) · docs/IMPLEMENTACION_SEMANA_3.md §3 · tests/unit/cases/case-business-rules.test.ts · docs/AUDITORIA_CIERRE_2026-09-12.md §4 (A-4 resuelto)

### E01-18 · Bug · La edición no persistía la otra causa de cesación (otherCauseDetail)

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** sin puntos (trivial)

**Labels:** — · **Components:** Backend

- **Entorno:** dev, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Editar un caso
  2. Escribir el detalle de 'otra causa'
  3. Guardar y reabrir
- **Esperado:** El detalle queda guardado
- **Actual:** El detalle se pierde
- **Causa raíz:** updateCaseSchema no declaraba otherCauseDetail y Zod lo descartaba.
- **Fix:** 36442db fix(casos): updateCaseSchema acepta otherCauseDetail
- **Test de regresión:** Cubierto después por la guardia Zod<->Case de E05-04.

**Criterios de aceptación del fix:**

- Dado un caso editado con otherCauseDetail Cuando se guarda Entonces el valor persiste
- Dado el schema de edición Cuando se compara con el de creación Entonces otherCauseDetail está en ambos

**Evidencia:** 36442db

### E01-19 · Story · Bienes con valor comercial, patrimonio de familia y comparendos del vehículo

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar el valor comercial de un inmueble, si es patrimonio de familia y si un vehículo tiene comparendos o impuestos pendientes, para que el inventario de bienes de la solicitud refleje la situación real del deudor.

**Criterios de aceptación:**

- Dado un inmueble Cuando lo registro Entonces puedo indicar valor comercial y patrimonio de familia (Ley 70/1931)
- Dado un vehículo Cuando marco comparendos pendientes Entonces la casilla se guarda
- **(borde)** Dado un tipo de bien Cuando lo elijo Entonces veo un ejemplo de cómo diligenciarlo
- Dado la casilla de comparendos Cuando se genera la solicitud Entonces no imprime nada todavía (solo captura, pendiente del párrafo legal E11-12)

**Evidencia:** #60 771f246 · #68 c4be312 · docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md

### E01-20 · Bug · El formulario de bienes arrastraba datos entre un bien y el siguiente

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend, Testing

- **Entorno:** dev, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Agregar un vehículo con placa
  2. Agregar un segundo bien
  3. Cambiar el tipo de bien a inmueble
- **Esperado:** El formulario queda en blanco y los campos del tipo anterior se limpian
- **Actual:** El reset limpiaba 5 de 22 campos y los campos específicos del tipo sobrevivían al cambio de tipo
- **Causa raíz:** Las claves del reset no coincidían con los defaultValues, y los campos que el tipo muestra no eran los que el formulario retenía.
- **Fix:** #69 30a7447 + #70 5a4b052
- **Test de regresión:** Tests de reset y de cambio de tipo en el formulario de bienes.

**Criterios de aceptación del fix:**

- Dado que agrego un bien Cuando abro el formulario para el siguiente Entonces los 22 campos están vacíos
- Dado un bien con campos de vehículo Cuando cambio el tipo a inmueble Entonces los campos de vehículo se limpian

**Evidencia:** #69 30a7447 · #70 5a4b052 · docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md filas 2 y 3

### E01-21 · Story · Procesos judiciales con lista única de 7 tipos y correo del juzgado

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Base-de-Datos

Como **operadora de insolvencia**, quiero elegir el tipo de proceso de una lista única, escribir 'Otros' cuando no aplica y registrar el correo del juzgado, para poder oficiar a cada juzgado sin buscar su correo en otra parte.

**Criterios de aceptación:**

- Dado un proceso judicial Cuando elijo el tipo Entonces la lista tiene los 7 tipos
- Dado el tipo Otros Cuando escribo la descripción Entonces se persiste
- **(error)** Dado un correo de juzgado mal formado Cuando guardo Entonces se marca el error

**Evidencia:** #66 798b80e

### E01-22 · Story · Fecha de radicación desde el wizard y empleador como pagador de libranzas

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero que la fecha de radicación se tome del wizard y que el empleador ya capturado se ofrezca como pagador de la libranza, para no escribir dos veces el mismo dato y evitar inconsistencias entre secciones.

**Criterios de aceptación:**

- Dado la fecha de radicación capturada en el wizard Cuando se genera un documento Entonces se usa esa fecha
- Dado un empleador en la Sección III Cuando agrego una libranza Entonces se me ofrece como pagador
- **(borde)** Dado un deudor sin empleador Cuando agrego una libranza Entonces escribo el pagador a mano

**Evidencia:** #63 e29a2e2 · #65 49d26cb

### E01-23 · Story · Desglose de gastos de manutención visible solo para la operadora

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend, Base-de-Datos

Como **operadora de insolvencia**, quiero desglosar los servicios de manutención del deudor, para sustentar el gasto mensual sin exponer ese detalle a roles que no lo necesitan.

**Criterios de aceptación:**

- Dado el rol operadora Cuando abro la sección de gastos Entonces veo el desglose
- **(error)** Dado un rol sin ese acceso Cuando abre la sección Entonces no ve el desglose
- Dado el desglose guardado Cuando reabro el caso Entonces se conserva

**Evidencia:** #67 bc61ee9

### E01-24 · Story · Selector real de operador en el alta y la edición del caso

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **administrador del centro**, quiero asignar el operador del caso desde una lista de usuarios de mi centro, para repartir la carga y que los documentos salgan con la operadora correcta.

**Criterios de aceptación:**

- Dado el alta de un caso Cuando abro el selector Entonces veo los operadores de mi centro
- Dado un caso existente Cuando cambio el operador Entonces se guarda
- **(error)** Dado un operador de otro centro Cuando se envía su id Entonces el servidor lo rechaza (E03-26)

**Evidencia:** #83/#84 cd974d9

### E01-25 · Story · Editar casos de conciliación y de acuerdo de apoyo

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **conciliadora**, quiero editar una conciliación o un acuerdo de apoyo después de creado, para corregir un dato sin tener que borrar y volver a crear el caso.

**Criterios de aceptación:**

- Dado una conciliación Cuando abro editar Entonces veo su formulario con los datos cargados
- Dado un acuerdo de apoyo editado Cuando guardo Entonces los cambios persisten
- **(error)** Dado una edición concurrente Cuando guardo Entonces aplica el mismo control de versión que insolvencia

**Justificación de la estimación:** Dos formularios de edición nuevos con paridad de campos frente al alta.

**Evidencia:** #89 3093a65

### E01-26 · Bug · El diálogo de edición de insolvencia perdía campos entre el reset y el submit

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** bug-regresion · **Components:** Frontend, Testing

- **Entorno:** dev, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir edición de un caso de insolvencia
  2. Guardar sin cambios
  3. Comparar con el caso original
- **Esperado:** Paridad total con el schema de creación
- **Actual:** Campos que el reset no cargaba o el submit no enviaba
- **Causa raíz:** Deriva entre el reset del diálogo de edición y el schema de envío.
- **Fix:** #102 89a0077
- **Test de regresión:** Test de paridad reset/submit contra el schema.

**Criterios de aceptación del fix:**

- Dado un caso completo Cuando se edita y guarda sin cambios Entonces ningún campo cambia
- Dado un campo nuevo en el schema Cuando falta en el reset Entonces el test de paridad falla

**Evidencia:** #102 89a0077

### E01-27 · Story · Suma adeudada de servicios suspendidos en el alta

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero registrar cuánto se debe de cada servicio público suspendido, para que la solicitud informe el monto, no solo el servicio.

**Criterios de aceptación:**

- Dado un servicio suspendido Cuando lo agrego Entonces puedo escribir la suma adeudada
- **(borde)** Dado una suma vacía Cuando guardo Entonces el servicio se registra sin monto
- Dado la suma guardada Cuando reabro el caso Entonces se muestra

**Evidencia:** #99 af900b2

### E01-28 · Bug · Las casillas Desconozco reventaban la creación y dejaban un caso huérfano

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend, Base-de-Datos

- **Entorno:** dev, octubre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Crear un caso de insolvencia
  2. Marcar Desconozco en la tasa de interés de una deuda
  3. Guardar
- **Esperado:** El caso se crea con el dato marcado como desconocido
- **Actual:** La creación falla a mitad de camino y deja un caso huérfano en la base
- **Causa raíz:** Las casillas no tenían columnas propias y el valor no numérico rompía la creación de las deudas después de crear el caso.
- **Fix:** #117 b1db9f2 (migración 20261003000000_add_debt_unknown_flags)
- **Test de regresión:** Test de creación con las casillas marcadas.

**Criterios de aceptación del fix:**

- Dado una deuda con tasa Desconozco Cuando se crea el caso Entonces se guarda con interestRateUnknown en true
- Dado un fallo al crear deudas Cuando ocurre Entonces no queda un caso huérfano

**Evidencia:** #117 b1db9f2 · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md §3.1

### E01-29 · Story · Separador de miles en los 27 campos de dinero del formulario maestro

**Estado:** Done (2026-10-11) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend, Testing

Como **operadora de insolvencia**, quiero escribir los montos como 1.500.000 y no como 1500000, para leer y verificar las cifras igual que en los documentos del deudor.

**Criterios de aceptación:**

- Dado cualquiera de los 27 campos de dinero Cuando escribo 1500000 Entonces se muestra 1.500.000
- Dado el monto 1.500.000 Cuando se guarda Entonces Prisma recibe 1500000, no 1.5
- **(borde)** Dado un monto con coma decimal Cuando se guarda Entonces se conserva la parte decimal
- Dado los campos de dinero Cuando se renderizan Entonces no muestran los spinners del input numérico

**Justificación de la estimación:** 27 campos y un bug de parseo en tres capas que solo cerró un test que llega hasta Prisma.

**Evidencia:** #136 c678020 · src/components/ui/money-input.tsx · src/features/case/monto.ts · CLAUDE.md Quick Win 9

### E01-30 · Story · Montos en formato colombiano en los campos de dinero fuera del formulario maestro

**Estado:** Done (2026-10-18) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature, doc-semana-11 · **Components:** Frontend, Backend

Como **conciliadora**, quiero escribir la cuantía de la audiencia y el monto mensual del acuerdo de apoyo en formato 1.234,56, para que el documento no imprima $0 en silencio cuando escribo un monto con puntos.

> HISTORIA DE REFERENCIA (3 pts) de todo el backlog.

**Criterios de aceptación:**

- Dado la cuantía de conciliación Cuando escribo 1.234,56 Entonces se guarda 1234.56
- Dado el monto mensual de apoyo Cuando escribo 1.500.000 Entonces el documento imprime $1.500.000
- **(error)** Dado un monto no numérico Cuando se envía Entonces se rechaza con mensaje en vez de guardarse como $0
- **(borde)** Dado formatCurrency con un valor NaN Cuando se formatea Entonces no imprime NaN en el documento

**Evidencia:** #145 4e5a342 · docs/IMPLEMENTACION_SEMANA_11.md · CHANGELOG.md [1.0.0-rc.1] (#145)

### E01-31 · Bug · Los totales de ingresos y deudas del wizard daban NaN con coma decimal

**Estado:** Done (2026-10-18) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** doc-semana-10 · **Components:** Frontend, Testing

- **Entorno:** dev y producción (1.0.0-rc.1 previo), octubre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Crear un caso
  2. Escribir un ingreso como 1500,50
  3. Mirar el total de ingresos
- **Esperado:** El total suma 1500.50
- **Actual:** El total muestra NaN en pantalla
- **Causa raíz:** 4 lugares sumaban con parseFloat sobre el texto con coma decimal en vez de usar parsearMonto.
- **Fix:** #144 92b77ca
- **Test de regresión:** Tests de los 4 cálculos con coma decimal; verificación manual contra Postgres local.

**Criterios de aceptación del fix:**

- Dado un monto con coma decimal Cuando se calcula el total Entonces el total es numérico
- Dado el NaN en pantalla Cuando se guarda el caso Entonces nunca llega NaN al servidor (verificado)

**Evidencia:** #144 92b77ca · docs/IMPLEMENTACION_SEMANA_10.md §2

### E01-32 · Bug · Las fechas históricas de conciliación se imprimían con la fecha de hoy

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** doc-semana-5, doc-semana-6 · **Components:** Backend, Base-de-Datos, Documentos-PDF

- **Entorno:** Producción y dev, octubre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Crear una conciliación cuya solicitud se presentó hace un mes
  2. Generar la citación
- **Esperado:** El documento imprime las fechas reales de solicitud, citación y desistimiento
- **Actual:** El documento imprime la fecha de hoy como si esos hechos hubieran ocurrido hoy
- **Causa raíz:** No existían columnas para esas fechas y el mapper caía a new Date().
- **Fix:** #138 658686e (interino) y #139 756342d (3 columnas DateTime reales)
- **Test de regresión:** Test de cobertura bidireccional formulario<->plantilla (8fd4a35, 434a7a3).

**Criterios de aceptación del fix:**

- Dado una fecha de solicitud informada Cuando se genera el documento Entonces imprime esa fecha
- **(error)** Dado una fecha no informada Cuando se genera Entonces no imprime la fecha de hoy

**Justificación de la estimación:** Arreglo en dos tiempos (interino + columnas reales) con migración y guardián de cobertura.

**Hallazgos:** CONC-C-1a

**Evidencia:** #138 fe82fe6 · #139 0a41c56 · docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md §2 · docs/IMPLEMENTACION_SEMANA_5.md · docs/IMPLEMENTACION_SEMANA_6.md

### E01-33 · Story · Datos de la audiencia virtual por Zoom en la conciliación

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** doc-semana-5 · **Components:** Frontend, Documentos-PDF

Como **conciliadora**, quiero registrar el enlace, ID y clave de Zoom de la audiencia, para que la convocatoria llegue con el enlace y las partes puedan conectarse.

**Criterios de aceptación:**

- Dado una audiencia virtual Cuando registro los 3 datos de Zoom Entonces se guardan
- Dado los datos guardados Cuando genero la convocatoria Entonces incluye el enlace
- **(borde)** Dado una audiencia presencial Cuando no hay datos de Zoom Entonces la convocatoria no deja huecos

**Hallazgos:** CONC-C-3

**Evidencia:** #138 c601c5f · docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md §3

### E01-34 · Story · Inputs para los 5 campos de conciliación que ya tenían columna

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** doc-semana-5 · **Components:** Frontend

Como **conciliadora**, quiero diligenciar los 5 campos que las plantillas usan y el formulario no mostraba, para que esos datos dejen de salir vacíos en el acta.

**Criterios de aceptación:**

- Dado el formulario de conciliación Cuando lo abro Entonces veo los 5 campos
- Dado los campos diligenciados Cuando genero Entonces aparecen en el documento
- **(borde)** Dado un campo opcional vacío Cuando genero Entonces la frase no queda rota

**Hallazgos:** CONC-C-2

**Evidencia:** #138 48a620e · docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md §4

### E01-35 · Story · Aclaración de Acta con valores correcto e incorrecto

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** doc-semana-6 · **Components:** Frontend, Backend, Base-de-Datos, Documentos-PDF

Como **conciliadora**, quiero registrar qué se corrige en un acta y cuáles eran el valor incorrecto y el correcto, para emitir la Aclaración de Acta sin redactarla a mano.

**Criterios de aceptación:**

- Dado un acta con un error Cuando registro la aclaración Entonces se guardan las 8 columnas nuevas
- Dado la aclaración guardada Cuando genero el documento Entonces imprime valor incorrecto y correcto
- **(borde)** Dado un acta sin aclaración Cuando genero otros documentos Entonces no se ven afectados

**Justificación de la estimación:** 8 columnas nuevas con migración, Zod, formulario, mapper y cobertura.

**Hallazgos:** CONC-C-1c

**Evidencia:** #139 0a41c56 · docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md §5.1 · docs/IMPLEMENTACION_SEMANA_6.md

### E01-36 · Story · Selector de bienes en dos niveles: categoría y tipo

**Estado:** Done (2026-10-19) · **Sprint:** INS 2026-W43 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature, doc-semana-14 · **Components:** Frontend

Como **operadora de insolvencia**, quiero elegir primero la categoría del bien y después el tipo exacto, para no confundir tipos de bienes parecidos en una lista larga.

**Criterios de aceptación:**

- Dado el formulario de bienes Cuando elijo la categoría Entonces solo veo los tipos de esa categoría
- Dado un bien guardado con la versión anterior Cuando abro la edición Entonces se normaliza a categoría y tipo
- **(borde)** Dado un tipo legacy sin categoría Cuando se carga Entonces no desaparece de la tabla

**Evidencia:** #148 25d6d7e · docs/IMPLEMENTACION_SEMANA_14.md §3

### E01-37 · Bug · Los bienes tipo Equipo desaparecían de la tabla de la Solicitud

**Estado:** Done (2026-10-19) · **Sprint:** INS 2026-W43 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** doc-semana-14 · **Components:** Documentos-PDF, Testing

- **Entorno:** Producción (1.0.0-rc.1 previo)
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Registrar un bien tipo Equipo con el formulario anterior
  2. Generar la Solicitud de Insolvencia
- **Esperado:** El equipo aparece en la tabla de bienes y en el total
- **Actual:** No aparece en la tabla aunque sí se suma al total
- **Causa raíz:** La tabla filtraba por los tipos del selector nuevo y EQUIPO no tenía correspondencia.
- **Fix:** #148 25d6d7e
- **Test de regresión:** Test de la tabla de bienes con tipo EQUIPO.

**Criterios de aceptación del fix:**

- Dado un bien EQUIPO Cuando se genera la Solicitud Entonces aparece en la tabla
- Dado la tabla y el total Cuando se comparan Entonces suman lo mismo

**Evidencia:** #148 25d6d7e · docs/IMPLEMENTACION_SEMANA_14.md §3 (Bug real)

### E01-38 · Bug · El bloqueo optimista es opcional y no atómico

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 3 pts · **MoSCoW:** Must · **Rank:** 1

**Labels:** nfr · **Components:** Backend, Testing

- **Entorno:** Producción actual (1.0.0-rc.1)
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir el mismo caso en dos sesiones (versión 5)
  2. Guardar en ambas casi a la vez
  3. O enviar updateCase sin version
- **Esperado:** La segunda escritura recibe conflicto
- **Actual:** Ambas leen v=5, pasan el check y escriben; si el cliente no manda version el check se salta
- **Causa raíz:** version es z.number().int().optional() (schemas.ts:1406) y el check es leer-luego-escribir (actions.ts:1008) en READ COMMITTED.
- **Fix:** Pendiente: updateMany({ where: { id, tenantId, version } }) con count === 0 como conflicto, y version obligatorio.
- **Test de regresión:** Test de dos escrituras concurrentes con la misma versión y de envío sin version.

**Criterios de aceptación del fix:**

- **(error)** Dado dos guardados concurrentes con version 5 Cuando ambos llegan Entonces exactamente uno falla con conflicto
- **(error)** Dado un updateCase sin version Cuando se envía Entonces se rechaza
- Dado un guardado normal Cuando no hay conflicto Entonces la versión se incrementa en la misma sentencia

**Hallazgos:** GC-A2

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §2 (Alto) · docs/AUDITORIA_CIERRE_2026-09-12.md §4 A-2 sin cambios · src/features/case/schemas.ts:1406 · src/features/case/actions.ts:1008

### E01-39 · Bug · Dos casos creados a la vez pueden recibir el mismo número

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Media · **Estimación:** 3 pts · **MoSCoW:** Should · **Rank:** 25

**Labels:** — · **Components:** Backend, Testing

- **Entorno:** Producción actual (1.0.0-rc.1)
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Dos operadoras crean un caso del mismo servicio al mismo tiempo
- **Esperado:** Cada caso recibe un número consecutivo distinto
- **Actual:** Ambas calculan el mismo número; la segunda recibe 'Unique constraint failed'
- **Causa raíz:** caseNumber se calcula con findFirst + 1 sin transacción serializable ni secuencia (actions.ts:435-455).
- **Fix:** Pendiente: reintento sobre P2002 con el siguiente número, u ordenar por caseNumber y usar secuencia por tenant y prefijo.
- **Test de regresión:** Test que simula P2002 en la primera inserción y verifica el reintento.

**Criterios de aceptación del fix:**

- **(error)** Dado un P2002 por caseNumber Cuando se crea el caso Entonces se reintenta con el siguiente número sin error al usuario
- Dado un caso cargado con número manual alto Cuando se crea el siguiente Entonces el contador no retrocede

**Hallazgos:** GC-M1

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §2 (Medio) · src/features/case/actions.ts:435-455

### E01-40 · Story · Borrado lógico de expedientes

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 32

**Labels:** nfr · **Components:** Backend, Base-de-Datos

Como **administrador del centro**, quiero que eliminar un expediente lo oculte en vez de destruirlo, para poder recuperarlo ante un error y cumplir la política de retención de la Ley 1581.

**Criterios de aceptación:**

- Dado un expediente Cuando se elimina Entonces queda con deletedAt y no aparece en listados, búsqueda ni reportes
- **(error)** Dado un expediente borrado Cuando se consulta por id Entonces se responde como no encontrado
- Dado el borrado Cuando ocurre Entonces queda en audit_logs antes de ejecutarse
- **(borde)** Dado un caso borrado con número X Cuando se crea uno nuevo Entonces no reutiliza el número X

**Justificación de la estimación:** Toca todas las lecturas de casos (filtro global) y requiere migración.

**Hallazgos:** PP-A-8, GC-M6

**Dependencias:** is blocked by E11-17 · blocks E01-41, E01-42

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md A-8 · CLAUDE.md Fase 3 (soft-delete ~20h) · docs/IMPLEMENTACION_SEMANA_4.md §6 decisión 2 (post-lanzamiento)

### E01-41 · Story · Papelera y restauración de expedientes

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Could · **Rank:** 50

**Labels:** feature · **Components:** Frontend, Backend

Como **administrador del centro**, quiero ver los expedientes borrados y restaurar uno, para deshacer un borrado accidental sin pedir una restauración de base de datos.

**Criterios de aceptación:**

- Dado expedientes borrados Cuando abro la papelera Entonces los veo con fecha y autor del borrado
- Dado un expediente en la papelera Cuando lo restauro Entonces vuelve a los listados y queda auditado
- **(error)** Dado un usuario sin rol administrador Cuando intenta restaurar Entonces se rechaza

**Justificación de la estimación:** Pantalla nueva con permisos propios y efecto sobre Drive.

**Hallazgos:** PP-A-8

**Dependencias:** is blocked by E01-40

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §6 Fase post-launch · CLAUDE.md Fase 3 (capacidad de recuperación)

### E01-42 · Story · Borrado coordinado de la carpeta del expediente en Drive

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 3 pts · **MoSCoW:** Should · **Rank:** 33

**Labels:** nfr · **Components:** Backend

Como **administrador del centro**, quiero que al borrar un expediente su carpeta de Drive vaya a una papelera del centro, para no dejar PDFs con cédula e ingresos huérfanos en Drive.

**Criterios de aceptación:**

- Dado un expediente con carpeta en Drive Cuando se borra Entonces la carpeta se mueve a la papelera del tenant
- **(error)** Dado un fallo de Drive Cuando se borra Entonces el borrado lógico se completa y el fallo queda en Sentry
- Dado una restauración Cuando ocurre Entonces la carpeta vuelve a su lugar

**Hallazgos:** GC-M6

**Dependencias:** is blocked by E01-40

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §2 deleteCase (Medio)

### E01-43 · Story · Validar en el servidor los documentos adjuntos obligatorios

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Could · **Rank:** 51

**Labels:** — · **Components:** Backend

Como **abogado del centro**, quiero que el servidor verifique los adjuntos obligatorios y los condicionales de bienes, para que la regla no dependa solo del formulario.

**Criterios de aceptación:**

- **(error)** Dado un caso sin un adjunto obligatorio Cuando se envía directo al servidor Entonces se rechaza
- Dado un bien que exige tradición y libertad Cuando falta Entonces se reporta como faltante
- Dado los flujos de carga y creación Cuando se unifican Entonces validateDocumentsComplete corre en el servidor

**Justificación de la estimación:** Requiere unificar el flujo de carga de archivos con el de creación del caso.

**Evidencia:** docs/IMPLEMENTACION_SEMANA_3.md §3.2 Brechas conocidas

---

<a id="e02"></a>

## E02 — Generación de Documentos

Plantillas HTML (65 hoy: insolvency, conciliation, support-agreements) → placeholder-mapper → PDF vía Puppeteer/Chromium y DOCX vía html-to-docx → Google Drive. Dos rutas: automática al crear/cambiar de fase el caso (after() + lock) y manual desde /documents (batchGenerateDocuments, en tandas).

**Objetivo de negocio:** Que ningún documento que se radica ante un juzgado o centro salga con datos vacíos, equivocados o duplicados, y que generar un paquete completo no dependa de la suerte con el timeout de Vercel.

**Evidencia:** docs/ARQUITECTURA.md §6 · docs/AUDITORIA_MODULO_GENERACION_2026-07.md · docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 · src/features/document/

| ID     | Tipo         | Título                                                                          | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E02-01 | Story        | Generar documentos legales en PDF desde plantillas HTML                         |   8 | Done   | 2026-W08 | v0.1.0      |
| E02-02 | Bug          | Nombres de archivo que colisionaban y variables sin resolver en la generación   |   3 | Done   | 2026-W09 | v0.1.0      |
| E02-03 | Story        | Módulo /documents como punto principal de generación                            |   3 | Done   | 2026-W10 | v0.1.0      |
| E02-04 | Story        | Salida en Word (.docx) y formulario previo a la generación                      |   5 | Done   | 2026-W14 | v0.2.0      |
| E02-05 | Story        | Check List por categoría, Certificado narrativo y Excel consolidado             |   5 | Done   | 2026-W14 | v0.2.0      |
| E02-06 | Story        | Plantillas actualizadas a la Ley 2445 de 2025 y documento de Restablecimiento   |   3 | Done   | 2026-W14 | v0.2.0      |
| E02-07 | Story        | Plantillas de Conciliación con motor handlebars-lite                            |   8 | Done   | 2026-W15 | v0.2.0      |
| E02-08 | Story        | Carpetas del expediente en Drive por sección y numeración por servicio          |   5 | Done   | 2026-W15 | v0.2.0      |
| E02-09 | Story        | Vista previa de PDFs e imágenes dentro de la app                                |   2 | Done   | 2026-W16 | v0.2.0      |
| E02-10 | Bug          | Assets, persistencia y límites de la generación inconsistentes entre rutas      |   3 | Done   | 2026-W28 | v0.4.0      |
| E02-11 | Bug          | Inyección de HTML (XSS) a través de los datos del caso en los documentos        |   5 | Done   | 2026-W28 | v0.4.0      |
| E02-12 | Story        | Lock atómico que impide dos generaciones simultáneas del mismo paquete          |   5 | Done   | 2026-W28 | v0.4.0      |
| E02-13 | Story        | Generación inicial en segundo plano con aviso al terminar                       |   5 | Done   | 2026-W28 | v0.4.0      |
| E02-14 | Bug          | Documentos legales con campos vacíos generados en silencio                      |   5 | Done   | 2026-W37 | v0.5.0      |
| E02-15 | Story        | Lock en la generación manual y presupuesto de ejecución explícito               |   3 | Done   | 2026-W37 | v0.5.0      |
| E02-16 | Bug          | Las fechas de fracaso salían pisadas en el merge final del mapper               |   2 | Done   | 2026-W38 | v0.6.0      |
| E02-17 | Bug          | Los totales de bienes de la Solicitud concatenaban en vez de sumar              |   3 | Done   | 2026-W38 | v0.6.0      |
| E02-18 | Bug          | Doble conversión de zona horaria y años de pago pisados en los documentos       |   3 | Done   | 2026-W39 | v0.6.0      |
| E02-19 | Bug          | Representante, acreedores por posición y bloques condicionales mal resueltos    |   3 | Done   | 2026-W39 | v0.6.0      |
| E02-20 | Bug          | El motor no reconocía {{#unless @last}} dentro de {{#each}}                     |   2 | Done   | 2026-W40 | v0.6.0      |
| E02-21 | Bug          | La cobertura de placeholders contaba variables de bloque como faltantes         |   2 | Done   | 2026-W40 | v0.6.0      |
| E02-22 | Story        | Generación automática en tres fases con un solo navegador                       |   5 | Done   | 2026-W40 | v0.6.0      |
| E02-23 | Story        | La Solicitud y el CYG listan todos los acreedores sin tope                      |   8 | Done   | 2026-W40 | v0.6.0      |
| E02-24 | Story        | Un oficio de suspensión por cada juzgado del caso                               |   3 | Done   | 2026-W40 | v0.6.0      |
| E02-25 | Bug          | Tres placeholders leían la fuente equivocada o ninguna                          |   2 | Done   | 2026-W40 | v0.6.0      |
| E02-26 | Story        | Reintentos en la subida a Drive de la generación manual                         |   2 | Done   | 2026-W40 | v0.6.0      |
| E02-27 | Bug          | Toda fecha del formulario salía impresa un día antes                            |   3 | Done   | 2026-W41 | v0.6.0      |
| E02-28 | Bug          | Las 12 causas de insolvencia de la Solicitud salían siempre en NO               |   3 | Done   | 2026-W41 | v0.6.0      |
| E02-29 | Bug          | El Paquete 3 no se podía generar y el formulario del Paquete 2 fallaba          |   3 | Done   | 2026-W41 | v0.6.0      |
| E02-30 | Bug          | Check List: Parágrafos 1 y 2 sin resolver y CONOCE_NORMA incorrecto             |   2 | Done   | 2026-W41 | v0.6.0      |
| E02-31 | Bug          | Las cláusulas del Acuerdo de Apoyo desaparecían del documento                   |   3 | Done   | 2026-W41 | v0.6.0      |
| E02-32 | Story        | Generación de lotes grandes en tandas con reintento por tanda                   |   8 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E02-33 | Story        | Requisitos mínimos de datos para cada plantilla de insolvencia y apoyo          |   5 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E02-34 | Task (spike) | Definir con los centros la política de versiones al regenerar un documento      |   2 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E02-35 | Story        | Regenerar un documento sin duplicarlo en Drive ni en la base                    |   5 | To Do  | 2026-W47 | v1.0.0      |
| E02-36 | Story        | Ver el estado de la generación en segundo plano desde el caso                   |   3 | To Do  | 2026-W47 | v1.0.0      |
| E02-37 | Bug          | Consultas de diagnóstico de plantillas sin filtro de centro volcadas a los logs |   — | To Do  | 2026-W44 | v1.0.0-rc.2 |

### E02-01 · Story · Generar documentos legales en PDF desde plantillas HTML

**Estado:** Done (2026-02-21) · **Sprint:** INS 2026-W08 · **Versión:** v0.1.0 · **Prioridad:** Crítica · **Estimación:** 8 pts

**Labels:** feature · **Components:** Backend, Documentos-PDF

Como **operadora de insolvencia**, quiero generar los documentos del trámite a partir de los datos del caso, para dejar de redactar a mano cada solicitud, auto y acta.

**Criterios de aceptación:**

- Dado un caso completo Cuando genero el paquete de Solicitud Entonces obtengo los PDF con los datos del caso
- Dado una plantilla con placeholders Cuando se renderiza Entonces cada {{VARIABLE}} se reemplaza por su valor
- **(error)** Dado una plantilla inexistente Cuando se intenta generar Entonces el documento se marca como error
- Dado los 5 paquetes (Solicitud, Admisión, Negociación, Terminación, Fracaso) Cuando elijo uno Entonces se generan sus plantillas

**Justificación de la estimación:** Pipeline completo nuevo (49 plantillas iniciales, mapper de 300+ variables, Chromium) rediseñado a HTML local.

**Sub-tasks:**

- `E02-01.1` Plantillas HTML por paquete — 49 plantillas en 5 paquetes.
- `E02-01.2` Placeholder-mapper — Mapeo de 300+ variables desde el caso.
- `E02-01.3` Render a PDF con Puppeteer — html-to-pdf y subida a Drive.

**Evidencia:** df0ba7c feat: rediseñar sistema de generación de documentos a pipeline HTML local · CHANGELOG.md [0.1.0] Document generation

### E02-02 · Bug · Nombres de archivo que colisionaban y variables sin resolver en la generación

**Estado:** Done (2026-02-26) · **Sprint:** INS 2026-W09 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** inferido · **Components:** Documentos-PDF

- **Entorno:** Desarrollo, febrero 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar un paquete con varias plantillas de nombre parecido
  2. Revisar los archivos y su contenido
- **Esperado:** Un archivo por plantilla, con todas las variables resueltas
- **Actual:** Archivos que se pisaban entre sí y variables sin resolver o mal renderizadas
- **Causa raíz:** Según los commits: nombres de archivo derivados sin unicidad y variables faltantes en el mapper. Detalle no documentado.
- **Fix:** 8d0cae4 (5 correcciones críticas) + 584feaf (colisión filenames, variables y rendering) + 1fa6eb8 (variables faltantes y logging)
- **Test de regresión:** No identificado en los commits.

**Criterios de aceptación del fix:**

- Dado dos plantillas con nombre similar Cuando se generan Entonces producen dos archivos distintos
- Dado una plantilla generada Cuando se revisa Entonces no quedan {{VARIABLES}} visibles

**Evidencia:** 8d0cae4 · 584feaf · 1fa6eb8

### E02-03 · Story · Módulo /documents como punto principal de generación

**Estado:** Done (2026-03-07) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero elegir caso, paquete y formato desde una sola pantalla, para generar lo que necesito sin entrar al detalle de cada caso.

**Criterios de aceptación:**

- Dado la pantalla /documents Cuando elijo un caso y un paquete Entonces veo las plantillas que se van a generar
- Dado la generación terminada Cuando la reviso Entonces veo qué documentos se generaron
- **(error)** Dado un usuario sin permiso de generar Cuando abre /documents Entonces no puede generar

**Evidencia:** 2167f61 feat: mejorar módulo /documents como punto principal de generación

### E02-04 · Story · Salida en Word (.docx) y formulario previo a la generación

**Estado:** Done (2026-03-30) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Documentos-PDF

Como **abogado del centro**, quiero obtener los documentos también en Word y completar datos de último momento antes de generarlos, para poder ajustar la redacción en casos especiales sin rehacer el documento.

**Criterios de aceptación:**

- Dado un paquete Cuando elijo formato Word Entonces obtengo archivos .docx
- Dado el formato Ambos Cuando genero Entonces obtengo PDF y DOCX de cada plantilla
- **(borde)** Dado un dato pedido en el formulario previo Cuando lo dejo vacío Entonces se advierte antes de generar

**Justificación de la estimación:** Segundo motor de salida (html-to-docx) con CSS de tablas distinto al de Chromium.

**Evidencia:** 0c4c660 feat: generación Word (.docx), formulario pre-generación · c7ddb75 docs: DOCX export exists

### E02-05 · Story · Check List por categoría, Certificado narrativo y Excel consolidado

**Estado:** Done (2026-04-02) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Documentos-PDF, Backend

Como **operadora de insolvencia**, quiero el Check List agrupado por categoría, el certificado en prosa y un Excel consolidado del caso, para entregar al centro el soporte completo en el formato que piden.

**Criterios de aceptación:**

- Dado un caso Cuando genero el Check List Entonces los ítems se agrupan por categoría
- Dado el certificado Cuando se genera Entonces es narrativo, no una tabla
- **(borde)** Dado un caso sin acreedores del tipo CYG Cuando genero Entonces los placeholders CYG no dejan huecos

**Justificación de la estimación:** Tres documentos distintos y un exportador Excel en un mismo cambio.

**Evidencia:** c8a56ff feat: mejoras documentos — Checklist categoría, Certificado narrativo, CYG placeholders, Excel consolidado

### E02-06 · Story · Plantillas actualizadas a la Ley 2445 de 2025 y documento de Restablecimiento

**Estado:** Done (2026-04-03) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

Como **abogado del centro**, quiero que las plantillas citen la norma vigente e incluyan el documento de Restablecimiento, para no radicar documentos con fundamento normativo desactualizado.

**Criterios de aceptación:**

- Dado las plantillas de insolvencia Cuando se generan Entonces citan la Ley 2445/2025 donde corresponde
- Dado un caso que lo requiere Cuando genero Restablecimiento Entonces se produce el documento
- **(borde)** Dado una plantilla sin cambio normativo Cuando se genera Entonces su texto no cambia

**Evidencia:** 8e63bb0 feat: actualizar plantillas con Ley 2445/2025 y nuevo documento Restablecimiento

### E02-07 · Story · Plantillas de Conciliación con motor handlebars-lite

**Estado:** Done (2026-04-09) · **Sprint:** INS 2026-W15 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** feature · **Components:** Backend, Documentos-PDF

Como **conciliadora**, quiero generar actas y constancias de conciliación con listas de partes, menores y cláusulas, para emitir los documentos del servicio de conciliación desde el sistema.

**Criterios de aceptación:**

- Dado una conciliación con tres cláusulas Cuando genero el acta Entonces se imprimen las tres en orden con {{#each}}
- Dado un bloque {{#if}} sin dato Cuando se renderiza Entonces el bloque no aparece
- **(borde)** Dado una conciliación con menor de edad Cuando genero Entonces se incluyen las cláusulas de alimentos
- Dado el gap de variables cerrado Cuando se genera cualquier plantilla de conciliación Entonces no quedan variables sin mapear

**Justificación de la estimación:** Servicio documental nuevo con motor de plantillas propio (bloques y arreglos).

**Sub-tasks:**

- `E02-07.1` Motor handlebars-lite ({{#each}}, {{#if}}) — 4613a98.
- `E02-07.2` Mapper de conciliación y cierre del gap de variables — 04f2003.

**Evidencia:** fb3cabc feat: implementar servicio de Conciliación — plantillas, formulario y pipeline · 04f2003 feat(conciliation): cerrar gap de variables · 4613a98 feat(conciliation): motor handlebars-lite

### E02-08 · Story · Carpetas del expediente en Drive por sección y numeración por servicio

**Estado:** Done (2026-04-08) · **Sprint:** INS 2026-W15 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** — · **Components:** Backend

Como **operadora de insolvencia**, quiero que cada expediente tenga en Drive carpetas por sección y numeración por servicio, para encontrar los documentos de un caso en Drive sin buscar archivo por archivo.

> El versionado (archiveSupersededDocument) quedó como código muerto; ver E02-34/E02-35 (GD-A3).

**Criterios de aceptación:**

- Dado un caso nuevo Cuando se generan documentos Entonces se suben a la subcarpeta de su sección (layout v1)
- Dado un caso legacy en layout 0 Cuando se accede Entonces el migrador lazy lo trata sin romperlo
- **(borde)** Dado un fallo al crear la subcarpeta Cuando se sube Entonces el documento cae en la carpeta del caso

**Justificación de la estimación:** Cambio de layout de almacenamiento con migrador lazy y compatibilidad hacia atrás.

**Evidencia:** 4b9b7a0 feat(storage): layout v1 sectorizado para Drive · 269db78 feat(storage): versionado, migrador lazy, centros DB, numeración por servicio

### E02-09 · Story · Vista previa de PDFs e imágenes dentro de la app

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend

Como **abogado del centro**, quiero ver un PDF o un comprobante sin descargarlo, para revisar documentos rápido durante la atención.

**Criterios de aceptación:**

- Dado un PDF del caso Cuando lo abro Entonces se muestra embebido
- Dado una imagen JPG o PNG Cuando la abro Entonces se muestra embebida
- **(borde)** Dado un formato no soportado Cuando lo abro Entonces se ofrece la descarga

**Evidencia:** CHANGELOG.md [0.2.0] Inline document preview

### E02-10 · Bug · Assets, persistencia y límites de la generación inconsistentes entre rutas

**Estado:** Done (2026-07-10) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend, Documentos-PDF

- **Entorno:** Código de julio 2026 (auditoría del módulo de documentos)
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Generar desde la ruta automática y desde la manual el mismo documento
  2. Comparar assets y filas Document
- **Esperado:** Mismos assets por tipo de caso y misma persistencia
- **Actual:** Assets no dependían del caseType, persistencia duplicada y generación sin rate limit
- **Causa raíz:** Dos rutas de generación con lógica copiada (hallazgos de AUDITORIA_MODULO_GENERACION_2026-07).
- **Fix:** 18d90cc fix(document): auditoría — assets por caseType, persistencia unificada, rate limiting
- **Test de regresión:** Tests de persistencia compartida (persistence.ts).

**Criterios de aceptación del fix:**

- Dado una conciliación Cuando se genera Entonces usa los assets de conciliación
- Dado muchas generaciones seguidas de un usuario Cuando supera el límite Entonces se rechazan

**Evidencia:** 18d90cc · docs/AUDITORIA_MODULO_GENERACION_2026-07.md

### E02-11 · Bug · Inyección de HTML (XSS) a través de los datos del caso en los documentos

**Estado:** Done (2026-07-10) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** seguridad · **Components:** Backend, Documentos-PDF

- **Entorno:** Todas las versiones hasta julio 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Registrar un deudor con nombre '<img src=x onerror=...>'
  2. Generar un documento
- **Esperado:** El nombre aparece escapado como texto
- **Actual:** El HTML se interpreta dentro de la plantilla
- **Causa raíz:** ~300 claves escalares en ~20 sub-mappers se interpolaban sin escapar; escapar valor por valor garantizaba omisiones.
- **Fix:** 758b733 — escape OWASP en el punto de fusión de mapCaseToPlaceholders + allowlist de 16 placeholders HTML del sistema
- **Test de regresión:** Guardián del escape HTML con allowlist (52392a1, E14-06).

**Criterios de aceptación del fix:**

- Dado un dato con etiquetas HTML Cuando se genera el documento Entonces se imprime escapado
- Dado un placeholder HTML del sistema en la allowlist Cuando se genera Entonces conserva su marcado

**Justificación de la estimación:** Cambio transversal en el punto de fusión del mapper con allowlist y builders.

**Evidencia:** 758b733 fix(document): escape HTML en placeholders + builders (P2) · CLAUDE.md Session 1 (P2 XSS)

### E02-12 · Story · Lock atómico que impide dos generaciones simultáneas del mismo paquete

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero que un doble clic o dos compañeras generando a la vez no dupliquen documentos, para no tener dos versiones del mismo documento en el expediente.

**Criterios de aceptación:**

- Dado N solicitudes simultáneas del mismo caso y tipo Cuando se reclaman Entonces exactamente una gana
- **(error)** Dado una solicitud perdedora Cuando responde Entonces devuelve success:false con el requestId de la activa
- **(borde)** Dado un lock de más de 10 minutos Cuando se intenta reclamar Entonces se libera y se re-reclama

**Justificación de la estimación:** Clave única parcial en Postgres (activeKey) diseñada para serverless sin cola externa.

**Evidencia:** 177cf24 feat(documents): P3 + P4 · CLAUDE.md Session 2 (P3)

### E02-13 · Story · Generación inicial en segundo plano con aviso al terminar

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend

Como **operadora de insolvencia**, quiero que crear un caso responda de inmediato y me avise cuando los documentos estén listos, para no esperar con la pantalla congelada mientras se generan los PDF.

**Criterios de aceptación:**

- Dado un caso nuevo Cuando lo guardo Entonces la respuesta llega sin esperar la generación
- Dado el job en after() Cuando termina Entonces recibo una notificación in-app con el resultado
- **(error)** Dado un fallo de Drive Cuando se sube Entonces se reintenta 3 veces con backoff antes de marcar FAILED
- Dado una solicitud Cuando se consulta getGenerationRequestStatus Entonces devuelve PENDING, PROCESSING, COMPLETED, COMPLETED_WITH_ERRORS o FAILED

**Justificación de la estimación:** Máquina de estados de la solicitud, after() de Next, retry y notificaciones.

**Evidencia:** 177cf24 feat(documents): P3 + P4 · CLAUDE.md Session 2 (P4) · CHANGELOG.md [1.0.0-rc.1] Generación inicial en background

### E02-14 · Bug · Documentos legales con campos vacíos generados en silencio

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** doc-semana-3 · **Components:** Backend, Documentos-PDF, Testing

- **Entorno:** Producción hasta septiembre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Crear un caso sin el nombre del deudor
  2. Generar la Solicitud desde /documents
- **Esperado:** La generación se bloquea e informa qué falta
- **Actual:** El PDF sale con el campo en blanco (y filas de tabla eliminadas), indistinguible de uno correcto
- **Causa raíz:** replacePlaceholders vaciaba todo {{VAR}} no resuelto sin señal, y batchGenerateDocuments no invocaba validateDocumentRequirements ni validatePlaceholderCoverage. Además, una generación con todo skipped quedaba COMPLETED.
- **Fix:** PR #4 17c7de2 (commit d476625): bloqueo por datos incompletos en ambas rutas y completeGenerationRequest marca COMPLETED_WITH_ERRORS si no produjo nada
- **Test de regresión:** Tests de generación con caso incompleto en la ruta manual (PR #4).

**Criterios de aceptación del fix:**

- **(error)** Dado un caso sin un dato requerido Cuando se genera Entonces el documento sale skipped con la lista de faltantes
- Dado una generación en la que todos los documentos se saltaron Cuando termina Entonces su estado es COMPLETED_WITH_ERRORS

**Justificación de la estimación:** Cambia el contrato de las dos rutas de generación y el estado de la solicitud.

**Hallazgos:** GD-C1, GD-C2, GD-M1

**Evidencia:** PR #4 17c7de2 (d476625) · docs/IMPLEMENTACION_SEMANA_3.md §4 · src/features/document/generation-request.ts:178-200

### E02-15 · Story · Lock en la generación manual y presupuesto de ejecución explícito

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** nfr, doc-semana-3 · **Components:** Backend

Como **operadora de insolvencia**, quiero que la generación manual tampoco se duplique y no se corte por el timeout por defecto, para confiar en que el paquete que pedí se generó una sola vez y completo.

**Criterios de aceptación:**

- Dado dos generaciones manuales del mismo paquete Cuando se piden a la vez Entonces solo una corre (kind BATCH)
- Dado /cases y /documents Cuando se ejecutan Entonces declaran maxDuration = 60
- **(borde)** Dado un lote de 26 o 77 documentos Cuando se pide Entonces sigue sin caber en 60 s (queda en E02-32)

**Hallazgos:** GD-A4, GD-A1

**Evidencia:** PR #4 17c7de2 (6a95bc4) · docs/IMPLEMENTACION_SEMANA_3.md §5 · docs/AUDITORIA_CIERRE_2026-09-12.md §4 (A-8 resuelto, A-5 reducido)

### E02-16 · Bug · Las fechas de fracaso salían pisadas en el merge final del mapper

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** dev, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar un documento de Fracaso con fecha registrada
- **Esperado:** DIA/MES/ANO_FRACASO con la fecha del caso
- **Actual:** Valores pisados por duplicados muertos en el merge
- **Causa raíz:** Claves duplicadas entre sub-mappers; la fusión final se quedaba con el valor equivocado.
- **Fix:** 62a0c19 (refs #18) + PR #24
- **Test de regresión:** Test que blinda DIA/MES/ANO_FRACASO en el merge final.

**Criterios de aceptación del fix:**

- Dado un caso con fecha de fracaso Cuando se genera Entonces las tres claves usan esa fecha
- Dado un duplicado nuevo de esas claves Cuando se agrega Entonces el test falla

**Evidencia:** 62a0c19 · #24 1ae9087 · issue #18

### E02-17 · Bug · Los totales de bienes de la Solicitud concatenaban en vez de sumar

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** Producción, ruta automática de generación (creación de caso)
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Crear un caso con un inmueble de $100M
  2. Revisar TOTAL_INMUEBLES en la Solicitud
- **Esperado:** $100.000.000
- **Actual:** $1.000M o cifras de 15 dígitos con más activos
- **Causa raíz:** mapAssets sumaba Prisma.Decimal con +, y Decimal.valueOf() devuelve string: concatenaba.
- **Fix:** e7af5bf (PR #41): Number() en cada sumando
- **Test de regresión:** Test con Prisma.Decimal real comparando la salida completa del mapper entre Decimal y number.

**Criterios de aceptación del fix:**

- Dado activos Prisma.Decimal Cuando se suman Entonces el total es aritmético
- Dado la misma entrada como Decimal y como number Cuando se mapea Entonces la salida es idéntica

**Evidencia:** e7af5bf · #41 5db7b1e · CHANGELOG.md [1.0.0-rc.1] Fixed (Totales de bienes)

### E02-18 · Bug · Doble conversión de zona horaria y años de pago pisados en los documentos

**Estado:** Done (2026-09-24) · **Sprint:** INS 2026-W39 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** dev, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar el acuerdo de pago de un caso con fecha de inicio
- **Esperado:** Fechas y años correctos
- **Actual:** Fechas corridas por doble conversión y ANO_INICIO_PAGO/ANO_VIGENCIA sobrescritos
- **Causa raíz:** La fecha se convertía de zona horaria dos veces y dos sub-mappers escribían las mismas claves de año.
- **Fix:** 7d74953 (Hallazgo 1) + 22939de (Hallazgo 2)
- **Test de regresión:** Tests del contrato de colisiones del mapper (E14-06).

**Criterios de aceptación del fix:**

- Dado una fecha de inicio Cuando se genera Entonces se imprime sin corrimiento
- Dado ANO_INICIO_PAGO y ANO_VIGENCIA Cuando se generan Entonces conservan su valor propio

**Evidencia:** 7d74953 · 22939de

### E02-19 · Bug · Representante, acreedores por posición y bloques condicionales mal resueltos

**Estado:** Done (2026-09-26) · **Sprint:** INS 2026-W39 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** dev, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Generar un documento con representante legal y menos acreedores que posiciones
  2. Usar una plantilla con {{#if}} de dos tokens
- **Esperado:** NOMBRE*REPRESENTANTE presente, AC{n}*\* completos y el detector reconoce los bloques
- **Actual:** NOMBRE*REPRESENTANTE ausente, AC{n}*\* incompletos y falsos 'placeholders sin resolver'
- **Causa raíz:** Clave faltante (se había intentado unificar con NOMBRE_REPRESENTANTE_LEGAL), relleno de posiciones vacías incompleto y regex del detector de un solo token.
- **Fix:** d55ac1a (Hallazgo 5) + b4f4d59 (Hallazgo C) + d494d49 (Bug B)
- **Test de regresión:** Tests del detector con bloques de dos tokens.

**Criterios de aceptación del fix:**

- Dado una plantilla con {{#if X Y}} Cuando se valida la cobertura Entonces no se reporta como sin resolver
- Dado un caso con 2 acreedores Cuando una plantilla pide AC3\_\* Entonces se completan vacíos sin romper la frase

**Evidencia:** d55ac1a · b4f4d59 · d494d49

### E02-20 · Bug · El motor no reconocía {{#unless @last}} dentro de {{#each}}

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** dev, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Generar una plantilla que separa ítems con comas usando @last
- **Esperado:** Comas entre ítems y no después del último
- **Actual:** El bloque @last se ignoraba
- **Causa raíz:** handlebars-lite no implementaba @last en {{#unless}}/{{#if}}.
- **Fix:** #51 b8126f2
- **Test de regresión:** Tests de handlebars-lite con @last.

**Criterios de aceptación del fix:**

- Dado tres ítems Cuando se renderiza con @last Entonces aparecen dos separadores
- Dado un solo ítem Cuando se renderiza Entonces no aparece separador

**Evidencia:** #51 b8126f2

### E02-21 · Bug · La cobertura de placeholders contaba variables de bloque como faltantes

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** dev, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Generar un documento con {{#each}}
  2. Leer el porcentaje de cobertura
- **Esperado:** Cobertura sobre variables escalares
- **Actual:** Las variables internas del bloque bajaban la cobertura y podían bloquear la generación
- **Causa raíz:** validatePlaceholderCoverage no distinguía variables de bloque.
- **Fix:** #73 a7dc712
- **Test de regresión:** coverage-bloques.test.ts.

**Criterios de aceptación del fix:**

- Dado una plantilla con variables solo dentro de {{#each}} Cuando se mide la cobertura Entonces es 100%
- Dado una variable escalar faltante Cuando se mide Entonces sí se reporta

**Evidencia:** #73 a7dc712 · tests/unit/documents/coverage-bloques.test.ts

### E02-22 · Story · Generación automática en tres fases con un solo navegador

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend, Documentos-PDF

Como **operadora de insolvencia**, quiero que la generación al crear o admitir un caso sea más rápida, para que no se corte por el límite de tiempo de la plataforma.

**Criterios de aceptación:**

- Dado la creación de un caso (3 documentos) Cuando se genera Entonces usa un solo Chromium para todos
- Dado la admisión (6 documentos) Cuando se mide con Chromium real Entonces baja de ~3,4 s a ~2,1 s
- **(error)** Dado un documento que falla al validar Cuando se prepara Entonces no se renderiza ni se sube

**Justificación de la estimación:** Reestructura generateFromTemplates en preparar → renderizar en lote → subir, con medición real.

**Hallazgos:** GD-A1

**Evidencia:** #57 2a202f9 · docs/AUDITORIA_MODULO_GENERACION_2026-07.md P1 · CHANGELOG.md [1.0.0-rc.1] Changed

### E02-23 · Story · La Solicitud y el CYG listan todos los acreedores sin tope

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** feature · **Components:** Documentos-PDF, Backend

Como **operadora de insolvencia**, quiero que la Solicitud y el CYG Trámite incluyan a todos los acreedores del caso, para no dejar acreedores fuera de un documento que el juez revisa.

> Construido sobre la opción (1) asumida del ítem legal 5 (lista completa vs. tope con anexo).

**Criterios de aceptación:**

- Dado un caso con 15 acreedores Cuando genero la Solicitud Entonces aparecen los 15 (antes tope de 3)
- Dado el CYG Trámite Cuando hay más de 11 acreedores Entonces aparecen todos
- **(borde)** Dado un caso con un solo acreedor Cuando genero Entonces la tabla no deja filas vacías
- Dado los 264 slots numerados Cuando se retiran Entonces ninguna plantilla los referencia

**Justificación de la estimación:** Cadena de 3 PRs apilados con trampas de merge documentadas y retiro de 264 slots.

**Sub-tasks:**

- `E02-23.1` Solicitud con todos los acreedores — #77.
- `E02-23.2` CYG Trámite sin tope de 11 — #78, apilado sobre #77.
- `E02-23.3` Retirar los 264 slots numerados — #79, apilado sobre #78.

**Evidencia:** #77 ce8dcb3 · #78 a912f67 · #79 f233b24 · docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md · docs/PENDIENTES_DECISION_LEGAL.md ítem 5

### E02-24 · Story · Un oficio de suspensión por cada juzgado del caso

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Documentos-PDF

Como **operadora de insolvencia**, quiero un oficio de suspensión por cada juzgado con proceso contra el deudor, para notificar a todos los juzgados sin editar el oficio a mano.

**Criterios de aceptación:**

- Dado un caso con 3 procesos en juzgados distintos Cuando genero Entonces obtengo 3 oficios
- Dado dos procesos en el mismo juzgado Cuando genero Entonces obtengo un oficio para ese juzgado
- **(borde)** Dado un caso sin procesos Cuando genero Entonces no se produce oficio

**Evidencia:** #80 672b3c3 · tests/unit/documents/oficio-por-juzgado.test.ts

### E02-25 · Bug · Tres placeholders leían la fuente equivocada o ninguna

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** dev, octubre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Generar los documentos que usan esos 3 placeholders
- **Esperado:** Cada placeholder con el dato del campo correcto
- **Actual:** Valor de otro campo o vacío
- **Causa raíz:** Mapeo a un campo equivocado o inexistente tras la reestructuración del formulario.
- **Fix:** #104 46a196a
- **Test de regresión:** Tests de los 3 placeholders.

**Criterios de aceptación del fix:**

- Dado los 3 campos diligenciados Cuando se genera Entonces cada placeholder muestra su dato
- Dado un mapeo a campo inexistente Cuando corre la suite Entonces falla

**Evidencia:** #104 46a196a

### E02-26 · Story · Reintentos en la subida a Drive de la generación manual

**Estado:** Done (2026-10-03) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** nfr · **Components:** Backend

Como **operadora de insolvencia**, quiero que un fallo momentáneo de Drive no me haga perder la generación manual, para no repetir un paquete completo por un error de red.

**Criterios de aceptación:**

- Dado un error transitorio de Drive Cuando se sube un documento Entonces se reintenta con backoff (withRetry)
- **(error)** Dado tres fallos seguidos Cuando se agotan los reintentos Entonces el documento se marca como error y queda en el logger
- **(borde)** Dado un fallo al crear la subcarpeta Cuando se sube Entonces cae a la carpeta del caso sin reintento propio

**Evidencia:** #110 b32e892 · #86 2cc6a3c (backlog) · CLAUDE.md Fase 2 (Reintentos en la ruta manual — Resuelto)

### E02-27 · Bug · Toda fecha del formulario salía impresa un día antes

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** Producción, octubre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Registrar una fecha 15/10/2026
  2. Generar un documento que la imprime
- **Esperado:** 15 de octubre de 2026
- **Actual:** 14 de octubre de 2026
- **Causa raíz:** Las fechas de solo día se guardaban a medianoche UTC y se formateaban en hora de Colombia (UTC-5).
- **Fix:** #112 39560b3
- **Test de regresión:** Tests de formato de fecha independientes de la zona horaria del runner.

**Criterios de aceptación del fix:**

- Dado una fecha de solo día Cuando se imprime Entonces es el mismo día que se capturó
- Dado el runner en otra zona horaria Cuando corre la suite Entonces los tests de fecha pasan

**Evidencia:** #112 39560b3

### E02-28 · Bug · Las 12 causas de insolvencia de la Solicitud salían siempre en NO

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** Producción, octubre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Marcar causas de cesación en el formulario
  2. Generar la Solicitud
- **Esperado:** SI en las causas marcadas
- **Actual:** NO en las 12 causas
- **Causa raíz:** El mapper leía las causas desde una forma de dato que el formulario ya no producía.
- **Fix:** #113 f58a9f2
- **Test de regresión:** Test de las 12 causas de punta a punta (E14-08).

**Criterios de aceptación del fix:**

- Dado causas marcadas Cuando se genera la Solicitud Entonces aparecen en SI
- Dado ninguna causa marcada Cuando se genera Entonces todas en NO

**Evidencia:** #113 f58a9f2

### E02-29 · Bug · El Paquete 3 no se podía generar y el formulario del Paquete 2 fallaba

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Frontend, Documentos-PDF

- **Entorno:** Producción, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar el Paquete 3 desde /documents
  2. Completar el formulario previo del Paquete 2
- **Esperado:** Ambos paquetes se generan
- **Actual:** El Paquete 3 nunca generaba y el formulario del 2 fallaba siempre
- **Causa raíz:** Validación del formulario previo y mapeo de paquete inconsistentes con las plantillas tras cambios del caso.
- **Fix:** #118 580ddc7
- **Test de regresión:** Tests de generación de los paquetes 2 y 3.

**Criterios de aceptación del fix:**

- Dado un caso completo Cuando genero el Paquete 3 Entonces se producen sus documentos
- Dado el formulario del Paquete 2 Cuando lo envío completo Entonces no falla

**Evidencia:** #118 580ddc7

### E02-30 · Bug · Check List: Parágrafos 1 y 2 sin resolver y CONOCE_NORMA incorrecto

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** dev, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar el Check List de un caso
- **Esperado:** Parágrafos 1 y 2 con SI/NO según el caso y CONOCE_NORMA veraz
- **Actual:** Parágrafos sin resolver y CONOCE_NORMA afirmaba algo no capturado
- **Causa raíz:** Placeholders sin fuente en el formulario y un valor por defecto que afirmaba conocimiento de la norma.
- **Fix:** #119 62a4c4b
- **Test de regresión:** Tests del Check List.

> El Parágrafo 3 sigue bloqueado por decisión legal (E11-10).

**Criterios de aceptación del fix:**

- Dado un caso Cuando genero el Check List Entonces los Parágrafos 1 y 2 salen resueltos
- Dado que el dato no se capturó Cuando se genera Entonces CONOCE_NORMA no afirma nada falso

**Evidencia:** #119 62a4c4b · docs/PENDIENTES_DECISION_LEGAL.md §4

### E02-31 · Bug · Las cláusulas del Acuerdo de Apoyo desaparecían del documento

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** Producción, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Registrar un acuerdo de apoyo con cláusulas
  2. Generar el acuerdo
- **Esperado:** Las cláusulas impresas
- **Actual:** Las cláusulas no aparecían
- **Causa raíz:** El mapper de apoyo no entregaba las cláusulas en la forma que la plantilla iteraba.
- **Fix:** #120 1358728
- **Test de regresión:** Test del documento de acuerdo de apoyo con cláusulas.

**Criterios de aceptación del fix:**

- Dado un acuerdo con 3 cláusulas Cuando se genera Entonces aparecen las 3
- Dado un acuerdo sin cláusulas Cuando se genera Entonces no quedan encabezados vacíos

**Evidencia:** #120 1358728

### E02-32 · Story · Generación de lotes grandes en tandas con reintento por tanda

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** nfr, doc-semana-7 · **Components:** Backend, Frontend, Testing

Como **operadora de insolvencia**, quiero generar todos los documentos de un caso de una vez y, si una parte falla, reintentar solo esa parte, para no quedarme sin el paquete completo cuando supera el tiempo de una invocación.

**Criterios de aceptación:**

- Dado un lote de 77 documentos Cuando lo genero Entonces se divide en tandas que caben en maxDuration
- Dado la generación en curso Cuando la miro Entonces veo el progreso por tanda
- **(error)** Dado una tanda que falla Cuando la reintento Entonces solo se regenera esa tanda sin duplicar las demás
- Dado todas las tandas Cuando terminan Entonces quedan bajo una sola DocumentGenerationRequest

**Justificación de la estimación:** Rediseño a N invocaciones bajo una solicitud, reintento sin duplicar y rate limit propio.

**Hallazgos:** GD-A1

**Sub-tasks:**

- `E02-32.1` Partición del lote en tandas — Una DocumentGenerationRequest, N invocaciones.
- `E02-32.2` Reintento por tanda sin duplicar — §2.3 de la Semana 7.
- `E02-32.3` Progreso visible en la UI — Estado por tanda.

**Evidencia:** #140 376d83b · issue #3 · docs/IMPLEMENTACION_SEMANA_7.md §2 · tests/unit/documents/batch-tandas.test.ts

### E02-33 · Story · Requisitos mínimos de datos para cada plantilla de insolvencia y apoyo

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 2

**Labels:** — · **Components:** Backend, Documentos-PDF, Testing

Como **abogado del centro**, quiero que cada plantilla de insolvencia y de acuerdo de apoyo declare los datos sin los cuales no se genera, para que ninguna de las ~66 plantillas sin reglas salga incompleta.

**Criterios de aceptación:**

- **(error)** Dado una plantilla de insolvencia sin requisitos declarados Cuando se intenta generar Entonces no se genera (canGenerate false por defecto)
- Dado los requisitos declarados en la propia definición de la plantilla Cuando se renombra el archivo Entonces la validación no se desactiva
- **(borde)** Dado una plantilla de conciliación Cuando se genera Entonces no exige campos mínimos (decisión legal ítem 10)
- Dado el set de reglas Cuando corre la suite Entonces cada plantilla de insolvencia y apoyo tiene al menos una regla

**Justificación de la estimación:** Recorrer ~50 plantillas definiendo sus datos mínimos; incertidumbre de dominio por cada documento.

**Hallazgos:** GD-A2

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 (Alto) · docs/AUDITORIA_CIERRE_2026-09-12.md §4 A-6 sin cambios · src/features/document/generate-documents.ts:152,222 · docs/PENDIENTES_DECISION_LEGAL.md ítem 10

### E02-34 · Task (spike) · Definir con los centros la política de versiones al regenerar un documento

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 3

**Labels:** spike, legal-pendiente · **Components:** Documentos-PDF

- **Objetivo:** Decidir qué pasa con un documento ya generado (y quizás radicado) cuando se vuelve a generar.
- **Alcance:** Opciones: archivar en 04-Historial con supersededById, bloquear la regeneración de documentos radicados, o ambas. Consulta con la abogada y los dos centros.
- **Definición de terminado:** Decisión escrita en docs/PENDIENTES_DECISION_LEGAL.md y criterios de E02-35 ajustados.

**Criterios de aceptación:**

- Dado las opciones documentadas Cuando los centros responden Entonces la decisión queda registrada con fecha
- Dado la decisión Cuando se refina E02-35 Entonces sus criterios la reflejan

**Hallazgos:** GD-A3

**Dependencias:** blocks E02-35

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §6 (requiere decidir la política de versionado con los centros)

### E02-35 · Story · Regenerar un documento sin duplicarlo en Drive ni en la base

**Estado:** To Do · **Sprint:** INS 2026-W47 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 18

**Labels:** — · **Components:** Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero que al regenerar un documento la versión anterior quede archivada y la vigente sea una sola, para no tener dos 'Solicitud de Insolvencia.pdf' distintas en el expediente.

> Movido de v1.1.0 a v1.0 (2026-10-21): hallazgo Alto sin razón documentada para postergarlo (la anterior era de capacidad). Solo puede volver a v1.1.0 si E02-34 decide por escrito que un documento radicado nunca se regenera; esa decisión sería el riesgo bajo comprobado que hoy falta.

**Criterios de aceptación:**

- Dado un documento ya generado Cuando lo regenero Entonces la versión anterior pasa a 04-Historial con supersededById
- Dado persistGeneratedDocuments Cuando crea filas Entonces guarda templateId
- **(error)** Dado un fallo al archivar en Drive Cuando se regenera Entonces la nueva versión se guarda y el fallo queda en Sentry
- Dado la ruta manual en tandas Cuando regenera Entonces aplica el mismo archivado

**Justificación de la estimación:** Cablear código muerto (archiveSupersededDocument) en dos rutas más persistir templateId.

**Hallazgos:** GD-A3

**Dependencias:** is blocked by E02-34

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 (Alto) · docs/AUDITORIA_CIERRE_2026-09-12.md §4 A-7 sin cambios · src/features/document/storage-helpers.ts:33 (sin consumidores)

### E02-36 · Story · Ver el estado de la generación en segundo plano desde el caso

**Estado:** To Do · **Sprint:** INS 2026-W47 · **Versión:** v1.0.0 · **Prioridad:** Media · **Estimación:** 3 pts · **MoSCoW:** Should · **Rank:** 29

**Labels:** — · **Components:** Frontend

Como **operadora de insolvencia**, quiero ver en el caso si sus documentos se están generando, terminaron o fallaron, para enterarme de una generación colgada sin depender solo de la notificación.

**Criterios de aceptación:**

- Dado una generación en PROCESSING Cuando abro la sección de documentos Entonces veo el estado y se actualiza solo
- Dado una generación FAILED o COMPLETED_WITH_ERRORS Cuando la veo Entonces se muestra el detalle y cómo reintentar
- **(borde)** Dado un caso sin solicitudes Cuando abro la sección Entonces no se hace polling

**Hallazgos:** GD-M2, PP-B-4

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 (Medio) · CLAUDE.md Quick Win 4 · grep getGenerationRequestStatus en src/app: 0 consumidores (2026-10-21)

### E02-37 · Bug · Consultas de diagnóstico de plantillas sin filtro de centro volcadas a los logs

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Media · **Estimación:** sin puntos (trivial) · **MoSCoW:** Should · **Rank:** 26

**Labels:** seguridad · **Components:** Backend

- **Entorno:** Producción actual
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Abrir /documents
  2. Revisar los Runtime Logs de Vercel
- **Esperado:** Ningún dato de otro centro en los logs
- **Actual:** Conteos y nombres de plantillas de todos los tenants por console.log
- **Causa raíz:** documentTemplate.count() y findMany sin tenantId (document/actions.ts:316-330), con console.log.
- **Fix:** Pendiente: añadir tenantId o eliminar las consultas de diagnóstico; migrar a logger.debug.
- **Test de regresión:** Test de que la acción no consulta plantillas sin tenantId.

**Criterios de aceptación del fix:**

- Dado la acción de diagnóstico Cuando corre Entonces filtra por tenantId o no existe
- Dado producción Cuando se abre /documents Entonces no se escriben conteos de plantillas en consola

**Hallazgos:** GD-M5

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 (Medio) · src/features/document/actions.ts:316-330

---

<a id="e03"></a>

## E03 — Autenticación y Seguridad

JWT propio (jose, HS256, cookies httpOnly), RBAC por permisos, middleware con allowlist de rutas públicas, rate limiting distribuido (Upstash), revocación de sesiones, control de acceso por fila en mutaciones y auditoría de acciones críticas.

**Objetivo de negocio:** Que ningún usuario vea ni modifique expedientes que no le corresponden, dentro de su centro o entre centros, y que todo cambio sobre un expediente legal quede registrado.

**Evidencia:** src/features/auth/ · src/middleware.ts · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md §3.2 · docs/IMPLEMENTACION_SEMANA_1.md · docs/IMPLEMENTACION_SEMANA_4.md

| ID     | Tipo         | Título                                                                                    | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ----------------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E03-01 | Story        | Inicio de sesión, recuperación de contraseña y roles con permisos                         |   8 | Done   | 2026-W06 | v0.1.0      |
| E03-02 | Task         | Actualizar Next.js 15.5.5 a 15.5.12 por vulnerabilidad                                    |   1 | Done   | 2026-W10 | v0.1.0      |
| E03-03 | Story        | Endurecimiento de seguridad de la aplicación con 90 pruebas                               |   5 | Done   | 2026-W10 | v0.1.0      |
| E03-04 | Story        | Política de contraseñas y permisos por ruta                                               |   3 | Done   | 2026-W12 | v0.2.0      |
| E03-05 | Story        | Permisos con tipos verificados por el compilador                                          |   5 | Done   | 2026-W12 | v0.2.0      |
| E03-06 | Story        | Registro de auditoría inmutable con trazabilidad por cédula                               |   5 | Done   | 2026-W12 | v0.2.0      |
| E03-07 | Story        | Auditoría técnica: logs de auditoría, paginación e índices                                |   5 | Done   | 2026-W14 | v0.2.0      |
| E03-08 | Story        | Endurecimiento de seguridad y calidad de abril                                            |   3 | Done   | 2026-W15 | v0.2.0      |
| E03-09 | Story        | Refresh token de 7 días y cambio de contraseña forzado en todo el flujo                   |   3 | Done   | 2026-W16 | v0.2.0      |
| E03-10 | Task         | Cerrar 23 de las 27 vulnerabilidades de dependencias                                      |   1 | Done   | 2026-W28 | v0.4.0      |
| E03-11 | Bug          | El middleware trataba todas las rutas como públicas                                       |   3 | Done   | 2026-W35 | v0.5.0      |
| E03-12 | Bug          | Cualquiera podía registrarse con el correo de un deudor y ver su expediente               |   2 | Done   | 2026-W35 | v0.5.0      |
| E03-13 | Bug          | Login y refresh devolvían los JWT también en el cuerpo de la respuesta                    |   1 | Done   | 2026-W35 | v0.5.0      |
| E03-14 | Task         | Actualizar Next.js a 15.5.24 para cerrar CVEs altas                                       |   1 | Done   | 2026-W35 | v0.5.0      |
| E03-15 | Bug          | Seis páginas sin protección del lado del servidor                                         |   2 | Done   | 2026-W35 | v0.5.0      |
| E03-16 | Story        | Límite de intentos de login y recuperación efectivo en serverless                         |   5 | Done   | 2026-W35 | v0.5.0      |
| E03-17 | Bug          | El campo de correo del login no era de tipo email                                         |   — | Done   | 2026-W37 | v0.5.0      |
| E03-18 | Bug          | Las redirecciones esperadas de la sesión se registraban como errores o como éxitos falsos |   3 | Done   | 2026-W38 | v0.6.0      |
| E03-19 | Bug          | El identificador de petición x-request-id lo podía fijar el cliente                       |   1 | Done   | 2026-W38 | v0.6.0      |
| E03-20 | Bug          | La generación manual cargaba el hash de la contraseña del operador                        |   2 | Done   | 2026-W40 | v0.6.0      |
| E03-21 | Bug          | Aviso falso de que la sesión llevaba más de 30 segundos cargando                          |   2 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E03-22 | Bug          | La búsqueda global exponía los datos personales de todos los deudores del centro          |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-23 | Bug          | Un rol limitado a sus casos podía editar, generar y reportar sobre cualquier expediente   |   8 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-24 | Story        | Confirmar por escrito y auditar antes de eliminar un expediente                           |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-25 | Story        | La auditoría espera su escritura y registra qué campos cambiaron                          |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-26 | Bug          | Se podía asignar a un caso un operador de otro centro                                     |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-27 | Story        | Límite de creación de casos por usuario                                                   |   1 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-28 | Task         | Actualizar nodemailer y aplicar npm audit fix sin cambios rompientes                      |   1 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-29 | Story        | Cerrar las sesiones abiertas al cambiar la contraseña o por orden del administrador       |   5 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E03-30 | Task         | Verificar en producción que ningún rol quedó sin permiso de alcance                       |   1 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E03-31 | Task (spike) | Calibrar el límite de creación de casos con el uso real                                   |   1 | To Do  | Backlog  | v1.1.0      |
| E03-32 | Story        | Política de seguridad de contenido sin unsafe-inline ni unsafe-eval                       |   5 | To Do  | Backlog  | v1.1.0      |
| E03-33 | Task         | Limpiar tokens de recuperación vencidos e indexar por correo                              |   1 | To Do  | Backlog  | v1.1.0      |

### E03-01 · Story · Inicio de sesión, recuperación de contraseña y roles con permisos

**Estado:** Done (2026-02-08) · **Sprint:** INS 2026-W06 · **Versión:** v0.1.0 · **Prioridad:** Crítica · **Estimación:** 8 pts

**Labels:** seguridad, feature · **Components:** Frontend, Backend, Base-de-Datos

Como **administrador del centro**, quiero que cada persona entre con su cuenta y vea solo lo que su rol permite, para proteger datos personales y financieros de los deudores.

**Criterios de aceptación:**

- Dado credenciales válidas Cuando inicio sesión Entonces recibo una sesión en cookie httpOnly
- **(error)** Dado una contraseña incorrecta Cuando inicio sesión Entonces veo un error genérico
- Dado un rol sin permiso de eliminar casos Cuando abro un caso Entonces no veo la acción de eliminar
- **(borde)** Dado una sesión inactiva Cuando vence el tiempo Entonces se cierra sola

**Justificación de la estimación:** Auth propio completo (login, registro, reset, timeout) con 6 roles y 30+ permisos.

**Sub-tasks:**

- `E03-01.1` JWT con jose y cookies httpOnly — Access y refresh token.
- `E03-01.2` Roles y permisos en base — Role, Permission, RolePermission y seed.
- `E03-01.3` Recuperación de contraseña — PasswordResetToken + email.

**Evidencia:** 83d2d71 · 72493d9 fix: corregir bugs de autenticación y limpiar schema · CHANGELOG.md [0.1.0] Authentication module

### E03-02 · Task · Actualizar Next.js 15.5.5 a 15.5.12 por vulnerabilidad

**Estado:** Done (2026-03-02) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 1 pts

**Labels:** seguridad · **Components:** Infra-CI/CD

- **Objetivo:** Cerrar la CVE conocida de Next.js.
- **Alcance:** Bump de patch y build.
- **Definición de terminado:** Build verde y versión desplegada.

**Criterios de aceptación:**

- Dado el package.json Cuando se instala Entonces Next es 15.5.12 y el build pasa

**Evidencia:** 754db52 fix: actualizar Next.js 15.5.5 -> 15.5.12 (CVE vulnerabilidad)

### E03-03 · Story · Endurecimiento de seguridad de la aplicación con 90 pruebas

**Estado:** Done (2026-03-04) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** seguridad, nfr · **Components:** Backend, Testing

Como **administrador del centro**, quiero que la aplicación resista los ataques web comunes, para poder usarla con datos de casos reales.

**Criterios de aceptación:**

- Dado cualquier respuesta Cuando se inspeccionan los headers Entonces incluye CSP, HSTS y X-Frame-Options
- **(error)** Dado un archivo con MIME no permitido o mayor a 10 MB Cuando se sube Entonces se rechaza
- Dado entradas con HTML Cuando se guardan Entonces se sanean
- Dado la suite de seguridad Cuando corre Entonces pasan sus 90 tests

**Justificación de la estimación:** Varias defensas transversales (headers, upload, sanitización, CSRF) con su batería de tests.

**Evidencia:** abfc674 security: auditoría completa + hardening + 90 tests de seguridad · CHANGELOG.md [0.1.0] Security hardening

### E03-04 · Story · Política de contraseñas y permisos por ruta

**Estado:** Done (2026-03-16) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** seguridad · **Components:** Frontend, Backend

Como **administrador del centro**, quiero contraseñas robustas y que cada pantalla exija su permiso, para que una cuenta débil o un rol limitado no abran pantallas ajenas.

**Criterios de aceptación:**

- **(error)** Dado una contraseña que no cumple la política Cuando la cambio Entonces se rechaza con el motivo
- Dado un rol sin permiso de auditoría Cuando entra a /audit-log Entonces es redirigido
- Dado un rol con el permiso Cuando entra Entonces ve la pantalla

**Evidencia:** 4d9d3b7 feat: ... validación contraseñas y permisos por ruta

### E03-05 · Story · Permisos con tipos verificados por el compilador

**Estado:** Done (2026-03-17) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** seguridad · **Components:** Frontend, Backend

Como **administrador del centro**, quiero crear roles eligiendo permisos de una lista cerrada, para que un permiso mal escrito no deje una acción sin proteger.

**Criterios de aceptación:**

- Dado el catálogo P.\* Cuando se usa un permiso inexistente en el código Entonces no compila
- Dado la pantalla de roles Cuando creo uno Entonces elijo permisos por módulo y acción
- **(error)** Dado un usuario sin permiso Cuando llama la server action Entonces se rechaza aunque la UI la oculte

**Justificación de la estimación:** Rediseño del RBAC en toda la app con autorización completa.

**Evidencia:** eaf4df4 feat: rediseño RBAC — permisos type-safe, autorización completa y UX mejorada

### E03-06 · Story · Registro de auditoría inmutable con trazabilidad por cédula

**Estado:** Done (2026-03-19) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend, Frontend, Base-de-Datos

Como **abogado del centro**, quiero consultar quién creó, editó o eliminó un expediente y cuándo, para reconstruir los hechos ante una disputa sobre el trámite.

**Criterios de aceptación:**

- Dado una creación, edición, eliminación o login Cuando ocurre Entonces queda una entrada en audit_logs
- **(error)** Dado una entrada de auditoría Cuando alguien intenta modificarla desde la app Entonces no hay acción que lo permita
- Dado un deudor Cuando filtro por su cédula Entonces veo las acciones sobre sus expedientes

**Justificación de la estimación:** Modelo, escritura en todas las mutaciones y pantalla de consulta.

**Evidencia:** 6323d88 feat: sistema de auditoría inmutable, trazabilidad con cédula, perfil de usuario

### E03-07 · Story · Auditoría técnica: logs de auditoría, paginación e índices

**Estado:** Done (2026-03-30) · **Sprint:** INS 2026-W14 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend, Base-de-Datos

Como **administrador del centro**, quiero que los listados grandes paginen y que las acciones sensibles queden auditadas, para que el sistema siga respondiendo con cientos de casos y deje rastro.

**Criterios de aceptación:**

- Dado más de una página de casos Cuando abro el listado Entonces se pagina en el servidor
- Dado consultas frecuentes por tenant Cuando corren Entonces usan índices
- **(borde)** Dado la última página Cuando avanzo Entonces no hay error

**Justificación de la estimación:** Cambios transversales de seguridad, paginación, Drive e índices en un solo lote.

**Evidencia:** dc8115b feat: auditoría técnica — seguridad, audit logs, paginación, Google Drive, índices DB

### E03-08 · Story · Endurecimiento de seguridad y calidad de abril

**Estado:** Done (2026-04-12) · **Sprint:** INS 2026-W15 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** seguridad, inferido · **Components:** Backend

Como **administrador del centro**, quiero que se corrijan los hallazgos de la auditoría integral de abril, para llegar a la primera entrega sin agujeros conocidos.

> El detalle de qué hallazgos se cerraron no está documentado fuera del commit.

**Criterios de aceptación:**

- Dado los hallazgos de abril Cuando se corrigen Entonces cada uno tiene su cambio en el commit
- Dado la suite Cuando corre Entonces pasa completa
- **(error)** Dado una entrada maliciosa en las rutas corregidas Cuando se envía Entonces se rechaza

**Evidencia:** dfdaae6 fix(security): auditoría integral — hardening de seguridad y calidad

### E03-09 · Story · Refresh token de 7 días y cambio de contraseña forzado en todo el flujo

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** seguridad · **Components:** Backend

Como **administrador del centro**, quiero que una cuenta con contraseña provisional no pueda operar hasta cambiarla, ni siquiera renovando la sesión, para que las cuentas sembradas no queden con su clave inicial.

**Criterios de aceptación:**

- Dado mustChangePassword en true Cuando se renueva la sesión Entonces se exige el cambio
- Dado mustChangePassword en true Cuando se cambia de centro Entonces se exige el cambio
- **(borde)** Dado un refresh token de 8 días Cuando se usa Entonces se rechaza (vence a los 7)

**Evidencia:** CHANGELOG.md [0.2.0] Refresh token security hardening, mustChangePassword enforcement

### E03-10 · Task · Cerrar 23 de las 27 vulnerabilidades de dependencias

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** seguridad · **Components:** Infra-CI/CD

- **Objetivo:** Reducir la superficie de vulnerabilidades conocidas.
- **Alcance:** npm audit fix sin --force.
- **Definición de terminado:** 27 → 4 moderadas; build y suite verdes.

**Criterios de aceptación:**

- Dado npm audit Cuando corre Entonces quedan 4 moderadas y ninguna alta

**Evidencia:** 1480f16 chore(deps): npm audit fix — 27 vulnerabilidades → 4 moderate

### E03-11 · Bug · El middleware trataba todas las rutas como públicas

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** seguridad, doc-semana-1 · **Components:** Backend, Testing

- **Entorno:** Producción hasta agosto 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Sin sesión, abrir /dashboard o /cases
- **Esperado:** Redirección a /login
- **Actual:** Ninguna redirección: la protección de rutas y el RBAC por ruta nunca se ejecutaban
- **Causa raíz:** publicRoutes incluía '/' y se comparaba con startsWith, así que toda ruta coincidía como pública.
- **Fix:** bfdeb47: matching exacto (pathname === route || startsWith(route + '/')), lazy-init de JWT_SECRET y retiro de headers x-user-\* sin consumidores
- **Test de regresión:** tests/security/middleware-auth-gate.test.ts (25 tests).

**Criterios de aceptación del fix:**

- **(error)** Dado una ruta protegida sin cookie Cuando se pide Entonces redirige a /login?redirect=…
- Dado un usuario sin el permiso de /audit-log Cuando entra Entonces va a /dashboard

**Hallazgos:** PP-C-1

**Evidencia:** bfdeb47 · docs/IMPLEMENTACION_SEMANA_1.md §1 · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md C-1

### E03-12 · Bug · Cualquiera podía registrarse con el correo de un deudor y ver su expediente

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 2 pts

**Labels:** seguridad, doc-semana-1 · **Components:** Backend, Frontend

- **Entorno:** Producción hasta agosto 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Registrarse en /register con el correo de un deudor real
  2. Iniciar sesión
- **Esperado:** El registro no está abierto al público
- **Actual:** La cuenta queda vinculada por email al Debtor y ve caso, deudas y documentos
- **Causa raíz:** Registro abierto sin verificación de email combinado con la identidad user.email → Debtor.email.
- **Fix:** 9e037be: cerrar el registro público autoservicio (opción a de la auditoría)
- **Test de regresión:** Test de que /register no crea cuentas; E2E alineado (#15).

**Criterios de aceptación del fix:**

- **(error)** Dado un visitante Cuando intenta registrarse Entonces no se crea la cuenta
- Dado un administrador Cuando crea un usuario desde /users Entonces sí se crea

**Hallazgos:** PP-C-2

**Evidencia:** 9e037be · docs/IMPLEMENTACION_SEMANA_1.md · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md C-2

### E03-13 · Bug · Login y refresh devolvían los JWT también en el cuerpo de la respuesta

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 1 pts

**Labels:** seguridad, doc-semana-1 · **Components:** Backend

- **Entorno:** Producción hasta agosto 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Iniciar sesión
  2. Inspeccionar el cuerpo de la respuesta
- **Esperado:** Tokens solo en cookies httpOnly
- **Actual:** Tokens en el body, accesibles desde JavaScript
- **Causa raíz:** loginUser/refreshAccessToken retornaban los tokens además de setear las cookies.
- **Fix:** a9a1e4d
- **Test de regresión:** Test de que el body no contiene accessToken ni refreshToken.

**Criterios de aceptación del fix:**

- Dado un login exitoso Cuando se lee el body Entonces no contiene tokens
- Dado un refresh Cuando se lee el body Entonces no contiene tokens

**Hallazgos:** PP-A-3

**Evidencia:** a9a1e4d · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md A-3

### E03-14 · Task · Actualizar Next.js a 15.5.24 para cerrar CVEs altas

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 1 pts

**Labels:** seguridad, doc-semana-1 · **Components:** Infra-CI/CD

- **Objetivo:** Eliminar los CVEs high de Next 15.5.20 (DoS en Server Actions, cache confusion).
- **Alcance:** npm audit fix + bump de patch.
- **Definición de terminado:** Suite completa verde y sin CVEs high.

**Criterios de aceptación:**

- Dado npm audit Cuando corre Entonces no reporta CVEs high de Next

**Hallazgos:** PP-A-1

**Evidencia:** c507501 · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md A-1

### E03-15 · Bug · Seis páginas sin protección del lado del servidor

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** seguridad, doc-semana-1 · **Components:** Frontend, Backend

- **Entorno:** Producción hasta agosto 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Sin permiso, abrir /documents, /reports, /audit-log, /calendar, /notifications o /profile
- **Esperado:** La página verifica sesión y permiso en el servidor
- **Actual:** Dependían solo del middleware (que además estaba roto, E03-11)
- **Causa raíz:** Las 6 páginas no tenían guard server-side propio.
- **Fix:** c588830
- **Test de regresión:** Tests de guard por página.

**Criterios de aceptación del fix:**

- **(error)** Dado un usuario sin permiso Cuando abre cualquiera de las 6 páginas Entonces es redirigido
- Dado el middleware deshabilitado en un test Cuando se pide la página Entonces el guard propio sigue protegiendo

**Hallazgos:** PP-M-9

**Evidencia:** c588830 · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-9

### E03-16 · Story · Límite de intentos de login y recuperación efectivo en serverless

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** seguridad, nfr, doc-semana-2 · **Components:** Backend, Infra-CI/CD

Como **administrador del centro**, quiero que el límite de intentos de login se comparta entre todas las instancias, para frenar ataques de fuerza bruta contra las cuentas del centro.

> Queda pendiente verificar que Upstash esté configurado en producción (E09-17, G-B1).

**Criterios de aceptación:**

- Dado 5 intentos fallidos desde una IP Cuando llega el sexto a otra instancia Entonces también se rechaza
- **(error)** Dado Upstash caído o sin configurar Cuando se intenta login Entonces degrada a límite en memoria y registra un warn
- Dado el entorno de test Cuando corre E2E Entonces el límite no bloquea la suite

**Justificación de la estimación:** Dependencia externa nueva (Upstash) con degradación explícita y cambios en auth.

**Hallazgos:** PP-A-2

**Evidencia:** 8a8a1ae feat(security): rate limiting distribuido con Upstash Redis (A-2) · docs/IMPLEMENTACION_SEMANA_2.md §1 · src/lib/rate-limit.ts

### E03-17 · Bug · El campo de correo del login no era de tipo email

**Estado:** Done (2026-09-10) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Baja · **Estimación:** sin puntos (trivial)

**Labels:** — · **Components:** Frontend

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Abrir /login en un móvil
- **Esperado:** Teclado de correo y validación nativa
- **Actual:** Input de texto genérico
- **Causa raíz:** type="text" en el input.
- **Fix:** #11 767bd32
- **Test de regresión:** Ninguno específico.

**Criterios de aceptación del fix:**

- Dado el formulario de login Cuando se renderiza Entonces el input de correo es type email
- Dado un correo mal formado Cuando se envía Entonces el navegador lo señala

**Evidencia:** #11 767bd32

### E03-18 · Bug · Las redirecciones esperadas de la sesión se registraban como errores o como éxitos falsos

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Frontend

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Cambiar de centro
  2. Cerrar sesión
  3. Revisar logs y estado del hook useAuth
- **Esperado:** El redirect exitoso no es un error; un fallo real no se reporta como éxito
- **Actual:** NEXT_REDIRECT se registraba como error en Sentry y switchTenant reportaba éxito en fallos reales
- **Causa raíz:** Next.js señaliza un redirect lanzando una excepción especial; se distinguía por message en vez de por digest.
- **Fix:** db3ff42, 70837ef, 2e8ebac, ec4f5b0, f3046cc, 9499b35 (issue #9) + d03da4f (isNextRedirectError compartido)
- **Test de regresión:** Tests de useAuth para switchDatabase, switchTenant y logout.

**Criterios de aceptación del fix:**

- Dado un cambio de centro exitoso Cuando redirige Entonces no se registra error
- **(error)** Dado un fallo real al cambiar de centro Cuando ocurre Entonces se reporta como fallo

**Evidencia:** issue #9 · db3ff42 · 9499b35 · d03da4f · docs/CHECKPOINT_2026-09-28.md

### E03-19 · Bug · El identificador de petición x-request-id lo podía fijar el cliente

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** seguridad · **Components:** Backend

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Enviar una petición con un x-request-id inventado
  2. Buscarlo en los logs
- **Esperado:** El servidor genera siempre su propio id
- **Actual:** Se aceptaba el valor del cliente, permitiendo contaminar la correlación de logs
- **Causa raíz:** El middleware reusaba el header entrante.
- **Fix:** 308f508
- **Test de regresión:** Test del middleware: el id de respuesta no es el enviado.

**Criterios de aceptación del fix:**

- Dado una petición con x-request-id Cuando se procesa Entonces el id de respuesta es nuevo
- Dado una petición sin el header Cuando se procesa Entonces se genera uno

**Evidencia:** 308f508 fix(seguridad): el x-request-id lo emite siempre el servidor

### E03-20 · Bug · La generación manual cargaba el hash de la contraseña del operador

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** seguridad · **Components:** Backend

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar documentos desde /documents
- **Esperado:** Solo los campos del operador que usan las plantillas
- **Actual:** include operator: true traía el hash de la contraseña a memoria de la generación
- **Causa raíz:** Include completo de la relación en vez de un select acotado.
- **Fix:** #54 025ead2
- **Test de regresión:** Test de que la consulta no selecciona password.

**Criterios de aceptación del fix:**

- Dado batchGenerateDocuments Cuando consulta el operador Entonces no selecciona password
- Dado las plantillas Cuando se generan Entonces siguen teniendo nombre y tarjeta del operador

**Evidencia:** #54 025ead2

### E03-21 · Bug · Aviso falso de que la sesión llevaba más de 30 segundos cargando

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend

- **Entorno:** Producción, octubre 2026
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Dejar la app abierta en una pestaña en segundo plano
  2. Volver
- **Esperado:** Sin aviso si la sesión cargó
- **Actual:** Se registraba 'useAuth loading for over 30 seconds'
- **Causa raíz:** El temporizador no se limpiaba al resolver el estado de carga (falso positivo).
- **Fix:** #123 33ec217
- **Test de regresión:** Test del hook con temporizadores simulados.

**Criterios de aceptación del fix:**

- Dado una sesión que carga en 1 s Cuando pasan 30 s Entonces no se registra el aviso
- Dado una carga realmente colgada Cuando pasan 30 s Entonces sí se registra

**Evidencia:** #123 33ec217

### E03-22 · Bug · La búsqueda global exponía los datos personales de todos los deudores del centro

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Backend, Testing

- **Entorno:** Producción hasta octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Iniciar sesión con el rol Usuario (cliente)
  2. Escribir dos letras en la barra de búsqueda
- **Esperado:** Solo resultados de sus propios expedientes
- **Actual:** Nombre, cédula y correo de todos los deudores y acreedores del centro
- **Causa raíz:** globalSearch solo llamaba authenticateUser(): sin permiso P.\* ni scoping por rol. Única acción del sistema sin check de permisos.
- **Fix:** #137 7d46fff
- **Test de regresión:** Tests de globalSearch por rol.

**Criterios de aceptación del fix:**

- **(error)** Dado un usuario sin permiso de ver casos Cuando busca Entonces no obtiene resultados
- Dado el rol cliente Cuando busca Entonces solo ve sus expedientes

**Hallazgos:** G-A1

**Evidencia:** #137 7ab6b5e (7d46fff) · docs/IMPLEMENTACION_SEMANA_4.md §2.1 · docs/AUDITORIA_CIERRE_2026-09-12.md §4 A-9

### E03-23 · Bug · Un rol limitado a sus casos podía editar, generar y reportar sobre cualquier expediente

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 8 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Backend, Testing

- **Entorno:** Producción hasta octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Con rol Abogado (VER_CASOS_PROPIOS), obtener el id de un caso ajeno
  2. Llamar updateCase, deleteCase, updateCasePhase o generar sus documentos
  3. Abrir /reports
- **Esperado:** Rechazo por falta de acceso al expediente
- **Actual:** La mutación se ejecuta; reportes muestran todos los casos del centro
- **Causa raíz:** El chequeo de visibilidad por fila de getCaseById no se replicaba en 15 mutaciones, en las 4 acciones de generación ni en reportes.
- **Fix:** #137 6b36d84: assertCaseAccess en las 15 mutaciones, generación y reportes (fail closed)
- **Test de regresión:** tests/unit/security/case-mutations-row-access.test.ts.

**Criterios de aceptación del fix:**

- **(error)** Dado un caso ajeno Cuando un rol limitado llama cualquiera de las 15 mutaciones Entonces se rechaza
- Dado un rol limitado Cuando abre reportes Entonces solo agrega sus casos
- Dado un rol sin ningún permiso de alcance Cuando intenta editar Entonces se rechaza (fail closed)

**Justificación de la estimación:** 15 mutaciones (no 7 del encargo) + generación + reportes, con riesgo de romper roles creados a mano.

**Hallazgos:** GC-A1, GD-M4, GC-M5, CIERRE-5.2

**Sub-tasks:**

- `E03-23.1` assertCaseAccess en las 15 mutaciones de caso — Incluye add/remove de deudas, bienes, libranzas, servicios y apoderados.
- `E03-23.2` Guard de fila en las 4 acciones de generación — GD-M4.
- `E03-23.3` Scoping por rol en reportes — GC-M5 / Cierre §5.2.

**Evidencia:** #137 7ab6b5e (6b36d84) · docs/IMPLEMENTACION_SEMANA_4.md §2.2 y §4.1 · docs/AUDITORIA_CIERRE_2026-09-12.md §5.2

### E03-24 · Story · Confirmar por escrito y auditar antes de eliminar un expediente

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Frontend, Backend

Como **administrador del centro**, quiero tener que escribir el número del expediente para eliminarlo y que la acción quede auditada antes de ejecutarse, para evitar borrados accidentales de expedientes legales irrecuperables.

> Mitigación interina. El borrado lógico queda en E01-40..E01-42.

**Criterios de aceptación:**

- **(error)** Dado un número de confirmación distinto Cuando intento eliminar Entonces no se elimina
- Dado la confirmación correcta Cuando elimino Entonces la entrada de auditoría se escribe antes del borrado
- **(error)** Dado un fallo al escribir la auditoría Cuando elimino Entonces el expediente no se borra

**Hallazgos:** GC-M6, PP-A-8

**Evidencia:** #137 (b5062ed) · docs/IMPLEMENTACION_SEMANA_4.md §2.3

### E03-25 · Story · La auditoría espera su escritura y registra qué campos cambiaron

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** nfr, doc-semana-4 · **Components:** Backend

Como **abogado del centro**, quiero que el registro de una edición diga qué campos cambiaron y que no se pierda, para reconstruir qué se modificó en un expediente en disputa.

**Criterios de aceptación:**

- Dado una edición de caso Cuando se audita Entonces metadata incluye el diff de campos
- Dado Vercel congelando la función Cuando se responde Entonces el insert de auditoría ya terminó
- **(error)** Dado un fallo de auditoría en una alta Cuando ocurre Entonces la operación sigue y el fallo llega a Sentry

**Hallazgos:** GC-M4, CIERRE-5.3

**Evidencia:** #137 (ad608e5) · docs/IMPLEMENTACION_SEMANA_4.md §2.4 y §4.2 · docs/AUDITORIA_CIERRE_2026-09-12.md §5.3

### E03-26 · Bug · Se podía asignar a un caso un operador de otro centro

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Backend

- **Entorno:** Producción hasta octubre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Enviar updateCase con el operatorId de un usuario de Constructores de Paz sobre un caso de Armonía
- **Esperado:** Rechazo
- **Actual:** El caso queda asignado y el nombre del operador ajeno se imprime en documentos
- **Causa raíz:** operatorId se validaba solo como z.string() y se conectaba sin verificar el tenant.
- **Fix:** #137 fc3e555
- **Test de regresión:** Test de asignación cruzada.

**Criterios de aceptación del fix:**

- **(error)** Dado un operador de otro centro Cuando se asigna Entonces se rechaza
- Dado un operador del mismo centro Cuando se asigna Entonces se guarda

**Hallazgos:** GC-M2

**Evidencia:** #137 (fc3e555) · docs/IMPLEMENTACION_SEMANA_4.md §2.5

### E03-27 · Story · Límite de creación de casos por usuario

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Baja · **Estimación:** 1 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Backend

Como **administrador del centro**, quiero que un usuario no pueda crear casos en bucle, para proteger la cuota de Drive y el presupuesto de ejecución, ya que cada caso dispara la generación de PDFs.

**Criterios de aceptación:**

- Dado 10 casos creados por un usuario en 10 minutos Cuando intenta el undécimo Entonces se rechaza con mensaje
- **(borde)** Dado la suite test:db Cuando crea muchos casos Entonces el limitador se reinicia en beforeEach
- Dado otro usuario Cuando crea casos Entonces su límite es independiente

**Hallazgos:** GC-B2

**Evidencia:** #137 (deea49e) · docs/IMPLEMENTACION_SEMANA_4.md §2.6 y §5.3

### E03-28 · Task · Actualizar nodemailer y aplicar npm audit fix sin cambios rompientes

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** seguridad, doc-semana-4 · **Components:** Infra-CI/CD

- **Objetivo:** Cerrar vulnerabilidades de nodemailer.
- **Alcance:** Bump + npm audit fix no-breaking.
- **Definición de terminado:** Suite y build verdes.

**Criterios de aceptación:**

- Dado npm audit Cuando corre Entonces nodemailer no aparece vulnerable

**Evidencia:** #137 (4ddb5cd) · docs/IMPLEMENTACION_SEMANA_4.md §2.7

### E03-29 · Story · Cerrar las sesiones abiertas al cambiar la contraseña o por orden del administrador

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** seguridad, doc-semana-7 · **Components:** Backend, Base-de-Datos

Como **administrador del centro**, quiero que un cambio de contraseña o un cierre forzado invalide las sesiones abiertas en otros dispositivos, para poder sacar de inmediato a alguien que no debe seguir entrando.

**Criterios de aceptación:**

- Dado una sesión abierta en otro equipo Cuando cambio mi contraseña Entonces esa sesión deja de funcionar en su siguiente petición
- Dado un usuario Cuando el administrador fuerza su cierre de sesión Entonces todos sus tokens vigentes se rechazan
- **(borde)** Dado un token emitido justo después del cambio Cuando se usa Entonces sigue siendo válido

**Justificación de la estimación:** Marca de revocación en User y verificación en authenticateUser en cada petición.

**Hallazgos:** PP-A-6

**Evidencia:** #140 376d83b · docs/IMPLEMENTACION_SEMANA_7.md §3 · CHANGELOG.md [1.0.0-rc.1] Revocación de sesiones

### E03-30 · Task · Verificar en producción que ningún rol quedó sin permiso de alcance

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 1 pts · **MoSCoW:** Must · **Rank:** 4

**Labels:** seguridad · **Components:** Base-de-Datos

- **Objetivo:** Confirmar que el guard de fila (fail closed) no le quitó la edición a un rol creado a mano.
- **Alcance:** Correr scripts/verificar-roles-sin-alcance.sql (solo lectura) contra Neon producción y corregir los roles que aparezcan.
- **Definición de terminado:** Resultado registrado en docs; 0 roles con Editar/Eliminar/Generar/Ver documentos/Ver reportes sin permiso de alcance.

**Criterios de aceptación:**

- Dado la consulta Cuando se corre en producción Entonces el resultado queda documentado
- **(error)** Dado un rol sin alcance Cuando aparece Entonces se le asigna el permiso de alcance correcto con aprobación del centro

**Evidencia:** docs/IMPLEMENTACION_SEMANA_4.md §5.1 y §6 decisión 4 · scripts/verificar-roles-sin-alcance.sql (sin commitear)

### E03-31 · Task (spike) · Calibrar el límite de creación de casos con el uso real

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Could · **Rank:** 53

**Labels:** spike · **Components:** Backend

- **Objetivo:** Validar si 10 casos por usuario cada 10 minutos es correcto para la digitación real de los centros.
- **Alcance:** Revisar en logs/Sentry los rechazos por límite durante las primeras semanas de uso.
- **Definición de terminado:** Valor confirmado o ajustado (una línea) y documentado.

**Criterios de aceptación:**

- Dado dos semanas de uso Cuando se revisan los rechazos Entonces se decide mantener o subir el límite
- **(borde)** Dado una jornada de carga de atrasos Cuando se planifica Entonces el centro sabe del límite

**Dependencias:** is blocked by E14-14

**Evidencia:** docs/IMPLEMENTACION_SEMANA_4.md §5.3 y §6 decisión 3

### E03-32 · Story · Política de seguridad de contenido sin unsafe-inline ni unsafe-eval

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Could · **Rank:** 52

**Labels:** seguridad · **Components:** Frontend, Backend

Como **administrador del centro**, quiero una CSP estricta y una decisión explícita sobre la enumeración de usuarios en recuperar contraseña, para reducir el impacto de un XSS y no revelar qué correos tienen cuenta.

**Criterios de aceptación:**

- Dado la CSP Cuando se inspecciona Entonces script-src usa nonces y no unsafe-inline ni unsafe-eval
- **(error)** Dado un script inline sin nonce Cuando se inyecta Entonces el navegador lo bloquea
- Dado forgotPassword con un correo inexistente Cuando se envía Entonces la respuesta sigue la decisión documentada

**Justificación de la estimación:** Nonces en Next.js App Router afectan todas las páginas y librerías de UI.

**Hallazgos:** PP-M-5

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-5

### E03-33 · Task · Limpiar tokens de recuperación vencidos e indexar por correo

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Could · **Rank:** 54

**Labels:** — · **Components:** Base-de-Datos

- **Objetivo:** Evitar que PasswordResetToken crezca sin límite y acelerar su búsqueda.
- **Alcance:** Índice en email y limpieza de expirados (en el cron diario existente).
- **Definición de terminado:** Migración aplicada; tokens vencidos se borran a diario.

**Criterios de aceptación:**

- Dado tokens vencidos Cuando corre el cron Entonces se eliminan
- Dado el modelo PasswordResetToken Cuando se inspecciona Entonces tiene índice en email

**Hallazgos:** PP-B-2

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md B-2 · src/prisma/schema.prisma model PasswordResetToken (sin @@index, verificado 2026-10-21)

---

<a id="e04"></a>

## E04 — Multi-tenant y Branding por Centro

Dos centros de conciliación reales (Armonía Concertada y Constructores de Paz) sobre una misma base de código y una misma base de datos, aislados por tenantId; carpetas de Drive por centro; identidad visual por tenant; membrete, resolución, operadora y firma propios de cada centro en las 65 plantillas.

**Objetivo de negocio:** Que cada centro vea solo lo suyo y que cada documento salga con la identidad legal del centro que lo emite, nunca con la del otro.

**Evidencia:** docs/BRANDING_POR_CENTRO_2026-09-30.md · docs/AUDITORIA_CIERRE_2026-09-12.md §2 · docs/CHECKPOINT_2026-10-09.md §2 · src/lib/membrete-centro.ts

| ID     | Tipo         | Título                                                                                | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ------------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E04-01 | Story        | Carpetas de Drive separadas por centro de conciliación                                |   5 | Done   | 2026-W10 | v0.1.0      |
| E04-02 | Bug          | La generación de documentos no validaba bien el centro del caso                       |   2 | Done   | 2026-W11 | v0.2.0      |
| E04-03 | Story        | Identidad visual por centro y modo oscuro                                             |   5 | Done   | 2026-W12 | v0.2.0      |
| E04-04 | Bug          | Estructura de carpetas de Drive dispar y adjuntos que no subían                       |   2 | Done   | 2026-W12 | v0.2.0      |
| E04-05 | Task         | Consolidar la configuración de centro en un solo módulo                               |   2 | Done   | 2026-W16 | v0.3.0      |
| E04-06 | Task (spike) | Revisar el material de Armonía y planificar el branding por centro                    |   2 | Done   | 2026-W40 | v0.6.0      |
| E04-07 | Story        | Placeholders de identidad del centro disponibles para las plantillas                  |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-08 | Bug          | El membrete por centro nunca eligió por centro                                        |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-09 | Story        | Pie de página y resolución de habilitación por centro                                 |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-10 | Story        | Nombre y resolución del centro en la prosa de las plantillas                          |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-11 | Story        | Armonía genera sus documentos con su propio membrete                                  |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-12 | Story        | Bloque de la operadora por centro en las plantillas                                   |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-13 | Story        | Logos y firma de Armonía, sin fallback imprimible                                     |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E04-14 | Bug          | No se podían generar documentos en ninguno de los dos centros por la carpeta de Drive |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E04-15 | Story        | Cuenta de consignación de Armonía en los autos por incumplimiento y reforma           |   2 | To Do  | 2026-W46 | v1.0.0      |
| E04-16 | Task (spike) | Decidir si cada centro usa su propia credencial de Google Drive                       |   2 | To Do  | Backlog  | v1.1.0      |

### E04-01 · Story · Carpetas de Drive separadas por centro de conciliación

**Estado:** Done (2026-03-04) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** seguridad · **Components:** Backend

Como **administrador del centro**, quiero que los documentos de mi centro se guarden en la carpeta de Drive de mi centro, para que el otro centro no pueda ver ni mezclar nuestros expedientes.

**Criterios de aceptación:**

- Dado un caso de Armonía Cuando se suben sus documentos Entonces van a la carpeta de Armonía
- **(error)** Dado un intento de subir a la carpeta de otro centro Cuando se valida Entonces se rechaza
- Dado los nombres canónicos Armonía y Constructores de Paz Cuando se resuelve la carpeta Entonces coinciden con Drive

**Justificación de la estimación:** Separación de almacenamiento con validación cruzada y tests por centro.

**Evidencia:** 0b3c085 feat: separar carpetas de Google Drive por centro de conciliación · CHANGELOG.md [0.1.0] Drive folder separation

### E04-02 · Bug · La generación de documentos no validaba bien el centro del caso

**Estado:** Done (2026-03-09) · **Sprint:** INS 2026-W11 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** seguridad, inferido · **Components:** Backend

- **Entorno:** Producción/preview, marzo 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar documentos de un caso desde una sesión de otro centro
- **Esperado:** Rechazo por centro distinto
- **Actual:** La validación multi-tenant de la generación fallaba
- **Causa raíz:** No documentada más allá del mensaje del commit.
- **Fix:** 29d6456 fix: corregir validación multi-tenant en generación de documentos
- **Test de regresión:** No identificado en el commit.

**Criterios de aceptación del fix:**

- **(error)** Dado un caso de otro centro Cuando se generan sus documentos Entonces se rechaza
- Dado un caso del propio centro Cuando se generan Entonces funciona

**Evidencia:** 29d6456

### E04-03 · Story · Identidad visual por centro y modo oscuro

**Estado:** Done (2026-03-18) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero ver los colores y el logo de mi centro y poder usar modo oscuro, para saber siempre en qué centro estoy trabajando.

**Criterios de aceptación:**

- Dado una sesión en Armonía Cuando navego Entonces veo el logo y la paleta de Armonía
- Dado el modo oscuro Cuando lo activo Entonces todas las pantallas lo respetan
- **(borde)** Dado un cambio de centro Cuando se completa Entonces la identidad visual cambia sin recargar datos del anterior

**Justificación de la estimación:** Theming completo por tenant más dark mode en toda la app.

**Evidencia:** 4d9d3b7 feat: dark mode completo, identidad visual por tenant · f6f13dc fix: estandarizar CSS de plantillas y corregir dark mode

### E04-04 · Bug · Estructura de carpetas de Drive dispar y adjuntos que no subían

**Estado:** Done (2026-03-18) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** inferido · **Components:** Backend

- **Entorno:** Producción/preview, marzo 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Subir un adjunto a un caso
  2. Revisar la carpeta en Drive
- **Esperado:** Misma estructura de carpetas para todos los casos y adjunto subido
- **Actual:** Estructuras distintas según el flujo y fallos en la subida de adjuntos
- **Causa raíz:** No documentada más allá del mensaje del commit.
- **Fix:** d43892d fix: unificar estructura de carpetas en Google Drive y corregir subida de adjuntos
- **Test de regresión:** No identificado en el commit.

**Criterios de aceptación del fix:**

- Dado un adjunto Cuando se sube Entonces queda en la carpeta del caso
- Dado dos casos creados por flujos distintos Cuando se comparan sus carpetas Entonces tienen la misma estructura

**Evidencia:** d43892d

### E04-05 · Task · Consolidar la configuración de centro en un solo módulo

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend

- **Objetivo:** Eliminar la configuración de tenant duplicada en los formularios de auth.
- **Alcance:** login, register, forgot-password y reset-password importan de @/lib/tenant-theme.
- **Definición de terminado:** databaseInfo local eliminado; un único origen de la config de tenant.

**Criterios de aceptación:**

- Dado los 4 formularios de auth Cuando se buscan definiciones de tenant Entonces solo importan de tenant-theme

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Tenant config consolidada

### E04-06 · Task (spike) · Revisar el material de Armonía y planificar el branding por centro

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Crítica · **Estimación:** 2 pts

**Labels:** spike · **Components:** Documentos-PDF

- **Objetivo:** Diseñar cómo cada plantilla obtiene la identidad del centro que la emite.
- **Alcance:** Barrido de las 65 plantillas, datos faltantes de Armonía y requisitos de los assets de imagen.
- **Definición de terminado:** docs/BRANDING_POR_CENTRO_2026-09-30.md con plan por fases y datos pendientes.

**Criterios de aceptación:**

- Dado las 65 plantillas Cuando se barren Entonces se inventaría cada dato de centro escrito a mano
- Dado los datos que faltan de Armonía Cuando se listan Entonces quedan como pendientes legales

**Hallazgos:** CIERRE-2

**Evidencia:** #82 74aec37 · docs/BRANDING_POR_CENTRO_2026-09-30.md

### E04-07 · Story · Placeholders de identidad del centro disponibles para las plantillas

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** — · **Components:** Backend, Documentos-PDF

Como **administrador del centro**, quiero que el sistema conozca el nombre, resolución, dirección y contacto de cada centro, para que las plantillas dejen de tener escrita a mano la identidad de Constructores de Paz.

**Criterios de aceptación:**

- Dado un caso de cada centro Cuando se mapea Entonces existen placeholders de nombre, resolución, dirección y contacto del centro
- **(error)** Dado un centro sin un dato obligatorio de membrete Cuando se genera Entonces no se imprime un valor por defecto de otro centro
- Dado el mapper Cuando se prueba por centro Entonces cada uno recibe su identidad

**Justificación de la estimación:** Modelo de datos de identidad de centro y su cableado al mapper.

**Hallazgos:** CIERRE-2

**Evidencia:** #121 9a94c0f · docs/AUDITORIA_CIERRE_2026-09-12.md §2

### E04-08 · Bug · El membrete por centro nunca eligió por centro

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Entorno:** Producción y dev, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar un documento de un caso de Armonía con el branding por centro activo
- **Esperado:** Membrete de Armonía
- **Actual:** Siempre el membrete por defecto
- **Causa raíz:** El mapper comparaba Case.tenantId (un cuid) contra el slug del centro; nunca coincidía.
- **Fix:** #128 1173259: resolver el centro por slug
- **Test de regresión:** Guardianes por centro descritos en CHECKPOINT_2026-10-09 §2.

**Criterios de aceptación del fix:**

- Dado un caso de Armonía Cuando se resuelve el centro Entonces se obtiene armonia
- Dado un tenantId cuid Cuando se compara Entonces se traduce a slug antes

**Evidencia:** #128 1173259 · docs/CHECKPOINT_2026-10-09.md §2

### E04-09 · Story · Pie de página y resolución de habilitación por centro

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

Como **conciliadora**, quiero que el pie y la resolución de cada documento sean los de mi centro, para que el documento radicado acredite la habilitación correcta.

**Criterios de aceptación:**

- Dado un caso de Constructores de Paz Cuando se genera Entonces el pie lleva sus datos
- Dado un caso de Armonía Cuando se genera Entonces cita la resolución 0858 del 01-nov-2016
- **(error)** Dado un dato de membrete faltante Cuando se genera Entonces la generación de ese centro se pausa en vez de imprimir uno falso

**Evidencia:** #126 d0269a0 · docs/PENDIENTES_DECISION_LEGAL.md ítem 11

### E04-10 · Story · Nombre y resolución del centro en la prosa de las plantillas

**Estado:** Done (2026-10-10) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** — · **Components:** Documentos-PDF

Como **conciliadora**, quiero que el nombre del centro dentro del texto sea el del centro que emite, para que ningún párrafo nombre al centro equivocado.

**Criterios de aceptación:**

- Dado las 186 ocurrencias en prosa Cuando se generan para Armonía Entonces ninguna dice Constructores de Paz
- Dado rótulo, nombre y entidad promotora Cuando se imprimen Entonces son tres campos distintos
- **(borde)** Dado Designación del Conciliador Cuando se genera Entonces se mantiene intacta a propósito

**Justificación de la estimación:** 186 sustituciones en prosa revisadas una a una.

**Evidencia:** #132 9423851

### E04-11 · Story · Armonía genera sus documentos con su propio membrete

**Estado:** Done (2026-10-10) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 5 pts

**Labels:** — · **Components:** Documentos-PDF, Backend

Como **conciliadora de Armonía**, quiero generar las plantillas con el membrete de Armonía, para radicar documentos de mi centro sin corregirlos a mano.

**Criterios de aceptación:**

- Dado un caso de Armonía Cuando genero Entonces 63 de 65 plantillas salen con el membrete de Armonía
- **(error)** Dado una de las 2 plantillas que requieren la cuenta de consignación Cuando genero Entonces se bloquea con el motivo
- Dado el corte por campo Cuando falta un dato puntual Entonces solo se bloquean las plantillas que lo usan

**Justificación de la estimación:** Habilitar un centro completo con bloqueo granular por campo.

**Evidencia:** #133 fe50bc9 · docs/PENDIENTES_DECISION_LEGAL.md ítem 14

### E04-12 · Story · Bloque de la operadora por centro en las plantillas

**Estado:** Done (2026-10-10) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

Como **conciliadora**, quiero que el bloque de firma de la operadora sea el correcto para el centro, para que el documento lo firme quien corresponde.

**Criterios de aceptación:**

- Dado las 114 ocurrencias del bloque del operador Cuando se generan Entonces usan los datos del centro
- Dado la operadora de los dos centros Cuando firma Entonces se usa un solo asset de firma
- **(borde)** Dado Designación del Conciliador Cuando se genera Entonces conserva la firma de quien la emite

**Evidencia:** #134 83338ec · docs/PENDIENTES_DECISION_LEGAL.md ítem 12

### E04-13 · Story · Logos y firma de Armonía, sin fallback imprimible

**Estado:** Done (2026-10-10) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

Como **conciliadora de Armonía**, quiero que mis documentos lleven el logo y la firma de Armonía, para que no salga nunca un documento con imagen de relleno.

**Criterios de aceptación:**

- Dado un caso de Armonía Cuando se genera Entonces usa sus 3 assets de imagen
- **(error)** Dado un asset faltante Cuando se genera Entonces se bloquea en vez de imprimir el fallback
- Dado Constructores de Paz Cuando se genera Entonces sus assets no cambian

**Evidencia:** #135 72e6f19 · tests/unit/documents/armonia-genera.test.ts · docs/BRANDING_POR_CENTRO_2026-09-30.md §4

### E04-14 · Bug · No se podían generar documentos en ninguno de los dos centros por la carpeta de Drive

**Estado:** Done (2026-10-18) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** bug-regresion, doc-semana-12 · **Components:** Backend, Testing

- **Entorno:** dev y producción (1.0.0-rc.1), octubre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Generar cualquier documento de un caso
- **Esperado:** Los documentos se suben a la carpeta del centro
- **Actual:** La generación fallaba en ambos centros
- **Causa raíz:** resolveCenterFolderName resolvía el centro por el cuid del tenant en vez de su slug (mismo patrón que E04-08, en otra ruta).
- **Fix:** #146 e406962 + barrido de otras resoluciones por cuid
- **Test de regresión:** Tests de resolución por slug y verificación manual en navegador.

**Criterios de aceptación del fix:**

- Dado un caso de cada centro Cuando se generan documentos Entonces se suben a su carpeta
- Dado un tenantId cuid Cuando se resuelve la carpeta Entonces se usa el slug

**Evidencia:** #146 e406962 · docs/IMPLEMENTACION_SEMANA_12.md · CHANGELOG.md [1.0.0-rc.1] (#146)

### E04-15 · Story · Cuenta de consignación de Armonía en los autos por incumplimiento y reforma

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 10

**Labels:** legal-pendiente · **Components:** Documentos-PDF

Como **conciliadora de Armonía**, quiero que los autos de incumplimiento y de reforma del acuerdo indiquen la cuenta de Armonía donde consigna el deudor, para generar las 2 plantillas que hoy están bloqueadas para mi centro.

**Criterios de aceptación:**

- Dado la entidad, NIT y número de cuenta de Armonía cargados Cuando genero Auto Solicitud por Incumplimiento Entonces se imprime esa cuenta
- Dado lo mismo Cuando genero Auto Solicitud Reforma del Acuerdo Entonces se imprime esa cuenta
- **(error)** Dado que falte cualquiera de los 3 datos Cuando genero Entonces sigue bloqueado con el motivo

**Hallazgos:** LEGAL-14

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 14 · src/lib/membrete-centro.ts (cuentaConsignacion) · #133

### E04-16 · Task (spike) · Decidir si cada centro usa su propia credencial de Google Drive

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 55

**Labels:** spike, seguridad · **Components:** Backend

- **Objetivo:** Evaluar el riesgo de que una sola credencial de Drive sirva a los dos centros.
- **Alcance:** Opciones: mantener una credencial con validación en la app, o una por centro. Impacto en runbook de rotación.
- **Definición de terminado:** Decisión documentada en ARQUITECTURA.md y, si aplica, historia de implementación creada.

**Criterios de aceptación:**

- Dado las dos opciones Cuando se evalúan Entonces queda escrita la decisión con su riesgo aceptado
- **(borde)** Dado la rotación semanal del refresh token en modo Testing Cuando se decide Entonces se considera su costo doble

**Hallazgos:** PP-M-6

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-6 · docs/RUNBOOK_ROTACION_DRIVE.md

---

<a id="e05"></a>

## E05 — Deudores, Acreedores y Apoderados

Registro de deudores (datos personales y financieros), acreedores y sus deudas por caso (Debt), codeudores, apoderados del deudor y del acreedor, y las partes de la conciliación (convocante/convocado).

**Objetivo de negocio:** Que las partes del trámite y sus representantes estén registrados una sola vez, editables, y que los documentos nombren al representante correcto.

**Evidencia:** src/features/debtor/ · src/features/creditor/ · docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md · docs/MODELO_ENTIDAD_RELACION.md

| ID     | Tipo         | Título                                                                       | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ---------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E05-01 | Story        | Perfil del deudor con datos personales y financieros                         |   5 | Done   | 2026-W06 | v0.1.0      |
| E05-02 | Story        | Registro de acreedores y sus acreencias por caso                             |   5 | Done   | 2026-W06 | v0.1.0      |
| E05-03 | Bug          | Validaciones y mensajes de error confusos al crear un deudor                 |   2 | Done   | 2026-W12 | v0.2.0      |
| E05-04 | Story        | Apoderados del deudor en tabla propia con guardia de consistencia            |   5 | Done   | 2026-W38 | v0.6.0      |
| E05-05 | Bug          | No se exigían los 3 documentos del apoderado                                 |   2 | Done   | 2026-W40 | v0.6.0      |
| E05-06 | Story        | Teléfono y correo del codeudor o avalista                                    |   2 | Done   | 2026-W40 | v0.6.0      |
| E05-07 | Story        | Ejemplo de acreedor persona natural y rótulo de notificación al deudor       |   2 | Done   | 2026-W40 | v0.6.0      |
| E05-08 | Story        | Editar los apoderados del deudor después de crear el caso                    |   3 | Done   | 2026-W40 | v0.6.0      |
| E05-09 | Story        | Editar las acreencias detalladas después de crear el caso                    |   5 | Done   | 2026-W40 | v0.6.0      |
| E05-10 | Story        | Apoderado del convocado en la conciliación                                   |   3 | Done   | 2026-W40 | v0.6.0      |
| E05-11 | Task (spike) | Diseñar cómo se determina el apoderado del acreedor en el CYG                |   2 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E05-12 | Story        | Modelo de datos del registro de apoderados del acreedor                      |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E05-13 | Story        | Capturar el apoderado del acreedor desde sus dos fuentes al crear el caso    |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E05-14 | Story        | El apoderado del deudor se registra en un solo lugar del formulario          |   5 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E05-15 | Story        | Bloquear el CYG cuando el apoderado del acreedor se contradice entre fuentes |   5 | To Do  | 2026-W45 | v1.0.0-rc.2 |
| E05-16 | Story        | Resolver el conflicto de apoderado del acreedor desde la interfaz            |   5 | To Do  | 2026-W46 | v1.0.0      |

### E05-01 · Story · Perfil del deudor con datos personales y financieros

**Estado:** Done (2026-02-08) · **Sprint:** INS 2026-W06 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar al deudor una vez y vincularlo a sus casos, para no repetir sus datos en cada trámite.

**Criterios de aceptación:**

- Dado un deudor nuevo Cuando lo registro Entonces queda con sus datos personales y financieros
- Dado un deudor existente Cuando creo un caso Entonces puedo vincularlo
- **(error)** Dado una cédula ya registrada en mi centro Cuando intento crear otro deudor con ella Entonces se advierte
- Dado un deudor Cuando abro su perfil Entonces veo el historial de casos vinculados

**Justificación de la estimación:** CRUD con ~50 columnas y vínculo a casos.

**Evidencia:** 83d2d71 · CHANGELOG.md [0.1.0] Debtor management · README.md §Deudores, Acreedores y Apoderados

### E05-02 · Story · Registro de acreedores y sus acreencias por caso

**Estado:** Done (2026-02-08) · **Sprint:** INS 2026-W06 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar los acreedores y el monto, tasa y mora de cada deuda, para construir la relación de acreencias de la solicitud.

**Criterios de aceptación:**

- Dado un caso Cuando agrego un acreedor con su deuda Entonces queda vinculado al caso
- Dado varias deudas Cuando las veo Entonces se calcula el total de acreencias
- **(error)** Dado un monto de deuda negativo Cuando guardo Entonces se rechaza

**Justificación de la estimación:** Modelo Creditor + Debt con cálculos que alimentan los topes legales.

**Evidencia:** 83d2d71 · CHANGELOG.md [0.1.0] Creditor management

### E05-03 · Bug · Validaciones y mensajes de error confusos al crear un deudor

**Estado:** Done (2026-03-18) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** inferido · **Components:** Frontend

- **Entorno:** Preview, marzo 2026
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Crear un deudor con datos inválidos
- **Esperado:** Mensajes claros por campo
- **Actual:** Validaciones incompletas y mensajes poco claros
- **Causa raíz:** No documentada más allá del mensaje del commit.
- **Fix:** f50c59a fix: mejorar validaciones y mensajes de error en formulario crear deudor
- **Test de regresión:** No identificado en el commit.

**Criterios de aceptación del fix:**

- Dado un correo inválido Cuando guardo Entonces veo un mensaje en el campo
- Dado datos válidos Cuando guardo Entonces el deudor se crea

**Evidencia:** f50c59a

### E05-04 · Story · Apoderados del deudor en tabla propia con guardia de consistencia

**Estado:** Done (2026-09-18) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Backend, Base-de-Datos, Testing

Como **abogado del centro**, quiero registrar los apoderados del deudor como entidades propias, para que los documentos nombren al apoderado correcto y no a un texto suelto.

**Criterios de aceptación:**

- Dado un caso con apoderado Cuando se guarda Entonces se escribe en la tabla apoderados y en Case (doble escritura)
- Dado el schema Zod y el modelo Case Cuando divergen Entonces la guardia Zod<->Case falla en CI
- **(borde)** Dado un caso sin apoderado Cuando se guarda Entonces no se crea fila

**Justificación de la estimación:** Migración nueva, doble escritura transitoria y guardia de schema.

**Evidencia:** e05e409 feat(db): columnas notificationCity/otherCauseDetail y tabla apoderados · 2f342c9 feat(casos): apoderados con doble escritura y guardia Zod<->Case · bc21355

### E05-05 · Bug · No se exigían los 3 documentos del apoderado

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend, Testing

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Crear un caso con apoderado sin adjuntar poder, cédula ni tarjeta profesional
- **Esperado:** Los 3 documentos se exigen
- **Actual:** El gate nunca se activaba
- **Causa raíz:** El gate leía caseData.hasAttorney, un campo que no existe; la pantalla usaba un hasAttorney derivado distinto.
- **Fix:** #64 441c565
- **Test de regresión:** Test del gate con apoderado registrado.

**Criterios de aceptación del fix:**

- Dado un caso con apoderado Cuando faltan sus documentos Entonces se exigen los 3
- Dado un caso sin apoderado Cuando se valida Entonces no se exigen

**Evidencia:** #64 441c565 · docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md fila 1

### E05-06 · Story · Teléfono y correo del codeudor o avalista

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar el teléfono y el correo del codeudor, para poder notificarlo durante el trámite.

**Criterios de aceptación:**

- Dado una deuda con codeudor Cuando registro su contacto Entonces se guarda
- **(error)** Dado un correo mal formado Cuando guardo Entonces se marca
- Dado una deuda sin codeudor Cuando guardo Entonces los campos no se exigen

**Evidencia:** #62 134e2e8

### E05-07 · Story · Ejemplo de acreedor persona natural y rótulo de notificación al deudor

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero ver un ejemplo de cómo registrar un acreedor persona natural y un rótulo claro en la notificación al deudor, para no cometer errores típicos al diligenciar.

**Criterios de aceptación:**

- Dado el formulario de acreedor Cuando elijo persona natural Entonces veo el ejemplo
- Dado la sección de notificación Cuando la abro Entonces el rótulo explica a quién se notifica
- **(borde)** Dado una persona jurídica Cuando la elijo Entonces no veo el ejemplo de persona natural

**Evidencia:** #61 5597438

### E05-08 · Story · Editar los apoderados del deudor después de crear el caso

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **abogado del centro**, quiero cambiar o agregar el apoderado del deudor en un caso ya creado, para reflejar un cambio de representante sin rehacer el caso.

**Criterios de aceptación:**

- Dado un caso existente Cuando agrego un apoderado Entonces queda registrado
- Dado un apoderado Cuando lo edito Entonces los documentos siguientes usan el dato nuevo
- **(error)** Dado un usuario sin acceso al caso Cuando intenta editar el apoderado Entonces se rechaza

**Evidencia:** #103 ab48bca

### E05-09 · Story · Editar las acreencias detalladas después de crear el caso

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero corregir una deuda (monto, tasa, mora) en un caso ya creado, para ajustar la relación de acreencias cuando un acreedor certifica otro saldo.

**Criterios de aceptación:**

- Dado un caso Cuando edito una deuda Entonces se actualiza y se recalculan los totales
- Dado una deuda nueva Cuando la agrego post-creación Entonces se suma al caso
- **(error)** Dado una edición concurrente Cuando dos usuarios editan Entonces aplica el control de versión del caso

**Justificación de la estimación:** Edición de entidades hijas con recálculo de totales que alimentan topes legales.

**Evidencia:** a49e84e feat(casos): acreedores detallados (Debt) editables post-creacion

### E05-10 · Story · Apoderado del convocado en la conciliación

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Documentos-PDF

Como **conciliadora**, quiero registrar el apoderado de la parte convocada, para que el acta identifique a quien representa al convocado.

**Criterios de aceptación:**

- Dado una conciliación Cuando registro el apoderado del convocado Entonces se guarda
- Dado el apoderado registrado Cuando genero el acta Entonces aparece
- **(borde)** Dado un convocado sin apoderado Cuando genero Entonces el acta no deja el hueco

**Evidencia:** 31e9db0 feat(conciliacion): UI para el apoderado del convocado

### E05-11 · Task (spike) · Diseñar cómo se determina el apoderado del acreedor en el CYG

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** spike · **Components:** Documentos-PDF

- **Objetivo:** Resolver de dónde sale el apoderado de cada acreedor en el CYG.
- **Alcance:** Decisión legal: detectarlo desde el registro de poderes y bloquear la generación si contradice el acta. Plan en 4 PRs.
- **Definición de terminado:** Plan aprobado (2026-10-10) en docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md.

**Criterios de aceptación:**

- Dado la respuesta legal del ítem 13 Cuando se diseña Entonces el plan no elige una fuente por defecto
- Dado el plan Cuando se aprueba Entonces define 4 PRs con su riesgo de secuencia

**Hallazgos:** LEGAL-13

**Evidencia:** bfaa37a docs(plan) · docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md · docs/PENDIENTES_DECISION_LEGAL.md ítem 13

### E05-12 · Story · Modelo de datos del registro de apoderados del acreedor

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Base-de-Datos, Backend

Como **abogado del centro**, quiero que el sistema guarde quién representa a cada acreedor, para que el CYG pueda verificar al apoderado contra una fuente registrada.

**Criterios de aceptación:**

- Dado la migración Cuando se aplica Entonces existe ApoderadoAcreedor vinculado a la deuda
- Dado la confirmación en Debt Cuando se guarda Entonces conserva la huella de las dos fuentes
- **(borde)** Dado un acreedor sin apoderado Cuando se consulta Entonces no hay fila

**Evidencia:** #130 af53a6f (PR 1 de 4) · docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md §5 PR 1

### E05-13 · Story · Capturar el apoderado del acreedor desde sus dos fuentes al crear el caso

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero registrar el apoderado del acreedor desde el registro de poderes y desde el acta, para que luego el sistema pueda detectar si se contradicen.

**Criterios de aceptación:**

- Dado un acreedor con poder Cuando creo el caso Entonces registro su apoderado en la fuente de poderes
- Dado el dato del acta Cuando lo capturo Entonces se guarda por separado
- **(borde)** Dado una sola fuente diligenciada Cuando guardo Entonces el caso se crea igual

**Justificación de la estimación:** Captura en el wizard de dos fuentes paralelas con su persistencia.

**Dependencias:** blocks E05-15

**Evidencia:** #131 613e327 (PR 2 de 4) · docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md §5 PR 2

### E05-14 · Story · El apoderado del deudor se registra en un solo lugar del formulario

**Estado:** Done (2026-10-18) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** doc-semana-13 · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero cargar el apoderado del deudor solo en la Sección XI, para no tener dos campos que pueden contradecirse.

**Criterios de aceptación:**

- Dado el formulario Cuando registro el apoderado Entonces solo existe la Sección XI como fuente
- **(error)** Dado datos inconsistentes de una versión anterior Cuando se edita el caso Entonces se valida en servidor y cliente
- Dado el apoderado registrado Cuando se generan documentos Entonces todos usan la Sección XI

**Justificación de la estimación:** Retirar un campo duplicado con validaciones en servidor y cliente y fix encontrado en verificación manual.

**Evidencia:** #147 cb0e939 · docs/IMPLEMENTACION_SEMANA_13.md

### E05-15 · Story · Bloquear el CYG cuando el apoderado del acreedor se contradice entre fuentes

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 6

**Labels:** — · **Components:** Backend, Documentos-PDF, Testing

Como **abogado del centro**, quiero que el CYG no se genere si el apoderado registrado y el del acta no coinciden, para no radicar un documento que nombra a un representante que no lo es.

**Criterios de aceptación:**

- Dado ambas fuentes coinciden Cuando genero el CYG Entonces {{APODERADO}} imprime el valor (hoy emite vacío)
- **(error)** Dado fuentes en conflicto Cuando genero Entonces no se genera ni se sube nada y el error nombra qué acreedores están en conflicto
- Dado el comparador Cuando se prueba como función pura Entonces cubre las reglas de comparación del plan §4
- **(borde)** Dado un acreedor sin apoderado en ninguna fuente Cuando genero Entonces no bloquea

**Justificación de la estimación:** Única parte del plan que cambia la generación; requiere aviso explícito del dueño del producto antes de abrirse.

**Hallazgos:** LEGAL-13

**Dependencias:** is blocked by E05-13 · blocks E05-16

**Evidencia:** docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md §5 PR 3 · docs/PENDIENTES_DECISION_LEGAL.md ítem 13

### E05-16 · Story · Resolver el conflicto de apoderado del acreedor desde la interfaz

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 11

**Labels:** — · **Components:** Frontend, Backend

Como **abogado del centro**, quiero ver cada conflicto de apoderado y confirmar cuál es el correcto, para destrabar la generación del CYG con una decisión trazable.

**Criterios de aceptación:**

- Dado un conflicto Cuando abro la tarjeta Entonces ninguna opción viene preseleccionada
- Dado mi elección Cuando la confirmo Entonces se persiste y queda en audit_logs
- **(error)** Dado que una de las dos fuentes cambia después Cuando genero Entonces la confirmación se invalida y vuelve a bloquear
- Dado todos los conflictos resueltos Cuando genero el CYG Entonces se genera

**Justificación de la estimación:** UI con cuatro propiedades no negociables (sin preselección, persistida, invalidable por huella, auditada).

**Hallazgos:** LEGAL-13

**Dependencias:** is blocked by E05-15 · blocks E14-14

**Evidencia:** docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md §5 PR 4

---

<a id="e06"></a>

## E06 — Pagos y Trazabilidad

Cronogramas y pagos manuales del acuerdo, comprobantes adjuntos en Drive, estados pendiente/pagado/parcial/vencido y progreso por caso. (No confundir con los pagos de infraestructura, que viven en E10.)

**Objetivo de negocio:** Que el centro sepa en todo momento cuánto ha pagado cada deudor del acuerdo y pueda demostrarlo con el comprobante.

**Evidencia:** src/features/payment/ · README.md §Trazabilidad de Pagos · docs/AUDITORIA_CIERRE_2026-09-12.md §5.7

| ID     | Tipo  | Título                                                          | Pts | Estado | Sprint   | Versión |
| ------ | ----- | --------------------------------------------------------------- | --: | ------ | -------- | ------- |
| E06-01 | Story | Registrar el cronograma y los pagos del acuerdo con su progreso |   5 | Done   | 2026-W13 | v0.2.0  |
| E06-02 | Story | Adjuntar el comprobante de cada pago                            |   3 | Done   | 2026-W13 | v0.2.0  |
| E06-03 | Story | Montos de pago en formato colombiano                            |   3 | To Do  | Backlog  | v1.1.0  |

### E06-01 · Story · Registrar el cronograma y los pagos del acuerdo con su progreso

**Estado:** Done (2026-03-24) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend, Base-de-Datos

Como **operadora de insolvencia**, quiero registrar las cuotas del acuerdo y cada pago que hace el deudor, para saber si el deudor está al día y cuánto lleva pagado.

**Criterios de aceptación:**

- Dado un acuerdo con 12 cuotas Cuando registro el cronograma Entonces veo las 12 cuotas pendientes
- Dado un pago parcial Cuando lo registro Entonces la cuota queda en estado parcial
- **(borde)** Dado una cuota vencida sin pago Cuando pasa la fecha Entonces queda en estado vencido
- **(error)** Dado un rol limitado a sus casos Cuando consulta pagos Entonces solo ve los de sus casos

**Justificación de la estimación:** Modelo de pagos con estados, progreso por caso y scoping por rol en 11 acciones.

**Evidencia:** e777c30 feat: sistema completo de trazabilidad de pagos con registro, comprobantes y progreso por caso · docs/AUDITORIA_CIERRE_2026-09-12.md §5.7 (Pagos: 11 de 11 autenticadas)

### E06-02 · Story · Adjuntar el comprobante de cada pago

**Estado:** Done (2026-03-24) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero adjuntar el comprobante en PDF, JPG o PNG a cada pago, para tener el soporte del pago dentro del expediente.

**Criterios de aceptación:**

- Dado un pago Cuando adjunto un PDF Entonces se sube a la carpeta /Comprobantes/ del caso en Drive
- **(error)** Dado un archivo .exe Cuando lo adjunto Entonces se rechaza
- Dado un comprobante subido Cuando lo abro Entonces se ve con la vista previa

**Evidencia:** e777c30 · CHANGELOG.md [0.2.0] Payment receipt upload

### E06-03 · Story · Montos de pago en formato colombiano

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 3 pts · **MoSCoW:** Should · **Rank:** 49

**Labels:** — · **Components:** Frontend, Testing

Como **operadora de insolvencia**, quiero escribir el monto de un pago como 1.500.000 en el detalle del caso y en reportes, para registrar pagos igual que el resto de montos del sistema.

> Hoy el bug es inalcanzable (type=number no deja escribir el punto); molesta la inconsistencia visual.

**Criterios de aceptación:**

- Dado el campo Monto del detalle del caso Cuando escribo 1.500.000 Entonces se guarda 1500000
- Dado el campo Valor pagado del reporte Cuando escribo 1.500.000 Entonces se guarda 1500000
- **(error)** Dado el envío Cuando se parsea Entonces usa parsearMonto y nunca parseFloat (que daría 1.5)
- Dado los dos campos Cuando se renderizan Entonces usan MoneyInput

**Evidencia:** CLAUDE.md Quick Win 9 · docs/IMPLEMENTACION_SEMANA_11.md §3 (tabla del barrido) · payment-tracking-section.tsx:565 y payment-tracking-report.tsx:1118 (type=number, verificado 2026-10-21)

---

<a id="e07"></a>

## E07 — Notificaciones y Alertas Proactivas

Notificaciones in-app por usuario y rol, alertas proactivas por cron (audiencia próxima, pago vencido) con email opcional, y avisos del resultado de la generación de documentos en segundo plano.

**Objetivo de negocio:** Que nadie del centro se entere tarde de una audiencia, un pago vencido o una generación fallida.

**Evidencia:** src/features/notification/ · src/app/api/cron/alerts · CHANGELOG.md [0.3.0]

| ID     | Tipo  | Título                                                                    | Pts | Estado | Sprint   | Versión     |
| ------ | ----- | ------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E07-01 | Story | Bandeja de notificaciones internas por usuario                            |   3 | Done   | 2026-W06 | v0.1.0      |
| E07-02 | Story | Paginación de la bandeja de notificaciones                                |   2 | Done   | 2026-W12 | v0.2.0      |
| E07-03 | Story | Aviso 48 horas antes de una audiencia                                     |   3 | Done   | 2026-W16 | v0.3.0      |
| E07-04 | Story | Aviso de pago vencido                                                     |   3 | Done   | 2026-W16 | v0.3.0      |
| E07-05 | Story | Ejecución diaria de alertas protegida con secreto                         |   3 | Done   | 2026-W16 | v0.3.0      |
| E07-06 | Task  | Tipos de notificación desde una única lista                               |   2 | Done   | 2026-W16 | v0.3.0      |
| E07-07 | Bug   | El aviso de documentos generados dejaba la bandeja vacía con un error     |   3 | Done   | 2026-W43 | v1.0.0-rc.1 |
| E07-08 | Bug   | La creación interna de notificaciones está expuesta como endpoint público |   2 | To Do  | Backlog  | v1.1.0      |

### E07-01 · Story · Bandeja de notificaciones internas por usuario

**Estado:** Done (2026-02-08) · **Sprint:** INS 2026-W06 · **Versión:** v0.1.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero recibir en la app avisos de lo que pasa en mis casos, para no depender del correo para enterarme de cambios.

**Criterios de aceptación:**

- Dado una acción sobre mi caso Cuando ocurre Entonces recibo una notificación
- Dado una notificación Cuando la marco como leída Entonces deja de contar como pendiente
- **(error)** Dado una notificación de otro usuario Cuando intento marcarla Entonces se rechaza

**Evidencia:** 83d2d71 · CHANGELOG.md [0.1.0] Dashboard (módulo Notifications) · README.md §Notificaciones y Auditoría

### E07-02 · Story · Paginación de la bandeja de notificaciones

**Estado:** Done (2026-03-18) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend, Backend

Como **operadora de insolvencia**, quiero que la bandeja pagine, para que siga cargando rápido con cientos de avisos.

**Criterios de aceptación:**

- Dado más de una página de notificaciones Cuando abro la bandeja Entonces veo la primera página
- Dado la siguiente página Cuando avanzo Entonces se carga desde el servidor
- **(borde)** Dado cero notificaciones Cuando abro la bandeja Entonces veo un estado vacío

**Evidencia:** 27bd3c6 feat: ... agregar paginación a notificaciones

### E07-03 · Story · Aviso 48 horas antes de una audiencia

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Backend

Como **operadora de insolvencia**, quiero recibir un aviso dos días antes de cada audiencia de mis casos, para preparar la audiencia a tiempo.

**Criterios de aceptación:**

- Dado una audiencia dentro de 48 h Cuando corre el cron Entonces el operador asignado recibe hearing_upcoming
- **(borde)** Dado que el cron corre dos veces en 20 h Cuando evalúa la misma audiencia Entonces no duplica el aviso
- Dado ALERTS_EMAIL_ENABLED en true Cuando se genera el aviso Entonces también se envía por correo

**Evidencia:** 820461c feat(0.3.0): alertas proactivas · CHANGELOG.md [0.3.0] hearing_upcoming

### E07-04 · Story · Aviso de pago vencido

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Backend

Como **operadora de insolvencia**, quiero que el sistema me avise cuando una cuota vence sin pago y la marque vencida, para contactar al deudor antes de que el incumplimiento crezca.

**Criterios de aceptación:**

- Dado una cuota vencida sin pago Cuando corre el cron Entonces se marca vencido y se notifica a la operadora
- **(borde)** Dado una cuota pagada el mismo día Cuando corre el cron Entonces no se marca vencida
- Dado el mismo vencimiento Cuando el cron corre de nuevo dentro de la ventana Entonces no duplica el aviso

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] payment_overdue

### E07-05 · Story · Ejecución diaria de alertas protegida con secreto

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** seguridad · **Components:** Backend, Infra-CI/CD

Como **administrador del centro**, quiero que las alertas corran solas cada mañana y nadie externo pueda dispararlas, para tener avisos confiables sin exponer un endpoint abierto.

**Criterios de aceptación:**

- Dado el schedule de vercel.json Cuando son las 08:00 UTC Entonces se llama /api/cron/alerts
- **(error)** Dado un Bearer incorrecto Cuando se llama el endpoint Entonces responde 401 (comparación timingSafeEqual)
- **(borde)** Dado una ejecución que excede 60 s Cuando se corta Entonces responde ok:false, timedOut:true con requestId

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Cron endpoint, Security · tests/unit/cron/alerts-route.test.ts

### E07-06 · Task · Tipos de notificación desde una única lista

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Backend

- **Objetivo:** Que agregar un tipo de notificación no requiera tocar 15 conteos paralelos.
- **Alcance:** notificationTypeSchema desde la tupla NOTIFICATION_TYPES; getNotificationStats con un solo groupBy; API tipada CrudNotificationType.
- **Definición de terminado:** Agregar un tipo es un cambio de una línea; tests verdes.

**Criterios de aceptación:**

- Dado un tipo nuevo en NOTIFICATION_TYPES Cuando se compila Entonces el schema y las estadísticas lo incluyen

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Notificaciones — schema

### E07-07 · Bug · El aviso de documentos generados dejaba la bandeja vacía con un error

**Estado:** Done (2026-10-19) · **Sprint:** INS 2026-W43 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** bug-regresion, doc-semana-15 · **Components:** Backend, Frontend, Testing

- **Entorno:** Producción (1.0.0-rc.1), octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Crear un caso para que se generen sus documentos en segundo plano
  2. Abrir la bandeja de notificaciones al terminar
- **Esperado:** La bandeja muestra el aviso de generación terminada o fallida
- **Actual:** La bandeja queda vacía con un error
- **Causa raíz:** El job creaba notificaciones con tipos que el enum de lectura (NOTIFICATION_TYPES) no reconocía, y la validación de la lista entera fallaba.
- **Fix:** #149 b29166c: tipos agregados al enum y lectura tolerante en getNotifications, con ícono y etiqueta en notification-item
- **Test de regresión:** Barrido de todos los type: que el código crea vs. el enum, con test.

**Criterios de aceptación del fix:**

- Dado una notificación de generación Cuando se lista la bandeja Entonces aparece con su ícono
- Dado un tipo creado por código Cuando no está en el enum Entonces el test de barrido falla

**Evidencia:** #149 b29166c · docs/IMPLEMENTACION_SEMANA_15.md

### E07-08 · Bug · La creación interna de notificaciones está expuesta como endpoint público

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 34

**Labels:** seguridad · **Components:** Backend

- **Entorno:** Producción actual
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Inspeccionar notification/actions.ts ('use server')
- **Esperado:** Las funciones internas viven fuera de módulos 'use server'
- **Actual:** createNotificationForAction es una server action exportada sin autenticación; hoy no es explotable solo porque recibe un PrismaClient no serializable
- **Causa raíz:** Viola la convención de CLAUDE.md: los módulos compartidos entre actions van en archivos sin 'use server'.
- **Fix:** Pendiente: mover createNotificationForAction a un módulo sin 'use server'.
- **Test de regresión:** Test que verifica que el módulo 'use server' de notificaciones no exporta funciones sin authenticateUser.

**Criterios de aceptación del fix:**

- Dado el módulo de acciones de notificaciones Cuando se inspecciona Entonces no exporta createNotificationForAction
- Dado los llamadores actuales Cuando se mueve la función Entonces siguen notificando igual

**Hallazgos:** CIERRE-5.5

**Evidencia:** docs/AUDITORIA_CIERRE_2026-09-12.md §5.5 · src/features/notification/actions.ts:1 y :317 (verificado 2026-10-21)

---

<a id="e08"></a>

## E08 — Reportes y Analítica

Dashboard por módulos, reportes de estado de casos, consolidados por servicio y trazabilidad de pagos con exportación a Excel, con visibilidad por rol.

**Objetivo de negocio:** Que la dirección de cada centro vea su carga y su recaudo sin pedirle cifras a nadie.

**Evidencia:** src/features/report/ · src/app/reports/ · README.md

| ID     | Tipo  | Título                                                                   | Pts | Estado | Sprint   | Versión |
| ------ | ----- | ------------------------------------------------------------------------ | --: | ------ | -------- | ------- |
| E08-01 | Story | Dashboard por módulos con ayuda contextual                               |   3 | Done   | 2026-W10 | v0.1.0  |
| E08-02 | Story | Dashboard dinámico y reportes de casos                                   |   5 | Done   | 2026-W13 | v0.2.0  |
| E08-03 | Story | Reporte consolidado de recaudo: recaudado, pendiente y vencido           |   3 | Done   | 2026-W13 | v0.2.0  |
| E08-04 | Story | Reportes consolidados por tipo de servicio                               |   3 | Done   | 2026-W15 | v0.2.0  |
| E08-05 | Story | El reporte de estado no muestra montos engañosos en conciliación y apoyo |   2 | Done   | 2026-W16 | v0.2.0  |
| E08-06 | Story | Exportar la trazabilidad de pagos a Excel                                |   3 | Done   | 2026-W16 | v0.3.0  |

### E08-01 · Story · Dashboard por módulos con ayuda contextual

**Estado:** Done (2026-03-06) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend

Como **operadora de insolvencia**, quiero un tablero de inicio con accesos a cada módulo y ayudas que expliquen qué hace cada uno, para aprender a usar el sistema sin capacitación previa.

**Criterios de aceptación:**

- Dado el dashboard Cuando entro Entonces veo los 6 módulos de tareas
- Dado un módulo Cuando paso el cursor sobre su ayuda Entonces veo qué hace
- **(borde)** Dado un rol sin acceso a un módulo Cuando veo el dashboard Entonces ese módulo no aparece

**Evidencia:** 9c0cc1e feat: agregar tooltips de ayuda contextual en el dashboard · CHANGELOG.md [0.1.0] Dashboard

### E08-02 · Story · Dashboard dinámico y reportes de casos

**Estado:** Done (2026-03-23) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **administrador del centro**, quiero ver gráficos de casos por fase, tipo y operador, para repartir la carga y detectar casos estancados.

**Criterios de aceptación:**

- Dado casos en varias fases Cuando abro el dashboard Entonces veo la distribución por fase
- Dado el reporte de casos Cuando filtro por fechas Entonces se recalcula al pulsar Filtrar
- **(error)** Dado un rol sin permiso de reportes Cuando entra a /reports Entonces es redirigido

**Justificación de la estimación:** Gráficos y consultas agregadas sobre todo el modelo de casos.

**Evidencia:** 82812b5 feat: módulos completos — dashboard dinámico, ... reportes

### E08-03 · Story · Reporte consolidado de recaudo: recaudado, pendiente y vencido

**Estado:** Done (2026-03-24) · **Sprint:** INS 2026-W13 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Frontend, Backend

Como **administrador del centro**, quiero un consolidado de lo recaudado, pendiente y vencido de los acuerdos, para saber cómo va el cumplimiento de los acuerdos del centro.

**Criterios de aceptación:**

- Dado pagos registrados Cuando abro el consolidado Entonces veo recaudado, pendiente y vencido
- **(borde)** Dado un caso sin cronograma Cuando se consolida Entonces no suma cero como pendiente
- Dado un rol limitado Cuando abre el consolidado Entonces solo suma sus casos

**Evidencia:** e777c30 · README.md §Trazabilidad de Pagos (reporte consolidado)

### E08-04 · Story · Reportes consolidados por tipo de servicio

**Estado:** Done (2026-04-08) · **Sprint:** INS 2026-W15 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** feature · **Components:** Backend

Como **administrador del centro**, quiero reportes separados por insolvencia, conciliación y acuerdo de apoyo, para medir cada servicio por su propia lógica.

**Criterios de aceptación:**

- Dado casos de los tres servicios Cuando genero el consolidado Entonces cada servicio tiene su sección
- Dado la numeración por servicio Cuando se reporta Entonces cada caso conserva su prefijo
- **(borde)** Dado un servicio sin casos Cuando se reporta Entonces aparece en cero

**Evidencia:** 269db78 feat(storage): ... numeración por servicio y reportes consolidados

### E08-05 · Story · El reporte de estado no muestra montos engañosos en conciliación y apoyo

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend

Como **administrador del centro**, quiero que el reporte de estado no muestre montos donde el servicio no los tiene, para no leer cifras que no significan nada.

**Criterios de aceptación:**

- Dado un caso de conciliación Cuando aparece en el reporte Entonces no muestra monto (showMonetary false)
- Dado un caso de insolvencia Cuando aparece Entonces sí muestra monto
- **(borde)** Dado un acuerdo de apoyo Cuando aparece Entonces no muestra monto

**Evidencia:** CHANGELOG.md [0.2.0] Reporte Estado de Casos (showMonetary)

### E08-06 · Story · Exportar la trazabilidad de pagos a Excel

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** feature · **Components:** Backend

Como **administrador del centro**, quiero descargar la trazabilidad de pagos en Excel, para compartirla con la dirección o el juzgado.

**Criterios de aceptación:**

- Dado el reporte de pagos Cuando exporto Entonces descargo un Excel con hojas Resumen y Pagos
- **(error)** Dado exportaciones repetidas en poco tiempo Cuando supero el límite Entonces se rechazan
- Dado un rol limitado Cuando exporta Entonces el archivo solo incluye sus casos

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Exportación a Excel del reporte de Trazabilidad de Pagos

---

<a id="e09"></a>

## E09 — Operación y Observabilidad

Logger estructurado con redacción de PII, Sentry (cliente, servidor, edge) con scrub compartido, health check y smoke test post-deploy, runbooks de incidentes y de rotación de credenciales, y la documentación de traspaso.

**Objetivo de negocio:** Que un fallo en producción se vea en minutos y que cualquiera pueda operar el sistema con los runbooks, sin depender de la memoria de Maxi.

**Evidencia:** src/lib/logger.ts · src/lib/sentry-scrub.ts · docs/RUNBOOK.md · docs/IMPLEMENTACION_SEMANA_2.md

| ID     | Tipo  | Título                                                                         | Pts | Estado | Sprint   | Versión     |
| ------ | ----- | ------------------------------------------------------------------------------ | --: | ------ | -------- | ----------- |
| E09-01 | Story | Errores de la app reportados a Sentry y métricas de uso                        |   3 | Done   | 2026-W16 | v0.3.0      |
| E09-02 | Story | Logger estructurado con redacción automática de datos personales               |   5 | Done   | 2026-W28 | v0.4.0      |
| E09-03 | Bug   | La política de contenido bloqueaba el envío de errores del navegador a Sentry  |   1 | Done   | 2026-W35 | v0.5.0      |
| E09-04 | Story | Health check y prueba de humo después de cada despliegue                       |   3 | Done   | 2026-W35 | v0.5.0      |
| E09-05 | Task  | Runbook de incidentes, rollback y despliegue de emergencia                     |   2 | Done   | 2026-W35 | v0.5.0      |
| E09-06 | Bug   | Sentry no capturaba ningún error del servidor                                  |   2 | Done   | 2026-W37 | v0.5.0      |
| E09-07 | Task  | Runbook de rotación del refresh token de Google Drive                          |   2 | Done   | 2026-W38 | v0.6.0      |
| E09-08 | Task  | Runbook de variables de la base de datos y rotación de su contraseña           |   2 | Done   | 2026-W38 | v0.6.0      |
| E09-09 | Bug   | Datos sensibles podían llegar a Sentry en excepciones y breadcrumbs            |   2 | Done   | 2026-W40 | v0.6.0      |
| E09-10 | Story | Un solo camino de reporte a Sentry y sin eventos duplicados                    |   3 | Done   | 2026-W40 | v0.6.0      |
| E09-11 | Story | Saber qué commit está desplegado desde el health check                         |   2 | Done   | 2026-W40 | v0.6.0      |
| E09-12 | Bug   | El error de Chromium sugería una variable CHROME_PATH que no se usa            |   — | Done   | 2026-W38 | v0.6.0      |
| E09-13 | Task  | Documentación técnica para la revisión del cliente                             |   5 | Done   | 2026-W33 | v0.4.0      |
| E09-14 | Task  | Manual de usuario y variables de entorno al día para el traspaso               |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E09-15 | Task  | Sincronizar ARQUITECTURA.md con el sistema real                                |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E09-16 | Task  | Cerrar formalmente el endpoint temporal de prueba de Sentry                    |   1 | To Do  | 2026-W45 | v1.0.0-rc.2 |
| E09-17 | Task  | Confirmar el límite de intentos distribuido en producción                      |   1 | To Do  | 2026-W48 | v1.0.0      |
| E09-18 | Task  | Alertas de Sentry para fallos del cron y de la generación                      |   2 | To Do  | Backlog  | v1.1.0      |
| E09-19 | Task  | Completar los datos pendientes del runbook y verificar Sentry de punta a punta |   1 | To Do  | 2026-W48 | v1.0.0      |
| E09-20 | Task  | Actualizar el runbook de variables para Preview con branch propio              |   1 | To Do  | 2026-W48 | v1.0.0      |

### E09-01 · Story · Errores de la app reportados a Sentry y métricas de uso

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** nfr · **Components:** Backend, Frontend

Como **responsable técnico del sistema**, quiero que los errores de la aplicación lleguen a un panel de monitoreo, para que un fallo se detecte sin esperar a que un usuario lo reporte.

**Criterios de aceptación:**

- Dado un error en servidor Cuando ocurre Entonces se envía a Sentry
- **(borde)** Dado un entorno sin DSN Cuando ocurre un error Entonces degrada a consola sin romper
- Dado el layout Cuando carga Entonces inyecta Vercel Analytics y Speed Insights

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Observabilidad — Sentry, Vercel Analytics

### E09-02 · Story · Logger estructurado con redacción automática de datos personales

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** nfr · **Components:** Backend

Como **responsable técnico del sistema**, quiero logs en JSON con requestId y sin datos personales, para investigar incidentes sin exponer cédulas, correos ni tokens.

**Criterios de aceptación:**

- Dado un contexto con password, token, email, phone o cedula Cuando se registra Entonces aparecen como [REDACTED]
- Dado un logger.error Cuando ocurre Entonces va a consola JSON y a Sentry
- **(borde)** Dado LOG_LEVEL=warn en producción Cuando se llama logger.info Entonces no se emite
- Dado una petición Cuando se registra un log Entonces incluye el requestId

**Justificación de la estimación:** Infraestructura de logging propia con redacción, niveles y migración de rutas críticas (~50 refs).

**Evidencia:** 40a5a59 feat(observability): logger infrastructure + refactor de rutas críticas (Fase 2.1) · 854e694 auto-inyección de requestId · CLAUDE.md §Logger Pattern

### E09-03 · Bug · La política de contenido bloqueaba el envío de errores del navegador a Sentry

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 1 pts

**Labels:** doc-semana-2 · **Components:** Backend

- **Entorno:** Producción hasta agosto 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Provocar un error en el navegador
  2. Buscar el evento en Sentry
- **Esperado:** El evento llega
- **Actual:** La CSP bloqueaba la conexión al dominio de ingest
- **Causa raíz:** connect-src de la CSP no incluía el dominio de ingest de Sentry.
- **Fix:** c51ea96
- **Test de regresión:** Test de headers que verifica el dominio en connect-src.

**Criterios de aceptación del fix:**

- Dado la CSP Cuando se inspecciona Entonces connect-src incluye el ingest de Sentry
- Dado un error de cliente Cuando ocurre Entonces la petición a Sentry no es bloqueada

**Hallazgos:** PP-A-7

**Evidencia:** c51ea96 · docs/IMPLEMENTACION_SEMANA_2.md §2

### E09-04 · Story · Health check y prueba de humo después de cada despliegue

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** nfr, doc-semana-2 · **Components:** Backend, Infra-CI/CD

Como **administrador del centro**, quiero que después de cada despliegue se verifique automáticamente que la app y la base responden, para detectar un despliegue roto antes que los usuarios.

**Criterios de aceptación:**

- Dado /api/health Cuando la base responde Entonces devuelve 200 sin caché
- **(error)** Dado la base caída Cuando se consulta Entonces responde error dentro del timeout y limpia el temporizador
- Dado un despliegue Cuando termina Entonces corre el smoke test

**Hallazgos:** PP-A-5

**Evidencia:** 57fd2c5 feat(ops): health check + smoke test post-deploy (A-5) · docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §4 (health verificado)

### E09-05 · Task · Runbook de incidentes, rollback y despliegue de emergencia

**Estado:** Done (2026-08-26) · **Sprint:** INS 2026-W35 · **Versión:** v0.5.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** doc-semana-2 · **Components:** Infra-CI/CD

- **Objetivo:** Que un incidente se pueda atender con un procedimiento escrito.
- **Alcance:** Rollback de deploy, caída de BD/Drive/SMTP, despliegue manual de emergencia.
- **Definición de terminado:** docs/RUNBOOK.md publicado; los ⟨COMPLETAR⟩ de contactos quedan señalados.

**Criterios de aceptación:**

- Dado un deploy roto Cuando se sigue el runbook Entonces se puede volver a la versión anterior

**Hallazgos:** PP-M-10

**Evidencia:** f542f22 docs(ops): runbook de incidentes, rollback y despliegue de emergencia (M-10)

### E09-06 · Bug · Sentry no capturaba ningún error del servidor

**Estado:** Done (2026-09-07) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Backend

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Provocar un error en una server action
  2. Buscarlo en Sentry
- **Esperado:** El error aparece
- **Actual:** Ningún evento de servidor llegaba
- **Causa raíz:** instrumentation.ts no estaba cableado, así que la config de servidor nunca se inicializaba.
- **Fix:** ba24ec1
- **Test de regresión:** Verificación con evento de prueba durante el incidente de /cases.

**Criterios de aceptación del fix:**

- Dado un error de servidor Cuando ocurre Entonces llega a Sentry
- Dado el arranque del servidor Cuando inicia Entonces instrumentation.ts registra Sentry

**Evidencia:** ba24ec1 feat(observability): cablear instrumentation.ts — sin esto Sentry no captura nada en servidor

### E09-07 · Task · Runbook de rotación del refresh token de Google Drive

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que la renovación del token de Drive (modo Testing, 7 días) no dependa de una persona.
- **Alcance:** Procedimiento con OAuth Playground y referencias corregidas en ARQUITECTURA §9.
- **Definición de terminado:** docs/RUNBOOK_ROTACION_DRIVE.md mergeado (#21).

**Criterios de aceptación:**

- Dado el token vencido Cuando se sigue el runbook Entonces Drive vuelve a funcionar

**Evidencia:** 1b7f7cd · 979099b · #21 dcb0d9a · docs/RUNBOOK_ROTACION_DRIVE.md

### E09-08 · Task · Runbook de variables de la base de datos y rotación de su contraseña

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD, Base-de-Datos

- **Objetivo:** Documentar DATABASE_URL vs DIRECT_URL y cómo rotar neondb_owner.
- **Alcance:** Runbook de env vars y enlace desde RUNBOOK.md.
- **Definición de terminado:** docs/RUNBOOK_ENV_VARS.md publicado.

**Criterios de aceptación:**

- Dado una rotación de credenciales Cuando se sigue el runbook Entonces producción y migraciones siguen funcionando

**Evidencia:** 516bac9 · dfe17fc · de5b894 (rotación de Neon resuelta) · docs/RUNBOOK_ENV_VARS.md

### E09-09 · Bug · Datos sensibles podían llegar a Sentry en excepciones y breadcrumbs

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** seguridad · **Components:** Backend, Testing

- **Entorno:** Producción, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Provocar una excepción cuyo mensaje o extra contiene datos personales
- **Esperado:** El evento llega con los datos redactados
- **Actual:** El scrub solo cubría cookies, headers y query params
- **Causa raíz:** beforeSend no recorría exception values, breadcrumbs ni extra.
- **Fix:** #55 db9c215
- **Test de regresión:** Tests de sentry-scrub sobre excepciones, breadcrumbs y extra.

**Criterios de aceptación del fix:**

- Dado un breadcrumb con un correo Cuando se envía Entonces el correo está redactado
- Dado un extra con token Cuando se envía Entonces está redactado

**Evidencia:** #55 db9c215 · src/lib/sentry-scrub.ts

### E09-10 · Story · Un solo camino de reporte a Sentry y sin eventos duplicados

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** nfr · **Components:** Backend

Como **responsable técnico del sistema**, quiero que cada fallo genere un solo evento en Sentry con su contexto, para no confundir la cantidad real de incidentes.

**Criterios de aceptación:**

- Dado un fallo de generación Cuando ocurre Entonces se registra un solo evento (antes dos)
- Dado logger.error con action Cuando se envía Entonces action llega como tag
- **(borde)** Dado el cron de alertas Cuando falla Entonces usa logger.error con entrega garantizada (waitUntil + flush)

**Evidencia:** #38 cb4c525 · CHANGELOG.md [1.0.0-rc.1] Changed (Un solo wrapper de Sentry)

### E09-11 · Story · Saber qué commit está desplegado desde el health check

**Estado:** Done (2026-10-03) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Backend

Como **responsable técnico del sistema**, quiero consultar qué versión exacta está en producción, para confirmar que un arreglo ya está desplegado.

**Criterios de aceptación:**

- Dado el header autorizado Cuando consulto /api/health Entonces veo el commit desplegado
- **(error)** Dado una petición sin el header Cuando consulto Entonces no se expone el commit
- Dado el smoke test Cuando corre Entonces puede verificar el commit esperado

**Evidencia:** #109 da6e928 · docs/IMPLEMENTACION_SEMANA_2.md (Fuera de alcance: decisión pendiente)

### E09-12 · Bug · El error de Chromium sugería una variable CHROME_PATH que no se usa

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** sin puntos (trivial)

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** dev, septiembre 2026
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Provocar un fallo al lanzar Chromium
- **Esperado:** Un mensaje que no prometa una configuración inexistente
- **Actual:** El mensaje decía que se podía fijar CHROME_PATH
- **Causa raíz:** Texto de error desactualizado.
- **Fix:** 18b8de8
- **Test de regresión:** Ninguno.

**Criterios de aceptación del fix:**

- Dado un fallo de Chromium Cuando se registra Entonces el mensaje no menciona CHROME_PATH
- Dado el mensaje Cuando se lee Entonces indica una acción real

**Evidencia:** 18b8de8

### E09-13 · Task · Documentación técnica para la revisión del cliente

**Estado:** Done (2026-08-12) · **Sprint:** INS 2026-W33 · **Versión:** v0.4.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Entregar a los centros una descripción verificable del sistema.
- **Alcance:** Diccionario de datos, ERD en 3 vistas, diagrama de clases, de componentes, requisitos funcionales/no funcionales (Excel) e índice en README.
- **Definición de terminado:** Documentos en docs/ y enlazados desde el README.

**Criterios de aceptación:**

- Dado el README Cuando se abre Entonces enlaza todos los documentos técnicos

**Justificación de la estimación:** Seis entregables de documentación verificados contra el código.

**Evidencia:** 849d96b · 7280aa9 · 660fffd · c541b75 · docs/DICCIONARIO_DATOS.md · docs/MODELO_ENTIDAD_RELACION.md

### E09-14 · Task · Manual de usuario y variables de entorno al día para el traspaso

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** doc-semana-8 · **Components:** Infra-CI/CD

- **Objetivo:** Que los centros y quien herede el sistema tengan documentación fiel a lo que hace hoy.
- **Alcance:** MANUAL_USUARIO.md reescrito, documentación de variables de entorno y verificación de ARQUITECTURA §2.
- **Definición de terminado:** Mergeado en #141 con la lista exacta de ⟨COMPLETAR⟩ que dependen de terceros.

**Criterios de aceptación:**

- Dado el manual Cuando se compara con la app Entonces describe las pantallas actuales

**Evidencia:** #141 6aa58d1 (c296f88, 7d58d34) · docs/IMPLEMENTACION_SEMANA_8.md §2.4-2.5

### E09-15 · Task · Sincronizar ARQUITECTURA.md con el sistema real

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** doc-semana-9 · **Components:** Infra-CI/CD

- **Objetivo:** Corregir afirmaciones desactualizadas de la arquitectura.
- **Alcance:** §2 describía una BD por centro que no existe; diagrama de §1 corregido.
- **Definición de terminado:** ARQUITECTURA.md coincide con el código (una base, aislamiento por tenantId).

**Criterios de aceptación:**

- Dado ARQUITECTURA §1 y §2 Cuando se comparan con el código Entonces no hay contradicciones

**Hallazgos:** PP-B-5

**Evidencia:** c6ee3d0 docs(arquitectura): §2 describia una BD por centro que no existe · #142 (7aa5f44) · docs/IMPLEMENTACION_SEMANA_9.md §2.1

### E09-16 · Task · Cerrar formalmente el endpoint temporal de prueba de Sentry

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 27

**Labels:** inferido · **Components:** Infra-CI/CD

- **Objetivo:** Dejar trazado el cierre de G-M1.
- **Alcance:** Confirmar que /api/sentry-test-temporal no existe en dev ni main y que el evento de prueba se vio en Sentry; borrar su test si quedara.
- **Definición de terminado:** Nota de cierre en la auditoría con el commit/fecha.

> El endpoint no aparece en src/app/api ni en el historial de dev (verificado 2026-10-21); la auditoría lo vio en la rama fix/sentry-init. Falta solo el registro del cierre.

**Criterios de aceptación:**

- Dado src/app/api Cuando se lista Entonces solo existen cron y health
- Dado la búsqueda en el historial Cuando se ejecuta Entonces se documenta en qué rama vivió el endpoint

**Hallazgos:** G-M1

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §4 (Medio) · ls src/app/api → cron, health (2026-10-21)

### E09-17 · Task · Confirmar el límite de intentos distribuido en producción

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 1 pts · **MoSCoW:** Must · **Rank:** 20

**Labels:** seguridad · **Components:** Infra-CI/CD

- **Objetivo:** Que el rate limiting de login no esté degradado a memoria en producción.
- **Alcance:** Verificar UPSTASH_REDIS_REST_URL/TOKEN en Vercel (production y preview) y que el warn de degradación no aparezca en Sentry.
- **Definición de terminado:** Captura de la configuración y 7 días sin el warn en Sentry.

**Criterios de aceptación:**

- Dado producción Cuando se revisan las variables Entonces Upstash está configurado
- **(error)** Dado el warn de degradación en Sentry Cuando aparece Entonces se trata como incidente

**Hallazgos:** G-B1

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §4 (Bajo) · docs/IMPLEMENTACION_SEMANA_2.md (Requiere acción tuya, punto 1)

### E09-18 · Task · Alertas de Sentry para fallos del cron y de la generación

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 35

**Labels:** nfr · **Components:** Infra-CI/CD

- **Objetivo:** Que un fallo del cron de alertas o de una generación avise a alguien.
- **Alcance:** Reglas de alerta en Sentry por tag action (generation-job, cron) con destinatario definido.
- **Definición de terminado:** Alerta de prueba recibida.

**Criterios de aceptación:**

- Dado un fallo de generación Cuando ocurre Entonces llega una alerta
- Dado un fallo del cron Cuando ocurre Entonces llega una alerta

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md §5 Checklist (Alerta configurada para fallos del cron y errores de generación)

### E09-19 · Task · Completar los datos pendientes del runbook y verificar Sentry de punta a punta

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Media · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 30

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que el runbook sea usable por un tercero.
- **Alcance:** Contactos, proveedor de BD, URL de Sentry; error de prueba de cliente y de servidor visibles.
- **Definición de terminado:** Sin ⟨COMPLETAR⟩ en RUNBOOK.md y evidencia de los dos eventos de prueba.

**Criterios de aceptación:**

- Dado RUNBOOK.md Cuando se busca ⟨COMPLETAR⟩ Entonces no hay resultados
- Dado un error de prueba de cliente y otro de servidor Cuando se disparan Entonces ambos aparecen en Sentry

**Evidencia:** docs/IMPLEMENTACION_SEMANA_2.md (Requiere acción tuya, puntos 2 y 3)

### E09-20 · Task · Actualizar el runbook de variables para Preview con branch propio

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 31

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que el runbook de env vars refleje que Preview tiene su propio branch de Neon.
- **Alcance:** Reescribir §4 de RUNBOOK_ENV_VARS.md y quitar el ⟨VERIFICAR⟩ de §2.
- **Definición de terminado:** Runbook coherente con la infraestructura actual.

**Criterios de aceptación:**

- Dado RUNBOOK_ENV_VARS.md Cuando se lee §4 Entonces describe dos branches (producción y preview)

**Evidencia:** docs/CHECKPOINT_2026-10-09.md §6 · 0dad100 docs(runbook): Preview ya tiene su propio branch de Neon

---

<a id="e10"></a>

## E10 — CI/CD e Infraestructura

GitHub Actions (pr.yml, e2e.yml, release.yml), despliegue por la integración nativa Vercel-GitHub, migraciones gateadas por VERCEL_ENV, Neon (producción y branch de Preview), regla de autoría para el plan Hobby, y los pasos de infraestructura y pagos previos a la entrega.

**Objetivo de negocio:** Que cada cambio llegue a producción verificado y reversible, y que la infraestructura quede a nombre de quien la va a pagar y operar.

**Evidencia:** .github/workflows/ · vercel.json · CLAUDE.md Session 3 · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md

| ID     | Tipo         | Título                                                                      | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | --------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E10-01 | Story        | Despliegue automático a Vercel con migraciones de base                      |   5 | Done   | 2026-W10 | v0.1.0      |
| E10-02 | Story        | Versionado semántico visible y releases automáticos                         |   2 | Done   | 2026-W10 | v0.1.0      |
| E10-03 | Story        | Pruebas automáticas obligatorias en cada pull request                       |   2 | Done   | 2026-W16 | v0.2.0      |
| E10-04 | Story        | Pruebas de extremo a extremo en CI con base sembrada                        |   3 | Done   | 2026-W16 | v0.3.0      |
| E10-05 | Task         | Pruebas de carga con k6 y chequeo de deriva de schema                       |   3 | Done   | 2026-W17 | v0.4.0      |
| E10-06 | Bug          | El build de despliegue fallaba desde abril por validar secretos al importar |   3 | Done   | 2026-W28 | v0.4.0      |
| E10-07 | Task         | Actualizar el runtime de CI a Node 24 y las actions a v5                    |   2 | Done   | 2026-W28 | v0.4.0      |
| E10-08 | Bug          | El despliegue prebuilt fallaba por un módulo de OpenTelemetry               |   2 | Done   | 2026-W33 | v0.4.0      |
| E10-09 | Story        | Migraciones aplicadas solo al desplegar producción                          |   2 | Done   | 2026-W33 | v0.4.0      |
| E10-10 | Task         | Pasar el despliegue a la integración nativa de Vercel                       |   3 | Done   | 2026-W34 | v0.4.0      |
| E10-11 | Bug          | El build de CI se quedaba sin memoria                                       |   2 | Done   | 2026-W36 | v0.5.0      |
| E10-12 | Bug          | Los despliegues de producción fallaban al migrar por el pooler              |   3 | Done   | 2026-W37 | v0.5.0      |
| E10-13 | Task         | Regla permanente de autoría de commits para desbloquear los despliegues     |   2 | Done   | 2026-W37 | v0.5.0      |
| E10-14 | Bug          | El hook de pre-commit fallaba en Windows                                    |   2 | Done   | 2026-W38 | v0.6.0      |
| E10-15 | Task         | Alinear versiones de Prisma y silenciar el aviso de encoding del build      |   1 | Done   | 2026-W38 | v0.6.0      |
| E10-16 | Task         | Correr los quality-checks también en cada push a dev                        |   1 | Done   | 2026-W40 | v0.6.0      |
| E10-17 | Task         | Cachear los navegadores de Playwright en CI                                 |   2 | Done   | 2026-W40 | v0.6.0      |
| E10-18 | Task         | Plan de despliegue en dos tiempos y diagnóstico de promoción a main         |   2 | Done   | 2026-W41 | v0.6.0      |
| E10-19 | Bug          | El historial de migraciones no se podía aplicar sobre una base vacía        |   5 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E10-20 | Bug          | La prueba contra base real se saltaba por el límite de Docker Hub           |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E10-21 | Task         | Separar la base de Preview de la de producción                              |   2 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E10-22 | Bug          | El CI no corría en PRs apilados sobre otra rama                             |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E10-23 | Task         | Publicar la versión 1.0.0-rc.1                                              |   1 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E10-24 | Task         | Probar una restauración real del backup de producción                       |   3 | To Do  | 2026-W48 | v1.0.0      |
| E10-25 | Story        | Desplegar sin reescribir el autor del commit                                |   2 | To Do  | 2026-W48 | v1.0.0      |
| E10-26 | Task         | Transferir las cuentas de infraestructura a los centros                     |   3 | To Do  | 2026-W48 | v1.0.0      |
| E10-27 | Task         | Proteger la rama main con PR y checks obligatorios                          |   1 | To Do  | Backlog  | v1.1.0      |
| E10-28 | Task (spike) | Decidir cómo cerrar la deriva entre migraciones y schema                    |   2 | To Do  | Backlog  | v1.1.0      |
| E10-29 | Task         | Cerrar la deriva entre el historial de migraciones y el schema              |   5 | To Do  | Backlog  | v1.1.0      |
| E10-30 | Task         | Publicar la versión 1.0.0 y entregarla a los centros                        |   1 | To Do  | 2026-W48 | v1.0.0      |

### E10-01 · Story · Despliegue automático a Vercel con migraciones de base

**Estado:** Done (2026-03-02) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Infra-CI/CD

Como **responsable técnico del sistema**, quiero que cada versión aprobada se despliegue sola, para recibir arreglos sin depender de un despliegue manual.

**Criterios de aceptación:**

- Dado un push a la rama de producción Cuando corre el pipeline Entonces se despliega en Vercel
- **(borde)** Dado una base existente sin historial de migraciones Cuando se despliega Entonces se aplica el baseline de 20260205212559_init
- **(error)** Dado un build que se queda sin memoria Cuando corre en CI Entonces se usa el heap ampliado

**Justificación de la estimación:** Cinco commits de ajuste de pipeline, baseline de Prisma y cuenta de equipo de Vercel.

**Evidencia:** fcd2670 · 7f73223 · 729a4c8 baseline migración Prisma · 8f90c6d heap · 668fdf1

### E10-02 · Story · Versionado semántico visible y releases automáticos

**Estado:** Done (2026-03-08) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD, Frontend

Como **administrador del centro**, quiero ver qué versión del sistema estoy usando, para reportar problemas indicando la versión exacta.

**Criterios de aceptación:**

- Dado la app Cuando la abro Entonces veo la versión en la esquina con sufijo -dev fuera de producción
- Dado un tag v\* Cuando se publica Entonces se crea el release de GitHub con notas
- **(borde)** Dado package.json Cuando cambia la versión Entonces es la única fuente de verdad

**Evidencia:** 3cc0b73 feat: implementar sistema de versionamiento semántico v0.1.0 · CHANGELOG.md [0.1.0] Versioning system

### E10-03 · Story · Pruebas automáticas obligatorias en cada pull request

**Estado:** Done (2026-04-14) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD, Testing

Como **responsable técnico del sistema**, quiero que ningún cambio se integre sin pasar las pruebas, para no recibir en producción regresiones que ya estaban cubiertas.

**Criterios de aceptación:**

- Dado un PR Cuando se abre Entonces corre jest --ci
- **(error)** Dado un test rojo Cuando corre el PR Entonces el check falla
- Dado lint, prisma generate y build Cuando corre el PR Entonces también se ejecutan

**Evidencia:** CHANGELOG.md [0.2.0] Tests en CI · .github/workflows/pr.yml

### E10-04 · Story · Pruebas de extremo a extremo en CI con base sembrada

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Infra-CI/CD, Testing

Como **responsable técnico del sistema**, quiero que los flujos principales se prueben en un navegador real en cada PR, para detectar roturas que las pruebas unitarias no ven.

**Criterios de aceptación:**

- Dado un PR Cuando corre e2e.yml Entonces Playwright prueba los flujos con Postgres y seed determinístico
- **(error)** Dado un fallo E2E Cuando ocurre Entonces se publican el reporte HTML y los traces
- Dado workflow_dispatch Cuando se dispara a mano Entonces corre sobre la rama elegida

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Workflow e2e.yml

### E10-05 · Task · Pruebas de carga con k6 y chequeo de deriva de schema

**Estado:** Done (2026-04-20) · **Sprint:** INS 2026-W17 · **Versión:** v0.4.0 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** nfr · **Components:** Testing, Infra-CI/CD

- **Objetivo:** Tener herramientas para medir carga y detectar deriva entre schema y base.
- **Alcance:** Scripts k6 (tests/load) y chequeo de schema drift.
- **Definición de terminado:** Scripts test:load:\* disponibles.

**Criterios de aceptación:**

- Dado los scripts de carga Cuando se ejecutan contra un entorno Entonces reportan latencias y errores

**Evidencia:** 2c43446 chore(tests): add k6 load tests + schema drift check

### E10-06 · Bug · El build de despliegue fallaba desde abril por validar secretos al importar

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend, Infra-CI/CD

- **Entorno:** GitHub Actions / Vercel, abril-julio 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Correr next build con vercel pull (sin variables sensitive)
- **Esperado:** El build termina
- **Actual:** El build fallaba al importar auth.ts y email.ts
- **Causa raíz:** JWT_SECRET y la config SMTP se validaban en import; next build recolecta page data sin secretos.
- **Fix:** 9768da7 (lazy-init SMTP) + a1eaf45 (lazy-init JWT_SECRET)
- **Test de regresión:** Convención en CLAUDE.md: validar env vars en el primer uso, nunca en import.

**Criterios de aceptación del fix:**

- Dado un build sin secretos Cuando corre Entonces termina
- **(error)** Dado una acción que usa JWT sin secreto Cuando se ejecuta Entonces falla en runtime con mensaje claro

**Evidencia:** 9768da7 · a1eaf45 · CLAUDE.md Session 2 (CI Stabilization)

### E10-07 · Task · Actualizar el runtime de CI a Node 24 y las actions a v5

**Estado:** Done (2026-07-11) · **Sprint:** INS 2026-W28 · **Versión:** v0.4.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Evitar la deprecación de runners y hacer visible el type-check.
- **Alcance:** Node 20→24 en los 3 workflows, checkout/setup-node v4→v5, type-check explícito y npm audit visible no bloqueante.
- **Definición de terminado:** Workflows verdes sin anotaciones de deprecación.

**Criterios de aceptación:**

- Dado un PR Cuando corre pr.yml Entonces usa Node 24 y ejecuta tsc --noEmit

**Evidencia:** f2798b0 · a050d2a · b4ef6dc

### E10-08 · Bug · El despliegue prebuilt fallaba por un módulo de OpenTelemetry

**Estado:** Done (2026-08-12) · **Sprint:** INS 2026-W33 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Entorno:** Vercel, agosto 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Desplegar con vercel deploy --prebuilt
- **Esperado:** Despliegue exitoso
- **Actual:** Fallo en ~2 s con ENOENT @opentelemetry/api
- **Causa raíz:** @opentelemetry/api no se externalizaba en el bundle.
- **Fix:** ae6b2ae: serverExternalPackages ['@opentelemetry/api']
- **Test de regresión:** Validado con preview nativo real (70868c6).

**Criterios de aceptación del fix:**

- Dado un build en Vercel Cuando se despliega Entonces no aparece ENOENT @opentelemetry/api
- Dado next.config.ts Cuando se inspecciona Entonces externaliza el paquete

**Evidencia:** ae6b2ae · CLAUDE.md Session 3

### E10-09 · Story · Migraciones aplicadas solo al desplegar producción

**Estado:** Done (2026-08-13) · **Sprint:** INS 2026-W33 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD, Base-de-Datos

Como **responsable técnico del sistema**, quiero que las migraciones corran solas en producción y nunca en un preview, para que un preview no altere la base real.

**Criterios de aceptación:**

- Dado VERCEL_ENV=production Cuando corre el buildCommand Entonces ejecuta prisma migrate deploy
- **(error)** Dado un preview Cuando se construye Entonces no ejecuta migraciones
- Dado una migración fallida Cuando corre Entonces el build falla y no se publica

**Evidencia:** 6090f1f build(vercel): run prisma migrate deploy in production build (gated by VERCEL_ENV) · vercel.json

### E10-10 · Task · Pasar el despliegue a la integración nativa de Vercel

**Estado:** Done (2026-08-18) · **Sprint:** INS 2026-W34 · **Versión:** v0.4.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Dejar de tapar los previews nativos con un workflow que fallaba siempre.
- **Alcance:** Eliminar .github/workflows/deploy.yml; validar preview de dev y promoción a main por fast-forward.
- **Definición de terminado:** Preview de dev (70868c6) y producción Ready verde con migraciones corridas por el guard.

**Criterios de aceptación:**

- Dado un push a dev Cuando Vercel construye Entonces el preview queda Ready sin workflow propio

**Evidencia:** 70868c6 · c53fbc5 · CLAUDE.md Session 3

### E10-11 · Bug · El build de CI se quedaba sin memoria

**Estado:** Done (2026-09-04) · **Sprint:** INS 2026-W36 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Entorno:** GitHub Actions, septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir un PR
  2. Esperar el paso de build
- **Esperado:** Build verde
- **Actual:** OOM del proceso de Node
- **Causa raíz:** Límite de heap por defecto insuficiente para el build en el runner.
- **Fix:** #5 1ad141b
- **Test de regresión:** CI verde en los PR siguientes.

**Criterios de aceptación del fix:**

- Dado un PR Cuando corre el build Entonces termina sin OOM
- Dado el workflow Cuando se inspecciona Entonces fija el límite de memoria

**Evidencia:** #5 1ad141b fix(ci): resolver el OOM del build en GitHub Actions

### E10-12 · Bug · Los despliegues de producción fallaban al migrar por el pooler

**Estado:** Done (2026-09-10) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Crítica · **Estimación:** 3 pts

**Labels:** — · **Components:** Infra-CI/CD, Base-de-Datos

- **Entorno:** Producción (Vercel + Neon), septiembre 2026
- **Severidad:** Crítica
- **Pasos para reproducir:**
  1. Promover a main con una migración pendiente
- **Esperado:** migrate deploy corre y el despliegue queda Ready
- **Actual:** La migración iba por el pooler de Neon y fallaba, bloqueando producción
- **Causa raíz:** El datasource no declaraba directUrl; migrate deploy usaba DATABASE_URL (pooler).
- **Fix:** #13 e9dd65a + commit de punta autorado c73454d
- **Test de regresión:** Segunda verificación en producción documentada (aa1acc5).

**Criterios de aceptación del fix:**

- Dado una migración pendiente Cuando se despliega producción Entonces corre por DIRECT_URL
- Dado el schema Cuando se inspecciona Entonces declara directUrl

**Evidencia:** #13 e9dd65a · 1c4bdf5 · aa1acc5 · docs/CHECKPOINT_2026-09-09.md

### E10-13 · Task · Regla permanente de autoría de commits para desbloquear los despliegues

**Estado:** Done (2026-09-10) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que el plan Hobby de Vercel no bloquee despliegues por autor de commit.
- **Alcance:** Regla en CLAUDE.md (MaxitoJM en sus dos formas o Insolventic en la punta), chequeo previo al push y commits de punta autorados.
- **Definición de terminado:** Regla escrita y despliegues de producción desbloqueados.

**Criterios de aceptación:**

- Dado un push a main o dev Cuando se verifica el autor de la punta Entonces es una de las identidades permitidas
- Dado un commit Cuando se revisa el cuerpo Entonces no tiene trailers de agente

**Evidencia:** 596dae6 · 88dfd2e · f2497a8 · c73454d · CLAUDE.md §Autoría de commits · issue #7

### E10-14 · Bug · El hook de pre-commit fallaba en Windows

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Entorno:** Máquina de desarrollo Windows, septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Hacer git commit en Windows con el hook de husky
- **Esperado:** El hook corre
- **Actual:** Falla por comillas en el PATH y obligaba a --no-verify
- **Causa raíz:** Comillas en el PATH que el script de husky no manejaba.
- **Fix:** 5a7bec3 (issue #17)
- **Test de regresión:** Commits posteriores sin --no-verify.

**Criterios de aceptación del fix:**

- Dado Windows Cuando se hace commit Entonces el hook corre sin --no-verify
- Dado Linux/macOS Cuando se hace commit Entonces el hook sigue funcionando

**Evidencia:** 5a7bec3 · issue #17 · 75c783b

### E10-15 · Task · Alinear versiones de Prisma y silenciar el aviso de encoding del build

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 1 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Eliminar ruido del build y desalineación de versiones.
- **Alcance:** prisma y @prisma/client en 6.19.3; aviso Can't resolve 'encoding' de html-to-docx sin instalar dependencias.
- **Definición de terminado:** Build sin esos avisos.

**Criterios de aceptación:**

- Dado npm run build Cuando corre Entonces no muestra el aviso de encoding

**Evidencia:** 50d96ed · 1c068a1

### E10-16 · Task · Correr los quality-checks también en cada push a dev

**Estado:** Done (2026-09-28) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que un push directo a dev no esquive lint, types y tests.
- **Alcance:** Trigger push en pr.yml para dev.
- **Definición de terminado:** quality-checks visible en los pushes a dev.

**Criterios de aceptación:**

- Dado un push a dev Cuando llega Entonces corre quality-checks

**Evidencia:** 3eccc72 ci(pr.yml): correr quality-checks tambien en push a dev

### E10-17 · Task · Cachear los navegadores de Playwright en CI

**Estado:** Done (2026-10-03) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Detener la degradación del paso de instalación (28 s → 572 s) que agotaba el timeout del job.
- **Alcance:** actions/cache de ~/.cache/ms-playwright por versión de @playwright/test; en cache-hit solo install-deps.
- **Definición de terminado:** Cache-hit visible y job dentro de su timeout.

**Criterios de aceptación:**

- Dado una corrida con caché Cuando arranca Entonces no descarga el navegador

**Evidencia:** #111 a9802ee · CLAUDE.md Quick Win 6

### E10-18 · Task · Plan de despliegue en dos tiempos y diagnóstico de promoción a main

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD, Base-de-Datos

- **Objetivo:** Promover a producción sin romper por migraciones destructivas.
- **Alcance:** Plan para el DROP COLUMN de #40 (código primero, migración después) e inventario de 8 migraciones desde la última promoción.
- **Definición de terminado:** docs/DEPLOY_PR40.md y docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md.

**Criterios de aceptación:**

- Dado una migración destructiva Cuando se promueve Entonces sigue el plan en dos tiempos

**Evidencia:** #58 7733272 · cd685cf · docs/DEPLOY_PR40.md · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md

### E10-19 · Bug · El historial de migraciones no se podía aplicar sobre una base vacía

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Base-de-Datos, Testing

- **Entorno:** Base nueva / restauración, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Crear una base vacía
  2. Ejecutar prisma migrate deploy
- **Esperado:** La base queda construida
- **Actual:** La cadena de migraciones fallaba antes de terminar
- **Causa raíz:** Migraciones que asumían objetos creados por db push y nunca migrados.
- **Fix:** #122 2f1375c
- **Test de regresión:** tests/db/migraciones-desde-cero.db.test.ts con BRECHA_CONOCIDA (guardián bidireccional).

**Criterios de aceptación del fix:**

- Dado una base vacía Cuando se aplica el historial Entonces termina sin error
- Dado deriva nueva o cerrada Cuando corre el guardián Entonces falla y lo señala

**Justificación de la estimación:** Reparar el replay sin tocar producción e inventariar 30 statements de deriva restante.

**Evidencia:** #122 2f1375c · CLAUDE.md Fase 3 (deriva)

### E10-20 · Bug · La prueba contra base real se saltaba por el límite de Docker Hub

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Infra-CI/CD, Testing

- **Entorno:** GitHub Actions, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir un PR que toca la base
  2. Ver el job de e2e.yml
- **Esperado:** test:db corre
- **Actual:** Initialize containers fallaba con toomanyrequests y test:db quedaba skipped (parecido a passed)
- **Causa raíz:** Pull anónimo de postgres:16-alpine sujeto al rate limit por IP compartida del runner.
- **Fix:** #127 92b416b: PostgreSQL 16 preinstalado del runner, con CREATEDB y OWNER
- **Test de regresión:** La prueba de humo del paso imprime la versión de PostgreSQL.

**Criterios de aceptación del fix:**

- Dado un PR Cuando corre e2e.yml Entonces test:db usa el Postgres del runner
- Dado el replay de migraciones Cuando crea y borra su base Entonces tiene permiso CREATEDB

**Evidencia:** #127 92b416b · CLAUDE.md Quick Win 7 · docs/CHECKPOINT_2026-10-09.md §3

### E10-21 · Task · Separar la base de Preview de la de producción

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** inferido · **Components:** Infra-CI/CD, Base-de-Datos

- **Objetivo:** Que los previews no escriban en la base de producción.
- **Alcance:** Branch propio de Neon para Preview en Vercel y runbook actualizado.
- **Definición de terminado:** Preview apunta a su branch; documentado en el runbook.

> La configuración vive en Vercel/Neon, fuera del repo; la evidencia es el commit de documentación.

**Criterios de aceptación:**

- Dado un deploy de preview Cuando escribe datos Entonces lo hace en el branch de Preview

**Evidencia:** 0dad100 docs(runbook): Preview ya tiene su propio branch de Neon · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md §2.1

### E10-22 · Bug · El CI no corría en PRs apilados sobre otra rama

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** doc-semana-9 · **Components:** Infra-CI/CD

- **Entorno:** GitHub Actions, octubre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Abrir un PR cuya base es una rama de feature
- **Esperado:** Corren quality-checks y playwright
- **Actual:** Ningún workflow se encolaba y el PR mostraba solo checks verdes ajenos
- **Causa raíz:** pull_request con filtro branches: [dev, main] en pr.yml y e2e.yml.
- **Fix:** #142 (cc3d2de): quitar el filtro branches del trigger pull_request
- **Test de regresión:** PR apilado de prueba con los dos workflows corriendo.

**Criterios de aceptación del fix:**

- Dado un PR apilado Cuando se abre Entonces corren pr.yml y e2e.yml
- Dado un PR a dev Cuando se abre Entonces sigue corriendo igual

**Evidencia:** #142 7edc0cf · CLAUDE.md Quick Win 8 · docs/IMPLEMENTACION_SEMANA_9.md §2.2

### E10-23 · Task · Publicar la versión 1.0.0-rc.1

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** doc-semana-9 · **Components:** Infra-CI/CD

- **Objetivo:** Marcar el primer candidato a lanzamiento.
- **Alcance:** Versión en package.json y entradas del CHANGELOG de los PR #126 a #149.
- **Definición de terminado:** 1.0.0-rc.1 en package.json y CHANGELOG; promovido a main.

**Criterios de aceptación:**

- Dado main Cuando se consulta la versión Entonces es 1.0.0-rc.1

**Evidencia:** #142 (2a35e51) · #143 21f0c08 · 8b817c5 · CHANGELOG.md [1.0.0-rc.1]

### E10-24 · Task · Probar una restauración real del backup de producción

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 3 pts · **MoSCoW:** Must · **Rank:** 21

**Labels:** nfr · **Components:** Base-de-Datos, Infra-CI/CD

- **Objetivo:** Que el procedimiento de restauración del runbook deje de ser teórico.
- **Alcance:** Verificar PITR/backups de Neon, restaurar a una instancia nueva, validar datos y medir el tiempo; documentar en RUNBOOK §3.1.
- **Definición de terminado:** Restauración ejecutada y registrada con fecha, punto de restauración y tiempo total.

**Criterios de aceptación:**

- Dado un punto de restauración Cuando se restaura a una instancia nueva Entonces la app de preview funciona contra ella
- **(error)** Dado la restauración Cuando se ejecuta Entonces nunca se hace encima de la base productiva
- Dado el resultado Cuando se documenta Entonces incluye el RTO medido

**Hallazgos:** PP-A-4

**Dependencias:** blocks E10-30

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md A-4 · docs/IMPLEMENTACION_SEMANA_2.md (A-4 sigue abierto) · docs/RUNBOOK.md §3.1

### E10-25 · Story · Desplegar sin reescribir el autor del commit

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 22

**Labels:** — · **Components:** Infra-CI/CD

Como **responsable técnico del sistema**, quiero que cualquier cambio aprobado se despliegue sin trucos manuales, para no depender de una sola persona que sepa hacer el amend de autor.

**Criterios de aceptación:**

- Dado un push a main con autor MaxitoJM Cuando Vercel lo recibe Entonces el despliegue no queda Blocked
- **(error)** Dado un autor no vinculado Cuando se despliega Entonces el bloqueo se documenta en el runbook
- Dado la decisión (vincular la cuenta de MaxitoJM o pasar a Vercel Pro) Cuando se toma Entonces queda registrada con su costo

**Dependencias:** blocks E10-26

**Evidencia:** issue #7 · CLAUDE.md Session 3 (Pendiente a futuro) · docs/IMPLEMENTACION_SEMANA_4.md §6 decisión 6 · docs/CHECKPOINT_2026-10-09.md §6

### E10-26 · Task · Transferir las cuentas de infraestructura a los centros

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 3 pts · **MoSCoW:** Must · **Rank:** 23

**Labels:** inferido · **Components:** Infra-CI/CD

- **Objetivo:** Que Vercel, Neon, Upstash, Sentry, Google Cloud (Drive) y GitHub queden a nombre de quien opera y paga el sistema.
- **Alcance:** Inventario de cuentas y variables, transferencia o invitación, rotación de credenciales tras el traspaso.
- **Definición de terminado:** Inventario firmado por los centros y credenciales rotadas.

> No hay evidencia en el repo; proviene del contexto de la tarea (regla de Maxi: infraestructura y pagos al final).

**Criterios de aceptación:**

- Dado el inventario de servicios Cuando se transfiere cada uno Entonces el centro es propietario
- **(error)** Dado una credencial compartida durante el traspaso Cuando termina Entonces se rota
- Dado el despliegue tras la transferencia Cuando se hace Entonces producción sigue Ready

**Dependencias:** is blocked by E10-25 · blocks E10-27, E10-30

**Evidencia:** Brief de la tarea (transferencia de cuenta) — sin documento en el repo · README.md §Variables de Entorno (servicios involucrados)

### E10-27 · Task · Proteger la rama main con PR y checks obligatorios

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 36

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que nada llegue a main sin pasar por PR y CI.
- **Alcance:** Hoy imposible: repo privado bajo cuenta de usuario en plan Free (rulesets → 403). Requiere GitHub Pro, organización o repo público.
- **Definición de terminado:** Branch protection activa en main o riesgo aceptado por escrito.

**Criterios de aceptación:**

- Dado un push directo a main Cuando se intenta Entonces GitHub lo rechaza
- **(borde)** Dado que no se pague el plan Cuando se decide Entonces el riesgo queda aceptado por escrito

**Hallazgos:** PP-M-8

**Dependencias:** is blocked by E10-26

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-8 · docs/CHECKPOINT_2026-09-01.md (M-8: 404/403, plan Free)

### E10-28 · Task (spike) · Decidir cómo cerrar la deriva entre migraciones y schema

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 37

**Labels:** spike · **Components:** Base-de-Datos

- **Objetivo:** Elegir entre migración de catch-up idempotente y baseline/squash del historial.
- **Alcance:** Evaluar las dos salidas contra Neon (30 statements: 3 tablas, 5 columnas, 14 índices, 7 FKs, 1 DropEnum).
- **Definición de terminado:** Decisión escrita en CLAUDE.md con la ventana de ejecución.

**Criterios de aceptación:**

- Dado las dos opciones Cuando se evalúan con acceso a Neon Entonces se elige una con su plan de rollback
- **(borde)** Dado la opción baseline Cuando se elige Entonces el plan incluye migrate resolve --applied por cada base

**Dependencias:** blocks E10-29

**Evidencia:** CLAUDE.md Fase 3 (deriva, bloqueado: necesita Neon) · docs/CHECKPOINT_2026-10-09.md §6

### E10-29 · Task · Cerrar la deriva entre el historial de migraciones y el schema

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 38

**Labels:** — · **Components:** Base-de-Datos

- **Objetivo:** Que una base construida desde cero sea idéntica a schema.prisma.
- **Alcance:** Implementar la opción elegida en E10-28 y vaciar BRECHA_CONOCIDA.
- **Definición de terminado:** migrate diff entre replay y schema vacío; el guardián falla por 'ya no está roto' y se actualiza.

**Criterios de aceptación:**

- Dado una base vacía Cuando se aplica el historial Entonces coincide con schema.prisma
- **(error)** Dado producción Cuando se aplica el cambio Entonces es no-op o queda marcado como aplicado sin tocar datos

**Justificación de la estimación:** Toca el historial de migraciones con riesgo directo sobre producción si se elige baseline.

**Dependencias:** is blocked by E10-28

**Evidencia:** CLAUDE.md Fase 3 · tests/db/migraciones-desde-cero.db.test.ts (BRECHA_CONOCIDA)

### E10-30 · Task · Publicar la versión 1.0.0 y entregarla a los centros

**Estado:** To Do · **Sprint:** INS 2026-W48 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 1 pts · **MoSCoW:** Must · **Rank:** 24

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Cerrar el ciclo de lanzamiento.
- **Alcance:** Promover dev a main, tag v1.0.0, release de GitHub, CHANGELOG [1.0.0], verificación de autoría de la punta.
- **Definición de terminado:** Producción Ready en 1.0.0 y health check con el commit del tag.

**Criterios de aceptación:**

- Dado UAT firmado y backup probado Cuando se promueve Entonces main queda en 1.0.0
- **(error)** Dado un autor de punta no permitido Cuando se va a pushear Entonces el chequeo de CLAUDE.md lo detiene

**Dependencias:** is blocked by E14-14, E10-24, E10-26

**Evidencia:** README.md §Versionado · .github/workflows/release.yml · CLAUDE.md §Verificación obligatoria antes de pushear

---

<a id="e11"></a>

## E11 — Cumplimiento Legal

Corrección normativa de las plantillas (Ley 1564/2012, Decreto 2677/2012, Ley 2220/2022, Ley 2445/2025), protección de datos personales (Ley 1581/2012: privacidad, términos, ARCO, retención) y la lista única de decisiones que dependen de la abogada o de los centros.

**Objetivo de negocio:** Que el sistema no afirme en un documento radicado nada jurídicamente falso y que el tratamiento de datos personales cumpla la Ley 1581.

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md · docs/PROCEDIMIENTO_ARCO.md · docs/IMPLEMENTACION_SEMANA_8.md · docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §Nota de alcance

| ID     | Tipo         | Título                                                                             | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ---------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E11-01 | Story        | Páginas públicas de política de privacidad y términos de uso                       |   3 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E11-02 | Task         | Procedimiento interno para solicitudes sobre datos personales (ARCO)               |   2 | Done   | 2026-W42 | v1.0.0-rc.1 |
| E11-03 | Task         | Lista única de pendientes de decisión legal                                        |   1 | Done   | 2026-W40 | v0.6.0      |
| E11-04 | Bug          | El Acta de Disolución citaba una ley derogada                                      |   1 | Done   | 2026-W40 | v0.6.0      |
| E11-05 | Story        | Fundamento normativo genérico en tres plantillas de conciliación                   |   2 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E11-06 | Task (spike) | Investigar si la cita a la Ley 640 en otras plantillas es un simple cambio de cita |   1 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E11-07 | Task         | Confirmar con la abogada el texto de Fracaso por reforma del acuerdo               |   1 | To Do  | Backlog  | v1.1.0      |
| E11-08 | Story        | Fundamento normativo correcto en dos plantillas de insolvencia y una de apoyo      |   2 | To Do  | Backlog  | v1.1.0      |
| E11-09 | Task         | Confirmar el SMMLV 2026 fijado por norma transitoria                               |   1 | To Do  | 2026-W45 | v1.0.0-rc.2 |
| E11-10 | Story        | Generar el Check List con el Parágrafo 3 resuelto                                  |   3 | To Do  | 2026-W45 | v1.0.0-rc.2 |
| E11-11 | Story        | Alerta del plazo de corrección después de una nulidad                              |   5 | To Do  | Backlog  | v1.1.0      |
| E11-12 | Story        | Imprimir el párrafo de comparendos e impuestos pendientes del vehículo             |   2 | To Do  | Backlog  | v1.1.0      |
| E11-13 | Task         | Completar los datos de los centros en la política de privacidad                    |   2 | To Do  | 2026-W46 | v1.0.0      |
| E11-14 | Task         | Completar el procedimiento ARCO con responsables y plazos                          |   2 | To Do  | 2026-W46 | v1.0.0      |
| E11-15 | Task         | Revisión legal de los textos de privacidad y términos                              |   1 | To Do  | 2026-W46 | v1.0.0      |
| E11-16 | Task         | Cargar el SMMLV de 2027 cuando se expida el decreto                                |   1 | To Do  | Backlog  | v1.1.0      |
| E11-17 | Task (spike) | Decidir la política de retención y borrado de expedientes                          |   2 | To Do  | 2026-W46 | v1.0.0      |
| E11-18 | Task         | Validación jurídica de los umbrales de las reglas del trámite                      |   2 | To Do  | 2026-W46 | v1.0.0      |

### E11-01 · Story · Páginas públicas de política de privacidad y términos de uso

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** doc-semana-8 · **Components:** Frontend

Como **deudor (titular de los datos)**, quiero leer cómo el centro trata mis datos y en qué términos uso el sistema, sin iniciar sesión, para conocer mis derechos sobre mis datos personales (Ley 1581/2012).

> Borrador pendiente de revisión legal (E11-15) y de datos de los centros (E11-13).

**Criterios de aceptación:**

- Dado un visitante sin sesión Cuando abre /privacidad o /terminos Entonces ve la página
- Dado el middleware Cuando evalúa esas rutas Entonces las trata como públicas
- **(borde)** Dado un dato aún no entregado por los centros Cuando se muestra Entonces aparece marcado como pendiente, no inventado

**Evidencia:** #141 6aa58d1 (ae4257b) · docs/IMPLEMENTACION_SEMANA_8.md §2.1 · CHANGELOG.md [1.0.0-rc.1] Documentación

### E11-02 · Task · Procedimiento interno para solicitudes sobre datos personales (ARCO)

**Estado:** Done (2026-10-17) · **Sprint:** INS 2026-W42 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** doc-semana-8 · **Components:** Infra-CI/CD

- **Objetivo:** Que el centro sepa cómo atender una solicitud de conocer, corregir o suprimir datos.
- **Alcance:** docs/PROCEDIMIENTO_ARCO.md con los pasos y los ⟨COMPLETAR⟩ que dependen de la abogada.
- **Definición de terminado:** Documento mergeado con la lista exacta de datos pendientes.

**Criterios de aceptación:**

- Dado una solicitud de supresión Cuando se sigue el procedimiento Entonces se sabe qué hacer en cada paso

**Evidencia:** #141 (518714d) · docs/PROCEDIMIENTO_ARCO.md

### E11-03 · Task · Lista única de pendientes de decisión legal

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** — · **Components:** Documentos-PDF

- **Objetivo:** Dejar de recitar de memoria las preguntas legales repartidas en varios documentos.
- **Alcance:** Índice único con pregunta, qué bloquea y dónde vive el detalle.
- **Definición de terminado:** docs/PENDIENTES_DECISION_LEGAL.md con la convención de cierre.

**Criterios de aceptación:**

- Dado una decisión legal respondida Cuando se registra Entonces se marca con fecha en la lista

**Evidencia:** #90 fe7e1df · docs/PENDIENTES_DECISION_LEGAL.md

### E11-04 · Bug · El Acta de Disolución citaba una ley derogada

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 1 pts

**Labels:** — · **Components:** Documentos-PDF

- **Entorno:** Producción, octubre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar el Acta de Disolución de Unión Marital
- **Esperado:** Cita la Ley 2220 de 2022
- **Actual:** Citaba la Ley 640 de 2001, derogada
- **Causa raíz:** Texto normativo de la plantilla sin actualizar.
- **Fix:** 0f15dbf
- **Test de regresión:** Barrido de citas a la Ley 640 en las plantillas (#98).

**Criterios de aceptación del fix:**

- Dado el Acta de Disolución Cuando se genera Entonces cita la Ley 2220/2022
- Dado el barrido Cuando se buscan citas a la Ley 640 Entonces quedan inventariadas las restantes

**Evidencia:** 0f15dbf · #98 89cf8cf · docs/PENDIENTES_DECISION_LEGAL.md ítem 7

### E11-05 · Story · Fundamento normativo genérico en tres plantillas de conciliación

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Documentos-PDF

Como **conciliadora**, quiero que la Aclaración de Acta, el Auto de Desistimiento y el Informe Conciliador citen la norma, para que ningún documento del centro carezca de fundamento.

**Criterios de aceptación:**

- Dado las 3 plantillas Cuando se generan Entonces citan la Ley 2220 de 2022 de forma genérica
- **(borde)** Dado la decisión legal Cuando se cita Entonces no se nombran artículos ni decretos
- Dado las otras plantillas de conciliación Cuando se generan Entonces no cambian

**Hallazgos:** LEGAL-8

**Evidencia:** #129 1683150 · docs/PENDIENTES_DECISION_LEGAL.md §6.1

### E11-06 · Task (spike) · Investigar si la cita a la Ley 640 en otras plantillas es un simple cambio de cita

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Media · **Estimación:** 1 pts

**Labels:** spike · **Components:** Documentos-PDF

- **Objetivo:** Evitar corregir una cita que en realidad es una cláusula de registro con otro sentido.
- **Alcance:** Revisión de las 2 plantillas de insolvencia y 1 de support-agreements.
- **Definición de terminado:** Conclusión escrita: no es un cambio de cita; dos preguntas concretas para la abogada.

**Criterios de aceptación:**

- Dado las 3 plantillas Cuando se analizan Entonces quedan formuladas las preguntas legales concretas

**Dependencias:** blocks E11-08

**Evidencia:** ad88c1a docs(legal): item 7 investigado y NO tocado · docs/PENDIENTES_DECISION_LEGAL.md §3.0

### E11-07 · Task · Confirmar con la abogada el texto de Fracaso por reforma del acuerdo

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 39

**Labels:** legal-pendiente · **Components:** Documentos-PDF

- **Objetivo:** Validar que la Constancia de No Acuerdo — Reforma sirve para el desenlace ⓓ de Acuerdo reformado.
- **Alcance:** Revisión del texto por la abogada.
- **Definición de terminado:** Respuesta registrada en PENDIENTES_DECISION_LEGAL.md (ítem 3).

**Criterios de aceptación:**

- Dado la respuesta de la abogada Cuando llega Entonces se registra con fecha
- **(borde)** Dado que el texto no sirva Cuando se responde Entonces se crea la historia de la plantilla nueva

**Hallazgos:** LEGAL-3

**Dependencias:** blocks E12-08

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 3 · docs/DISENO_FASES_NUEVAS_2026-09-11.md §3 (nota de seguimiento)

### E11-08 · Story · Fundamento normativo correcto en dos plantillas de insolvencia y una de apoyo

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 40

**Labels:** legal-pendiente · **Components:** Documentos-PDF

Como **abogado del centro**, quiero que la cláusula de registro de esas 3 plantillas tenga el fundamento que corresponde, para no radicar documentos que citan una norma derogada.

**Criterios de aceptación:**

- Dado la respuesta legal Cuando se aplica Entonces las 3 plantillas citan la norma indicada
- **(borde)** Dado que la abogada concluya que la cláusula sobra Cuando se aplica Entonces se retira
- Dado el barrido Cuando se buscan citas a la Ley 640 Entonces no queda ninguna sin decisión

**Hallazgos:** LEGAL-7

**Dependencias:** is blocked by E11-06

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 7 y §3.2-3.3

### E11-09 · Task · Confirmar el SMMLV 2026 fijado por norma transitoria

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 1 pts · **MoSCoW:** Must · **Rank:** 7

**Labels:** legal-pendiente · **Components:** Backend

- **Objetivo:** Saber si el valor de 2026 (Decreto 0159, transitorio) es definitivo.
- **Alcance:** Consulta a la abogada; actualizar SMMLV_BY_YEAR y marcar el año como confirmado si corresponde.
- **Definición de terminado:** TODO(legal) de validation-rules.ts resuelto o con fecha de revisión.

**Criterios de aceptación:**

- Dado la respuesta Cuando el valor es definitivo Entonces isSmmlvYearConfirmed(2026) devuelve true
- **(error)** Dado un valor distinto Cuando se actualiza Entonces los tests de umbrales se recalculan

**Hallazgos:** LEGAL-1

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 1 · src/features/case/validation-rules.ts:44,67

### E11-10 · Story · Generar el Check List con el Parágrafo 3 resuelto

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 3 pts · **MoSCoW:** Must · **Rank:** 8

**Labels:** legal-pendiente · **Components:** Documentos-PDF, Backend

Como **operadora de insolvencia**, quiero generar el Check List completo, para entregar el soporte que el centro exige sin completarlo a mano.

**Criterios de aceptación:**

- Dado la definición legal de informado Cuando se implementa Entonces SI/NO_PARAGRAFO_3 se calculan desde el caso
- Dado un deudor que manifiesta no poseer obligaciones Cuando se genera Entonces el Parágrafo 3 refleja esa manifestación
- **(error)** Dado un caso sin el dato necesario Cuando se genera Entonces se bloquea con el motivo, no se imprime un valor por defecto

**Hallazgos:** LEGAL-2

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 2 y §4 · #119 (Parágrafos 1 y 2 ya resueltos)

### E11-11 · Story · Alerta del plazo de corrección después de una nulidad

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 41

**Labels:** legal-pendiente · **Components:** Backend

Como **operadora de insolvencia**, quiero que el sistema me avise cuando se acerca el vencimiento del plazo de corrección tras una nulidad, para no dejar vencer un término procesal.

**Criterios de aceptación:**

- Dado una nulidad registrada Cuando se acerca el vencimiento Entonces recibo una alerta
- **(borde)** Dado que el plazo sea en días hábiles Cuando se calcula Entonces excluye fines de semana y festivos de Colombia
- Dado el mismo vencimiento Cuando el cron corre dos veces Entonces no duplica la alerta

**Justificación de la estimación:** Si el plazo es en días hábiles hace falta un calendario de festivos que el proyecto no tiene.

**Hallazgos:** LEGAL-6

**Evidencia:** issue #16 · docs/PENDIENTES_DECISION_LEGAL.md ítem 6

### E11-12 · Story · Imprimir el párrafo de comparendos e impuestos pendientes del vehículo

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 56

**Labels:** legal-pendiente · **Components:** Documentos-PDF

Como **operadora de insolvencia**, quiero que la solicitud mencione los comparendos o impuestos pendientes del vehículo que ya registro, para informar al juez la situación real del bien.

**Criterios de aceptación:**

- Dado un vehículo con la casilla marcada Cuando se genera la solicitud Entonces aparece el párrafo legal
- **(borde)** Dado un vehículo sin la casilla Cuando se genera Entonces el párrafo no aparece
- Dado el texto Cuando se imprime Entonces es el aprobado por la abogada

**Hallazgos:** LEGAL-4

**Evidencia:** docs/PENDIENTES_DECISION_LEGAL.md ítem 4 · #68 c4be312 (solo captura)

### E11-13 · Task · Completar los datos de los centros en la política de privacidad

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 12

**Labels:** legal-pendiente · **Components:** Frontend

- **Objetivo:** Que /privacidad identifique al responsable del tratamiento.
- **Alcance:** Razón social y NIT de cada centro, correo del canal ARCO (uno o compartido) y plazo de retención.
- **Definición de terminado:** Ningún ⟨COMPLETAR⟩ en /privacidad.

**Criterios de aceptación:**

- Dado /privacidad Cuando se publica Entonces no tiene datos pendientes
- **(error)** Dado un dato no entregado Cuando se publica Entonces no se reemplaza por un valor de relleno

**Dependencias:** is blocked by E11-17 · blocks E11-15

**Evidencia:** docs/IMPLEMENTACION_SEMANA_8.md §3 (En /privacidad)

### E11-14 · Task · Completar el procedimiento ARCO con responsables y plazos

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 13

**Labels:** legal-pendiente · **Components:** Infra-CI/CD

- **Objetivo:** Que una solicitud ARCO tenga responsable, verificación de identidad, plazo y registro.
- **Alcance:** Quién recibe y aprueba, cómo se verifica al titular, plazos por tipo de solicitud (sin afirmar números sin la abogada) y dónde se registra.
- **Definición de terminado:** Ningún ⟨COMPLETAR⟩ en PROCEDIMIENTO_ARCO.md.

**Criterios de aceptación:**

- Dado el procedimiento Cuando se lee Entonces cada paso tiene responsable
- **(error)** Dado un tercero que suplanta al titular Cuando solicita Entonces el procedimiento exige verificación de identidad

**Evidencia:** docs/IMPLEMENTACION_SEMANA_8.md §3 (En docs/PROCEDIMIENTO_ARCO.md)

### E11-15 · Task · Revisión legal de los textos de privacidad y términos

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 1 pts · **MoSCoW:** Must · **Rank:** 14

**Labels:** legal-pendiente · **Components:** Frontend

- **Objetivo:** Pasar las páginas públicas de borrador a texto aprobado.
- **Alcance:** Revisión de la abogada sobre /privacidad y /terminos.
- **Definición de terminado:** Texto aprobado publicado y la marca de borrador retirada.

**Criterios de aceptación:**

- Dado la aprobación de la abogada Cuando se publica Entonces las páginas ya no dicen borrador

**Dependencias:** is blocked by E11-13

**Evidencia:** CHANGELOG.md [1.0.0-rc.1] (borrador, pendiente de revisión legal) · #141

### E11-16 · Task · Cargar el SMMLV de 2027 cuando se expida el decreto

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 42

**Labels:** legal-pendiente, inferido · **Components:** Backend

- **Objetivo:** Que los casos radicados en 2027 usen el salario mínimo correcto.
- **Alcance:** Agregar 2027 a SMMLV_BY_YEAR y su test.
- **Definición de terminado:** getSmmlv(2027) con valor confirmado.

> Inferido del diseño de SMMLV_BY_YEAR (resolución por año de radicación); no está listado como pendiente en los docs.

**Criterios de aceptación:**

- Dado el decreto 2027 Cuando se carga Entonces getSmmlv(2027) lo devuelve
- **(borde)** Dado un caso radicado en diciembre de 2026 Cuando se evalúa en 2027 Entonces sigue usando 2026

**Evidencia:** docs/IMPLEMENTACION_SEMANA_3.md §3.1 (SMMLV_BY_YEAR, isSmmlvYearConfirmed)

### E11-17 · Task (spike) · Decidir la política de retención y borrado de expedientes

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 15

**Labels:** legal-pendiente, spike · **Components:** Base-de-Datos

- **Objetivo:** Definir cuánto tiempo se conservan los expedientes y qué significa eliminar uno (Ley 1581).
- **Alcance:** Decisión con la abogada y los centros: plazo de retención, quién aprueba una supresión y si el borrado es lógico.
- **Definición de terminado:** Decisión documentada; desbloquea /privacidad y el borrado lógico.

**Criterios de aceptación:**

- Dado la decisión Cuando se documenta Entonces incluye plazo de retención y responsable
- **(borde)** Dado una solicitud ARCO de supresión Cuando choca con la retención legal Entonces la política dice cuál prevalece

**Hallazgos:** PP-A-8

**Dependencias:** blocks E01-40, E11-13

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md A-8 y §5 Compliance · docs/IMPLEMENTACION_SEMANA_8.md §3 (plazo de retención)

### E11-18 · Task · Validación jurídica de los umbrales de las reglas del trámite

**Estado:** To Do · **Sprint:** INS 2026-W46 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 16

**Labels:** legal-pendiente · **Components:** Backend

- **Objetivo:** Que un abogado del área confirme los topes que el servidor ya aplica.
- **Alcance:** 150 acreedores, 150 SMMLV, mínima cuantía 40 SMMLV, 24 meses de gracia y documentos obligatorios en validation-rules.ts.
- **Definición de terminado:** Cada regla marcada como validada o corregida, con fecha.

**Criterios de aceptación:**

- Dado cada umbral Cuando la abogada lo revisa Entonces queda validado o corregido
- **(error)** Dado un umbral incorrecto Cuando se corrige Entonces sus tests se actualizan en el mismo cambio

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §Nota de alcance · docs/IMPLEMENTACION_SEMANA_3.md §3.1 (PENDIENTE DE VALIDACIÓN JURÍDICA)

---

<a id="e12"></a>

## E12 — Nuevas Fases del Ciclo de Vida

El modelo pasa de 8 a 13 fases: Rechazo, Retiro, Desistimiento, Acuerdo impugnado y Acuerdo reformado, con sus transiciones, subtipos y documentos propios, en lugar de terminar todo en Fracaso con el mismo paquete.

**Objetivo de negocio:** Que cada desenlace del trámite produzca los documentos que jurídicamente le corresponden.

**Evidencia:** docs/DISENO_FASES_NUEVAS_2026-09-11.md · #40 a0ac5d7 · src/lib/case-phases.ts

| ID     | Tipo         | Título                                                                              | Pts | Estado | Sprint   | Versión     |
| ------ | ------------ | ----------------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E12-01 | Task (spike) | Diseñar las cinco fases nuevas del expediente                                       |   2 | Done   | 2026-W37 | v0.5.0      |
| E12-02 | Story        | Rechazo y Retiro como fases propias del expediente                                  |   5 | Done   | 2026-W40 | v0.6.0      |
| E12-03 | Story        | Desistimiento del deudor después de la admisión con su subtipo                      |   3 | Done   | 2026-W40 | v0.6.0      |
| E12-04 | Story        | Acuerdo impugnado y Acuerdo reformado                                               |   5 | Done   | 2026-W40 | v0.6.0      |
| E12-05 | Bug          | La generación por cambio de fase podía cortarse y el paquete de Fracaso salía vacío |   3 | Done   | 2026-W40 | v0.6.0      |
| E12-06 | Task         | Retirar los campos rejection y withdrawal con una migración en dos tiempos          |   3 | Done   | 2026-W40 | v0.6.0      |
| E12-07 | Story        | Documentos de Rechazo y de Retiro                                                   |   5 | To Do  | 2026-W45 | v1.0.0-rc.2 |
| E12-08 | Story        | Documentos de Acuerdo impugnado y Acuerdo reformado                                 |   5 | To Do  | Backlog  | v1.1.0      |

### E12-01 · Task (spike) · Diseñar las cinco fases nuevas del expediente

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 2 pts

**Labels:** spike · **Components:** Backend

- **Objetivo:** Separar desenlaces que hoy terminan todos en Fracaso.
- **Alcance:** Fases, transiciones, frontera Retiro/Desistimiento, rama de impugnación, documentos por fase, subtipos y modelo de datos.
- **Definición de terminado:** docs/DISENO_FASES_NUEVAS_2026-09-11.md aprobado.

**Criterios de aceptación:**

- Dado el diseño Cuando se revisa Entonces cada fase nueva tiene transiciones y documentos definidos
- Dado los hallazgos del código que condicionan el diseño Cuando se listan Entonces quedan en §3.1

**Evidencia:** 9da5173 docs: registrar el diseno aprobado de las 5 fases nuevas del expediente · docs/DISENO_FASES_NUEVAS_2026-09-11.md

### E12-02 · Story · Rechazo y Retiro como fases propias del expediente

**Estado:** Done (2026-09-30) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Backend, Frontend

Como **operadora de insolvencia**, quiero registrar que una solicitud fue rechazada de entrada o que el solicitante se retiró antes de la admisión, para no tratar esos casos como una negociación fracasada.

**Criterios de aceptación:**

- Dado un caso en Solicitud Cuando se rechaza Entonces pasa a Rechazo
- Dado un caso antes de admisión Cuando el solicitante se retira Entonces pasa a Retiro
- **(error)** Dado un caso ya admitido Cuando se intenta pasar a Retiro Entonces se rechaza (corresponde Desistimiento)

**Justificación de la estimación:** Dos fases nuevas en la máquina de estados con transiciones validadas en servidor.

**Evidencia:** #40 a0ac5d7 · docs/DISENO_FASES_NUEVAS_2026-09-11.md §2

### E12-03 · Story · Desistimiento del deudor después de la admisión con su subtipo

**Estado:** Done (2026-09-30) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** feature · **Components:** Backend

Como **operadora de insolvencia**, quiero registrar que el deudor abandonó el trámite ya admitido y por qué, para generar el Auto de Desistimiento correcto.

**Criterios de aceptación:**

- Dado un caso admitido Cuando el deudor desiste Entonces pasa a Desistimiento con su subtipo
- **(error)** Dado un subtipo inválido Cuando se envía Entonces se rechaza (isValidDesistimientoSubtype)
- Dado el Desistimiento Cuando se generan documentos Entonces se usa el Auto Desistimiento existente

**Evidencia:** #40 a0ac5d7 · src/features/case/actions.ts:2793 · docs/DISENO_FASES_NUEVAS_2026-09-11.md §4.1

### E12-04 · Story · Acuerdo impugnado y Acuerdo reformado

**Estado:** Done (2026-09-30) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** feature · **Components:** Backend, Frontend

Como **abogado del centro**, quiero registrar que un acuerdo fue impugnado ante el juez y si se reformó dentro del plazo, para seguir la rama de impugnación sin perder el estado del acuerdo.

**Criterios de aceptación:**

- Dado un acuerdo aprobado Cuando se impugna Entonces pasa a Acuerdo impugnado
- Dado un acuerdo impugnado Cuando el juez ordena corregir y se corrige Entonces pasa a Acuerdo reformado
- **(error)** Dado un acuerdo no aprobado Cuando se intenta impugnar Entonces se rechaza

**Justificación de la estimación:** Rama de impugnación con dos desenlaces (ⓒ corregido, ⓓ remisión) en la máquina de estados.

**Evidencia:** #40 a0ac5d7 · docs/DISENO_FASES_NUEVAS_2026-09-11.md §2.3

### E12-05 · Bug · La generación por cambio de fase podía cortarse y el paquete de Fracaso salía vacío

**Estado:** Done (2026-09-30) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend, Documentos-PDF

- **Entorno:** Producción hasta septiembre 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Pasar un caso a Admisión, Acuerdo aprobado o Fracaso
  2. Revisar Drive y la base
- **Esperado:** Paquete completo generado y trazable
- **Actual:** Promesa flotante sin after() ni lock (Vercel la congelaba a mitad), y Fracaso enviaba failureType 'general' que no mapea a plantillas: cero documentos
- **Causa raíz:** updateCasePhase disparaba generateFn().then() sin after() ni DocumentGenerationRequest, y ninguna pantalla asignaba failureType antes de la transición.
- **Fix:** #40 a0ac5d7: runWithGenerationLock en la transición y failureType validado cuando la nueva fase es Fracaso
- **Test de regresión:** tests/unit/cases/case-phase-transitions.test.ts.

**Criterios de aceptación del fix:**

- Dado una transición a Admisión Cuando se genera Entonces usa el lock y espera el resultado
- **(error)** Dado una transición a Fracaso sin failureType Cuando se envía Entonces se rechaza

**Hallazgos:** GC-A3, GD-M3

**Evidencia:** #40 a0ac5d7 · src/features/case/actions.ts:2928-2951 · docs/DISENO_FASES_NUEVAS_2026-09-11.md §3.1 puntos 1 y 2

### E12-06 · Task · Retirar los campos rejection y withdrawal con una migración en dos tiempos

**Estado:** Done (2026-09-30) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Base-de-Datos, Infra-CI/CD

- **Objetivo:** Que la fase sea la única fuente de verdad del desenlace.
- **Alcance:** Retirar el código primero y después la migración que borra las columnas, con guarda que aborta si algún caso las tuviera en true.
- **Definición de terminado:** Columnas borradas en producción sin downtime, siguiendo DEPLOY_PR40.md.

**Criterios de aceptación:**

- Dado un caso con rejection en true Cuando corre la migración Entonces aborta
- Dado el código nuevo desplegado Cuando corre la migración Entonces ningún código lee esas columnas

**Evidencia:** #40 a0ac5d7 (Paso 5) · migración 20260930000000_drop_rejection_withdrawal_from_case · CHANGELOG.md [1.0.0-rc.1] Removed · docs/DEPLOY_PR40.md

### E12-07 · Story · Documentos de Rechazo y de Retiro

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 9

**Labels:** legal-pendiente · **Components:** Documentos-PDF, Backend

Como **operadora de insolvencia**, quiero generar el auto de rechazo y la constancia de retiro, para cerrar esos casos con el documento que les corresponde y no con el paquete de Fracaso.

**Criterios de aceptación:**

- Dado un caso en Rechazo Cuando genero Entonces se produce el Auto de rechazo redactado por la abogada
- Dado un caso en Retiro Cuando genero Entonces se produce el auto o constancia de retiro
- **(error)** Dado un caso en Rechazo Cuando se intenta generar el paquete de Fracaso Entonces no se ofrece
- Dado las plantillas nuevas Cuando se generan para cada centro Entonces usan su membrete

**Justificación de la estimación:** Dos plantillas nuevas desde texto legal, mapeo de fase a paquete y branding por centro.

**Evidencia:** docs/DISENO_FASES_NUEVAS_2026-09-11.md §3 (4 plantillas nuevas) · find templates -iname '_rechazo_|_retiro_' → sin resultados (2026-10-21)

### E12-08 · Story · Documentos de Acuerdo impugnado y Acuerdo reformado

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 43

**Labels:** legal-pendiente · **Components:** Documentos-PDF

Como **abogado del centro**, quiero generar la constancia de remisión de la impugnación y el acta del acuerdo corregido, para documentar la rama de impugnación con los papeles correctos.

**Criterios de aceptación:**

- Dado un caso en Acuerdo impugnado Cuando genero Entonces se produce la constancia de remisión
- Dado un Acuerdo reformado ⓒ Cuando genero Entonces se produce el acta del acuerdo corregido
- **(borde)** Dado un Acuerdo reformado ⓓ Cuando genero Entonces se usa la plantilla Fracaso por reforma reclasificada

**Justificación de la estimación:** Dos plantillas nuevas más la reclasificación de una existente, con texto legal pendiente.

**Dependencias:** is blocked by E11-07

**Evidencia:** docs/DISENO_FASES_NUEVAS_2026-09-11.md §3 · docs/PENDIENTES_DECISION_LEGAL.md ítem 3

---

<a id="e13"></a>

## E13 — Deuda Técnica

Refactors, performance y limpieza sin valor directo al usuario: división del placeholder-mapper, type-safety del módulo de documentos, código muerto, warnings de ESLint, console.\* → logger, índices y tipos de base de datos.

**Objetivo de negocio:** Mantener el código entendible y seguro de cambiar para quien herede el sistema después de la tesis.

**Evidencia:** CLAUDE.md §Next Sessions (Fase 2, Quick Wins) · docs/PLAN_DIVISION_MAPPER.md · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md §4 (NO urgente)

| ID     | Tipo  | Título                                                                      | Pts | Estado | Sprint   | Versión     |
| ------ | ----- | --------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E13-01 | Task  | Limpiar archivos temporales y plantillas de referencia del repositorio      |   1 | Done   | 2026-W12 | v0.2.0      |
| E13-02 | Bug   | La limpieza borró plantillas que la generación sí necesitaba                |   — | Done   | 2026-W12 | v0.2.0      |
| E13-03 | Task  | Quitar dependencias sin uso y la rama stg                                   |   2 | Done   | 2026-W16 | v0.3.0      |
| E13-04 | Task  | Extraer los helpers de formato del mapper con pruebas directas              |   3 | Done   | 2026-W38 | v0.6.0      |
| E13-05 | Task  | Reemplazar el doble cast a CaseWithRelations por una función verificada     |   3 | Done   | 2026-W38 | v0.6.0      |
| E13-06 | Task  | Leer solo las columnas necesarias en el listado de casos                    |   3 | Done   | 2026-W38 | v0.6.0      |
| E13-07 | Task  | Carga diferida de gráficos y de la búsqueda global                          |   3 | Done   | 2026-W38 | v0.6.0      |
| E13-08 | Task  | Dividir el placeholder-mapper en sub-mappers (Pasos 2 a 9)                  |   8 | Done   | 2026-W40 | v0.6.0      |
| E13-09 | Task  | Contexto de insolvencia y dispatcher por tipo de plantilla                  |   3 | Done   | 2026-W40 | v0.6.0      |
| E13-10 | Task  | Compartir la fase de preparación entre la generación automática y la manual |   3 | Done   | 2026-W40 | v0.6.0      |
| E13-11 | Task  | Borrar secciones del wizard y campos que nunca se renderizaban              |   2 | Done   | 2026-W40 | v0.6.0      |
| E13-12 | Task  | Borrar los modelos del Formulario Definitivo que nunca tuvieron captura     |   5 | Done   | 2026-W40 | v0.6.0      |
| E13-13 | Task  | Dejar ESLint en cero warnings                                               |   3 | Done   | 2026-W41 | v1.0.0-rc.1 |
| E13-14 | Task  | Variables de entorno de ejemplo que dotenv sí entiende                      |   1 | Done   | 2026-W38 | v0.6.0      |
| E13-15 | Story | Errores de casos y documentos visibles en Sentry                            |   5 | To Do  | Backlog  | v1.1.0      |
| E13-16 | Story | Observabilidad en pagos, reportes, calendario, auditoría y notificaciones   |   5 | To Do  | Backlog  | v1.1.0      |
| E13-17 | Task  | Migrar a logger el resto de llamadas a console                              |   5 | To Do  | Backlog  | v1.1.0      |
| E13-18 | Task  | Eliminar los casts inseguros restantes del módulo de documentos             |   2 | To Do  | Backlog  | v1.1.0      |
| E13-19 | Task  | Cargar el diálogo de creación de casos de forma diferida                    |   2 | To Do  | Backlog  | v1.1.0      |
| E13-20 | Task  | Borrar las 5 columnas muertas de conciliación                               |   2 | To Do  | Backlog  | v1.1.0      |
| E13-21 | Task  | Tasa de interés en Decimal y enums para estados y fases                     |   5 | To Do  | Backlog  | v1.1.0      |
| E13-22 | Task  | Índices sobre las claves foráneas que no los tienen                         |   2 | To Do  | Backlog  | v1.1.0      |
| E13-23 | Task  | Actualizar el roadmap de CLAUDE.md y el README con lo ya hecho              |   1 | To Do  | 2026-W45 | v1.0.0-rc.2 |

### E13-01 · Task · Limpiar archivos temporales y plantillas de referencia del repositorio

**Estado:** Done (2026-03-16) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Baja · **Estimación:** 1 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Reducir ruido del repositorio.
- **Alcance:** Borrar temporales y plantillas HTML de referencia.
- **Definición de terminado:** Repo sin archivos temporales.

**Criterios de aceptación:**

- Dado el repositorio Cuando se lista Entonces no hay archivos temporales versionados

**Evidencia:** 0129217 chore: limpiar proyecto - eliminar archivos temporales y plantillas HTML de referencia

### E13-02 · Bug · La limpieza borró plantillas que la generación sí necesitaba

**Estado:** Done (2026-03-18) · **Sprint:** INS 2026-W12 · **Versión:** v0.2.0 · **Prioridad:** Alta · **Estimación:** sin puntos (trivial)

**Labels:** bug-regresion · **Components:** Documentos-PDF

- **Entorno:** dev, marzo 2026
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Generar documentos después de la limpieza de E13-01
- **Esperado:** Las plantillas existen
- **Actual:** Faltaban plantillas HTML necesarias
- **Causa raíz:** Plantillas en uso borradas junto con las de referencia.
- **Fix:** e576f89 fix: restaurar plantillas HTML necesarias para generación de documentos
- **Test de regresión:** Ninguno en su momento; hoy lo cubriría el test de invariantes de plantillas (E14-10).

**Criterios de aceptación del fix:**

- Dado las plantillas restauradas Cuando se genera Entonces no faltan archivos
- Dado una plantilla borrada por error en el futuro Cuando corre CI Entonces E14-10 la detecta

**Evidencia:** e576f89

### E13-03 · Task · Quitar dependencias sin uso y la rama stg

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.3.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Simplificar dependencias y estrategia de ramas.
- **Alcance:** Retirar cookies, libreoffice-convert, pizzip y jsdom; eliminar stg de workflows y docs; .vercelignore y .gitignore ajustados.
- **Definición de terminado:** Solo main + dev; build sin las dependencias retiradas.

**Criterios de aceptación:**

- Dado package.json Cuando se inspecciona Entonces no contiene las 4 dependencias retiradas

**Evidencia:** 820461c · CHANGELOG.md [0.3.0] Removed

### E13-04 · Task · Extraer los helpers de formato del mapper con pruebas directas

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Objetivo:** Primer paso de la división del placeholder-mapper.
- **Alcance:** 12 helpers de formato a placeholders/format.ts con 84 casos de prueba.
- **Definición de terminado:** Mapper sin cambios de salida (golden master verde).

**Criterios de aceptación:**

- Dado el golden master Cuando se extraen los helpers Entonces la salida del mapper no cambia

**Evidencia:** 31de443 · 911e1fb · src/features/document/placeholders/format.ts

### E13-05 · Task · Reemplazar el doble cast a CaseWithRelations por una función verificada

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend

- **Objetivo:** Que el compilador verifique la forma del caso que entra a la generación.
- **Alcance:** asCaseWithRelations() en vez de as unknown as en el entry point.
- **Definición de terminado:** tsc verde; quedan 4 as unknown as en document/ (ver E13-18).

**Criterios de aceptación:**

- Dado un cambio en el include de Prisma Cuando no coincide con el tipo Entonces tsc falla

**Evidencia:** 5de0489 · CLAUDE.md Fase 2 (type-safety, entry point centralizado)

### E13-06 · Task · Leer solo las columnas necesarias en el listado de casos

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** nfr · **Components:** Backend, Base-de-Datos

- **Objetivo:** Reducir el costo de /cases y de las comprobaciones de existencia.
- **Alcance:** select acotado en el listado (no las 269 columnas) y select { id } en lecturas de existencia.
- **Definición de terminado:** Tests de case-reads-select verdes.

**Criterios de aceptación:**

- Dado el listado de casos Cuando consulta Entonces no selecciona las 269 columnas

**Evidencia:** f87a5ec · 697d2a0 · tests/unit/cases/case-reads-select.test.ts

### E13-07 · Task · Carga diferida de gráficos y de la búsqueda global

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** nfr · **Components:** Frontend

- **Objetivo:** Bajar el First Load del dashboard y del header.
- **Alcance:** recharts con next/dynamic (435 → 310 kB) y diálogo cmdk diferido; test que falla si el wrapper deja de filtrar.
- **Definición de terminado:** Medición de First Load registrada en el commit.

**Criterios de aceptación:**

- Dado el dashboard Cuando carga Entonces recharts no viaja en el chunk inicial

**Hallazgos:** PP-B-3

**Evidencia:** 276eea4 perf(dashboard): cargar recharts de forma diferida (First Load 435 -> 310 kB) · 3387b5f · e572146

### E13-08 · Task · Dividir el placeholder-mapper en sub-mappers (Pasos 2 a 9)

**Estado:** Done (2026-10-01) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 8 pts

**Labels:** — · **Components:** Documentos-PDF, Testing

- **Objetivo:** Pasar de un archivo de 2.877 líneas a módulos por dominio.
- **Alcance:** Listas simples, Formulario Definitivo, ingresos, escape, patrimonio, builders HTML, conciliación, apoyo y pares de colisión en src/features/document/placeholders/.
- **Definición de terminado:** placeholder-mapper.ts en 1.051 líneas; golden master y contrato de colisiones verdes.

> CLAUDE.md todavía lista este split como pendiente (~4h); está hecho (ver E13-23).

**Criterios de aceptación:**

- Dado cada paso Cuando se mergea Entonces la salida del mapper es idéntica (golden master)
- Dado el contrato de colisiones Cuando cambia Entonces se actualiza de forma explícita (19 → 16)

**Justificación de la estimación:** Nueve PRs secuenciales sobre el archivo más crítico de la generación.

**Sub-tasks:**

- `E13-08.1` Pasos 2-4: listas simples, Formulario Definitivo e ingresos — #52, #81, #91.
- `E13-08.2` Pasos 5-6: patrimonio y builders HTML — #92, #94; escape a placeholders/escape.ts (#93).
- `E13-08.3` Pasos 7-9: conciliación, apoyo y pares de colisión — #95, #96, #97.

**Evidencia:** #52 d1320ae · #81 ee3e16c · #91 dabb91d · #92 7935704 · #93 cbe191b · #94 045ba31 · #95 decb40c · #96 8580427 · #97 e6e3114 · docs/PLAN_DIVISION_MAPPER.md · wc -l placeholder-mapper.ts = 1051 (2026-10-21)

### E13-09 · Task · Contexto de insolvencia y dispatcher por tipo de plantilla

**Estado:** Done (2026-09-29) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** — · **Components:** Documentos-PDF

- **Objetivo:** Preparar la migración de plantillas a contextos tipados.
- **Alcance:** buildInsolvencyContext + dispatcher, sin migrar plantillas todavía.
- **Definición de terminado:** insolvency-context.test.ts verde.

**Criterios de aceptación:**

- Dado una plantilla de insolvencia Cuando se despacha Entonces recibe el contexto de insolvencia

**Evidencia:** #74 99c59f0 · tests/unit/documents/insolvency-context.test.ts

### E13-10 · Task · Compartir la fase de preparación entre la generación automática y la manual

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Backend, Documentos-PDF

- **Objetivo:** Que las dos rutas validen y rellenen igual.
- **Alcance:** Fase 1 (validar + rellenar HTML) común; include de generación unificado en CASE_GENERATION_INCLUDE.
- **Definición de terminado:** Ambas rutas llaman la misma función de preparación.

**Criterios de aceptación:**

- Dado un caso incompleto Cuando se genera por cualquiera de las dos rutas Entonces el resultado de validación es el mismo

**Evidencia:** #85 12fc707 · #101 bd334c2

### E13-11 · Task · Borrar secciones del wizard y campos que nunca se renderizaban

**Estado:** Done (2026-10-03) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 2 pts

**Labels:** — · **Components:** Frontend

- **Objetivo:** Eliminar código inalcanzable del formulario.
- **Alcance:** 6 secciones del wizard nunca renderizadas (#59), spouse-section y dependents-section muertos (#108), notificationOutsideBogota abandonado.
- **Definición de terminado:** Build y suite verdes sin esos archivos.

**Criterios de aceptación:**

- Dado el wizard Cuando se busca un componente borrado Entonces no hay imports

**Evidencia:** #59 620e8b8 · #108 0cbb8ee · 68dad64

### E13-12 · Task · Borrar los modelos del Formulario Definitivo que nunca tuvieron captura

**Estado:** Done (2026-10-02) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Media · **Estimación:** 5 pts

**Labels:** — · **Components:** Base-de-Datos, Backend

- **Objetivo:** Eliminar la doble representación de acreedores, bienes y procesos (Acreedor/Bien/ProcesoJudicial vs. Creditor/Asset/LegalProcess).
- **Alcance:** 3 modelos, migración DROP TABLE con guarda, 3 schemas Zod, nested-create, 4 funciones del mapper y 3 cards; verificación de 0 filas en producción (solo lectura).
- **Definición de terminado:** Migración aplicada; ninguna plantilla consume sus placeholders (verificado sobre las ~92 claves).

**Criterios de aceptación:**

- Dado alguna base con filas en esas tablas Cuando corre la migración Entonces aborta
- Dado las plantillas Cuando se barren Entonces ninguna usa placeholders de esos modelos

**Justificación de la estimación:** Migración destructiva con guarda, verificación en producción y barrido exhaustivo de placeholders.

**Hallazgos:** PP-M-3

**Evidencia:** #100 93e1efe · CLAUDE.md Quick Win 5 · migración 20261002000000_drop_formulario_definitivo_sin_ui

### E13-13 · Task · Dejar ESLint en cero warnings

**Estado:** Done (2026-10-09) · **Sprint:** INS 2026-W41 · **Versión:** v1.0.0-rc.1 · **Prioridad:** Baja · **Estimación:** 3 pts

**Labels:** — · **Components:** Frontend, Testing

- **Objetivo:** Eliminar los 23 warnings preexistentes (no 8) sin silenciar lo que esconde bugs.
- **Alcance:** Variable available stale (bug latente: omitía otherIncomeAmount), verb y sus 15 campos muertos, useMemo de debts; 2 exhaustive-deps de reportes con disable razonado.
- **Definición de terminado:** npm run lint = 0; cesacion-pagos-recalculo.test.tsx (4 casos) con dientes.

**Criterios de aceptación:**

- Dado npm run lint Cuando corre Entonces reporta 0 warnings
- Dado el memo de debts forzado a deps vacías Cuando corre el test nuevo Entonces fallan los 2 casos de regresión

**Hallazgos:** PP-B-1

**Evidencia:** #124 4df5906 · CLAUDE.md Quick Win 2

### E13-14 · Task · Variables de entorno de ejemplo que dotenv sí entiende

**Estado:** Done (2026-09-19) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 1 pts

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que copiar .env.example funcione.
- **Alcance:** Quitar ${VAR} (dotenv no expande) y documentar por qué GOOGLE_DRIVE_REDIRECT_URI existe siendo inerte.
- **Definición de terminado:** .env.example sin interpolaciones.

**Criterios de aceptación:**

- Dado .env.example copiado Cuando se arranca Entonces ninguna variable queda con ${...} literal

**Evidencia:** 5fee09f · 075fa28

### E13-15 · Story · Errores de casos y documentos visibles en Sentry

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 44

**Labels:** nfr · **Components:** Backend

Como **responsable técnico del sistema**, quiero que los fallos de casos y de generación lleguen a Sentry, para que un error en background no quede solo en los Runtime Logs donde nadie mira.

**Criterios de aceptación:**

- Dado case/actions.ts y document/actions.ts Cuando se buscan console.\* Entonces hay 0 (hoy 21 y 46)
- **(error)** Dado un catch de generación en background Cuando falla Entonces usa logger.error con action y caseId
- Dado un aviso PDF MISSING Cuando ocurre Entonces el documento se marca como error en el resultado

**Justificación de la estimación:** 67 llamadas en los dos archivos más grandes, decidiendo nivel por nivel sin inundar Sentry.

**Hallazgos:** GC-B1, GD-B1, PP-M-4

**Dependencias:** blocks E13-16

**Evidencia:** docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §2 y §3 (Bajo) · CLAUDE.md Fase 2 (console.log→logger) · grep -c console. → case/actions.ts 21, document/actions.ts 46 (2026-10-21)

### E13-16 · Story · Observabilidad en pagos, reportes, calendario, auditoría y notificaciones

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 5 pts · **MoSCoW:** Should · **Rank:** 45

**Labels:** nfr · **Components:** Backend

Como **responsable técnico del sistema**, quiero que los fallos de esos cinco módulos lleguen a Sentry, para no repetir el patrón que dejó /cases roto meses sin que nadie lo viera.

**Criterios de aceptación:**

- Dado los 31 catch de los cinco módulos Cuando fallan Entonces registran con logger y no solo con console
- **(error)** Dado un fallo de escritura de auditoría Cuando ocurre Entonces aparece en Sentry
- Dado eventos esperados (validación de usuario) Cuando ocurren Entonces van en info/debug, no en error

**Justificación de la estimación:** 3.215 líneas en cinco módulos con 31 bloques catch a revisar uno por uno.

**Hallazgos:** CIERRE-5.4, PP-M-4

**Dependencias:** is blocked by E13-15 · blocks E13-17

**Evidencia:** docs/AUDITORIA_CIERRE_2026-09-12.md §5.1 y §5.4

### E13-17 · Task · Migrar a logger el resto de llamadas a console

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 5 pts · **MoSCoW:** Could · **Rank:** 57

**Labels:** — · **Components:** Backend, Frontend

- **Objetivo:** Cerrar la Fase 2 del roadmap de logging.
- **Alcance:** Las ~200 referencias restantes de las 291 en src/ tras E13-15 y E13-16, sin emojis.
- **Definición de terminado:** grep console. en src/ solo devuelve el propio logger.

**Criterios de aceptación:**

- Dado src/ Cuando se busca console. Entonces solo aparece en src/lib/logger.ts
- **(borde)** Dado logs de depuración Cuando se migran Entonces van a logger.debug

**Justificación de la estimación:** Cambio mecánico pero amplio (~200 sitios) con decisión de nivel en cada uno.

**Hallazgos:** PP-M-4

**Dependencias:** is blocked by E13-16

**Evidencia:** CLAUDE.md Fase 2 (334 refs originales) · grep console. en src/ = 291 (2026-10-21)

### E13-18 · Task · Eliminar los casts inseguros restantes del módulo de documentos

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 58

**Labels:** — · **Components:** Backend

- **Objetivo:** Terminar la type-safety del módulo de documentos.
- **Alcance:** Los 4 as unknown as restantes → Prisma.CaseGetPayload + transformador Decimal→number.
- **Definición de terminado:** 0 as unknown as en src/features/document.

**Criterios de aceptación:**

- Dado src/features/document Cuando se busca as unknown as Entonces hay 0

**Evidencia:** CLAUDE.md Fase 2 (18× as unknown as originales) · grep as unknown as en document/ = 4 (2026-10-21)

### E13-19 · Task · Cargar el diálogo de creación de casos de forma diferida

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 59

**Labels:** nfr · **Components:** Frontend

- **Objetivo:** Que /cases no cargue el wizard de 1.494 líneas hasta que se abre.
- **Alcance:** next/dynamic para el diálogo de creación.
- **Definición de terminado:** First Load de /cases medido antes y después.

**Criterios de aceptación:**

- Dado /cases Cuando carga Entonces el chunk del wizard no se descarga hasta abrir el diálogo

**Hallazgos:** PP-B-3

**Evidencia:** CLAUDE.md Quick Win 3 · docs/AUDITORIA_PREPRODUCCION_2026-08-25.md B-3

### E13-20 · Task · Borrar las 5 columnas muertas de conciliación

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 60

**Labels:** — · **Components:** Base-de-Datos

- **Objetivo:** Eliminar los singulares legacy que ya son arreglos JSON.
- **Alcance:** concNombreMenor, concNumeroClausula, concNumeroClausulaAdicional, concTextoClausula, concTextoClausulaAdicional; verificación previa en producción como en E13-12.
- **Definición de terminado:** Migración con guarda aplicada; plantillas sin cambios de salida.

**Criterios de aceptación:**

- Dado alguna fila con dato en esas columnas Cuando corre la migración Entonces aborta
- Dado las plantillas Cuando se generan Entonces su salida no cambia (los usos están dentro de {{#each}})

**Hallazgos:** CONC-C-4

**Evidencia:** docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md §5.3

### E13-21 · Task · Tasa de interés en Decimal y enums para estados y fases

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 5 pts · **MoSCoW:** Could · **Rank:** 61

**Labels:** — · **Components:** Base-de-Datos

- **Objetivo:** Unificar tipos de montos y evitar strings libres en estados.
- **Alcance:** Debt.interestRate Float → Decimal; status/kind/phase como enums de Postgres con migración.
- **Definición de terminado:** Migración aplicada y mapper sin cambios de salida.

**Criterios de aceptación:**

- Dado Debt.interestRate Cuando se inspecciona el schema Entonces es Decimal
- **(error)** Dado una fase fuera del enum Cuando se escribe Entonces la base la rechaza

**Justificación de la estimación:** Migraciones de tipo sobre tablas con datos reales y su efecto en el mapper.

**Hallazgos:** PP-M-2

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-2 · src/prisma/schema.prisma:631 interestRate Float (2026-10-21)

### E13-22 · Task · Índices sobre las claves foráneas que no los tienen

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 46

**Labels:** nfr · **Components:** Base-de-Datos

- **Objetivo:** Evitar escaneos completos en relaciones por caso.
- **Alcance:** Verificar contra producción qué FKs no tienen índice (Debt no declara @@index) y crearlos con migración.
- **Definición de terminado:** Cada FK listada en M-1 con índice en producción.

**Criterios de aceptación:**

- Dado la lista de M-1 Cuando se verifica contra producción Entonces cada FK tiene índice
- **(borde)** Dado un índice que ya exista por db push Cuando se migra Entonces se usa IF NOT EXISTS

**Hallazgos:** PP-M-1

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-1 · model Debt sin @@index (2026-10-21) · CLAUDE.md Fase 3 (14 índices en la deriva)

### E13-23 · Task · Actualizar el roadmap de CLAUDE.md y el README con lo ya hecho

**Estado:** To Do · **Sprint:** INS 2026-W45 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Should · **Rank:** 28

**Labels:** — · **Components:** Infra-CI/CD

- **Objetivo:** Que la documentación de entrada no mande a rehacer trabajo terminado.
- **Alcance:** CLAUDE.md: split del mapper (hecho, 1.051 líneas), code-split del dashboard (310 kB), P1 batch (hecho #57). README: 405 tests → cifra actual, deploy.yml eliminado, BD por centro.
- **Definición de terminado:** CLAUDE.md y README coherentes con el código al corte.

**Criterios de aceptación:**

- Dado el roadmap de CLAUDE.md Cuando se lee Entonces no lista como pendiente el split del mapper
- Dado el README Cuando se lee Entonces no menciona deploy.yml ni 405 tests

**Hallazgos:** PP-B-5

**Evidencia:** CLAUDE.md Fase 2 (split pendiente ~4h) · wc -l placeholder-mapper.ts = 1051 · README.md (20 suites / 405 tests, deploy.yml, DATABASE_URL_ARMONIA)

---

<a id="e14"></a>

## E14 — Testing / QA

Suite Jest (1.448 tests en 97 suites, medido 2026-10-01), pruebas contra Postgres real (test:db), golden masters del mapper, E2E con Playwright, pruebas de carga k6 y la aceptación de usuario con los centros.

**Objetivo de negocio:** Que una regresión en reglas legales, documentos o aislamiento entre centros la detecte CI y no un juzgado.

**Evidencia:** docs/TESTS.md · CLAUDE.md §Comandos · tests/

| ID     | Tipo  | Título                                                                       | Pts | Estado | Sprint   | Versión     |
| ------ | ----- | ---------------------------------------------------------------------------- | --: | ------ | -------- | ----------- |
| E14-01 | Task  | Primera suite de pruebas automatizadas                                       |   5 | Done   | 2026-W10 | v0.1.0      |
| E14-02 | Bug   | Siete suites de pruebas fallaban por un mock de Prisma incompleto            |   3 | Done   | 2026-W16 | v0.2.0      |
| E14-03 | Bug   | Las pruebas E2E fallaban por selector, límite de intentos y registro cerrado |   2 | Done   | 2026-W37 | v0.5.0      |
| E14-04 | Task  | Pruebas de transiciones de fase, bypass por POST directo y acceso por fila   |   3 | Done   | 2026-W37 | v0.5.0      |
| E14-05 | Task  | Prueba de humo del wizard contra Postgres real                               |   5 | Done   | 2026-W38 | v0.6.0      |
| E14-06 | Task  | Red de seguridad del mapper: golden master, colisiones y escape HTML         |   5 | Done   | 2026-W38 | v0.6.0      |
| E14-07 | Bug   | El test de carga diferida del dashboard no probaba nada                      |   1 | Done   | 2026-W38 | v0.6.0      |
| E14-08 | Task  | Suite permanente formulario, base y documento                                |   5 | Done   | 2026-W41 | v0.6.0      |
| E14-09 | Task  | Verificación manual de documentos de punta a punta                           |   3 | Done   | 2026-W40 | v0.6.0      |
| E14-10 | Task  | Prueba de que todas las plantillas declaradas existen en disco               |   2 | To Do  | 2026-W44 | v1.0.0-rc.2 |
| E14-11 | Bug   | El benchmark del mapper falla de forma intermitente en CI                    |   2 | To Do  | Backlog  | v1.1.0      |
| E14-12 | Task  | Cubrir la mutación anidada en la prueba de recálculo de cesación de pagos    |   1 | To Do  | Backlog  | v1.1.0      |
| E14-13 | Story | Prueba de extremo a extremo del aislamiento entre centros                    |   3 | To Do  | 2026-W47 | v1.0.0      |
| E14-14 | Story | Aceptación de usuario con guion por rol firmada por ambos centros            |   5 | To Do  | 2026-W47 | v1.0.0      |
| E14-15 | Task  | Prueba de carga promedio contra preview con resultados registrados           |   2 | To Do  | Backlog  | v1.1.0      |
| E14-16 | Task  | Prueba de concurrencia real contra el lock de generación                     |   2 | To Do  | Backlog  | v1.1.0      |
| E14-17 | Task  | Auditoría de accesibilidad de las 5 pantallas núcleo                         |   3 | To Do  | Backlog  | v1.1.0      |

### E14-01 · Task · Primera suite de pruebas automatizadas

**Estado:** Done (2026-03-04) · **Sprint:** INS 2026-W10 · **Versión:** v0.1.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Testing

- **Objetivo:** Tener red de seguridad antes de la primera versión.
- **Alcance:** 111 tests de auth, casos, documentos y Drive.
- **Definición de terminado:** Suite verde en local.

**Criterios de aceptación:**

- Dado npm test Cuando corre Entonces pasan los 111 tests

**Justificación de la estimación:** Montaje de Jest, mocks de Prisma/nodemailer y 111 casos desde cero.

**Evidencia:** c40cfb7 test: agregar suite completa de pruebas automatizadas (111 tests)

### E14-02 · Bug · Siete suites de pruebas fallaban por un mock de Prisma incompleto

**Estado:** Done (2026-04-16) · **Sprint:** INS 2026-W16 · **Versión:** v0.2.0 · **Prioridad:** Media · **Estimación:** 3 pts

**Labels:** — · **Components:** Testing

- **Entorno:** Local y CI, abril 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Correr npm test
- **Esperado:** Suite verde
- **Actual:** 7 suites fallando con Cannot read properties of undefined
- **Causa raíz:** El mock de Prisma no tenía auditLog, payment, paymentReceipt y otros modelos; nombres de centros y mocks de UI desalineados.
- **Fix:** 820461c (mock completado, nombres canónicos Armonía/Constructores de Paz, mock de Select); el CHANGELOG lo lista en [0.2.0]
- **Test de regresión:** 20 suites / 405 tests verdes.

> El CHANGELOG lo fecha en 0.2.0 (2026-04-14), pero el cambio entró en el commit 820461c del 2026-04-16.

**Criterios de aceptación del fix:**

- Dado npm test Cuando corre Entonces las 20 suites pasan
- Dado un modelo nuevo de Prisma Cuando se usa en tests Entonces existe en el mock

**Evidencia:** 820461c (git log -S paymentReceipt -- tests/**mocks**) · CHANGELOG.md [0.2.0] Fixed y Tests (antes: 7 suites fallando)

### E14-03 · Bug · Las pruebas E2E fallaban por selector, límite de intentos y registro cerrado

**Estado:** Done (2026-09-10) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Media · **Estimación:** 2 pts

**Labels:** — · **Components:** Testing

- **Entorno:** GitHub Actions (e2e.yml), septiembre 2026
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Correr la suite Playwright
- **Esperado:** E2E verde
- **Actual:** Selector mal formado en cases.e2e, el rate limit bloqueaba el login de la suite y el test de /register esperaba el registro abierto
- **Causa raíz:** Tests desalineados con los cambios de seguridad de la Semana 1-2 (C-2, A-2).
- **Fix:** #12 2360250, #14 9912d11, #15 e201976
- **Test de regresión:** E2E verde en los PR siguientes.

**Criterios de aceptación del fix:**

- Dado la suite E2E Cuando corre Entonces no la bloquea el rate limit
- Dado el test de /register Cuando corre Entonces verifica que el registro está cerrado

**Evidencia:** #12 2360250 · #14 9912d11 · #15 e201976

### E14-04 · Task · Pruebas de transiciones de fase, bypass por POST directo y acceso por fila

**Estado:** Done (2026-09-11) · **Sprint:** INS 2026-W37 · **Versión:** v0.5.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** doc-semana-3 · **Components:** Testing

- **Objetivo:** Cubrir las rutas donde estaban los hallazgos críticos y que la suite no veía.
- **Alcance:** case-business-rules (23 tests, 8 intentos de bypass), case-phase-transitions y case-mutations-row-access.
- **Definición de terminado:** updateCase, updateCasePhase y las mutaciones con guard tienen tests.

> La cobertura de acceso por fila se completó en #137 (E03-23).

**Criterios de aceptación:**

- Dado un bypass de fase por updateCase Cuando corre la suite Entonces un test lo detecta
- Dado una mutación sin guard de fila Cuando corre la suite Entonces un test falla

**Hallazgos:** G-M2

**Evidencia:** PR #4 17c7de2 · tests/unit/cases/case-business-rules.test.ts · tests/unit/cases/case-phase-transitions.test.ts · tests/unit/security/case-mutations-row-access.test.ts

### E14-05 · Task · Prueba de humo del wizard contra Postgres real

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Testing, Base-de-Datos

- **Objetivo:** Detectar lo que los mocks de Prisma esconden (como el incidente de /cases).
- **Alcance:** npm run test:db: crea un caso con el wizard contra una base local de prueba, cliente de Prisma sin mockear.
- **Definición de terminado:** Suite tests/db en CI (e2e.yml).

**Criterios de aceptación:**

- Dado una base local de prueba Cuando corre test:db Entonces crea un caso completo
- **(error)** Dado una columna que no existe en la base Cuando corre Entonces falla (lo que un mock no detecta)

**Justificación de la estimación:** Infraestructura nueva de pruebas con base real y fixtures.

**Evidencia:** 73841cc · #35 8eedd6b · docs/TESTS.md §2.1

### E14-06 · Task · Red de seguridad del mapper: golden master, colisiones y escape HTML

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Testing, Documentos-PDF

- **Objetivo:** Poder refactorizar el mapper sin cambiar la salida de los documentos.
- **Alcance:** Golden master del mapper, contrato de las 21 colisiones de fusión, golden de render independiente de CRLF/LF y guardián de la allowlist de escape.
- **Definición de terminado:** Las cuatro suites en CI.

**Criterios de aceptación:**

- Dado un cambio en la salida del mapper Cuando corre el golden Entonces falla
- Dado un placeholder HTML fuera de la allowlist Cuando corre el guardián Entonces falla

**Justificación de la estimación:** Cuatro suites de caracterización sobre el componente más crítico.

**Evidencia:** 5ad7934 · faa389d · 1381cf6 · 52392a1 · tests/unit/documents/mapper-golden.test.ts · tests/unit/documents/html-escape-guard.test.ts

### E14-07 · Bug · El test de carga diferida del dashboard no probaba nada

**Estado:** Done (2026-09-20) · **Sprint:** INS 2026-W38 · **Versión:** v0.6.0 · **Prioridad:** Baja · **Estimación:** 1 pts

**Labels:** — · **Components:** Testing

- **Entorno:** CI, septiembre 2026
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Quitar el filtro del wrapper de recharts
  2. Correr el test
- **Esperado:** El test falla
- **Actual:** El test pasaba igual (vacuo)
- **Causa raíz:** La aserción no observaba la petición del chunk.
- **Fix:** e572146
- **Test de regresión:** El test ahora falla si el wrapper deja de filtrar.

**Criterios de aceptación del fix:**

- Dado el wrapper sin filtro Cuando corre el test Entonces falla
- Dado el wrapper correcto Cuando corre Entonces pasa

**Evidencia:** e572146

### E14-08 · Task · Suite permanente formulario, base y documento

**Estado:** Done (2026-10-08) · **Sprint:** INS 2026-W41 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 5 pts

**Labels:** — · **Components:** Testing, Documentos-PDF

- **Objetivo:** Verificar de punta a punta que lo que se escribe en el formulario llega a la base y al documento.
- **Alcance:** Suite test:db que recorre campos del formulario hasta el placeholder impreso.
- **Definición de terminado:** Suite en CI; atrapó los bugs de fechas y causas (#112, #113).

**Criterios de aceptación:**

- Dado un campo del formulario Cuando se guarda y se genera Entonces el documento imprime ese valor
- **(error)** Dado un campo que se pierde en alguna capa Cuando corre la suite Entonces falla nombrando el campo

**Justificación de la estimación:** Recorrido de tres capas (UI → Prisma → plantilla) sobre base real.

**Evidencia:** #116 925c007 · tests/db/documentos-e2e.db.test.ts · docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md

### E14-09 · Task · Verificación manual de documentos de punta a punta

**Estado:** Done (2026-10-03) · **Sprint:** INS 2026-W40 · **Versión:** v0.6.0 · **Prioridad:** Alta · **Estimación:** 3 pts

**Labels:** inferido · **Components:** Testing, Documentos-PDF

- **Objetivo:** Comprobar con ojos humanos los documentos generados antes de confiar en las suites.
- **Alcance:** Generación real y revisión de los documentos por paquete, con los hallazgos registrados.
- **Definición de terminado:** docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md.

> Fechado por el nombre del documento; no se identificó un commit propio.

**Criterios de aceptación:**

- Dado los paquetes principales Cuando se generan y revisan Entonces los hallazgos quedan registrados

**Evidencia:** docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md

### E14-10 · Task · Prueba de que todas las plantillas declaradas existen en disco

**Estado:** To Do · **Sprint:** INS 2026-W44 · **Versión:** v1.0.0-rc.2 · **Prioridad:** Alta · **Estimación:** 2 pts · **MoSCoW:** Must · **Rank:** 5

**Labels:** — · **Components:** Testing, Documentos-PDF

- **Objetivo:** Que renombrar o mover una plantilla rompa CI, no producción.
- **Alcance:** Recorrer ALL_TEMPLATES y verificar fs.access(getTemplatePath(t)).
- **Definición de terminado:** Test en la suite y verde.

**Criterios de aceptación:**

- Dado una plantilla renombrada Cuando corre CI Entonces el test falla con su nombre
- Dado las 65 plantillas actuales Cuando corre Entonces pasa

**Hallazgos:** GD-B2

**Evidencia:** CLAUDE.md Quick Win 1 · docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §3 (Bajo) · docs/AUDITORIA_MODULO_GENERACION_2026-07.md P9

### E14-11 · Bug · El benchmark del mapper falla de forma intermitente en CI

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 47

**Labels:** — · **Components:** Testing

- **Entorno:** Suite completa en paralelo / runner compartido
- **Severidad:** Media
- **Pasos para reproducir:**
  1. Correr npm test completo varias veces
- **Esperado:** Resultado estable
- **Actual:** placeholder-mapper.test.ts '< 100ms' falla a veces; aislado pasa 5 de 5
- **Causa raíz:** Aserción de tiempo absoluto sensible a la carga del runner.
- **Fix:** Pendiente: medir en una suite aparte o usar un umbral relativo.
- **Test de regresión:** 10 corridas seguidas de la suite completa sin fallo.

**Criterios de aceptación del fix:**

- Dado 10 corridas de la suite completa Cuando se ejecutan Entonces el benchmark no falla
- Dado una regresión real de rendimiento Cuando ocurre Entonces la medición la sigue detectando

**Evidencia:** docs/IMPLEMENTACION_SEMANA_4.md §5.4

### E14-12 · Task · Cubrir la mutación anidada en la prueba de recálculo de cesación de pagos

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 1 pts · **MoSCoW:** Could · **Rank:** 62

**Labels:** — · **Components:** Testing

- **Objetivo:** Probar la ruta que usa el formulario en producción.
- **Alcance:** Caso debts.0.daysOverdue en cesacion-pagos-recalculo.test.tsx (hoy solo reemplazo del array completo).
- **Definición de terminado:** Caso nuevo verde y con dientes.

**Criterios de aceptación:**

- Dado una edición de daysOverdue de una deuda Cuando se emite Entonces el memo recalcula

**Evidencia:** CLAUDE.md Quick Win 2 (pendiente anotado en #124)

### E14-13 · Story · Prueba de extremo a extremo del aislamiento entre centros

**Estado:** To Do · **Sprint:** INS 2026-W47 · **Versión:** v1.0.0 · **Prioridad:** Alta · **Estimación:** 3 pts · **MoSCoW:** Must · **Rank:** 19

**Labels:** seguridad · **Components:** Testing

Como **administrador del centro**, quiero una prueba automática que intente leer y modificar datos del otro centro, para tener evidencia de que Armonía y Constructores de Paz no se ven entre sí.

**Criterios de aceptación:**

- **(error)** Dado una sesión de Armonía Cuando pide un caso de Constructores de Paz por id Entonces recibe no encontrado
- **(error)** Dado una sesión de Armonía Cuando intenta generar documentos de un caso ajeno Entonces se rechaza
- Dado la búsqueda global Cuando busca un deudor del otro centro Entonces no aparece
- Dado la suite Cuando corre en CI Entonces usa dos tenants sembrados

**Hallazgos:** PP-M-7

**Dependencias:** blocks E14-14

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md M-7 y §5 Calidad

### E14-14 · Story · Aceptación de usuario con guion por rol firmada por ambos centros

**Estado:** To Do · **Sprint:** INS 2026-W47 · **Versión:** v1.0.0 · **Prioridad:** Crítica · **Estimación:** 5 pts · **MoSCoW:** Must · **Rank:** 17

**Labels:** — · **Components:** Testing

Como **administrador del centro**, quiero probar el sistema con un guion por rol sobre preview antes de recibirlo, para aceptar formalmente que hace lo que el centro necesita.

**Criterios de aceptación:**

- Dado un guion por rol (operadora, abogado, conciliadora, administrador) Cuando se ejecuta en preview Entonces cada paso queda marcado ok o con hallazgo
- **(error)** Dado un hallazgo bloqueante Cuando aparece Entonces se crea un ítem y la firma se pospone
- Dado ambos centros Cuando terminan el guion Entonces firman el acta de aceptación
- **(borde)** Dado datos de prueba Cuando se usan Entonces nunca son de casos reales

**Justificación de la estimación:** Coordinación con dos centros externos, guion por rol y ciclo de corrección.

**Dependencias:** is blocked by E14-13, E05-16 · blocks E03-31, E10-30

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md §4 Semana 4 (UAT) y §5 Calidad

### E14-15 · Task · Prueba de carga promedio contra preview con resultados registrados

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Media · **Estimación:** 2 pts · **MoSCoW:** Should · **Rank:** 48

**Labels:** nfr · **Components:** Testing

- **Objetivo:** Tener una línea base de rendimiento antes del uso real.
- **Alcance:** Correr el escenario average de k6 contra preview y registrar latencias y errores.
- **Definición de terminado:** Resultados en docs/TESTS.md.

**Criterios de aceptación:**

- Dado el escenario average Cuando corre contra preview Entonces los resultados quedan registrados con fecha

**Evidencia:** docs/AUDITORIA_PREPRODUCCION_2026-08-25.md §5 Calidad (k6 average contra preview)

### E14-16 · Task · Prueba de concurrencia real contra el lock de generación

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 2 pts · **MoSCoW:** Could · **Rank:** 63

**Labels:** nfr · **Components:** Testing, Base-de-Datos

- **Objetivo:** Demostrar contra Postgres real que N reclamos simultáneos dan exactamente un ganador.
- **Alcance:** Test en tests/db con reclamos concurrentes sobre DocumentGenerationRequest.
- **Definición de terminado:** Test verde y estable.

**Criterios de aceptación:**

- Dado 10 reclamos simultáneos del mismo caso y tipo Cuando corren Entonces exactamente uno gana

**Evidencia:** docs/TESTS.md (falta concurrencia real contra el lock P3)

### E14-17 · Task · Auditoría de accesibilidad de las 5 pantallas núcleo

**Estado:** To Do · **Sprint:** Backlog (sin sprint) · **Versión:** v1.1.0 · **Prioridad:** Baja · **Estimación:** 3 pts · **MoSCoW:** Could · **Rank:** 64

**Labels:** nfr · **Components:** Frontend, Testing

- **Objetivo:** Pasada semántica de accesibilidad (hoy 19 referencias aria-\* en todo el proyecto).
- **Alcance:** Casos, deudores, documentos, reportes y login: roles, etiquetas, foco y contraste.
- **Definición de terminado:** Hallazgos corregidos o registrados como ítems.

**Criterios de aceptación:**

- Dado cada pantalla núcleo Cuando se navega con teclado Entonces todas las acciones son alcanzables

**Evidencia:** CLAUDE.md Fase 3 (Auditoría de accesibilidad ~6h)

---

## Planificación

### Sprints históricos (reconstruidos desde las fechas de commit)

Una fila por semana ISO con actividad real; no se crean sprints para semanas sin commits. Las semanas marcadas **excluido** no entran en el cálculo de velocidad (motivo abajo).

| Sprint                                                  | Fechas                  | Objetivo                                                                                                                            | Ítems | Pts Done | Pts plan | Velocidad    |
| ------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----: | -------: | -------: | ------------ |
| INS Fase-Diseno                                         | 2025-11-03 → 2026-02-01 | Entender el negocio y diseñar la arquitectura: requisitos, casos de uso, BPMN AS-IS/TO-BE, arquitectura, modelo de datos y mockups. |     8 |       36 |       36 | **excluido** |
| INS 2026-W06                                            | 2026-02-02 → 2026-02-08 | Montar la base del proyecto: setup completo, autenticación y schema inicial.                                                        |     5 |       29 |       29 | cuenta       |
| INS 2026-W07                                            | 2026-02-09 → 2026-02-15 | Estabilizar el render de la app y la primera generación de documentos.                                                              |     1 |        2 |        2 | cuenta       |
| INS 2026-W08                                            | 2026-02-16 → 2026-02-22 | Formulario definitivo de insolvencia y pipeline de documentos HTML local.                                                           |     2 |       16 |       16 | cuenta       |
| INS 2026-W09                                            | 2026-02-23 → 2026-03-01 | Corregir generación documental y creación de casos; habilitar deploy automático en Vercel.                                          |     2 |        6 |        6 | cuenta       |
| INS 2026-W10                                            | 2026-03-02 → 2026-03-08 | Deploy estable, suite de tests, hardening de seguridad, validación del formulario y Drive por centro: publicar v0.1.0.              |     9 |       34 |       34 | cuenta       |
| INS 2026-W11                                            | 2026-03-09 → 2026-03-15 | Corregir validación multi-tenant en generación y formularios.                                                                       |     1 |        2 |        2 | cuenta       |
| INS 2026-W12                                            | 2026-03-16 → 2026-03-22 | Identidad visual por tenant, RBAC type-safe y auditoría inmutable.                                                                  |     9 |       25 |       25 | cuenta       |
| INS 2026-W13                                            | 2026-03-23 → 2026-03-29 | Completar módulos: dashboard, fases, calendario, reportes, pagos y búsqueda global.                                                 |     7 |       29 |       29 | cuenta       |
| INS 2026-W14                                            | 2026-03-30 → 2026-04-05 | Salida Word (.docx), flujo de creación por tipo de caso y plantillas actualizadas (Ley 2445/2025).                                  |     6 |       31 |       31 | cuenta       |
| INS 2026-W15                                            | 2026-04-06 → 2026-04-12 | Servicio de Conciliación completo, layout v1 de Drive y hardening de seguridad.                                                     |     5 |       24 |       24 | cuenta       |
| INS 2026-W16                                            | 2026-04-13 → 2026-04-19 | Alertas proactivas, observabilidad con Sentry y E2E en CI: publicar v0.2.0 y v0.3.0.                                                |    16 |       41 |       41 | cuenta       |
| INS 2026-W17                                            | 2026-04-20 → 2026-04-26 | Módulo de Acuerdos de Apoyo y pruebas de carga k6.                                                                                  |     2 |       11 |       11 | cuenta       |
| INS 2026-W28                                            | 2026-07-06 → 2026-07-12 | Remediar la auditoría del módulo de documentos (P2-P4) y montar el logger estructurado.                                             |     8 |       29 |       29 | cuenta       |
| INS 2026-W33                                            | 2026-08-10 → 2026-08-16 | Documentación técnica para revisión del cliente y desbloqueo del deploy (OTel).                                                     |     3 |        9 |        9 | cuenta       |
| INS 2026-W34                                            | 2026-08-17 → 2026-08-23 | Migrar el deploy a la integración nativa Vercel-GitHub.                                                                             |     1 |        3 |        3 | cuenta       |
| INS 2026-W35 (docs Semana 1, 2)                         | 2026-08-24 → 2026-08-30 | Semanas 1-2: cerrar los bloqueantes de seguridad y de operación de la auditoría pre-producción.                                     |     9 |       20 |       20 | cuenta       |
| INS 2026-W36                                            | 2026-08-31 → 2026-09-06 | Destrabar el CI: OOM del build en GitHub Actions (#5).                                                                              |     1 |        2 |        2 | cuenta       |
| INS 2026-W37 (docs Semana 3)                            | 2026-09-07 → 2026-09-13 | Semana 3: blindar la lógica de negocio en el servidor (#4) y resolver los incidentes de producción.                                 |    12 |       37 |       37 | cuenta       |
| INS 2026-W38                                            | 2026-09-14 → 2026-09-20 | Apoderados del deudor, robustez de la sesión (issue #9), red de seguridad de tests del mapper y performance.                        |    19 |       45 |       45 | cuenta       |
| INS 2026-W39                                            | 2026-09-21 → 2026-09-27 | Corregir hallazgos de fechas y placeholders en los documentos.                                                                      |     2 |        6 |        6 | cuenta       |
| INS 2026-W40                                            | 2026-09-28 → 2026-10-04 | Ronda del formulario maestro, 5 fases nuevas del expediente y división del placeholder-mapper.                                      |    42 |      126 |      126 | **excluido** |
| INS 2026-W41                                            | 2026-10-05 → 2026-10-11 | Documentos correctos (fechas, causas, apoyo), replay de migraciones y membrete por centro.                                          |    26 |       84 |       84 | cuenta       |
| INS 2026-W42 (docs Semana 4, 5, 6, 7, 8, 9, 10, 11, 12) | 2026-10-12 → 2026-10-18 | Clúster 17-18 oct: bloqueantes de seguridad pre-entrega, conciliación, tandas, cumplimiento y 1.0.0-rc.1.                           |    23 |       74 |       74 | **excluido** |
| INS 2026-W43 (docs Semana 13, 14, 15)                   | 2026-10-19 → 2026-10-25 | Clúster 19-20 oct: apoderado único, bienes en dos niveles y notificaciones de generación.                                           |     3 |        8 |        8 | **excluido** |

**Semanas excluidas de la velocidad**

| Sprint          | Pts retroactivos | Motivo                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INS Fase-Diseno |               36 | Fase de análisis y diseño (fases 1 y 2 del Gantt, semanas 1-13): trabajo de documentación y modelado, no de construcción, hecho por el equipo de tesis. Sprint de 13 semanas, no una semana ISO. Fechas inferidas: la semana 14 del Gantt (inicio de la construcción) se hizo coincidir con el primer commit (W06, 2026-02-02). |
| INS 2026-W40    |              126 | Sesión intensa atípica: ~70 commits y ~45 PRs en 6 días (25 commits solo el 29-sep), incluida la ronda completa del formulario maestro y los 9 pasos de la división del mapper. 126 pts retroactivos, 5x la mediana; no es un ritmo repetible.                                                                                  |
| INS 2026-W42    |               74 | Sesión intensa atípica: los documentos 'Semana 4' a 'Semana 12' (9 semanas de documento) ocurrieron en 2 días (17-18 oct), con 7 PRs grandes (#137-#145). No representa una semana normal de trabajo.                                                                                                                           |
| INS 2026-W43    |                8 | Continuación del mismo clúster (19-20 oct, documentos 'Semana 13' a '15') y semana todavía en curso: dato parcial e inflado por la sesión intensa.                                                                                                                                                                              |

### Velocidad y pronóstico hasta v1.0

> **Los puntos históricos son estimaciones retroactivas**: se asignaron en octubre de 2026 a trabajo ya terminado, relativos a la historia de referencia. La velocidad que sale de ellos es una **referencia para planificar, no una medición**, y se recalibra tras los primeros 2-3 sprints reales en Jira.

Semanas que cuentan: **21** · semanas excluidas: **Fase-Diseno, 2026-W40, 2026-W42, 2026-W43** · promedio (solo informativo): 23.1 pts.

Alcance hasta v1.0 (Fix Version v1.0.0-rc.2 + v1.0.0): **31 ítems, 76 pts**. Pendiente total del backlog (incluye v1.1.0): **172 pts**.

| Escenario                |     Velocidad | Sprints hasta v1.0 | Fin estimado |
| ------------------------ | ------------: | -----------------: | ------------ |
| Base (mediana)           | 24 pts/sprint |              **4** | 2026-11-22   |
| Bajo (70% de la mediana) | 16 pts/sprint |              **5** | 2026-11-29   |

Los dos escenarios difieren en **1 sprints** (1 semanas de calendario): con 24 pts por sprint los 76 pts del alcance caben en 4; con 16, hacen falta 5. En ninguno de los dos el orden obligatorio (legal y código → aceptación → infraestructura y pagos) ni las dependencias agregan sprints: cada cifra coincide con el mínimo que da la capacidad sola.

El plan cargado en Jira (campo Sprint) sigue el **escenario bajo**: 5 sprints, ninguno por encima de 16 pts. En el escenario base, el mismo orden se comprime así:

- **Sprint base 1** (24 pts, hasta 2026-11-01): E01-38, E02-33, E02-34, E03-30, E14-10, E01-39, E02-37, E05-15, E11-09, E09-16, E13-23
- **Sprint base 2** (24 pts, hasta 2026-11-08): E11-10, E12-07, E04-15, E11-14, E11-17, E11-18, E05-16, E11-13, E11-15
- **Sprint base 3** (24 pts, hasta 2026-11-15): E14-13, E02-36, E02-35, E14-14, E09-17, E10-24, E10-25, E09-19, E09-20
- **Sprint base 4** (4 pts, hasta 2026-11-22): E10-26, E10-30

Supuestos del pronóstico:

- LOS PUNTOS HISTÓRICOS SON ESTIMACIONES RETROACTIVAS, asignadas en octubre de 2026 a trabajo ya terminado y relativas a la historia de referencia. La 'velocidad' que sale de ellos es una referencia para planificar, no una medición: nadie estimó esos ítems antes de hacerlos.
- Se recalibra con datos reales tras los primeros 2-3 sprints en Jira (W44-W46): si la velocidad real queda fuera del rango [escenario bajo, mediana], se reemplaza el rango por la mediana de esos sprints reales.
- Velocidad = MEDIANA de las semanas no excluidas (no el promedio, que arrastran las semanas extremas). Escenario bajo = 70% de la mediana, redondeado hacia abajo.
- Semanas excluidas: los clústeres atípicos de sesión intensa (W40, W42, W43). El motivo de cada una está en la tabla de sprints.
- Sprints de 1 semana calendario, un único desarrollador (Maxi) con IA como agente de ejecución, en paralelo con el último semestre académico.
- El plan cargado en Jira usa el ESCENARIO BAJO (ningún sprint futuro supera esa cifra); el escenario base es la proyección optimista con el mismo orden.
- Los ítems con label legal-pendiente se planifican, pero su Sprint Goal no depende de ellos: si la respuesta legal no llega, pasan al siguiente sprint sin romper el objetivo.
- Lo que no entra en el alcance de v1.0 (Should/Could fuera de capacidad) queda en v1.1.0, no se fuerza un sprint más.

### Sprints futuros

| Sprint       | Fechas                  | Objetivo                                                                                                                                                     | Ítems | Pts Done | Pts plan | Velocidad   |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----: | -------: | -------: | ----------- |
| INS 2026-W44 | 2026-10-26 → 2026-11-01 | Riesgos de código: ningún documento puede salir incompleto ni ninguna edición perderse en silencio.                                                          |     7 |        0 |       16 | plan (≤ 16) |
| INS 2026-W45 | 2026-11-02 → 2026-11-08 | Legal I: CYG con apoderado verificado, documentos de Rechazo y Retiro y Check List completo; publicar 1.0.0-rc.2.                                            |     6 |        0 |       16 | plan (≤ 16) |
| INS 2026-W46 | 2026-11-09 → 2026-11-15 | Legal II y Ley 1581: umbrales validados, cuenta de Armonía, política de retención, privacidad y ARCO completos; conflictos de apoderado resolubles en la UI. |     7 |        0 |       16 | plan (≤ 16) |
| INS 2026-W47 | 2026-11-16 → 2026-11-22 | Aceptación: aislamiento entre centros probado, regeneración sin duplicados, estado de la generación visible y UAT firmado por ambos centros.                 |     4 |        0 |       16 | plan (≤ 16) |
| INS 2026-W48 | 2026-11-23 → 2026-11-29 | Infraestructura y pagos: plan de Vercel, restauración de backup probada, transferencia de cuentas y release 1.0.0.                                           |     7 |        0 |       12 | plan (≤ 16) |

#### INS 2026-W44 (2026-10-26 → 2026-11-01)

**Sprint Goal:** Riesgos de código: ningún documento puede salir incompleto ni ninguna edición perderse en silencio.

**Nota del plan:** Sprint al tope del escenario bajo (16/16 pts).

- `E01-38` El bloqueo optimista es opcional y no atómico — 3 pts · Must
- `E02-33` Requisitos mínimos de datos para cada plantilla de insolvencia y apoyo — 5 pts · Must
- `E02-34` Definir con los centros la política de versiones al regenerar un documento — 2 pts · Must · ⚠ legal-pendiente
- `E03-30` Verificar en producción que ningún rol quedó sin permiso de alcance — 1 pts · Must
- `E14-10` Prueba de que todas las plantillas declaradas existen en disco — 2 pts · Must
- `E01-39` Dos casos creados a la vez pueden recibir el mismo número — 3 pts · Should
- `E02-37` Consultas de diagnóstico de plantillas sin filtro de centro volcadas a los logs — sin puntos (trivial) · Should

#### INS 2026-W45 (2026-11-02 → 2026-11-08)

**Sprint Goal:** Legal I: CYG con apoderado verificado, documentos de Rechazo y Retiro y Check List completo; publicar 1.0.0-rc.2.

**Nota del plan:** Sprint al tope del escenario bajo (16/16 pts).

- `E05-15` Bloquear el CYG cuando el apoderado del acreedor se contradice entre fuentes — 5 pts · Must
- `E11-09` Confirmar el SMMLV 2026 fijado por norma transitoria — 1 pts · Must · ⚠ legal-pendiente
- `E11-10` Generar el Check List con el Parágrafo 3 resuelto — 3 pts · Must · ⚠ legal-pendiente
- `E12-07` Documentos de Rechazo y de Retiro — 5 pts · Must · ⚠ legal-pendiente
- `E09-16` Cerrar formalmente el endpoint temporal de prueba de Sentry — 1 pts · Should
- `E13-23` Actualizar el roadmap de CLAUDE.md y el README con lo ya hecho — 1 pts · Should

#### INS 2026-W46 (2026-11-09 → 2026-11-15)

**Sprint Goal:** Legal II y Ley 1581: umbrales validados, cuenta de Armonía, política de retención, privacidad y ARCO completos; conflictos de apoderado resolubles en la UI.

**Nota del plan:** Sprint al tope del escenario bajo (16/16 pts).

- `E04-15` Cuenta de consignación de Armonía en los autos por incumplimiento y reforma — 2 pts · Must · ⚠ legal-pendiente
- `E05-16` Resolver el conflicto de apoderado del acreedor desde la interfaz — 5 pts · Must
- `E11-13` Completar los datos de los centros en la política de privacidad — 2 pts · Must · ⚠ legal-pendiente
- `E11-14` Completar el procedimiento ARCO con responsables y plazos — 2 pts · Must · ⚠ legal-pendiente
- `E11-15` Revisión legal de los textos de privacidad y términos — 1 pts · Must · ⚠ legal-pendiente
- `E11-17` Decidir la política de retención y borrado de expedientes — 2 pts · Must · ⚠ legal-pendiente
- `E11-18` Validación jurídica de los umbrales de las reglas del trámite — 2 pts · Must · ⚠ legal-pendiente

#### INS 2026-W47 (2026-11-16 → 2026-11-22)

**Sprint Goal:** Aceptación: aislamiento entre centros probado, regeneración sin duplicados, estado de la generación visible y UAT firmado por ambos centros.

**Nota del plan:** Sprint al tope del escenario bajo (16/16 pts). Si el UAT genera bugs, `E02-36` (Ver el estado de la generación en segundo plano desde el caso, 3 pts) es el primer ítem en pasar a INS 2026-W48, que tiene 4 pts libres. Se elige porque es Should y ningún ítem de v1.0 depende de él.

- `E14-14` Aceptación de usuario con guion por rol firmada por ambos centros — 5 pts · Must
- `E02-35` Regenerar un documento sin duplicarlo en Drive ni en la base — 5 pts · Must
- `E14-13` Prueba de extremo a extremo del aislamiento entre centros — 3 pts · Must
- `E02-36` Ver el estado de la generación en segundo plano desde el caso — 3 pts · Should

#### INS 2026-W48 (2026-11-23 → 2026-11-29)

**Sprint Goal:** Infraestructura y pagos: plan de Vercel, restauración de backup probada, transferencia de cuentas y release 1.0.0.

- `E09-17` Confirmar el límite de intentos distribuido en producción — 1 pts · Must
- `E10-24` Probar una restauración real del backup de producción — 3 pts · Must
- `E10-25` Desplegar sin reescribir el autor del commit — 2 pts · Must
- `E10-26` Transferir las cuentas de infraestructura a los centros — 3 pts · Must
- `E10-30` Publicar la versión 1.0.0 y entregarla a los centros — 1 pts · Must
- `E09-19` Completar los datos pendientes del runbook y verificar Sentry de punta a punta — 1 pts · Should
- `E09-20` Actualizar el runbook de variables para Preview con branch propio — 1 pts · Should

### Versiones (Fix Version)

| Versión     | Fecha      | Estado     | Origen               | Ítems | Descripción                                                                                                                                                                  |
| ----------- | ---------- | ---------- | -------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.0.0      | 2026-02-01 | Released   | reconstruida         |     8 | RECONSTRUIDO (sin tag ni software): cierre de las fases 1 y 2 del Gantt, análisis y diseño.                                                                                  |
| v0.1.0      | 2026-03-08 | Released   | real (tag/CHANGELOG) |    19 | Primera versión etiquetada: auth, casos, deudores/acreedores, 49 plantillas, Drive, tests (CHANGELOG [0.1.0]).                                                               |
| v0.2.0      | 2026-04-14 | Released   | real (tag/CHANGELOG) |    35 | Edición con bloqueo optimista, filtro por tipo, preview inline, comprobantes de pago, tests en CI (CHANGELOG [0.2.0]).                                                       |
| v0.3.0      | 2026-04-15 | Released   | real (tag/CHANGELOG) |     9 | Alertas proactivas, Sentry, Vercel Analytics, export Excel, workflow e2e.yml (CHANGELOG [0.3.0]).                                                                            |
| v0.4.0      | 2026-08-18 | Released   | reconstruida         |    14 | RECONSTRUIDO (sin tag): Acuerdos de Apoyo, auditoría del módulo de documentos (P2-P4), logger, deploy nativo de Vercel. El CHANGELOG lo agrupa dentro de 1.0.0-rc.1.         |
| v0.5.0      | 2026-09-11 | Released   | reconstruida         |    22 | RECONSTRUIDO (sin tag): Semanas 1-3 de remediación + incidentes de producción; corresponde a la promoción a main d2f7cef del 2026-09-11.                                     |
| v0.6.0      | 2026-10-08 | Released   | reconstruida         |    71 | RECONSTRUIDO (sin tag): ronda del formulario maestro, 5 fases nuevas, división del placeholder-mapper, todos los acreedores.                                                 |
| v1.0.0-rc.1 | 2026-10-18 | Released   | real (tag/CHANGELOG) |    44 | Release candidate real (package.json + CHANGELOG): branding/membrete por centro, bloqueantes de seguridad #137, conciliación, tandas, cumplimiento, fixes #144-#149.         |
| v1.0.0-rc.2 | 2026-11-08 | Unreleased | propuesta            |    13 | PROPUESTO: cierre de los riesgos de código y primera tanda legal (sprints 2026-W44 y W45, escenario bajo).                                                                   |
| v1.0.0      | 2026-11-29 | Unreleased | propuesta            |    18 | PROPUESTO: entrega a los clientes — Ley 1581 completa, UAT firmado, infraestructura de pago y backup verificado (W46-W48, escenario bajo; ~2026-11-22 en el escenario base). |
| v1.1.0      | —          | Unreleased | propuesta            |    33 | PROPUESTO: post-lanzamiento — lo que no cabe en el pronóstico conservador (soft-delete completo, deuda técnica, mejoras).                                                    |

### Backlog priorizado (pendientes, por rank)

Orden: MoSCoW → sprint planificado (sin sprint al final) → prioridad → orden de la épica.

| Rank | ID     | Título                                                                          | MoSCoW | Prioridad | Pts | Sprint   | Versión     |
| ---: | ------ | ------------------------------------------------------------------------------- | ------ | --------- | --: | -------- | ----------- |
|    1 | E01-38 | El bloqueo optimista es opcional y no atómico                                   | Must   | Alta      |   3 | 2026-W44 | v1.0.0-rc.2 |
|    2 | E02-33 | Requisitos mínimos de datos para cada plantilla de insolvencia y apoyo          | Must   | Alta      |   5 | 2026-W44 | v1.0.0-rc.2 |
|    3 | E02-34 | Definir con los centros la política de versiones al regenerar un documento      | Must   | Alta      |   2 | 2026-W44 | v1.0.0-rc.2 |
|    4 | E03-30 | Verificar en producción que ningún rol quedó sin permiso de alcance             | Must   | Alta      |   1 | 2026-W44 | v1.0.0-rc.2 |
|    5 | E14-10 | Prueba de que todas las plantillas declaradas existen en disco                  | Must   | Alta      |   2 | 2026-W44 | v1.0.0-rc.2 |
|    6 | E05-15 | Bloquear el CYG cuando el apoderado del acreedor se contradice entre fuentes    | Must   | Alta      |   5 | 2026-W45 | v1.0.0-rc.2 |
|    7 | E11-09 | Confirmar el SMMLV 2026 fijado por norma transitoria                            | Must   | Alta      |   1 | 2026-W45 | v1.0.0-rc.2 |
|    8 | E11-10 | Generar el Check List con el Parágrafo 3 resuelto                               | Must   | Alta      |   3 | 2026-W45 | v1.0.0-rc.2 |
|    9 | E12-07 | Documentos de Rechazo y de Retiro                                               | Must   | Alta      |   5 | 2026-W45 | v1.0.0-rc.2 |
|   10 | E04-15 | Cuenta de consignación de Armonía en los autos por incumplimiento y reforma     | Must   | Alta      |   2 | 2026-W46 | v1.0.0      |
|   11 | E05-16 | Resolver el conflicto de apoderado del acreedor desde la interfaz               | Must   | Alta      |   5 | 2026-W46 | v1.0.0      |
|   12 | E11-13 | Completar los datos de los centros en la política de privacidad                 | Must   | Alta      |   2 | 2026-W46 | v1.0.0      |
|   13 | E11-14 | Completar el procedimiento ARCO con responsables y plazos                       | Must   | Alta      |   2 | 2026-W46 | v1.0.0      |
|   14 | E11-15 | Revisión legal de los textos de privacidad y términos                           | Must   | Alta      |   1 | 2026-W46 | v1.0.0      |
|   15 | E11-17 | Decidir la política de retención y borrado de expedientes                       | Must   | Alta      |   2 | 2026-W46 | v1.0.0      |
|   16 | E11-18 | Validación jurídica de los umbrales de las reglas del trámite                   | Must   | Alta      |   2 | 2026-W46 | v1.0.0      |
|   17 | E14-14 | Aceptación de usuario con guion por rol firmada por ambos centros               | Must   | Crítica   |   5 | 2026-W47 | v1.0.0      |
|   18 | E02-35 | Regenerar un documento sin duplicarlo en Drive ni en la base                    | Must   | Alta      |   5 | 2026-W47 | v1.0.0      |
|   19 | E14-13 | Prueba de extremo a extremo del aislamiento entre centros                       | Must   | Alta      |   3 | 2026-W47 | v1.0.0      |
|   20 | E09-17 | Confirmar el límite de intentos distribuido en producción                       | Must   | Alta      |   1 | 2026-W48 | v1.0.0      |
|   21 | E10-24 | Probar una restauración real del backup de producción                           | Must   | Alta      |   3 | 2026-W48 | v1.0.0      |
|   22 | E10-25 | Desplegar sin reescribir el autor del commit                                    | Must   | Alta      |   2 | 2026-W48 | v1.0.0      |
|   23 | E10-26 | Transferir las cuentas de infraestructura a los centros                         | Must   | Alta      |   3 | 2026-W48 | v1.0.0      |
|   24 | E10-30 | Publicar la versión 1.0.0 y entregarla a los centros                            | Must   | Alta      |   1 | 2026-W48 | v1.0.0      |
|   25 | E01-39 | Dos casos creados a la vez pueden recibir el mismo número                       | Should | Media     |   3 | 2026-W44 | v1.0.0-rc.2 |
|   26 | E02-37 | Consultas de diagnóstico de plantillas sin filtro de centro volcadas a los logs | Should | Media     |   — | 2026-W44 | v1.0.0-rc.2 |
|   27 | E09-16 | Cerrar formalmente el endpoint temporal de prueba de Sentry                     | Should | Baja      |   1 | 2026-W45 | v1.0.0-rc.2 |
|   28 | E13-23 | Actualizar el roadmap de CLAUDE.md y el README con lo ya hecho                  | Should | Baja      |   1 | 2026-W45 | v1.0.0-rc.2 |
|   29 | E02-36 | Ver el estado de la generación en segundo plano desde el caso                   | Should | Media     |   3 | 2026-W47 | v1.0.0      |
|   30 | E09-19 | Completar los datos pendientes del runbook y verificar Sentry de punta a punta  | Should | Media     |   1 | 2026-W48 | v1.0.0      |
|   31 | E09-20 | Actualizar el runbook de variables para Preview con branch propio               | Should | Baja      |   1 | 2026-W48 | v1.0.0      |
|   32 | E01-40 | Borrado lógico de expedientes                                                   | Should | Alta      |   5 | Backlog  | v1.1.0      |
|   33 | E01-42 | Borrado coordinado de la carpeta del expediente en Drive                        | Should | Media     |   3 | Backlog  | v1.1.0      |
|   34 | E07-08 | La creación interna de notificaciones está expuesta como endpoint público       | Should | Media     |   2 | Backlog  | v1.1.0      |
|   35 | E09-18 | Alertas de Sentry para fallos del cron y de la generación                       | Should | Media     |   2 | Backlog  | v1.1.0      |
|   36 | E10-27 | Proteger la rama main con PR y checks obligatorios                              | Should | Media     |   1 | Backlog  | v1.1.0      |
|   37 | E10-28 | Decidir cómo cerrar la deriva entre migraciones y schema                        | Should | Media     |   2 | Backlog  | v1.1.0      |
|   38 | E10-29 | Cerrar la deriva entre el historial de migraciones y el schema                  | Should | Media     |   5 | Backlog  | v1.1.0      |
|   39 | E11-07 | Confirmar con la abogada el texto de Fracaso por reforma del acuerdo            | Should | Media     |   1 | Backlog  | v1.1.0      |
|   40 | E11-08 | Fundamento normativo correcto en dos plantillas de insolvencia y una de apoyo   | Should | Media     |   2 | Backlog  | v1.1.0      |
|   41 | E11-11 | Alerta del plazo de corrección después de una nulidad                           | Should | Media     |   5 | Backlog  | v1.1.0      |
|   42 | E11-16 | Cargar el SMMLV de 2027 cuando se expida el decreto                             | Should | Media     |   1 | Backlog  | v1.1.0      |
|   43 | E12-08 | Documentos de Acuerdo impugnado y Acuerdo reformado                             | Should | Media     |   5 | Backlog  | v1.1.0      |
|   44 | E13-15 | Errores de casos y documentos visibles en Sentry                                | Should | Media     |   5 | Backlog  | v1.1.0      |
|   45 | E13-16 | Observabilidad en pagos, reportes, calendario, auditoría y notificaciones       | Should | Media     |   5 | Backlog  | v1.1.0      |
|   46 | E13-22 | Índices sobre las claves foráneas que no los tienen                             | Should | Media     |   2 | Backlog  | v1.1.0      |
|   47 | E14-11 | El benchmark del mapper falla de forma intermitente en CI                       | Should | Media     |   2 | Backlog  | v1.1.0      |
|   48 | E14-15 | Prueba de carga promedio contra preview con resultados registrados              | Should | Media     |   2 | Backlog  | v1.1.0      |
|   49 | E06-03 | Montos de pago en formato colombiano                                            | Should | Baja      |   3 | Backlog  | v1.1.0      |
|   50 | E01-41 | Papelera y restauración de expedientes                                          | Could  | Media     |   5 | Backlog  | v1.1.0      |
|   51 | E01-43 | Validar en el servidor los documentos adjuntos obligatorios                     | Could  | Media     |   5 | Backlog  | v1.1.0      |
|   52 | E03-32 | Política de seguridad de contenido sin unsafe-inline ni unsafe-eval             | Could  | Media     |   5 | Backlog  | v1.1.0      |
|   53 | E03-31 | Calibrar el límite de creación de casos con el uso real                         | Could  | Baja      |   1 | Backlog  | v1.1.0      |
|   54 | E03-33 | Limpiar tokens de recuperación vencidos e indexar por correo                    | Could  | Baja      |   1 | Backlog  | v1.1.0      |
|   55 | E04-16 | Decidir si cada centro usa su propia credencial de Google Drive                 | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   56 | E11-12 | Imprimir el párrafo de comparendos e impuestos pendientes del vehículo          | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   57 | E13-17 | Migrar a logger el resto de llamadas a console                                  | Could  | Baja      |   5 | Backlog  | v1.1.0      |
|   58 | E13-18 | Eliminar los casts inseguros restantes del módulo de documentos                 | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   59 | E13-19 | Cargar el diálogo de creación de casos de forma diferida                        | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   60 | E13-20 | Borrar las 5 columnas muertas de conciliación                                   | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   61 | E13-21 | Tasa de interés en Decimal y enums para estados y fases                         | Could  | Baja      |   5 | Backlog  | v1.1.0      |
|   62 | E14-12 | Cubrir la mutación anidada en la prueba de recálculo de cesación de pagos       | Could  | Baja      |   1 | Backlog  | v1.1.0      |
|   63 | E14-16 | Prueba de concurrencia real contra el lock de generación                        | Could  | Baja      |   2 | Backlog  | v1.1.0      |
|   64 | E14-17 | Auditoría de accesibilidad de las 5 pantallas núcleo                            | Could  | Baja      |   3 | Backlog  | v1.1.0      |

### Cobertura de auditorías

**AUDITORIA_INTEGRAL_PRE_LAUNCH.md (31 hallazgos)**

| Hallazgo | Ítems                  | Estado  |
| -------- | ---------------------- | ------- |
| GC-C1    | E01-16                 | Cerrado |
| GC-C2    | E01-17                 | Cerrado |
| GC-A1    | E03-23                 | Cerrado |
| GC-A2    | E01-38                 | Abierto |
| GC-A3    | E12-05                 | Cerrado |
| GC-A4    | E01-17                 | Cerrado |
| GC-M1    | E01-39                 | Abierto |
| GC-M2    | E03-26                 | Cerrado |
| GC-M3    | E01-16                 | Cerrado |
| GC-M4    | E03-25                 | Cerrado |
| GC-M5    | E03-23                 | Cerrado |
| GC-M6    | E01-40, E01-42, E03-24 | Parcial |
| GC-B1    | E13-15                 | Abierto |
| GC-B2    | E03-27                 | Cerrado |
| GD-C1    | E02-14                 | Cerrado |
| GD-C2    | E02-14                 | Cerrado |
| GD-A1    | E02-15, E02-22, E02-32 | Cerrado |
| GD-A2    | E02-33                 | Abierto |
| GD-A3    | E02-34, E02-35         | Abierto |
| GD-A4    | E02-15                 | Cerrado |
| GD-M1    | E02-14                 | Cerrado |
| GD-M2    | E02-36                 | Abierto |
| GD-M3    | E12-05                 | Cerrado |
| GD-M4    | E03-23                 | Cerrado |
| GD-M5    | E02-37                 | Abierto |
| GD-B1    | E13-15                 | Abierto |
| GD-B2    | E14-10                 | Abierto |
| G-A1     | E03-22                 | Cerrado |
| G-M1     | E09-16                 | Abierto |
| G-M2     | E14-04                 | Cerrado |
| G-B1     | E09-17                 | Abierto |

**AUDITORIA_PREPRODUCCION_2026-08-25.md (25 hallazgos, prefijo PP-)**

| Hallazgo | Ítems                          | Estado  |
| -------- | ------------------------------ | ------- |
| PP-C-1   | E03-11                         | Cerrado |
| PP-C-2   | E03-12                         | Cerrado |
| PP-A-1   | E03-14                         | Cerrado |
| PP-A-2   | E03-16                         | Cerrado |
| PP-A-3   | E03-13                         | Cerrado |
| PP-A-4   | E10-24                         | Abierto |
| PP-A-5   | E09-04                         | Cerrado |
| PP-A-6   | E03-29                         | Cerrado |
| PP-A-7   | E09-03                         | Cerrado |
| PP-A-8   | E01-40, E01-41, E03-24, E11-17 | Parcial |
| PP-M-1   | E13-22                         | Abierto |
| PP-M-2   | E13-21                         | Abierto |
| PP-M-3   | E13-12                         | Cerrado |
| PP-M-4   | E13-15, E13-16, E13-17         | Abierto |
| PP-M-5   | E03-32                         | Abierto |
| PP-M-6   | E04-16                         | Abierto |
| PP-M-7   | E14-13                         | Abierto |
| PP-M-8   | E10-27                         | Abierto |
| PP-M-9   | E03-15                         | Cerrado |
| PP-M-10  | E09-05                         | Cerrado |
| PP-B-1   | E13-13                         | Cerrado |
| PP-B-2   | E03-33                         | Abierto |
| PP-B-3   | E13-07, E13-19                 | Parcial |
| PP-B-4   | E02-36                         | Abierto |
| PP-B-5   | E09-15, E13-23                 | Parcial |
