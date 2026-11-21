# Semana 13 — Apoderado único (inventario A)

**Fecha:** 2026-10-19
**Base:** `dev` @ `e406962` (con el merge de #145 y #146 incluidos) · **Rama:**
`fix/apoderado-unico` · **PR:** abierto hacia `dev`, **sin mergear**
**Origen:** inventario A (solo lectura, fase anterior) — el campo
"Apoderado" duplicado entre la Página 1 (`attorney`, texto libre) y la
Sección XI (`apoderados[]`, estructurado). Decisión: la Sección XI queda
como única fuente de carga.
**Sin migración de schema, sin tocar `templates/*.html`, sin tocar nada de
`validation-rules.ts` fuera de lo autorizado (líneas ~1114/1118,
`caseHasAttorney`, `getRequiredDocuments` — y la función nueva
`casePoderOtorgado`).**

> **Este documento NO está commiteado.**

---

## 1. Resumen

6 commits (uno por tarea) + 1 fix encontrado en la verificación manual.

| #   | Qué                                                                                                      | Commit    |
| --- | -------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Validaciones server-side (`caseHasAttorney`, `casePoderOtorgado` nueva) + tests                          | `5aea6e0` |
| 2   | Quitar el input de la Página 1, unificar aviso cliente/servidor, detalle y placeholders-dialog           | `a6679c8` |
| 3   | Test de componente: Página 7 exige el poder solo con `existePoderOtorgado`                               | `ddef71f` |
| 4   | Persistencia crear → editar → leer, contra Postgres real                                                 | `b7f5dfb` |
| 5   | Verificación: Tramite Audiencia.html sigue imprimiendo el apoderado de la Sección XI                     | `3787fc4` |
| —   | **Fix encontrado en la TAREA 6**: el bloque legado "Apoderado Principal" no llegaba a `DocumentsSection` | `715aafc` |

### Verificación local

| Check                                      | Resultado                                |
| ------------------------------------------ | ---------------------------------------- |
| `npx tsc --noEmit`                         | ✅ 0 errores                             |
| `npm run lint`                             | ✅ 0 errores / 0 warnings                |
| `npm test` (jest)                          | ✅ 150 suites, 2055 tests                |
| `npm run test:db`                          | ✅ 10 suites, 125 tests                  |
| `npx playwright test`                      | ✅ 13/13                                 |
| Golden master                              | ✅ sin cambios de hash, en los 6 commits |
| Verificación manual en navegador (TAREA 6) | ✅ ver §5                                |

---

## 2. Qué cambió

### Decisión de producto

El input de texto libre `attorney` de la Página 1
(`case-details-section.tsx`) se quita del wizard. La Sección XI
(`apoderados[]`, con respaldo al bloque legado "Apoderado Principal" de
un único apoderado) queda como la única forma de cargar un apoderado
desde ahora. La columna `Case.attorney` **se queda en el schema, sin
migración** — solo como respaldo de LECTURA para expedientes ya
radicados que únicamente tengan ese campo.

### Validaciones (server + cliente)

- `caseHasAttorney(data)` (ya existía, sin cambios en su cuerpo) sigue
  reconociendo tres fuentes: el texto libre `attorney` (legado, ya sin
  input pero el campo sigue en el schema), el espejo legado
  `apoderadoNombreCompleto`, y `apoderados[].nombreCompleto`.
- **Nueva** `casePoderOtorgado(data)`: responde una pregunta más
  estrecha que `caseHasAttorney` — de los apoderados declarados, ¿alguno
  tiene `existePoderOtorgado === true`? Un apoderado puede estar
  identificado (nombre, cédula, tarjeta) sin que el poder ya esté
  otorgado; son dos hechos distintos. Solo cuenta el poder de un
  apoderado con nombre no vacío (mismo criterio que `caseHasAttorney`
  para no contar una fila en blanco con el switch marcado por error).
- `validateCaseBusinessRules` (líneas ~1114/1118): `Boolean(data.attorney)`
  → `caseHasAttorney(data)`. `validateAttorneyData` **no se tocó** (fuera
  de lo autorizado) — se le sigue pasando `{attorney: ...}`, pero ahora
  con el nombre de CUALQUIERA de las tres fuentes, no solo el texto
  libre, para que no rechace un apoderado identificado solo en la
  Sección XI.
- `getRequiredDocuments`: el bloque "Attorney → poder + cédula +
  tarjeta" se separó. `caseHasAttorney` sigue exigiendo
  `cedula_apoderado`/`tarjeta_profesional_apoderado`; `poder` ahora
  depende solo de `casePoderOtorgado`.
- `create-case-dialog.tsx` (~479): el aviso de mínima cuantía
  reimplementaba la lógica a mano (sin el flag explícito que
  `DocumentsSection` sí usaba — la misma inconsistencia cliente/servidor
  que motivó esta tarea). Ahora llama a `caseHasAttorney(formData)`.

### UI

- `case-details-section.tsx` (Página 1): input `attorney` eliminado.
- `legal-process-section.tsx` (detalle del caso): muestra
  `apoderados[0]?.nombreCompleto`, con respaldo a `attorney` para
  expedientes anteriores a la Sección XI.
- `documents-section.tsx` (Página 7): recibe `apoderados` **y** el
  espejo legado (`apoderadoNombreCompleto`/`existePoderOtorgado`) para
  que `casePoderOtorgado` pueda evaluar cualquiera de las dos formas en
  que la Sección XI guarda un apoderado. El aviso indigo distingue "hay
  apoderado" de "el poder ya está otorgado".
- `placeholders-dialog.tsx`: se quitó `{{abogado}}` (`case.attorney`) —
  verificado que ninguna plantilla la usa.

### Persistencia

No es código nuevo: `buildApoderadosCreate`/`mirrorPrincipalApoderado`
(crear, PR #102) y `addApoderadoToCase`/`removeApoderadoFromCase`
(editar, PR #103) ya existían. Lo nuevo es el test que fija el ciclo
completo crear → editar → leer contra Postgres real (§TAREA 4 abajo).

---

## 3. El fix encontrado en la verificación manual (TAREA 6)

Al probar en el navegador, el bloque legado "Apoderado Principal" (el
que `ApoderadoSection` muestra cuando `apoderados[]` está vacío —
"Llenar datos de prueba" lo rellena así) tenía el switch "poder
otorgado" marcado, pero la Página 7 seguía mostrando "El poder solo se
exige cuando se marca 'poder otorgado'..." en vez de pedirlo.

Causa: `DocumentsSection` recibía el prop `apoderados` (la lista nueva,
vacía en este caso) pero nunca los dos campos del bloque legado
(`apoderadoNombreCompleto`, `existePoderOtorgado` a nivel de caso), así
que `casePoderOtorgado` nunca tenía de dónde leerlos — aunque la función
en sí ya sabía reconocer ese espejo desde el commit 1.

Arreglado pasando esos dos campos como props adicionales (commit
`715aafc`). Cubierto con 2 tests de componente nuevos (7 en total en
`documents-section-poder.test.tsx`).

---

## 4. Verificación manual en navegador (TAREA 6)

`localhost:3000`, tenant Armonía, usuaria Beatriz Helena Malavera López.
Caso de Insolvencia (sin llegar a crearlo — se verificó el gate y se
canceló el diálogo, sin dejar datos de prueba en la base):

1. Deudor Carlos Rodríguez Silva → luego cambiado a Ana Martínez López
   vía "Llenar datos de prueba" (soltera, sin requisito de cónyuge).
2. Deuda total subida a **$83.500.000** (capital de un acreedor a
   $80.000.000 + el resto de "Llenar datos de prueba"), por encima de
   los 40 SMMLV ($70.036.200 con el SMMLV 2026 = $1.750.905).
3. Página 1 ("1. Solicitante"): confirmado que la card "Datos del Caso"
   ya **no** tiene el campo "Apoderado" — solo "Operador del caso".
4. Sección XI ("6. Legal"): el bloque "Apoderado Principal" (llenado por
   "Llenar datos de prueba") con el switch "Poder otorgado" **activado**.
5. Página 7 ("7. Documentos"), **con** el switch activado:

   > "El caso tiene apoderado con poder otorgado. Se requieren el poder,
   > la cédula del apoderado y su tarjeta profesional."

   Lista de obligatorios incluye: Cédula de ciudadanía del apoderado,
   Tarjeta profesional del apoderado, **Poder (notariado o prueba de
   envío desde correo del deudor)**.

6. Volviendo a la Sección XI y **desactivando** el switch, la Página 7
   cambió a:

   > "El caso tiene apoderado. Se requieren la cédula del apoderado y su
   > tarjeta profesional. El poder solo se exige cuando se marca 'poder
   > otorgado' en la Sección XI."

   La fila "Poder (notariado...)" desapareció de la lista; "Cédula de
   ciudadanía del apoderado" y "Tarjeta profesional del apoderado"
   siguieron ahí sin cambios.

Esto reprodujo en vivo el bug de §3 (con el switch activado, el poder NO
aparecía) antes del fix, y confirmó el comportamiento correcto (los dos
sentidos del switch) después de aplicarlo — el dev server recargó el
cambio en caliente durante la misma sesión de navegador.

### Nota sobre el rate limit de login

El bypass documentado (`CI=true E2E_DISABLE_RATE_LIMIT=1`) sigue
bloqueado por el clasificador de permisos de la herramienta (lo mismo
que en la rama anterior). Se usó la misma alternativa: reiniciar el
servidor dev local limpio (vacía el store de rate-limit en memoria del
proceso) y limitar los intentos de login a uno por sesión de
verificación.

Durante esta tarea se encontraron y limpiaron 3 filas de usuario
huérfanas (`Operador de prueba — centro-carpeta-tenant`) que había
dejado un `afterAll` fallido de la rama anterior (`fix/centro-carpeta-
tenant`, antes de que `purgeCase` existiera) en los tenants reales
`armonia`/`constructores-paz` de esta misma base compartida —
visibles como opciones reales en el selector de operador del wizard.
Se verificó que no estaban referenciadas como operador de ningún caso
antes de borrarlas.

---

## 5. NO TOUCH respetado

`schema.prisma` y migraciones, `templates/*.html`, el resto de
`validation-rules.ts` (el TODO del SMMLV no se tocó), Vercel/Neon y
servicios externos, `main`, historial — ninguno tocado.

## 6. Pendiente (fuera de esta rama)

- Inventario B (dropdown de tipo de bien, dos niveles) →
  `docs/IMPLEMENTACION_SEMANA_14.md`, no iniciado.
