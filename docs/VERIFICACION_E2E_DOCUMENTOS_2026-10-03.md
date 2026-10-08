# Verificación de punta a punta con datos reales — formulario → BD → PDF

**Fecha:** 2026-10-03
**Rama verificada:** `dev` @ `da6e928` (sincronizada con `origin/dev`).
**Alcance:** los tres trámites (insolvencia, conciliación, acuerdo de apoyo), las 65 plantillas de `templates/`, el mapper de placeholders, las dos rutas de generación y la persistencia de `createCase`/`updateCase`.
**Qué NO es:** no es un mapeo estático del formulario contra las plantillas (eso lo hicieron las dos auditorías anteriores). Acá se crearon expedientes reales, se generaron los PDF reales con Chromium y se leyó el contenido de cada uno.

---

## 1. Qué se corrió, exactamente

8 expedientes sintéticos con datos colombianos realistas y distintivos (sin relleno automático: ningún valor es el nombre de su campo), creados con el `createCase` **real** contra un **PostgreSQL real** (contenedor descartable en `127.0.0.1:54329`, esquema aplicado con `prisma db push`). De cada expediente se generaron **todas** las plantillas de su tipo con `prepareTemplate` + `batchHtmlToPdf` y Chromium local.

| Caso  | Descripción                                                                                                                                                      | PDFs    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I1    | Insolvencia completa: casada con sociedad conyugal vigente, 3 apoderados, 6 acreedores (uno postergado, uno con libranza, dos con codeudor), 4 bienes, 2 libranzas, 2 servicios suspendidos, 2 dependientes, 3 procesos en 2 juzgados | 51      |
| I2    | Insolvencia mínima: soltero, sin apoderado ni cónyuge, 1 acreedor, sin bienes, sin procesos, sin dependientes                                                      | 50      |
| I3    | Insolvencia de volumen: 12 acreedores, 6 bienes, 4 procesos en 3 juzgados, 3 dependientes                                                                          | 52      |
| C1    | Conciliación de alimentos: convocado persona jurídica con representante legal, apoderados de ambas partes, 2 menores, 2 cláusulas adicionales                      | 12      |
| C2    | Conciliación de unión marital: sin apoderados, 1 menor, cláusulas de unión y de disolución                                                                         | 12      |
| C3    | Conciliación fallida: inasistencia del convocado, desistimiento, terminación anormal                                                                               | 12      |
| A1    | Acuerdo de apoyo completo: beneficiario, prestador, conciliadora, 3 cláusulas, monto y plazo                                                                        | 3       |
| A2    | Acuerdo de apoyo mínimo: sin cláusulas, sin conciliadora explícita, sin monto ni plazo                                                                              | 3       |
|       | **TOTAL**                                                                                                                                                          | **195** |

Lo real: Postgres, el cliente de Prisma, `createCase`/`updateCase` con sus reglas de negocio y su persistencia anidada, `mapCaseToPlaceholders`, `prepareTemplate`, Chromium.
Lo simulado: solo cookies/`revalidateTag`/`after()` de Next y el job de generación (que iría a Google Drive — **no se tocó Drive, ni Neon, ni Vercel**).

Sobre cada PDF se corrieron cuatro controles automáticos (placeholders sin resolver, artefactos de render, huecos `____`, y presencia literal de cada valor cargado en el formulario) más lectura manual de los documentos principales y verificación visual del render.

---

## 2. Resumen

| Severidad   | Hallazgos |
| ----------- | --------- |
| **Crítica** | 4         |
| **Alta**    | 6         |
| **Media**   | 5         |
| **Baja**    | 2         |

Dos resultados **positivos** que conviene dejar escritos, porque eran los sospechosos naturales y salieron limpios:

- **La persistencia escalar es correcta.** El round-trip "lo que mandó el wizard" vs. "lo que quedó en la fila de `Case`" dio **0 diferencias en los 8 casos**. Las ~230 columnas escalares, las 7 relaciones anidadas y las columnas `Json` se guardan bien. Los bugs de "campo que nunca se guardaba" de las rondas anteriores están efectivamente cerrados.
- **Las dos rutas de generación coinciden.** La automática (creación del caso, que pasa los `Decimal` de Prisma crudos) y la manual de `/documents` (que los convierte a `number` con `toNum`) producen **placeholders idénticos** y **HTML idéntico** en las 195 combinaciones. La asimetría de tipos entre rutas no cambia ningún documento.
- Tampoco se encontró **ningún** `NaN`, `undefined`, `null`, `[object Object]`, `Invalid Date`, entidad HTML sin decodificar, `{{llave}}` sin resolver ni fallo de resolución de CSS/imágenes en los 195 PDFs.

