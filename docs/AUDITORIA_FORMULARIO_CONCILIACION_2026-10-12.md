# Auditoría del formulario maestro de conciliación contra sus plantillas

**Fecha de la auditoría:** 2026-10-12. **Actualizado:** 2026-10-17 (dos veces
el mismo día, dos ramas distintas): primero con lo que cierra
`fix/conciliacion-formulario` (Zoom + C-2, interino de C-1a), y después con lo
que cierra `fix/conciliacion-columnas-fechas` (PR hacia `dev`) — las 11
columnas nuevas de C-1a (de fondo, no interino) y C-1c completo. Ver §2 y §5.1.
**Alcance:** las 12 plantillas de `templates/conciliation/` contra el
formulario maestro (`conciliation-parties-section.tsx`,
`conciliation-details-section.tsx`), los schemas Zod, `schema.prisma` y
`src/features/document/placeholders/conciliacion.ts`.
**Modo:** solo lectura en la auditoría original; las dos actualizaciones de
2026-10-17 reflejan cambios ya hechos y verificados, no propuestas.

**Por qué existe este documento.** `docs/PENDIENTES_DECISION_LEGAL.md` (fila 7)
citaba una *"Auditoría del formulario de conciliación, hallazgo B2"* que **no
existía como archivo en ninguna rama** — verificado con
`git log --all --diff-filter=A -- 'docs/*CONCILIA*'`, que no la encuentra. El
trabajo se había hecho —de él salió el ítem 7 de ese documento— pero sus
resultados nunca se escribieron. Este archivo cierra esa referencia colgada
(la corrección exacta está en §6).

---

## 1. Resumen

**No hay placeholders huérfanos del lado plantilla→mapper.** Las 12 plantillas
usan 136 placeholders distintos y `conciliacion.ts` produce los que le
corresponden (el resto —`CENTRO_*`, `LOGO_*`, `ZOOM_*`, `NUMERO_TRAMITE`,
`DIA_/MES_/ANO_/HORA_AUDIENCIA`, `CIUDAD`, `ANO_ACTUAL`— los produce el mapper
base o el membrete, no este archivo). Evidencia: el golden
`tests/unit/documents/golden/render-hashes.json` guarda por plantilla ×
escenario los placeholders sin resolver (campo `u`); las entradas
`CONCILIATION/` tienen `u` vacío, y
`tests/unit/documents/conciliacion-formulario-cobertura.test.ts` (nuevo, esta
rama) lo confirma con un test que lee el código en cada corrida.

El hueco estaba en la dirección contraria: **el mapper producía la clave y
detrás no había campo que la llenara, o había campo y no había input.** Entre
las dos ramas de 2026-10-17 se cerraron 4 de los 6 grupos de hallazgos de la
auditoría original.

| ID | Sev | Hallazgo | Estado hoy |
| ---- | --- | ---------------------------------------------- | --- |
| C-1a | 🔴 | Fechas históricas que imprimían **hoy** | 🟢 **Cerrado de fondo** — 3 columnas `DateTime` reales, no interino |
| C-1c | 🟡 | Caen a vacío y dejan hueco en la frase | 🟢 **Cerrado** — 8 columnas reales (Aclaración + referencias + desistimiento) |
| C-3 | 🟠 | Zoom sin capturar; Convocatoria sin enlace | 🟢 **Cerrado** |
| C-2 | 🟠 | Columna + Zod listos, faltaba el input | 🟢 **Cerrado** (5 de 5) |
| C-1b | 🟡 | Caen a `____` visible (unión/disolución) | ⚪ **Sin cambios** — es una decisión de diseño, no un bug |
| C-4 | 🔵 | Columnas muertas | 🔴 **Abierto** — identificadas, no borradas |

---

## 2. C-1a — Fechas históricas que imprimían "hoy" — 🟢 CERRADO DE FONDO

