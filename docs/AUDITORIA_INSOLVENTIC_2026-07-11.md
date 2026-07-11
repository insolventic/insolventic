# AUDITORÍA INTEGRAL — INSOLVENTIC

**Fecha:** 2026-07-11 · **Ambiente:** Producción · **Método:** Análisis estático + build + suite de tests
**Versión auditada:** 0.3.0 (commit `758b733`, rama `main`)

---

## RESUMEN EJECUTIVO

### Métricas clave

| Métrica | Valor |
|---|---|
| Líneas de código (src) | 63.524 |
| Archivos TS/TSX | 253 (promedio 251 líneas/archivo) |
| Modelos de BD | 26 (52 relaciones, 13 índices compuestos) |
| Tests | 25 archivos · 427 tests unit/integration en verde · 3 specs E2E (Playwright) · k6 load tests |
| CI/CD | 4 workflows (PR quality, deploy Vercel, E2E, release) |
| Vulnerabilidades npm | **27 (9 high, 17 moderate, 1 low)** |
| Bundle | First Load compartido 102 kB · peor ruta: /dashboard 342 kB |

### Salud general

| Área | Estado |
|---|---|
| TypeScript | ✓ `tsc --noEmit` 0 errores; 1 solo `: any`; strict razonable (18 casts `as unknown as` concentrados en documentos) |
| Tests | ✓ 427/427 verde, buena infraestructura — ⚠ cobertura desigual (ver hallazgos) |
| Seguridad de aplicación | ✓ Sólida (auth, tenant scoping, sin secrets hardcodeados) |
| Seguridad de dependencias | ✗ 27 vulnerabilidades, 9 high — acción inmediata |
| Performance | ⚠ Aceptable; dashboard pesado y P1 (Chromium por documento) pendiente |
| Documentación | ✓ Por encima de la media (8 docs + README + CHANGELOG) |

---

## HALLAZGOS CRÍTICOS

### 🔴 Crítico (hacer ASAP)

1. **27 vulnerabilidades en dependencias, 9 high.** Afectados: `next` (rango con advisory high — actualizar a parche de la serie 15.5.x o superior), `nodemailer`, `undici`, `ws`, `@xmldom/xmldom`, `tmp`, `fast-uri`, `basic-ftp`. La mayoría se resuelve con `npm audit fix` (sin breaking) + bump puntual de `next`. **Impacto:** superficie de ataque en producción con datos legales reales. **Esfuerzo:** 2–4 h (fix + regresión con la suite existente).

2. **El build de producción falla si falta cualquier env var** (`Error: SMTP_USER env var is required` en "Collecting page data"). `src/lib/email.ts` y `src/middleware.ts` validan variables **en tiempo de import**, no de uso. Hoy funciona porque CI hace `vercel pull`, pero cualquier entorno nuevo (staging, otro dev, DR) rompe el build, y un env incompleto tumba TODO el build en vez de la funcionalidad afectada. **Fix:** inicialización perezosa (validar dentro de la función que envía el email / primer uso). **Esfuerzo:** 2 h. *(Verificado: con envs dummy el build compila limpio — el código en sí está sano.)*

### 🟠 Alto (próximas 2 semanas)

1. **334 `console.log/warn` en código de producción** (154 log, 166 error, 14 warn), incluyendo logs de debug con emojis en `use-auth.ts` que se imprimen incluso durante el build. Con Sentry ya integrado, migrar a un logger con niveles (o al menos gate `NODE_ENV !== 'production'`). Los `console.error` de los catch pueden quedarse si alimentan Sentry. **Esfuerzo:** 4–8 h.

2. **P1 de la auditoría del módulo documentos (pendiente):** el flujo de creación de casos lanza **un proceso Chromium por documento** (~6 por caso). `batchHtmlToPdf` ya existe y se usa en el flujo batch — falta migrar `generateFromTemplates`. **Impacto:** ~5× en latencia de generación. **Esfuerzo:** 6–10 h con pruebas E2E.

