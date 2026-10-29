# MAPA — dónde está cada cosa en Insolventic

Índice de navegación del repo. **Leer esto antes de buscar en el código**: resuelve en una lectura lo que de otro modo cuesta varias búsquedas.

Convención del proyecto: la API son **server actions** en `src/features/<dominio>/actions.ts`. No hay REST salvo `/api/cron/alerts`. La UI de cada ruta vive en `src/app/<ruta>/components/`.

---

## 1. Por dónde entrar según la tarea

| Quiero tocar…               | Lógica (servidor)                                                                   | UI                                                        |
| --------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Casos / expedientes         | `src/features/case/actions.ts` + 15 módulos auxiliares                              | `src/app/cases/components/` (60 archivos)                 |
| Generación de documentos    | `src/features/document/` (16 archivos + `placeholders/`)                            | `src/app/documents/`                                      |
| Acreedores                  | `src/features/creditor/actions.ts`                                                  | `src/app/creditors/`                                      |
| Deudores                    | `src/features/debtor/actions.ts`                                                    | `src/app/debtors/`                                        |
| Usuarios / roles / permisos | `src/features/{user,role,permission}/actions.ts`                                    | `src/app/users/`                                          |
| Pagos                       | `src/features/payment/{actions,constants}.ts`                                       | dentro de `case-details-dialog/payment-*.tsx`             |
| Login / sesión              | `src/features/auth/actions.ts`, `src/lib/auth.ts`, `src/middleware.ts`              | `src/app/login/`, `src/components/auth/`                  |
| Notificaciones y alertas    | `src/features/notification/{actions,alerts}.ts`                                     | `src/app/notifications/`, `src/components/notifications/` |
| Búsqueda global             | `src/features/search/actions.ts`                                                    | `src/components/global-search*.tsx`                       |
| Reportes                    | `src/features/report/actions.ts`                                                    | `src/app/reports/`                                        |
| Calendario                  | `src/features/calendar/actions.ts`                                                  | `src/app/calendar/`                                       |
| Auditoría                   | `src/features/audit-log/actions.ts`, `src/features/case/audit-diff.ts`              | `src/app/audit-log/`                                      |
| Esquema de BD               | `src/prisma/schema.prisma` (~1.094 líneas), migraciones en `src/prisma/migrations/` | —                                                         |

## 2. Módulos del dominio `case` (los 15 auxiliares)

`actions.ts` es el punto de entrada; el resto son reglas de negocio puras, importables desde tests:

- **Validación y forma del caso:** `schemas.ts`, `validation-rules.ts`, `datos-desconocidos.ts`
- **Bienes:** `asset-category-types.ts`, `asset-type-fields.ts`, `asset-labels.ts`
- **Apoderados:** `apoderados.ts`, `apoderado-acreedor.ts`
- **Insolvencia:** `causas-insolvencia.ts`, `monto.ts`, `servicios-manutencion.ts`
- **Proceso judicial:** `proceso-judicial-tipos.ts`
- **Libranzas:** `libranza-prefill.ts`
- **Acceso y auditoría:** `case-access.ts` (scoping multi-tenant), `audit-diff.ts`

## 3. Camino crítico: generación de documentos

Es el módulo más intrincado del sistema. Flujo:

```
plantilla HTML (templates/{insolvency,conciliation,support-agreements})
  → prepare-template.ts        (carga y prepara)
  → template-variants.ts       (elige variante según el caso)
  → placeholder-mapper.ts      (mapea datos del caso → placeholders)  ← escapePlaceholder vive acá
  → handlebars-lite.ts         (render, sin dependencia de Handlebars)
  → html-to-pdf.ts / html-to-docx.ts  (src/lib/)
  → google-drive.ts            (destino final; NO es S3)
```

Dos rutas de disparo:

- **Automática** al crear el caso → `generate-documents.ts` (PDF vía Puppeteer)
- **Manual** desde `/documents` → `actions.ts:batchGenerateDocuments` (PDF y/o DOCX)

Orquestación de lotes: `generation-request.ts` → `generation-job.ts` → `batch-tandas.ts`. Persistencia en `persistence.ts`, subida en `storage-helpers.ts`. Config de qué plantilla aplica a qué: `templates-config.ts`.

**`placeholders/` (14 archivos)** — un módulo por grupo de placeholders: `apoyo.ts`, `assets-debts.ts`, `branding.ts`, `case-lists.ts`, `conciliacion.ts`, `escape.ts`, `fechas-entidades-fracaso.ts`, `format.ts`, `html-builders.ts`, `income.ts`, `membrete.ts`, `solicitante-acuerdo.ts`, `tablas-dinamicas-pagos.ts`, `tenant-slug.ts`.

Diccionario de qué significa cada placeholder: `docs/DICCIONARIO_PLACEHOLDERS.md`.

## 4. Infraestructura (`src/lib/`)

| Área                    | Archivos                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Auth y permisos         | `auth.ts`, `permissions.ts`, `request-context.ts`                                       |
| BD                      | `prisma.ts`                                                                             |
| Documentos              | `html-to-pdf.ts`, `html-to-docx.ts`, `google-drive.ts`                                  |
| Multi-tenant y branding | `tenant-theme.ts`, `branding-assets.ts`, `centro-conciliacion.ts`, `membrete-centro.ts` |
| Observabilidad          | `logger.ts`, `sentry-scrub.ts`, `request-id.ts`                                         |
| Resiliencia             | `retry.ts`, `rate-limit.ts`                                                             |
| Dominio                 | `case-phases.ts`, `date-colombia.ts`                                                    |
| Varios                  | `csp.ts`, `email.ts`, `next-redirect.ts`, `utils.ts`                                    |

