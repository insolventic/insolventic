# Semana 9 — CI (Quick Win 8) + versión 1.0.0-rc.1 — Tanda B

**Fecha:** 2026-10-18
**Base:** `dev` @ `376d83b` (con el merge de #141 incluido) · **Rama:**
`fix/ci-trigger-y-version` · **PR:** (abrir hacia `dev`, **sin mergear**)
**Origen:** cierra la Tanda B del encargo de cumplimiento y handover — las
2 tareas restantes después de que #141 se mergeó, más una corrección de
`ARQUITECTURA.md` que salió de la revisión de #141.
**Sin cambios de schema ni migraciones.** Sin tags ni releases de Git/GitHub.

> **Este documento NO está commiteado.**

---

## 1. Resumen

3 commits.

| #   | Qué                                                                                     | Commit    |
| --- | --------------------------------------------------------------------------------------- | --------- |
| 1   | `docs/ARQUITECTURA.md` — corrige el diagrama de §1 (dos bases por centro → una sola)    | `7aa5f44` |
| 2   | CI — quita `branches:` del trigger `pull_request` en `pr.yml` y `e2e.yml` (Quick Win 8) | `cc3d2de` |
| 3   | `CHANGELOG.md` + `package.json`/`package-lock.json` → `1.0.0-rc.1`                      | `2a35e51` |

### Verificación local

| Check              | Resultado                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | ✅ 0 errores                                                                                    |
| `npm run lint`     | ✅ 0 errores / 0 warnings                                                                       |
| `npx jest --ci`    | ✅ **2004 tests / 141 suites** (sin cambio — nada de esta tanda toca lógica de negocio)         |
| `npm run test:db`  | ✅ **111 / 111**, 7 suites, contra Postgres 16 real — guardián de migraciones sin cambios       |
| `npm run test:e2e` | ✅ **13 / 13**                                                                                  |
| Golden master      | ✅ sin cambios                                                                                  |
| `npm ci`           | ✅ corrido después del bump de versión — `package.json`/`package-lock.json` siguen consistentes |

---

## 2. Qué cambió, commit por commit

### 2.1 `docs/ARQUITECTURA.md` — corrección del diagrama de §1 (`7aa5f44`)

Salió de la revisión de PR #141, no del encargo original. El pedido de esa
revisión fue: _"pega el texto actual de §2 con número de línea y el
fragmento de `src/lib/prisma.ts` que lo respalda; si el documento sigue
contradiciendo el código en algún punto, corrígelo en un commit aparte."_

La prosa de §2 **ya era correcta** desde el 2026-10-09 (una nota fechada ahí
mismo explica por qué `DATABASE_URL_ARMONIA`/`_CONSTRUCTORES_PAZ` no son el
runtime real). El punto que SÍ seguía contradiciendo el código era el
**diagrama de §1** ("Vista de alto nivel"), que se había quedado sin
actualizar en esa misma corrección: dibujaba `DB_A` y `DB_C` como dos nodos
de base de datos separados, uno por centro, con `Actions` apuntando a cada
uno por su cuenta — exactamente la arquitectura "BD por centro" que §2 ya
decía que no existía.

Se reemplazan los dos nodos por uno solo (`DB`, `DATABASE_URL`, los dos
tenants), con una nota al pie que explica el cambio y remite a §2. De paso,
el conteo de modelos de §7 estaba en 27 (de julio); son 26 hoy —
reverificado con el mismo `grep` que el propio documento cita.

### 2.2 CI — Quick Win 8 (`cc3d2de`)

`pr.yml` y `e2e.yml` tenían `pull_request: { branches: [dev, main] }`. Un
PR cuya base es una rama de feature (un PR apilado sobre otro PR sin
mergear todavía) no disparaba ninguno de los dos workflows — ni un check en
rojo, ni `skipped`: simplemente no se encolaba. Es la misma familia de
problema que el Quick Win 7 ya cerrado (`#127`): un hueco que se lee
parecido a "todo bien" de un vistazo, cuando en realidad no corrió nada.

**Se aplicó la opción de fondo**, no el parche mínimo: se quita `branches:`
del todo en vez de agregar `workflow_dispatch` a `pr.yml` (que de todas
formas no habría disparado CI automáticamente en un PR apilado, solo
habría dado un botón para correrlo a mano — `e2e.yml` ya tenía ese botón y
el problema seguía existiendo igual). El costo es correr CI también en PRs
apilados, que es exactamente lo que se buscaba según el propio hallazgo en
`CLAUDE.md`.

Verificado parseando los dos YAML con `js-yaml`: `pull_request` queda
`null` (todos los activity types por defecto — `opened`, `synchronize`,
`reopened` — sin restricción de rama base). El trigger `push` de `pr.yml`
(solo `dev`) no se tocó.

### 2.3 Versión 1.0.0-rc.1 (`2a35e51`)

Lo acumulado en `[Unreleased]` de `CHANGELOG.md` se mueve a una sección
`[1.0.0-rc.1] - 2026-10-18`, sin reescribir su contenido — salvo una
corrección menor: el ítem sobre los dos lotes grandes que excedían
`maxDuration` ya no dice "sigue roto, ver Issue #3" (ese issue se cerró
después, en esta misma sesión — GD-A1). `[Unreleased]` queda vacío.

**No se agregaron entradas nuevas** para todo lo que pasó en esta sesión
(PRs #137 a #141: seguridad, conciliación, lotes/sesiones, cumplimiento) —
el encargo pedía "mover lo acumulado", no redactar el changelog completo
de la versión. Escribir esas entradas con el mismo nivel de detalle que
las existentes es trabajo aparte, no mecánico, y queda pendiente (§4).

`package.json` y las dos entradas del paquete raíz en `package-lock.json`
(no las de dependencias de terceros que coincidan en `0.3.0` por
casualidad — verificado cuáles eran antes de tocar nada) suben a
`1.0.0-rc.1`. `src/config/version.ts` ya lee la versión desde
`package.json`, así que no hizo falta tocar nada más — confirmado
corriendo `npm run lint` después del bump (`insolventic@1.0.0-rc.1 lint`
en la salida).

**Sin tags ni releases de Git/GitHub** — fuera de alcance a propósito.

---

## 3. Verificación del encargo original (items 1 y 2, sin aplicar cambios)

Pedidos antes de arrancar la Tanda B, ya respondidos en el chat:

1. El texto de §2 de `ARQUITECTURA.md` (antes del fix de esta tanda), con
   número de línea, y el fragmento de `src/lib/prisma.ts` que lo respalda
   — confirmando que §2 ya era correcta; el error vivía en el diagrama de
   §1 (ver §2.1 de este documento).
2. La lista exacta de `⟨COMPLETAR⟩` de `docs/IMPLEMENTACION_SEMANA_8.md`
   (sin modificar) — 6 en `/privacidad`, 4 en `docs/PROCEDIMIENTO_ARCO.md`.

---

## 4. Riesgos y qué verificar antes de promover a `main`

- **El CHANGELOG no documenta las 5 entregas de esta sesión** (PRs #137 a
  #141) bajo `1.0.0-rc.1` — solo lo que ya estaba en `[Unreleased]` antes
  de que esta sesión empezara. Si `1.0.0-rc.1` necesita un changelog
  completo de release (seguridad, conciliación, lotes/sesiones,
  cumplimiento), es trabajo aparte — redactar esas entradas con precisión
  requiere revisar cada PR, no es un movimiento mecánico de texto.
- **CI correrá más seguido** a partir de este cambio (también en PRs
  apilados) — más minutos de GitHub Actions consumidos. Es el costo
  explícito y aceptado del Quick Win 8, no un efecto secundario no
  buscado.
- **`1.0.0-rc.1` es una versión release candidate, no una versión
  estable** — el nombre lo dice; no se crearon tags ni releases de GitHub,
  así que esto no dispara ningún deploy ni notificación externa por sí
  solo.
- **Nada de esta tanda toca producción, schema, plantillas ni
  `validation-rules.ts`** — confirmado por el diff y por `npm run test:db`
  sin cambios en el guardián de migraciones.
