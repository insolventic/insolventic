# Hallazgo — el formulario de Acuerdo de Apoyo descartaba sus 28 campos en silencio

**Fecha:** 2026-10-01
**Alcance:** `src/features/case/schemas.ts`
**Origen:** apareció al escribir los tests del PR #89 (editar casos de conciliación y de apoyo), durante la auditoría del formulario maestro de conciliación.
**Estado:** **resuelto en el PR #89**, en el mismo lote que lo encontró.

---

## 1. Por qué este documento existe aparte

Es el hallazgo más serio de la ronda y no estaba en la auditoría que lo originó: la auditoría miraba conciliación, y esto es de Acuerdo de Apoyo. Apareció de rebote, porque un test que escribí para otra cosa falló por un motivo que no cuadraba.

Queda registrado por separado —y no solo en el cuerpo del PR— por una razón concreta: **el defecto vivió cinco meses sin que nada lo señalara**, y la explicación de por qué no lo señaló nada es más útil que el arreglo, que es trivial.

---

## 2. Qué se perdía

Las **28** entradas que recoge el formulario de Acuerdo de Apoyo —beneficiario, prestador de apoyo, conciliadora, condiciones, descripción, cláusulas, resultado— **no llegaban nunca a la base de datos**. Ni al crear el caso ni al editarlo.

No es que se guardaran mal: no se guardaban. La columna quedaba en `NULL` y el documento generado imprimía el campo vacío.

### El mecanismo

`schemas.ts` define tres esquemas distintos para la misma entidad:

| Esquema            | Para qué                               | `conc*` | `apoyo*` |
| ------------------ | -------------------------------------- | ------- | -------- |
| `caseSchema`       | **leer** un caso de la base            | 71      | **29**   |
| `createCaseSchema` | **validar la entrada** de `createCase` | 71      | **0**    |
| `updateCaseSchema` | **validar la entrada** de `updateCase` | 71      | **0**    |

Las 29 columnas `apoyo*` estaban declaradas **solo en el de lectura**.

Zod, por defecto, **descarta las claves que el esquema no declara**: no avisa, no falla, no registra nada. Así que el recorrido completo era:

```
formulario (28 campos)  →  createCase(input)
                             └─ createCaseSchema.parse(input)   ← acá se caían los 28
                                  └─ prisma.case.create({ data: { ...rest } })  ← rest ya no los tenía
```

`createCase` devolvía `{ success: true }`. El caso se creaba. Todo lo demás funcionaba.

---

## 3. Desde cuándo

Desde el **2026-04-20**, commit `19e4227` — _"feat(apoyo): implementar modulo Acuerdos de Apoyo completo"_, el que creó el módulo entero.

Ese commit tocó `schemas.ts` en **37 líneas, todas dentro de `caseSchema`**. Su propio mensaje lo describe en singular:

> `schemas.ts`: zod fields `apoyo*` (todos optional/nullable, reutiliza `concClausulaSchema` para `apoyoClausulas`)

No distingue entre los tres esquemas, y el bloque de conciliación —que sí está en los tres— se había agregado en otra ronda, así que no había un patrón reciente a la vista para copiar. Las 29 columnas de Prisma están ahí desde ese mismo commit y no cambiaron desde entonces.

**Cinco meses y once días** hasta que se detectó.

---

## 4. Por qué nadie lo notó

Cinco capas que, cada una por su cuenta, hacían que el sistema se viera sano.

### 4.1 Todo lo demás estaba bien cableado

Las columnas existen en Prisma. El formulario existe y renderiza. `mapApoyoFields()` lee los campos y produce sus placeholders. Las tres plantillas de apoyo los imprimen. **La única pieza rota era invisible desde cualquiera de las otras cuatro.** Quien revisara el módulo encontraría todo en su lugar.

### 4.2 Zod descarta en silencio

No hay excepción, ni warning, ni log. `createCase` responde `success: true` y el caso aparece en la lista. El operador no tiene forma de distinguir "se guardó vacío porque no lo llené" de "se guardó vacío porque el sistema lo tiró".

### 4.3 El test de contrato que existía mira en la otra dirección

`tests/unit/cases/case-input-contract.test.ts` vigila exactamente este borde… pero al revés. Su enunciado es:

