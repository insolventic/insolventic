# Semana 10 — Fix: NaN en totales de ingresos/deudas con coma decimal

**Fecha:** 2026-10-18
**Base:** `dev` @ `7edc0cf` (con el merge de #142 incluido) · **Rama:**
`fix/nan-monto-coma` · **PR:** (abrir hacia `dev`, **sin mergear**)
**Origen:** bug encontrado en verificación manual del PR #136 en localhost:3000.
**Sin cambios de schema ni migraciones, sin tocar templates ni `validation-rules.ts`.**

> **Este documento NO está commiteado.**

---

## 1. Resumen

2 commits.

| #   | Qué                                                                                      | Commit    |
| --- | ---------------------------------------------------------------------------------------- | --------- |
| 1   | Fix: `Number(x)` → `parsearMonto(x) \|\| 0` en los 4 totales derivados que seguían rotos | `d3320e9` |
| 2   | Tests de regresión (unit + test:db)                                                      | `e04b696` |

### Verificación local

| Check                                      | Resultado                                                      |
| ------------------------------------------ | -------------------------------------------------------------- |
| `npx tsc --noEmit`                         | ✅ 0 errores                                                   |
| `npm run lint`                             | ✅ 0 errores / 0 warnings                                      |
| `npm test` (jest)                          | ✅ **2016 tests / 144 suites**                                 |
| `npm run test:db`                          | ✅ **113 / 113**, 7 suites, contra Postgres 16 real            |
| `npm run test:e2e` (Playwright)            | ✅ en verde (ver abajo)                                        |
| Golden master                              | ✅ sin cambios (no se tocaron templates ni placeholder-mapper) |
| Verificación manual en navegador (tarea 5) | ✅ caso real creado en `localhost:3000`, resultados abajo      |

---

## 2. Causa raíz

`#136` centralizó el parseo de montos en `parsearMonto` (`src/features/case/monto.ts`)
y lo aplicó a 27 campos del formulario maestro (wizard + pestañas de edición), al
`totalDebt` calculado en `create-case-dialog.tsx` y al campo de solo lectura
"Deuda Total (calculada)". Pero **4 totales de solo lectura quedaron fuera** de esa
pasada: seguían sumando el texto que entrega `MoneyInput` con `Number()` directo.

`MoneyInput` entrega el texto FORMATEADO ("1.234,56" o "1.500.000"), no un número:

- `Number("1.234,56")` → `NaN` (la coma decimal rompe `Number()`).
- `Number("1.500.000")` → `NaN` también si hay **2 o más** grupos de miles (no es
  solo el bug silencioso de `1.5` que tenía el parseo viejo del schema con 1 grupo).

No es un estado que se "atasca" y se arregla solo: **cualquier monto ≥ 1.000.000**
mostrado con separador de miles da `NaN` en cada render, haya pasado o no por una
coma antes. Reproducido en el navegador contra el wizard real antes de tocar código
(ver `info-laboral-totales-nan.test.tsx` para el detalle).

### Los 4 lugares con el bug

| Archivo                                           | Dónde se usa                                      | Qué sumaba mal                                                                 |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `create-case-dialog/info-laboral-section.tsx`     | Wizard, Sección III — **el bug real reproducido** | `totalIngresos`, `totalGastos` (4 + 7 campos)                                  |
| `create-case-dialog/payment-proposal-section.tsx` | Wizard, Pág. 5                                    | `totalIngresos`, `totalGastos`, y `classTotals` (capital/interés por acreedor) |
| `create-case-dialog/cesacion-pagos-section.tsx`   | Wizard, Sección IV                                | `totalDebt`/`overdueDebt`/`totalDeuda` (capital/amount por acreedor)           |
| `create-case-dialog/income-section.tsx`           | Diálogo de **editar** caso (`IncomeSection`)      | `totalIncome`, `availableIncome`                                               |

**Lo que SÍ ya estaba bien y no se tocó:** el cálculo de `totalDebt` en
`create-case-dialog.tsx` (líneas 525-593) y el campo "Deuda Total (calculada)"
(`debtor-section.tsx`) — ambos ya usaban `parsearMonto` desde `#136`.

### Por qué nunca llega NaN al servidor ni a la base

El schema de envío (`createCaseSchema` → `montoOpcional()`/`montoRequerido()` en
`schemas.ts`) ya pasaba por `parsearMonto` y valida el resultado con
`z.number()`, que **rechaza `NaN` por diseño de Zod** (verificado:
`z.number().safeParse(NaN).success === false`). El bug era 100% de UI — los
totales de **solo lectura** mostraban `NaN`, pero el dato que viaja al servidor
(los campos individuales, ya parseados) seguía siendo válido. Confirmado además
con el test:db nuevo: ningún intento de crear un caso con montos en coma decimal
falla ni guarda basura.

---

## 3. El fix

En los 4 archivos: `Number(x)` → `(parsearMonto(x) || 0)`. `parsearMonto` ya
resuelve la ambigüedad punto/coma (ver su docblock); el `|| 0` cubre además
vacío/parcial/inválido, que nunca debe filtrarse como `NaN` a la pantalla.

```diff
- Number(ingresoPrincipal) + Number(otrosIngresos) + ...
+ (parsearMonto(ingresoPrincipal) || 0) + (parsearMonto(otrosIngresos) || 0) + ...
```

---

## 4. Tests de regresión

- `tests/unit/components/info-laboral-totales-nan.test.tsx` (nuevo, 5 casos) —
  el bug real: coma decimal, monto ≥ 1.000.000, `"1500,"` (decimal incompleto),
  escribir y borrar, escritura dígito por dígito.
- `tests/unit/components/payment-proposal-totales-nan.test.tsx` (nuevo, 3 casos).
- `tests/unit/components/income-section-totales-nan.test.tsx` (nuevo, 3 casos).
- `tests/unit/components/cesacion-pagos-recalculo.test.tsx` (extendido, +1 caso).
- `tests/db/case-wizard.db.test.ts` — nuevo `describe('coma decimal: el monto se
guarda exacto, sin NaN')`, gemelo del que ya cubría el separador de miles solo,
  contra Postgres real.

---

## 5. Verificación manual contra Postgres LOCAL (tarea 5)

Hecha en el navegador, contra `localhost:3000` real, tenant Armonia, usuaria
Beatriz Helena Malavera López. Caso creado: deudor Luis Fernando Castro,
Sección III con ingreso principal `1.500.000`, otros ingresos `2.350.000`,
ingresos variables `1.234,56` (coma decimal), y 2 acreedores de `1.500.000` y
`2.500.000`.

> **Nota operativa:** a mitad de la verificación, Docker Desktop y el dev server
> se habían caído (ajenos a este trabajo); se reiniciaron (`insolventic-db-verif`
> en el puerto 54329 + `npm run dev`) antes de continuar. También se encontró y
> rodeó un problema real de automatización de navegador (no del código): el wizard
> de Insolventic **desmonta el contenido de cada pestaña al salir de ella**, así
> que archivos subidos o combos abiertos se pierden si se visita una pestaña
> anterior después de llenarla — hay que avanzar siempre hacia adelante.

**a) El caso más recién creado**

