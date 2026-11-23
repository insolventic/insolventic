# Semana 14 — Bienes en dos niveles (inventario B, simplificado)

**Fecha:** 2026-10-19
**Base:** `dev` @ `cb0e939` (con el merge de #147 incluido) · **Rama:**
`fix/bienes-dos-niveles` · **PR:** abierto hacia `dev`, **sin mergear**
**Origen:** inventario B (solo lectura, fase anterior) — el dropdown "Tipo
de Bien" tenía 9 valores planos (INMUEBLE, VEHICULO, EQUIPO, MUEBLE, JOYA,
DINERO, ACCION, CUENTA_COBRAR, OTRO), sin categoría. Decisión: dos niveles
— Categoría (Inmueble | Mueble) y luego Tipo, filtrado por categoría.
**SIN migración de datos ni cambios de schema.**

> **Este documento NO está commiteado.**

---

## 1. Resumen

5 commits (uno por tarea; TAREA 4 incluye un bug incidental encontrado y
arreglado al escribir su test).

| #   | Qué                                                                                | Commit    |
| --- | ---------------------------------------------------------------------------------- | --------- |
| 1   | Fix: EQUIPO desaparecía de la Solicitud (bug real en `mapAssets`)                  | `d936f16` |
| 2   | Selector de dos niveles (Categoría → Tipo), alta y edición                         | `b6d74df` |
| 3   | Normalización de bienes viejos al cargar el formulario de edición                  | `12e676f` |
| 4   | Test de persistencia crear → editar → leer (+ fix incidental de `guaranteeAmount`) | `6ce495c` |
| 5   | Verificación: tabla de bienes de la Solicitud, un bien por tipo, dos centros       | `3a295e7` |

### Verificación local

| Check                                      | Resultado                                |
| ------------------------------------------ | ---------------------------------------- |
| `npx tsc --noEmit`                         | ✅ 0 errores                             |
| `npm run lint`                             | ✅ 0 errores / 0 warnings                |
| `npm test` (jest)                          | ✅ 156 suites, 2110 tests                |
| `npm run test:db`                          | ✅ 11 suites, 129 tests                  |
| `npx playwright test`                      | ✅ 13/13                                 |
| Golden master                              | ✅ sin cambios de hash, en los 5 commits |
| Verificación manual en navegador (TAREA 6) | ✅ ver §5                                |

---

## 2. Formulario: ¿ya capturaba `propertyType`?

Sí. `assetSchema.propertyType` (`schemas.ts`) ya existía — un `Input`
de texto libre ("Casa, Apartamento, Lote") mostrado solo cuando
`assetType === 'INMUEBLE'`, en los dos formularios
(`create-case-dialog/assets-section.tsx` y
`edit-case-dialog/assets-tab.tsx`). Se integró sin duplicar campos:
`propertyType` pasó de texto libre a ser el **nivel 2** del selector
cuando la categoría es Inmueble (un `Select` con las 8 opciones de
`PROPERTY_TYPES`), reemplazando ese mismo `Input`. `Asset.type` sigue
siendo `'INMUEBLE'` para inmuebles, como pedía la decisión.

---

## 3. Qué cambió

### Bug real: EQUIPO desaparecía de la Solicitud (TAREA 1)

`mapAssets` (`assets-debts.ts`) reparte los bienes muebles en 7
categorías por sub-cadena de `type`. Un bien con `type: 'EQUIPO'` (el
valor viejo del selector de un solo nivel) no calzaba con ninguna
sub-cadena de electrónicos (`'electronico'`, `'electronic'`,
`'electrodomestico'`) — "equipo" no las contiene. El bien se contaba en
`TOTAL_MUEBLES`/`TOTAL_BIENES` pero desaparecía de las 7 filas
descriptivas (`MUEBLE_*_DESC`) de la Solicitud de Insolvencia.

Único cambio autorizado en `assets-debts.ts`: `'equipo'` agregado a las
sub-cadenas de electrónicos.

