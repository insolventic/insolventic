<div align="center">
  <img src="public/images/insolventic-logo.png" alt="Insolventic Logo" width="200" />
</div>

# INSOLVENTIC

![Insolventic](https://img.shields.io/badge/INSOLVENTIC-Gesti%C3%B3n%20de%20Procesos%20de%20Insolvencia-blue?style=for-the-badge)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://insolventic.vercel.app)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io)

---

## 📋 Overview

**INSOLVENTIC** es un sistema SaaS multi-tenant para la gestión integral de procesos de insolvencia, conciliación y acuerdos de apoyo en Colombia. Automatiza el ciclo completo de un caso — desde la solicitud, admisión, negociación, audiencias y terminación — con generación automática de documentos legales, trazabilidad de pagos, y control granular de permisos por rol.

**Diseñado para centros de conciliación** (Armonía, Constructores de Paz) que operan como instancias independientes sobre la misma base de código.

---

## ✨ Capacidades Clave

### 📂 Gestión de Casos

- **3 tipos de servicio:** Insolvencia, Conciliación, Acuerdo de Apoyo
- **293 campos** en el modelo `Case`, agrupados en 9 secciones del wizard (Solicitante, Cónyuge, Ingresos/Gastos, Cesación de pagos, Declaraciones, etc.)
- **Fases auditadas:** Solicitud → Admisión → Negociación → Terminación (Acuerdo / Fracaso)
- **Optimistic locking** (campo `version`) previene sobrescrituras concurrentes
- **Filtros avanzados:** estado, fase, tipo de caso, operador

### 👥 Deudores, Acreedores y Apoderados

- CRUD completo con historial de casos vinculados
- **Asignación bilateral** en conciliaciones (convocante/convocado)
- Soporte para representantes legales y apoderados

### 📝 Generación Automática de Documentos (65 plantillas)

- 5 paquetes estructurados: **Solicitud / Admisión / Negociación / Terminación / Fracaso**
- Salida en **PDF, Word (.docx) o ambos**
- Plantillas **HTML** con placeholders parametrizados, en `templates/`: 50 de insolvencia, 12 de conciliación, 3 de acuerdos de apoyo
- Subida automática a **Google Drive** del centro correspondiente
- Layout versionado (`layoutVersion` 0 = flat, 1 = seccionado)

### 💰 Trazabilidad de Pagos

- Registro de cronogramas y pagos manuales
- Adjuntar comprobantes (PDF / JPG / PNG) → Google Drive
- Estados: `pendiente`, `pagado`, `parcial`, `vencido`
- Reporte consolidado: recaudado, pendiente, vencido

### 🔔 Notificaciones y Auditoría

- Sistema interno de notificaciones por usuario y rol
- **Audit log** de todas las acciones críticas (creación, edición, eliminación, login)

### 🔒 Seguridad

- JWT con access token (24h) + refresh token (7 días), ambos firmados con la **misma** `JWT_SECRET` — no existe una clave separada para el refresh
- **RBAC** por permisos (granularidad a nivel de módulo y acción)
- **Multi-tenant aislado** por `tenantId` en todas las queries
- Middleware de autenticación en rutas y server actions
- `mustChangePassword` forzado incluso en refresh/tenant switch
- Hash `bcrypt` para contraseñas
- Tokens firmados con HS256

---

## 🧱 Stack Técnico

| Capa               | Tecnología                                                         |
| ------------------ | ------------------------------------------------------------------ |
| **Frontend**       | Next.js 15 (App Router, Turbopack) + React 19                      |
| **UI**             | Shadcn UI + Radix Primitives + Tailwind CSS 4                      |
| **Formularios**    | React Hook Form + Zod                                              |
| **ORM**            | Prisma (PostgreSQL; Neon en producción)                            |
| **Auth**           | JWT con `jose` (HS256, cookies httpOnly)                           |
| **Almacenamiento** | Google Drive API (por centro de conciliación)                      |
| **Documentos**     | Plantillas HTML → Puppeteer/Chromium (PDF) + `html-to-docx` (DOCX) |
| **Testing**        | Jest + React Testing Library + Playwright                          |
| **CI**             | GitHub Actions (`pr.yml`, `e2e.yml`, `smoke.yml`, `release.yml`)   |
| **Deploy**         | Integración nativa Vercel↔GitHub (sin workflow propio)            |
| **Email**          | Nodemailer (Gmail SMTP)                                            |

---

## 🚀 Puesta en Marcha

### Prerrequisitos

- Node.js **24.x** — es la versión que usan `pr.yml`, `e2e.yml` y Vercel. `package.json` no declara `engines`, así que nada lo fuerza en local: una versión distinta compila y puede fallar solo en CI
- **Una sola** base PostgreSQL: el aislamiento entre centros es lógico (`tenantId` en cada query), no una base por centro. Hacen falta dos connection strings a la misma base: `DATABASE_URL` (con pooler, la que usa la app) y `DIRECT_URL` (sin pooler, la que usan las migraciones)
- Cuenta de Google Cloud con Drive API habilitada y credenciales OAuth2

### Instalación

```bash
# 1. Clonar
git clone https://github.com/insolventic/insolventic.git
cd insolventic

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales reales

# 4. Generar cliente Prisma
npx prisma generate

# 5. Aplicar migraciones (base vacía o ya migrada)
npm run db:migrate        # prisma migrate dev

# 6. Seed inicial (roles, permisos, usuarios admin)
npx tsx src/prisma/seed.ts

# 7. Arrancar dev server
npm run dev
```

Aplicación disponible en `http://localhost:3000`.

> **No usar `prisma db push` sobre una base con historial de migraciones.** Hay
> una deriva conocida entre `schema.prisma` y las migraciones —objetos que
> existen en la base real pero que ninguna migración crea—, y el candidato es
> justamente un `db push` fuera del historial (nada en el repo ata esos
> objetos a un comando concreto, así que es la hipótesis, no un hecho). El
> detalle y su test están en `CLAUDE.md` § Trampas y `docs/ROADMAP.md` §
> Fase 3.

### Cuentas por defecto (seed)

| Email                  | Rol           | Tenant               |
| ---------------------- | ------------- | -------------------- |
| `admin@armonia.com`    | Administrador | Armonía              |
| `admin@construpaz.com` | Administrador | Constructores de Paz |

> La primera contraseña fuerza `mustChangePassword: true`. Revisa `src/prisma/seed.ts` para valores concretos.

---

## 🗂️ Estructura del Proyecto

```
insolventic/
├── .github/workflows/           # CI (pr.yml, e2e.yml, smoke.yml, release.yml)
├── docs/                        # Documentación funcional y técnica
├── public/                      # Assets estáticos
├── src/
│   ├── app/                     # Next.js App Router (páginas + componentes)
│   │   ├── cases/               # Módulo casos
│   │   ├── debtors/             # Módulo deudores
│   │   ├── creditors/           # Módulo acreedores
│   │   ├── documents/           # Generación documental
│   │   ├── reports/             # Reportes y analíticas
│   │   ├── users/               # Gestión de usuarios
│   │   ├── dashboard/           # Indicadores y gráficas
│   │   ├── calendar/            # Audiencias y vencimientos
│   │   ├── notifications/       # Bandeja de notificaciones
│   │   ├── audit-log/           # Consulta del registro de auditoría
│   │   ├── profile/             # Perfil del usuario
│   │   ├── login/ forgot-password/ reset-password/   # Flujo de auth
│   │   ├── register/            # Existe, pero NO es pública (registro cerrado)
│   │   ├── privacidad/ terminos/  # Públicas, por la Ley 1581
│   │   └── api/                 # Los 2 únicos route handlers:
│   │       ├── health/          #   health check (público; detalle con token)
│   │       └── cron/alerts/     #   cron diario de alertas proactivas
│   ├── components/ui/           # Componentes Shadcn reutilizables
│   ├── features/                # Lógica de dominio (server actions + schemas)
│   │   ├── auth/
│   │   ├── case/
│   │   ├── document/
│   │   ├── payment/
│   │   ├── report/
│   │   └── audit-log/
│   ├── lib/                     # Utilidades (auth, google-drive, prisma, cookies)
│   ├── hooks/                   # Hooks React (use-auth, use-permissions)
│   ├── prisma/                  # Schema, migraciones, seed
│   └── config/                  # Modules, permissions, version
└── tests/                       # Suites Jest + helpers + mocks
    ├── unit/                    # Auth, componentes, validaciones
    ├── integration/             # Flujos completos (login, casos, Drive)
    ├── form-request/            # Reglas de documentos y validación de formularios
    ├── security/                # Aislamiento multi-tenant, RBAC
    ├── db/                      # Contra Postgres REAL (fuera de `npm test`)
    ├── e2e/                     # Playwright (fuera de `npm test`)
    ├── load/                    # Escenarios k6
    ├── __mocks__/               # Mock de Prisma, nodemailer
    └── helpers/                 # Fixtures y utilidades
```

---

## 🧪 Testing

```bash
npm test                  # Toda la suite (excluye tests/db y tests/e2e)
npm run test:unit         # Solo unit tests
npm run test:integration  # Solo integración
npm run test:coverage     # Con coverage report
npm run test:db           # Smoke contra Postgres REAL (requiere DATABASE_URL de prueba)
npm run test:e2e          # Playwright E2E
npm run test:e2e:ui       # Playwright UI mode
```

**Estado actual:** `164 suites / 2184 tests ✅` — medido en `dev` el 2026-10-29.

> Este número lo vigila un test (`tests/unit/docs/conteo-de-tests.test.ts`):
> falla si el conteo documentado aquí, en `docs/TESTS.md` o en `CLAUDE.md` se
> despega del real. Antes las tres fuentes decían cifras distintas y ninguna
> era la correcta, porque nada las comparaba con la realidad.

Cobertura focalizada en riesgo de negocio (no vanity coverage):

- ✅ JWT creación / verificación / expiración / firma incorrecta
- ✅ Login / refresh / logout / tenant switch
- ✅ RBAC (validateSession + checkUserPermission)
- ✅ CRUD de casos (crear, editar con optimistic locking, transiciones de fase)
- ✅ Reglas de documentos requeridos vs. opcionales vs. condicionales
- ✅ Integración con Google Drive por centro (Armonía / Constructores de Paz)
- ✅ Generación de documentos (paquetes 1–5, formato PDF/Word/ambos)

Más detalle en [`docs/TESTS.md`](./docs/TESTS.md).

---

## 🔄 CI/CD

Hay **cuatro** workflows, y ninguno despliega. Son estos:

### `pr.yml` — CI (en cada PR y en cada push a `dev`)

1. `npm ci --ignore-scripts` + `prisma generate`
2. `vercel pull` → `.env` del entorno correspondiente
3. `npm run lint` ← debe quedar en **0 warnings**
4. `npx tsc --noEmit` (con `--max-old-space-size=4096`: el type-check necesita >2 GB)
5. `npm audit --audit-level=high` ← **informativo**, no bloquea
6. **`npx jest --ci`** ← tests obligatorios
7. `npm run build` (con `CI_SKIP_BUILD_TYPECHECK=1`, para no repetir el type-check del paso 4)

Corre sin filtro de ramas **a propósito**: con `branches: [dev, main]`, un PR
apilado sobre otra rama de feature no encolaba el workflow en absoluto — ni
rojo ni `skipped`, que es más fácil de pasar por alto que un check en rojo.

### `e2e.yml` — Playwright (en cada PR, o a mano)

Levanta el Postgres preinstalado del runner, corre `db push` + seed +
`npm run test:db`, construye la app y ejecuta Playwright. Sube el reporte HTML
y los traces como artefactos. Tiene `workflow_dispatch`:
`gh workflow run e2e.yml --ref <rama>`.

### `smoke.yml` — verificación post-deploy (no despliega)

Escucha `deployment_status` de la integración nativa de Vercel y, cuando un
deploy termina **bien**, corre `scripts/smoke-test.sh` contra la URL publicada.
Con `workflow_dispatch` se puede apuntar a cualquier URL (rollback, incidente).

### `release.yml` — release de GitHub

Un tag `v*` dispara el release. El cuerpo sale de la sección
`## [<versión>]` de `CHANGELOG.md` **más** las notas que autogenera GitHub
(`generate_release_notes: true`), y queda marcado como pre-release si la
versión lleva guion (`1.0.0-rc.1`, por ejemplo).

### Deploy: no hay workflow, y es deliberado

El deploy lo hace **solo** la integración nativa Vercel↔GitHub: push a `dev` →
preview, push a `main` → producción. `deploy.yml` se eliminó a propósito y no
debe volver. Las migraciones (`prisma migrate deploy`) corren dentro del
`buildCommand` de `vercel.json`, gateadas por `$VERCEL_ENV=production`.

> **Estrategia de ramas:** sólo dos ramas de larga vida — `dev` (integración) y `main` (producción). Las ramas de trabajo (`feature/*`, `fix/*`) se mezclan vía PR a `dev`, y `dev → main` es un PR independiente cuando se promueve a producción.
>
> **Autoría de commits:** el plan Hobby de Vercel bloquea el deployment si el
> autor del commit HEAD no está vinculado a la cuenta dueña del proyecto. La
> regla y las identidades válidas están en `CLAUDE.md` § Autoría de commits.

---

## 🔐 Variables de Entorno

Ver [`.env.example`](./.env.example) para el listado completo y comentado, y
[`docs/RUNBOOK_ENV_VARS.md`](./docs/RUNBOOK_ENV_VARS.md) para configurarlas y
rotarlas en Vercel. Las que el runtime **necesita** para arrancar y operar:

| Variable                            | Descripción                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Connection string **con** pooler. Es la que usa la app en runtime                                   |
| `DIRECT_URL`                        | La misma base **sin** pooler. Obligatoria: la usan las migraciones                                  |
| `JWT_SECRET`                        | Clave HS256 de access **y** refresh token (≥32 chars)                                               |
| `GOOGLE_DRIVE_CLIENT_ID`            | OAuth2 client ID                                                                                    |
| `GOOGLE_DRIVE_CLIENT_SECRET`        | OAuth2 client secret                                                                                |
| `GOOGLE_DRIVE_REFRESH_TOKEN`        | Token de refresh de la Drive API (rotación: `docs/RUNBOOK_ROTACION_DRIVE.md`)                       |
| `GOOGLE_DRIVE_FOLDER_ID`            | Carpeta raíz donde se almacenan los casos                                                           |
| `SMTP_USER` / `SMTP_PASSWORD`       | Credenciales Gmail para emails transaccionales                                                      |
| `CRON_SECRET`                       | Token que exige `/api/cron/alerts`. Sin él la ruta responde 503                                     |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting distribuido. **Sin ellas cae a un contador en memoria, que en serverless no protege** |
| `APP_URL`                           | URL pública, usada en los links de los emails                                                       |

> **`DATABASE_URL_ARMONIA` y `DATABASE_URL_CONSTRUCTORES_PAZ` no las lee el
> runtime.** Siguen en `.env.example` porque las usan `src/scripts/run-prisma.ts`
> y `e2e.yml` —y este último solo las **declara** en el `env` del job, sin que
> ningún step las consuma—, pero la app usa **un solo datasource**
> (`DATABASE_URL`) contra **una sola** base y separa los centros por
> `tenantId`. Configurar esas dos y omitir `DATABASE_URL` / `DIRECT_URL` deja
> el entorno sin base. Tampoco existe `JWT_REFRESH_SECRET`: ningún archivo la
> lee. Ver `docs/ARQUITECTURA.md` §2.

Opcionales, con default razonable: `LOG_LEVEL`, `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN`, `HEALTH_DETAILS_TOKEN`, `CHROME_PATH` (solo local),
`NEXT_PUBLIC_APP_ENV` y los tres parámetros de negocio del cron
(`ALERTS_HEARING_LOOKAHEAD_HOURS`, `ALERTS_DEDUPE_WINDOW_HOURS`,
`ALERTS_EMAIL_ENABLED`).

---

## 📚 Documentación

| Documento                                                                                      | Propósito                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md)                                               | Diagrama de arquitectura, flujos y decisiones técnicas                                            |
| [`docs/DIAGRAMA_COMPONENTES.md`](./docs/DIAGRAMA_COMPONENTES.md)                               | Diagrama de componentes: desglose de módulos y dependencias                                       |
| [`docs/MODELO_ENTIDAD_RELACION.md`](./docs/MODELO_ENTIDAD_RELACION.md)                         | Modelo Entidad-Relación (ERD) en 3 vistas temáticas                                               |
| [`docs/DIAGRAMA_CLASES.md`](./docs/DIAGRAMA_CLASES.md)                                         | Diagrama de clases (UML) del modelo de dominio                                                    |
| [`docs/DICCIONARIO_DATOS.md`](./docs/DICCIONARIO_DATOS.md)                                     | Diccionario de datos: modelo relacional de la base de datos (tablas, columnas, tipos, relaciones) |
| [`docs/DICCIONARIO_PLACEHOLDERS.md`](./docs/DICCIONARIO_PLACEHOLDERS.md)                       | Diccionario de placeholders para plantillas documentales                                          |
| [`docs/REQUISITOS_INSOLVENTIC.xlsx`](./docs/REQUISITOS_INSOLVENTIC.xlsx)                       | Requisitos funcionales (RF) y no funcionales (RNF)                                                |
| [`docs/MANUAL_USUARIO.md`](./docs/MANUAL_USUARIO.md)                                           | Guía funcional para operadores y administradores                                                  |
| [`docs/TESTS.md`](./docs/TESTS.md)                                                             | Plan de pruebas y reporte de cobertura                                                            |
| [`docs/FORMULARIO_MAESTRO.md`](./docs/FORMULARIO_MAESTRO.md)                                   | Especificación del formulario maestro de insolvencia                                              |
| [`docs/VALIDACIONES_Y_GENERACION.md`](./docs/VALIDACIONES_Y_GENERACION.md)                     | Reglas de validación y proceso de generación                                                      |
| [`docs/AUDITORIA_SISTEMA_DOCUMENTOS.md`](./docs/AUDITORIA_SISTEMA_DOCUMENTOS.md)               | Auditoría del sistema documental                                                                  |
| [`docs/AUDITORIA_MODULO_GENERACION_2026-07.md`](./docs/AUDITORIA_MODULO_GENERACION_2026-07.md) | Auditoría técnica del módulo de generación de documentos                                          |
| [`docs/AUDITORIA_INSOLVENTIC_2026-07-11.md`](./docs/AUDITORIA_INSOLVENTIC_2026-07-11.md)       | Auditoría integral del sistema y decisiones de arquitectura                                       |
| [`CHANGELOG.md`](./CHANGELOG.md)                                                               | Historial de versiones                                                                            |

