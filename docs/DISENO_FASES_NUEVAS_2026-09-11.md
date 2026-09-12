# Diseño de fases nuevas del expediente — INSOLVENTIC

**Fecha:** 2026-09-11
**Estado:** ✅ **Diseño aprobado. NO implementado.**
**Alcance:** modelo de fases del expediente de insolvencia, sus transiciones y los documentos que genera cada una.

> Este documento es la **fuente de verdad** del diseño. Sustituye a la conversación en la que se elaboró.
> Las decisiones de contenido jurídico las confirmaron el cliente y su abogado; aquí se registran, no se interpretan.

**Antes de implementar hacen falta dos cosas, en este orden:**

1. Mergear **PR #4** (`fix/semana-3-logica-negocio`). Todo esto toca `src/lib/case-phases.ts`, la pieza central de ese PR.
2. Arrancar la Fase 1 de inspección sobre esa base.

---

## 1. Resumen

El modelo pasa de **8 a 13 fases**. Se añaden **5**:

| Fase nueva | Qué resuelve |
| --------------------- | ----------------------------------------------------------------------- |
| **Rechazo** | Una solicitud rechazada de entrada no es un fracaso de la negociación |
| **Retiro** | El solicitante se retira **antes** de la admisión |
| **Desistimiento** | El deudor abandona el trámite **después** de admitido y notificado |
| **Acuerdo impugnado** | Hay una impugnación pendiente ante el juez |
| **Acuerdo reformado** | El juez ordena corregir el acuerdo y se corrige dentro del plazo |

**El defecto que corrige:** hoy todos estos desenlaces terminan en `Fracaso` y generan el **mismo paquete de documentos**, que jurídicamente no corresponde. Un rechazo de entrada y una negociación fracasada requieren papeles distintos.

---

## 2. Fases y transiciones

| Fase | | Llega desde | Sale hacia |
| ------------------------ | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Inicial** | inicio | — | Admisión, **Rechazo**, **Retiro** |
| **Admisión** | | Inicial | En negociación, **Desistimiento** |
| **En negociación** | | Admisión, Audiencia programada | Audiencia programada, Acuerdo aprobado, **Desistimiento**, Fracaso |
| **Audiencia programada** | | En negociación | Acuerdo aprobado, En negociación, **Desistimiento**, Fracaso |
| **Acuerdo aprobado** | | En negociación, Audiencia programada | Post-acuerdo, **Acuerdo impugnado**, Fracaso |
| **Acuerdo impugnado** | 🆕 | Acuerdo aprobado | Post-acuerdo ⓐ, **Acuerdo reformado** ⓑ |
| **Acuerdo reformado** | 🆕 | Acuerdo impugnado | Post-acuerdo ⓒ, Terminado ⓓ |
| **Post-acuerdo** | | Acuerdo aprobado, Acuerdo impugnado ⓐ, Acuerdo reformado ⓒ | Terminado, Fracaso |
| **Fracaso** | | En negociación, Audiencia programada, Acuerdo aprobado, Post-acuerdo | Terminado |
| **Rechazo** | 🆕 | Inicial | Terminado |
| **Retiro** | 🆕 | Inicial | Terminado |
| **Desistimiento** | 🆕 | Admisión, En negociación, Audiencia programada | Terminado |
| **Terminado** | final | Post-acuerdo, Fracaso, Rechazo, Retiro, Desistimiento, Acuerdo reformado ⓓ | — |

```
Inicial ──┬──► Admisión ──► En negociación ⇄ Audiencia programada ──► Acuerdo aprobado
          ├──► Rechazo ──► Terminado                                        │
          └──► Retiro  ──► Terminado                                        │
                  │              │                    │                     │
                  └──────────────┴────────────────────┴──► Desistimiento ──► Terminado
                                 └────────────────────┴──► Fracaso ───────► Terminado

Acuerdo aprobado ──► Acuerdo impugnado ──┬─ⓐ─► Post-acuerdo
                                         └─ⓑ─► Acuerdo reformado ──┬─ⓒ─► Post-acuerdo
                                                                   └─ⓓ─► Terminado
                                                                         ⟵ liquidación: fuera de alcance
```

### 2.1 Cambios sobre el modelo actual

- **Se elimina `Inicial → Fracaso`.** Un trámite que nunca se admitió no puede fracasar: el fracaso solo existe después de notificar e intentar negociar.
- **Se elimina `Admisión → Fracaso`.** Por la misma razón.
- `Terminado` sigue siendo la **única fase final**. Todas las nuevas desembocan en ella, igual que `Fracaso`.

### 2.2 La frontera entre Retiro y Desistimiento

- **Retiro:** el solicitante se retira antes de la admisión. Solo desde `Inicial`.
- **Desistimiento:** el deudor abandona después de admitido y notificado. Desde `Admisión` en adelante.

**El cliente confirmó que admisión y notificación ocurren el mismo día**, así que la frontera es la fase `Admisión` y **no se añade ningún campo de fecha de notificación**.