### Selector de dos niveles (TAREA 2)

Nuevo `src/features/case/asset-category-types.ts` — única fuente de las
constantes (**PROPUESTA pendiente de confirmación de la abogada**):

- `ASSET_CATEGORIES`: Inmueble | Mueble.
- `PROPERTY_TYPE_OPTIONS`: reexporta `PROPERTY_TYPES` de
  `validation-rules.ts` tal cual (NO TOUCH, solo lectura) — ya tenía
  exactamente los 8 tipos pedidos (CASA, APARTAMENTO, LOTE, LOCAL,
  BODEGA, OFICINA, FINCA, OTRO), sin ningún consumidor real.
- `MOVABLE_ASSET_TYPES`: 8 tipos (los 7 de `MOVABLE_ASSET_CATEGORIES` +
  OTRO), con dos etiquetas corregidas por decisión de producto: **"Joyas"**
  en plural (no "Joya y piedras preciosas") y **"Equipos eléctricos y
  electrónicos"** sin repetir la palabra.
- `normalizeAssetType()` / `categoryForAssetType()`: para la TAREA 3.

Nuevo `src/app/cases/components/asset-type-selector.tsx` — el componente
compartido (`AssetTypeSelector`), sin binding a ningún form. La
categoría no es un campo propio (no existe en el schema): se deriva de
`type`/`propertyType` en cada render.

Integrado en los dos formularios, reemplazando el `Select` de 9 opciones
planas y el `Input` libre de "Tipo de Inmueble".

### Normalización al cargar la edición (TAREA 3)

`edit-case-dialog.tsx`, el único punto donde carga los bienes del caso
al formulario (`fullCase.assets.map(...)`), pasa `asset.type` por
`normalizeAssetType()`. Un bien guardado con un valor viejo (EQUIPO,
MUEBLE, JOYA, DINERO, ACCION, CUENTA_COBRAR) se muestra con la
categoría/tipo correctos — sin escribir nada en la base hasta que el
operador guarde.

### Persistencia (TAREA 4) + bug incidental

No es código nuevo: la persistencia (`createCase` para alta,
`addAssetToCase`/`removeAssetFromCase` para edición, patrón add/remove
sin edición en el lugar) ya existía.

**Bug encontrado al escribir el test:** `addAssetToCase`/
`removeAssetFromCase` fallaban **siempre** que el bien no traía
`guaranteeAmount` — la inmensa mayoría de los bienes reales, que no son
un vehículo con garantía explícita. `asset.guaranteeAmount?.toString()`
da `undefined` cuando `guaranteeAmount` es `null` (optional chaining, no
`??`), y `assetResponseSchema.guaranteeAmount` es `z.string().nullable()`
— acepta `string | null`, pero no `undefined`. El `.parse()` final de
las dos server actions reventaba con cualquier bien sin garantía.
Arreglado con `?? null` en los dos sitios (`src/features/case/actions.ts`).
Este bug llevaba viva desde que existen esas dos funciones — no lo
introdujo esta rama, pero bloqueaba completar la TAREA 4 tal como se
pidió, así que se corrigió aquí con su propio test de regresión.

---

## 4. Verificación de documentos (TAREA 5)

`mapAssets` ya emitía las 7 filas y los datos del inmueble antes de esta
rama — lo único nuevo fue el fix de EQUIPO (TAREA 1). Con un bien de
cada uno de los 8 tipos de mueble, en **Armonía** y **Constructores de
Paz**, resultado idéntico en los dos centros (`assets-debts.ts` no tiene
lógica por tenant):

```
Equipo Eléctrico y Electrónico: Bien Equipos eléctricos y electrónicos — $ 1.000.000
Muebles: Bien Muebles y enseres — $ 2.000.000
Vehículos: - Placa: N/A — $ 3.000.000
Joyas: Bien Joyas — $ 4.000.000
Dinero en efectivo: Bien Dinero en efectivo — $ 5.000.000
Acciones: Bien Acciones y participaciones — $ 6.000.000
Cuentas por cobrar: Bien Cuentas por cobrar — $ 7.000.000
Total bienes muebles: $ 36.000.000
```