3. **P3+P4 (pendientes):** sin lock anti-doble-generación (doble clic ⇒ duplicados en Drive/BD) y la generación en background de `createCase` falla en silencio (`.catch(console.error)`, sin estado visible ni retry; en Vercel una promesa no esperada puede ser cortada al cerrar la respuesta). **Esfuerzo:** 6–8 h.

4. **18 casts `as unknown as CaseWithRelations`** concentrados en el pipeline de documentos — anulan el type-checking justo donde el sistema genera documentos legales. Causa raíz: `CaseWithRelations` (Zod) vs payload de Prisma (Decimal vs number). **Fix estructural:** derivar el tipo con `Prisma.CaseGetPayload<typeof CASE_GENERATION_INCLUDE>` + una función de transformación única Decimal→number. **Esfuerzo:** 8–12 h.

5. **Solo existe 1 migración Prisma** (`20260205212559_init`) para 26 modelos en evolución (v0.3.0 con módulos nuevos). Si el flujo real es `db push`, los entornos no son reproducibles y no hay trazabilidad de cambios de schema en producción multi-tenant. Ya existe `check:schema-drift` en scripts — formalizar `migrate dev/deploy` como único camino. **Esfuerzo:** 4 h + disciplina.

---

## HALLAZGOS POR ÁREA

### Arquitectura — ✓ buena, con 2 monolitos internos

- ✓ Separación clara por features (15 features con `actions.ts` + `schemas.ts`), server actions como única capa de API (una sola API route: el cron de alertas), componentes colocados junto a su ruta (122 locales) + 35 compartidos (27 son UI kit shadcn/Radix).
- ✓ Acoplamiento entre features bajo y direccional: los imports cruzados van casi todos a `auth` (15) y `audit-log` (8) — dependencias legítimas de infraestructura. Sin ciclos evidentes.
- ⚠ Archivos-monolito que concentran el riesgo: `placeholder-mapper.ts` (2.877), `case/schemas.ts` (2.429), `case/actions.ts` (2.418), `document/actions.ts` (1.592), `create-case-dialog.tsx` (1.494). Recomendación: dividir `placeholder-mapper` por dominio (builders HTML / mappers escalares / conciliación / apoyo) y `create-case-dialog` por pasos del formulario.

### Calidad de código — ✓

