# Hallazgos de calidad — ronda del formulario maestro

**Fecha:** 2026-09-28
**Alcance:** `src/features/case/validation-rules.ts`, `src/app/cases/components/create-case-dialog/*`, `src/app/cases/components/edit-case-dialog/*`.
**Origen:** aparecieron al implementar los 13 cambios de producto del formulario maestro de solicitud de insolvencia (PR #59–#70).

---

## 1. Por qué este documento existe aparte

Los 13 puntos de esa ronda son pedidos del cliente. Los tres bugs de acá **no los pidió nadie**: se encontraron al tocar el código para implementarlos, y se arreglaron en el mismo lote. Quedan documentados por separado para que el historial no los mezcle con los cambios de producto — son dos cosas distintas cuando alguien revise qué se hizo y por qué.

Los tres estaban en producción. Los tres tienen arreglo con test rojo→verde verificado (se reintrodujo el bug y se comprobó que el test lo detecta).

| #   | Bug                                                         | PR  | ¿Llegaba a documentos? |
| --- | ----------------------------------------------------------- | --- | ---------------------- |
| 1   | `hasAttorney` leído de un campo que no existe               | #64 | no                     |
| 2   | El `reset` del formulario de bienes limpiaba 5 de 22 campos | #69 | no                     |
| 3   | Los campos del tipo de bien sobrevivían al cambio de tipo   | #70 | **sí**                 |

---

## 2. Bug 1 — El poder del apoderado no se exigía nunca (PR #64)

### Mecanismo

`getRequiredDocuments()` (`src/features/case/validation-rules.ts`) decidía si el poder era obligatorio así:

```ts
const hasAttorney = !!(caseData as Record<string, unknown>).hasAttorney;
```

**`hasAttorney` no es un campo de `CreateCaseFormInput`**: no existe en el zod del formulario. Los campos reales son `attorney` (texto libre de la Página 1), `apoderadoNombreCompleto` (apoderado principal heredado) y `apoderados[]` (la lista de la Sección XI).

`handleSubmit` llama a `validateDocumentsComplete(uploadedDocKeys, data)` con el form data crudo, así que la lectura daba siempre `undefined` y el documento "Poder" **nunca se agregaba a la lista de obligatorios**.

### Por qué no se notaba

La pantalla **sí** lo mostraba en rojo. `create-case-dialog.tsx` le pasa a `DocumentsSection` un `hasAttorney` que deriva por su cuenta:

```tsx
hasAttorney={
  !!form.watch('apoderadoNombreCompleto') ||
  !!form.watch('apoderados')?.some((a) => a?.nombreCompleto?.trim())
}
```

Así que el requisito se veía como cualquier otro obligatorio, pero el envío pasaba igual. Dos fuentes de verdad para la misma pregunta, y solo una llegaba al gate.

### Por qué vivió tanto

`tests/form-request/document-requirements.test.ts` existía y tenía 24 casos, pero **ninguno pasaba apoderado**. La rama nunca se ejecutaba. Los assertions que esperaban 3 documentos obligatorios seguían en verde y daban sensación de cobertura sobre una función cuya rama condicional principal no se probaba.

### Cómo se encontró

El punto #2 del cliente pedía agregar cédula y tarjeta profesional del apoderado a esa misma condición. Habrían sido dos requisitos decorativos más.

### Arreglo

Una sola fuente, `caseHasAttorney()`, que deriva de las tres claves que el formulario manda de verdad y respeta además un `hasAttorney` explícito (que es como pregunta la UI), de modo que pantalla y submit quedan de acuerdo. +9 casos de test sobre las claves reales.

---

## 3. Bug 2 — El formulario de bienes quedaba a medio limpiar (PR #69)

### Mecanismo

Tras agregar un bien con éxito, `edit-case-dialog/assets-tab.tsx` llamaba:

```ts
newAssetForm.reset({ caseId, name: '', type: '', value: '', description: '' });
```

5 claves de las 22 del formulario. Lo que hace que esto no sea obvio leyendo el código: **`reset(values)` de react-hook-form no vuelve a los `defaultValues`** — reemplaza el estado por `values`, así que las 17 claves omitidas desaparecen del estado.

### Los 17 campos afectados

|               | Campos                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booleanas (2) | `isFamilyHome`, `isInalienablePatrimony`                                                                                                                                                                                                       |
| De texto (15) | `propertyType`, `address`, `registrationNumber`, `encumbrance`, `affectation`, `precautionaryMeasure`, `proofDocument`, `brand`, `model`, `condition`, `licensePlate`, `transitAuthority`, `guaranteeInFavorOf`, `guaranteeAmount`, `material` |

### Qué pasaba realmente (medido, no supuesto)

El diagnóstico inicial fue que las casillas quedaban marcadas. **Es al revés**, y conviene dejarlo escrito porque cambia dónde estaba el daño:

- **Las casillas se pintaban desmarcadas.** Al pasar a `undefined`, el `Checkbox` de Radix las renderiza con `aria-checked=false`. Lo que se rompía es que el estado dejaba de ser booleano. Como el zod las tiene `.optional()` y `addAssetToCase` hace `isFamilyHome ?? undefined`, Prisma caía al default `false`. **Por esta ruta no llegaba dato equivocado a los documentos.**
- **Los inputs de texto sí conservaban el valor.** El `<Input>` registrado se quedaba con el texto del bien anterior **en el DOM** —la placa del vehículo anterior, por ejemplo— mientras el estado del formulario ya no tenía la clave. El operador veía `ABC123` y se persistía `null`.

O sea: el riesgo real era el inverso del que se temía — no un valor de más que se imprime, sino un valor visible que no se guarda.

### Cómo se encontró

Implementando la casilla de comparendos (punto #11), hubo que agregar el campo nuevo al `reset` a mano. Esa fricción fue la señal: el `reset` no derivaba de nada.

### Arreglo

Una sola fuente, `emptyAssetForm(caseId)`, para `defaultValues` y para el `reset`. Dos listas separadas es cómo se originó el bug —una se actualizó y la otra no—, así que el arreglo cierra la clase entera: un campo nuevo del formulario queda cubierto en los dos lados por construcción.

---

## 4. Bug 3 — Los campos del tipo de bien sobrevivían al cambio de tipo (PR #70)

### Mecanismo

Los campos específicos se muestran en bloques condicionados por `type`:

```tsx
{assetType === 'INMUEBLE' && ( ... )}
```

Al cambiar el tipo el bloque se desmonta, pero **react-hook-form no borra el valor de un campo cuyo input se desmontó**: `shouldUnregister` es `false` por defecto.

Medido: se marca "Vivienda Familiar" en un inmueble, se corrige el tipo a vehículo, y el formulario queda en

```json
{
  "type": "VEHICULO",
  "address": "Calle 1 # 2-3",
  "isFamilyHome": true,
  "registrationNumber": "050-12345"
}
```

Todo eso se enviaba: **un vehículo afectado a vivienda familiar, con dirección y matrícula inmobiliaria.**

### Alcance

Pasa en los **dos** formularios de bienes, que usan patrones distintos:

| Formulario                                     | Patrón                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| alta — `create-case-dialog/assets-section.tsx` | field array, `useWatch` por índice en un hijo memoizado |
| edición — `edit-case-dialog/assets-tab.tsx`    | un solo bien, `watch('type')`                           |

`isInalienablePatrimony` tiene el mismo problema pero **no se podía disparar** al momento del arreglo: estaba en el schema, en los `defaultValues` y en la hidratación, pero sin casilla en la UI. El PR #60 le agrega la casilla al bloque de inmueble, así que a partir de ese merge se comporta igual que `isFamilyHome`. Va incluido en el arreglo para que no llegue a manifestarse.

### El caso que pasaba desapercibido

Al ir de `INMUEBLE` a `JOYA` o `MUEBLE` **no desaparece ningún campo de la pantalla** — esos tipos no tienen bloque propio. Nada avisaba de lo que quedó cargado. Es el escenario donde el bug es invisible incluso para quien está mirando el formulario.

### Por qué este es el más serio de los tres

Es el único que mete dato equivocado en una fila que **llega a documentos**: `isFamilyHome` e `isInalienablePatrimony` alimentan `INMUEBLE_VIVIENDA_FAMILIAR` e `INMUEBLE_PATRIMONIO_FAMILIA` en la Solicitud de Insolvencia. El impacto está acotado porque el mapper lee esos campos del primer bien de tipo inmueble —un vehículo con `isFamilyHome: true` no se elige como inmueble—, pero es dato falso persistido en un expediente legal.

### Arreglo

La regla vive en `src/features/case/asset-type-fields.ts`, fuera de los componentes. Los dos grupos son los mismos que agrupa `schema.prisma` en el modelo `Asset` (_"Real Estate specific fields"_ / _"Personal Property specific fields"_), con una excepción deliberada: `description` está en el segundo grupo del schema pero en el formulario es un campo general que se muestra para todos los tipos, así que **no se limpia**.

| Tipo elegido                  | Qué se limpia             |
| ----------------------------- | ------------------------- |
| `INMUEBLE`                    | los campos de bien mueble |
| `VEHICULO`                    | los campos de inmueble    |
| `MUEBLE`, `JOYA`, `DINERO`, … | **los dos grupos**        |
| sin tipo                      | nada                      |

---

## 5. El patrón común

Los tres son el mismo error de diseño: **dos listas de campos que tenían que coincidir y no lo hacían.**

| Bug | Lista A                                       | Lista B                                   |
| --- | --------------------------------------------- | ----------------------------------------- |
| 1   | el `hasAttorney` derivado que usa la pantalla | el `caseData.hasAttorney` que lee el gate |
| 2   | los `defaultValues` del formulario            | las claves del `reset`                    |
| 3   | los campos que el tipo muestra                | los campos que el formulario retiene      |

Los tres arreglos **eliminan la segunda lista** en vez de sincronizarla, así que lo que queda cerrado es la clase de error y no solo los campos de hoy. Es la diferencia entre arreglar los 17 campos del bug 2 y hacer que sea imposible que un campo nuevo quede fuera.

### Consecuencia práctica para revisar código nuevo en esta zona

Cuando aparezca un campo nuevo en un formulario de estos, la pregunta útil no es "¿lo agregué en todos lados?" sino "¿hay algún lugar donde tuve que agregarlo a mano una segunda vez?". Si lo hay, ese es el bug.

---

## 6. Verificación

Los tres arreglos se verificaron igual:

- `npx tsc --noEmit`, `npx eslint` (0 errores), `npm run build` y la suite completa en verde;
- **rojo→verde real**: se reintrodujo cada bug y se comprobó que el test lo detecta, nombrando los campos afectados;
- para los bugs 2 y 3, además, el **golden master del mapper** corrido aparte y sin cambios (26/26, `git diff` de `tests/unit/documents/golden/` vacío) — corresponde, porque son bugs de estado del formulario y no de la lógica del mapper.

El bug 3 tiene además dos tests que manejan el **componente real de producción** (`AssetsSection` montado con su `FormProvider`), no solo un harness equivalente.