> El sistema no distingue hoy el momento de la notificación: entrar en `Admisión` genera los documentos *Notificación a los Acreedores* y *Edicto Emplazatorio*, pero nada registra si se entregaron. La decisión del cliente hace que esa distinción sea innecesaria.
>
> El propio *Auto Desistimiento* que ya se usa es coherente con esto: dice *"Admitido [el trámite]… se procede a notificar a las partes, **sin embargo**… es recibida solicitud de desistimiento"*.

### 2.3 La rama de impugnación

La impugnación tiene **un solo momento posible: la audiencia de votación**. Una reforma ya no se puede volver a impugnar.

| | Desenlace | Va a |
| --- | --------------------------------------------------------------------- | ----------------- |
| **ⓐ** | Impugnación desestimada, o nulidad parcial saneada por interpretación | Post-acuerdo |
| **ⓑ** | Nulidad declarada, no saneable por interpretación | Acuerdo reformado |
| **ⓒ** | Corrección lograda dentro del plazo | Post-acuerdo |
| **ⓓ** | Corrección no lograda en el plazo | Terminado |

**Por qué ⓐ va a `Post-acuerdo` y no de vuelta a `Acuerdo aprobado`:** desde `Acuerdo aprobado` se puede impugnar. Volver allí reabriría la impugnación, y el cliente confirmó que un acuerdo, una vez resuelta la impugnación, **queda en firme**. Llevarlo a `Post-acuerdo` cierra esa puerta por construcción.

**Por qué no existe una fase `Acuerdo anulado`:** cuando el juez declara la nulidad, el caso **no termina**: vuelve al conciliador para corregirlo en 10 días, prorrogables 20 más. Ese es exactamente el comportamiento de `Acuerdo reformado`, así que una fase aparte sería redundante.

El plazo de corrección **no se controla en esta ronda**. Seguimiento en el **issue #16**.

---

## 3. Documentos por fase

| Fase | Documento | Estado |
| ------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Rechazo | Auto de rechazo | **Nueva** — la redacta el abogado |
| Retiro | Auto o constancia de retiro | **Nueva** — la redacta el abogado |
| Desistimiento | *Auto Desistimiento* | **Ya existe** (`desistimiento`), su texto encaja |
| Acuerdo impugnado | Constancia o remisión de la impugnación | **Nueva** — la redacta el abogado |
| Acuerdo reformado ⓒ | Acta del acuerdo corregido | **Nueva** — la redacta el abogado |
| Acuerdo reformado ⓓ | *"Fracaso por reforma del acuerdo"*, reclasificada | **Ya existe**, ver nota |

**4 plantillas nuevas, 2 reutilizadas.**

> **Nota de seguimiento — plantilla de ⓓ.** La plantilla *"Fracaso por reforma del acuerdo"* es una *"Constancia de No Acuerdo — Reforma del Acuerdo"* que termina remitiendo el expediente al juez para liquidación patrimonial. Eso corresponde **exactamente** al desenlace ⓓ. **Pendiente de que el abogado confirme que el texto sigue siendo válido para este uso.** No bloquea la implementación.

### 3.1 Hallazgos del código que condicionan esta parte

Verificados durante el diseño. **Ninguno lo introduce este trabajo**, pero las fases nuevas los heredarían:

1. **El paquete de Fracaso por cambio de fase genera cero documentos.** Ninguna pantalla asigna `case.failureType`, así que `updateCasePhase` envía `'general'`, ese valor no está en el mapa de subtipos y la lista de plantillas sale vacía. El único camino que funciona es el selector manual de *Detalle del caso → Documentos*, que además usa lock y espera el resultado.
2. **La generación disparada por un cambio de fase no espera el resultado y no toma lock.** Se lanza sin `after()`, así que en Vercel puede cortarse al devolver la respuesta. Conviene que las fases nuevas usen el camino de la generación manual (`runWithGenerationLock`, esperando el resultado).
3. **`PACKAGE_PHASE_MAP` no incluye `Fracaso`**, de modo que un caso en esa fase cae al `return 1` final y se le sugiere el paquete 1 (*Solicitud*). Las fases nuevas necesitan su entrada y conviene corregir esta de paso.
4. **El mapper deja vacía la fecha del desistimiento** (`DIA_DESISTIMIENTO`, con el comentario `// Manual`), así que el *Auto Desistimiento* se imprime hoy con la fecha en blanco. Se resuelve con `resultDate`.
5. **La plantilla `rechazo-inasistencia` está mal clasificada.** Su archivo se llama *"…por Inasistencia del Deudor"* y su texto habla del deudor (*"no asiste a la audiencia programada"*), pero está archivada como *rechazo*. Ocurre después de celebradas las audiencias, así que **pertenece a `Fracaso`**, con su nombre real (`inasistencia-deudor`). La inasistencia **de acreedores** ya está cubierta por los subtipos `inasistencia-vencimiento` e `inasistencia-animo`.
6. *(Fuera de alcance)* La plantilla del punto 5 lleva escritos a mano el nombre del centro y de la operadora. Si la genera el otro tenant, sale con el centro equivocado. No se revisó si otras plantillas tienen el mismo problema.

