# Auditoría del formulario maestro de conciliación contra sus plantillas

**Fecha de la auditoría:** 2026-10-12. **Actualizado:** 2026-10-17, con lo que
cierra la rama `fix/conciliacion-formulario` (PR hacia `dev`, ver §5).
**Alcance:** las 12 plantillas de `templates/conciliation/` contra el
formulario maestro (`conciliation-parties-section.tsx`,
`conciliation-details-section.tsx`), los schemas Zod, `schema.prisma` y
`src/features/document/placeholders/conciliacion.ts`.
**Modo:** solo lectura en la auditoría original; la actualización de 2026-10-17
refleja cambios ya hechos y verificados, no propuestas.

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
detrás no había campo que la llenara, o había campo y no había input.** Esta
rama cerró 3 de los 6 grupos de hallazgos de la auditoría original.

| ID | Sev | Hallazgo | Estado hoy |
| ---- | --- | ---------------------------------------------- | --- |
| C-1a | 🔴 | Fechas históricas que imprimían **hoy** | 🟢 **Cerrado (interino)** — ahora en blanco visible |
| C-3 | 🟠 | Zoom sin capturar; Convocatoria sin enlace | 🟢 **Cerrado** |
| C-2 | 🟠 | Columna + Zod listos, faltaba el input | 🟢 **Cerrado** (5 de 5) |
| C-1c | 🟡 | Caen a vacío y dejan hueco en la frase | 🔴 **Abierto** — Aclaración de Acta, 4 campos |
| C-1b | 🟡 | Caen a `____` visible (unión/disolución) | ⚪ **Sin cambios** — es una decisión de diseño, no un bug |
| C-4 | 🔵 | Columnas muertas | 🔴 **Abierto** — identificadas, no borradas |

---

## 2. C-1a — Fechas históricas que imprimían "hoy" — 🟢 CERRADO (interino)

**El hallazgo más grave de la auditoría original.** Diez placeholders de fecha
**histórica** (algo que ya ocurrió) caían a
`getDayNumber/getMonthName/getYear(now)` cuando no había columna que los
respaldara. Cada Aclaración de Acta, Acta de Alimentos, Constancia de No
Acuerdo, Auto Desistimiento, Informe Conciliador y Terminación Anormal salía
afirmando que la solicitud, la citación o el desistimiento ocurrieron **hoy**,
sin que nada en el PDF lo advirtiera.

**Cerrado en esta rama** (`src/features/document/placeholders/conciliacion.ts`,
commit `658686e`): los 10 pasan a un blanco visible, mismo patrón que
`DIA_/MES_/ANO_INICIO_UNION`:

```
DIA_/MES_/ANO_SOLICITUD
DIA_/MES_/ANO_CITACION
DIA_/MES_/ANO_DESISTIMIENTO
FECHA_SOLICITUD
```

`FECHA_SOLICITUD` no tenía **ningún** fallback — era `formatDate(now)` a
secas, sin `||`. Como es una fecha compuesta (no día/mes/año separados), el
blanco quedó en `____ de ____________ de ______`: mismo largo que los otros
tres juntos y mismo formato que produce `formatDate` cuando sí hay dato.

**`DIA_/MES_/ANO_CONSTANCIA` no se tocó**, a propósito: ahí "hoy" es correcto
— es la fecha de **expedición** del documento, no la de un hecho pasado. Es el
contraste que el propio archivo ya tenía, usando el mismo default para dos
cosas distintas.

**Por qué "interino" y no "resuelto".** Los 10 placeholders siguen sin columna
propia (`concDiaSolicitud`, `concFechaSolicitud`, etc. no existen en
`schema.prisma`) — agregarla está fuera de alcance de esta rama (NO TOUCH
schema/migraciones). El cierre fue cambiar el *default* de "hoy" (dato falso)
a blanco (dato ausente visible); la solución de fondo —la columna y su input—
sigue en el inventario de pendientes (§4).

**Golden master:** 19 claves cambiaron, las 19 dentro de `CONCILIATION/` — 0
cambios fuera de conciliación, verificado con diff de claves (no solo `git
diff`). El detalle completo está en el commit; el resumen por escenario:

| Escenario | Qué cambia |
| --- | --- |
| `conciliacion-basica`, `conciliacion-sin-fechas`, `conciliacion-varios-menores`, `conciliacion-xss` | Los 10 campos pasan de la fecha simulada del test a los blancos `____`/`____________`/`______` / `____ de ____________ de ______` |
| `conciliacion-con-fechas` | Solo `MES_DESISTIMIENTO` (el resto de ese escenario ya mandaba las fechas explícitas, que no pasan por el default) |

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

## 5. Lo que NO se resolvió en esta rama, y por qué

### 5.1 🟡 C-1c — Los 4 campos de la Aclaración de Acta

`CAMPO_CON_ERROR`, `DESCRIPCION_ERROR`, `VALOR_INCORRECTO`, `VALOR_CORRECTO`
caen a cadena vacía: la Aclaración de Acta se genera pero **no dice qué se
está aclarando**. A diferencia de C-1a/C-2/C-3, esto no es un input
faltante nada más — son 4 columnas que **no existen** en `schema.prisma`, y
agregarlas está fuera de alcance de esta rama (NO TOUCH schema/migraciones).
Queda en el inventario de pendientes (`PENDIENTES_POR_CAMPO` en
`conciliacion-formulario-cobertura.test.ts`), con su razón documentada ahí.

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
alguien cierra uno de los pendientes de §5.1/§5.3 y no lo borra de la lista,
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