---

## 3. Hallazgos transversales

### T1 — Toda fecha ingresada por el operador se imprime un día antes (severidad: **crítica**)

**Archivos:** `src/features/case/actions.ts` (conversión a `Date`) + `src/features/document/placeholders/format.ts` (formateo).

**Medición.** De las 61 fechas cargadas en los 8 expedientes, **el día correcto no aparece en ningún documento**: en los 195 PDFs solo aparece el día anterior.

| Lo que se cargó             | Lo que imprime el PDF    | Documentos                                                   |
| --------------------------- | ------------------------ | ------------------------------------------------------------ |
| `filingDate` = 2026-02-11   | 10 de febrero de 2026    | `aceptacion-cargo`, `designacion-conciliador`                 |
| `admissionDate` = 2026-02-25| 24 de febrero de 2026    | `auto-admision`, `acuerdo-bilateral`, `fracaso-acuerdo-bilateral` |
| `firstHearingDate` = 2026-03-19 | 18 de marzo de 2026  | `auto-admision`, `acuerdo-pago`, `cyg-tramite`, `reforma-acuerdo`, `inasistencia-deudor`, `acuerdo-bilateral` |
| `debts[0].grantDate` = 2022-08-12 | 11/08/2022         | `solicitud-insolvencia`                                       |
| `debts[5].dueDate` = 2025-03-01 | **28 de febrero de 2025** | `solicitud-insolvencia`                                  |
| `fechaRadicacion` = 2026-02-18 (A1) | 17 de febrero de 2026 | `apoyo-acuerdo`, `apoyo-solicitud`, `apoyo-incumplimiento` |

**Mecanismo.** El `<input type="date">` manda `"2026-02-11"`. `createCase` hace `new Date("2026-02-11")`, que en JavaScript es **medianoche UTC**. Los helpers de `format.ts` formatean con `timeZone: 'America/Bogota'` (UTC-5), así que esa medianoche cae a las 19:00 del **día anterior**:

```js
new Date('2026-02-11').toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
// → '10/02/2026'
```

Afecta a `formatDate`, `formatShortDate`, `getDayNumber`, `getDayInWords`, `getMonthName` y `getYear` — es decir, a todo placeholder derivado de una fecha que haya tecleado el operador. Las fechas calculadas desde `nowColombia()` (la fecha de hoy) **no** se ven afectadas, porque son instantes reales y no medianoches UTC.

