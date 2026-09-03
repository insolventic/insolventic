# Semana 3 — Blindaje de lógica de negocio (Casos + Documentos)

**Rama:** `fix/semana-3-logica-negocio` (desde `dev`)
**Fecha:** 2026-09-02
**Origen:** los 4 hallazgos 🔴 Críticos de `docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md`
**Tests:** 504 → **585** (todos en verde; +81 nuevos)

---

## 1. Resumen

Los cuatro críticos compartían una misma causa raíz: **la validación existía, pero no se invocaba en el servidor**. La máquina de estados, las reglas del trámite y las dos funciones de validación documental estaban escritas y probadas — sólo que colgadas de componentes de React o de una ruta de generación que casi nadie usa. Cualquier POST directo a una server action las saltaba todas.

Esta semana no escribe reglas nuevas: las cablea donde son obligatorias, extrae los guards a funciones puras testeables, y añade la cobertura de tests que la auditoría señaló como ausente.

| #   | Hallazgo                                         | Commit    | Estado                            |
| --- | ------------------------------------------------ | --------- | --------------------------------- |
| C-1 | Máquina de estados bypasseable vía `updateCase`  | `9e0ed99` | ✅ Cerrado                        |
| C-2 | Reglas del trámite sólo en frontend              | `ea5000f` | ⚠️ Cerrado con pendiente jurídico |
| C-3 | Documentos legales con campos vacíos en silencio | `d476625` | ✅ Cerrado                        |
| C-4 | Sin idempotencia y sin `maxDuration`             | `6a95bc4` | ✅ Cerrado                        |

---

## 2. C-1 — Máquina de estados validada en backend

**Decisión (la que dejaste abierta):** función pura reusable, no validación inline. `validatePhaseTransition(currentPhase, nextPhase)` vive en `src/lib/case-phases.ts` — sin Prisma ni I/O, consumible por server actions, componentes cliente y tests por igual. Es ahora la única fuente de verdad de qué transición es legal.

**Cambios:**

- `src/lib/case-phases.ts`: `validatePhaseTransition`, `isKnownPhase`, `CASE_PHASE_VALUES`, `INITIAL_CASE_PHASE`.
- `updateCase` lee la fase persistida dentro de la transacción y **rechaza todo cambio de fase**, remitiendo a la acción "Cambiar fase". No basta con validar la transición aquí: si `updateCase` pudiera cambiar de fase aunque fuese legalmente, se saltaría la auditoría, la notificación y la generación documental que `updateCasePhase` dispara.
- `createCase` fuerza `phase: 'Inicial'`. Antes era `rest.phase ?? 'Inicial'`: se podía crear un expediente ya en "Acuerdo aprobado".
- `updateCasePhase` delega en el guard y scopea su `update` por `tenantId`.

**Dos decisiones de compatibilidad que conviene conocer:**

1. **Reescribir la misma fase es un no-op válido.** El formulario de edición reenvía siempre la fase actual en el payload (`edit-case-dialog.tsx:419`); tratarlo como intento de transición habría roto toda edición de casos.
2. **`updateCaseSchema.phase` sigue siendo `z.string()`, no un enum.** Deliberado: los expedientes creados antes de este fix pueden tener persistida una fase que ya no es válida (la columna aceptaba cualquier string). Un enum los dejaría sin poder editarse nunca más. El guard los acepta como no-op y rechaza cualquier cambio real. En `createCaseSchema` sí es enum, porque ahí no hay legacy.

**Tests:** `tests/unit/cases/case-phase-transitions.test.ts` — 34 tests. Camino feliz por cada transición declarada, no-ops, fases legacy, y 8 intentos de bypass (salto de estado, fase arbitraria, reapertura de `Terminado`, cambio vía `updateCase`) que deben fallar **sin escribir en BD**.

---

## 3. C-2 — Reglas del trámite validadas en backend

**Cambios:**

- `validateCaseBusinessRules(data, { mode, year, debtorMaritalStatus })` en `validation-rules.ts` — punto de entrada único para las server actions.
- `createCase` rechaza el expediente que no cumple y registra las advertencias con `logger.warn`. `updateCase` aplica el mismo guard dentro de la transacción.
- `createCase` ahora trae `maritalStatus` del deudor para que la regla de sociedad conyugal sea evaluable en servidor (vive en `Debtor`, no en `Case`).

**Tres decisiones de diseño:**

1. **Segmentación por tipo de caso.** Las reglas de umbral (mínima cuantía, 150 SMMLV, 150 acreedores) y los campos obligatorios del formulario son del **trámite de insolvencia**. Conciliación y acuerdos de apoyo se radican con otro soporte documental; aplicarles estas reglas habría bloqueado la operación real de los dos centros.
2. **Modo `update` sólo evalúa lo que trae el payload.** Una edición parcial no debe fallar por campos que ni siquiera toca.
3. **No es un clon de `validateCaseComplete`.** Ese sigue siendo el validador del formulario, más exigente (ver §3.2).

