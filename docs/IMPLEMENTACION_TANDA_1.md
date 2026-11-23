# Implementación — Tanda 1 de la auditoría del 2026-10-27

**Fecha:** 2026-11-09 · **Rama:** `fix/auditoria-formato-validacion` (desde `dev`, sin PR todavía) · **Estado:** Rama 1 terminada (incluido N6), sin push ni PR; Rama 2 (N2) sin empezar: arranca cuando la Rama 1 esté en `dev`.

Hallazgos de `docs/AUDITORIA_BLOQUE1_2026-10-27.md` que se cierran con código, verificados contra el código actual antes de tocar nada.

## 1. Qué se verificó

| #   | Hallazgo                                 | Resultado de la verificación                                                              |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| N2  | La primera cuota nace vencida            | Confirmado. Son **10** sitios que deciden «vencido», no 6 (ver §5)                        |
| N3  | Moneda con decimales                     | Confirmado: `formatCurrency` sin opciones de decimales + 4 `toLocaleString` sueltos       |
| N6  | Mensajes del servidor en inglés          | Confirmado y peor: el cliente recibía el `ZodError` completo como JSON (1.017 caracteres) |
| F1  | Etiqueta sin tilde                       | Confirmado, y no era la única: 9 palabras sin tilde en el mismo formulario                |
| F2  | Sin longitud máxima                      | Confirmado por lectura: 1.270 `z.string()`, 12 con `.max()`, 0 `@db.VarChar`              |
| F3  | Teléfono sin formato                     | Confirmado en los 7 sitios, más un octavo (`updateProfile`)                               |
| F4  | Montos sin tope                          | Confirmado: con `1e21` se imprimía `$ 1.000.000.000.000.001.300.000`                      |
| F5  | Montos negativos                         | Confirmado: una deuda de −1 imprimía `TOTAL_ACREENCIAS = "-$ 3"`                          |
| F6  | Ingreso 0 reemplazado por el de la ficha | Confirmado el `\|\|`, pero el problema real es otro (ver §2, F6)                          |
| A1  | Dos campos sin nombre accesible          | Confirmado                                                                                |
| A2  | Falta `aria-modal`                       | **Falso positivo** (ver §3)                                                               |
| A3  | Dos `<h1>` por pantalla                  | Confirmado                                                                                |
| $   | 2 campos de dinero sin `MoneyInput`      | Confirmado                                                                                |

## 2. Qué se corrigió (un commit por hallazgo)