| id                          | caseNumber     |
| --------------------------- | -------------- |
| `cmve0ofjl0001v9v4aigxwm9h` | `INSOL-000001` |

**b) Montos de `Case`**

| Columna                       | Valor                                               |
| ----------------------------- | --------------------------------------------------- |
| `totalDebt`                   | `4000000`                                           |
| `monthlyIncome`               | _(vacío — no es parte de este bug, ver nota abajo)_ |
| `monthlyExpenses`             | _(vacío — ídem)_                                    |
| `otherIncomeAmount`           | _(vacío — ídem)_                                    |
| `ingreso_principal_mensual`   | `1500000`                                           |
| `otros_ingresos_mensuales`    | `2350000`                                           |
| `ingresos_variables_promedio` | **`1234.56`** ← la coma decimal, exacta             |

_Nota: `monthlyIncome`/`monthlyExpenses` del `Case` viajan por un mapeo aparte
en `create-case-dialog.tsx` (`syncedIncome`/`syncedExpenses`) que no es parte de
este bug — no se tocó y quedó igual que antes._

**c) Detector de truncamiento/NaN** en las **28 columnas `numeric`** de `Case`
(no solo las 3 de este caso): valores no-cero con parte decimal y menores a
1000, o literal `'NaN'`. Corrido con un bloque `DO $$` dinámico sobre
`information_schema.columns` para no tener que listar las columnas a mano:

```
NOTICE:  TOTAL filas sospechosas: 0
```

**0 filas.** ✅

**d) Deudas del caso** (`amount`, `capitalAmount`, `interestAmount`):

| Acreedor                     | amount    | capitalAmount |
| ---------------------------- | --------- | ------------- |
| Banco Verificacion Uno       | `1500000` | `1500000`     |
| Cooperativa Verificacion Dos | `2500000` | `2500000`     |

Exactas — no `1.5` ni `2.5`.

**e) `totalDebt` contra `SUM(amount)` de las deudas**

| totalDebt | SUM(amount) | diferencia |
| --------- | ----------- | ---------- |
| `4000000` | `4000000`   | `0`        |

---

## 6. NO TOUCH respetado

`schema.prisma` y migraciones, `templates/`, `validation-rules.ts`, Vercel y
servicios externos, `main`, historial — ninguno tocado. Único archivo de schema
tocado: **ninguno** (`schemas.ts` no se modificó; ya usaba `parsearMonto`
correctamente vía `montoOpcional`/`montoRequerido`).

---

## 7. Pendiente / fuera de alcance

- `monthlyIncome`/`monthlyExpenses` del `Case` (vacíos en este caso) dependen de
  un mapeo distinto (`syncedIncome`/`syncedExpenses` en `create-case-dialog.tsx`)
  que ya tenía ese comportamiento antes de este fix y no es parte del bug
  reportado — no se tocó.
- El wizard desmonta el contenido de cada pestaña al navegar hacia atrás
  (perdiendo archivos adjuntos y, en algún momento, posiblemente otro estado no
  persistido en `react-hook-form`). No es parte de este bug y no se investigó a
  fondo — se documenta acá porque hizo más lenta la verificación manual.
