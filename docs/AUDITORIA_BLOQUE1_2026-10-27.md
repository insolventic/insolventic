# Auditoría Bloque 1 — Producto y documentos (2026-10-27)

Barrido pedido sobre las 65 plantillas, las reglas de negocio con base legal y los
formularios. Cada hallazgo de abajo se verificó ejecutando el código real, no leyéndolo:
el arnés renderizó las 65 plantillas con `mapCaseToPlaceholders` + `prepareTemplate`
(las mismas funciones que usan las dos rutas de generación) para **los dos centros × dos
perfiles de datos** = 260 renders.

Estado por ítem del encargo:

| Ítem | Qué pedía                                                 | Estado                                        |
| ---- | --------------------------------------------------------- | --------------------------------------------- |
| 1    | 65 plantillas × 2 centros × caso completo/mínimo          | **hecho** (§1)                                |
| 3    | Reglas de negocio vs. la ley citada en el código          | **hecho** (§2)                                |
| 4    | Formularios: validaciones, textos, formatos, datos límite | **hecho** (§3)                                |
| 2    | Ciclo completo en el navegador, por centro                | **hecho, con un tramo fuera de alcance** (§5) |
| 5    | Responsive y accesibilidad (360/768/escritorio)           | **hecho, salvo contraste y teclado** (§6)     |

---

## 1. Plantillas (ítem 1)

### 1.1 Resultado global

| Centro / perfil                      | bien | con huecos | bloqueada |
| ------------------------------------ | ---: | ---------: | --------: |
| Constructores de Paz — caso completo |   61 |          3 |         1 |
| Constructores de Paz — datos mínimos |   39 |         25 |         1 |
| Armonía Concertada — caso completo   |   59 |          3 |         3 |
| Armonía Concertada — datos mínimos   |   37 |         25 |         3 |

Dos resultados **limpios** que conviene dejar por escrito, porque eran los riesgos
grandes y no se materializaron:

- **Cero contaminación entre centros.** Ningún documento de Armonía imprimió un dato de
  Constructores (membrete, resolución, NIT, firmante, cuenta, dirección, teléfono, web,
  entidad promotora), ni al revés. Tampoco quedó prosa fija del otro centro en el HTML
  crudo de ninguna de las 65 plantillas: 0 residuales. El trabajo de
  `membrete-centro.ts` + `branding-assets.ts` está completo en ese frente.
- **Cero montos mal formateados** en los 260 renders, y cero inventario roto: las 65
  plantillas de `ALL_TEMPLATES` existen en disco, sin duplicados y sin huérfanos.

### 1.2 Hallazgos

**H1 — `Check List` no se genera NUNCA, para ningún centro.** `SI_PARAGRAFO_3` /
`NO_PARAGRAFO_3` no los produce ningún sub-mapper, y las dos rutas de generación
bloquean el documento ante cualquier placeholder sin resolver. La plantilla tiene
`generateOnCreate: true`, así que **falta en el Paquete 1 de todo expediente de
insolvencia**. No es un defecto nuevo: está decidido así a propósito, esperando criterio
jurídico (`tests/unit/documents/check-list-paragrafos.test.ts`,
`docs/PENDIENTES_DECISION_LEGAL.md` ítem 2). Lo que sí vale señalar es el costo: es el
único documento del sistema que no se puede emitir, y lleva así desde entonces. Es una
pregunta de una línea a la abogada.

**H2 — `Solicitud de Insolvencia` imprime `Invalid Date`.** `PROP_EXTRA_MES` sale
literalmente `Invalid Date` en la tabla de la propuesta de pago (fila «MES», junto a
«FECHA»), en los dos centros, con el caso completo.

Causa exacta: `Case.extraordinaryPaymentDate` es `String?` —texto libre, no fecha— y
`tablas-dinamicas-pagos.ts:209` hace `getMonthName(new Date(valor))`. El campo se captura
con un input de texto (`payment-proposal-section.tsx:453`), y el propio sistema escribe
ahí `'Diciembre de cada año'` (`create-case-dialog.tsx:1114`), que `new Date()` no puede
parsear. O se deriva el mes de un campo de fecha de verdad, o ese placeholder no debería
intentar formatear texto libre.

**H3 — Placeholders «MANUAL» que no dejan una línea para llenar, sino un hueco mudo.**
Con el caso completo, tres plantillas salen con frases partidas:

- `Tramite Audiencia`: «…se cede el uso de la palabra a ⟨⟩ se verifican las pruebas ⟨⟩.»
  y «…fijar fecha para el día ⟨⟩ de ⟨⟩ de 2026 a las ⟨⟩» (`NOMBRE_PERSONA`,
  `DESCRIPCION_PRUEBAS`, `DIA_PROXIMA`, `MES_PROXIMA`, `HORA_PROXIMA`).