### 3.1 ⚠️ PENDIENTE DE VALIDACIÓN JURÍDICA

**Esto es lo que no se puede dar por cerrado sin revisión de un abogado del área.**

**El SMMLV no estaba corregido en ninguna rama.** El brief asumía que venía arreglado de un fix aparte; verificado: `dev`, `origin/dev` y `main` tenían todas `SMMLV_2025 = 1_300_000`, que es el valor de **2024**, no de 2025. De esa constante cuelgan dos umbrales legales.

Se reemplazó por una tabla resuelta por año de radicación:

```
SMMLV_BY_YEAR = { 2024: 1_300_000, 2025: 1_423_500 }
getSmmlv(year)            // resuelve, degradando al último año conocido
isSmmlvYearConfirmed(year) // false si el año no tiene decreto cargado
```

| Ítem                             | Estado            | Acción requerida                                                                                                                                                                                          |
| -------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SMMLV 2026**                   | 🔴 **SIN CARGAR** | Cargar el valor del decreto vigente. `getSmmlv` degrada al último año conocido en vez de lanzar (bloquear la radicación sería peor), pero **hoy los umbrales de 2026 se calculan sobre la base de 2025**. |
| SMMLV 2024 y 2025                | 🟡 A confirmar    | Verificar los dos valores contra el decreto.                                                                                                                                                              |
| Mínima cuantía = 40 SMMLV        | 🟡 A confirmar    | Confirmar el múltiplo y que la consecuencia correcta sea "apoderado judicial obligatorio".                                                                                                                |
| Tope de 150 SMMLV                | 🟡 A confirmar    | Hoy es `warning`, no `error`: no bloquea. Confirmar si debe bloquear.                                                                                                                                     |
| Límite de 150 acreedores         | 🟡 A confirmar    | Hoy es `error` y bloquea la creación.                                                                                                                                                                     |
| Período de gracia ≤ 24 meses     | 🟡 A confirmar    | Hoy es `error` y bloquea.                                                                                                                                                                                 |
| Causas obligatorias, ≥1 acreedor | 🟡 A confirmar    | Ahora bloquean la creación de casos de insolvencia.                                                                                                                                                       |

Ninguna de estas reglas se inventó ni se modificó en contenido: son las que ya estaban escritas en `validation-rules.ts` y aplicadas por el formulario. Lo que cambió es **dónde** se aplican y **sobre qué base** se calculan los umbrales. Pero al pasar de "aviso en el formulario" a "rechazo en el servidor", su severidad ahora tiene consecuencias reales, y por eso conviene la revisión.

### 3.2 Brechas conocidas

- **No se valida la completitud de documentos adjuntos.** `validateDocumentsComplete` necesita la lista de archivos ya subidos, que el servidor no conoce al crear el caso (la carga va por otro flujo). Sigue aplicándose sólo en el formulario.
- **`validateAssetConditionals` queda fuera** por la misma razón.
- Ambas deberían cablearse cuando el flujo de carga y el de creación se unifiquen.

**Tests:** `tests/unit/cases/case-business-rules.test.ts` — 23 tests. Tabla SMMLV por año (incluido que 2026 se reporte como no confirmado), segmentación por tipo de caso, y 8 intentos de bypass vía POST directo.

---

## 4. C-3 — Bloqueo de documentos con datos incompletos

**Decisión (la que dejaste abierta):** **bloquear + informe de faltantes.** Ningún archivo incompleto llega a Drive. Descartado el borrador con marca de agua: un PDF a medias en la carpeta de un expediente puede radicarse por error, y la marca de agua depende de que nadie la ignore.

**El bug era más profundo de lo que decía la auditoría.** El `.replace()` de `placeholder-mapper.ts:2738` era sólo la segunda red: el vaciado silencioso ocurre antes, en `substituteVars` de handlebars-lite (`handlebars-lite.ts:62`), que sustituye por `''` toda variable ausente del contexto. Por eso el detector **corre antes del render**, comparando contra la fuente — escanear el HTML ya renderizado no habría encontrado nada.

**Cambios:**

- `renderDocumentHtml(html, placeholders, ctx)` → `{ html, unresolved }` reemplaza a `replacePlaceholders` (que queda como wrapper deprecado).
- Las variables dentro de bloques `{{#each}}` / `{{#if}}` se excluyen del escaneo: se resuelven contra el scope del bloque, no contra el contexto raíz. Sin esta exclusión, las plantillas de conciliación habrían dado falsos faltantes.
- `batchGenerateDocuments` marca el documento como `skipped` con la lista de campos faltantes.
- `generateDocument` y `regenerateDocument` aplican el mismo bloqueo.
- La UI de `/documents` muestra los bloqueados en un bloque propio, **separados de los errores técnicos**: la acción del usuario es completar el expediente, no reintentar.

