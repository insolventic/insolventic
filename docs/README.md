# Documentación de INSOLVENTIC

Índice de la documentación del proyecto, organizado por categoría. Para una vista
del código por módulo, empezar por [`MAPA.md`](./MAPA.md). El punto de entrada
general del repositorio es el [`README.md`](../README.md) de la raíz.

## Arquitectura y diseño

| Documento                                                                  | Contenido                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`ARQUITECTURA.md`](./ARQUITECTURA.md)                                     | Arquitectura general, flujo de generación de documentos y Drive |
| [`DECISIONES.md`](./DECISIONES.md)                                         | Decisiones de arquitectura por iteración, con su justificación  |
| [`MAPA.md`](./MAPA.md)                                                     | Ubicación de cada módulo, ruta de UI y tipo de prueba           |
| [`DIAGRAMA_COMPONENTES.md`](./DIAGRAMA_COMPONENTES.md)                     | Diagrama de componentes                                         |
| [`DIAGRAMA_CLASES.md`](./DIAGRAMA_CLASES.md)                               | Diagrama de clases                                              |
| [`MODELO_ENTIDAD_RELACION.md`](./MODELO_ENTIDAD_RELACION.md)               | Modelo entidad-relación                                         |
| [`DICCIONARIO_DATOS.md`](./DICCIONARIO_DATOS.md)                           | Diccionario de datos                                            |
| [`DICCIONARIO_PLACEHOLDERS.md`](./DICCIONARIO_PLACEHOLDERS.md)             | Placeholders de las plantillas de documentos                    |
| [`FORMULARIO_MAESTRO.md`](./FORMULARIO_MAESTRO.md)                         | Especificación del formulario de captura                        |
| [`VALIDACIONES_Y_GENERACION.md`](./VALIDACIONES_Y_GENERACION.md)           | Reglas de validación y generación de documentos                 |
| [`PLAN_DIVISION_MAPPER.md`](./PLAN_DIVISION_MAPPER.md)                     | Plan de división del mapper de placeholders                     |
| [`BRANDING_POR_CENTRO_2026-09-30.md`](./BRANDING_POR_CENTRO_2026-09-30.md) | Branding por centro en las plantillas                           |

## Operación

| Documento                                                  | Contenido                                               |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| [`RUNBOOK.md`](./RUNBOOK.md)                               | Operación, incidentes, copias de seguridad              |
| [`RUNBOOK_ENV_VARS.md`](./RUNBOOK_ENV_VARS.md)             | Variables de entorno en Vercel: alta, cambio y rotación |
| [`RUNBOOK_ROTACION_DRIVE.md`](./RUNBOOK_ROTACION_DRIVE.md) | Rotación de credenciales de Google Drive                |
| [`PROCEDIMIENTO_ARCO.md`](./PROCEDIMIENTO_ARCO.md)         | Procedimiento interno de solicitudes ARCO               |
| [`CONTACTOS.example.md`](./CONTACTOS.example.md)           | Plantilla de contactos (la versión real no se versiona) |
| [`DEPLOY_PR40.md`](./DEPLOY_PR40.md)                       | Plan de despliegue en dos tiempos (PR #40)              |

## Usuario final, requisitos y pruebas

| Documento                                                        | Contenido                                        |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| [`MANUAL_USUARIO.md`](./MANUAL_USUARIO.md)                       | Manual de usuario; capturas en `manual-usuario/` |
| [`REVISION_MANUAL.md`](./REVISION_MANUAL.md)                     | Revisión del manual de usuario                   |
| [`REQUISITOS_INSOLVENTIC.xlsx`](./REQUISITOS_INSOLVENTIC.xlsx)   | Requisitos funcionales                           |
| [`TESTS.md`](./TESTS.md)                                         | Plan de pruebas y reporte de ejecución           |
| [`PENDIENTES_DECISION_LEGAL.md`](./PENDIENTES_DECISION_LEGAL.md) | Puntos que requieren decisión legal              |

## Gestión del proyecto

| Ubicación                    | Contenido                                                             |
| ---------------------------- | --------------------------------------------------------------------- |
| [`ROADMAP.md`](./ROADMAP.md) | Fases pendientes y mejoras rápidas                                    |
| [`jira/`](./jira/)           | Backlog Scrum e importación a Jira (`BACKLOG.md`, `PROCESO_SCRUM.md`) |
| [`gantt/`](./gantt/)         | Diagrama de Gantt del proyecto de grado                               |
| [`diseno/`](./diseno/)       | Material de diseño                                                    |

## Historial de implementación, auditorías y análisis

Documentos fechados que registran cómo evolucionó el proyecto. No describen el
estado vigente: para eso están las secciones anteriores.

- **Implementación por semana:** `IMPLEMENTACION_SEMANA_1.md` a `IMPLEMENTACION_SEMANA_17.md` e [`IMPLEMENTACION_TANDA_1.md`](./IMPLEMENTACION_TANDA_1.md).
- **Puntos de control:** [`CHECKPOINT_2026-09-01.md`](./CHECKPOINT_2026-09-01.md), [`CHECKPOINT_2026-09-09.md`](./CHECKPOINT_2026-09-09.md), [`CHECKPOINT_2026-09-28.md`](./CHECKPOINT_2026-09-28.md), [`CHECKPOINT_2026-10-09.md`](./CHECKPOINT_2026-10-09.md).
- **Auditorías:**
  [`AUDITORIA_INSOLVENTIC_2026-07-11.md`](./AUDITORIA_INSOLVENTIC_2026-07-11.md),
  [`AUDITORIA_MODULO_GENERACION_2026-07.md`](./AUDITORIA_MODULO_GENERACION_2026-07.md),
  [`AUDITORIA_PREPRODUCCION_2026-08-25.md`](./AUDITORIA_PREPRODUCCION_2026-08-25.md),
  [`AUDITORIA_CIERRE_2026-09-12.md`](./AUDITORIA_CIERRE_2026-09-12.md),
  [`AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md`](./AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md),
  [`AUDITORIA_BLOQUE1_2026-10-27.md`](./AUDITORIA_BLOQUE1_2026-10-27.md),
  [`AUDITORIA_BLOQUE3_2026-10-27.md`](./AUDITORIA_BLOQUE3_2026-10-27.md),
  [`AUDITORIA_INTEGRAL_PRE_LAUNCH.md`](./AUDITORIA_INTEGRAL_PRE_LAUNCH.md),
  [`AUDITORIA_SISTEMA_DOCUMENTOS.md`](./AUDITORIA_SISTEMA_DOCUMENTOS.md).
- **Análisis y planes puntuales:**
  [`DERIVA_MIGRACIONES_2026-09-10.md`](./DERIVA_MIGRACIONES_2026-09-10.md),
  [`DISENO_FASES_NUEVAS_2026-09-11.md`](./DISENO_FASES_NUEVAS_2026-09-11.md),
  [`HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`](./HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md),
  [`PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`](./PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md),
  [`HALLAZGO_APOYO_CAMPOS_DESCARTADOS_2026-10-01.md`](./HALLAZGO_APOYO_CAMPOS_DESCARTADOS_2026-10-01.md),
  [`VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`](./VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md),
  [`DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md`](./DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md),
  [`PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md`](./PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md).

> Estos documentos históricos permanecen en `docs/` y no en una subcarpeta porque
> el código, las pruebas, `CLAUDE.md` y el backlog de `jira/` los referencian por
> ruta.