- `Fracaso por Impugnacion`: la sección HECHOS sale **vacía** (`HECHO_1/2/3`).
- `Solicitud de Insolvencia`: `PROP_SEGURO_INCENDIO`, `PROP_SEGURO_VIDA`.

El mapper los marca `// MANUAL` con intención, pero los emite como `''`. Otros
placeholders manuales del mismo archivo sí emiten una raya visible
(`FECHA_CONTROL_LEGALIDAD: '________________'`). La diferencia importa: una raya se ve y
se llena a mano; un `''` produce un documento que **parece completo y no lo está**, que es
exactamente el riesgo que `renderDocumentHtml` documenta querer evitar. Unificar a raya
visible es un cambio de una línea por clave.

**H4 — Armonía: 2 plantillas bloqueadas por el dato que falta.** `Auto Solicitud Reforma
del Acuerdo` y `Solicitud por Incumplimiento` cortan por `CENTRO_CUENTA_CONSIGNACION`.
Conocido y deliberado (`membrete-centro.ts`): falla cerrado antes que imprimir la cuenta
del otro centro. Confirmado que el radio es exactamente 2 y no más.

**H5 — Con datos mínimos, 25 plantillas salen con huecos mudos.** Es el perfil «caso
recién creado». Son datos que el operador todavía no cargó, así que no es un bug de
mapeo; pero el documento se genera igual, con los huecos invisibles de H3. Las peores:
`Solicitud de Insolvencia` (32 huecos, cobertura 50%), `Solicitud de Audiencia de
Conciliación` (25), `Acta General de Conciliación` (20), `Acta de Alimentos` (16).

### 1.3 Tabla por plantilla

`BLOQ` = no se genera. Columnas: CP = Constructores de Paz, AR = Armonía Concertada.

### Insolvencia (50)

|   # | Plantilla                                       | Paq | CP compl. | CP mín.  | AR compl. | AR mín.  | Por qué                                                                                                           |
| --: | ----------------------------------------------- | --: | --------- | -------- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
|   1 | Solicitud de Insolvencia                        |   1 | huecos    | huecos   | huecos    | huecos   | imprime `Invalid Date`; huecos con datos completos: `PROP_SEGURO_INCENDIO`, `PROP_SEGURO_VIDA`                    |
|   2 | Certificado de Ingresos                         |   1 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|   3 | Declaracion Juramentada Domicilio               |   1 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|   4 | Check List                                      |   1 | **BLOQ**  | **BLOQ** | **BLOQ**  | **BLOQ** | **no se genera**: `SI_PARAGRAFO_3`, `NO_PARAGRAFO_3` sin resolver                                                 |
|   5 | Calificacion y Graduacion                       |   1 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|   6 | Inadmision                                      |   1 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|   7 | Auto Admision del Tramite                       |   2 | bien      | huecos   | bien      | huecos   | 3 hueco(s) solo con datos mínimos                                                                                 |
|   8 | Designacion del Conciliador                     |   2 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|   9 | Aceptacion del Cargo del Conciliador            |   2 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  10 | Edicto Emplazatorio                             |   2 | bien      | huecos   | bien      | huecos   | 1 hueco(s) solo con datos mínimos                                                                                 |
|  11 | Notificacion a los Acreedores                   |   2 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  12 | Suspension Juzgados                             |   2 | bien      | huecos   | bien      | huecos   | 3 hueco(s) solo con datos mínimos                                                                                 |
|  13 | Envio Pagador Suspension                        |   2 | bien      | huecos   | bien      | huecos   | 1 hueco(s) solo con datos mínimos                                                                                 |
|  14 | Restablecimiento de Servicios Publicos          |   2 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  15 | Tramite Audiencia                               |   3 | huecos    | huecos   | huecos    | huecos   | huecos con datos completos: `NOMBRE_PERSONA`, `DESCRIPCION_PRUEBAS`, `DIA_PROXIMA`, `MES_PROXIMA`, `HORA_PROXIMA` |
|  16 | Sentido del Voto                                |   3 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  17 | Acuerdo de Pago                                 |   3 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  18 | Acuerdo Bilateral                               |   3 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  19 | Auto Solicitud Reforma del Acuerdo              |   3 | bien      | bien     | **BLOQ**  | **BLOQ** | **Armonía no la genera**: falta `CENTRO_CUENTA_CONSIGNACION`                                                      |
|  20 | Reforma Acuerdo de Pago                         |   3 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  21 | Auto Desistimiento                              |   4 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  22 | Remision Resultado                              |   4 | bien      | huecos   | bien      | huecos   | 3 hueco(s) solo con datos mínimos                                                                                 |
|  23 | Hoja Guia                                       |   4 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  24 | Fracaso por Acuerdo Bilateral                   |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  25 | Remision Juzgado - Acuerdo Bilateral            |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  26 | Fracaso por Falta de Pago de Gastos             |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  27 | Remision Juzgado - Falta Pago Gastos            |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  28 | Fracaso por Impugnacion                         |   5 | huecos    | huecos   | huecos    | huecos   | huecos con datos completos: `HECHO_1`, `HECHO_2`, `HECHO_3`                                                       |
|  29 | Remision Juzgado - Impugnacion                  |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  30 | Fracaso por Inasistencia y Vencimiento          |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  31 | Remision Juzgado - Inasistencia y Vencimiento   |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  32 | Fracaso por Inasistencia y Animo de Conciliar   |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  33 | Remision Juzgado - Inasistencia Animo Conciliar |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  34 | Fracaso por Incumplimiento                      |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  35 | Remision Juzgado - Incumplimiento               |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  36 | Fracaso por Muerte del Deudor                   |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  37 | Remision Juzgado - Muerte del Deudor            |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  38 | Fracaso por Propuesta Inadecuada                |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  39 | Remision Juzgado - Propuesta Inadecuada         |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  40 | Fracaso por Propuesta y Vencimiento             |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  41 | Remision Juzgado - Propuesta y Vencimiento      |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  42 | Fracaso por Propuesta y Quorum                  |   5 | bien      | huecos   | bien      | huecos   | 1 hueco(s) solo con datos mínimos                                                                                 |
|  43 | Remision Juzgado - Propuesta y Quorum           |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  44 | Fracaso por Reforma del Acuerdo                 |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  45 | Remision Juzgado - Reforma del Acuerdo          |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  46 | Fracaso por Vencimiento de Terminos             |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  47 | Remision Juzgado - Vencimiento de Terminos      |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |
|  48 | Suspension Garantia Mobiliaria                  |   5 | bien      | huecos   | bien      | huecos   | 1 hueco(s) solo con datos mínimos                                                                                 |
|  49 | Solicitud por Incumplimiento                    |   5 | bien      | bien     | **BLOQ**  | **BLOQ** | **Armonía no la genera**: falta `CENTRO_CUENTA_CONSIGNACION`                                                      |
|  50 | Cierre por Inasistencia                         |   5 | bien      | bien     | bien      | bien     | —                                                                                                                 |

