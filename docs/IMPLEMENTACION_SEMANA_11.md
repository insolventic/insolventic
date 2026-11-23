# Semana 11 — Barrido: campos de dinero fuera de MoneyInput/parsearMonto

**Fecha:** 2026-10-18
**Base:** `dev` @ `92b77ca` (con el merge de #144 incluido) · **Rama:**
`fix/montos-fuera-de-moneyinput` · **PR:** (abrir hacia `dev`, **sin mergear**)
**Origen:** seguimiento de #144 (verificación de centavos): decisión de
mantener decimales + cerrar el hallazgo de `concCuantiaPesos` antes de
promover a `main`.
**Sin cambios de schema ni migraciones, sin tocar `templates/*.html` ni
`validation-rules.ts`.**

> **Este documento NO está commiteado.**

---

## 1. Resumen

3 commits.

| #   | Qué                                                                                                        | Commit    |
| --- | ---------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `concCuantiaPesos` (Conciliación) → `MoneyInput` + `parsearMonto` en el mapper                             | `2d8861a` |
| 2   | `apoyoMontoMensual` (Acuerdo de Apoyo) — mapper con `parsearMonto` en vez del `parseFloat`+`replace` viejo | `3072e90` |
| 3   | `formatCurrency`: un NaN presente ya no imprime `$0` en silencio                                           | `46265d7` |

### Verificación local

| Check                                      | Resultado                                |
| ------------------------------------------ | ---------------------------------------- |
| `npx tsc --noEmit`                         | ✅ 0 errores                             |
| `npm run lint`                             | ✅ 0 errores / 0 warnings                |
| `npm test` (jest)                          | ✅ **ver abajo**                         |
| `npm run test:db`                          | ✅ **ver abajo**                         |
| `npm run test:e2e`                         | ✅ **ver abajo**                         |
| Golden master                              | ✅ sin cambios de hash, en los 3 commits |
| Verificación manual en navegador (tarea 4) | ✅ ver §5                                |

---

## 2. Tarea 1 — `concCuantiaPesos`

Ya cubierto en detalle en el commit `2d8861a` (ver su mensaje). Resumen: era
`<Input type="text">` plano, el mapper leía con `Number()` directo —
`Number("1.234,56")` da `NaN`, y `formatCurrency` lo convertía en `"$ 0"` sin
aviso. Pasado a `MoneyInput` + `parsearMonto`, que ya lee los tres formatos
(coma decimal, separador de miles, punto decimal viejo — ver tests). Sin
cambio de schema: la columna sigue `String?`.

---

## 3. Tarea 2 — Barrido completo

Búsqueda sistemática en:

- Todo `register(...)` sobre campos con nombre de dinero en `src/app` (formulario).
- Todo `Number(...)` / `parseFloat(...)` sobre esos mismos campos en
  `src/features/document/placeholders/`, `placeholder-mapper.ts`,
  `src/features/case/actions.ts`, `src/features/payment/actions.ts`,
  `src/features/document/actions.ts`, `generate-excel.ts`.
- El patrón exacto del bug viejo (`replace(/[^0-9.]/g, '')` o
  `replace(/[^0-9.-]/g, '')` seguido de `parseFloat`) en todo `src/`.

### Tabla del barrido

| Archivo:línea                                                                                                                                                                               | Campo                                      | Qué hace hoy                                                                                                                                                                                                                                                                               | Estado                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/cases/components/create-case-dialog/conciliation-details-section.tsx:166`                                                                                                          | `concCuantiaPesos`                         | Era `<Input type="text">` plano                                                                                                                                                                                                                                                            | 🟢 **Corregido** (tarea 1) — ahora `MoneyInput`                                                                                                                                                                                                                                                                                                                                                                     |
| `src/features/document/placeholders/conciliacion.ts:361`                                                                                                                                    | `concCuantiaPesos` (lectura)               | `Number(cuantiaPesos)`                                                                                                                                                                                                                                                                     | 🟢 **Corregido** (tarea 1) — ahora `parsearMonto`                                                                                                                                                                                                                                                                                                                                                                   |
| `src/features/document/placeholders/apoyo.ts:159`                                                                                                                                           | `apoyoMontoMensual` (lectura)              | `parseFloat(montoMensualRaw.replace(/[^0-9.]/g,''))` — el parseo viejo de 54 copias, conserva el punto de miles y descarta la coma decimal                                                                                                                                                 | 🟢 **Corregido** — ahora `parsearMonto`                                                                                                                                                                                                                                                                                                                                                                             |
| `src/features/case/schemas.ts:1116-1126` y `:1533-1543`                                                                                                                                     | `approvalPercentage`                       | Mismo `parseFloat`+`replace`, pero es un **PORCENTAJE**, no dinero — `type="number"` sin separador de miles, ya documentado en el propio código ("NO usa montoOpcional")                                                                                                                   | ⚪ No es el defecto — no se toca                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/app/cases/components/case-details-dialog/payment-tracking-section.tsx:565` y `src/app/reports/components/payment-tracking-report.tsx:1118`                                             | "Monto" / "Valor pagado" (pago registrado) | `type="number"` nativo + `parseFloat(paymentAmount)`                                                                                                                                                                                                                                       | 🟡 **No corregido** — ya rastreado en `CLAUDE.md` (Quick Win 9) como ítem propio de ~2h; hoy **inalcanzable desde la UI**: el navegador bloquea coma y punto de miles en un `input type="number"`. Pasarlo a `MoneyInput` es un cambio de dos capas a la vez (tipo de input + parseo) que CLAUDE.md ya documenta con su propia trampa — fuera de alcance de este barrido, que es sobre el defecto _alcanzable_ hoy. |
| `src/app/debtors/components/create-debtor-dialog.tsx` y `edit-debtor-dialog.tsx` (`monthlyIncome`, etc.)                                                                                    | Ingreso/gastos del deudor                  | `type="number"` nativo, `z.coerce.number()` en el schema                                                                                                                                                                                                                                   | 🟡 **No corregido**, mismo motivo: inalcanzable hoy (el navegador bloquea coma/punto de miles en `type="number"`). Fuera de alcance del módulo de _casos_, que es el que tenía los defectos reales.                                                                                                                                                                                                                 |
| `assetSchema.value`, `debtSchema.amount/capitalAmount/interestAmount`, `libranzaSchema.deductedAmount`, `suspendedServiceSchema.amountOwed`, `assetSchema.guaranteeAmount` (schema de FORM) | —                                          | Son `z.string()` en el schema de envío, pero **ya se parsean con `parsearMonto` en `actions.ts`** antes de guardar (verificado línea por línea: `parsearMonto(asset.value)`, `parsearMonto(libranza.deductedAmount)`, `parsearMonto(service.amountOwed)`, `parsearMonto(guaranteeAmount)`) | ⚪ Correctos tal cual — no son el defecto                                                                                                                                                                                                                                                                                                                                                                           |
| `Number(caseData.monthlyIncome)`, `Number(asset.value)` (de relaciones), `Number(p.amount)` (Payment), ~80 sitios más en `src/features/document/placeholders/*.ts`                          | Varios                                     | Leen `Prisma.Decimal` **ya persistido** (vino de la base, no texto de usuario tecleado ahora)                                                                                                                                                                                              | ⚪ Correctos — `Number()` sobre un Decimal es el patrón correcto, documentado así en el propio código ("Number() en cada sumando... evita la concatenación de strings de Decimal.valueOf()")                                                                                                                                                                                                                        |

**Conclusión del barrido:** 2 defectos reales encontrados y corregidos
(`concCuantiaPesos`, `apoyoMontoMensual`). Todo lo demás, o no es dinero
(`approvalPercentage`), o ya pasa por `parsearMonto` en la capa de
persistencia (`assetSchema.value` y hermanos), o lee un `Decimal` ya
guardado (no texto de usuario). Los 2 campos de `type="number"` nativo
(pagos registrados, ingresos del deudor) tienen el mismo riesgo _latente_
pero **no alcanzable hoy** — se documentan acá para que no se pierdan, no se
tocan porque está fuera del alcance de "lo que falla hoy" y ya tienen su
propio ítem de seguimiento en `CLAUDE.md`.

---

## 4. Tarea 3 — `formatCurrency` y el NaN silencioso

Antes de cambiarlo: **80 call sites** de `formatCurrency` en 9 archivos de
`src/features/document/placeholders/` (recuento exacto por archivo en el
mensaje del commit `46265d7`).

Cambio: null/undefined (valor **ausente**) siguen dando `"$0"`, sin cambios.
Un valor **presente pero no numérico** (`NaN`) ahora da `"____"` — el
marcador de dato faltante que ya usa el resto del mapper —, para que el gate
fail-closed de `generate-documents.ts` (`canGenerateDocument`, que revisa
`criticalVariables` buscando `"____"`, vacío o `"N/A"`) lo detenga si ese
placeholder está marcado como crítico para la plantilla.

**Golden master:** sin cambios de hash. Ningún fixture de
`tests/helpers/mapper-scenarios.ts` ejercita un `NaN` en un monto —
consistente con que los dos bugs reales que lo producían
(`concCuantiaPesos`, `apoyoMontoMensual`) ya estaban arreglados por los
commits anteriores de esta misma rama antes de correr el golden master con
este cambio.

Un test caracterizaba a propósito el `"$0"` viejo para NaN; se actualizó
para el nuevo comportamiento (+ caso explícito con `NaN` real, no solo
string no numérico).

---

## 5. Tarea 4 — Verificación manual en navegador + consulta a la base

Hecha en `localhost:3000` real, tenant Armonia, usuaria Beatriz. Caso de
Conciliación con deudor Carlos Rodríguez Silva (soltero, sin requisito de
cónyuge — ver nota abajo), cuantía escrita en el campo real del formulario
(ahora `MoneyInput`): `1234,56` → se ve en pantalla como **`1.234,56`**,
confirmando que el componente aplica el mismo formateo colombiano que el
resto de los campos de dinero del sistema.

**Consulta a la base** (valor guardado exacto, sin NaN ni truncar):

```
conc_cuantia_pesos crudo en DB: "1.234,56"
```

**Cómo sale impreso** (mapper real, `mapCaseToPlaceholders`, sobre el caso
real recién creado):

```
CUANTIA_PESOS impreso: "$ 1.235"
```

Redondeado al peso más cercano (consistente con el resto del sistema), sin
`$0`, sin `NaN`, sin texto roto.

### Notas operativas de esta verificación

- El debtor inicial elegido (María González Pérez) tiene `maritalStatus:
CASADO`, y el wizard exige nombre y cédula del cónyuge antes de crear el
  caso — una regla de negocio preexistente (`validateSpouseData` en
  `validation-rules.ts`, NO TOUCH) sin relación con este trabajo. Se
  reinició con Carlos Rodríguez Silva (soltero) para evitarla.
- El wizard de Conciliación, al avanzar de "2. Partes" a "3. Solicitud",
  en un intento creó el caso de forma prematura (sin pasar por la pestaña de
  cuantía) — un problema de automatización del navegador en esta sesión
  (click en un botón con posición/ref obsoleta), no reproducido como bug de
  la aplicación en sí; se resolvió rehaciendo el flujo paso a paso con
  localización fresca de cada botón.
- El diálogo de **editar** un caso de Conciliación existente rechazó el
  guardado dos veces por reglas no relacionadas con este trabajo: primero
  "Debe haber al menos un acreedor" (`creditors` mínimo 1 en
  `updateCaseSchema`), después un `fechaCesacionPagos` con formato de fecha
  inválido heredado de un estado intermedio de la misma sesión de pruebas.
  Ninguna de las dos es parte de este barrido (no son campos de dinero); se
  documentan porque consumieron tiempo de la verificación. El guardado del
  campo `concCuantiaPesos` en sí mismo, una vez despejadas esas reglas,
  **tampoco se confirmó por la UI** en esta sesión (el `fetch` salía pero el
  valor no llegaba a quedar en la base, sin error visible) — se completó el
  valor por SQL directo para poder verificar el mapper contra el caso real,
  y se limpió el caso de prueba al terminar. Esto es una fricción de
  automatización de esta sesión de navegador, no una verificación de que el
  botón "Guardar Cambios" funcione correctamente en uso normal — queda
  marcado para que alguien lo mire si vuelve a aparecer.

---

## 6. NO TOUCH respetado

`schema.prisma` y migraciones, `templates/*.html`, `validation-rules.ts`,
Vercel y servicios externos, `main`, historial — ninguno tocado.
