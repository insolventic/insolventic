# Pendientes de decisión legal

**Última actualización:** 2026-10-01

Lista única de las preguntas abiertas que **no las resuelve el equipo de
desarrollo**: dependen de la abogada o del cliente, y cada una bloquea algo
concreto. Existe porque hasta ahora estaban repartidas entre un checkpoint
fechado, tres documentos de plan y los cuerpos de varios PRs, y se venían
recitando de memoria en cada ronda.

**Convención:** cuando una se responda, se marca acá con la fecha y la
respuesta, y se actualiza el documento donde vive el detalle. Este archivo es
el índice, no la fuente de verdad de cada tema.

| #   | Pregunta                                                                                                                                              | Bloquea                                                                                                                              | Detalle en                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 1   | **SMMLV 2026 transitorio** (Decreto 0159): ¿hay fallo de fondo o decreto definitivo?                                                                  | El `TODO(legal)` de `validation-rules.ts`, y con él los umbrales de cuantía                                                          | `docs/CHECKPOINT_2026-09-28.md` §9                                    |
| 2   | **Check List — 3 párrafos sin resolver**                                                                                                              | Mover `mapCheckList` en la división del mapper (el Paso 2 lo evitó a propósito)                                                      | `docs/CHECKPOINT_2026-09-28.md` §5.3 · `docs/PLAN_DIVISION_MAPPER.md` |
| 3   | **Texto legal de "Fracaso por reforma del acuerdo"** (⓵ⓓ de #40)                                                                                      | El contenido de esa plantilla reclasificada, no su merge                                                                             | `docs/CHECKPOINT_2026-09-28.md` §9                                    |
| 4   | **Párrafo legal de comparendos** del vehículo (#11 de la ronda del formulario)                                                                        | Imprimir el dato que ya se captura                                                                                                   | `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`                     |
| 5   | **¿La Solicitud lista todos los acreedores o hay tope con anexo?**                                                                                    | Nada ya: los PR #77/#78/#79 se construyeron sobre la opción (1), **asumida**                                                         | `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md` §2                     |
| 6   | **Plazo de corrección tras nulidad: ¿días hábiles o corridos?**                                                                                       | El tamaño del scanner del issue #16 (~4 h en corridos; bastante más en hábiles, porque no hay calendario de festivos en el proyecto) | issue #16                                                             |
| 7   | **Acta de Disolución de Unión Marital cita la Ley 640 de 2001**, derogada por la 2220 de 2022, y no cita la vigente                                   | Corregir el fundamento normativo de esa plantilla                                                                                    | Auditoría del formulario de conciliación, hallazgo B2                 |
| 8   | **¿El Auto de Desistimiento y el Informe Conciliador deben citar norma?** Hoy no citan ninguna                                                        | Nada; es una pregunta de completitud                                                                                                 | Auditoría de conciliación, hallazgo B3                                |
| 9   | **¿La caducidad de tres meses debe ser una causal nombrada** de terminación anormal, o sigue cayendo en "OTRA" (texto libre)?                         | Agregar la opción al selector y el `{{#if}}` a la plantilla (~2 h)                                                                   | Auditoría de conciliación, hallazgo B4                                |
| 10  | **¿Qué es obligatorio en cada documento de conciliación?** Hoy las 12 plantillas no tienen ningún requisito declarado                                 | El PR 4 de la auditoría de conciliación (validación)                                                                                 | Auditoría de conciliación, hallazgo A2                                |
| 11  | **¿Qué rótulo va en el membrete de Armonía?** El tucán dice "Asociación para el Fomento…" y el sello dice "Centro de Conciliación Armonía Concertada" | El banner de encabezado del plan de branding                                                                                         | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §4                           |
| 12  | **¿Quién firma por Armonía?** Llegaron dos firmas y las plantillas tienen un hueco                                                                    | Si hacen falta uno o dos assets de firma                                                                                             | `docs/BRANDING_POR_CENTRO_2026-09-30.md` §4                           |
| 13  | **Apoderado del acreedor en el CYG**: ¿debe imprimirse o se sigue llenando a mano en la audiencia?                                                    | Si hay que agregar la columna a `Debt` y el campo al formulario                                                                      | Este documento, §1                                                    |

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