**La distinción que sostiene el arreglo:**

| Caso                                                | Comportamiento                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Placeholder **conocido** por el mapper, valor vacío | Campo opcional legítimo → se sigue vaciando, la fila vacía se sigue limpiando. **No cambia el render de las plantillas actuales.** |
| Placeholder **ausente** del mapper                  | Hueco real → bloquea la generación, y en el HTML queda `«FALTA: NOMBRE»` por si algún camino se saltara el bloqueo.                |

**Tests:** `tests/unit/documents/document-data-completeness.test.ts` — 12 tests, incluida la regresión del borrado silencioso y el caso que **no** debe bloquear (opcional conocido y vacío).

---

## 5. C-4 — Idempotencia y `maxDuration`

**Cambios:**

- Nuevo `kind: 'BATCH'` en `GenerationKind`. `batchGenerateDocuments` era la única ruta sin el lock anti-duplicados (sólo tenía rate limit): dos operadores generando el mismo paquete, o un doble click, duplicaban archivos en Drive y filas `Document`.
- El lock se reclama **después** del control de acceso por fila, para no crear filas a nombre de quien no puede generar, y se libera en los dos caminos de salida. Si ya hay una generación activa, devuelve el `requestId` en vez de duplicar.
- `export const maxDuration = 60` en `/documents/page.tsx` y `/cases/page.tsx`. Sin esto regía el default de Vercel (10 s en Hobby); `batchGenerateDocuments` lanza Chromium sobre decenas de plantillas, y `createCase` corre la generación inicial vía `after()`, que consume el mismo presupuesto.
- **Extra:** `completeGenerationRequest` ya no marca `COMPLETED` cuando no se produjo ni un documento. Con el bloqueo de C-3 los documentos salen como `skipped`, que no cuenta como error, así que una generación de 0 de 8 quedaba registrada como exitosa.

**Tests:** `tests/unit/documents/batch-generation-lock.test.ts` — 12 tests.

### 5.1 Lo que C-4 **no** resuelve

`maxDuration = 60` es el techo del plan Hobby, y compra margen — no elimina el problema de raíz:

- **`htmlToPdf` sigue lanzando un Chromium por documento** (`html-to-pdf.ts:323/355`), en serie. `batchHtmlToPdf`, que reutiliza un solo navegador, existe desde hace tiempo y sólo lo usa la ruta manual. Migrar `generate-documents.ts` a `batchHtmlToPdf` es el P1 pendiente del roadmap y sigue pendiente.
- **Los lotes grandes (fracaso: hasta 26 plantillas; paquete completo: hasta 77) pueden no caber en 60 s** ni siquiera con un solo navegador. Necesitan trocearse en varias invocaciones.
- **La idempotencia de _regeneración_ sigue abierta** (hallazgo 🟠 Alto, no crítico): el lock impide duplicados _concurrentes_, pero regenerar secuencialmente sigue subiendo un archivo nuevo a Drive y creando otra fila. `archiveSupersededDocument` sigue siendo código muerto y `persistGeneratedDocuments` sigue sin persistir `templateId`.

---

## 6. Verificación

```bash
npx jest          # 585 passed, 35 suites
npx tsc --noEmit  # limpio en src/
npx eslint src tests  # 0 errores (23 warnings preexistentes)
```

Los 3 errores que `tsc` reporta sobre `.next/types/app/api/sentry-test-temporal/` son artefactos stale de un build de la rama `fix/sentry-init`; esa ruta no existe en `dev`. Se limpian con `rm -rf .next`.

**Nota sobre los tests de C-1/C-2:** tres tests de "deny" usaban `PERMISSIONS.VER_CASOS`, que no existe en `tests/helpers/fixtures.ts` (las claves están en inglés: `VIEW_CASES`). Evaluaban a `undefined` y pasaban por accidente. Migrados a las constantes reales de `@/lib/permissions` en el commit de C-4.

---

## 7. Fuera de alcance (respetado)

- No se tocó nada de Semana 1/2: auth, rate limiting, Sentry, health.
- No se tocó `globalSearch` ni el control de acceso por fila en reportes — Semana 4.
- No se cambió el **contenido** de ninguna regla jurídica; los umbrales marcados en §3.1 quedan explícitamente pendientes de revisión legal.
- Sin merge a `dev`.

---

## 8. Antes de mergear

1. **Confirmar el SMMLV 2026** (§3.1). Es lo único que puede hacer que estos guards calculen mal un umbral legal en producción.
2. **Revisar con los dos centros la lista de reglas que ahora bloquean** (§3.1). Pasar de aviso a rechazo cambia su operación diaria: conviene que lo sepan antes, no al primer expediente rechazado.
3. **Considerar un smoke test en preview** de los dos flujos que más cambian: crear un caso de insolvencia completo, y generar un paquete desde `/documents` con un expediente al que le falte un dato (debe bloquear y listar el faltante).