---

## 4. Subtipos

### 4.1 Desistimiento

`Desistimiento` necesita subtipos, igual que `Fracaso` tiene los suyos. Confirmados dos:

| Subtipo | Cuándo |
| ------------------ | ----------------------------------------------------------------------- |
| No pago de tarifas | El deudor no paga las tarifas u honorarios del centro por las audiencias |
| Abandono total | El deudor abandona el trámite sin más |

Se guardan en **`resultType`**, junto con `resultDate` para la fecha. No se crean campos nuevos.

### 4.2 Tarifas y gastos de administración son cosas distintas

Confirmado por el cliente con base en el **artículo 549 del CGP**. Los dos subtipos **conviven**:

| Concepto | Qué es | Fase | Subtipo |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------- |
| **Tarifas / honorarios** | Lo que se le paga al centro de conciliación por las audiencias | **Desistimiento** | No pago de tarifas |
| **Gastos de administración** | Obligaciones posteriores a la admisión: pensión de colegio, impuestos de propiedades, cuotas de administración, arriendos, leasings | **Fracaso** | `falta-pago-gastos` |

> **`falta-pago-gastos` no se toca.** Se mantiene tal como está, con su plantilla actual. La base legal es directa: artículo 549 del CGP.

### 4.3 Fracaso

Sus 12 subtipos actuales se mantienen. Las cuatro causas que enumeró el cliente ya están cubiertas:

| Causa | Subtipo existente |
| ------------------------------ | ------------------------------------------------------------ |
| Los acreedores no asisten | `inasistencia-vencimiento`, `inasistencia-animo` |
| Los acreedores votan en contra | `propuesta-mala`, `propuesta-quorum`, `propuesta-vencimiento` |
| No pago de gastos (art. 549) | `falta-pago-gastos` |
| Vencimiento de términos | `vencimiento-terminos` |

Pendiente menor: `impugnacion` y `reforma-acuerdo` siguen existiendo como subtipos de `Fracaso`. Con el diseño nuevo, `reforma-acuerdo` pasa a ser la plantilla de ⓓ; `impugnacion` ya no corresponde a ningún camino del flujo normal y se recomienda dejarla solo como generación manual.

---

## 5. Limitaciones deliberadas

Son **decisiones tomadas**, no pendientes. Deben quedar escritas también en el código.

### 5.1 Liquidación patrimonial — fuera de alcance

Se alcanza por el desenlace **ⓓ**. El sistema registra el caso como `Terminado` y **no modela nada de la liquidación**.

El abogado confirmó que, aunque el artículo 563 del CGP la prevé, en la práctica casi nunca ocurre. **Si llega a ocurrir, se tramita manualmente fuera del sistema.**

### 5.2 Nulidad procesal general (art. 133 CGP) — fuera de alcance

Por ejemplo, una notificación indebida. El abogado la confirmó como **mecanismo residual y poco común**. No se modela como fase. **Si llega a ocurrir, se tramita manualmente fuera del sistema.**

---

## 6. Modelo de datos

| Campo | Decisión |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `rejection`, `withdrawal` | **Se retiran del schema.** La fase es la única fuente de verdad |
| `resultDate`, `resultType` | **Se reutilizan** para la fecha y el subtipo de las fases nuevas. No se crean campos propios |
| `inadmissionDate` | Se mantiene. La inadmisión es subsanable, así que el caso sigue en `Inicial`; es el antecedente del `Rechazo` |
| Fecha de notificación | **No se crea** (ver §2.2) |
| Plazo de corrección del acuerdo | **No se controla** en esta ronda. Issue #16 |

**Sobre retirar `rejection` y `withdrawal`:** ninguna lógica los lee — solo los escribe el formulario de edición, y ni siquiera tienen un control visible. Están siempre en `false`, así que no hay pérdida de datos. Aun así implica borrar columnas en una base cuyo historial de migraciones está desalineado: conviene el mismo cuidado que se tuvo con la migración de las columnas `apoyo_*`.

**Casos antiguos:** los que hoy están en `Fracaso` y en realidad fueron rechazos, retiros o desistimientos **se dejan como están**. No se pueden detectar automáticamente y reclasificarlos no forma parte de este trabajo.

---

## 7. Otras decisiones confirmadas

- **El tope de 150 SMMLV se queda como aviso, no como bloqueo.** Confirmado por el cliente: las deudas no tienen tope real y puede haber montos altos legítimos.

---

## 8. Trazabilidad

| Ref | Qué |
| --------- | --------------------------------------------------------------------------- |
| **PR #4** | Debe mergearse antes de empezar; este trabajo toca `case-phases.ts` |
| **#16** | Alerta del plazo de corrección del acuerdo — mejora futura, fuera de alcance |
| **#3** | Troceo de lotes de documentos; afecta al tamaño de los paquetes nuevos |