### Conciliación (12)

|   # | Plantilla                              | Paq | CP compl. | CP mín. | AR compl. | AR mín. | Por qué                            |
| --: | -------------------------------------- | --: | --------- | ------- | --------- | ------- | ---------------------------------- |
|   1 | Solicitud de Audiencia de Conciliación |   1 | bien      | huecos  | bien      | huecos  | 25 hueco(s) solo con datos mínimos |
|   2 | Notificación de Convocatoria           |   2 | bien      | huecos  | bien      | huecos  | 5 hueco(s) solo con datos mínimos  |
|   3 | Acta General de Conciliación           |   3 | bien      | huecos  | bien      | huecos  | 20 hueco(s) solo con datos mínimos |
|   4 | Acta de Alimentos                      |   3 | bien      | huecos  | bien      | huecos  | 16 hueco(s) solo con datos mínimos |
|   5 | Acta Disolución Unión Marital          |   3 | bien      | huecos  | bien      | huecos  | 11 hueco(s) solo con datos mínimos |
|   6 | Acta Unión Marital                     |   3 | bien      | huecos  | bien      | huecos  | 7 hueco(s) solo con datos mínimos  |
|   7 | Aclaración de Acta                     |   3 | bien      | huecos  | bien      | huecos  | 8 hueco(s) solo con datos mínimos  |
|   8 | Constancia de Inasistencia             |   4 | bien      | huecos  | bien      | huecos  | 5 hueco(s) solo con datos mínimos  |
|   9 | Constancia de No Acuerdo               |   4 | bien      | huecos  | bien      | huecos  | 5 hueco(s) solo con datos mínimos  |
|  10 | Informe del Conciliador                |   4 | bien      | huecos  | bien      | huecos  | 8 hueco(s) solo con datos mínimos  |
|  11 | Terminación Anormal                    |   4 | bien      | huecos  | bien      | huecos  | 7 hueco(s) solo con datos mínimos  |
|  12 | Auto Desistimiento Conciliación        |   5 | bien      | huecos  | bien      | huecos  | 7 hueco(s) solo con datos mínimos  |

