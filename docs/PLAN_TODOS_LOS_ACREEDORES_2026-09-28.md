# Plan — listar todos los acreedores en la Solicitud de Insolvencia

**Fecha:** 2026-09-28
**Estado (2026-10-01):** Pasos 1 y 2 mergeados (PR #73 y #74). Pasos 3, 4 y 5 implementados y esperando revisión en los PR #77, #78 y #79, construidos sobre la opción (1) del §2 — que este documento **asume** y que no consta respondida por la abogada. Las trampas de merge verificadas están en el §10.
**Alcance:** `src/features/document/placeholder-mapper.ts`, `src/features/document/generate-documents.ts`, `src/features/document/actions.ts`, `templates/insolvency/Solicitud de Insolvencia.html`, `templates/insolvency/Formatos Para Audiencias/CYG Tramite.html`.

---

## 1. El problema

La `Solicitud de Insolvencia.html` tiene **tres** fichas de acreedor escritas a mano en el HTML —`Acreedor No. 1`, `No. 2`, `No. 3`, líneas 127–186— cada una una tabla de 15 filas. El cuadro resumen que va antes tiene 10 renglones (`ACREEDOR_1` … `ACREEDOR_10`). El mapper produce 11 slots de cada familia.

El tope legal del trámite son **150 acreedores**.

Un caso con 4 acreedores radica hoy un documento donde **el cuarto no tiene ficha**. Con 11 o más, tampoco aparece en el resumen.

### Por qué no lo detecta nada

- El gate de placeholders sin resolver de `renderDocumentHtml` mide **plantilla → mapper**: detecta un `{{VAR}}` que el mapper no produce. Acá pasa lo contrario — hay datos que ninguna plantilla pide.
- `validatePlaceholderCoverage` solo emite un `logger.warn` cuando la cobertura baja de 80%, y **no bloquea**.
- El golden `insolvencia-muchos` tiene **13 deudas** contra 11 slots, y registra la truncación **como comportamiento esperado**. Es decir: la red de seguridad documenta el bug en lugar de detenerlo.

### Inventario relacionado

Al medir esto quedaron a la vista otras familias de slots fijos que **ninguna plantilla consume**:

| Familia                                | Slots | Plantillas que la consumen      |
| -------------------------------------- | ----- | ------------------------------- |
| `AC{n}_*`                              | 11    | 2 (Solicitud usa 3, CYG usa 11) |
| `ACREEDOR_{n}` y columnas              | 11    | 2 (Solicitud 10, CYG 11)        |
| `PROCESO_{n}_*`                        | 5     | 1 (Solicitud usa 2)             |
| `AC{n}_CAPITAL_RAW` / `_INTERESES_RAW` | 11    | **0**                           |
| `BIEN_{n}_*`                           | 5     | **0**                           |
| `DEPENDIENTE_{n}`                      | 5     | **0**                           |
| `acr_{n}_*`                            | 15    | **0**                           |
| `bien_{n}_*`                           | 10    | **0**                           |
| `pj_{n}_*`                             | 10    | **0**                           |

---

## 2. La decisión que no es técnica

Dos opciones mutuamente excluyentes, y ninguna la decide el equipo de desarrollo porque las dos cambian el **contenido legal del documento principal**:

1. **La Solicitud lista todos los acreedores del caso.** El documento crece con el expediente.
2. **Hay un tope real en el cuerpo principal** y los acreedores que exceden van en un **anexo aparte**, con la fórmula que corresponda.

**Este documento asume la respuesta (1).** Si la respuesta es (2), los Pasos 1 y 2 sirven igual —cambia solo qué renderiza la plantilla—, y los Pasos 3–5 se rehacen sobre la forma del anexo.

---

## 3. Precondiciones: tres PRs abiertos

| PR      | Qué toca                                                                  | Por qué bloquea                                                    |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **#57** | `generate-documents.ts` (+289/−16)                                        | reescribe 2 de los 3 sitios donde se arma `extraContext`           |
| **#52** | mueve los sub-mappers de lista a `placeholders/case-lists.ts` (+136/−110) | `mapDebts` se muda ahí                                             |
| **#51** | `handlebars-lite.ts`: `@last` dentro de `{{#each}}`                       | necesario para enumeraciones en prosa ("A, B y C"), no para tablas |

Los **Pasos 1 y 2 se hicieron antes** de que cierren, a propósito: su superficie de conflicto son 3 líneas en `generate-documents.ts`, y a cambio dejan lista la mitad del trabajo sin depender de la decisión legal. Los **Pasos 3–5 esperan**.

---

## 4. Paso 1 — `validatePlaceholderCoverage` consciente de bloques

**Implementado: PR #73.**

La función escaneaba `{{VAR}}` sobre el HTML crudo sin entender bloques, así que las variables internas de un `{{#each}}` se contaban como `missing`. Con las plantillas de conciliación eso ya inflaba la cifra de faltantes, y con las de insolvencia migradas dispararía el warn de cobertura baja en cada generación.

No bloqueaba nada — el documento sale bien. El efecto era ruido en logs y en Sentry, y una métrica de cobertura que mentía.

El arreglo reusa la misma estrategia que `renderDocumentHtml` ya aplica para el gate de `unresolved` (consciente de bloques desde el PR #50): pelar los bloques de adentro hacia afuera antes de escanear.

---

## 5. Paso 2 — `buildInsolvencyContext` + dispatcher

**Implementado: PR #74.** Sin migrar ninguna plantilla.

### El builder

Hermano de `buildConciliationContext` (107 líneas, líneas 1756–1862). Sale más simple porque lee **relaciones tipadas** en vez de columnas `Json`.

Expone un array de acreedores con las 15 claves de la ficha más las 7 del resumen, para que el mismo array alimente las dos tablas de la Solicitud y la de CYG.

Dos cosas que **no** se copian de `mapDebts`:

- **Los porcentajes necesitan los totales de todas las deudas.** `mapDebts` los calcula una vez antes del loop; el builder hace lo mismo, no por ítem.
- **El escapado es responsabilidad del builder.** `extraContext` **no** pasa por `escapeAllUnlessHtml` — ese escape se aplica solo al `PlaceholderMap` plano, en el punto de fusión de `mapCaseToPlaceholders`. `buildConciliationContext` lo resuelve con su helper `asArray`. **Omitirlo sería un XSS en un documento legal.**

También emite el **número de orden** como campo del ítem: hoy el `Acreedor No. 1` está escrito en el HTML, y `handlebars-lite` no expone `@index`.

### El dispatcher

El mismo ternario estaba repetido en tres lugares:

| Archivo                 | Línea (antes del cambio) |
| ----------------------- | ------------------------ |
| `generate-documents.ts` | 425                      |
| `generate-documents.ts` | 834                      |
| `actions.ts`            | 1021                     |

Los tres pasan a llamar a una función única que despacha por `caseData.type`.

### Criterio de aceptación del Paso 2

**El golden master no se mueve ni un byte.** Nadie consume el contexto nuevo todavía, así que cualquier cambio en `render-hashes.json` o en los goldens del mapper significa que el contexto se está filtrando a un render. Es la verificación que hace este paso seguro.

---

## 6. Pasos 3–5 — en espera

### Paso 3 — `Solicitud de Insolvencia.html`

Las tres fichas (127–186, 20 líneas cada una) se colapsan en un bloque `{{#each ACREEDORES}}`, y los 10 `<tr>` del resumen en uno. Neto: ~60 líneas de HTML repetido → ~20.

Los tags van **envueltos en comentarios HTML** (`<!-- {{#each ...}} -->`): `handlebars-lite` los desenvuelve con su `WRAPPER_RE`, y la plantilla sigue siendo HTML válido para abrir en un navegador sin renderizar. Es el patrón que ya usan las plantillas de conciliación.

### Paso 4 — `CYG Tramite.html`

La otra consumidora de `AC{n}_*`: una tabla con un `<tr>` por acreedor, `AC1` a `AC11` → 1 fila con `{{#each}}`.

Dos cosas verificadas que **no** complican esto:

- no tiene JavaScript embebido (`grep -c "<script"` → 0), a pesar del comentario del mapper que dice _"RAW numeric values for CYG table JavaScript calculation"_;
- esos `_RAW` no los consume ninguna plantilla — son placeholders muertos y se borran acá.

### Paso 5 — Retirar los slots planos

En un PR aparte del 3 y el 4, a propósito: migrar las plantillas **manteniendo** los slots hace que el golden muestre el cambio de render y que un problema se revierta tocando solo la plantilla. Borrar los slots después es un PR cuyo único riesgo es el gate de `unresolved` — que es justamente el que detectaría una referencia olvidada.

---

## 7. Tamaño

**Mediano-grande, ~12 h de código.** Los Pasos 1 y 2 son ~8 h de esas.

| Parte                                                      | Estimación |
| ---------------------------------------------------------- | ---------- |
| `buildInsolvencyContext` + dispatcher + tests              | ~6 h       |
| Migración de las 2 plantillas + golden + revisión del PDF  | ~4 h       |
| `validatePlaceholderCoverage` consciente de bloques + test | ~2 h       |

**El costo real no es el código.** Es verificar el **PDF renderizado** de un documento legal con N acreedores: saltos de página, que una ficha no se corte a la mitad, que el resumen no desborde. Eso no se cubre con tests unitarios y necesita a alguien mirando el PDF con 1, 3, 15 y 50 acreedores. Presupuestar esa revisión aparte, con la abogada disponible.

---

## 8. Tests

| Qué                                            | Dónde                                                |
| ---------------------------------------------- | ---------------------------------------------------- |
| El builder: forma del array, totales, escapado | test propio, hermano del de conciliación             |
| XSS: el contexto nuevo escapa sus strings      | `html-escape-guard.test.ts`                          |
| Paso 2: el golden **no** cambia                | `render-hashes.json` + goldens del mapper            |
| Pasos 3–4: cambia el hash, `u` sigue vacío     | **12 de 342** entradas (6 escenarios × 2 plantillas) |
| Que el caso de 13 deudas ya no trunque         | el escenario `insolvencia-muchos` ya existe          |

El último es el que hace el PR auto-demostrativo: el golden actual documenta el bug; el diff del golden documenta el arreglo.

---

## 9. Hallazgo menor, para arreglar de paso

`PORCENTAJE_{n}` se emite así:

```ts
result[`PORCENTAJE_${idx}`] =
  debt.percentageOfTotal?.toString() || `${percentage}%`;
```

La rama persistida da `"33"` y la calculada da `"33.00%"` — **el símbolo de porcentaje aparece o no según de dónde vino el número**. En el mismo documento pueden convivir las dos formas. Vale normalizarlo al migrar.

---

## 10. Al mergear la cadena: dos trampas verificadas

Medido el 2026-10-01 simulando la secuencia completa de squashes (#77 → #78 →
#79) sobre el `dev` de ese día. Las dos aparecen **durante el merge**, no en el
contenido de los PRs, que simulado termina en verde.

### 10.1 El golden se automergea mal y git no avisa

`tests/unit/documents/golden/render-hashes.json` es un JSON ordenado que #77 y
#78 regeneran los dos. Al squashear #77 y después mergear #78, git funde el
archivo **textualmente y sin marcar conflicto**, y el resultado queda con la
clave `INSOLVENCY/cyg-tramite|insolvencia-muchos` **dos veces**: una con el hash
nuevo de la plantilla y otra con el viejo.

JSON con claves repetidas no es un error de sintaxis —gana la última—, así que
el archivo parece sano. Lo detectó el golden master, que reportó «la PLANTILLA
cambió, no el mapper». Si las dos entradas hubieran coincidido, habría pasado en
silencio.

**Qué hacer:** no dejar que el golden se automergee. Tomarlo entero de la rama
hija —que es la acumulativa y la correcta— o regenerarlo:

```bash
git checkout <rama-hija> -- tests/unit/documents/golden/render-hashes.json
```

Y comprobar que no quedaron claves repetidas en ningún golden:

```bash
python -c "import json,glob,collections
for f in glob.glob('tests/unit/documents/golden/**/*.json', recursive=True):
    def dup(p):
        d=[k for k,n in collections.Counter(k for k,_ in p).items() if n>1]
        if d: print('DUPLICADAS', f, d)
        return dict(p)
    json.loads(open(f, encoding='utf-8').read(), object_pairs_hook=dup)"
```

### 10.2 El conflicto `add/add` por squashear el padre

Al squashear #77, los dos archivos de test que #78 también toca
—`insolvency-context.test.ts` y `solicitud-acreedores-sin-tope.test.ts`— chocan
como `add/add`. No es un defecto de #78: el commit del squash tiene un SHA que
no existe en la historia de la rama hija, así que para git esos archivos los
agregan los dos lados de la nada.

Es el mismo mecanismo que apareció con #68 en la ronda de septiembre, y va a
volver a pasar entre #78 y #79.

**Qué hacer:** resolver tomando la versión de la rama hija, que ya contiene lo
del padre más lo suyo. No hay que fusionar a mano.

### 10.3 Y lo que sí hay que mirar a ojo

Los 8 PDF de revisión (2 plantillas × 1, 3, 15 y 50 acreedores) se generaron el
2026-10-01 con Chromium real y casos sintéticos, sin tocar ninguna base. Ninguno
deja placeholders sin resolver y el conteo de fichas y filas coincide
exactamente con el número de acreedores en los cuatro volúmenes — o sea que el
truncamiento silencioso ya no está.

| Acreedores | Solicitud | CYG Tramite |
| ---------- | --------- | ----------- |
| 1          | 7 págs    | 2 págs      |
| 3          | 8 págs    | 2 págs      |
| 15         | 14 págs   | 3 págs      |
| 50         | 33 págs   | 5 págs      |

Lo que los tests **no** pueden responder y sigue necesitando a alguien mirando
el PDF: saltos de página, que una ficha no quede cortada a la mitad, y que el
cuadro resumen no desborde.

---

## 11. Referencias

- Hallazgos de calidad de la misma ronda: `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`
- Auditoría del módulo de documentos: `docs/AUDITORIA_MODULO_GENERACION_2026-07.md`
- Diccionario de placeholders: `docs/DICCIONARIO_PLACEHOLDERS.md`
