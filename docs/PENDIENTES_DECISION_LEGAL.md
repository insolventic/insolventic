# Pendientes de decisión legal

**Última actualización:** 2026-10-10 (ítem 7: investigado y NO tocado — §3.0 explica por qué no es un cambio de cita, con las dos preguntas ya concretas)

Lista única de las preguntas abiertas que **no las resuelve el equipo de
desarrollo**: dependen de la abogada o del cliente, y cada una bloquea algo
concreto. Existe porque hasta ahora estaban repartidas entre un checkpoint
fechado, tres documentos de plan y los cuerpos de varios PRs, y se venían
recitando de memoria en cada ronda.

**Convención:** cuando una se responda, se marca acá con la fecha y la
respuesta, y se actualiza el documento donde vive el detalle. Este archivo es
el índice, no la fuente de verdad de cada tema.

| #   | Pregunta                                                                                                                                                                                                                       | Bloquea                                                                                                                              | Detalle en                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | **SMMLV 2026 transitorio** (Decreto 0159): ¿hay fallo de fondo o decreto definitivo?                                                                                                                                           | El `TODO(legal)` de `validation-rules.ts`, y con él los umbrales de cuantía                                                          | `docs/CHECKPOINT_2026-09-28.md` §9                                                         |
| 2   | 🟡 **PARCIAL 2026-10-08** — Check List, Parágrafo 3: ¿qué cuenta como "informado" entre "tiene soporte de obligaciones" y "manifiesta que no las posee"?                                                                       | El Check List sigue sin poderse generar (bloqueado por `SI`/`NO_PARAGRAFO_3`); mover `mapCheckList` en la división del mapper        | `docs/CHECKPOINT_2026-09-28.md` §5.3 · `docs/PLAN_DIVISION_MAPPER.md` · este documento, §4 |
| 3   | **Texto legal de "Fracaso por reforma del acuerdo"** (⓵ⓓ de #40)                                                                                                                                                               | El contenido de esa plantilla reclasificada, no su merge                                                                             | `docs/CHECKPOINT_2026-09-28.md` §9                                                         |
| 4   | **Párrafo legal de comparendos** del vehículo (#11 de la ronda del formulario)                                                                                                                                                 | Imprimir el dato que ya se captura                                                                                                   | `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`                                          |
| 5   | **¿La Solicitud lista todos los acreedores o hay tope con anexo?**                                                                                                                                                             | Nada ya: los PR #77/#78/#79 se construyeron sobre la opción (1), **asumida**                                                         | `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md` §2                                          |
| 6   | **Plazo de corrección tras nulidad: ¿días hábiles o corridos?**                                                                                                                                                                | El tamaño del scanner del issue #16 (~4 h en corridos; bastante más en hábiles, porque no hay calendario de festivos en el proyecto) | issue #16                                                                                  |
| 7   | 🟢 **RESUELTO 2026-10-02** (Acta de Disolución) — citaba la Ley 640 de 2001, derogada por la 2220 de 2022; corregida. **Sigue abierto**: la misma cita en dos plantillas de insolvencia y una de support-agreements, NINGUNA de conciliación (ver §3)   | Corregir el fundamento normativo de esas 3 plantillas restantes                                                                      | `docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md` (donde se encontró el patrón) · este documento, §3                 |
| 8   | 🟢 **RESUELTO 2026-10-09** — ¿El Auto de Desistimiento y el Informe Conciliador deben citar norma? **Sí: una referencia genérica**, sin artículos ni decretos. Aplicado también a la Aclaración de Acta                        | Nada — implementado                                                                                                                  | Este documento, §6.1                                                                       |
| 9   | 🟢 **RESUELTO 2026-10-09** — ¿La caducidad de tres meses debe ser una causal nombrada? **No**: sigue cayendo en "OTRA" (texto libre)                                                                                           | Nada — se decidió no implementarlo                                                                                                   | Este documento, §6.2                                                                       |
| 10  | 🟢 **RESUELTO 2026-10-09** — ¿Qué es obligatorio en cada documento de conciliación? **Nada**: decisión expresa de no exigir campos mínimos                                                                                     | Nada — el PR 4 de validación queda descartado, no pendiente                                                                          | Este documento, §6.3                                                                       |
| 11  | 🟢 **RESUELTO 2026-10-10** (`#132`→`#135`) — llegaron todos los datos. No había contradicción tucán/sello: **rótulo** "Centro de Conciliación", **nombre** "Armonía Concertada" y **entidad promotora** "Asociación para el Fomento…" son tres campos distintos y los tres van. Resolución **0858 del 01-nov-2016**, una sola para los dos roles | Nada — implementado. Armonía genera **63 de 65** plantillas con su propio membrete y branding | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §6 · `src/lib/membrete-centro.ts` |
| 12  | 🟢 **RESUELTO 2026-10-10** (`#134`, `#135`) — **Beatriz Helena Malavera**, operadora de insolvencia de los **dos** centros. Hacía falta **un** asset de firma, no dos: Maximiliano firma solo `Designacion del Conciliador.html`, que se dejó intacta a propósito | Nada — implementado | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §4 · `#134` |
| 13  | 🟢 **RESUELTO 2026-10-09** — Apoderado del acreedor en el CYG: **debe detectarse desde el registro de poderes**, y ante discrepancia con el acta **bloquear la generación**, no elegir una fuente por defecto                  | El diseño, que está **pendiente de aprobación** antes de escribir código                                                             | Este documento, §1 y §6.6                                                                  |
| 14  | 🔴 **NUEVO 2026-10-10** — **¿A qué cuenta consigna el deudor en un trámite de Armonía?** Hacen falta las tres cosas juntas: entidad, NIT y número de cuenta. De Constructores es "ASOCIACION LONJA… NIT. 830.122.178-7 cuenta corriente BANCOLOMBIA No. 2061 399 5617" | **Lo único que le falta a Armonía.** Bloquea 2 plantillas: `Auto Solicitud por Incumplimiento` y `Auto Solicitud Reforma del Acuerdo`. Las otras 63 generan | `src/lib/membrete-centro.ts` (`cuentaConsignacion`) · `#133` |
| 15  | 🔴 **NUEVO 2026-10-27** — **El umbral de 1000 SMMLV sobre bienes del Check List no se calcula.** La plantilla pregunta «Si es PC, valor de los bienes reportados (≤ 1000 SMMLV)», pero `mapCheckList` resuelve `SI_VALOR_BIENES`/`NO_VALOR_BIENES` mirando solo si hay bienes con valor mayor que cero: no compara contra ningún umbral. Hace falta decidir si la casilla debe afirmar el tope y, en ese caso, qué se suma (¿todos los bienes, o solo los del pequeño comerciante?) | La casilla afirma hoy algo distinto de lo que pregunta. No bloquea la generación | `src/features/document/placeholder-mapper.ts` (`mapCheckList`) · `templates/insolvency/Check List.html` |

---

## 1. El apoderado del acreedor en el CYG (ítem 13)

Anotado el 2026-10-01, al revisar los PDF de la cadena #77/#78/#79.

La plantilla `CYG Tramite.html` tiene una columna **APODERADO (nombre,
identificación, correo y teléfono)** en la tabla de acreedores, y sale vacía en
todas las filas.

**No es un defecto.** `Debt` no tiene ningún campo de apoderado en Prisma, y el
código lo deja vacío a propósito desde antes de la cadena, con el comentario que
lo explica:

```ts
// Apoderado info for CYG template (filled at hearing, empty by default)
result[`AC${idx}_APODERADO`] = '';
```

El builder nuevo (`buildInsolvencyContext`) hace exactamente lo mismo
(`APODERADO: ''`), así que el comportamiento es **idéntico antes y después** de
la migración a `{{#each}}`. Por eso no bloqueó ese merge.

**La pregunta abierta** es de producto, no de código: si el centro quiere que
ese dato salga impreso, hace falta una columna nueva en `Debt`, su campo en el
formulario de acreedores y el mapeo — alrededor de 4 h. Si se sigue llenando a
mano durante la audiencia, no hay nada que hacer y conviene dejarlo dicho para
que no se vuelva a levantar como bug en la próxima revisión de PDF.

> 🟢 **RESUELTO el 2026-10-09.** La abogada respondió, y la respuesta es más
> exigente que las dos opciones que estaban planteadas: el dato **sí** debe
> imprimirse, detectándolo desde el registro de poderes, con edición manual del
> conciliador — y **cuando el registro de poderes y el acta de la audiencia no
> coincidan, el sistema no debe elegir una fuente por defecto: debe detectar la
> discrepancia y bloquear la generación** hasta que el conciliador la resuelva.
>
> Eso convierte el ítem en algo más grande que "agregar una columna a `Debt`":
> hay dos fuentes de verdad que pueden contradecirse y un flujo de resolución
> que el conciliador tiene que poder operar. **El diseño está pendiente de
> aprobación y no se escribió código todavía** — ver §6.6.

---

## 2. Lo que NO está acá

Pendientes que dependen de otra cosa, no de una decisión legal:

- **Verificar las 29 columnas `conc_*` contra producción real** — depende de
  acceso a Neon. Ya se consultó el 2026-10-01 para otro tema; queda por hacer
  con el método de `information_schema.columns`.
- **Aislar Preview con su propio branch de Neon**, y la **prueba real de subida
  a Drive** — son tuyas.
- **Revisión del PDF renderizado con 1, 3, 15 y 50 acreedores** — hecha el
  2026-10-01, maquetación aprobada.

---

## 3. La misma cita a la Ley 640 de 2001, en otras tres plantillas (ítem 7)

Anotado el 2026-10-02, en una auditoría transversal formulario → plantillas.
Actualizado el mismo día: la parte de conciliación (Acta de Disolución) ya
quedó corregida — ver abajo —, con el visto bueno de la abogada confirmado
antes de este documento. Las otras tres citas **siguen sin respuesta** y no
se tocan.

### 3.1 Resuelto — Acta de Disolución de Unión Marital (conciliación)

Citaba _"los artículos 75 y siguientes de la Ley 23 de 1991 y 65 de la Ley
446 de 1998, Ley 640 de 2001 y sus decretos reglamentarios"_ — la única de
las 4 actas de disolución/unión marital que no citaba la Ley 2220 de 2022.
Corregida para igualar el texto, ya vigente, de su hermana directa
`Acta Union Marital.html` (misma cola "y demás normas concordantes y
pertinentes"): ahora cita _"...Ley 446 de 1998 y Ley 2220 de 2022 y sus
decretos reglamentarios..."_.

### 3.0 Investigación del 2026-10-10: por qué esto NO es un cambio de cita

Se intentó cerrar el ítem 7 y **no se tocó ninguna de las tres plantillas**. La
razón, que antes estaba planteada como sospecha ("no se puede asumir que el mismo
criterio aplique"), ahora está medida: **en los dos casos cambió la sustancia, no
solo la numeración.** Un reemplazo de cita produciría una cláusula que dice algo
distinto de lo que dice hoy, en documentos que se radican.

**Verificado primero el inventario** (2026-10-10): las tres citas están
exactamente en las líneas que indica este documento, y un barrido de
`templates/` confirma que **no hay una cuarta**.

**Hecho normativo confirmado:** la Ley 640 de 2001 fue derogada por el
**artículo 146 de la Ley 2220 de 2022**, con efecto desde el **30 de diciembre de
2022**. Buena parte de su contenido se recogió en el nuevo estatuto, pero **no
artículo por artículo**.

| Cita de hoy                     | Sucesor en la Ley 2220      | Qué cambió además del número                                                                                                                                                                                                                 |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **art. 14** (registro del acta) | **Sin equivalente 1:1**     | El registro pasó de ser **ante el centro, en 2 días**, a estar **en cabeza del conciliador ante el Ministerio de Justicia, en 3 días** (art. 30). Lo relacionado se reparte además en el art. 64 (contenido del acta) y el art. 66 (archivo) |
| **art. 2°** (constancias)       | **art. 65** ("Constancias") | **Los numerales 1 y 2 están invertidos**: inasistencia era el 2 y ahora es el 1; no acuerdo era el 1 y ahora es el 2. Y para el no acuerdo la constancia pasa a expedirse **de inmediato**                                                   |

**Por eso no alcanza con cambiar el número de ley.** En el caso del art. 14, la
cláusula de registro describe _un mecanismo_ (quién registra, ante quién, en qué
plazo) que la norma nueva cambió; actualizar la cita sin reescribir la cláusula
dejaría un texto que remite a un procedimiento que ya no es el que la cláusula
describe. En el del art. 2°, conservar un numeral al cambiar de ley apuntaría al
supuesto equivocado.

> **Advertencia de alcance.** Esto es investigación normativa hecha por el equipo
> de desarrollo para que la decisión de la abogada sea de una sola pasada. **No
> es asesoría legal** y no reemplaza su criterio: hay reglas de transición para
> trámites iniciados antes del 30/12/2022 que no se revisaron, y conviene
> confirmar el texto en el Diario Oficial (No. 52.081) o el Gestor Normativo.

**Las preguntas, ahora concretas y respondibles:**

1. **Acuerdo de Pago / Acuerdo Bilateral** (cláusula de registro): ¿la cláusula
   debe **reescribirse** para describir el registro vigente (conciliador ante el
   Ministerio, 3 días), **borrarse** por remitir a un trámite que ya no existe
   como tal, o **dejarse** porque el registro en la práctica sigue operando como
   la cláusula dice?
2. **Constancia de Incumplimiento Acuerdo de Apoyo**: ¿se cita el **art. 65 de la
   Ley 2220** —y en ese caso con qué numeral, si corresponde alguno—, o
   corresponde otra norma? Pregunta previa: un acuerdo de apoyo se rige por la
   **Ley 1996 de 2019**, no por el estatuto de conciliación. ¿Las reglas de
   constancias de conciliación aplican a la constancia de incumplimiento de un
   acuerdo de apoyo, o esa cita estuvo mal desde el principio por remitir a un
   régimen ajeno?

### 3.2 Sin resolver — cláusula de registro en dos plantillas de insolvencia

La cláusula de registro del acuerdo — _"sólo se surtirán una vez se haya procedido
a su registro en los términos que contempla el artículo 14 de la ley 640 del
2001"_ — aparece idéntica en dos plantillas de insolvencia, cada una en su propia
cláusula de "CLÁUSULAS VARIAS":

- `templates/insolvency/Tipo de Acuerdo/Acuerdo de Pago Tramite.html:169`
- `templates/insolvency/Tipo de Acuerdo/Acuerdo Bilateral Tramite.html:164`

En ambas, el resto del documento cita correctamente el régimen vigente (CGP /
Ley 2445 de 2025 — arts. 538, 539, 550, 553, 556, 558, 560, Decreto 1069 de
2015, Decreto 2677 de 2012), así que esta cláusula de registro quedó atrás del
resto del texto. Pregunta abierta: ¿corresponde actualizarla a la norma
vigente, o la referencia al art. 14 de la Ley 640/2001 sigue aplicando en la
práctica por alguna remisión que el registro todavía usa? Distinta de la cita
del §3.1: no es la cláusula general de conciliabilidad (arts. 75 Ley 23/1991 +
65 Ley 446/1998), sino una cláusula de registro propia del acuerdo de
insolvencia — no se puede asumir que el mismo criterio de corrección aplique
sin confirmarlo.

### 3.3 Sin resolver — hallazgo nuevo, no capturado hasta ahora: support-agreements

Al hacer un barrido completo de `templates/` (las tres subcarpetas, incluida
`support-agreements`, que no estaba cubierta por la auditoría original),
apareció una cuarta cita, distinta de las otras tres:

- `templates/support-agreements/Constancia de Incumplimiento Acuerdo de Apoyo.html:75`
  — _"de acuerdo con lo establecido en el artículo 2° de la Ley 640 de 2001 y
  demás normas concordantes."_

Cita un artículo distinto (el 2°, no el 14) y un documento de naturaleza
distinta (constancia de incumplimiento de un acuerdo de apoyo, no un acta ni
un acuerdo de pago). Misma pregunta de fondo que 3.2: ¿corresponde actualizar
a la Ley 2220/2022, o esa remisión puntual del art. 2° sigue vigente en la
práctica? Sin respuesta — no se toca.

---

## 4. Check List — Parágrafo 3 (ítem 2)

Anotado el 2026-10-08, al resolver los otros dos párrafos del mismo hallazgo
(§5.3 de `CHECKPOINT_2026-09-28.md`). Los Parágrafos 1 y 2 ya se wirearon —
`SI`/`NO_PARAGRAFO_1` sale de `declaracionNoOmisiones` (campo limpio del
formulario) y `SI`/`NO_PARAGRAFO_2` queda fijo en `SI` (es texto fijo que la
Solicitud imprime siempre, no una declaración condicional). El Parágrafo 3
queda **a propósito sin wirear** — `mapCheckList` no produce
`SI_PARAGRAFO_3`/`NO_PARAGRAFO_3`, y el Check List sigue bloqueado por esos
dos placeholders sin resolver.

**La pregunta exacta**, tal como la imprime la plantilla
(`templates/insolvency/Check List.html:192`):

> Parágrafo 3. Informa si tiene soporte de obligaciones o manifestación de
> que no las posee

**Por qué no hay campo limpio.** El texto describe una disyunción entre dos
situaciones distintas del deudor — "tiene el soporte documental de sus
obligaciones" o, alternativamente, "manifiesta que no lo tiene" — y el
formulario no captura ninguna de las dos por separado:

- No hay una casilla de "adjunto/no adjunto soporte de obligaciones" en
  ninguna sección del wizard (la Sección de Declaraciones solo tiene las dos
  casillas que ya alimentan los Parágrafos 1 y 2 más otras no relacionadas con
  esto).
- No hay tampoco una casilla de "manifiesto que no tengo soporte" — y aunque
  la hubiera, el texto del Parágrafo exige poder distinguir "SÍ tiene
  soporte" de "SÍ manifestó que no lo tiene" de "no contestó nada", que son
  tres estados, no dos.
- Los documentos adjuntos del expediente (`caseData.documents`) tampoco
  sirven como proxy limpio: no hay un tipo de documento en el catálogo que
  corresponda específicamente a "soporte de obligaciones" distinto de los
  certificados de deuda u otros adjuntos ya tipados para otros fines.

Inventar una regla acá —por ejemplo, "SI si el caso tiene al menos un
documento adjunto"— sería una decisión de criterio legal disfrazada de
decisión técnica: no hay forma de derivarla del dato sin asumir qué cuenta
como "informar" en el sentido del Parágrafo. Por eso se deja como estaba.

**Lo que haría falta para resolverlo**, una vez la abogada responda:

1. Si la respuesta es "basta con que el deudor declare una de las dos cosas":
   agregar la(s) casilla(s) correspondiente(s) a la Sección de Declaraciones
   del formulario (mismo patrón que `declaracionNoOmisiones`), ~1 h.
2. Si la respuesta depende de los documentos adjuntos reales: definir qué tipo
   de documento cuenta como "soporte de obligaciones" en el catálogo de
   adjuntos y derivar el placeholder de ahí, alcance mayor (toca
   `document-requirements.ts` y el catálogo de tipos).

No se puede estimar cuál de las dos hasta que haya respuesta.

---

## 5. Datos de membrete de Armonía (ítem 11)

Anotado el 2026-10-08, al construir la infraestructura de branding por centro
(PR de `feat/branding-por-centro`). Esa infraestructura resolvió la parte
**técnica**: los assets de imagen ahora se eligen por `tenantId` desde
`templates/branding/{centro}/` y un test guardián falla en CI si a un centro le
falta un archivo. Lo que **no** resolvió, a propósito, es el texto.

**El bloqueante concreto.** El nombre del centro no viaja solo en las
plantillas. Está pegado a su resolución de habilitación:

> El Centro de Conciliación y Arbitraje **CONSTRUCTORES DE PAZ**, aprobado por
> Resolución 1459 del 05 de septiembre de 2003 del Ministerio de Justicia y del
> Derecho, autoriza a…
> — `templates/conciliation/Informe Conciliador.html:25-26`

Reemplazar **solo** el nombre por un placeholder dejaría los documentos de
Armonía afirmando que Armonía está habilitada por la resolución del otro centro.
Hoy el documento es consistentemente del centro equivocado; con el swap parcial
sería un documento que afirma algo falso sobre la habilitación de un centro, y
se radica ante juzgados. Es estrictamente peor, así que no se hizo.

> **Corrección del 2026-10-10.** Acá decía: «El sello de Armonía menciona
> "Resolución 656/2016", que no es la misma». **Era falso, y por un error de
> transcripción propio**, no por una discrepancia en el material de Armonía: el
> sello dice **858/2016**, la misma resolución que el membrete oficial. El
> «656» salió de una lectura equivocada de la imagen anotada en
> `BRANDING_POR_CENTRO_2026-09-30.md:58`, y de ahí se propagó acá como si
> fueran dos documentos en conflicto. No hay conflicto: Armonía tiene **una
> sola** resolución, la 0858 del 01 de noviembre de 2016, y cubre los dos roles
> (centro de conciliación y operador de insolvencia). El detalle de la medición
> está en `BRANDING_POR_CENTRO_2026-09-30.md` §2.1.

**Lo que hace falta para completar el swap**, todo dato real, nada que el
equipo de desarrollo pueda derivar:

| Dato                            | Por qué                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| Nombre legal exacto del centro  | ~~El propio material de Armonía se contradice (tucán vs. sello)~~ → 🟢 no se contradecía; ver la corrección de arriba. Resuelto: "Armonía Concertada" |
| Número y fecha de la resolución | Va en la misma oración que el nombre, en ~12 plantillas       |
| Dirección                       | Aparece en encabezados y en el bloque de notificaciones       |
| Teléfono                        | Ídem                                                          |

**Alcance cuando los datos lleguen:** ~65 plantillas mencionan al centro por
nombre (texto impreso y `alt` de imágenes). El trabajo es mecánico una vez que
los cuatro datos estén confirmados: un sub-mapper nuevo con los textos por
tenant, el mismo patrón que `branding.ts` ya usa para los assets.

> **Nota aparte, del mismo origen:** `templates/insolvency/Designacion del
Conciliador.html` usa `Firma abogado.jpg` (`alt="Firma Director"`), una firma
> **distinta** de la que usan las otras 54 plantillas. No se unificó con
> `FIRMA_OPERADOR_SRC` porque cambiaría quién firma ese documento — es el
> ítem 12 de la tabla ("¿Quién firma por Armonía?"), que vale también para
> Constructores.

---

## 6. Las 6 preguntas de conciliación — respondidas el 2026-10-09

Llegaron juntas, de la abogada. **Cinco se cierran sin pendientes**; una (§6.6)
abre trabajo de diseño. Se transcribe la respuesta de cada una porque varias
cierran discusiones que se venían reabriendo en cada ronda de revisión.

### 6.1 Fundamento normativo de tres plantillas (ítem 8) — ✅ implementado

> **Respuesta:** agregar una referencia genérica al **"Estatuto de Conciliación
> (Ley 2220 de 2022)"** en las tres, **sin citar artículos ni decretos
> específicos**.

Alcance mayor que la pregunta original: la pregunta era por el Auto de
Desistimiento y el Informe Conciliador; la respuesta cubre también la
**Aclaración de Acta**. Las tres no citaban ninguna norma (verificado: cero
coincidencias de `ley`, `artículo` o `decreto` en los tres archivos).

Texto agregado, un párrafo por documento, en el lugar donde corresponde el
fundamento:

| Plantilla                              | Texto                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Aclaracion Acta de Conciliacion.html` | "La presente aclaración se expide con fundamento en el Estatuto de Conciliación (Ley 2220 de 2022)." |
| `Auto Desistimiento Conciliacion.html` | "El presente auto se expide con fundamento en el Estatuto de Conciliación (Ley 2220 de 2022)."       |
| `Informe Conciliador.html`             | "El presente informe se rinde con fundamento en el Estatuto de Conciliación (Ley 2220 de 2022)."     |

La redacción exacta de esas tres frases la escribió el equipo de desarrollo
sobre la instrucción "referencia genérica"; **si la abogada prefiere otra
formulación, es un cambio de una línea por plantilla.** Cada inserción lleva un
comentario HTML que dice de dónde viene la decisión, para que nadie la "mejore"
agregando artículos.

Verificado con el golden master: cambian **12 claves** (3 plantillas × 4
escenarios de conciliación) y **ninguna otra**; `u` sin cambios, porque no se
agregó ningún placeholder.

**No confundir con el ítem 7**, que sigue abierto: ese es la cita a la **Ley 640
de 2001** —derogada— que todavía está en dos plantillas de insolvencia y una de
support-agreements (§3). Son plantillas distintas y un problema distinto:
corregir una cita equivocada, no agregar una que falta.

### 6.2 Causal de caducidad de tres meses (ítem 9) — sin cambio de código

> **Respuesta:** el artículo existe (art. 60, Ley 2220 de 2022) y dice lo que se
> tenía entendido, **pero no se agrega como opción estructurada**: sigue
> cayendo en "Otra", en texto libre.

Es un **no** deliberado, no un "todavía no". El hallazgo B4 de la auditoría de
conciliación queda cerrado: no hay que agregar la opción al selector ni el
`{{#if}}` a la plantilla.

### 6.3 Documentos obligatorios por trámite (ítem 10) — decisión deliberada

> **Respuesta:** **no exigir campos mínimos.** El sistema sigue permitiendo
> generar un acta vacía.

Queda escrito como **decisión, no como deuda**. Hoy las 12 plantillas de
conciliación no declaran ningún requisito, y eso es lo que la abogada quiere: la
responsabilidad de que un acta esté completa es del conciliador, no del sistema.

El **PR 4 de la auditoría de conciliación** (la capa de validación) queda
**descartado**, no pendiente. Si en una revisión futura aparece "el sistema
permite generar un acta vacía" como hallazgo, la respuesta está acá: es
intencional desde el 2026-10-09.

### 6.4 Tarifa de honorarios — sin cambio de código

> **Respuesta:** el texto fijo actual queda igual **para todos los casos**, sin
> ajuste por la situación económica del deudor.

Se refiere a la sección 14 ("SOLICITUD SOBRE LA TARIFA") de la Solicitud, que
hoy tiene texto fijo y pide "fijar una tarifa" sin decir cuál — ver
`docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md` §14. Cerrado: no hay que
parametrizar nada.

### 6.5 Ejemplo de actas "más profesionales" — sin acción

> **Respuesta:** no hay una referencia disponible, así que no se hace nada por
> ahora.

Cerrado por falta de insumo, no por decisión de diseño. Si más adelante aparece
un modelo de referencia, se reabre.

### 6.6 Apoderado del acreedor en el CYG (ítem 13) — requiere diseño

> **Respuesta:** cuando el **registro de poderes** y lo que dice el **acta de la
> audiencia** no coincidan, el sistema **no debe elegir una fuente por
> defecto** — debe **detectar la discrepancia y bloquear la generación** hasta
> que el conciliador la resuelva manualmente, en vez de generar con una fuente
> arbitraria.

Es la única de las seis que abre trabajo. Y es más exigente que las dos opciones
que estaban planteadas en §1 ("imprimirlo" vs. "llenarlo a mano"): hay **dos
fuentes de verdad que pueden contradecirse**, y hace falta un flujo para que el
conciliador decida cuál vale.

Es coherente con la decisión que ya se tomó para el membrete por centro
(`#126`): **antes un error visible que un documento con un dato arbitrario**,
cuando el documento se radica ante un juzgado.

**Estado: propuesta de diseño pendiente de aprobación.** No se escribió código.
