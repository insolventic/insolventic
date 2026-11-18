# Proceso Scrum — INSOLVENTIC

> Acompaña a `BACKLOG.md` y `jira-import.csv`. Las secciones marcadas **AUTO** las reescribe `node docs/jira/generar.mjs` desde `docs/jira/data/*.json`; no editarlas a mano.

## 1. Contexto del equipo

- **Equipo:** en la fase de análisis y diseño (E00), el equipo de tesis de 3 personas que firma el diagrama de Gantt; desde la construcción, 1 desarrollador (Maxi) que cumple los roles de Product Owner técnico, Scrum Master y Developer, con IA como agente de ejecución. Los centros (Armonía Concertada, Constructores de Paz) y la abogada actúan como stakeholders y como fuente de las decisiones legales.
- **Cadencia:** sprints de 1 semana calendario (lunes a domingo, semana ISO). Planning el lunes, review + retro el domingo. Con un solo desarrollador, la daily se reemplaza por la actualización del tablero.
- **Escala de estimación:** 1, 2, 3, 5, 8 (13 = dividir). Referencia de 3 pts: `E01-30` (#145, montos en formato colombiano fuera del formulario maestro).

## 2. Definition of Ready (DoR)

Un ítem entra a un sprint solo si:

1. Tiene título orientado a valor y, si es historia, el formato _Como / quiero / para_ con un rol real del sistema.
2. Tiene entre 3 y 6 criterios Gherkin (Dado / Cuando / Entonces), con al menos uno de error o borde.
3. Está estimado en la escala; si vale 8 tiene justificación, y si superaría 8 está dividido.
4. Tiene **Evidencia** (doc, commit, PR o archivo) o la etiqueta `inferido` con la duda explícita.
5. Sus dependencias (`is blocked by`) están en Done o planificadas antes en el mismo sprint.
6. Si lleva `legal-pendiente`: la pregunta está registrada en `docs/PENDIENTES_DECISION_LEGAL.md` y el Sprint Goal **no** depende de que la respuesta llegue.
7. Si toca la base de datos: se sabe si la migración es aditiva o destructiva (las destructivas llevan guarda y plan en dos tiempos, como `DEPLOY_PR40.md`).

## 3. Definition of Done (DoD)

Un ítem está terminado cuando:

1. Se cumplen todos sus criterios de aceptación.
2. **Tests:** hay test de regresión para cada bug y para cada criterio de error de una historia; `npm test` verde; `npm run test:db` verde si toca la base.
3. **CI verde** en el PR: `quality-checks` (lint, `tsc --noEmit`, `jest --ci`, `build`) y `e2e.yml` (Playwright + `test:db`). Un check _skipped_ o ausente **no** cuenta como verde (ver Quick Wins 7 y 8 de `CLAUDE.md`).
4. **Revisión de seguridad:** toda server action nueva o tocada sigue `authenticateUser()` → permiso `P.*` → `tenantId` → `assertCaseAccess` si actúa sobre un expediente; datos de usuario hacia plantillas pasan por `escapePlaceholder`; env vars validadas en el primer uso, nunca en import.
5. **Observabilidad:** sin `console.*` nuevo; errores con `logger.error` y `action` en el contexto.
6. **Documentación actualizada:** CHANGELOG (entrada en lenguaje de usuario), `CLAUDE.md` si cambia el roadmap o una convención, y el `IMPLEMENTACION_SEMANA_N.md` o checkpoint correspondiente si el cambio lo amerita.
7. **Autoría:** commits con autor permitido por `CLAUDE.md` y sin trailers de agente; verificado con el chequeo de `CLAUDE.md` antes de cualquier push a `dev` o `main`.
8. Para documentos legales: generado y revisado al menos un PDF real por centro afectado.

## 4. Convenciones

### 4.1 Proyecto y claves

- **Clave de proyecto:** `INS` (company-managed).
- **Claves temporales del backlog:** `E01` … `E14` (épicas), `E01-07` (ítem), `E01-07.2` (sub-task). En el CSV, la columna `Issue ID` numérica es la que enlaza padres e hijos; la clave temporal va en `Clave temporal` para trazabilidad.

### 4.2 Tipos

| Tipo                 | Uso                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Epic                 | Capacidad de negocio multi-sprint (14). Las _features_ se modelan como épicas; una mejora puntual es una Story con label `feature`. |
| Story                | Valor directo para un rol real del sistema.                                                                                         |
| Bug                  | Defecto con causa raíz, pasos, esperado/actual, fix y test de regresión.                                                            |
| Task                 | Trabajo técnico sin valor directo al usuario (infra, deuda, docs).                                                                  |
| Task + label `spike` | Investigación o decisión con salida documental. Jira no trae el tipo Spike de fábrica.                                              |
| Sub-task             | Solo bajo ítems de más de 5 puntos.                                                                                                 |

### 4.3 Labels

`nfr` · `feature` · `bug-regresion` · `inferido` · `legal-pendiente` · `seguridad` · `spike` · `doc-semana-N` (agrupa por el documento `IMPLEMENTACION_SEMANA_N.md` que respalda el ítem).

### 4.4 Components (técnicos, no por épica)

`Frontend` · `Backend` · `Base-de-Datos` · `Infra-CI/CD` · `Documentos-PDF` · `Testing`.

### 4.5 Prioridades y MoSCoW

- **Prioridad:** Crítica / Alta / Media / Baja en el JSON fuente, en `BACKLOG.md` y en este documento, que es la misma escala de las auditorías y mantiene la trazabilidad con sus hallazgos. El CSV de importación emite los nombres de prioridad de Jira, porque el proyecto no tiene prioridades en español:

  | Backlog / audit | CSV / Jira |
  | --------------- | ---------- |
  | Crítica         | Highest    |
  | Alta            | High       |
  | Media           | Medium     |
  | Baja            | Low        |

  El mapeo vive en `PRIORIDAD_JIRA` (`generar.mjs`), y la validación falla si alguna fila del CSV trae otra prioridad.

- **MoSCoW** solo en pendientes. **Rank** = MoSCoW → sprint planificado → prioridad → orden en la épica.
- Regla de orden de Maxi: **primero lo legal y de código; infraestructura y pagos al final** (W48 en el escenario bajo).

### 4.6 Workflow

`To Do` → `In Progress` → `In Review` (PR abierto, CI corriendo) → `Done` (mergeado a `dev` y DoD cumplido). Un ítem en `In Review` con CI rojo vuelve a `In Progress`.

### 4.7 Ramas y commits ligados a Jira

- Ramas: `feat/INS-123-descripcion-corta`, `fix/INS-123-…`, `docs/INS-123-…`, `ci/INS-123-…` desde `dev`; PR a `dev`; `dev → main` por PR de promoción.
- Commits: Conventional Commits con la clave al inicio del asunto o en el scope: `fix(INS-123): …` (Jira Smart Commits enlaza el commit al ítem).
- PR: título con la clave; cuerpo con _Summary_ y _Test plan_; sin trailers de agente.
- PRs apilados: retargetear el de arriba a `dev` **antes** de mergear el de abajo (Quick Win 8 de `CLAUDE.md`).

### 4.8 Versiones (Fix Version)

`v0.1.0`, `v0.2.0`, `v0.3.0` y `v1.0.0-rc.1` son **reales** (CHANGELOG / package.json). `v0.4.0`–`v0.6.0` son **reconstruidas** (sin tag) para dar granularidad al historial; el CHANGELOG agrupa ese tramo dentro de 1.0.0-rc.1. Como `1.0.0-rc.1` ya está publicada, no se proponen nuevas `v0.x`: lo que falta va a `v1.0.0-rc.2` (W44-W45), `v1.0.0` (W46-W48, entrega) y `v1.1.0` (post-lanzamiento). Las fechas de versión siguen el escenario bajo; ver §5.4 para el escenario base.

## 5. Sprints reconstruidos y velocidad

Los sprints históricos son **reconstruidos**. La **Fase de diseño** (E00) es un único sprint de 13 semanas con fechas tomadas del diagrama de Gantt (ver §5.1). El resto es una semana ISO por cada semana con commits (no se crean sprints en semanas sin actividad), con la fecha de autor de cada commit. Los documentos `IMPLEMENTACION_SEMANA_N.md` **no** son semanas de calendario: las Semanas 1-2 ocurrieron el 2026-08-26, la 3 el 2026-09-02/11 y las **Semanas 4 a 15 entre el 2026-10-17 y el 2026-10-19**. Por eso se conservan solo como label `doc-semana-N` y como evidencia.

### 5.1 Criterio de exclusión

Una semana se excluye del cálculo de velocidad cuando fue una **sesión intensa atípica**: muchos PRs grandes comprimidos en pocos días, que no representan un ritmo sostenible de una semana normal de Maxi. Además, la **Fase de diseño** se excluye por ser trabajo de otra naturaleza (documentación y modelado, sin código). Hoy las semanas excluidas son:

- **Fase de diseño** (3 nov 2025 - 1 feb 2026): fases 1 y 2 del Gantt, semanas 1-13. Sus fechas son **inferidas**: el Gantt no trae fechas de calendario, así que su semana 14 (inicio de la construcción) se hizo coincidir con el primer commit (W06, 2026-02-02).
- **W40** (28 sep - 4 oct): ~70 commits y ~45 PRs en 6 días; 126 pts, 5 veces la mediana.
- **W42** (12-18 oct): los documentos "Semana 4" a "Semana 12" ocurrieron en 2 días.
- **W43** (19-25 oct): continuación del mismo clúster y semana todavía en curso.

En todas ellas, los puntos son además **estimación retroactiva**: se asignaron en octubre de 2026 a trabajo ya hecho. Eso vale para todo el historial, así que la velocidad que sale de él es **una referencia, no una medición**. Las semanas muy flojas (2 pts) no se excluyen: son parte real de la irregularidad de un desarrollador que estudia, y la mediana ya las amortigua.

### 5.2 Recalibración

Tras los primeros **2-3 sprints reales en Jira** (W44-W46), comparar la velocidad real con el rango [escenario bajo, mediana]. Si queda fuera, reemplazar el rango por la mediana de los sprints reales y replanificar los sprints restantes. Desde ese momento, los sprints reconstruidos dejan de usarse para pronosticar.

### 5.3 Sprints reconstruidos

<!-- AUTO:SPRINTS -->

| Sprint          | Fechas                  | Tipo                                                    | Ítems Done | Pts Done | Cuenta para velocidad                                                                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------- | ------------------------------------------------------- | ---------: | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INS Fase-Diseno | 2025-11-03 → 2026-02-01 | reconstruido                                            |          8 |       36 | **no** — Fase de análisis y diseño (fases 1 y 2 del Gantt, semanas 1-13): trabajo de documentación y modelado, no de construcción, hecho por el equipo de tesis. Sprint de 13 semanas, no una semana ISO. Fechas inferidas: la semana 14 del Gantt (inicio de la construcción) se hizo coincidir con el primer commit (W06, 2026-02-02). |
| INS 2026-W06    | 2026-02-02 → 2026-02-08 | reconstruido                                            |          5 |       29 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W07    | 2026-02-09 → 2026-02-15 | reconstruido                                            |          1 |        2 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W08    | 2026-02-16 → 2026-02-22 | reconstruido                                            |          2 |       16 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W09    | 2026-02-23 → 2026-03-01 | reconstruido                                            |          2 |        6 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W10    | 2026-03-02 → 2026-03-08 | reconstruido                                            |          9 |       34 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W11    | 2026-03-09 → 2026-03-15 | reconstruido                                            |          1 |        2 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W12    | 2026-03-16 → 2026-03-22 | reconstruido                                            |          9 |       25 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W13    | 2026-03-23 → 2026-03-29 | reconstruido                                            |          7 |       29 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W14    | 2026-03-30 → 2026-04-05 | reconstruido                                            |          6 |       31 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W15    | 2026-04-06 → 2026-04-12 | reconstruido                                            |          5 |       24 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W16    | 2026-04-13 → 2026-04-19 | reconstruido                                            |         16 |       41 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W17    | 2026-04-20 → 2026-04-26 | reconstruido                                            |          2 |       11 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W28    | 2026-07-06 → 2026-07-12 | reconstruido                                            |          8 |       29 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W33    | 2026-08-10 → 2026-08-16 | reconstruido                                            |          3 |        9 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W34    | 2026-08-17 → 2026-08-23 | reconstruido                                            |          1 |        3 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W35    | 2026-08-24 → 2026-08-30 | reconstruido · docs Semana 1, 2                         |          9 |       20 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W36    | 2026-08-31 → 2026-09-06 | reconstruido                                            |          1 |        2 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W37    | 2026-09-07 → 2026-09-13 | reconstruido · docs Semana 3                            |         12 |       37 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W38    | 2026-09-14 → 2026-09-20 | reconstruido                                            |         19 |       45 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W39    | 2026-09-21 → 2026-09-27 | reconstruido                                            |          2 |        6 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W40    | 2026-09-28 → 2026-10-04 | reconstruido                                            |         42 |      126 | **no** — Sesión intensa atípica: ~70 commits y ~45 PRs en 6 días (25 commits solo el 29-sep), incluida la ronda completa del formulario maestro y los 9 pasos de la división del mapper. 126 pts retroactivos, 5x la mediana; no es un ritmo repetible.                                                                                  |
| INS 2026-W41    | 2026-10-05 → 2026-10-11 | reconstruido                                            |         26 |       84 | sí                                                                                                                                                                                                                                                                                                                                       |
| INS 2026-W42    | 2026-10-12 → 2026-10-18 | reconstruido · docs Semana 4, 5, 6, 7, 8, 9, 10, 11, 12 |         23 |       74 | **no** — Sesión intensa atípica: los documentos 'Semana 4' a 'Semana 12' (9 semanas de documento) ocurrieron en 2 días (17-18 oct), con 7 PRs grandes (#137-#145). No representa una semana normal de trabajo.                                                                                                                           |
| INS 2026-W43    | 2026-10-19 → 2026-10-25 | reconstruido · docs Semana 13, 14, 15                   |          3 |        8 | **no** — Continuación del mismo clúster (19-20 oct, documentos 'Semana 13' a '15') y semana todavía en curso: dato parcial e inflado por la sesión intensa.                                                                                                                                                                              |

Velocidad de referencia: mediana **24** pts/sprint (n=21) · escenario bajo **16** pts/sprint (70%).

<!-- /AUTO:SPRINTS -->

### 5.4 Pronóstico hasta v1.0

<!-- AUTO:FORECAST -->

> **Los puntos históricos son estimaciones retroactivas**: se asignaron en octubre de 2026 a trabajo ya terminado, relativos a la historia de referencia. La velocidad que sale de ellos es una **referencia para planificar, no una medición**, y se recalibra tras los primeros 2-3 sprints reales en Jira.

Semanas que cuentan: **21** · semanas excluidas: **Fase-Diseno, 2026-W40, 2026-W42, 2026-W43** · promedio (solo informativo): 23.1 pts.

Alcance hasta v1.0 (Fix Version v1.0.0-rc.2 + v1.0.0): **31 ítems, 76 pts**. Pendiente total del backlog (incluye v1.1.0): **172 pts**.

| Escenario                |     Velocidad | Sprints hasta v1.0 | Fin estimado |
| ------------------------ | ------------: | -----------------: | ------------ |
| Base (mediana)           | 24 pts/sprint |              **4** | 2026-11-22   |
| Bajo (70% de la mediana) | 16 pts/sprint |              **5** | 2026-11-29   |

Los dos escenarios difieren en **1 sprints** (1 semanas de calendario): con 24 pts por sprint los 76 pts del alcance caben en 4; con 16, hacen falta 5. En ninguno de los dos el orden obligatorio (legal y código → aceptación → infraestructura y pagos) ni las dependencias agregan sprints: cada cifra coincide con el mínimo que da la capacidad sola.

El plan cargado en Jira (campo Sprint) sigue el **escenario bajo**: 5 sprints, ninguno por encima de 16 pts. En el escenario base, el mismo orden se comprime así:

- **Sprint base 1** (24 pts, hasta 2026-11-01): E01-38, E02-33, E02-34, E03-30, E14-10, E01-39, E02-37, E05-15, E11-09, E09-16, E13-23
- **Sprint base 2** (24 pts, hasta 2026-11-08): E11-10, E12-07, E04-15, E11-14, E11-17, E11-18, E05-16, E11-13, E11-15
- **Sprint base 3** (24 pts, hasta 2026-11-15): E14-13, E02-36, E02-35, E14-14, E09-17, E10-24, E10-25, E09-19, E09-20
- **Sprint base 4** (4 pts, hasta 2026-11-22): E10-26, E10-30
<!-- /AUTO:FORECAST -->

### 5.5 Plan de sprints futuros (escenario bajo)

<!-- AUTO:PLAN -->

| Sprint       | Fechas                  | Pts / tope | Sprint Goal                                                                                                                                                  | Nota                                                                                                                                                                                                                                                                                    |
| ------------ | ----------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INS 2026-W44 | 2026-10-26 → 2026-11-01 |      16/16 | Riesgos de código: ningún documento puede salir incompleto ni ninguna edición perderse en silencio.                                                          | Sprint al tope del escenario bajo (16/16 pts).                                                                                                                                                                                                                                          |
| INS 2026-W45 | 2026-11-02 → 2026-11-08 |      16/16 | Legal I: CYG con apoderado verificado, documentos de Rechazo y Retiro y Check List completo; publicar 1.0.0-rc.2.                                            | Sprint al tope del escenario bajo (16/16 pts).                                                                                                                                                                                                                                          |
| INS 2026-W46 | 2026-11-09 → 2026-11-15 |      16/16 | Legal II y Ley 1581: umbrales validados, cuenta de Armonía, política de retención, privacidad y ARCO completos; conflictos de apoderado resolubles en la UI. | Sprint al tope del escenario bajo (16/16 pts).                                                                                                                                                                                                                                          |
| INS 2026-W47 | 2026-11-16 → 2026-11-22 |      16/16 | Aceptación: aislamiento entre centros probado, regeneración sin duplicados, estado de la generación visible y UAT firmado por ambos centros.                 | Sprint al tope del escenario bajo (16/16 pts). Si el UAT genera bugs, `E02-36` (Ver el estado de la generación en segundo plano desde el caso, 3 pts) es el primer ítem en pasar a INS 2026-W48, que tiene 4 pts libres. Se elige porque es Should y ningún ítem de v1.0 depende de él. |
| INS 2026-W48 | 2026-11-23 → 2026-11-29 |      12/16 | Infraestructura y pagos: plan de Vercel, restauración de backup probada, transferencia de cuentas y release 1.0.0.                                           | —                                                                                                                                                                                                                                                                                       |

<!-- /AUTO:PLAN -->

### 5.6 Etiquetas de sprint para la importación

<!-- AUTO:ETIQUETAS_SPRINT -->

Jira Cloud no asigna sprints por nombre al importar un CSV. Cada ítem y sub-task lleva en **Labels** la etiqueta de su sprint (solo en el CSV; el JSON y BACKLOG.md no cambian). Después de importar: crear el sprint en el board, filtrar con `labels = sprint-…` y moverlos en bloque.

| Sprint               | Etiqueta             | Ítems | Sub-tasks | Puntos | Fechas                  | Estado   |
| -------------------- | -------------------- | ----: | --------: | -----: | ----------------------- | -------- |
| INS Fase-Diseno      | `sprint-Fase-Diseno` |     8 |         3 |     36 | 2025-11-03 → 2026-02-01 | Cerrado  |
| INS 2026-W06         | `sprint-2026-W06`    |     5 |         6 |     29 | 2026-02-02 → 2026-02-08 | Cerrado  |
| INS 2026-W07         | `sprint-2026-W07`    |     1 |         0 |      2 | 2026-02-09 → 2026-02-15 | Cerrado  |
| INS 2026-W08         | `sprint-2026-W08`    |     2 |         3 |     16 | 2026-02-16 → 2026-02-22 | Cerrado  |
| INS 2026-W09         | `sprint-2026-W09`    |     2 |         0 |      6 | 2026-02-23 → 2026-03-01 | Cerrado  |
| INS 2026-W10         | `sprint-2026-W10`    |     9 |         0 |     34 | 2026-03-02 → 2026-03-08 | Cerrado  |
| INS 2026-W11         | `sprint-2026-W11`    |     1 |         0 |      2 | 2026-03-09 → 2026-03-15 | Cerrado  |
| INS 2026-W12         | `sprint-2026-W12`    |     9 |         0 |     25 | 2026-03-16 → 2026-03-22 | Cerrado  |
| INS 2026-W13         | `sprint-2026-W13`    |     7 |         0 |     29 | 2026-03-23 → 2026-03-29 | Cerrado  |
| INS 2026-W14         | `sprint-2026-W14`    |     6 |         3 |     31 | 2026-03-30 → 2026-04-05 | Cerrado  |
| INS 2026-W15         | `sprint-2026-W15`    |     5 |         2 |     24 | 2026-04-06 → 2026-04-12 | Cerrado  |
| INS 2026-W16         | `sprint-2026-W16`    |    16 |         0 |     41 | 2026-04-13 → 2026-04-19 | Cerrado  |
| INS 2026-W17         | `sprint-2026-W17`    |     2 |         2 |     11 | 2026-04-20 → 2026-04-26 | Cerrado  |
| INS 2026-W28         | `sprint-2026-W28`    |     8 |         0 |     29 | 2026-07-06 → 2026-07-12 | Cerrado  |
| INS 2026-W33         | `sprint-2026-W33`    |     3 |         0 |      9 | 2026-08-10 → 2026-08-16 | Cerrado  |
| INS 2026-W34         | `sprint-2026-W34`    |     1 |         0 |      3 | 2026-08-17 → 2026-08-23 | Cerrado  |
| INS 2026-W35         | `sprint-2026-W35`    |     9 |         0 |     20 | 2026-08-24 → 2026-08-30 | Cerrado  |
| INS 2026-W36         | `sprint-2026-W36`    |     1 |         0 |      2 | 2026-08-31 → 2026-09-06 | Cerrado  |
| INS 2026-W37         | `sprint-2026-W37`    |    12 |         0 |     37 | 2026-09-07 → 2026-09-13 | Cerrado  |
| INS 2026-W38         | `sprint-2026-W38`    |    19 |         0 |     45 | 2026-09-14 → 2026-09-20 | Cerrado  |
| INS 2026-W39         | `sprint-2026-W39`    |     2 |         0 |      6 | 2026-09-21 → 2026-09-27 | Cerrado  |
| INS 2026-W40         | `sprint-2026-W40`    |    42 |         6 |    126 | 2026-09-28 → 2026-10-04 | Cerrado  |
| INS 2026-W41         | `sprint-2026-W41`    |    26 |         0 |     84 | 2026-10-05 → 2026-10-11 | Cerrado  |
| INS 2026-W42         | `sprint-2026-W42`    |    23 |         6 |     74 | 2026-10-12 → 2026-10-18 | Cerrado  |
| INS 2026-W43         | `sprint-2026-W43`    |     3 |         0 |      8 | 2026-10-19 → 2026-10-25 | En curso |
| INS 2026-W44         | `sprint-2026-W44`    |     7 |         0 |     16 | 2026-10-26 → 2026-11-01 | Futuro   |
| INS 2026-W45         | `sprint-2026-W45`    |     6 |         0 |     16 | 2026-11-02 → 2026-11-08 | Futuro   |
| INS 2026-W46         | `sprint-2026-W46`    |     7 |         0 |     16 | 2026-11-09 → 2026-11-15 | Futuro   |
| INS 2026-W47         | `sprint-2026-W47`    |     4 |         0 |     16 | 2026-11-16 → 2026-11-22 | Futuro   |
| INS 2026-W48         | `sprint-2026-W48`    |     7 |         0 |     12 | 2026-11-23 → 2026-11-29 | Futuro   |
| Sin sprint (backlog) | —                    |    33 |         0 |     96 | —                       | —        |

Las épicas no llevan etiqueta de sprint. Los puntos son de historias, bugs y tasks (las sub-tasks no se puntúan).

<!-- /AUTO:ETIQUETAS_SPRINT -->

## 6. Riesgos principales

Sprints según el plan cargado en Jira (escenario bajo).

| #   | Riesgo                                                                                                                                                                                                                                                                                                                                                                         | Prob. | Impacto                                                                                                                                                                          | Mitigación                                                                                                                                                                                                                                                                                                       | Sprint afectado                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| R1  | Las respuestas legales (abogada, centros) no llegan a tiempo: Check List P3, SMMLV 2026, cuenta de Armonía, textos de fases nuevas, privacidad/ARCO.                                                                                                                                                                                                                           | Alta  | Alto                                                                                                                                                                             | Ítems `legal-pendiente` planificados sin que el Sprint Goal dependa de ellos; `PENDIENTES_DECISION_LEGAL.md` como índice único.                                                                                                                                                                                  | W45, W46                             |
| R2  | Un documento radicado sale con datos incompletos o del centro equivocado.                                                                                                                                                                                                                                                                                                      | Media | Muy alto                                                                                                                                                                         | Bloqueo por datos incompletos (E02-14), requisitos por plantilla (E02-33), branding por campo (E04-11), suite formulario→BD→documento (E14-08).                                                                                                                                                                  | W44 (E02-33)                         |
| R3  | Desarrollador único: el conocimiento está en una persona y en los documentos de sesión.                                                                                                                                                                                                                                                                                        | Alta  | Alto                                                                                                                                                                             | Runbooks, manual, CLAUDE.md al día (E13-23), transferencia de cuentas (E10-26).                                                                                                                                                                                                                                  | W45 (E13-23), W48 (E10-26)           |
| R4  | Plan Hobby de Vercel bloquea despliegues por autor de commit.                                                                                                                                                                                                                                                                                                                  | Alta  | Medio                                                                                                                                                                            | Regla de autoría (E10-13); solución de fondo en E10-25 (vincular cuenta o Vercel Pro).                                                                                                                                                                                                                           | Todos hasta W48 (E10-25)             |
| R5  | Backup nunca restaurado: el runbook de restauración es teórico.                                                                                                                                                                                                                                                                                                                | Media | Muy alto                                                                                                                                                                         | E10-24 antes del release 1.0.0.                                                                                                                                                                                                                                                                                  | W48                                  |
| R6  | Deriva entre migraciones y schema (30 statements) rompe una base construida desde cero.                                                                                                                                                                                                                                                                                        | Baja  | Alto                                                                                                                                                                             | Guardián `BRECHA_CONOCIDA` (E10-19); decisión y cierre en E10-28/E10-29.                                                                                                                                                                                                                                         | v1.1.0 (fuera del alcance de v1.0)   |
| R7  | Un rol creado a mano en producción pierde la edición por el guard de fila (fail closed).                                                                                                                                                                                                                                                                                       | Media | Medio                                                                                                                                                                            | Consulta de solo lectura E03-30 en el primer sprint futuro.                                                                                                                                                                                                                                                      | W44                                  |
| R8  | Lotes de generación que exceden `maxDuration` en Hobby.                                                                                                                                                                                                                                                                                                                        | Baja  | Medio                                                                                                                                                                            | Tandas con reintento (E02-32); evaluar Pro en E10-25.                                                                                                                                                                                                                                                            | W48 (decisión de plan en E10-25)     |
| R9  | Velocidad irregular por la agenda académica (semanas de 2 pts y semanas de 126).                                                                                                                                                                                                                                                                                               | Alta  | Medio                                                                                                                                                                            | Velocidad como rango (mediana / 70%), plan cargado con el escenario bajo, semanas atípicas excluidas y recalibración tras 2-3 sprints reales (§5).                                                                                                                                                               | Todos (recalibrar al cerrar W46)     |
| R10 | Los dos centros no tienen disponibilidad para ejecutar y firmar el UAT en W47 (personal de atención con agenda de audiencias).                                                                                                                                                                                                                                                 | Media | Alto: sin UAT firmado no hay release 1.0.0 (E10-30 depende de E14-14) y W48 se corre una semana.                                                                                 | Agendar las sesiones de UAT con cada centro al cerrar W45; enviar el guion por rol con una semana de anticipación; permitir que cada centro firme por separado; si un centro no puede, su UAT pasa a W48 y la infraestructura que no depende del UAT (E10-24, E10-25) sigue en paralelo.                         | W47 (E14-14) → arrastra W48 (E10-30) |
| R11 | La abogada no alcanza a validar a tiempo las reglas de negocio: umbrales de `validation-rules.ts`, SMMLV 2026 y el Parágrafo 3 del Check List.                                                                                                                                                                                                                                 | Media | Alto: el servidor ya aplica esos umbrales; si alguno está mal, se rechazan o se aceptan casos que no corresponde, y el Check List sigue sin poder generarse.                     | Enviar a la abogada, al inicio de W44, una sola hoja con las reglas y los valores exactos a confirmar (en vez de preguntas sueltas); registrar cada respuesta con fecha en `PENDIENTES_DECISION_LEGAL.md`; si no llega, el umbral vigente sigue aplicándose marcado como no confirmado (`isSmmlvYearConfirmed`). | W45 (E11-09, E11-10), W46 (E11-18)   |
| R12 | Decisiones del cliente sin ratificar: (a) **bloqueo duro vs. borrador con marca de agua** cuando faltan datos (la Semana 3 eligió bloquear e informar faltantes, pero no hay registro de que los centros lo hayan aprobado); (b) **generación individual vs. por lote** como flujo principal (el sistema ofrece las dos; no hay decisión registrada sobre cuál es la oficial). | Media | Medio: si los centros prefieren la marca de agua o solo la generación individual, cambian E02-33 (requisitos por plantilla), E02-36 (estado de la generación) y el guion de UAT. | Llevar las dos preguntas a la review de W44, con un ejemplo de cada opción; registrar la respuesta en `PENDIENTES_DECISION_LEGAL.md` antes de W45; hasta entonces, mantener el comportamiento actual (bloqueo + informe, ambos flujos disponibles).                                                              | W44 (E02-33), W47 (E02-36, E14-14)   |
| R13 | La abogada no entrega a tiempo el texto de las plantillas de las fases nuevas (Auto de rechazo, constancia de retiro; y, después, constancia de impugnación y acta del acuerdo corregido).                                                                                                                                                                                     | Alta  | Medio: los casos en Rechazo o Retiro siguen sin documento propio; la fase existe desde #40 pero no genera nada específico.                                                       | Pedir los textos de Rechazo y Retiro al cerrar W44 con fecha límite antes de W45; convertir a plantilla en cuanto lleguen; si no llegan, E12-07 pasa a v1.1.0 sin bloquear el Sprint Goal de W45. Impugnado/Reformado ya están fuera del alcance de v1.0 (E12-08).                                               | W45 (E12-07); v1.1.0 (E12-08)        |

## 7. Supuestos

- La fecha de un ítem Done es la fecha de autor de su commit (o de la versión del CHANGELOG cuando no hay commit propio).
- **Fecha de resolución de una épica cerrada: es derivada, no un dato.** Las épicas no tienen commit ni fecha propia; cuando todos sus hijos están en Done, su `Resolved` en el CSV es la **fecha del último hijo cerrado** (la máxima de sus hijos Done). El JSON lo declara en la épica con el campo `resueltoDerivado` (`regla`, `fecha` y los ítems `desde` los que sale), y el generador falla si esa fecha deja de coincidir con la de los hijos. Si una épica cerrada no tuviera ningún hijo con fecha, su `Resolved` queda vacío (no se inventa) y el generador lo avisa. Hoy aplica a **E00 → 2026-02-01** (E00-07, E00-08) y **E08 → 2026-04-16** (E08-06).
- Los hallazgos de la auditoría integral se numeran por sección y severidad (`GC-C1`, `GD-A3`, `G-M1`…), igual que en `IMPLEMENTACION_SEMANA_3/4/7`; los de la auditoría pre-producción llevan prefijo `PP-` para no chocar con los `C-1/C-2` de otras auditorías.
- El backlog histórico agrupa commits por capacidad entregada, no un ítem por commit: 295 commits → 278 ítems (sin contar épicas ni sub-tasks).
- La entrega a los centros es la versión 1.0.0: al cierre de W48 (2026-11-29) en el escenario bajo, antes en el escenario base (§5.4); en ambos casos sujeta a R1.
- Los puntos de todo el historial son estimaciones retroactivas; ningún dato de velocidad de este documento es una medición.
- **Fase de diseño:** las fechas de E00 salen del Gantt anclado al primer commit; si aparece la fecha real de la semana 1, se corrige solo el sprint Fase-Diseno en data/meta.json y las fechas de resolución de E00.
- Jira Cloud company-managed, con los campos Story Points, Sprint y Components habilitados.
- **Disponibilidad del cliente (R10):** cada centro dedica al menos una sesión de 2-3 horas en W47 a ejecutar el guion de UAT por rol, y firma en esa misma semana.
- **Validación legal (R11):** la abogada responde la hoja de reglas a más tardar al cierre de W45; hasta entonces rigen los umbrales actuales, marcados como no confirmados.
- **Decisiones del cliente (R12):** mientras los centros no digan lo contrario, se mantiene el bloqueo duro con informe de faltantes (no la marca de agua) y conviven la generación individual y la generación por lote.
- **Plantillas de fases nuevas (R13):** los textos de Rechazo y Retiro llegan antes de W45; los de Acuerdo impugnado y reformado no son necesarios para v1.0.

## 8. Ítems `inferido` por validar

Ítems sin evidencia directa completa (causa raíz no registrada, fecha aproximada o sin documento en el repo). Confirmar o corregir antes de importar.

<!-- AUTO:INFERIDOS -->

- [ ] `E00-01` Planificar el proyecto en un diagrama de Gantt por fases — docs/diseno/Diagrama de Gantt - Insolventic.png
- [ ] `E00-03` Diagrama de casos de uso — docs/diseno/Diagrama de Gantt - Insolventic.png (Documento requisitos, casos de uso — semanas 1-3)
- [ ] `E00-04` Product backlog inicial con historias de usuario — docs/diseno/Diagrama de Gantt - Insolventic.png (Product backlog con historias de usuario, semanas 2-5)
- [ ] `E00-08` Mockups o prototipos de interfaz — docs/diseno/Diagrama de Gantt - Insolventic.png (Mockups o prototipos de interfaz, semanas 8-14)
- [ ] `E01-02` Bucle infinito de renderizado en la app — e6cdeb1 fix: corregir bucle infinito de renderizado
- [ ] `E01-04` Creación de casos, eliminación en cascada y conversión Decimal fallaban — 6fb7ae1 fix: corregir creación de casos, eliminación cascada y conversión Decimal
- [ ] `E02-02` Nombres de archivo que colisionaban y variables sin resolver en la generación — 8d0cae4 · 584feaf · 1fa6eb8
- [ ] `E03-08` Endurecimiento de seguridad y calidad de abril — dfdaae6 fix(security): auditoría integral — hardening de seguridad y calidad
- [ ] `E04-02` La generación de documentos no validaba bien el centro del caso — 29d6456
- [ ] `E04-04` Estructura de carpetas de Drive dispar y adjuntos que no subían — d43892d
- [ ] `E05-03` Validaciones y mensajes de error confusos al crear un deudor — f50c59a
- [ ] `E09-16` Cerrar formalmente el endpoint temporal de prueba de Sentry — docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md §4 (Medio) · ls src/app/api → cron, health (2026-10-21)
- [ ] `E10-21` Separar la base de Preview de la de producción — 0dad100 docs(runbook): Preview ya tiene su propio branch de Neon · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md §2.1
- [ ] `E10-26` Transferir las cuentas de infraestructura a los centros — Brief de la tarea (transferencia de cuenta) — sin documento en el repo · README.md §Variables de Entorno (servicios involucrados)
- [ ] `E11-16` Cargar el SMMLV de 2027 cuando se expida el decreto — docs/IMPLEMENTACION_SEMANA_3.md §3.1 (SMMLV_BY_YEAR, isSmmlvYearConfirmed)
- [ ] `E14-09` Verificación manual de documentos de punta a punta — docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md
<!-- /AUTO:INFERIDOS -->
