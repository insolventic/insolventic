# Pendientes de decisión legal

**Última actualización:** 2026-10-08 (ítem 2 parcialmente resuelto)

Lista única de las preguntas abiertas que **no las resuelve el equipo de
desarrollo**: dependen de la abogada o del cliente, y cada una bloquea algo
concreto. Existe porque hasta ahora estaban repartidas entre un checkpoint
fechado, tres documentos de plan y los cuerpos de varios PRs, y se venían
recitando de memoria en cada ronda.

**Convención:** cuando una se responda, se marca acá con la fecha y la
respuesta, y se actualiza el documento donde vive el detalle. Este archivo es
el índice, no la fuente de verdad de cada tema.

| #   | Pregunta                                                                                                                                                                                                                     | Bloquea                                                                                                                              | Detalle en                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | **SMMLV 2026 transitorio** (Decreto 0159): ¿hay fallo de fondo o decreto definitivo?                                                                                                                                         | El `TODO(legal)` de `validation-rules.ts`, y con él los umbrales de cuantía                                                          | `docs/CHECKPOINT_2026-09-28.md` §9                                         |
| 2   | 🟡 **PARCIAL 2026-10-08** — Check List, Parágrafo 3: ¿qué cuenta como "informado" entre "tiene soporte de obligaciones" y "manifiesta que no las posee"?                                                                    | El Check List sigue sin poderse generar (bloqueado por `SI`/`NO_PARAGRAFO_3`); mover `mapCheckList` en la división del mapper        | `docs/CHECKPOINT_2026-09-28.md` §5.3 · `docs/PLAN_DIVISION_MAPPER.md` · este documento, §4 |
| 3   | **Texto legal de "Fracaso por reforma del acuerdo"** (⓵ⓓ de #40)                                                                                                                                                             | El contenido de esa plantilla reclasificada, no su merge                                                                             | `docs/CHECKPOINT_2026-09-28.md` §9                                         |
| 4   | **Párrafo legal de comparendos** del vehículo (#11 de la ronda del formulario)                                                                                                                                               | Imprimir el dato que ya se captura                                                                                                   | `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`                          |
| 5   | **¿La Solicitud lista todos los acreedores o hay tope con anexo?**                                                                                                                                                           | Nada ya: los PR #77/#78/#79 se construyeron sobre la opción (1), **asumida**                                                         | `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md` §2                          |
| 6   | **Plazo de corrección tras nulidad: ¿días hábiles o corridos?**                                                                                                                                                              | El tamaño del scanner del issue #16 (~4 h en corridos; bastante más en hábiles, porque no hay calendario de festivos en el proyecto) | issue #16                                                                  |
| 7   | 🟢 **RESUELTO 2026-10-02** (Acta de Disolución) — citaba la Ley 640 de 2001, derogada por la 2220 de 2022; corregida. **Sigue abierto**: la misma cita en dos plantillas de insolvencia y una de support-agreements (ver §3) | Corregir el fundamento normativo de esas 3 plantillas restantes                                                                      | Auditoría del formulario de conciliación, hallazgo B2 · este documento, §3 |
| 8   | **¿El Auto de Desistimiento y el Informe Conciliador deben citar norma?** Hoy no citan ninguna                                                                                                                               | Nada; es una pregunta de completitud                                                                                                 | Auditoría de conciliación, hallazgo B3                                     |
| 9   | **¿La caducidad de tres meses debe ser una causal nombrada** de terminación anormal, o sigue cayendo en "OTRA" (texto libre)?                                                                                                | Agregar la opción al selector y el `{{#if}}` a la plantilla (~2 h)                                                                   | Auditoría de conciliación, hallazgo B4                                     |
| 10  | **¿Qué es obligatorio en cada documento de conciliación?** Hoy las 12 plantillas no tienen ningún requisito declarado                                                                                                        | El PR 4 de la auditoría de conciliación (validación)                                                                                 | Auditoría de conciliación, hallazgo A2                                     |
| 11  | **¿Qué rótulo va en el membrete de Armonía?** El tucán dice "Asociación para el Fomento…" y el sello dice "Centro de Conciliación Armonía Concertada"                                                                        | El banner de encabezado del plan de branding                                                                                         | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §4                                |
| 12  | **¿Quién firma por Armonía?** Llegaron dos firmas y las plantillas tienen un hueco                                                                                                                                           | Si hacen falta uno o dos assets de firma                                                                                             | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §4                                |
| 13  | **Apoderado del acreedor en el CYG**: ¿debe imprimirse o se sigue llenando a mano en la audiencia?                                                                                                                           | Si hay que agregar la columna a `Debt` y el campo al formulario                                                                      | Este documento, §1                                                         |

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