**ANTES/DESPUÉS para EQUIPO** (con el mapper real):

```
ANTES:   MUEBLE_ELECTRONICO_DESC = "No declara"
DESPUÉS: MUEBLE_ELECTRONICO_DESC = "Televisor LG"
```

`OTRO` sigue sin fila propia en la tabla (confirmado: ninguna de las 7
descripciones lo menciona), aunque sí cuenta en `TOTAL_MUEBLES`/
`CANTIDAD_MUEBLES` — **decisión pendiente**, plantillas sin tocar (ver
§6).

---

## 5. Verificación manual en navegador (TAREA 6)

`localhost:3000`, tenant Armonía, usuaria Beatriz Helena Malavera López.

**En el wizard de alta** (caso de prueba, no llegó a crearse — bloqueado
por la carga de documentos obligatorios, que no es parte de esta
verificación):

- Bien #1: Categoría **Inmueble** → Tipo **Apartamento** → header pasó a
  "Bien #1 - INMUEBLE", apareció el bloque "Información del Inmueble".
- Bien #2: Categoría **Mueble** → Tipo **Equipos eléctricos y
  electrónicos** → header pasó a "Bien #2 - ELECTRONICO".

**En el diálogo de editar** (caso real `INSOL-000001`, con guardado
efectivo):

- Categoría **Mueble** → Tipo **Joyas**, nombre "Anillo de oro", valor
  $3.500.000 → "Guardar Bien" → apareció en "Bienes Existentes" como
  **"Bien #1 - JOYAS"**, confirmando que `addAssetToCase` persistió
  `Asset.type = 'JOYAS'` exacto. Verificado el ciclo completo (no solo
  la selección en pantalla): se guardó de verdad contra Postgres real.
  Limpiado después (`removeAssetFromCase`) para no dejar datos de
  prueba en el caso real.

En los dos contextos (alta y edición) y las dos categorías, el selector
mostró y guardó el valor correcto.

### Nota operativa

Durante esta verificación Docker Desktop y el contenedor
`insolventic-db-verif` se habían detenido (el servidor dev seguía
corriendo pero sin poder alcanzar Postgres); se reiniciaron ambos (ya
autorizado en fases anteriores) para completar la prueba. El bypass
documentado del rate limit de login (`CI=true E2E_DISABLE_RATE_LIMIT=1`)
sigue bloqueado por el clasificador de permisos de la herramienta —
mismo hallazgo que en las dos ramas anteriores. Se usó la alternativa ya
establecida: reiniciar el servidor dev limpio y mantener los logins al
mínimo.

---

## 6. NO TOUCH respetado

`schema.prisma` y migraciones, `templates/*.html`,
`validation-rules.ts` (solo lectura de `PROPERTY_TYPES`/
`MOVABLE_ASSET_CATEGORIES`, cero escritura), Vercel/Neon y servicios
externos, `main`, historial — ninguno tocado.

## 7. Pendiente / decisiones abiertas

- **Lista de tipos de mueble: PROPUESTA pendiente de confirmación de la
  abogada.** Las constantes viven en un solo archivo
  (`asset-category-types.ts`) para que ese cambio, cuando llegue, no
  toque los formularios ni el mapper.
- **OTRO en bienes muebles no tiene fila propia en la Solicitud** (ni la
  tenía antes de esta rama). Cuenta en el total pero no se describe en
  ningún lado — decisión de producto pendiente sobre si debería tener su
  propia fila, documentada acá, plantillas sin tocar.
- Riesgo a verificar antes de promover: confirmar que la propuesta de
  tipos de mueble (8, con las 2 etiquetas corregidas) es la que la
  abogada aprueba en firme antes de que algún caso real la use.
