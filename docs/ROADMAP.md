# Roadmap — Insolventic

Trabajo planificado por fases. Material de consulta, separado de `CLAUDE.md`, que apunta aquí.

## Fase 2 (3–4 semanas, ~40h total)

- [ ] Refactor console.log→logger (334 refs → niveles + Sentry breadcrumbs, sin emojis) — ~16h
- [ ] Type-safety del módulo documentos (18× `as unknown as` → `Prisma.CaseGetPayload` + transformador Decimal→number; entry point ya centralizado en `asCaseWithRelations()`) — ~12h
- [ ] Code-split del dashboard (342 kB First Load → `next/dynamic` en gráficos) — ~8h
- [ ] Split estructural del placeholder-mapper (2.877 líneas → builders HTML / mappers escalares / conciliación / apoyo) — ~4h
- [ ] P1 pendiente de la auditoría de documentos: batch de Chromium en creación de casos (hoy 1 navegador por documento; `batchHtmlToPdf` ya existe) — ~8h
- ~~Reintentos en la ruta manual de generación (`batchGenerateDocuments`)~~ → 🟢 **Resuelto.** La subida a Drive (`uploadDocumentToCase`) ahora usa `withRetry`, mismo patrón que la ruta automática. La creación de subcarpeta sigue el patrón de `createDocumentSubfolder` (degrada a la carpeta del caso si falla, sin reintento propio — no vale la pena bloquear la subida por eso). Los dos `console.*` que tocaba este cambio pasaron a `logger`.

## Fase 3 (Q3, ~32h)