### Acuerdo de apoyo (3)

|   # | Plantilla                     | Paq | CP compl. | CP mín. | AR compl. | AR mín. | Por qué                            |
| --: | ----------------------------- | --: | --------- | ------- | --------- | ------- | ---------------------------------- |
|   1 | Solicitud de Acuerdo de Apoyo |   1 | bien      | huecos  | bien      | huecos  | 10 hueco(s) solo con datos mínimos |
|   2 | Acuerdo de Apoyo              |   3 | bien      | huecos  | bien      | huecos  | 7 hueco(s) solo con datos mínimos  |
|   3 | Constancia de Incumplimiento  |   5 | bien      | huecos  | bien      | huecos  | 5 hueco(s) solo con datos mínimos  |

---

## 2. Reglas de negocio vs. la ley citada en el código (ítem 3)

> No se afirma nada sobre cumplimiento jurídico. Lo de abajo son inconsistencias
> **internas** del código y citas que apuntan a normas que dejaron de regir o fueron
> compiladas en otra. Cada una necesita el visto bueno de la abogada.

### 2.1 El SMMLV tiene TRES valores distintos vivos a la vez

Es el hallazgo más serio de esta sección, porque de él cuelga si el apoderado judicial es
**obligatorio** en un expediente real.

| Capa             | Valor de SMMLV                         | 40 SMMLV (mínima cuantía) | Dónde                        |
| ---------------- | -------------------------------------- | ------------------------- | ---------------------------- |
| Servidor         | `getSmmlv(año)` → **1.750.905** (2026) | **$70.036.200**           | `validation-rules.ts:558`    |
| Cliente (wizard) | `SMMLV_2025` → **1.423.500**           | **$56.940.000**           | `create-case-dialog.tsx:543` |
| Documentos       | `1300000` literal                      | **$52.000.000**           | `placeholder-mapper.ts:66`   |

Consecuencias concretas:

- El comentario de `create-case-dialog.tsx:538` dice _«Misma función que usa el servidor
  (validateCaseBusinessRules), para que cliente y servidor digan lo mismo»_ — pero el
  código de la línea siguiente usa `SMMLV_2025`, que el propio `validation-rules.ts:96`
  marca `@deprecated`, no `getSmmlv(year)`. **El comentario afirma lo contrario de lo que
  hace el código.** Con una deuda de $60.000.000 radicada en 2026, el wizard advierte «es
  obligatorio contar con apoderado judicial» y el servidor no dice nada.
- El `Check List` clasifica los umbrales de 40 y 150 SMMLV con el valor de **2024**
  (`placeholder-mapper.ts:66`, comentado como «Salario mínimo 2025 Colombia», que tampoco
  es). En la banda $52.000.000–$70.036.200 el documento marca una casilla y la validación
  del formulario dice lo contrario.
- `SMMLV_VALOR` imprime **$1.300.000** como el salario mínimo en los documentos que lo
  citan. Verificado en el render.

El arreglo es mecánico y está a mano: `validation-rules.ts` ya tiene la tabla
`SMMLV_BY_YEAR` por año, con sus fuentes normativas y su `TODO(legal)` bien escrito. Las
otras dos capas simplemente no la usan.

### 2.2 Valor transitorio, correctamente señalado

`SMMLV_BY_YEAR[2026] = 1_750_905` viene del **Decreto 0159 de 2026**, que fija el valor
«TRANSITORIAMENTE» por orden del Consejo de Estado tras suspender provisionalmente el
Decreto 1469 de 2025. El `TODO(legal)` de `validation-rules.ts:44-62` lo documenta con las
dos condiciones que obligarían a revisarlo. **Está bien hecho**; solo hay que notar que
ese cuidado no llegó a las otras dos capas (§2.1). El valor de 2024 queda anotado como
«pendiente de confirmar contra el Decreto 1572 de 2024».

### 2.3 Citas normativas que necesitan revisión