- ✓ 0 errores TypeScript, 1 solo `: any`, 0 TODOs/FIXMEs reales, Prettier + husky + lint-staged configurados.
- ⚠ 14 warnings ESLint (12 unused-vars, 2 `react-hooks/exhaustive-deps` en reportes — estos dos pueden causar datos stale al cambiar filtros). Quick win: limpiar en una pasada.
- ⚠ Los 334 console.* (ver Alto #1).

### Seguridad — ✓ aplicación / ✗ dependencias

- ✓ **Auth:** middleware JWT con `jose`, validación de redirect path, 86 llamadas `authenticateUser()` y 128 checks de permisos en server actions — el patrón se aplica consistentemente.
- ✓ **Multi-tenancy:** 453 referencias `tenantId` en features, 70 en schema, índices compuestos por tenant. Aislamiento aplicado en cada query revisada.
- ✓ **Secrets:** 0 hardcodeados; 24 env vars inventariadas; `.env.example` presente; passwords con bcrypt.
- ✓ **XSS/Inyección:** 0 raw queries (100 % Prisma); 1 solo `dangerouslySetInnerHTML` (script estático de tema en `layout.tsx`, sin datos de usuario — seguro); escapado OWASP de placeholders implementado (P2, commit `758b733`).
- ✗ **Dependencias:** 27 vulnerabilidades (ver Crítico #1).
- ⚠ Rate limiting existe para generación de documentos pero es in-memory — en serverless multi-instancia es por-instancia, no global. Aceptable hoy; documentar la limitación.

### Performance — ⚠

- ✓ Bundle compartido razonable (102 kB First Load); mayoría de rutas 119–230 kB.
- ⚠ `/dashboard` 137 kB propios / 342 kB First Load — candidato a `next/dynamic` para gráficos y secciones pesadas. `/cases` 63 kB propios (el diálogo de creación gigante viaja con la página — lazy-load del diálogo).
- ⚠ N+1 puntuales: `document/actions.ts:163,239` hace `findFirst` de plantillas dentro de un bucle; el resto del acceso a datos usa `include`/`createMany` correctamente (12 createMany, 3 $transaction).
- ⚠ P1 Chromium (ver Alto #2) es el problema de performance dominante del sistema.
- ℹ 127 de 129 archivos de `app/` son `'use client'` — la app es efectivamente un SPA con server actions. Funciona, pero renuncia a streaming/SSR selectivo; no lo cambiaría ahora, solo en pantallas nuevas de alto tráfico.

### Datos/BD — ✓ con reservas

- ✓ 26 modelos coherentes con el dominio; 13 índices compuestos bien elegidos (`[tenantId, status]`, `[tenantId, dueDate, status]`, etc.); unicidad en 14 puntos.
- ⚠ Sin soft-delete (`deletedAt`: 0) — para expedientes legales en producción, el borrado físico (`deleteCase` usa $transaction en cascada) es arriesgado desde el punto de vista de retención/auditoría. Existe AuditLog, pero el dato borrado no se recupera. Evaluar soft-delete al menos en `Case`, `Document`, `Payment`.
- ⚠ `createdAt/updatedAt` solo aparece 17 veces en el schema — varios modelos carecen de timestamps de auditoría.
- ✗ 1 sola migración (ver Alto #5).

### Frontend/UX — ⚠

- ✓ Design system: Tailwind 4 + Radix + shadcn (27 componentes UI), theming multi-tenant con CSS vars, dark mode.
- ✓ Formularios con react-hook-form + resolvers Zod (337 labels).
- ⚠ **Accesibilidad débil:** 19 atributos `aria-*` y 13 `alt=` en todo el proyecto. Radix aporta a11y de base en primitivas, pero tablas de datos, iconos-botón y estados de carga carecen de etiquetado. Pasada de a11y sobre las 5 pantallas núcleo (~8 h).
- ⚠ 2 `useEffect` con deps incompletas en reportes (riesgo de datos stale).

### DevOps — ✓

- ✓ CI de PR completa (lint + jest con env real de Vercel), deploy automatizado preview/prod, workflow E2E separado, release workflow, cron de alertas vía `vercel.json`.
- ✓ Observabilidad: Sentry en client/edge/server.
- ⚠ CI no ejecuta `tsc --noEmit` explícito (el build lo cubre parcialmente vía `next build`… que CI de PR no corre — solo lint+jest). Agregar type-check al PR workflow: 1 línea.
- ⚠ No hay `npm audit` en CI — agregar como job no bloqueante.
- ℹ Sin Docker — irrelevante siendo Vercel-first.

### Testing — ⚠ (buena base, cobertura desigual)

- ✓ 427 tests verdes, mocks disciplinados (45), integration + E2E + load (k6) + chequeo de drift de schema — infraestructura por encima de lo típico.
- ⚠ Huecos: `generate-documents.ts` y `templates-config.ts` sin tests (P9 — un rename de plantilla solo falla en runtime); `payment` (1.318 líneas), `report`, `calendar` y `creditor/debtor` actions con poca o ninguna cobertura; 3 E2E specs cubren solo auth y casos.
- Quick win P9: test de invariantes que recorra `ALL_TEMPLATES` y verifique `fs.access(getTemplatePath(t))` (~1 h).

### Documentación — ✓

- ✓ README (278 líneas), CHANGELOG, 8 documentos (arquitectura, diccionario de variables, formulario maestro, validaciones, manual de usuario, tests, 2 auditorías). JSDoc denso en los módulos núcleo.
- ⚠ Falta guía de setup de entorno (la lista de 24 env vars de este reporte puede sembrarla) y documentación del modelo de permisos (128 checks, ¿matriz de roles?).

---

## HOJA DE RUTA SUGERIDA

### Fase 1 (Semana 1) — Seguridad y estabilidad — ~8–12 h
- [ ] `npm audit fix` + bump `next` a parche → suite completa de regresión
- [ ] Lazy-init de env vars en `email.ts` (y revisar middleware) — desbloquea builds en cualquier entorno
- [ ] Agregar `tsc --noEmit` y `npm audit` (no bloqueante) al workflow de PR
- [ ] Limpiar 14 warnings ESLint + eliminar logs de debug de `use-auth.ts`

### Fase 2 (Semanas 2–3) — Módulo documentos (continuación P1/P3/P4) — ~16–20 h
- [ ] P1: batch de Chromium en creación de casos (5× performance)
- [ ] P3: lock anti-doble-generación
- [ ] P4: estado persistente de la generación en background + retry visible
- [ ] P9: test de invariantes de plantillas en disco

### Fase 3 (Mes 2) — Deuda estructural — ~30–40 h
- [ ] Eliminar los 18 casts `as unknown as` con tipos derivados de Prisma
- [ ] Formalizar migraciones Prisma como único camino de schema
- [ ] Evaluar soft-delete en Case/Document/Payment + timestamps faltantes
- [ ] Dividir `placeholder-mapper.ts` y `create-case-dialog.tsx`
- [ ] Pasada de accesibilidad en pantallas núcleo
- [ ] Lazy-load de gráficos del dashboard y del diálogo de creación de casos
- [ ] Cobertura de tests para payment/report/calendar

---

## DEUDA TÉCNICA ESTIMADA

| Categoría | Estimación |
|---|---|
| Seguridad deps + hardening CI | 5 pts |
| Módulo documentos (P1/P3/P4/P9) | 13 pts |
| Refactoring (tipos, monolitos, logger) | 21 pts |
| Testing (features sin cobertura) | 13 pts |
| BD (migraciones, soft-delete, timestamps) | 8 pts |
| A11y + performance frontend | 8 pts |
| **Total** | **~68 story points** |

---

## QUICK WINS (< 4 h c/u)

1. `npm audit fix` — elimina la mayoría de las 27 vulnerabilidades de un golpe.
2. Lazy-init de `SMTP_USER` en `email.ts` — builds reproducibles en cualquier entorno.
3. `tsc --noEmit` en CI de PR — 1 línea, previene regresiones de tipos.
4. Test de invariantes de plantillas (P9) — detecta renames rotos en CI, no en producción.
5. Limpiar warnings ESLint + debug logs de `use-auth` — higiene inmediata.
6. `next/dynamic` para el diálogo de creación de casos — recorta la ruta `/cases`.

---

## CONCLUSIÓN

INSOLVENTIC está en un estado **notablemente sano para un proyecto de tesis en producción**: la seguridad de aplicación (auth, multi-tenancy, escapado, sin secrets) es su punto más fuerte y supera lo habitual; la infraestructura de tests y CI es sólida; la documentación es abundante. Las dos urgencias reales son **externas al código de negocio**: dependencias vulnerables y la fragilidad del build ante env vars. La deuda estructural (casts de tipos, monolitos, migración única, console.log) es manejable y está localizada — sobre todo en el módulo de documentos, que ya tiene su propia hoja de ruta (P1–P9, con P2 completado).

**Recomendación principal:** ejecutar la Fase 1 esta semana (es barata y elimina el riesgo más alto), continuar con la Sesión 2 ya planificada del módulo de documentos, y programar la deuda estructural como trabajo de fondo constante (~20 % del tiempo de desarrollo).

---

*Auditoría de solo lectura: no se modificó código, configuración ni dependencias. Único artefacto generado: este reporte (y el output de build en `.next/`, regenerable).*
