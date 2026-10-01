# Plan de división de `placeholder-mapper.ts`

> Estado: **Pasos 0–3 hechos.** Última actualización: 2026-09-30.

Este plan existía solo en las transcripciones de las sesiones y en los cuerpos
de los PRs #43, #45 y #52. Se escribe acá porque ya se perdió una vez: el
checkpoint del 2026-09-28 tuvo que referirse al "Paso 3 del plan" sin poder
apuntar a ningún archivo.

## Por qué se divide

`placeholder-mapper.ts` llegó a 2.936 líneas con ~885 claves de placeholder
producidas por ~30 sub-mappers que se fusionan con spread en un solo objeto. El
orden de fusión importa —hay 16 colisiones de clave donde el último gana— así
que no es un archivo que se pueda partir por corte y pega.

Está en el roadmap de la Fase 2 (`CLAUDE.md`) con el destino: builders HTML /
mappers escalares / conciliación / apoyo.

## La regla que hace seguro cada paso

Cada paso mueve funciones **sin cambiar una sola línea de su código** y se
verifica con cuatro cosas, en este orden:

1. **Golden master sin mover un byte** (`tests/unit/documents/golden/`).
   Verificado con `git status`, no asumido. Si el golden se mueve, el paso está
   mal: no es un movimiento puro.
2. **Comparación byte a byte contra el original de `git`**, función por función,
   no solo "los tests pasan". Un `prettier` del hook puede recortar la firma al
   anteponer `export`; cualquier otra diferencia se investiga.
3. **Prueba de mutación**: se rompe a propósito una función _en el módulo nuevo_
   y se comprueba que la red se pone roja. Si no se pone, la red dejó de ver el
   código movido y el paso siguiente sería a ciegas.
4. `tsc` · `eslint` (0 errores) · suite completa · `next build`.

El contrato de orden de fusión (`mapper-merge-order.test.ts`) analiza el AST
siguiendo los imports de `./placeholders/*` **una sola pasada, no recursiva**.
Eso alcanza mientras los sub-mappers no se importen entre sí. **Si algún paso
necesita que un sub-mapper importe a otro, primero hay que hacer recursivo
`collectFunctions`.**

### Criterio de "menor riesgo"

Un grupo es de menor riesgo cuando cumple las dos condiciones:

- no depende de ningún otro sub-mapper (solo del tipo `PlaceholderMap` y de los
  helpers de formato, ya extraídos en el Paso 1);
- no participa en ninguna de las 16 colisiones del contrato.

Los grupos que **sí** colisionan se mueven junto con su contraparte de
colisión, nunca sueltos: separarlos dejaría el contrato analizando dos archivos
para una misma clave sin ganar nada.

## Pasos hechos

| Paso | Qué                                                                                                                                                           | Módulo                                  | PR       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------- |
| 0    | Red de seguridad: golden master + contrato de las colisiones                                                                                                  | `tests/unit/documents/`                 | #43, #44 |
| 1    | Los 12 helpers de formato (funciones hoja, sin dependencias)                                                                                                  | `placeholders/format.ts`                | #45      |
| 2    | 5 sub-mappers de listas simples: `mapCauses`, `mapLegalProcesses`, `mapLibranzas`, `mapSuspendedServices`, `mapDependents`                                    | `placeholders/case-lists.ts`            | #52      |
| 3    | 4 sub-mappers del Formulario Definitivo: `mapAcreedoresDefinitivo`, `mapBienesDefinitivo`, `mapProcesosJudicialesDefinitivo`, `mapFormularioDefinitivoFields` | `placeholders/formulario-definitivo.ts` | este     |

Tamaño del mapper: 2.936 → 2.774 (Paso 1) → 2.915 con lo que se agregó después
→ **2.638** (Paso 3).

## Pasos propuestos

El orden de acá en adelante es una propuesta, no un compromiso: lo que lo fija
son las dependencias y los PRs abiertos, no la numeración.

| Paso | Grupo                                                                                                                                                                    | Líneas    | Colisiona                                    | Bloqueado por                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 4    | Ingresos: `buildIncomeNarrative` + `mapIncomeDeclaration`                                                                                                                | 69 + 35   | no                                           | nada                                                                                                                 |
| 5    | `mapAssets` + `mapDebts`                                                                                                                                                 | 155 + 117 | no                                           | **#79**, que reescribe `mapDebts` (117 → 29) al retirar los 264 slots numerados. Mover antes garantiza un conflicto. |
| 6    | Builders HTML: los 7 `generate*`                                                                                                                                         | ~293      | no (las claves las emiten sus llamadores)    | conviene después del 5: dos de ellos recorren bienes                                                                 |
| 7    | Conciliación: `buildConciliationContext` + `mapConciliationFields`                                                                                                       | 107 + 265 | sí (`NOMBRE_CONVOCANTE`, 3 de desistimiento) | nada                                                                                                                 |
| 8    | Apoyo: `mapApoyoFields`                                                                                                                                                  | 99        | no                                           | nada                                                                                                                 |
| 9    | Los pares de colisión: `mapApplicantScope`+`mapAgreementResult`, `mapExternalEntities`+`mapFracasoVariables`+`mapExtendedDates`, `mapDynamicTables`+`mapPaymentProposal` | ~404      | sí, por definición                           | conviene último: es el que más contrato mueve                                                                        |

### Lo que se queda en `placeholder-mapper.ts`

No es residuo: es la superficie pública del módulo.

- `escapePlaceholder`, `HTML_PLACEHOLDERS_ALLOWLIST`, `escapeAllUnlessHtml` —
  el corte de seguridad. Se mantiene en el punto de fusión a propósito
  (safe-by-default, Sesión 1 de `CLAUDE.md`).
- El tipo `PlaceholderMap`, del que dependen todos los módulos extraídos.
- `mapCaseToPlaceholders` (335 líneas), que es el punto de fusión.
- La API de render: `renderDocumentHtml`, `replacePlaceholders`,
  `validatePlaceholderCoverage`, `getPlaceholderCoverageReport`, `stripBlocks`.
- `buildTemplateContext` / `buildInsolvencyContext` / `escapeContextItem`.

### `mapCheckList`: en pausa, no pendiente

`mapCheckList` (116 líneas) no colisiona y no depende de nada, así que por
criterio entraría temprano. **No se mueve** mientras siga abierto el hallazgo de
los 3 párrafos sin resolver, pendiente de la abogada: mover el archivo mientras
su contenido está en discusión solo agrega ruido al diff que después haya que
revisar.
