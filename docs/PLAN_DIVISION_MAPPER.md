# Plan de división de `placeholder-mapper.ts`

> Estado: **Pasos 0–4 hechos.** Corte de seguridad extraído a
> `placeholders/escape.ts` (fuera de la numeración, ver más abajo). Última
> actualización: 2026-10-02.

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
| 3    | 4 sub-mappers del Formulario Definitivo: `mapAcreedoresDefinitivo`, `mapBienesDefinitivo`, `mapProcesosJudicialesDefinitivo`, `mapFormularioDefinitivoFields` | `placeholders/formulario-definitivo.ts` | #81      |
| 4    | Ingresos: `mapIncomeDeclaration` + su helper interno `buildIncomeNarrative`                                                                                   | `placeholders/income.ts`                | este     |

Tamaño del mapper: 2.936 → 2.774 (Paso 1) → 2.915 con lo que se agregó después
→ 2.638 (Paso 3) → 2.554 con lo que se agregó después (PRs #84, #85, #88, #89)
→ **2.447** (Paso 4).

### Hallazgo del Paso 4: un segundo contrato de AST no seguía `placeholders/*`

`mapper-merge-order.test.ts` ya sabía seguir los imports de `./placeholders/*`
(nota del Paso 0). Pero `html-escape-guard.test.ts` —el guardián del escape
HTML de las 16 claves de `HTML_PLACEHOLDERS_ALLOWLIST`— tenía su propio
`topLevelFunctions()` que solo parseaba `placeholder-mapper.ts`, sin esa misma
lógica. Al mover `buildIncomeNarrative`, el inventario de "funciones que
generan HTML" (parte 5 del test) dejó de verla: el test iba a seguir en verde,
pero dejando de vigilar una función que sí interpola texto de usuario en HTML.
Se corrigió copiando el mismo `collectFunctions` recursivo-de-una-pasada que
ya usaba `mapper-merge-order.test.ts`, en vez de escribir uno nuevo.

### Nota de diseño del Paso 4: dependencia circular con `escapePlaceholder`

Es el primer paso que mueve una función que llama a `escapePlaceholder`.
Cuando se escribió esta nota, `escapePlaceholder` todavía estaba en
`placeholder-mapper.ts` y `income.ts` la importaba de vuelta desde ahí: un
ciclo real entre los dos archivos, seguro pero evitable. Los pasos 6
(builders HTML), 7 (conciliación) y 9 (colisiones) iban a repetir el mismo
parche. Se investigó si convenía resolverlo de raíz antes de seguir — ver la
sección siguiente. Con esa extracción ya hecha, esta nota queda como registro
de por qué se investigó, no como patrón a repetir.

### Extracción del corte de seguridad a `placeholders/escape.ts` (fuera de la numeración, PR independiente)

Antes de repetir el parche del Paso 4 en los pasos 6, 7 y 9, se investigó si
convenía resolver la dependencia circular de raíz: extraer
`escapePlaceholder`/`HTML_PLACEHOLDERS_ALLOWLIST`/`escapeAllUnlessHtml` a su
propio archivo leaf (`placeholders/escape.ts`), del que tanto
`placeholder-mapper.ts` como cualquier sub-mapper importan sin ciclo.

**La pregunta concreta era si esto debilitaba la garantía de seguridad.** Se
rastreó el origen de la nota "se mantiene en el punto de fusión a propósito":
nace en el commit `758b733` (P2, Sesión 1 de `CLAUDE.md`, 2026-07-10) y se
repite al escribir este plan en el Paso 3 (`ee3e16c`). Ninguno de los dos
dice nada sobre en qué ARCHIVO debe vivir el código: los dos hablan de CUÁNDO
escapar — centralizado en el punto de fusión de `mapCaseToPlaceholders`
(safe-by-default), en vez de valor por valor en cada sub-mapper, para que un
placeholder escalar nuevo quede protegido sin que nadie se acuerde de
escaparlo. "Punto de fusión" nombra un lugar en el FLUJO DE EJECUCIÓN, no un
archivo. Conclusión: **la extracción es segura**, es solo organización de
código.

Movido (sin cambiar su código, mismo proceso que cualquier paso de este
plan):

- Comparación byte a byte contra el original de `git`: idénticas, incluido el
  texto de los tres comentarios JSDoc.
- Mutación deliberada, con foco en los escenarios XSS (acá es donde está el
  riesgo real): se probaron dos mutaciones por separado. (1) `escapePlaceholder`
  deja de escapar `<`: fallan 6 tests, los cuatro específicos de la carga XSS
  más los dos golden masters de `insolvencia-xss`/`conciliacion-xss`. (2)
  `escapeAllUnlessHtml` ignora la allowlist y escapa todo: fallan 54 tests —
  es el modo de falla (A) que el propio `html-escape-guard.test.ts` describe
  en su docstring (HTML del sistema saliendo escapado por error). Las dos
  mutaciones se revirtieron antes de commitear.
- `html-escape-guard.test.ts` necesitó un segundo ajuste: `readAllowlist()`
  parseaba solo `placeholder-mapper.ts` para encontrar
  `HTML_PLACEHOLDERS_ALLOWLIST` (el mismo problema de fondo del hallazgo del
  Paso 4, pero en la función que lee la allowlist en vez de la que junta
  funciones). Se corrigió con el mismo criterio de un-solo-pase sobre
  `./placeholders/*`.
- Suite completa 1448/97, `tsc` limpio, `eslint` 0 errores, `next build` OK.

Efecto en el Paso 4: `income.ts` ya no importa `escapePlaceholder` de vuelta
desde `placeholder-mapper.ts` — importa de `placeholders/escape.ts`, igual
que `placeholder-mapper.ts`. El ciclo desapareció. Los pasos 6, 7 y 9 importan
directamente de `placeholders/escape.ts`, sin crear ninguno nuevo.

## Pasos propuestos

El orden de acá en adelante es una propuesta, no un compromiso: lo que lo fija
son las dependencias y los PRs abiertos, no la numeración.

| Paso | Grupo                                                                                                                                                                    | Líneas    | Colisiona                                    | Bloqueado por                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| 5    | `mapAssets` + `mapDebts`                                                                                                                                                 | 155 + 17  | no                                           | nada — **#79** ya mergeado, retiró los 264 slots numerados de `mapDebts` (117 → 17) |
| 6    | Builders HTML: los 7 `generate*`                                                                                                                                         | ~293      | no (las claves las emiten sus llamadores)    | conviene después del 5: dos de ellos recorren bienes                                |
| 7    | Conciliación: `buildConciliationContext` + `mapConciliationFields`                                                                                                       | 107 + 265 | sí (`NOMBRE_CONVOCANTE`, 3 de desistimiento) | nada                                                                                |
| 8    | Apoyo: `mapApoyoFields`                                                                                                                                                  | 99        | no                                           | nada                                                                                |
| 9    | Los pares de colisión: `mapApplicantScope`+`mapAgreementResult`, `mapExternalEntities`+`mapFracasoVariables`+`mapExtendedDates`, `mapDynamicTables`+`mapPaymentProposal` | ~404      | sí, por definición                           | conviene último: es el que más contrato mueve                                       |

### Lo que se queda en `placeholder-mapper.ts`

No es residuo: es la superficie pública del módulo.

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