| Cita                                                               | Dónde                                                                                                | Por qué revisarla                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEY 2564/2012`                                                    | `templates/insolvency/Inadmision Cuando no Cumple con los Requisitos.html:21`                        | **Errata de dígito.** El CGP es la Ley **1564** de 2012. Está en el encabezado que invoca la base legal de la inadmisión, en un documento que se entrega al deudor.                                                                                                                                |
| `Ley 1380 de 2010`                                                 | `src/prisma/seed.ts:1000, 1201, 1351` — campo `legalFoundations`                                     | Es el régimen de insolvencia de persona natural **anterior**, que dejó de regir; la materia pasó al CGP (arts. 531 y ss.). Aparece como fundamento legal del caso. Es data de semilla, no de producción.                                                                                           |
| `Decreto 2677 de 2012`                                             | 5 sitios en `src/`, 7 plantillas (incluido «artículo 33 del Decreto 2677/2012»)                      | Su contenido fue **compilado en el Decreto 1069 de 2015** (DUR del Sector Justicia), que renumera los artículos. El repo ya cita el 1069 en 2 lugares de `src/` y en 3 plantillas: las dos citas conviven sin criterio único.                                                                      |
| `Ley 446 de 1998` arts. 65 y 77, y `Ley 23 de 1991` arts. 75 y ss. | 6 plantillas de conciliación, en el considerando PRIMERO y en las constancias                        | Se citan **apiladas** con la Ley 2220 de 2022 («…artículos 75 y siguientes de la Ley 23 de 1991; 65 de la Ley 446 de 1998 y Ley 2220 de 2022»). La 2220 es el estatuto de conciliación vigente y reorganizó esa materia. Hay que decidir si las anteriores se dejan como antecedente o se retiran. |
| `Ley 640 de 2001` art. 2º                                          | `templates/support-agreements/Constancia de Incumplimiento Acuerdo de Apoyo.html:75`; `seed.ts:1103` | Misma situación que la anterior: materia reorganizada por la Ley 2220 de 2022.                                                                                                                                                                                                                     |

Citas que **no** presentan problema aparente: `Ley 1564 de 2012` (26 usos en plantillas),
`Ley 2445 de 2025` (16), `Ley 2220 de 2022` (8+), `Ley 1581 de 2012`, `Ley 258/1996`,
`Ley 979 de 2005`, `Ley 527 de 1999`, `Ley 1116 de 2006`.

### 2.4 Reglas con decisión legal explícitamente pendiente

Tres, todas documentadas en el código y en `docs/PENDIENTES_DECISION_LEGAL.md`:

1. **Parágrafo 3 del Check List** (ítem 2) — bloquea el documento. Ver H1.
2. **Apoderado del acreedor** (ítem 13, `apoderado-acreedor.ts:7`) — el sistema captura
   los dos y no elige, por decisión del 2026-10-09.
3. **Cuenta de consignación de Armonía** (ítem 11, `membrete-centro.ts`) — bloquea 2
   plantillas. Ver H4.

---

## 3. Formularios (ítem 4)

### 3.1 Lo que está bien

- **Mensajes de validación**: los 125 textos de error de los 10 `schemas.ts` están en
  español, con tildes correctas y redacción consistente («El teléfono es requerido», «La
  deuda total es requerida»).
- **Ortografía de la interfaz**: barrido del texto visible de los `.tsx` contra una lista
  de palabras que suelen perder la tilde. **Un solo defecto real** (F1).
- **Escapado**: con la carga XSS del escenario `insolvencia-xss`, los ~300 placeholders
  escalares salen escapados. Los tres que llevan HTML (`DETALLE_BIENES`,
  `LISTA_ACREEDORES`, `FORMA_PAGO_ACREEDORES`) traen el dato del usuario escapado
  (`&lt;b onmouseover=…&gt;`) y solo las etiquetas estructurales en crudo — el
  comportamiento que diseña `HTML_PLACEHOLDERS_ALLOWLIST`. Correcto.
- **Moneda**: `MoneyInput` + `parsearMonto` están en 13 componentes; cero montos mal
  formateados en los 260 renders de plantillas.

### 3.2 Hallazgos

**F1 — Etiqueta sin tilde.** `case-details-dialog/pre-generation-form.tsx:171`:
«Porcentaje de **aprobacion** (%)» → «aprobación». Es la única del sistema.

**F2 — Prácticamente ningún campo de texto tiene longitud máxima.** 1.268 `z.string()`
repartidos en los 10 `schemas.ts`, de los cuales **10** llevan `.max()`. Y en
`schema.prisma` no hay **ni un** `@db.VarChar`: todas las columnas de texto son `text`,
sin límite. Verificado de punta a punta: un nombre de deudor de **50.000 caracteres**
atraviesa el mapper intacto (`NOMBRE_DEUDOR.length === 50000`) y entra al HTML que va a
Puppeteer. No hay tope por validación, ni por columna, ni por el mapper.

**F3 — El teléfono no tiene formato.** Los 7 sitios que lo validan usan
`z.string().min(1, 'El teléfono es requerido')` y nada más: `abc-def-ghi` es un teléfono
válido para el sistema, y termina impreso en las notificaciones a acreedores y juzgados.
Un celular colombiano son 10 dígitos.

**F4 — Montos enormes imprimen basura de punto flotante.** Con ingresos de `1e21`,
`TOTAL_INGRESOS` sale `$ 1.000.000.000.000.001.300.000` — los dígitos finales son error de
representación, no un dato. No hay cota superior en ningún monto.

**F5 — Montos negativos se aceptan y se imprimen.** Una deuda de −1 da
`TOTAL_ACREENCIAS = "-$ 3"` en el documento. Ningún monto valida que sea ≥ 0.

**F6 — Un ingreso de 0 se reemplaza en silencio por el del deudor.** El patrón
`Number(caseData.monthlyIncome) || Number(debtor.monthlyIncome) || 0`
(`placeholder-mapper.ts:435`) trata el **0 legítimo** como «sin dato»: un deudor que
declara ingreso cero en el expediente sale en el documento con el ingreso de su ficha.
Mismo patrón en `monthlyExpenses`.

### 3.3 Campos de dinero sin normalizar

Confirmados los 2 que `CLAUDE.md` ya anota (`payment-tracking-section.tsx:572`,
`payment-tracking-report.tsx:1118`). Revisados los otros 12 `type="number"` del proyecto:
ninguno es dinero (`approvalPercentage`, `gracePeriodMonths`, `capitalReductionPercent`,
`apoyoPlazoMeses`, `interestRate`, `percentageOfTotal`, `age`, el `XAxis` de Recharts).
La nota de `CLAUDE.md` es exacta.

---

## 4. Cómo reproducir

El arnés de §1 es un test temporal que no quedó en el repo
(`tests/unit/documents/zz-auditoria-bloque1.test.ts`): recorre `ALL_TEMPLATES` ×
`['constructores-paz', 'armonia']` × `['full','minimal']` llamando a
`mapCaseToPlaceholders`, `buildTemplateContext`, `templateVariants` y `prepareTemplate`, y
volcaba `auditoria-plantillas.json` con, por render: `unresolved`, cobertura, vacíos con su
contexto en la frase, ruido (`NaN` / `Invalid Date` / `«FALTA`), marcas del otro centro y
montos sospechosos. Dos filtros evitan falsos positivos y conviene conservarlos si se
rearma: descartar las claves envueltas en su propio `{{#if KEY}}` (el caso de `CENTRO_WEB`
en Armonía) y la mitad no marcada de cada casilla SI/NO.

---

## 5. Recorrido en el navegador (ítem 2)

Entorno: `npm run dev` contra el Postgres local descartable (contenedor
`insolventic-db-verif`, puerto 54329, el que apunta `.env.local`), con el seed
cargado — 2 centros, 10 usuarios, 22 casos. Se recorrió con la sesión de
`beatriz.malavera@insolventic.com` (Administrador) en los dos centros.

**Cobertura real.** Se recorrieron: selector de centro, login y cierre de sesión en
los dos centros; dashboard; listado de casos con filtros; detalle de caso (sus 10
pestañas); asistente de creación de caso (las 7 pestañas, validación y envío);
cambio de fase; generación de cronograma de pagos; documentos; calendario;
notificaciones; reportes y su exportación a Excel; y auditoría. **No** se cubrió, y
queda pendiente: la generación real de documentos, la regeneración y los adjuntos.

> **Por qué no se pudo generar ni un documento.** `google-drive.ts` exige
> `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
> `GOOGLE_DRIVE_REFRESH_TOKEN` y `GOOGLE_DRIVE_FOLDER_ID`, y el `.env.local` de
> esta máquina solo trae cuatro variables (`DATABASE_URL`, `DIRECT_URL`,
> `JWT_SECRET`, `NEXT_PUBLIC_APP_ENV`). Sin esas credenciales el pipeline corta en
> la subida. Lo que §1 sí cubre es todo lo anterior a la subida —plantilla,
> variantes, mapper, render y el gate de placeholders—, que es donde estaban los
> defectos. Falta el tramo PDF/DOCX → Drive.

### 5.1 Hallazgos

**N1 — Un caso puede quedar en una fase sin salida, y mostrada mal.** Reproducido:
el caso `ACU-2025-003` tiene `phase = "Documentos pendientes"` en la base, pero la
interfaz lo muestra como **«Inicial»** en el listado, en el dashboard y en el propio
diálogo de cambio de fase, que además dice **«No hay transiciones disponibles desde
esta fase»**. El caso no se puede mover a ninguna parte.

La causa son dos vocabularios paralelos para el estado de un caso:

- `src/lib/case-phases.ts` define 13 fases y es el que gobierna `Case.phase`.
- `src/features/document/schemas.ts:43` define otro juego de 5 estados, con
  `PENDING_DOCUMENTS: 'Documentos pendientes'` y `CLOSED: 'Cerrado'`, **ninguno de
  los cuales existe en `CASE_PHASES`**. El seed escribe el primero directo en
  `Case.phase` (`seed.ts:1135`).

Y lo que lo vuelve silencioso: `getPhaseDefinition` (`case-phases.ts:223`) resuelve
una fase desconocida devolviendo `CASE_PHASES[0]`, que es «Inicial». No avisa, no
registra nada: etiqueta cualquier valor que no conozca como la primera fase, con su
color. Como `PHASE_TRANSITIONS` tampoco tiene esa clave, el caso queda encerrado.

La prueba de que es un fallo y no un diseño: `PHASE_TRANSITIONS['Inicial']` sí
existe y vale `['Admisión', 'Rechazo', 'Retiro']`. Un caso realmente en «Inicial»
tiene tres salidas. Que el diálogo diga «Inicial» y «sin transiciones» a la vez solo
puede pasar porque la etiqueta es un valor por defecto sobre una fase que el sistema
no reconoce. Y es visible en el mismo dashboard: la tabla «Casos Recientes» dice
«Inicial» mientras el bloque «Casos por Fase» —que agrupa por el valor crudo— dice
«Documentos pendientes», para el mismo caso.

**N2 — La primera cuota nace vencida.** Reproducido en `INS-2025-001`: se pulsa
«Generar Cronograma de Pagos» y el cronograma sale con 12 cuotas, la primera con
vencimiento **hoy** y ya marcada **«Vencido»**, con el contador «Vencidas: 1 cuotas
atrasadas» en rojo desde el primer segundo.

Las dos mitades:

- `payment/actions.ts:278` — `startDate = propuestaFechaInicioPago ?? paymentStartDate ?? new Date()`.
  Sin fecha de inicio en la propuesta, la cuota 1 vence en el instante exacto en que
  se genera.
- `payment-tracking-section.tsx:80` — `new Date(payment.dueDate) < new Date()` marca
  «vencido». Una fracción de segundo después de crearla, ya se cumple.

De paso, `paymentAmount = totalDebt / numberOfPayments` (`actions.ts:302`) no
redondea a pesos, así que una deuda que no divide exacto reparte fracciones de peso
entre las cuotas.

**N3 — La moneda se muestra con decimales en toda la interfaz.** Reproducido en el
centro Armonía: la tarjeta «Promedio por Caso» de `/cases` muestra
**`$8.916.666,667`**. Hay dos formateadores de moneda y no hacen lo mismo:

| Formateador                                                    | Qué hace                                                                                         | Resultado        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| `src/features/document/placeholders/format.ts:35` (documentos) | `Intl.NumberFormat('es-CO', {currency:'COP', minimumFractionDigits:0, maximumFractionDigits:0})` | `$ 8.916.667`    |
| `src/lib/utils.ts:22` (toda la interfaz)                       | `` `$${valor.toLocaleString('es-CO')}` `` — **sin opciones de decimales**                        | `$8.916.666,667` |

Sin `maximumFractionDigits`, `toLocaleString` imprime hasta 3 decimales. Se nota en
cualquier importe que no sea entero, que en producción son casi todos los promedios
y totales calculados. Lo usan 13 componentes de la interfaz. Arreglo de una línea,
y el formateador correcto ya existe en el repo.

**N4 — El detalle del caso se titula con el cuid.** `case-details-dialog.tsx:67`:
`<DialogTitle>Detalles del Caso {caseData?.id || 'N/A'}</DialogTitle>`. En pantalla
sale **«Detalles del Caso cmvdafujp00ffv90gff9vo1x7»**, mientras el número real del
expediente (`INS-2025-001`) está dos líneas más abajo en el cuerpo del diálogo.

**N5 — Vercel Analytics y Speed Insights están montados pero la CSP los bloquea.**
`layout.tsx:62-63` monta `<Analytics />` y `<SpeedInsights />`; sus scripts se
cargan desde `va.vercel-scripts.com`, y `buildContentSecurityPolicy`
(`src/lib/csp.ts:51`) declara `script-src 'self' 'unsafe-inline' 'unsafe-eval'` sin
ese origen, ni el endpoint de beacon en `connect-src`. La consola lo dice en cada
carga: _«Loading the script 'https://va.vercel-scripts.com/…' violates the following
Content Security Policy directive»_. La política no depende del entorno, así que en
producción pasa lo mismo: las dos integraciones existen en el código y no recogen
nada.

**N6 — Tres mensajes de validación del servidor salen en inglés.** `createCaseSchema`
—el esquema del **servidor**— deja tres campos requeridos sin mensaje propio, y
`actions.ts` devuelve `error.message` tal cual al cliente:

| Campo        | Mensaje que llega                                    |
| ------------ | ---------------------------------------------------- |
| `debtorId`   | `Invalid input: expected string, received undefined` |
| `operatorId` | `Invalid input: expected string, received undefined` |
| `creditors`  | `Invalid input`                                      |

El esquema del **formulario** (`createCaseFormSchema`, línea 997) sí los tiene en
español («El deudor es requerido», «El operador es requerido»), y es el que se ve en
el uso normal — lo verifiqué en el asistente. Los de arriba afloran cuando corta el
servidor.

**N7 — El nombre del centro Armonía no coincide consigo mismo.** La interfaz lo
llama **«Armonia»**, sin tilde, en el selector de centro, en el encabezado y en el
texto «Centro de conciliación Armonia» (viene de `Tenant.name`). Los documentos lo
llaman **«Armonía Concertada»** (`membrete-centro.ts`). Son dos nombres distintos
para el mismo centro, y el de la pantalla además está mal escrito.

**N8 — Menor: no se puede cambiar de centro con la sesión abierta.** Entrar a
`/login?db=armonia` con sesión activa redirige a `/dashboard` sin aviso, en el centro
anterior. Hay que cerrar sesión. Es coherente con que el tenant viaje en el token,
pero para una operadora que atiende los dos centros es un callejón sin señalización.

### 5.2 Lo que funcionó sin problemas

Login y cierre de sesión en los dos centros; dashboard con sus gráficos; listado,
filtros y paginación de casos; el detalle con sus 10 pestañas; el asistente de 7
pestañas, incluido el comportamiento de validación que describe `CLAUDE.md`
(«Siguiente» marca la pestaña que se deja, con mensaje y con ícono, y **no** bloquea
el avance — verificado: tras pulsar «Siguiente» con el operador vacío, la pestaña 1
muestra «El operador es requerido» y gana su ícono); el corte de envío por documentos
obligatorios faltantes, con el detalle de cuáles; calendario; notificaciones;
auditoría con filtros; y los reportes. La exportación a Excel responde 200 desde la
acción de servidor — la descarga del archivo en sí no se pudo comprobar dentro del
navegador embebido. Las 10 rutas principales responden 200.

---

## 6. Responsive y accesibilidad (ítem 5)

### 6.1 Responsive

| Ancho      | Resultado                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 360 px     | `/cases` **desborda**: `scrollWidth` 846 px contra 360 de viewport. Además el encabezado se **solapa**: el `<h1>` «INSOLVENTIC» ocupa de 76 a 225 px y el botón de búsqueda empieza en 214 px; la insignia del centro llega a 241 px, por encima del mismo botón. `/dashboard` se adapta bien. |
| 768 px     | `/cases` **sigue desbordando** (846 px contra 753). `/dashboard`, `/debtors`, `/documents` y `/audit-log` no desbordan.                                                                                                                                                                        |
| escritorio | Sin problemas.                                                                                                                                                                                                                                                                                 |

El culpable en `/cases` es siempre el mismo: la barra de filtros
(`div.flex.items-center`, 805 px: buscador de 320 px + dos selectores) no envuelve,
y arrastra toda la página. La tabla, que mide 1.201 px, **sí** está en un contenedor
con scroll propio y se comporta bien — el desbordamiento no viene de ella.

### 6.2 Accesibilidad

Lo que está bien, medido sobre el DOM renderizado:

- `<html lang="es">`.
- `/cases`: 32 botones y enlaces, **0 sin nombre accesible**; 0 imágenes sin `alt`.
- Asistente de creación de caso (paso 1): de **21 controles enfocables, 20 tienen
  nombre accesible**. Las casillas de causas de insolvencia son `button
role="checkbox"` con su `<label for="cause-…">` correspondiente — correcto.
- El diálogo del asistente tiene título accesible.

Lo que falta:

- **A1 — Dos campos sin etiqueta programática.** El buscador de `/cases`
  (`input type="text"`, solo `placeholder`) y el campo de deuda total del asistente
  («Se calcula de los acreedores», también solo `placeholder`). Un lector de pantalla
  los anuncia sin nombre. Un `aria-label` en cada uno lo cierra.
- **A2 — `aria-modal` ausente** en el diálogo del asistente.
- **A3 — Dos `<h1>` por página**: el del encabezado de la aplicación y el del título
  de la pantalla.

No se midieron contraste de color ni el recorrido completo por teclado (orden de
foco y trampas de foco en los diálogos); quedan pendientes de ese ítem.