**Por qué no se notaba.** El comentario de `date-colombia.ts` documenta un bug previo de doble conversión (PR #43) que se arregló quitando el pre-shift de `nowColombia()`. Ese arreglo es correcto para "ahora", pero la otra mitad del problema —las fechas-solo-día guardadas como medianoche UTC— quedó intacta, y el golden master la fijó como comportamiento esperado.

**Impacto legal.** La fecha de audiencia, la de admisión, la de radicación y las de otorgamiento/vencimiento de cada crédito salen corridas en documentos que se radican ante juzgados y se notifican a acreedores.

---

### T2 — La Sección 2 de la Solicitud (las causas, bajo juramento) siempre dice "NO" (severidad: **crítica**)

**Archivos:** `src/app/cases/components/create-case-dialog.tsx:445`, `src/features/document/placeholders/case-lists.ts` (`mapCauses`), `src/features/case/validation-rules.ts` (`CAUSE_OPTIONS`).

**Evidencia (I1).** Se cargó `causes: ['Pérdida de empleo', 'Enfermedad', 'Otros']`. La fila 2 del PDF dice:

```
2    PERDIDA DE EMPLEO                                 NO
4    ENFERMEDAD                                        NO
```

Las 12 filas salen "NO" en los tres casos de insolvencia.

**Mecanismo: tres listas distintas para la misma pregunta.**

| Dónde                                            | Qué contiene                                                |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `create-case-dialog.tsx:445` (lo que se guarda)  | etiquetas en español: `'Pérdida de empleo'`                  |
| `validation-rules.ts` `CAUSE_OPTIONS` (canónica) | pares value/label: `{ value: 'PERDIDA_EMPLEO', label: … }`   |
| `case-lists.ts` `mapCauses` (lo que compara)     | valores de enum: `'PERDIDA_EMPLEO'`                          |

`mapCauses` hace `causes.includes('PERDIDA_EMPLEO')` sobre un array que contiene `'Pérdida de empleo'` → nunca coincide. El comentario del propio mapper (`// The form stores enum values, not display labels`) describe un contrato que el formulario no cumple.

Además, las etiquetas del wizard **ni siquiera coinciden con las de `CAUSE_OPTIONS`** (`'Falta de educación financiera'` vs. `'Falta de educación financiera y malos hábitos'`, `'Nuevos créditos para cubrir otros'` vs. `'Acudí a nuevos créditos para cubrir otros'`), así que tampoco serviría comparar por etiqueta.

**Efecto secundario, peor.** `CAUSA_12_DETALLE` cae a `causes.find(c => !causeValues.includes(c))`, o sea la primera causa marcada. Verificado en I2 (una sola causa, sin texto libre):

```
1   SOBREENDEUDAMIENTO POR FALTA DE RECURSOS          NO
…
12  OTROS ¿CUÁL? Sobreendeudamiento                   NO
```

El deudor declara bajo juramento que **no** se sobreendeudó, y en la casilla "otros" aparece la palabra "Sobreendeudamiento".

---

### T3 — Tres columnas `DateTime` que ninguna ruta de la app puede guardar (severidad: **crítica**)

**Archivos:** `src/features/case/actions.ts` (`createCase` ~L470, `updateCase` ~L925), `src/prisma/schema.prisma`.

`createCase` y `updateCase` convierten a `Date` una lista fija de 13 campos. En el modelo `Case` hay **16** columnas `DateTime?` que vienen del formulario. Faltan tres:

| Columna                 | Prisma      | ¿Se convierte? | Resultado                                                           |
| ----------------------- | ----------- | -------------- | ------------------------------------------------------------------- |
| `paymentStartDate`      | `DateTime?` | **no**         | `createCase`/`updateCase` fallan                                    |
| `agreementValidityDate` | `DateTime?` | **no**         | `createCase`/`updateCase` fallan                                    |
| `failureDate`           | `DateTime?` | **no**         | `createCase` falla                                                  |
| `admissionDate` (control) | `DateTime?` | sí           | ok                                                                  |

Reproducción aislada (un solo campo agregado a un payload que funciona):

```
[probe] control:                    success=true
[probe] paymentStartDate:           success=false   → "Invalid value for argument `paymentStartDate`: premature end of input. Expected ISO-8601 DateTime."
[probe] agreementValidityDate:      success=false   → mismo error
[probe] failureDate:                success=false   → mismo error
[probe] admissionDate (control):    success=true
```

**Consecuencia operativa — el Paquete 3 no se puede generar nunca.** `documents-section.tsx:150` abre el formulario previo si falta `approvalPercentage` **o** `agreementValidityDate`. Ese formulario (`pre-generation-form.tsx`) manda `agreementValidityDate` como `"2031-04-10"` a `updateCase` → Prisma lo rechaza → el dato nunca se guarda → la condición nunca se satisface → el botón "Generar documentos de acuerdo" vuelve a abrir el mismo formulario, indefinidamente.

`agreementValidityDate` y `paymentStartDate` **no tienen ningún otro punto de escritura en toda la app** (verificado por grep sobre `src/app` y `src/features`). `paymentStartDate` alimenta `FECHA_INICIO_PAGO`, `DIA_INICIO_PAGO`, `MES_INICIO_PAGO`, `ANO_INICIO_PAGO`, `DIA_INICIO`… que por eso salen siempre en blanco (visible en `sentido-voto`: "El deudor propone pagar a partir del ________________").

---

### T4 — Las casillas "Desconozco" del formulario de acreedores revientan la creación y dejan el expediente huérfano (severidad: **crítica**)

**Archivos:** `src/app/cases/components/create-case-dialog/creditors-detailed-section.tsx` (L215, L405, L442), `src/features/case/actions.ts` (~L683).

La sección de acreedores ofrece tres casillas "Desconozco" que escriben el literal `'DESCONOZCO'` en `interestRate`, `grantDate` y `dueDate`. El mapper está preparado para ellas (`placeholder-mapper.ts:324` → "Desconoce"; `format.ts:47` → "Desconoce"). La persistencia no:

```ts
interestRate: parseFloat(debt.interestRate || '0'),   // parseFloat('DESCONOZCO') → NaN
grantDate:    debt.grantDate ? new Date(debt.grantDate) : null,  // new Date('DESCONOZCO') → Invalid Date
```

Reproducción:

```
[probe] debt.interestRate = DESCONOZCO: success=false  caseRows=+1  debtRows=+0
[probe] debt.grantDate   = DESCONOZCO: success=false  caseRows=+1  debtRows=+0
[probe] debt.dueDate     = DESCONOZCO: success=false  caseRows=+1  debtRows=+0
```

**`caseRows=+1` es lo grave.** Las deudas se crean **después** y **fuera de transacción** (`prisma.case.create` y luego un `for` con `prisma.debt.create`). El operador ve un error, pero en la base queda un expediente **con número de radicado consumido y cero acreedores**. Si reintenta, crea otro. Con 12 acreedores y el séptimo marcado "Desconozco", quedan el caso y seis deudas.

---

### T5 — `updateCase` exige `debtorId` y `operatorId` aunque el esquema los declare opcionales (severidad: **alta**)

**Archivo:** `src/features/case/actions.ts` ~L925.

```ts
return tx.case.update({
  where: { id, tenantId },
  data: {
    ...safeRestUpdate,
    debtor:   { connect: { id: debtorId } },     // debtorId puede ser undefined
    operator: { connect: { id: operatorId } },   // idem
```

El `connect` es incondicional. En `updateCaseSchema` ambos son `.optional()`. Resultado: **cualquier** llamada a `updateCase` que no reenvíe esos dos ids falla.

Réplica exacta de los dos envíos de `pre-generation-form.tsx`:

| Escenario                                                        | Resultado | Causa                                     |
| ---------------------------------------------------------------- | --------- | ----------------------------------------- |
| Paquete 2, tal cual lo manda la pantalla (`id` + 3 fechas)        | **falla** | `connect` con id `undefined`              |
| Paquete 3, tal cual lo manda la pantalla (`id` + % + vigencia)    | **falla** | la fecha sin convertir (T3)               |
| Paquete 2 + `debtorId`/`operatorId`                               | ok        | —                                         |
| Paquete 3 + `debtorId`/`operatorId`                               | **falla** | la fecha sin convertir (T3)               |
| Solo `approvalPercentage` + ids                                   | ok        | —                                         |

O sea: el formulario "Datos requeridos para Admisión" falla por T5, y el de "Datos requeridos para Acuerdo" falla por T5 **y** por T3. Ninguno de los dos funciona hoy.

---

### T6 — El error crudo de Prisma, con todo el payload del deudor, se devuelve al navegador (severidad: **alta**, privacidad)

**Archivo:** `src/features/case/actions.ts` (catch final de `createCase`, ~L795).

```ts
return { success: false, error: error instanceof Error ? error.message : 'Error al crear el caso' };
```

El `message` de un `PrismaClientValidationError` es el volcado completo de la invocación. En la reproducción midió **2.371 caracteres** e incluía nombre completo, cédula, dirección, teléfono y correo de la deudora, los mismos datos del cónyuge, los seis acreedores con sus correos, las matrículas inmobiliarias y la placa del vehículo. Ese texto va al `toast` de la UI y a `console.error` (y por tanto a los logs estructurados).

Mismo patrón en el catch de `updateCase`.

---

### T7 — Listas que se guardan completas y llegan truncadas al documento (severidad: **alta**)

Los totales sí suman todo, con lo cual el documento queda **internamente inconsistente**: declara un total que no se corresponde con el detalle que lista.

| Lista                   | Guarda | Mapper produce                   | Plantilla imprime | Verificado con                                        |
| ----------------------- | ------ | -------------------------------- | ----------------- | ----------------------------------------------------- |
| Libranzas               | todas  | **solo la 1.ª** (`libranzas[0]`) | 1                 | I1: "Colpensiones" no aparece en ningún PDF           |
| Servicios suspendidos   | todas  | **solo el 1.º** (`services[0]`)  | 1                 | I1: "Vanti S.A. E.S.P." no aparece en ningún PDF      |
| Bienes inmuebles        | todos  | 5 (`INMUEBLE_1..5_*`)            | **1**             | I1: el lote de Soacha no aparece, pero sí suma al total |
| Procesos judiciales     | todos  | 5 (`PROCESO_1..5_*`)             | **2**             | I1: el 3.º no aparece; I3: solo 2 de 4                |
| Dependientes            | todos  | 5 (`OBL_ALIM_1..5_*`)            | **2**             | I3: "Blanca Ocampo de Villegas" no aparece            |
| Acreedores              | todos  | `{{#each ACREEDORES}}`           | todos ✅          | I3: los 12 salen bien                                 |
| Apoderados              | todos  | solo el principal (espejo)       | 1                 | I1: el 2.º y el 3.º no aparecen                       |

Caso concreto de inconsistencia (I1, Sección 4 de la Solicitud): se imprime **un** inmueble (el apartamento, $185.000.000) y el renglón "Bienes Inmuebles: **$ 233.000.000**", que incluye el lote de Soacha que nunca se lista.

Los acreedores ya están migrados a `{{#each}}` (`Solicitud de Insolvencia.html` y `CYG Tramite.html`). **El comentario de `buildInsolvencyContext` que dice "Por ahora ninguna plantilla lo consume" está desactualizado.**

---

### T8 — 66 de los 261 campos del formulario no los lee ningún mapper (severidad: **media**)

Barrido de los campos de `createCaseSchema` contra todo `src/features/document/`. Descontando los puramente internos (`phase`, `resultType`, `inadmissionDate`…), los que sí deberían llegar a un documento:

| Campo(s)                                                                                                   | Dónde se esperaría                                   |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `anexaSoporteIngresos`, `anexaExtractosBancarios`, `anexaCertificadosDeuda`, `anexaCertificadoTradicion`, `anexaRelacionProcesos`, `anexaDeclaracionRenta`, `anexaDocumentoIdentidad` | Sección 16 "ANEXOS" de la Solicitud |
| `legalFoundations`                                                                                         | Sección 15 "FUNDAMENTOS DE DERECHO"                  |
| `requestedFee`                                                                                             | Sección 14 "SOLICITUD SOBRE LA TARIFA"               |
| `propuestaPlazoMeses`, `propuestaPeriodicidadPago`, `propuestaTasaInteres`, `propuestaQuitaPromedio`, `propuestaObservaciones` | Sección 12 "PROPUESTA DE PAGO"      |
| `declaracionVeracidadInformacion`, `manifestacionBuenaFe`, `manifestacionNoOcultamientoBienes`, `declaracionNoOmisiones`, `declaracionConocimientoNorma`, `autorizacion*` (3) | juramentos de la Solicitud y del Check List |
| `cesacionPagos`, `fechaCesacionPagos`, `numeroAcreedoresActual`, `porcentajePasivoEnMora`, `procesosEjecutivosVigentes` | supuestos del art. 538, hoy texto fijo |
| `siccacNumber`, `expedienteNumero`, `expedienteAnio`, `ciudadRadicacion`, `conciliadorAsignado`             | encabezados de radicación                            |
| `applicantSignatureName`, `applicantSignatureId`                                                           | bloque de firma                                      |
| `owedCapital`, `paymentOrder`, `insuranceOffering`, `designatedOperator`, `attorney`, `notificationCity`    | varios                                               |
| `deudorOcupacion`, `deudorProfesion`, `deudorNitEmpleador`                                                 | datos del deudor                                     |

Las secciones 14, 15 y 16 existen en la plantilla pero con texto **fijo**: la 14 pide "fijar una tarifa" sin decir cuál, la 15 cita los artículos genéricos, y la 16 imprimió **"No se han adjuntado documentos aún"** pese a que los 7 `anexa*` estaban en `true` (la lista se arma de los `Document` subidos, no de las casillas).

---

### T9 — Las fechas de solicitud, citación y desistimiento de conciliación salen con la fecha en que se generó el PDF (severidad: **alta**)

**Archivo:** `src/features/document/placeholders/conciliacion.ts` L401-428.

```ts
DIA_SOLICITUD: (raw.concDiaSolicitud as string) || getDayNumber(now),
MES_SOLICITUD: (raw.concMesSolicitud as string) || getMonthName(now),
ANO_SOLICITUD: (raw.concAnoSolicitud as string) || getYear(now),
```

`concDiaSolicitud`, `concMesSolicitud`, `concAnoSolicitud` (y sus equivalentes `concDiaCitacion`, `concDiaDesistimiento`…) **no existen en el esquema ni en la UI** (verificado por grep en todo `src/`). El fallback se toma siempre.

Evidencia (C3, radicado el 2026-01-15, PDF generado el 2026-10-03):

> "…autoriza a Liliana Patricia Arango Mejía para que lleve a cabo la audiencia correspondiente al trámite de la conciliación **solicitado el día 3 de octubre de 2026**…"

El Informe Conciliador va al Ministerio de Justicia con la fecha equivocada, y la fecha correcta (`filingDate` / `fechaRadicacion`) sí está en la base.

---

### T10 — `noCoDebtor` y `otherDebtTypeDetail`: el formulario los acepta y la base no tiene columna (severidad: **media**)

`debtSchema` (`src/features/case/schemas.ts`) declara ambos; el modelo `Debt` de Prisma no los tiene y `createCase` no los mapea. Verificado leyendo la fila guardada: `hasNoCoDebtor=false`, `hasOtherDebtTypeDetail=false`.

Impacto real de `noCoDebtor`: `buildInsolvencyContext` lo lee para decidir entre `'N/A'` y `''` en los tres campos de codeudor, con el comentario *"en un documento legal no es lo mismo 'no aplica' que 'no se informó'"*. Como el dato nunca llega, la Solicitud imprime **celdas vacías** para los cuatro acreedores de I1 que declararon no tener codeudor. La rama `'N/A'` es inalcanzable en producción.

---

### T11 — Validación cruzada que sí pasó

- **Ruta automática vs. manual:** 0 diferencias de placeholders y 0 diferencias de HTML en las 195 combinaciones.
- **Round-trip de persistencia:** 0 diferencias en los 8 casos.
- **Assets:** ningún `CSS file not found` ni `Image file not found` en los 195 documentos (el fix B1/B2 de la auditoría de julio sigue en pie, incluidas conciliación y apoyo).
- **Sin artefactos de render:** cero `NaN`, `undefined`, `null`, `[object Object]`, `Invalid Date`, `&amp;` ni `{{…}}` sin resolver.

---

## 4. Hallazgos por plantilla

### 4.1 `Check List.html` — el documento no se puede generar nunca (severidad: **crítica**)

**Archivos:** `templates/insolvency/Check List.html`, `src/features/document/placeholder-mapper.ts` (`mapCheckList`, L57-180).

La plantilla usa `{{SI_PARAGRAFO_1}}`, `{{NO_PARAGRAFO_1}}`, `{{SI_PARAGRAFO_2}}`, `{{NO_PARAGRAFO_2}}`, `{{SI_PARAGRAFO_3}}`, `{{NO_PARAGRAFO_3}}`. **`mapCheckList` no produce ninguno de los seis.** Lo que sí produce y nadie usa: `SI_PC` / `NO_PC`.

En el PDF se lee literalmente, en la sección PARÁGRAFOS (confirmado visualmente):

```
Parágrafo 1. ¿Realiza manifestación de que no ha incurrido en omisiones…?   «FALTA: SI_PARAGRAFO_1»   «FALTA: NO_PARAGRAFO_1»
```

Pero en producción el documento **ni siquiera llega a generarse**, porque las dos rutas lo bloquean:

- automática (`generate-documents.ts` ~L638): corta si `unresolved.length > 0` → `status: 'error'`;
- manual (`actions.ts` ~L1042): `collectMissingData` devuelve los 6 → `status: 'skipped'`.

`check-list` tiene `generateOnCreate: true`, o sea que **falta en el Paquete 1 de todos los expedientes creados**. Reproducido en los tres casos de insolvencia.

### 4.2 `Solicitud de Insolvencia.html` — el documento más importante

| Sección | Qué pasa                                                                                                   | Severidad | Referencia |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| 2       | Las 12 causas salen "NO" y la causa marcada se filtra a "OTROS ¿CUÁL?"                                       | crítica   | T2         |
| 3       | Los acreedores salen completos y correctos (`{{#each}}`), pero las fechas de otorgamiento/vencimiento corridas un día, y los codeudores "no declarados" salen en blanco en vez de "N/A" | alta / media | T1, T10 |
| 4       | Solo se imprime el primer inmueble; el total sí incluye todos                                               | alta      | T7         |
| 5       | Solo los dos primeros procesos judiciales                                                                    | alta      | T7         |
| 6       | Solo la primera libranza                                                                                     | alta      | T7         |
| 7       | Solo el primer servicio suspendido                                                                           | alta      | T7         |
| 9       | Solo el total de gastos; el desglose de 7 categorías que captura el formulario no tiene fila en la plantilla | baja      | —          |
| 10      | Solo los dos primeros dependientes                                                                           | alta      | T7         |
| 12      | **La tasa ofrecida imprime siempre "0%"**: `PROP_TASA_MENSUAL`/`PROP_TASA_ANUAL` están **hardcodeados** a `'0%'` en `tablas-dinamicas-pagos.ts:214-215` (con comentario `// placeholder - needs to be calculated`), mientras el formulario captura `propuestaTasaInteres` | alta | — |
| 12      | La fecha del pago extraordinario se imprime **cruda en ISO** (`2026-12-15`) — `PROP_EXTRA_FECHA` pasa `extraordinaryPaymentDate` sin formatear (`tablas-dinamicas-pagos.ts:208`) | media | — |
| 13      | Sociedad conyugal: correcto, con nombre, cédula, dirección, teléfono y correo del cónyuge                     | ✅        | —          |
| 14      | Texto fijo; `requestedFee` nunca se imprime                                                                  | media     | T8         |
| 15      | Texto fijo; `legalFoundations` nunca se imprime                                                              | media     | T8         |
| 16      | Imprime "No se han adjuntado documentos aún" con los 7 `anexa*` en `true`                                   | media     | T8         |
| 17      | Correcto: usa `notificationAddress/Phone/Email` con fallback al deudor                                       | ✅        | —          |

### 4.3 `Acuerdo de Apoyo.html` — las cláusulas del acuerdo desaparecen (severidad: **crítica**)

**Archivos:** `src/features/document/placeholders/apoyo.ts` (L~120), `src/features/document/placeholders/escape.ts` (`escapeAllUnlessHtml`), `templates/support-agreements/Acuerdo de Apoyo.html:93-103`.

En A1 se cargaron 3 cláusulas, que se guardaron bien en la columna `apoyoClausulas`. El PDF imprime el encabezado y **nada debajo**:

```
CLÁUSULAS

ACUERDO SUSCRITO
El beneficiario y la persona de apoyo acuerdan que…
```

**Mecanismo.** `mapApoyoFields` mete el array en el mapa de placeholders con un cast:

```ts
CLAUSULAS_APOYO: clausulas as unknown as string,
```

pero `mapCaseToPlaceholders` termina pasando todo el mapa por `escapeAllUnlessHtml`, que llama a `escapePlaceholder(value)`, y este, ante un no-string, hace `String(value ?? '')`. El array se convierte en:

```
'[object Object],[object Object],[object Object]'
```

`{{#each CLAUSULAS_APOYO}}` recibe un string, `Array.isArray` da `false` y el bloque renderiza vacío. La conciliación no sufre esto porque sus arrays viajan por `extraContext` (`buildConciliationContext`), que no pasa por el escapado; `buildTemplateContext` devuelve `undefined` para `SUPPORT_AGREEMENT`.

Es una colisión entre el cast de `apoyo.ts` y el escapado OWASP de la Sesión 1 (P2), que es posterior.

**Segundo defecto en la misma plantilla (severidad: media).** `TIENE_CLAUSULAS_APOYO` vale la cadena `'SI'` o `'NO'`, y en `handlebars-lite` **toda cadena no vacía es verdadera** — `'NO'` incluido. Verificado en A2 (cero cláusulas): el encabezado "CLÁUSULAS" se imprime igual, seguido de nada.

**Tercer defecto (severidad: media).** `TP_CONCILIADORA_APOYO` y `CC_CONCILIADORA_APOYO` no tienen fallback: `NOMBRE_CONCILIADORA_APOYO` cae a `caseData.operator?.name`, pero la tarjeta profesional no cae a `caseData.operator.professionalCard` (que sí está en el `include` de generación, justamente por el hallazgo A6). En A2 el bloque de firma salió como `Conciliadora — C.C.  — T.P.`, con los dos valores vacíos.

**Cuarto (severidad: baja).** Sin `apoyoPlazoMeses` la fila imprime " meses" suelto y "Monto mensual acordado" queda en blanco, sin "N/A" ni línea.

### 4.4 `Informe Conciliador.html`

- La fecha de solicitud es la de generación del PDF → T9. **Severidad: alta.**
- `DESCRIPCION_RESULTADO` y `TIPO_CONSTANCIA_SOLICITADA` funcionan bien. El primero está dentro de `{{#if RESULTADO_OTRO}}`, y los flags `RESULTADO_*` dependen de que `concResultadoInforme` traiga los valores de enum (`INASISTENCIA_CONVOCADO`, etc.) que la UI sí manda — comportamiento correcto.

### 4.5 `Terminacion Anormal.html`, `Constancia Inasistencia.html`, `Constancia No Acuerdo.html`, `Auto Desistimiento Conciliacion.html`

Sin hallazgos propios. `DESCRIPCION_CAUSA_ANORMAL` vive dentro de `{{#if CAUSA_OTRA}}` y los flags se derivan correctamente de los valores de enum de la UI.

### 4.6 `Actas de Conciliacion/*` (General, Alimentos, Unión Marital, Disolución)

- Menores y cláusulas adicionales salen completos y en orden en C1 y C2 (el camino por `extraContext` funciona).
- Las fechas de audiencia salen corridas un día (T1); acá los documentos usan los componentes `DIA`/`MES`/`ANO` (sin cero a la izquierda), con el mismo desplazamiento.
- `conc-acta-disolucion-union` es la plantilla de peor cobertura de conciliación (66-72%) porque un acta de alimentos no llena los campos de disolución. Esperado: es la plantilla equivocada para ese caso, no un defecto.

### 4.7 `Auto admision del tramite.html`

El gate manual la bloquea cuando faltan `ZOOM_ID` / `ZOOM_CODIGO` / `ZOOM_LINK` (reproducido en I2 e I3, que no traen Zoom; I1 sí los trae y pasa). Es el comportamiento diseñado (C-3), pero conviene saber que **la admisión no se puede generar sin datos de Zoom**, cosa que la pantalla no anticipa: lo descubre el operador cuando el documento aparece como "skipped".

### 4.8 `Formatos Para Audiencias/Sentido Del Voto.html`

Formulario pensado para llenarse a mano en la audiencia (el acreedor escribe su nombre, apoderado, votación). Su 35% de cobertura es correcto por diseño. El único hueco que **no** es por diseño es "El deudor propone pagar a partir del ________________", que viene de `paymentStartDate` (T3).

---

## 5. Orden sugerido de ataque

| #   | Hallazgo                                           | Severidad | Esfuerzo estimado | Por qué primero                                                        |
| --- | -------------------------------------------------- | --------- | ----------------- | ---------------------------------------------------------------------- |
| 1   | T1 — fechas corridas un día                        | crítica   | ~3 h + golden     | Afecta a los 195 documentos de los tres trámites; arreglo centralizado  |
| 2   | T2 — causas siempre "NO"                           | crítica   | ~2 h              | Falsedad bajo juramento en el documento que se radica                   |
| 3   | T4 — "Desconozco" rompe la creación y deja huérfanos | crítica | ~2 h + transacción | Pérdida de datos y radicados consumidos                                 |
| 4   | T3 + T5 — el Paquete 3 no se puede generar          | crítica   | ~2 h              | Funcionalidad completa inaccesible                                      |
| 5   | 4.1 — Check List nunca se genera                   | crítica   | ~1 h              | Falta un documento del Paquete 1 en todos los expedientes               |
| 6   | 4.3 — cláusulas del Acuerdo de Apoyo               | crítica   | ~2 h              | Contenido legal ausente de un acuerdo firmado                           |
| 7   | T6 — fuga del payload en el error                  | alta      | ~1 h              | Privacidad; arreglo trivial                                             |
| 8   | T7 — listas truncadas                              | alta      | ~8 h              | Requiere migrar plantillas a `{{#each}}` (ya hay precedente)            |
| 9   | T9 — fechas de conciliación = fecha del PDF        | alta      | ~1 h              | —                                                                       |
| 10  | 4.2 §12 — tasa hardcodeada "0%"                    | alta      | ~1 h              | —                                                                       |
| 11  | T8 — campos capturados que no llegan a documentos  | media     | ~6 h              | Decisión de producto previa: cuáles deben imprimirse                    |
| 12  | T10 — `noCoDebtor` / `otherDebtTypeDetail`         | media     | ~2 h              | Necesita migración de BD                                                |

---

## 6. Cómo reproducir

```bash
docker run -d --name insolventic-verify-pg \
  -e POSTGRES_USER=insolventic_smoke -e POSTGRES_PASSWORD=insolventic_smoke -e POSTGRES_DB=insolventic_smoke \
  -p 127.0.0.1:54329:5432 postgres:16-alpine

export DATABASE_URL=postgresql://insolventic_smoke:insolventic_smoke@127.0.0.1:54329/insolventic_smoke
export DIRECT_URL=$DATABASE_URL
npx prisma db push --skip-generate
```

El harness (fixtures, runner, pruebas aisladas y scripts de revisión) quedó **fuera del repositorio**, en el scratchpad de la sesión, porque el encargo era verificar sin tocar código:

```
<scratchpad>/verify/   fixtures.ts, render.verify.test.ts, probes.verify.test.ts,
                       pregen.verify.test.ts, jest.verify.config.js, review.py, datecheck.js
<scratchpad>/final/    los 195 PDF, su HTML renderizado, su texto extraído,
                       placeholders.json por caso, report.json y review.json
```

Vale la pena incorporarlo a `tests/db/` como suite permanente: las cuatro familias de control (placeholders sin resolver, artefactos de render, round-trip de persistencia, y presencia de los valores cargados) son exactamente lo que ninguna suite actual cubre, y seis de los diez hallazgos críticos/altos los detecta sin intervención humana.

---

## 7. Límites de esta verificación

- **No se probó la subida a Drive** ni la ruta DOCX: la Fase 3 de cada ruta quedó fuera a propósito (el encargo excluía tocar Drive).
- **Los paquetes 2 a 5 se generaron sin su flujo previo**: los documentos de admisión, acuerdo y fracaso se renderizaron directamente, no después de transicionar la fase del expediente. Lo que se verifica es el contenido del documento, no la máquina de estados.
- **Un caso por variante**: 8 expedientes cubren las combinaciones principales (con/sin apoderado, con/sin cónyuge, 1/6/12 acreedores, 0/4/6 bienes, 0/3/4 procesos), no todas.
- **Los 13 subtipos de fracaso** se generaron con los datos de un expediente que no está en fracaso, así que sus placeholders específicos salen vacíos. Es esperable y no se contó como hallazgo.