### Operación y contexto de trabajo

| Documento                                                            | Propósito                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`CLAUDE.md`](./CLAUDE.md)                                           | Convenciones, trampas y decisiones que no hay que reabrir                |
| [`docs/MAPA.md`](./docs/MAPA.md)                                     | Dónde está cada cosa: módulo por dominio, UI por ruta, índice de `docs/` |
| [`docs/DECISIONES.md`](./docs/DECISIONES.md)                         | Decisiones de arquitectura por iteración, con su porqué y sus non-goals  |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md)                               | Fase 2, Fase 3 y Quick Wins pendientes                                   |
| [`docs/RUNBOOK.md`](./docs/RUNBOOK.md)                               | Operación: incidentes por componente, backups, contactos                 |
| [`docs/RUNBOOK_ENV_VARS.md`](./docs/RUNBOOK_ENV_VARS.md)             | Variables de entorno en Vercel: alta, cambio, rotación                   |
| [`docs/RUNBOOK_ROTACION_DRIVE.md`](./docs/RUNBOOK_ROTACION_DRIVE.md) | Rotación de credenciales de Google Drive                                 |

---

## 🏷️ Versionado

Semantic Versioning (`MAJOR.MINOR.PATCH`). Fuente de verdad: `package.json → version`.

```bash
npm version patch   # 0.1.0 → 0.1.1 (bugfix)
npm version minor   # 0.1.0 → 0.2.0 (feature)
npm version major   # 0.1.0 → 1.0.0 (breaking)
git push origin dev --tags
```

Un badge sutil en la esquina inferior izquierda muestra la versión activa con sufijo `-dev` según `NODE_ENV`.

---

## 📄 Licencia

Software propietario. Copia, transferencia o reproducción no autorizada estrictamente prohibida.

© 2025–2026 INSOLVENTIC — Sistema de Gestión de Procesos de Insolvencia