| Commit    | Hallazgo | Qué cambia                                                                                                                                                                                                                                 |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1ab0b26` | N3       | `formatCurrency` sin decimales; `formatAmount` nuevo para inputs que ya muestran el `$`                                                                                                                                                    |
| `16f494a` | F4 + F5  | Helper compartido `src/features/case/monto-schemas.ts`: sin negativos y tope de 10^15 en los montos de casos, deudores y pagos. Solo schemas de entrada                                                                                    |
| `bb28329` | $        | "Monto" y "Valor pagado" con `MoneyInputField` + `parsearMonto`                                                                                                                                                                            |
| `55c8321` | A1       | Buscador de `/cases` con `aria-label`; en la deuda total, `FormControl` envuelve el input y no el div                                                                                                                                      |
| `549ae2a` | F1       | 9 tildes en `pre-generation-form.tsx`. Un barrido del resto de la interfaz no encontró más casos en texto visible                                                                                                                          |
| `377a184` | F6       | Ver abajo                                                                                                                                                                                                                                  |
| `e0e1ce7` | F3       | `src/lib/telefono.ts`: 7–15 dígitos con espacios, `+` inicial, `-`, paréntesis y «ext.». En altas siempre; en ediciones solo si cambió                                                                                                     |
| `67d7dac` | F2       | `src/lib/longitud-texto.ts`: 200 (nombres, documentos, ciudades), 254 (correos), 500 (direcciones), 10.000 (texto libre). En las acciones, no en los schemas. Al editar, solo lo que cambió                                                |
| `e5483d6` | A3       | La marca del encabezado deja de ser `<h1>`; `/dashboard`, `/creditors` y `/debtors` llevan un `<h1>` `sr-only`                                                                                                                             |
| `ffa8e33` | —        | CHANGELOG, conteo de tests, trampa de `CLAUDE.md` y Quick Win 9 del roadmap                                                                                                                                                                |
| `1ea9f92` | N6 (1/3) | `ErrorDeNegocio` y `mensajeDeError` (`src/lib/error-de-accion.ts`); locale `es` de Zod (`src/lib/zod-es.ts`), importado por los schemas de cada feature. Sin cambio en los `catch`                                                         |
| `60ae7e3` | N6 (2/3) | 51 `throw` de mensajes para el usuario pasan a `ErrorDeNegocio` (47 en las acciones, 2 en `case-access`, 1 en `generate-documents`, 1 en `generation-request`); `CaseAccessError` hereda de `ErrorDeNegocio`. Sin cambio de comportamiento |
| `73f6e3d` | N6 (3/3) | 84 `catch` en 18 archivos, más las 3 llamadas de la papelera, pasan por `mensajeDeError`. También el error por documento y el que `failGenerationRequest` guarda en la base                                                                |
| `3e095ea` | —        | CHANGELOG y conteo de tests con N6                                                                                                                                                                                                         |

**F6, lo que se encontró.** `createCase` y `updateCase` **nunca escriben `Case.monthlyIncome`**: ingresos, gastos, otros ingresos y certificación laboral se escriben en la **ficha del deudor**. El asistente de alta no muestra esos cinco campos, pero los enviaba con sus valores por defecto (`0`, `0`, `''`, `0`), y el schema del servidor ponía `hasEmployerCertification` en `false` por defecto: **crear cualquier caso dejaba la ficha del deudor con ingreso 0**. Se corrigió el formulario (valores por defecto `undefined` y sincronización con `??`) y el `.default(false)` del schema. El `||` del `placeholder-mapper` **no se tocó**: sobre datos nuevos no cambia nada, porque `Case.monthlyIncome` queda siempre nulo.

Cada corrección lleva al menos un test que falla con el código anterior (comprobado revirtiendo los archivos de producción del commit y corriendo el test).

## 3. Qué se descartó, y por qué

- **A2 (`aria-modal`)**: Radix Dialog no pone `aria-modal`, pero oculta el resto de la página con `aria-hidden` (`hideOthers`) y atrapa el foco, que es el patrón equivalente. Decisión: no agregarlo.
- **El `||` de `placeholder-mapper.ts:84/446/448`** (parte de F6): no se cambia mientras `Case.monthlyIncome` no tenga quién lo escriba. Ver §4.
- **N5 (Analytics y la CSP)**, ya fuera de esta tanda: falso positivo en producción. Los scripts se sirven desde `/_vercel/*` (mismo origen).

## 4. Riesgos pendientes

1. **N6 cambia lo que ve el usuario ante fallos técnicos.** Un fallo de base, de red o de Drive ahora muestra el genérico de la acción («Error al registrar el pago») y no el texto del fallo. Eso incluye «Error al subir archivo a Google Drive», que era un texto en español escrito a propósito en `google-drive.ts`: ahora se lee «Error al registrar pago» y el detalle queda en Sentry. Si se prefiere conservar ese texto para Drive, basta con lanzarlo como `ErrorDeNegocio` en `google-drive.ts`. Lo mismo pasa con el error que guarda una generación fallida: la pantalla muestra «No se pudieron generar los documentos».
1. **N6, el recuento.** El diagnóstico hablaba de 45 `catch` y 46 `throw`; los reales eran 87 sitios (84 más los 3 de la papelera; el primer `grep` no tomaba los que Prettier partió en varias líneas) y 51 `throw`. Un test guardián falla si un archivo de acciones vuelve a tener `throw new Error(`.
1. **F4/F5 en la edición**: el tope y el signo se validan siempre, no solo si el monto cambió. Si producción tuviera un monto negativo guardado (la auditoría lo reprodujo en local), editar ese registro obliga a corregirlo. No se pudo comprobar contra la base real.
1. **F2: el mensaje nombra el campo por su clave técnica** (`«otherCauseDetail»`, `«address»`): dice qué está mal, pero no con la etiqueta de la pantalla. Mejorarlo es un mapa clave → etiqueta, fuera de esta tanda.
1. **F3/F2 en las altas por el cliente**: el teléfono se valida en línea en los formularios de alta (va en sus schemas); la longitud máxima solo en el servidor, así que se ve como aviso al guardar y no bajo el campo.
1. **Datos existentes de F6**: las fichas de deudor que ya quedaron con ingreso 0 por este bug no se corrigen solas. Identificarlas requiere consultar producción (fichas con `monthlyIncome = 0` creadas o modificadas por un alta de caso); no se hizo.
1. **Esta rama no incluye el #186**: el `.claude/**` del lint y las cifras de esa rama van a chocar en `CHANGELOG.md`, `CLAUDE.md`, `README.md` y `docs/TESTS.md` al mergear la segunda; los conflictos son de texto.
1. **Nada se probó en el navegador.**

## 5. Riesgo pendiente — fichas de deudor con ingreso 0 (F6)

Hasta la corrección de F6 (commit `377a184`), **crear un caso escribía en la ficha del deudor** ingreso mensual 0, gastos 0, otros ingresos 0 con descripción vacía y certificación laboral en «no», salvo que el operador hubiera llenado la pestaña de ingresos laborales del asistente. El asistente de alta no muestra esos campos, así que nadie lo veía al crear el caso.

Consecuencias:

- **Las fichas de deudor** que tuvieron un alta de caso antes de esta corrección **pueden tener ingreso mensual, gastos u otros ingresos en 0** aunque se hubieran cargado antes con otro valor, y la certificación laboral en «no».
- **Los documentos ya generados** después de esas altas **pueden mostrar esos valores en 0** donde imprimen ingresos, gastos o capacidad de pago (el mapper toma el ingreso de la ficha del deudor cuando el caso no tiene uno propio, que es siempre).

**La abogada del cliente debe revisarlos**: los expedientes en curso cuyos documentos muestren ingresos, gastos o capacidad de pago en $0, y las fichas de deudor correspondientes. No se consultó ni se modificó ningún dato de producción, y no hay script de corrección: qué valor es el correcto en cada ficha solo lo sabe quien lleva el expediente.

## 6. N2 — plan de cambios (Rama 2, sin empezar)

Aprobado el 2026-11-09. Arranca desde `dev` actualizado, después de que la Rama 1 esté en `dev`. Condición previa: determinar y documentar en `src/lib/cuotas.ts` cómo se guardan y se leen hoy las fechas de vencimiento (en `generatePaymentSchedule`, en los formularios de edición y en la importación si existe), y detenerse si la convención es ambigua o mixta.

## 7. Pruebas manuales en el navegador (pendientes, las hace el responsable)

1. `/cases`: la tarjeta «Promedio por Caso» y la columna de deuda muestran pesos sin decimales.
2. Detalle de un caso → Pagos → «Registrar Pago Manual»: escribir `1500000` se ve como `1.500.000` y el pago queda registrado por $1.500.000. Lo mismo en Reportes → «Registrar Pago» («Valor pagado»).
3. Crear una deuda con capital `-1`: aparece «El monto no puede ser negativo» y no se guarda.
4. Crear un deudor con teléfono `abc-def-ghi`: error de formato bajo el campo. Con `+57 300 123 4567` o `601 555 1234 ext. 12`: se guarda.
5. Editar un deudor viejo **sin tocar su teléfono**: se guarda aunque el teléfono guardado no cumpla el formato.
6. **F6, el importante**: anotar el ingreso mensual de un deudor, crear un caso nuevo para él **sin pasar por la pestaña de ingresos**, y volver a la ficha del deudor: el ingreso debe seguir igual (antes quedaba en $0).
7. Pegar un texto de más de 10.000 caracteres en «Otra causa» al crear un caso: el alta se rechaza con el aviso de longitud.
8. Formulario previo a la generación (paquetes 2 y 3): etiquetas y aviso de faltantes con tilde.
9. Con lector de pantalla (NVDA o VoiceOver) en `/cases`: el buscador se anuncia como «Buscar casos por nombre, ID o cédula», y la navegación por títulos encuentra un solo título principal por pantalla («Gestión de Casos», «Panel principal» en `/dashboard`).
10. El encabezado se ve igual que antes (la marca solo dejó de ser `<h1>`).
11. **N6**: los avisos de error de cualquier pantalla son frases cortas en español y nunca un bloque de texto técnico ni una lista en inglés. Ejemplo reproducible: crear un deudor con teléfono `abc` muestra «El teléfono debe tener entre 7 y 15 dígitos…». Un fallo de base o de Drive no se puede provocar desde la interfaz; ese caso lo cubre `tests/unit/security/errores-al-cliente.test.ts`.
