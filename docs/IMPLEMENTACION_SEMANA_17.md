# Semana 17 — Una sola fuente para el SMMLV

**Rama:** `fix/smmlv-fuente-unica` · **PR:** #154 (abierto contra `dev`, sin mergear)
**Base:** `9d55822` · **Commits:** 10

---

## 1. El problema

El sistema resolvía el SMMLV por tres caminos distintos, y los tres podían dar
veredictos opuestos sobre el mismo expediente:

| Capa           | Fuente                            | 40 SMMLV    |
| -------------- | --------------------------------- | ----------- |
| Servidor       | `getSmmlv(año)` → 1.750.905       | $70.036.200 |
| Wizard de alta | `SMMLV_2025` → 1.423.500          | $56.940.000 |
| Documentos     | literal `1300000` (valor de 2024) | $52.000.000 |

De ese umbral depende si el apoderado judicial es obligatorio. Con $60.000.000
radicados en 2026, el wizard advertía y el servidor no. En la banda
$52.000.000–$70.036.200 el `Check List` marcaba una casilla y el formulario afirmaba lo
contrario. `SMMLV_VALOR` imprimía $1.300.000 como salario mínimo.

Hallazgo del Bloque 1 de la auditoría (`docs/AUDITORIA_BLOQUE1_2026-10-27.md` §2.1).

## 2. Lo que se hizo

**Una sola fuente.** `SMMLV_BY_YEAR` queda como la única. Se elimina `SMMLV_2025` y el
literal del mapper. El wizard llama a `validateMinimaCuantia` —la misma función del
servidor—, así que el umbral, el mensaje y la condición no pueden divergir.

**El año sale del expediente.** Nuevo `smmlvYearForCase`:
`filingDate ?? createdDate ?? año en curso`, leído en zona horaria de Colombia.
`createCase` y `updateCase` dejan de usar `new Date().getFullYear()`.

**La degradación deja rastro.** `getSmmlv` registra con `logger.warn` cuando el año
pedido no está cargado, en vez de caer en silencio al último conocido.

**Dos erratas de cita legal.** El CGP (Ley 1564 de 2012) aparecía como `LEY 2564/2012`
en el auto de inadmisión y como `ley 1554 de 2012` en el fracaso por acuerdo bilateral.
Un dígito en cada una.

**El valor transitorio no se tocó.** El de 2026 viene del Decreto 0159 y sigue pendiente
de confirmación jurídica. El `TODO(legal)` se conserva y se amplía.

## 3. Decisiones tomadas

| Decisión                                                              | Alternativas descartadas                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin fecha de radicación, el año sale de `createdDate`                 | Usar el año en curso (el umbral del mismo expediente se movería solo al cambiar de año); exigir `filingDate` (rompe el alta, donde el campo no se pide) |
| La degradación a un año no cargado se registra, no bloquea            | Lanzar (dejaría a los centros sin poder radicar); seguir en silencio                                                                                    |
| El wizard muestra como advertencia lo que la función emite como error | Cambiar el panel a error (bloquearía el alta, que hoy no bloquea)                                                                                       |

## 4. Lo que el trabajo descubrió

**La fecha de radicación no se pide en el alta, por decisión deliberada.** El primer
intento la leyó del formulario del wizard; lo frenó
`tests/unit/cases/filing-date-ownership.test.ts`, que fija que la radica el centro y no
el deudor, y que su lugar es la pantalla del operador. Por eso el wizard llama a
`smmlvYearForCase({})`, que cae a la fecha de creación.

**Una segunda errata de cita legal**, que el informe del Bloque 1 no tenía: apareció al
barrer `templates/` buscando otras. Las 13 citas distintas quedaron todas identificadas.

**El umbral de 1000 SMMLV sobre bienes del Check List no se calcula.**
`SI_VALOR_BIENES`/`NO_VALOR_BIENES` solo miran si hay bienes con valor mayor que cero.
Anotado en `PENDIENTES_DECISION_LEGAL.md` (ítem 15), sin resolver.

**Documento y validador no comparten el borde.** `mapCheckList` usa
`totalDebt < 40 × SMMLV` y `validateMinimaCuantia` usa `totalDebt > 40 × SMMLV`, las dos
estrictas: en el valor exacto no coinciden. Es anterior a este cambio y unificarlo
alteraría lo que afirma una casilla de un documento legal, así que quedó fuera.

## 5. Verificación

| Comprobación          | Resultado                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `npx tsc --noEmit`    | limpio                                                            |
| `npm run lint`        | 0 errores                                                         |
| `npx jest --ci`       | 2219 tests / 164 suites (antes 2176 / 163)                        |
| `npm run test:db`     | 130 tests / 12 suites                                             |
| `npx playwright test` | 27 pasados                                                        |
| Golden master         | 1 clave del mapper, 14 de 404 entradas de render — todo explicado |

**Prueba manual** (wizard de Insolvencia, sin apoderado, variando la deuda): el aviso
aparece a partir de $70.036.201 y no antes. El umbral es exactamente 40 × 1.750.905, el
del servidor, y el mensaje es el que produce `validateMinimaCuantia`. En toda la banda
$56.940.000–$70.036.200, donde antes discrepaban, los dos lados callan.

Lo que **no** se pudo cerrar por el navegador: el guardado en el servidor con una deuda
de la banda. El alta corta antes por documentos obligatorios y el sub-formulario de
acreedores del diálogo de edición no se dejó manejar por automatización. Ese lado queda
cubierto por `test:db` (que ejerce `createCase`/`updateCase` reales contra Postgres) y
por los tests de paridad del PR.

## 6. Pendiente

- Umbral de 1000 SMMLV sobre bienes (ítem 15 de `PENDIENTES_DECISION_LEGAL.md`).
- Diferencia de borde `<` / `>` entre documento y validador.
- PR 2 del Bloque 1: defectos del navegador y documentos (`fix/defectos-bloque1`).