**El hallazgo más grave de la auditoría original.** Diez placeholders de fecha
**histórica** (algo que ya ocurrió) caían a
`getDayNumber/getMonthName/getYear(now)` cuando no había columna que los
respaldara. Cada Aclaración de Acta, Acta de Alimentos, Constancia de No
Acuerdo, Auto Desistimiento, Informe Conciliador y Terminación Anormal salía
afirmando que la solicitud, la citación o el desistimiento ocurrieron **hoy**,
sin que nada en el PDF lo advirtiera.

**Paso 1 — interino** (rama `fix/conciliacion-formulario`, commit `658686e`):
los 10 placeholders pasaron a un blanco visible (`____`/`____________`/
`______`/`____ de ____________ de ______`), mismo patrón que
`DIA_/MES_/ANO_INICIO_UNION`, mientras no hubiera columna propia. Dejó de
imprimirse una fecha falsa; seguía sin poderse capturar la fecha real.

**Paso 2 — de fondo** (rama `fix/conciliacion-columnas-fechas`, 2026-10-17):
tres columnas `DateTime?` nuevas en `Case` —
`concFechaSolicitud`/`concFechaCitacion`/`concFechaDesistimiento`,
migración `20261017000000_add_conciliacion_fechas_reales_y_aclaracion`,
aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`, nullable, sin default) —
con su input (`<input type="date">`, fieldset "Fechas reales del trámite" en
`ConciliationDetailsSection`), su Zod
(`fechaHistoricaOpcional`: fecha de calendario real, no futura) y su lectura
en el mapper:

```
DIA_/MES_/ANO_SOLICITUD, FECHA_SOLICITUD   <- concFechaSolicitud
DIA_/MES_/ANO_CITACION                     <- concFechaCitacion
DIA_/MES_/ANO_DESISTIMIENTO                <- concFechaDesistimiento
```

Mismos helpers de zona horaria que ya usan `DIA_AUDIENCIA`/`DIA_FRACASO`
(`getDayNumber`/`getMonthName`/`getYear`/`formatDateComplete`, todos sobre
`America/Bogota` vía `displayTimeZone`, independientes del `TZ` del proceso —
fijado con un test que corre bajo `TZ=UTC` y `TZ=America/Bogota` y da el mismo
resultado en los dos). Con dato, imprime la fecha real; sin dato, sigue en el
mismo blanco visible del paso 1 — nunca la fecha de hoy.

Persistencia: `createCase`/`updateCase` (`actions.ts`) extraen las 3 de `rest`
ANTES del spread genérico de `conc*`/`apoyo*` (PR #89) y las pasan por
`parseDateOnly` — igual que `filingDate` y las demás fechas procesales. Sin
esto, el string `"YYYY-MM-DD"` del input viajaría sin convertir y Postgres lo
rechazaría para una columna `DateTime` ("premature end of input"). Agregadas
también a `CAMPOS_CON_VALOR_AUDITABLE` (son fechas procesales, no datos de la
persona) y a la conversión `Date → YYYY-MM-DD` de `pickTypeSpecificFields`
(sin ella, editar un caso con la fecha ya guardada la mostraba en blanco).

**`DIA_/MES_/ANO_CONSTANCIA` sigue sin tocar**, a propósito: ahí "hoy" es
correcto — es la fecha de **expedición** del documento, no la de un hecho
pasado.

**Verificado contra Postgres real**
(`tests/db/conciliacion-fechas-reales.db.test.ts`): ciclo crear → editar →
leer para las 3 fechas (junto con los 8 campos de C-1c, §5.1) — 3 tests, 3
pasan.

**Golden master:** cambios confinados a `CONCILIATION/` en los dos pasos —
19 claves en el paso 1, 9 claves de placeholders (3-4 escenarios) + 22 hashes
de render (6 plantillas) en el paso 2. 0 cambios fuera de conciliación en
ninguno de los dos, verificado con diff de claves. `basica`/`varios-menores`/
`xss` pasan del blanco interino a una fecha real porque el fixture
(`fill: 'full'`) ahora puebla las 3 columnas nuevas como cualquier otra
columna real; `con-fechas`/`sin-fechas` prueban explícitamente la rama "hay
valor" y "sin valor".

---

## 3. C-3 — Los 3 campos de Zoom — 🟢 CERRADO

`zoomLink`/`zoomMeetingId`/`zoomPassword` ya existían en `schema.prisma` y en
los tres Zod (`createCaseFormSchema`, `updateCaseFormSchema`, `caseSchema`)
desde antes de esta auditoría, y el mapper ya producía
`ZOOM_ID`/`ZOOM_CODIGO`/`ZOOM_LINK` con fallback a `''`
(`placeholder-mapper.ts:519-521`, sin tocar en esta rama). Faltaba el input:
sin él, `Notificacion de Convocatoria.html` —la citación que se envía al
convocado— salía siempre con el bloque "DATOS INGRESO REUNIÓN ZOOM" vacío, y
quien recibía la citación no podía entrar a la audiencia virtual.

**Cerrado** (commit `c601c5f`): nuevo fieldset "Audiencia virtual (Zoom)" en
`ConciliationDetailsSection`, justo después de "Asunto y Cuantía". Tres
inputs, etiquetas en español:

| Campo | Etiqueta | Tipo |
| --- | --- | --- |
| `zoomMeetingId` | ID de la reunión | texto |
| `zoomPassword` | Código de acceso | texto |
| `zoomLink` | Enlace de la reunión | `url` |

`ConciliationDetailsSection` es compartida por `create-case-dialog` y
`edit-case-dialog` (ambos la importan del mismo archivo), así que los tres
quedan disponibles en los dos flujos sin tocar ninguno de los dos diálogos. Y
como no llevan el prefijo `conc*`, en la edición pasan por
`GENERAL_SCALAR_FIELDS` (`general-fields.ts`) — la lista genérica de columnas
que ya se persisten sin enumerarlas a mano.

**Verificado que la plantilla los imprime**
(`tests/unit/documents/notificacion-convocatoria-zoom.test.ts`): renderiza
`Notificacion de Convocatoria.html` con los tres datos puestos y confirma que
el PDF los imprime; y que sin ellos el documento se genera igual, con el
bloque vacío pero sin placeholders sin resolver.

---

## 4. C-2 — Los 5 campos con columna y Zod listos — 🟢 CERRADO (5 de 5)

| Campo | Placeholder | Plantilla |
| --- | --- | --- |
| `concApoderadoConvocanteDireccion` | `DIRECCION_APODERADO_CONVOCANTE` | Solicitud de Audiencia |
| `concApoderadoConvocanteCiudad` | `CIUDAD_APODERADO_CONVOCANTE` | Solicitud de Audiencia |
| `concFechaNacimiento` | `FECHA_NACIMIENTO_SOLICITANTE` | Solicitud de Audiencia |
| `concHoraProgramada` | `HORA_PROGRAMADA` | Terminación Anormal |
| `concTipoConstanciaSolicitada` | `TIPO_CONSTANCIA_SOLICITADA` | Informe Conciliador |

**Cerrado** (commit `48a620e`):

- **Dirección/Ciudad del Apoderado del Convocante** → van en el fieldset ya
  existente "Apoderado del Convocante" de `ConciliationPartiesSection`. De
  paso se le agregó `htmlFor`/`id` a todo el fieldset: tenía una
  inconsistencia preexistente con su hermano "Apoderado del Convocado" (que
  sí los tenía), y sin eso ningún campo del fieldset era accesible por su
  etiqueta — se corrigió completo, no solo los 2 campos nuevos.
- **Fecha de nacimiento** → fieldset nuevo, "Solicitante — Datos
  Adicionales". El resto de los datos del solicitante (nombre, id, dirección,
  correo, celular) **no tiene fieldset propio a propósito**: el
  convocante/solicitante **es** el deudor por diseño y el mapper los deriva
  de ahí (`conciliacion.ts:157-165`); agregar inputs duplicaría la captura
  con el formulario del deudor. La fecha de nacimiento es la única excepción
  porque `Debtor` no tiene una columna equivalente. `type="text"`, **no**
  `type="date"`: la columna es `String?` y el mapper la imprime tal cual, sin
  `formatDate` — un selector de fecha guardaría `"1990-03-15"` y el documento
  saldría con eso en vez de una fecha en español.
- **Hora programada de la audiencia** → fieldset "Causa de Terminación
  (anormal)", antes del selector de causa: el párrafo que la usa describe la
  audiencia tal como se citó, no la causa de por qué terminó anormalmente.
- **Tipo de constancia solicitada** → fieldset "Resultado del Informe".
  Texto libre, no un `Select`: el documento la inserta tal cual en la frase
  ("se solicita expedir [esto]"), así que tiene que quedar gramaticalmente
  correcta.

**Persisten en crear Y en editar** sin tocar `edit-case-dialog.tsx` ni
`type-specific-fields.ts`: los 5 llevan el prefijo `conc*`, así que ya pasan
por el mecanismo genérico de esos campos (PR #89) tanto al cargar el
`reset()` como al armar el `submitData`.

**Verificado contra Postgres real**
(`tests/db/conciliacion-formulario.db.test.ts`): ciclo crear → editar → leer
para los 8 campos de este hallazgo y del anterior (3 Zoom + 5 C-2) — (1) crear
con un valor y leer, (2) editar a otro valor y leer (confirma que `updateCase`
**actualiza**, no solo acepta), (3) editar sin reenviarlos y confirmar que
**no se borran por omisión** — el mismo patrón del hallazgo de
`pre-generation-form`. 3 tests, 3 pasan contra Postgres 16 real.

---

## 5. Lo que se resolvió después, y lo que sigue sin resolverse

### 5.1 🟢 C-1c — Los 8 campos de Aclaración de Acta, referencias y desistimiento — CERRADO

`CAMPO_CON_ERROR`, `DESCRIPCION_ERROR`, `VALOR_INCORRECTO`, `VALOR_CORRECTO`
caían a cadena vacía: la Aclaración de Acta se generaba pero **no decía qué se
estaba aclarando**. `NUMERO_ACTA_UNION_REF`/`NUMERO_TRAMITE_UNION_REF` (qué
acta/trámite de unión se disuelve o aclara) y
`TIPO_SOLICITANTE_DESISTIMIENTO`/`NOMBRE_APODERADO_DESISTIMIENTO` (quién
desiste) tenían el mismo problema. A diferencia de lo que decía la versión
original de esta sección, esto no quedó fuera de alcance para siempre: era
"no son 4 columnas, son 8, y agregarlas es cambio de schema" — y el cambio de
schema es exactamente lo que hizo la rama `fix/conciliacion-columnas-fechas`
(2026-10-17), junto con las 3 de C-1a (§2, misma migración
`20261017000000_add_conciliacion_fechas_reales_y_aclaracion`).

**Cerrado:** 8 columnas `String?` reales, con su input (fieldsets "Aclaración
de Acta", "Referencias del Acta de Unión" y "Desistimiento" en
`ConciliationDetailsSection`) y su lectura directa en el mapper
(`raw.concCampoConError` y hermanas — sin helpers de fecha, son texto plano).
Persisten en crear y editar por el mismo mecanismo genérico `conc*`/`apoyo*`
que C-2 (§4) — no necesitaron tocar `actions.ts` como las 3 fechas de C-1a.

**Lo que esta migración NO incluye, a propósito:** las fechas de unión,
declaración de unión y disolución (C-1b, §5.2) — es una decisión de diseño
previa, pendiente de la abogada, no parte de este cierre — ni las 5 columnas
muertas de C-4 (§5.3).

**Verificado contra Postgres real**, junto con las 3 fechas de C-1a — ver §2.

### 5.2 ⚪ C-1b — Fechas de unión marital / disolución

`DIA_/MES_/ANO_INICIO_UNION`, `_DECLARACION_UNION`, `_DISOLUCION` caen a
`____`/`____________`/`______`. **Esto no es un bug a cerrar**: es una
decisión de diseño de antes de esta rama (nunca cayeron a "hoy", a diferencia
de C-1a) y sin columna propia tampoco hay nada que capturar sin tocar el
schema. Significa que **las actas de unión marital y de disolución siempre
salen con sus fechas en blanco** — hay que saberlo antes de prometer que "el
sistema genera el acta" para esos dos casos, pero no es un defecto nuevo ni
uno que esta rama debiera cerrar.

### 5.3 🔵 C-4 — Columnas muertas

5 columnas (`concNombreMenor`, `concNumeroClausula`,
`concNumeroClausulaAdicional`, `concTextoClausula`,
`concTextoClausulaAdicional`) son los singulares legacy de lo que hoy son
arreglos JSON (`concMenoresAlimentos`, `concClausulasAcuerdo`,
`concClausulasAdicionales*`). El formulario escribe solo los arreglos, y los 6
usos de esos singulares en las plantillas están **todos** dentro de un
`{{#each}}`, que resuelve desde el ítem, no desde el escalar global — sus
defaults nunca llegan a un documento. Misma clase que `rejection`/`withdrawal`
(borradas en una rama anterior) y `Creditor`/`Asset`/`LegalProcess`
(borrados): existen, no se escriben, no se leen.

**No se borraron en esta rama** porque borrar una columna, aunque esté
confirmada como muerta, es un cambio de schema — fuera de alcance explícito
(NO TOUCH). Quedan identificadas con su razón en el inventario de pendientes;
borrarlas (con la misma verificación previa en producción que se hizo para
los 3 modelos del Quick Win 5) es trabajo de una rama que sí toque el schema.

### 5.4 El guardián nuevo

`tests/unit/documents/conciliacion-formulario-cobertura.test.ts` reemplaza la
necesidad de repetir esta auditoría a mano: lee las 12 plantillas, el mapper y
el formulario del disco en cada corrida, y exige que el inventario de
pendientes coincida exactamente con lo que el código de ese momento diga. Si
alguien cierra uno de los pendientes de §5.2/§5.3 y no lo borra de la lista,
el test falla por "ya no está roto"; si aparece un hueco nuevo, falla por
"apareció algo".

---

## 6. Corrección de la referencia colgada

`docs/PENDIENTES_DECISION_LEGAL.md`, fila 7, columna "Detalle en".

**Antes:**
```
Auditoría del formulario de conciliación, hallazgo B2 · este documento, §3
```

**Después:**
```
`docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md` · este documento, §3
```

El "hallazgo B2" no existía en ningún archivo del repo bajo ese nombre; el
único "B2" real es de `AUDITORIA_MODULO_GENERACION_2026-07.md:24`
(resolución de rutas en `inlineAssets`), que es otro tema. La cita colgada
apunta ahora a este documento.

**Y la aclaración de alcance que iba junto con la corrección** (columna
"Bloquea" de la misma fila): la cita a la Ley 640 de 2001 que ese ítem rastrea
**no está en ninguna plantilla de conciliación** — está en 2 plantillas de
insolvencia (`Acuerdo de Pago Tramite.html:169`, `Acuerdo Bilateral
Tramite.html:164`, ambas artículo 14) y 1 de `support-agreements`
(`Constancia de Incumplimiento Acuerdo de Apoyo.html:75`, artículo 2°). Esta
auditoría del formulario de conciliación es **donde se encontró** el patrón
original (la cuarta cita, en `Acta Disolucion Union Marital.html`, ya se
corrigió el 2026-10-02 — ítem 7, §3.1 de `PENDIENTES_DECISION_LEGAL.md`), no
donde viven las 3 que faltan.

La aplicación de esta corrección (la edición real de
`PENDIENTES_DECISION_LEGAL.md`) va en su propio commit, separado de este
documento.
