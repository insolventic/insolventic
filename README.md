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
- **~400 campos** por caso, organizados en 9 secciones (Solicitante, Cónyuge, Ingresos/Gastos, Cesación de pagos, Declaraciones, etc.)
- **Fases auditadas:** Solicitud → Admisión → Negociación → Terminación (Acuerdo / Fracaso)
- **Optimistic locking** (campo `version`) previene sobrescrituras concurrentes
- **Filtros avanzados:** estado, fase, tipo de caso, operador

### 👥 Deudores, Acreedores y Apoderados

- CRUD completo con historial de casos vinculados
- **Asignación bilateral** en conciliaciones (convocante/convocado)
- Soporte para representantes legales y apoderados

### 📝 Generación Automática de Documentos (49 plantillas)

- 5 paquetes estructurados: **Solicitud / Admisión / Negociación / Terminación / Fracaso**
- Salida en **PDF, Word (.docx) o ambos**
- Plantillas `.docx` con placeholders parametrizados
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

- JWT con access token (24h) + refresh token (7 días, security hardening)
- **RBAC** por permisos (granularidad a nivel de módulo y acción)
- **Multi-tenant aislado** por `tenantId` en todas las queries
- Middleware de autenticación en rutas y server actions
- `mustChangePassword` forzado incluso en refresh/tenant switch
- Hash `bcrypt` para contraseñas
- Tokens firmados con HS256

---

## 🧱 Stack Técnico

| Capa               | Tecnología                                    |
| ------------------ | --------------------------------------------- |
| **Frontend**       | Next.js 15 (App Router, Turbopack) + React 19 |
| **UI**             | Shadcn UI + Radix Primitives + Tailwind CSS 4 |
| **Formularios**    | React Hook Form + Zod                         |
| **ORM**            | Prisma (PostgreSQL / CockroachDB)             |
| **Auth**           | JWT con `jose` (HS256, cookies httpOnly)      |
| **Almacenamiento** | Google Drive API (por centro de conciliación) |
| **Documentos**     | Plantillas HTML → Puppeteer/Chromium (PDF) + `html-to-docx` (DOCX) |
| **Testing**        | Jest + React Testing Library + Playwright     |
| **CI/CD**          | GitHub Actions + Vercel                       |
| **Email**          | Nodemailer (Gmail SMTP)                       |

---

## 🚀 Puesta en Marcha

### Prerrequisitos

- Node.js **20.x** o superior
- PostgreSQL / CockroachDB con 2 bases (una por centro, ver `DATABASE_URL_*`)
- Cuenta de Google Cloud con Drive API habilitada y credenciales OAuth2

### Instalación

```bash
# 1. Clonar
git clone https://github.com/Nick220505/insolventic.git
cd insolventic

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales reales

# 4. Generar cliente Prisma
npx prisma generate

# 5. Sincronizar schema (desarrollo)
npx prisma db push

# 6. Seed inicial (roles, permisos, usuarios admin)
npx tsx src/prisma/seed.ts

# 7. Arrancar dev server
npm run dev
```

Aplicación disponible en `http://localhost:3000`.

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
├── .github/workflows/           # CI/CD (pr.yml, deploy.yml, release.yml)
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
│   │   ├── settings/            # Configuración por centro
│   │   └── api/                 # Route handlers (download, webhooks)
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
    ├── __mocks__/               # Mock de Prisma, nodemailer
    └── helpers/                 # Fixtures y utilidades
```

---

## 🧪 Testing

```bash
npm test                  # Toda la suite
npm run test:unit         # Solo unit tests
npm run test:integration  # Solo integración
npm run test:coverage     # Con coverage report
npm run test:e2e          # Playwright E2E
npm run test:e2e:ui       # Playwright UI mode
```

**Estado actual:** `20 suites / 405 tests ✅`

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

### Pull Requests (`.github/workflows/pr.yml`)

1. `npm ci`
2. `prisma generate`
3. `npm run lint`
4. **`jest --ci`** ← tests obligatorios
5. `npm run build`

### Deploy (`.github/workflows/deploy.yml`)

- Push a `dev` → preview en Vercel (env `preview`)
- Push a `main` → producción en Vercel (env `production`)
- Aplica migraciones con `prisma migrate deploy`
- Baseline automático de `20260205212559_init` cuando procede

> **Estrategia de ramas:** sólo dos ramas de larga vida — `dev` (integración) y `main` (producción). Las ramas de trabajo (`feature/*`, `fix/*`) se mezclan vía PR a `dev`, y `dev → main` es un PR independiente cuando se promueve a producción.

### Releases (`.github/workflows/release.yml`)

- Tags `v*` disparan release de GitHub con notas automáticas

---

## 🔐 Variables de Entorno

Ver [`.env.example`](./.env.example) para el listado completo. Variables críticas:

| Variable                         | Descripción                                    |
| -------------------------------- | ---------------------------------------------- |
| `DATABASE_URL_ARMONIA`           | Conn string de la BD del centro Armonía        |
| `DATABASE_URL_CONSTRUCTORES_PAZ` | Conn string de la BD de Constructores de Paz   |
| `JWT_SECRET`                     | Clave HS256 para access tokens (≥32 chars)     |
| `JWT_REFRESH_SECRET`             | Clave HS256 para refresh tokens (≥32 chars)    |
| `GOOGLE_DRIVE_CLIENT_ID`         | OAuth2 client ID                               |
| `GOOGLE_DRIVE_CLIENT_SECRET`     | OAuth2 client secret                           |
| `GOOGLE_DRIVE_REFRESH_TOKEN`     | Token de refresh para la Drive API             |
| `GOOGLE_DRIVE_FOLDER_ID`         | Carpeta raíz donde se almacenan los casos      |
| `SMTP_USER` / `SMTP_PASSWORD`    | Credenciales Gmail para emails transaccionales |

---

## 📚 Documentación

| Documento                                                                        | Propósito                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md)                                 | Diagrama de arquitectura, flujos y decisiones técnicas   |
| [`docs/MANUAL_USUARIO.md`](./docs/MANUAL_USUARIO.md)                             | Guía funcional para operadores y administradores         |
| [`docs/TESTS.md`](./docs/TESTS.md)                                               | Plan de pruebas y reporte de cobertura                   |
| [`docs/FORMULARIO_MAESTRO.md`](./docs/FORMULARIO_MAESTRO.md)                     | Especificación del formulario maestro de insolvencia     |
| [`docs/DICCIONARIO_VARIABLES.md`](./docs/DICCIONARIO_VARIABLES.md)               | Diccionario de placeholders para plantillas documentales |
| [`docs/VALIDACIONES_Y_GENERACION.md`](./docs/VALIDACIONES_Y_GENERACION.md)       | Reglas de validación y proceso de generación             |
| [`docs/AUDITORIA_SISTEMA_DOCUMENTOS.md`](./docs/AUDITORIA_SISTEMA_DOCUMENTOS.md) | Auditoría del sistema documental                         |
| [`CHANGELOG.md`](./CHANGELOG.md)                                                 | Historial de versiones                                   |

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
