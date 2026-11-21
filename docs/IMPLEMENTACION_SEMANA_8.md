# Semana 8 — Cumplimiento (Ley 1581) y handover de documentación — Tanda A

**Fecha:** 2026-10-18
**Base:** `dev` @ `376d83b` (con el merge de #140 incluido) · **Rama:**
`docs/cumplimiento-y-handover` · **PR:**
[#141](https://github.com/insolventic/insolventic/pull/141) (abierto, **sin
mergear**)
**Origen:** cerrar los huecos de documentación y cumplimiento antes de la
entrega.
**Sin cambios de schema ni migraciones.** Esta es la **Tanda A** —5 de las
7 tareas del encargo original. La Tanda B (CI + CHANGELOG/versión) queda
para una rama y PR aparte, después de que esta se mergee.

> **Este documento NO está commiteado.**

---

## 1. Resumen

5 commits (uno de ellos de la sesión anterior, ya incluido en este PR).

| #   | Qué                                                                       | Commit    |
| --- | ------------------------------------------------------------------------- | --------- |
| 1   | `/privacidad` y `/terminos` — páginas públicas (borrador)                 | `ae4257b` |
| 2   | `docs/PROCEDIMIENTO_ARCO.md`                                              | `518714d` |
| 3   | `docs/ARQUITECTURA.md` §2 — **sin cambios, verificado correcto** (ver §3) | —         |
| 4   | Variables de entorno muertas + `LOG_LEVEL` + nota de Sentry               | `7d58d34` |
| 5   | `docs/MANUAL_USUARIO.md` actualizado                                      | `c296f88` |

### Verificación local

| Check                       | Resultado                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | ✅ 0 errores                                                                                                                                                        |
| `npm run lint`              | ✅ 0 errores / 0 warnings                                                                                                                                           |
| `npx jest --ci`             | ✅ **2004 tests / 141 suites** (sin cambio respecto de la base — ninguna tarea de esta tanda toca lógica de negocio, salvo las páginas nuevas, que sí llevan tests) |
| `npm run test:db`           | ✅ **111 / 111**, 7 suites, contra Postgres 16 real — guardián de migraciones sin cambios (no hay migración en esta tanda)                                          |
| `npm run test:e2e`          | ✅ **13 / 13**                                                                                                                                                      |
| Golden master               | ✅ sin cambios (nada de esta tanda toca documentos ni placeholders)                                                                                                 |
| `/privacidad` y `/terminos` | ✅ verificado visualmente en el navegador (capturas en la sesión, no adjuntas aquí) — renderizan, el pie "Privacidad · Términos" aparece en toda la app             |

**+2 tests nuevos** desde la base de esta rama (2002→2004: las 2 rutas
públicas agregadas a `middleware-auth-gate.test.ts`, además de los 2 casos
ya incluidos en el commit `ae4257b` de la sesión anterior).

---

## 2. Qué cambió, tarea por tarea

### 2.1 `/privacidad` y `/terminos` (`ae4257b`, sesión anterior — incluido en este PR)

Ver el commit; resumen: dos páginas públicas (agregadas a `PUBLIC_ROUTES`
en `src/middleware.ts`, match exacto — el test de regresión C-1 sigue
verde), enlazadas desde el login y desde un pie de página nuevo
(`AppFooter`) visible en toda la app. Contenido verificado contra
`schema.prisma` (qué datos trata el sistema), `google-drive.ts` y
`email.ts` (transmisión a Google Drive y Gmail/SMTP). Banner "BORRADOR
PENDIENTE DE REVISIÓN LEGAL" y marcas `⟨COMPLETAR⟩` — lista completa en §4.

### 2.2 `docs/PROCEDIMIENTO_ARCO.md` (`518714d`)

Procedimiento interno (no público) para atender conocer/actualizar/
rectificar/suprimir. El conflicto entre supresión y conservación del
expediente legal se deja **planteado, no resuelto**: tres preguntas
concretas para la abogada (§4 del documento), y mientras tanto la regla
operativa es la más conservadora — ante duda, no se suprime, se escala.

### 2.3 `docs/ARQUITECTURA.md` §2 — verificado, sin cambios

**El encargo partía de una premisa que ya no era cierta.** Se verificó §2
contra `src/lib/prisma.ts` línea por línea: la sección **ya describe**
correctamente un solo `PrismaClient` sobre `DATABASE_URL` con aislamiento
por `tenantId` — incluye el diagrama de secuencia, dónde está cada pieza
en el código, y una nota fechada "Corregido el 2026-10-09" que explica
exactamente el error que el encargo pedía corregir (una BD por centro con
`getPrismaClient(tenantSlug)`) y por qué no existe en el código. Esa
corrección ya se hizo en una rama anterior a esta sesión. No se tocó el
archivo — forzar un cambio sobre una sección ya correcta habría sido
exactamente el tipo de edición no verificada que el encargo pedía evitar.

### 2.4 Variables de entorno (`7d58d34`)

- `JWT_REFRESH_SECRET` y `NEXTAUTH_SECRET`: verificados 0 usos en `src/`.
  Quitadas de `.env.example`. **No** se tocó
  `.github/workflows/e2e.yml`, donde también aparecen (igual de muertas,
  inyectadas como env vars de CI sin consumidor) — modificar CI no era
  parte de esta tarea.
- `docs/RUNBOOK_ENV_VARS.md`: **verificado, sin cambios.** Ese documento
  declara su propio alcance en el encabezado — variables de conexión a
  Postgres/Neon, no un catálogo general de env vars — y ninguna de las 4
  variables de esta tarea aparece ahí. No había nada que quitar.
- `LOG_LEVEL` (real, usado en `src/lib/logger.ts`, nunca documentado):
  agregado con su default real.
- `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`: nota de que hoy no se
  usan porque `withSentryConfig()` está desactivado a propósito
  (`next.config.ts`, evita el `ENOENT` de `@vercel/nft` con
  `@opentelemetry/api`) — Sentry sigue activo por el import dinámico de
  `logger.ts`, solo sin source maps subidos en build.

### 2.5 `docs/MANUAL_USUARIO.md` (`c296f88`)

Cada afirmación nueva se verificó contra el código, no contra el documento
anterior (que tenía roles, fases y conteos que ya no existían):

- **Roles** (`src/prisma/seed.ts`): eran Administrador/Operador/
  Asistente/Auditor — son Administrador/Operadora de Insolvencia/Abogado/
  Asistente Legal/Secretaria, con el alcance de cada uno tomado de sus
  permisos reales en el seed.
- **Fases**: el modelo tiene 13, no 4. Se documentan las 5 nuevas
  (Rechazo, Retiro, Desistimiento, Acuerdo impugnado, Acuerdo reformado —
  `docs/DISENO_FASES_NUEVAS_2026-09-11.md`) y los subtipos obligatorios de
  Fracaso (13, `templates-config.ts`) y Desistimiento (2,
  `case-phases.ts`: "No pago de tarifas" y "Abandono total").
- **Generación de documentos**: los conteos fijos (49, 27 — los mismos que
  se corrigieron en la UI real en el PR #140) se quitan del manual; se
  documenta el troceo en tandas con progreso y reintento (GD-A1), y el
  membrete por centro.
- **Formulario de conciliación**: nueva mención de Zoom, fechas reales
  (solicitud/citación/desistimiento) y Aclaración de Acta — los campos de
  la migración de C-1a/C-1c (PR #139).
- **Separador de miles**: mencionado donde se crea un caso.

---

## 3. Los `⟨COMPLETAR⟩` — lista exacta

Todo lo que el equipo de desarrollo no puede llenar porque depende del
cliente o de la abogada. Nada de esto se inventó ni se completó con un
valor de relleno.

### En `/privacidad`

| Dato                                                                 | Dónde |
| -------------------------------------------------------------------- | ----- |
| Razón social de Armonía                                              | §1    |
| NIT de Armonía                                                       | §1    |
| Razón social de Constructores de Paz                                 | §1    |
| NIT de Constructores de Paz                                          | §1    |
| Correo del canal ARCO (uno por centro, o uno compartido — a decidir) | §5    |
| Plazo de retención de los datos tras terminar el trámite             | §6    |

### En `docs/PROCEDIMIENTO_ARCO.md`

| Dato                                                                                                   | Dónde |
| ------------------------------------------------------------------------------------------------------ | ----- |
| A quién llega el correo del canal ARCO en cada centro, y quién aprueba una supresión                   | §2    |
| Qué se exige para verificar la identidad de quien solicita (evitar que un tercero suplante al titular) | §3.5  |
| Plazos de respuesta por tipo de solicitud (NO se afirmó un número sin verificarlo con la abogada)      | §5    |
| Dónde se registra cada solicitud atendida                                                              | §6    |

### Decisión pendiente, no un dato a completar

El conflicto entre supresión y conservación del expediente legal
(`docs/PROCEDIMIENTO_ARCO.md` §4) no es un `⟨COMPLETAR⟩` — es una pregunta
de fondo para la abogada, con 3 sub-preguntas concretas ya planteadas en
el documento. No tiene una respuesta de relleno posible.

---

## 4. Riesgos y qué verificar antes de promover a `main`

- **Los textos legales son borrador.** Las dos páginas públicas llevan el
  banner correspondiente y no afirman cumplimiento de ninguna norma — pero
  siguen siendo texto que un visitante sin sesión puede leer. Antes de
  promover a producción, confirmar que el banner de borrador es
  aceptable para mostrarse en producción tal cual, o si se prefiere
  bloquear las rutas hasta tener el visto bueno legal.
- **Los `⟨COMPLETAR⟩` de §3 son bloqueantes para que el documento deje de
  ser un borrador.** Sin la razón social y el NIT de cada centro, la
  política no identifica correctamente al responsable del tratamiento —
  un requisito básico, no cosmético.
- **`docs/ARQUITECTURA.md` no se tocó** (§2.3) — confirmar que esto es
  aceptable antes de cerrar la tarea; si había una intención distinta
  detrás del encargo que esta verificación no captó, decirlo antes de
  mergear.
- **Nada de esta tanda toca schema, migraciones, plantillas ni
  `validation-rules.ts`** — confirmado por el diff y por `npm run
test:db` sin cambios en el guardián de migraciones.
- **Tanda B queda pendiente**, explícitamente, hasta que se mergee esta.