> toda clave que el Zod de entrada acepte y que la action no extraiga antes del spread **debe ser un campo de `Case`**

O sea, caza las claves **de más** —las que harían que Prisma responda `Unknown argument` y rompa la creación a los gritos, que es lo que pasó el 2026-04-01 con `notificationCity` y compañía—. No caza las claves **de menos**, que es este caso y que no rompe nada.

Es un guardián razonable que resultó asimétrico: protege contra el fallo ruidoso y deja pasar el silencioso.

### 4.4 Los tests del mapper nunca pasan por el esquema de entrada

El golden master y los tests de `mapApoyoFields` construyen el caso **directamente** con `makeCase(...)`, un objeto plano. No invocan `createCase` ni `createCaseSchema.parse`. Así que ejercitan el mapper con valores que el camino real **nunca podía entregarle**, y pasan en verde.

Es el mismo mecanismo que ya estaba documentado para las 29 lecturas `raw.conc*` sin columna (ver `NON_COLUMN_CONC_DATE_READS` en `tests/helpers/mapper-scenarios.ts`): un fixture que llena lo que producción deja vacío.

### 4.5 No había ningún caso de apoyo en producción

Consultado contra la base el 2026-10-01 (solo lectura): **0 casos de cualquier tipo**, y en toda la historia del sistema se crearon 2, ambos de insolvencia del centro Constructores de Paz. Nunca existió un Acuerdo de Apoyo real que pudiera exhibir el problema.

Esto es lo que convierte el hallazgo en una buena noticia: **no hay ningún expediente con datos perdidos que haya que reconstruir**. El defecto se corrigió antes de que el módulo se usara.

---

## 5. Cómo se encontró

Por un test que fallaba por el motivo equivocado.

Escribiendo el PR #89 agregué un caso que comprobaba que `updateCase` escribiera los campos de apoyo. Falló con un error de validación de **salida** —`"Invalid input: expected date, received Date"`—, que no tenía nada que ver con lo que el test afirmaba. Los tres casos hermanos, los de conciliación, pasaban.

Esa asimetría era la pista: si el payload de conciliación llegaba y el de apoyo no, la diferencia tenía que estar en el esquema que los valida, no en la action. Contar los campos por esquema lo confirmó en una línea.

---

## 6. El arreglo (PR #89)

Las 29 columnas `apoyo*` se agregan a `createCaseSchema` y a `updateCaseSchema`, copiando el bloque de `caseSchema` y siguiendo el patrón que ya usaban los arrays de conciliación: en los esquemas de **entrada** el array `Json?` va `.optional()` **sin** `.nullable()`, porque Prisma rechaza `null` en una columna Json y de eso se encarga `sanitizeJsonFields` en la action.

Dos tests lo fijan, y leen el contrato **del schema de Prisma**, no de una lista copiada:

- `createCaseSchema declara las 29 columnas apoyo* del modelo`
- `updateCaseSchema declara las 29 columnas apoyo* del modelo`

Si mañana se agrega una columna `apoyo*` o `conc*` y no se declara en los esquemas de entrada, fallan solos.

---

## 7. Lo que queda pendiente

- **El guardián sigue siendo asimétrico.** Los dos tests nuevos cubren `conc*` y `apoyo*`, que son los dos bloques donde ya pasó. No cubren el caso general: una columna nueva de insolvencia que se declare en `caseSchema` y no en los de entrada volvería a pasar inadvertida. Un test que compare las tres listas completas contra `Prisma.dmmf` cerraría el borde entero y es de un par de horas.
- **La raíz es que hay tres listas que hay que mantener a mano.** Mientras `caseSchema`, `createCaseSchema` y `updateCaseSchema` enumeren ~230 campos cada uno por separado, la divergencia es cuestión de tiempo. Derivar los dos de entrada del de lectura es un refactor mayor y no entra en esta ronda, pero es la respuesta de fondo.

---

## 8. Referencias

- Auditoría que lo originó: el informe del formulario maestro de conciliación (hallazgos A1 a A8).
- Hallazgos de la ronda anterior, misma convención: `docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md`
- El fixture que ilustra 4.4: `tests/helpers/mapper-scenarios.ts`, constantes `NON_COLUMN_CONC_*`
- El guardián asimétrico de 4.3: `tests/unit/cases/case-input-contract.test.ts`
