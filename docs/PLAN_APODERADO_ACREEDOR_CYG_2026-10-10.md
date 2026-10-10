# Plan — apoderado del acreedor en el CYG

**Estado:** aprobado el 2026-10-10. **PR 1 y PR 2 mergeados** (#130, #131); PR 3 **sin abrir a proposito** (requiere aviso explicito del dueno del producto).

Origen: ítem 13 de `docs/PENDIENTES_DECISION_LEGAL.md`, respondido por la abogada
el 2026-10-09 (§6.6 de ese documento).

## 1. La decisión que hay que implementar

> Cuando el **registro de poderes** y lo que dice el **acta de la audiencia** no
> coincidan, el sistema **no debe elegir una fuente por defecto** — debe
> **detectar la discrepancia y bloquear la generación** hasta que el conciliador
> la resuelva manualmente, en vez de generar con una fuente arbitraria.

Es más exigente que las dos opciones que estaban planteadas antes ("imprimirlo"
vs. "llenarlo a mano"): hay **dos fuentes de verdad que pueden contradecirse** y
hace falta un flujo para que el conciliador decida cuál vale.

Coherente con la decisión del membrete por centro (`#126`): antes un error
visible que un documento con un dato arbitrario, cuando se radica ante un
juzgado.

## 2. Decisiones de diseño cerradas

Confirmadas por el dueño del producto el 2026-10-10:

| Decisión                   | Elegido                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| Dónde vive el registro     | **Ligado a `Debt`** (no a `Apoderado`, que es por caso y del convocante) |
| Forma                      | **Tabla `ApoderadoAcreedor`**, una fila por fuente                       |
| Clave de comparación       | **La identificación**, normalizada                                       |
| Nombre distinto, misma id. | **Advertencia**, no bloqueo                                              |
| Cuándo se bloquea          | **Solo por contradicción. Nunca por ausencia**                           |
| Dónde se captura el acta   | **`creditors-detailed-section.tsx`**, vía el diálogo de edición          |

### Por qué el estado de partida obligaba a decidir esto

No existía **nada** que guardara el apoderado de un acreedor:

| Qué hay                                   | Alcance                             | Servía |
| ----------------------------------------- | ----------------------------------- | ------ |
| Tabla `Apoderado`                         | por **caso**, del convocante/deudor | No     |
| `concApoderadoConvocante*` / `Convocado*` | por **parte**, en conciliación      | No     |
| `Debt`                                    | **sin ningún campo** de apoderado   | —      |
| `{{APODERADO}}` en `CYG Tramite.html`     | por fila de acreedor, se emite `''` | —      |
| `NOMBRES_APODERADOS_ACREEDORES`           | imprime `____________________`      | —      |

Y **no existe ningún "formulario de audiencia"** en el wizard. Los datos
post-audiencia de conciliación se capturan en `conciliation-parties-section.tsx`
a través del **diálogo de edición**, que reusa las mismas secciones. El campo del
acta sigue ese precedente.

## 3. El modelo

```prisma
model ApoderadoAcreedor {
  id                 String  @id @default(cuid())
  debtId             String  @map("debt_id")
  tenantId           String  @map("tenant_id")
  /// REGISTRO | ACTA | MANUAL
  fuente             String
  nombreCompleto     String  @map("nombre_completo")
  tipoIdentificacion String? @map("tipo_identificacion")
  identificacion     String?
  tarjetaProfesional String? @map("tarjeta_profesional")
  correo             String?
  telefono           String?

  debt   Debt   @relation(fields: [debtId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([debtId, fuente])
  @@index([debtId])
  @@map("apoderados_acreedor")
}
```

Una fila **por fuente**, como máximo: eso es lo que expresa el `@@unique`.

### La confirmación, en `Debt`

```prisma
apoderadoConfirmadoFuente String?   @map("apoderado_confirmado_fuente")
apoderadoConfirmadoHuella String?   @map("apoderado_confirmado_huella")
apoderadoConfirmadoPor    String?   @map("apoderado_confirmado_por")
apoderadoConfirmadoAt     DateTime? @map("apoderado_confirmado_at")
```

**Cambio respecto del plan presentado en chat**, y el porqué: ahí se proponía un
**FK** `apoderadoConfirmadoId` apuntando a la fila elegida. No se hizo, porque
creaba un **ciclo de acciones referenciales**: `Debt → ApoderadoAcreedor` con
`onDelete: Cascade` en un sentido y `SetNull` en el otro, sobre las mismas dos
tablas. Guardar la **fuente** en vez del id evita el ciclo y además dice lo que
realmente importa ("ganó el registro" / "ganó el acta"); la fila concreta se
busca por `(debtId, fuente)`, que ya es único.

`apoderadoConfirmadoHuella` es lo que permite **invalidar la confirmación**: es
la huella de las identificaciones normalizadas de las dos fuentes **en el momento
de confirmar**. Si después cualquiera de las dos cambia, la huella recalculada no
coincide y el conflicto vuelve a bloquear. Sin ella, una confirmación quedaría
pegada al acreedor y no a los valores que se confirmaron, que es lo que se
confirmó de verdad.

## 4. Las reglas de comparación

```
normalizar(id) = minúsculas, sin puntos, espacios ni guiones

CONTRADICCIÓN  = REGISTRO y ACTA, las dos con identificación, y normalizadas ≠
                 → BLOQUEA la generación
ADVERTENCIA    = identificaciones iguales, nombres distintos
                 → no bloquea; se marca "a confirmar"
SIN CONFLICTO  = una sola fuente con dato, o ninguna
                 → imprime lo que haya (vacío si no hay nada)
```

**El bloqueo es solo por contradicción, no por ausencia.** Si bloqueara por
ausencia, ningún CYG se podría generar hasta tener cargados todos los poderes, y
eso rompería el flujo actual sin que nadie lo haya pedido.

## 5. Los cuatro PRs

| #   | Qué                                           | Depende de | Esfuerzo | Toca generación |
| --- | --------------------------------------------- | ---------- | -------- | --------------- |
| 1   | Modelo y migración 🟢                         | —          | ~4 h     | No              |
| 2   | Captura (creación) 🟢                         | 1          | ~5 h     | No              |
| 3   | Detección y gate                              | 2          | ~4 h     | **Sí** ⚠️       |
| 4   | UI de resolución **+ captura post-audiencia** | 3          | ~7 h     | No              |

Cada uno con su `test:db` contra Postgres real y rojo→verde. Los PRs 1 y 2 son
**puramente aditivos**: no cambian ningún comportamiento existente.

### PR 1 — Modelo y migración

Migración **aditiva** (`CREATE TABLE` + 4 columnas nullable), obligatorio por la
regla de `RUNBOOK.md §2.2`: Preview corre código nuevo contra el esquema viejo,
porque `migrate deploy` está gateado a producción.

`test:db`: inserta las dos fuentes para un mismo `Debt` contra Postgres real,
verifica que el `@@unique` rechaza una segunda fila de la misma fuente, y que
borrar el `Debt` cascadea.

A vigilar: `migraciones-desde-cero.db.test.ts` tiene `BRECHA_CONOCIDA.statements`
y es bidireccional. La tabla nueva **sí** la crea la migración, así que el número
no debería moverse; si se mueve, hay que entender por qué antes de actualizarlo.

### PR 2 — Captura de las dos fuentes · 🟢 mergeado (`#131`)

Las dos en `creditors-detailed-section.tsx`, por fila de acreedor:

- "Registro de poderes (acreditado)" → fuente `REGISTRO`
- "Acta de la audiencia (compareció)" → fuente `ACTA`

Más 12 campos opcionales en `debtSchema`, el helper `apoderado-acreedor.ts` que
traduce el formulario a las filas, y el nested create en `createCase`.

`test:db`: envía el formulario con las dos fuentes y verifica que **las dos
quedan guardadas**. El modo de falla que esto atrapa es el campo descartado en
silencio (`Unknown argument`), que es cómo se rompió la creación de casos sin que
ningún test unitario lo notara.

Dos decisiones del helper: **el nombre define que la fuente existe** (sin nombre
no se crea fila, aunque vengan los demás campos), y **la identificación se guarda
tal como la escribió el operador** — normalizar al guardar perdería el original,
que es el que el conciliador ve en la pantalla de resolución.

> **Corrección a este plan, encontrada al implementarlo.** Arriba decía capturar
> el acta en `creditors-detailed-section.tsx` _"vía el diálogo de edición"_. **El
> diálogo de edición no reusa esa sección:** tiene su propio `debts-tab.tsx` de
> 570 líneas con `addDebtToCase` / `removeDebtFromCase`, y **no existe ninguna
> action para actualizar una deuda existente** — solo agregar y quitar.
>
> Como el acta se llena **después de la audiencia**, sobre acreedores que ya
> existen, esa ruta necesita una action nueva. **Se movió al PR 4**, que ya
> necesita una ruta de escritura por deuda para persistir la fuente elegida: era
> eso o construir dos rutas de escritura distintas para el mismo dato.
>
> Lo que entró en el PR 2, entonces, es la captura **en la creación del caso**.

### PR 3 — Detección y gate ⚠️

El comparador como función pura, y una causa de bloqueo hermana de
`unresolved-placeholders` en `generate-documents.ts`: mismo contrato, no se genera
nada ni se sube nada a Drive, y el error nombra **qué acreedores** están en
conflicto.

Acá también `{{APODERADO}}` del CYG pasa a emitir el valor cuando no hay
conflicto (hoy emite `''`). Va en este PR y no en otro porque "imprimir cuando es
inequívoco" y "bloquear cuando se contradice" son la misma decisión.

**Avisar antes de abrirlo.** Es el único que cambia la generación.

### PR 4 — UI de resolución

La tarjeta de conflicto por acreedor, con cuatro propiedades que no son
negociables:

- **Sin opción preseleccionada.** Si una viniera marcada, se confirmaría sin leer
  y volveríamos a tener una fuente por defecto — lo que la abogada descartó.
- **La resolución se persiste**, no es un _dismiss_ de sesión.
- **Si cualquiera de las dos fuentes cambia, la confirmación se invalida**
  (la huella de §3).
- **Queda en `audit_logs`.** Es una decisión sobre quién representa a un acreedor
  en un documento que se radica.

## 6. Riesgo de secuencia, decidido

Entre el PR 3 y el PR 4 hay una ventana en la que un caso con conflicto **no se
puede generar y no hay forma de resolverlo**: el gate existe, la UI no.

**Decisión:** se desarrollan y mergean a `dev` por separado, pero se **promueven
a `main` juntos**. Así producción nunca tiene el gate sin la salida.

La alternativa —invertir el orden— se descartó: la UI sin el gate no tiene nada
que resolver y no se puede probar de punta a punta.

## Referencias

- La pregunta y la respuesta de la abogada: `docs/PENDIENTES_DECISION_LEGAL.md` §1 y §6.6
- El precedente de fail-closed en generación: `#126` (membrete por centro)
- Regla de migraciones aditivas: `docs/RUNBOOK.md` §2.2