Hooks: `src/hooks/use-auth.ts`, `use-session-timeout.ts`. Providers: `src/components/{tenant,theme}-provider.tsx`.

## 5. Tests — dónde va cada tipo

| Carpeta                              | Qué contiene                   | Cómo se corre      |
| ------------------------------------ | ------------------------------ | ------------------ |
| `tests/unit/`                        | unitarios                      | `npm test`         |
| `tests/integration/`                 | integración con mocks          | `npm test`         |
| `tests/schema/`                      | validación de esquemas Zod     | `npm test`         |
| `tests/security/`                    | XSS, escapado, permisos        | `npm test`         |
| `tests/form-request/`                | formulario maestro             | `npm test`         |
| `tests/db/`                          | contra Postgres **real**       | `npm run test:db`  |
| `tests/e2e/`                         | Playwright                     | `npm run test:e2e` |
| `tests/load/`                        | k6                             | manual             |
| `tests/__mocks__/`, `tests/helpers/` | mocks y utilidades compartidas | —                  |

`npm test` excluye `tests/db` y `tests/e2e`.

## 6. Índice de `docs/`

Para no leer los 3 MB a ciegas:

**Arquitectura y referencia** (lo que se consulta seguido)

- `ARQUITECTURA.md` — arquitectura general; §6 es el detalle de documentos
- `DICCIONARIO_DATOS.md` — modelo de datos
- `MODELO_ENTIDAD_RELACION.md` — modelo E-R
- `DICCIONARIO_PLACEHOLDERS.md` — qué significa cada placeholder
- `DIAGRAMA_CLASES.md`, `DIAGRAMA_COMPONENTES.md`
- `FORMULARIO_MAESTRO.md` — el formulario central del sistema
- `VALIDACIONES_Y_GENERACION.md` — reglas de validación y su relación con la generación
- `TESTS.md` — cómo correr cada suite (§2.1: `test:db`)
- `MANUAL_USUARIO.md` — manual funcional

**Operación** (runbooks — leer antes de tocar producción)

- `RUNBOOK.md` — operación general
- `RUNBOOK_ENV_VARS.md` — variables de entorno
- `RUNBOOK_ROTACION_DRIVE.md` — rotación de credenciales de Google Drive
- `PROCEDIMIENTO_ARCO.md` — procedimiento ARCO (datos personales)
- `DEPLOY_PR40.md`, `DERIVA_MIGRACIONES_2026-09-10.md`, `DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md`

**Estado del proyecto**

- `ROADMAP.md` — trabajo planificado
- `DECISIONES.md` — decisiones de arquitectura por iteración
- `CHECKPOINT_2026-10-09.md` — checkpoint más reciente (anteriores: `_2026-09-28`, `_2026-09-09`, `_2026-09-01`)
- `PENDIENTES_DECISION_LEGAL.md` — bloqueado esperando decisión legal

**Auditorías** (puntuales, por fecha — leer solo la relevante)

- `AUDITORIA_INSOLVENTIC_2026-07-11.md` — auditoría integral
- `AUDITORIA_MODULO_GENERACION_2026-07.md` — módulo de documentos, P1–P9
- `AUDITORIA_SISTEMA_DOCUMENTOS.md`, `AUDITORIA_INTEGRAL_PRE_LAUNCH.md`
- `AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md`, `AUDITORIA_CIERRE_2026-09-12.md`, `AUDITORIA_PREPRODUCCION_2026-08-25.md`
- `HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`, `HALLAZGO_APOYO_CAMPOS_DESCARTADOS_2026-10-01.md`
- `VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`

**Planes de trabajo** — `PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md` (bloqueado por decisión legal), `PLAN_DIVISION_MAPPER.md`, `PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md`, `DISENO_FASES_NUEVAS_2026-09-11.md`, `BRANDING_POR_CENTRO_2026-09-30.md`

**Historial de implementación** — `IMPLEMENTACION_SEMANA_1.md` … `_16.md` (archivo histórico; rara vez hace falta)

**No markdown** — `REQUISITOS_INSOLVENTIC.xlsx` (requisitos), `diseno/` (diagramas), `gantt/` (cronograma), `jira/`

## Referencias — bloque original de `CLAUDE.md`

Estas seis entradas vivían en la sección `## Referencias` de `CLAUDE.md`; se trasladaron acá textuales para que ninguna se perdiera.

- Auditoría integral: `docs/AUDITORIA_INSOLVENTIC_2026-07-11.md`
- Auditoría del módulo de documentos (P1–P9): `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`
- Arquitectura general: `docs/ARQUITECTURA.md`
- Hallazgos de calidad de la ronda del formulario maestro: `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`
- Plan: listar todos los acreedores en la Solicitud (bloqueado por decisión legal): `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`
- Checkpoint más reciente, con el hallazgo de que el branding por centro nunca eligió por centro (`Case.tenantId` es un cuid, no el slug): `docs/CHECKPOINT_2026-10-09.md`

---

## Mantenimiento

Este archivo se desactualiza cuando se agregan features o se mueven módulos. Si una ruta de acá no existe, verificar con `ls`/`find` y corregir el mapa en el mismo commit.