- [ ] Soft-delete para expedientes legales (borrado físico→lógico, capacidad de recuperación; hoy `deleteCase` borra en cascada) — ~20h
- [ ] Auditoría de accesibilidad (19 refs `aria-*` en todo el proyecto → pasada semántica en las 5 pantallas núcleo) — ~6h
- [ ] **Cerrar la deriva entre el historial de migraciones y `schema.prisma`** — ~6h · 🔴 **bloqueado: necesita acceso a Neon + decidir el camino**

  Medido el 2026-10-08 al arreglar el replay desde cero (#122, `fix/migraciones-desde-cero`). Con la cadena de migraciones corriendo contra una base vacía, el schema reconstruido sigue a **30 statements** de `src/prisma/schema.prisma`:

  | Qué falta                                                        | Cuánto |
  | ---------------------------------------------------------------- | ------ |
  | Tablas enteras (`ConciliationCenter`, `audit_logs`, `payments`)  | 3      |
  | Columnas (`Case`, `Debtor`, `Document`, `User`, `notifications`) | 5      |
  | Índices                                                          | 14     |
  | Foreign keys                                                     | 7      |
  | DropEnum                                                         | 1      |

  Son objetos que viven en `schema.prisma` **y en la base real** (los creó algún `db push`) pero que **ninguna migración crea**. Es la misma clase de deriva que el incidente de las 29 columnas `apoyo_*` (`docs/CHECKPOINT_2026-09-09.md` §8), vista desde el otro lado: allá faltaban en la base, acá faltan en el historial.

  **No afecta producción ni el camino feliz.** Muerde en los dos escenarios que ya rompió #122: restaurar un backup a una base nueva (A-4, que sigue sin probarse) y levantar un entorno desde cero.

  **Las dos salidas, y por qué no se elige sola:**
  - _Migración de catch-up idempotente_ (`IF NOT EXISTS` en todo): no-op en producción, rellena desde cero. Más conservadora, pero deja el historial con una migración de "parche" que no refleja ninguna intención de diseño.
  - _Baseline/squash del historial_: es lo que Prisma recomienda para exactamente esta situación. Más limpio a futuro, pero necesita `migrate resolve --applied` contra cada base ya migrada — y un error ahí sí toca producción.

  Las dos necesitan Neon, así que la decisión se toma cuando haya acceso y ventana. **No decidir no es gratis pero sí es seguro:** el estado actual es estable mientras nadie reconstruya una base.

  **Qué lo sostiene mientras tanto:** `tests/db/migraciones-desde-cero.db.test.ts` corre `migrate deploy` real contra una base vacía por corrida y tiene la brecha inventariada en `BRECHA_CONOCIDA`, con el patrón bidireccional de `pendientes-conocidos.ts`: si alguien la cierra, el test falla por "ya no está roto"; si aparece deriva nueva, falla por "apareció algo". Ojo con leer el `statements: 30` como literal: cuenta líneas `^--` de `migrate diff --script`, que es un proxy del número de statements, no el número.

## Quick Wins (<4h c/u, paralelizables)

1. Test de invariantes de plantillas (P9): recorrer `ALL_TEMPLATES` + `fs.access(getTemplatePath(t))` — detecta renames rotos en CI, no en producción
2. ~~**Limpiar los 8 warnings ESLint preexistentes**~~ → 🟢 **Resuelto el 2026-10-09 en `#124`, y no eran 8 sino 23.** `npm run lint` queda en 0. No fueron todos borrados triviales: **tres escondían algo**.
   - **`available` (`placeholder-mapper.ts`)**: duplicado **stale** de lo que `RECURSOS_DISPONIBLE` ya calcula inline, y **omitía `otherIncomeAmount`** — que el cálculo vivo sí incluye. Nunca llegó a imprimir nada porque no tenía consumidores, pero el primero que lo hubiera usado habría puesto una cifra equivocada en un documento que se radica. Bug latente, no activo.
   - **`verb` (`notification/actions.ts`)**: sin consumidor porque el mensaje se arma en voz pasiva ("Se ha creado el caso X"). Se borró la variable **y los 15 campos `verb` del mapa**, que no los leía nadie. Código muerto, no bug.
   - **Los 3 de `debts` (`cesacion-pagos-section`, `payment-proposal-section`)**: `useWatch(...) || []` como dependencia de `useMemo`. Fix real (`useMemo(() => debtsRaw ?? [], [debtsRaw])`), no silenciado. **Pero el diagnóstico original estaba sobredimensionado y conviene no repetirlo:** `[]` es truthy, así que con el array presente `||` devolvía **la misma referencia** — y el form inicializa `debts: []` en los defaults (`create-case-dialog.tsx:247`, `:305`; `edit-case-dialog.tsx:117`), de modo que el fallback casi nunca disparaba y los memos **sí memoizaban**. Lo que se sacó fue un footgun condicional, no un bug vivo. Verificado además que en RHF 7.65 `useWatch` clona profundo en cada emisión, así que tampoco puede devolver el mismo array mutado (el riesgo que el PR temía).

   Los 2 `exhaustive-deps` de reportes **no se "arreglaron" a propósito**: quedaron con `eslint-disable-next-line` y la razón escrita en el código. Agregar `fetchReport` a las deps da bucle infinito de fetches (efecto → `setLoading` → re-render → efecto), y memoizarlo con `useCallback([dateFrom, dateTo])` tampoco es neutro: el reporte pasaría a refetchear ante cada cambio de fecha, cuando la pantalla tiene un botón "Filtrar" explícito para que el refetch lo decida el usuario.

   Cobertura nueva: `tests/unit/components/cesacion-pagos-recalculo.test.tsx` (4 casos) — el componente no tenía ninguna. Tiene dientes: forzando el memo a deps vacías fallan exactamente los 2 casos de regresión. Queda pendiente, anotado en `#124`, agregarle el caso de **mutación anidada** (`debts.0.daysOverdue`), que es la ruta que usa el formulario en producción; hoy solo cubre reemplazo del array completo.

3. Lazy-load del diálogo de creación de casos (1.494 líneas viajan con la ruta `/cases`)
4. Wiring UI del polling de generación (`documents-section` → `getGenerationRequestStatus`)
5. ~~**Aclarar en el schema los 3 pares de modelos EN/ES**~~ → 🟢 **Resuelto el 2026-10-02, borrando el lado muerto en vez de documentarlo.** Identificado 2026-08-12 como "no son duplicados" (`Creditor`/`Asset`/`LegalProcess` registro general vs. `Acreedor`/`Bien`/`ProcesoJudicial` snapshot del Formulario Definitivo). Una auditoría transversal formulario → plantillas encontró que el segundo lado del par nunca tuvo UI de captura en producción (las 6 secciones del wizard que los alimentaban — V, VI, VII, IX, X, XII — quedaron huérfanas tras una reestructuración del wizard y `#59` solo recogió los componentes ya inalcanzables) y que **ninguna plantilla consume ninguno de sus placeholders** (verificado exhaustivamente, incluidas las ~92 claves de `mapFormularioDefinitivoFields` para las 12 secciones, no solo V/VI/VII). Verificado además contra producción real (Neon, solo lectura): las 3 tablas tenían 0 filas. Se borraron los 3 modelos, su migración (`DROP TABLE`, con guarda que aborta si alguna base tiene filas), los 3 schemas Zod, el nested-create de `createCase`, las 4 funciones del mapper y las 3 cards de solo lectura. El `Creditor`/`Asset`/`LegalProcess` vivo sigue siendo la única fuente para el Formulario Definitivo si algún día se decide construirlo de verdad.

6. ~~**Cachear `~/.cache/ms-playwright` en `e2e.yml`**~~ → 🟢 **Resuelto.** Identificado 2026-10-01: el workflow corría `playwright install --with-deps chromium` en cada ejecución, sin caché, y ese paso se venía degradando (28 s → 79 s → 228 s → 572 s en cuatro corridas consecutivas, y en la quinta se comió el `timeout-minutes: 25` del job antes de correr un solo test). `actions/cache` sobre `~/.cache/ms-playwright`, clave por versión de `@playwright/test`; en cache-hit se salta la descarga del browser y corre solo `playwright install-deps` (las dependencias de sistema no viven en esa carpeta, así que el cache no las cubre).

7. ~~**El `test:db` de `e2e.yml` dependía de un pull anónimo a Docker Hub**~~ → 🟢 **Resuelto el 2026-10-09 en `#127`.** El job levantaba `postgres:16-alpine` como service container y falló dos veces seguidas en "Initialize containers" con `toomanyrequests: You have reached your unauthenticated pull rate limit`. El límite es por IP del runner —compartida con muchísimos proyectos—, así que no dependía de nosotros y no se arreglaba reintentando: los tres reintentos del propio runner fallaron, y el rerun completo también. **Lo grave no era el rojo:** cuando ese paso falla, todos los siguientes quedan `skipped`, incluido `test:db`, que es el gate de los PRs que tocan la base — y un `skipped` se lee parecido a un `passed` de un vistazo. Reemplazado por el **PostgreSQL preinstalado del runner** (Ubuntu 24.04 trae 16.15, el mismo major que la imagen que reemplaza; el servicio viene deshabilitado y hay que arrancarlo), sin secretos nuevos ni dependencia de registries externos. Dos detalles que hacían falta: `CREATEDB` en el rol, porque el guardián del replay de migraciones crea y borra una base por corrida, y `OWNER` en la base, porque desde PostgreSQL 15 el schema `public` pertenece a `pg_database_owner` y `prisma db push` no podría crear las tablas. Verificado end-to-end: el PR se verifica a sí mismo (`e2e.yml` corre en `pull_request`) y la prueba de humo del paso imprime `PostgreSQL 16.15 (Ubuntu 16.15-1.pgdg24.04+2)`.

8. ~~**El CI no corre en PRs apilados, y los checks que quedan se leen como verdes**~~ → 🟢 **Resuelto en `#142` (`7edc0cf`), sacando el filtro `branches:` de los dos workflows.**

   Encontrado el 2026-10-10 con `#133` y `#134`, apilados sobre ramas de feature. `pr.yml` y `e2e.yml` tenían

   ```yaml
   on:
     pull_request:
       branches: [dev, main]
   ```

   así que **un PR cuya base era una rama de feature no disparaba ninguno de los dos**. En `#133` los únicos checks eran `Vercel` (fail por autoría, el de siempre), `Vercel Preview Comments` (pass) y `smoke` (skipping): ni `quality-checks` ni `playwright` aparecían. No fallaron — no existieron.

   **Cómo quedó:** los dos workflows tienen `pull_request:` sin `branches:`, con el porqué comentado en cada archivo, así que un PR apilado encola `quality-checks` y `playwright` como cualquier otro. El costo es correr CI también en PRs apilados, que es exactamente lo que se buscaba. `pr.yml` ganó además `push: branches: [dev]`, para que el commit que queda en `dev` tras un merge pase por `quality-checks` — antes esa verificación era local y a mano.

   **Lo que sigue vigente al leer el CI de un PR apilado:**
   - Confirmar que `quality-checks` y `playwright` **aparecieron, en `success` y sobre el SHA actual** de la rama. Es la misma familia que el Quick Win 7: un check que no corre se lee parecido a uno que pasó, y en `e2e.yml` cualquier paso que falle deja los siguientes en `skipped` — incluido `test:db`, que es el gate de los PRs que tocan la base. **Confirmar que el check corrió, no que no está rojo.**
   - El rojo puede venir del **PR padre**: el diff y el checkout de un PR apilado incluyen sus commits, así que el primer descarte es si el padre ya fallaba solo.
   - Si hace falta forzar una corrida, `e2e.yml` tiene `workflow_dispatch`, así que se corre a mano con `gh workflow run e2e.yml --ref <rama>` y eso da `test:db` + Playwright reales. `pr.yml` **no** lo tiene, así que `quality-checks` no se puede disparar y hay que correr sus pasos en local (`npm run lint`, `npx tsc --noEmit`, `npx jest --ci`, `npm run build`).

   **Y ojo con la secuencia de merge de un stack**, que tiene dos trampas más, las dos pisadas el 2026-10-10 y las dos todavía vigentes:
   - Al mergear el PR de abajo con `--delete-branch`, GitHub **no retargetea** al de arriba: lo **cierra**. Y un PR cerrado no se puede reabrir ni cambiar de base si su base ya no existe (`Cannot change the base branch of a closed pull request`). Se recupera recreando la rama borrada, reabriendo y retargeteando — o, mejor, **retargeteando el PR de arriba a `dev` ANTES** de mergear el de abajo.
   - Cambiar la base **no** vuelve a disparar los workflows: eso emite `pull_request: edited`, y el set por defecto es `opened, synchronize, reopened`. Lo que sí dispara es un push a la rama — y después de un squash merge hay que rebasear igual, porque el stack conserva los commits del padre y el diff los muestra de nuevo. Un `git rebase --onto origin/dev <viejo-tip-del-padre>` + `push --force-with-lease` resuelve las dos cosas de una.

9. **Los 2 campos de dinero fuera del formulario maestro siguen sin separador de miles** — ~2h

   Quedaron fuera del alcance de `#136`, que normalizó los 27 del formulario maestro (wizard + pestañas de edición). Los dos son montos de pago:

   | Dónde                                              | Etiqueta       | Qué hace                    |
   | -------------------------------------------------- | -------------- | --------------------------- |
   | `case-details-dialog/payment-tracking-section.tsx` | "Monto"        | registra un pago del deudor |
   | `reports/components/payment-tracking-report.tsx`   | "Valor pagado" | ídem, desde reportes        |

   **Ojo con el conteo: al cerrar `#136` se dijo que eran 5, y no lo son.** Ese número salió de contar `type="number"` fuera del formulario maestro, no campos de dinero. De los otros cuatro: dos son `dependents` (una cuenta de personas, en los diálogos de deudor), uno es `approvalPercentage` (un porcentaje, en `pre-generation-form`) y el cuarto **ni siquiera es un input** — es un `<XAxis type="number">` de Recharts en `dashboard-charts.tsx`. Ninguno lleva separador de miles ni debería.

   **La trampa, para quien lo tome.** No alcanza con cambiar el input a `type="text"`: los dos hacen `parseFloat(monto)` al enviar (`payment-tracking-section.tsx:210`, `payment-tracking-report.tsx:986`) y `parseFloat("1.500.000")` da **1.5**. Es exactamente el bug de `#136`, que vivía en **tres** capas y solo lo cerró del todo un test que llega hasta Prisma. El parseo correcto ya existe: `parsearMonto` en `src/features/case/monto.ts`, y el input formateado es `MoneyInput` en `src/components/ui/money-input.tsx`. Reusar los dos, no reescribirlos.

   **Por qué no urge:** mientras los campos sigan siendo `type="number"` el navegador no deja escribir el punto, así que el bug es inalcanzable desde la UI. Lo que molesta hoy es la inconsistencia visual — un monto se escribe `1.500.000` en el wizard y `1500000` acá.

> Nota: dos items del roadmap original se descartaron por no corresponder al código real: la migración Float→Decimal (los montos ya usan `Decimal`) y el split del schema Prisma (tiene 1.041 líneas, no 2.516 — no urge).
