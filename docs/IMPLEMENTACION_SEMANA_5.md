# Semana 5 — Cierre de C-1a, C-3 y C-2 del formulario de conciliación

**Fecha:** 2026-10-17
**Base:** `dev` @ `7ab6b5e` (con el merge de #137 incluido) · **Rama:**
`fix/conciliacion-formulario` · **PR:** [#138](https://github.com/insolventic/insolventic/pull/138) (abierto, **sin mergear**)
**Origen:** los hallazgos de conciliación del diagnóstico del 2026-10-12 que no
requieren cambio de schema.
**Sin cambios de schema ni migraciones.**

> **Este documento NO está commiteado.** Convive sin tocarse con
> `docs/IMPLEMENTACION_SEMANA_4.md` (el resumen de #137), que tampoco se tocó.

---

## 1. Resumen

6 commits atómicos, uno por tarea del encargo.

| # | Qué | Commit |
| --- | --- | --- |
| 1 | **C-1a** (interino) — las 10 fechas históricas ya no caen a "hoy" | `658686e` |
| 2 | **C-3** — los 3 campos de Zoom en el formulario | `c601c5f` |
| 3 | **C-2** — los 5 campos faltantes, en crear y en editar | `48a620e` |
| 4 | Test de cobertura bidireccional (las 12 plantillas) | `8fd4a35` |
| 5 | `.gitignore` — `test-results/` y `playwright-report/` | `33439c6` |
| 6 | La auditoría escrita + la referencia colgada corregida | `5f7b566` |

### Verificación local (idéntica a lo que corren los checks de CI)

| Check | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores / 0 warnings |
| `npx jest --ci` | ✅ **1933 tests / 134 suites** (venía de 1912/130 tras #137) |
| `npm run test:db` | ✅ **108 / 108**, 6 suites, contra Postgres 16 real |
| `npm run test:e2e` | ✅ **13 / 13** |
| Golden master | ✅ 19 claves cambiadas, las 19 `CONCILIATION/` — 0 fuera |

### CI del PR #138 — estado al momento de escribir esto

| Check | Resultado |
| --- | --- |
| `quality-checks` (lint + tsc + jest + build) | ⏳ pending al momento de este resumen |
| `playwright` (E2E) | ⏳ pending al momento de este resumen |
| `Vercel Preview Comments` | ✅ pass |
| `smoke` | skipping — esperado, no hay deployment |
| `Vercel` | ❌ fail — **issue #7**, autoría del commit. Esperado, no se toca (mismo caso que en #137) |

`quality-checks` y `playwright` corren exactamente lo que ya verifiqué en
local arriba (mismo lint, mismo `tsc`, mismo `jest --ci`, mismo build, mismos
13 E2E), así que el resultado esperado es verde. Si Autofix reporta un fallo
real en cualquiera de los dos, lo atiendo y actualizo este documento.

**+132 tests nuevos** desde la base, repartidos en 6 suites (3 de componente,
1 de documento/mapper, 1 de db, 1 de cobertura).

---

## 2. Qué cambió, commit por commit

### 2.1 C-1a (interino) — fechas históricas que imprimían "hoy" (`658686e`)

**El hallazgo más grave de la auditoría original.** Diez placeholders de
fecha **histórica** (algo que ya ocurrió, no "hoy") caían a
`getDayNumber/getMonthName/getYear(now)` cuando no había columna que los
respaldara. Cada Aclaración de Acta, Acta de Alimentos, Constancia de No
Acuerdo, Auto Desistimiento, Informe Conciliador y Terminación Anormal salía
afirmando que la solicitud, la citación o el desistimiento ocurrieron **hoy**,
sin que nada en el PDF lo advirtiera.

Cambian a blanco visible, mismo patrón que `DIA_/MES_/ANO_INICIO_UNION`
(ese ya caía a blanco desde antes, por diseño):

```
DIA_/MES_/ANO_SOLICITUD
DIA_/MES_/ANO_CITACION
DIA_/MES_/ANO_DESISTIMIENTO
FECHA_SOLICITUD
```

`FECHA_SOLICITUD` no tenía **ningún** fallback — era `formatDate(now)` a
secas, sin `||`. Como es una fecha compuesta, el blanco quedó en
`____ de ____________ de ______`.

**`DIA_/MES_/ANO_CONSTANCIA` NO se tocó**, a propósito: ahí "hoy" es
correcto — es la fecha de **expedición** del documento, no la de un hecho
pasado. Es el contraste que el propio archivo ya tenía, usando el mismo
default para dos cosas distintas.

**Por qué es "interino" y no un cierre definitivo.** Los 10 placeholders
siguen sin columna propia en `schema.prisma` — agregarla está fuera de
alcance (NO TOUCH schema/migraciones). El cambio fue el *default*: de "hoy"
(dato falso) a blanco (dato ausente, honesto). La solución de fondo —columna
+ input— queda en el inventario de pendientes del test de cobertura (§2.4).

Un test existente (`mapper-merge-order.test.ts`) afirmaba el comportamiento
viejo ("sin fechas escritas: caen a la fecha de hoy") y se actualizó para
afirmar el blanco.

### 2.2 C-3 — los 3 campos de Zoom (`c601c5f`)

`zoomLink`/`zoomMeetingId`/`zoomPassword` ya existían en `schema.prisma` y en
los tres Zod desde antes de esta auditoría, y el mapper ya producía
`ZOOM_ID`/`ZOOM_CODIGO`/`ZOOM_LINK` con fallback a `''` — sin tocar en esta
rama. Faltaba el input: sin él, `Notificacion de Convocatoria.html` —la
citación que se envía al convocado— salía siempre con el bloque "DATOS
INGRESO REUNIÓN ZOOM" vacío.

Nuevo fieldset "Audiencia virtual (Zoom)" en `ConciliationDetailsSection`,
compartido por `create-case-dialog` y `edit-case-dialog`. Verificado con un
test que renderiza la plantilla real con los tres datos puestos y confirma
que el PDF los imprime.

### 2.3 C-2 — los 5 campos faltantes (`48a620e`)

| Campo | Placeholder | Plantilla | Dónde |
| --- | --- | --- | --- |
| `concApoderadoConvocanteDireccion` | `DIRECCION_APODERADO_CONVOCANTE` | Solicitud de Audiencia | fieldset "Apoderado del Convocante" |
| `concApoderadoConvocanteCiudad` | `CIUDAD_APODERADO_CONVOCANTE` | Solicitud de Audiencia | idem |
| `concFechaNacimiento` | `FECHA_NACIMIENTO_SOLICITANTE` | Solicitud de Audiencia | fieldset nuevo "Solicitante — Datos Adicionales" |
| `concHoraProgramada` | `HORA_PROGRAMADA` | Terminación Anormal | fieldset "Causa de Terminación (anormal)" |
| `concTipoConstanciaSolicitada` | `TIPO_CONSTANCIA_SOLICITADA` | Informe Conciliador | fieldset "Resultado del Informe" |

**Fecha de nacimiento: `type="text"`, no `type="date"`.** La columna es
`String?` y el mapper la imprime tal cual, sin `formatDate` — un selector de
fecha nativo guardaría `"1990-03-15"` y el documento saldría con eso en vez
de una fecha en español.

**El resto de los datos del solicitante no tiene fieldset propio, a
propósito:** el convocante/solicitante **es** el deudor por diseño y el
mapper lo deriva de `debtor.*` cuando no hay override — agregar inputs
duplicaría la captura con el formulario del deudor. La fecha de nacimiento es
la única excepción porque `Debtor` no tiene columna equivalente.

**Persisten en crear Y en editar** sin tocar `edit-case-dialog.tsx` ni
`type-specific-fields.ts`: los 5 llevan el prefijo `conc*`, así que ya pasan
por el mecanismo genérico de esos campos (PR #89).

**Hallazgo lateral, corregido de paso:** al escribir el test de los 2 campos
nuevos de "Apoderado del Convocante" salió que **todo ese fieldset no tenía
`htmlFor`/`id`** — su hermano "Apoderado del Convocado" sí los tenía. Se
corrigió el fieldset completo (7 campos), no solo los 2 nuevos.

**Verificado contra Postgres real**
(`tests/db/conciliacion-formulario.db.test.ts`): ciclo crear → editar → leer
para los 8 campos de este commit y del anterior (3 Zoom + 5 C-2) — crear con
un valor, editar a otro (confirma que `updateCase` **actualiza**, no solo
acepta), y editar sin reenviarlos (confirma que **no se borran por
omisión**). 3 tests, 3 pasan.

### 2.4 Test de cobertura bidireccional (`8fd4a35`)

`conciliacion-formulario-cobertura.test.ts` lee las 12 plantillas, el mapper
y los dos archivos del formulario **del disco, en cada corrida** — no es una
lista que se desactualiza. El inventario final de pendientes: 44 campos
`conc*` + `FECHA_SOLICITUD` por placeholder, categorizados con su razón:

- 4 de la Aclaración de Acta (C-1c) — sin columna.
- 12 fechas sin columna (las mismas de C-1a + Aclaración) — ahora en blanco.
- 11 de unión marital/disolución — sin columna, por diseño previo (C-1b,
  **no es un bug**).
- 2 de desistimiento sin columna.
- 7 de `concConvocante*` — con columna, sin input **por diseño** (derivan del
  deudor).
- 3 de `concConciliadora*` — 2 derivan del operador; `CC_CONCILIADORA` sin
  respaldo (`User` no guarda cédula).
- 5 columnas muertas (C-4) — legacy de los arreglos JSON.

Verificado con mutación en las dos direcciones: borrar una entrada de la
lista hace fallar el test; agregar una entrada ya resuelta también.

### 2.5 `.gitignore` (`33439c6`)

`test-results/` y `playwright-report/` — Playwright los escribe en la raíz
del repo y ninguno de los dos estaba ignorado. Encontrado en la sesión
anterior (#137): corriendo `test:e2e` en local, quedaba un directorio sin
trackear ensuciando `git status`.

### 2.6 La auditoría escrita (`5f7b566`)

`docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md` — el documento que
`PENDIENTES_DECISION_LEGAL.md:23` citaba y que nunca existió como archivo.
Actualizado con lo que esta rama cerró (no es solo el borrador original). La
corrección de esa fila también aclara que la cita a la Ley 640 de 2001 que
rastrea **no está en ninguna plantilla de conciliación** — está en 2 de
insolvencia y 1 de support-agreements.

---

## 3. El diff del golden master, explicado

**Recalculado ahora contra `origin/dev` (el commit base real de la rama,
`7ab6b5e`), no contra un commit intermedio** — para que la cifra sea la que
corresponde comparar en este PR.

```
total claves cambiadas: 19
INSOLVENCY (debe ser 0):         0
SUPPORT_AGREEMENT (debe ser 0):  0
CONCILIATION:                   19
otros (debe ser 0):              0
```

**Confirmado: ningún hash de insolvencia ni de Constructores de Paz/Armonía
cambió.** Las 19 claves que cambiaron, agrupadas por plantilla:

| Plantilla | Escenarios afectados |
| --- | --- |
| `conc-aclaracion-acta` | `conciliacion-basica`, `conciliacion-con-fechas`, `conciliacion-varios-menores`, `conciliacion-xss` |
| `conc-acta-alimentos` | `conciliacion-basica`, `conciliacion-varios-menores`, `conciliacion-xss` |
| `conc-constancia-no-acuerdo` | `conciliacion-basica`, `conciliacion-varios-menores`, `conciliacion-xss` |
| `conc-desistimiento` | `conciliacion-basica`, `conciliacion-varios-menores`, `conciliacion-xss` |
| `conc-informe-conciliador` | `conciliacion-basica`, `conciliacion-varios-menores`, `conciliacion-xss` |
| `conc-terminacion-anormal` | `conciliacion-basica`, `conciliacion-varios-menores`, `conciliacion-xss` |

**Por qué estas 6 plantillas y no las otras 6 de conciliación.** Son
exactamente las que usan al menos uno de los 10 placeholders de C-1a
(`DIA_/MES_/ANO_SOLICITUD`, `_CITACION`, `_DESISTIMIENTO`, `FECHA_SOLICITUD`).
Las otras 6 (Acta Disolución, Acta General, Acta Unión Marital, Auto
Desistimiento Conciliación, Notificación de Convocatoria, Solicitud de
Audiencia) no los usan, así que su render no cambia — y efectivamente no
aparecen en el diff.

**Por qué `conciliacion-con-fechas` solo cambia 1 de las 4 plantillas.** Ese
escenario manda las fechas explícitas para la mayoría de los campos (no pasa
por el default), salvo `MES_DESISTIMIENTO` en `conc-aclaracion-acta` — de ahí
que sea la única combinación de esa fila con una sola entrada.

**La causa, a nivel de dato:** antes, cada render de estos 6×3 = 18
combinaciones (más la línea 19 de `conciliacion-con-fechas`) incrustaba la
fecha simulada del entorno de test (una fecha de 2026) como si fuera la fecha
real de la solicitud/citación/desistimiento; ahora incrusta el blanco
`____`/`____________`/`______` / `____ de ____________ de ______`. Cambia el
HTML renderizado, así que cambia el hash — es el efecto esperado y deseado
de C-1a.

---

## 4. Riesgos

### 4.1 🟢 Ninguno nuevo de seguridad

Esta rama es puramente de documentos de conciliación: no toca permisos,
autenticación, rate limits ni nada de lo que cerró #137.

### 4.2 🟡 C-1a sigue siendo un parche, no el cierre de fondo

Los 10 placeholders de fecha histórica **todavía no tienen columna**. El
blanco es honesto (no afirma un dato falso), pero sigue siendo un blanco: un
operador que genere una Aclaración de Acta hoy va a tener que llenar la fecha
de la solicitud a mano sobre el PDF. La columna + el input quedan en el
inventario del test de cobertura, para cuando se decida tocar el schema.

### 4.3 🔵 C-1c y C-4 quedan documentados, no resueltos

4 campos de la Aclaración de Acta (qué se corrige, cómo estaba mal, el valor
correcto) y 5 columnas muertas. Los dos necesitan una rama que sí toque
`schema.prisma` — la de C-1c para agregar columnas, la de C-4 para borrarlas
(con la misma verificación previa en producción que se hizo para los 3
modelos del Quick Win 5).

### 4.4 🔵 El check `Vercel` del PR sigue en rojo, y es esperado

Mismo caso que en #137: `"Git author MaxitoJM must have access to the
project on Vercel"` — issue #7, no se toca por las razones ya conocidas
(reescribir autoría violaría `CLAUDE.md`; vincular la cuenta es una acción de
Vercel fuera de alcance). El `vercel[bot]` comentó en el PR ofreciendo hacer
público el repo, upgrade a Pro, o solicitar acceso — ninguna se aplicó.

---

## 5. Decisiones que necesitan tu aprobación

| # | Decisión | Por qué no la tomo yo |
| --- | --- | --- |
| 1 | **¿Se prioriza una rama que agregue las columnas de C-1a/C-1c?** (10 + 4 = 14 columnas nuevas en `Case`) | Es un cambio de schema, fuera de esta rama a propósito |
| 2 | **¿Se borran las 5 columnas muertas de C-4?** | Mismo motivo — y antes de borrarlas hay que repetir la verificación de 0 filas en producción que se hizo para el Quick Win 5 |
| 3 | **¿Se commitea `docs/IMPLEMENTACION_SEMANA_5.md`?** | Lo pediste sin commitear |
| 4 | **La decisión de Vercel (§4.4) sigue pendiente de la sesión anterior** — upgrade a Pro, solicitar acceso, o dejarlo así | Implica facturación y/o acceso de cuenta; no cambia con este PR |

Las 4 son independientes de mergear este PR: ninguna bloquea el merge de lo
que ya está cerrado (C-1a interino, C-3, C-2).

---

## 6. Scope respetado

No se tocaron: `schema.prisma`, migraciones, `templates/*.html`,
`validation-rules.ts`, servicios externos, Vercel, `main`, ni
`docs/IMPLEMENTACION_SEMANA_4.md` (el resumen sin commitear de #137 — sigue
intacto, sin tocar). Sin reescritura de historial. El PR #138 queda **abierto
y sin mergear**.

**Verificado que esta rama no se superpone con los 14 archivos que tocó
#137:** `git diff --name-only origin/dev..HEAD` da 17 archivos, ninguno en
común con los de la rama de seguridad.

Docker: el daemon ya estaba corriendo al empezar esta parte de la sesión, con
contenedores ajenos a este proyecto (de otro trabajo del usuario). Se levantó
solo el contenedor propio de `test:db` en el puerto 54329 y se borró al
terminar (`docker ps -a --filter name=insolventic` vacío); el daemon **no**
se detuvo, para no tumbar los contenedores ajenos que ya estaban arriba antes
de esta sesión.
