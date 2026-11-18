# Semana 16: los errores de validación se muestran solo después de la acción del usuario

**Rama:** `fix/errores-solo-despues-de-accion` (desde `origin/dev` `30b0c13`)
**PR:** [#151](https://github.com/insolventic/insolventic/pull/151) hacia `dev`. Abierto y **sin mergear**.
**Punto de partida:** `origin/dev` = `30b0c131`, `origin/main` = `8b817c55` (tag `prod-2026-10-19-8b817c5`).

---

## 1. Regla de producto

Un campo muestra su error solo si el usuario **salió de él** (blur) o **intentó avanzar o guardar** ("Siguiente", "Crear", "Guardar"). Nada valida al abrir. El ícono de error de cada pestaña del wizard y el toast "Campos incompletos" aparecen solo tras "Siguiente" o "Crear Caso". Un campo calculado de solo lectura, como "Deuda Total (calculada)", no se pinta en rojo antes del primer intento. Cerrar y reabrir un diálogo lo deja limpio.

## 2. Causa raíz

El bug del reporte (en Crear nuevo caso > Insolvencia aparecían "La deuda total es requerida" en rojo, el ícono en "1. Solicitante" y el toast "Campos incompletos con deudor, deuda total y operador") **no venía de validar al montar**. Abrir el wizard sin tocar nada no mostraba ningún error, ya en `dev`. Lo verifiqué en el navegador local. Las tres causas reales:

1. **Botón "+ Crear nuevo deudor" con submit implícito.** `DebtorSection` se renderiza dentro del `<form>` del caso y su `<Button>` no tenía `type`. Un clic abría el modal "Crear Nuevo Deudor" y a la vez enviaba el formulario del caso. Reproducido en local: aparecen las tres señales del reporte, con exactamente el mismo toast. La consola registra `Validation errors: {debtorId, totalDebt, operatorId}`. La sección también se usa en **Editar caso**, donde el mismo clic envía el formulario de edición y puede guardar el caso.
2. **"Siguiente" en la penúltima pestaña envía el wizard.** "Siguiente" (`type="button"`) y "Crear Caso" (`type="submit"`) ocupaban la misma posición de un ternario sin `key`. React reutiliza el `<button>` y solo le cambia el `type`. En el navegador real el re-render ocurre antes de la acción por defecto del clic, así que el botón ya es submit cuando el navegador la ejecuta, y el formulario se envía. Reproducido en Conciliación: "Siguiente" en "2. Partes" no lleva a "3. Solicitud", sino de vuelta a "1. Solicitante (!)" con el toast. En Insolvencia pasa lo mismo en la pestaña 6.
3. **Estado no reiniciado al reabrir.** "Nuevo Deudor", "Nuevo Acreedor", "Nuevo Usuario", "Nuevo Rol", "Editar Rol" y "Editar Deudor" siguen montados al cerrarse. Los de alta se reseteaban solo tras guardar con éxito, y los de edición solo cuando cambiaba la entidad. Un intento fallido + cerrar dejaba los errores visibles en la siguiente apertura. En "Editar Rol" volvía además el nombre borrado, es decir, la edición descartada.

Hallazgo adicional que bloqueaba la creación: **Acuerdo de apoyo** exigía "La deuda total es requerida". El `reset` al abrir ponía `totalDebt = ''` (los `defaultValues` ponían `'0'`), y apoyo no tiene pestaña de acreedores donde calcularla, así que no había forma de crear un acuerdo de apoyo desde el wizard.

**Lo que no se reprodujo en local**: que "El nombre es obligatorio" aparezca **al abrir** "Crear Nuevo Deudor". Ese diálogo ya reseteaba al abrir y validaba en blur (`mode: 'onBlur'`). El campo nombre recibe el foco automático al abrir, y registré los eventos de foco: no hay ningún blur espurio. El error aparece en cuanto el campo pierde el foco. En producción eso puede venir de una extensión o del autocompletado del navegador, que mueven el foco, o de un clic en otro campo o en el fondo, cosas que no hay en el navegador de pruebas. Con `onTouched` el comportamiento ante un blur real es el mismo, porque la regla lo permite. Lo que sí queda garantizado es que reabrir lo deja limpio.

## 3. Barrido

| archivo:línea                                                                  | Formulario                                                           | ¿Mostraba errores al abrir?                                                                           | Acción                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| `src/app/cases/components/create-case-dialog.tsx:242`                          | Wizard Insolvencia (2 centros)                                       | **Sí**, con el "+" de deudor y con "Siguiente" en la pestaña 6                                        | Corregido                        |
| `src/app/cases/components/create-case-dialog.tsx:242`                          | Wizard Conciliación                                                  | **Sí**, con "Siguiente" en la pestaña 2                                                               | Corregido                        |
| `src/app/cases/components/create-case-dialog.tsx:242`                          | Wizard Acuerdo de apoyo                                              | **Sí**, con "Siguiente" en la pestaña 2, y la deuda total era imposible de llenar                     | Corregido                        |
| `src/app/cases/components/create-case-dialog/debtor-section.tsx:120`           | Sección deudor (alta y edición)                                      | **Sí**, por submit implícito                                                                          | Corregido                        |
| `src/app/cases/components/edit-case-dialog.tsx:104`                            | Editar caso                                                          | **Sí**, por el "+" de deudor, que además podía guardar                                                | Corregido (vía `debtor-section`) |
| `src/app/cases/components/create-case-dialog/create-debtor-dialog.tsx:65`      | Crear Nuevo Deudor (rápido, desde el wizard)                         | No reproducido                                                                                        | `onBlur` → `onTouched`           |
| `src/app/debtors/components/create-debtor-dialog.tsx:52`                       | Nuevo Deudor                                                         | **Sí**, al reabrir                                                                                    | Corregido                        |
| `src/app/debtors/components/edit-debtor-dialog.tsx:56`                         | Editar Deudor                                                        | **Sí**, al reabrir el mismo deudor                                                                    | Corregido                        |
| `src/app/creditors/components/create-creditor-dialog.tsx:67`                   | Nuevo Acreedor                                                       | **Sí**, al reabrir                                                                                    | Corregido                        |
| `src/app/creditors/components/edit-creditor-dialog.tsx:73`                     | Editar Acreedor                                                      | No: al cerrar el acreedor pasa a `null`, al reabrir se resetea                                        | —                                |
| `src/app/creditors/components/contact-management/create-contact-dialog.tsx:44` | Nuevo Contacto                                                       | No: resetea al cerrar                                                                                 | —                                |
| `src/app/creditors/components/contact-management/edit-contact-dialog.tsx:44`   | Editar Contacto                                                      | No: se desmonta al cerrar                                                                             | —                                |
| `src/app/users/components/create-user-dialog.tsx:60`                           | Nuevo Usuario                                                        | **Sí**, al reabrir                                                                                    | Corregido                        |
| `src/app/users/components/edit-user-dialog.tsx:61`                             | Editar Usuario                                                       | No: se desmonta al cerrar                                                                             | —                                |
| `src/app/users/components/create-role-dialog.tsx:49`                           | Nuevo Rol                                                            | **Sí**, al reabrir                                                                                    | Corregido                        |
| `src/app/users/components/edit-role-dialog.tsx:49`                             | Editar Rol                                                           | **Sí**, al reabrir (con la edición descartada)                                                        | Corregido                        |
| `src/components/auth/change-password-dialog.tsx:43`                            | Cambiar contraseña                                                   | No: resetea al cerrar                                                                                 | —                                |
| `src/app/cases/components/case-details-dialog/payment-tracking-section.tsx:95` | Registrar pago (detalle del caso)                                    | **Sí**: mostraba el error de carga de la sección o el del intento anterior                            | Corregido                        |
| `src/app/reports/components/payment-tracking-report.tsx:925`                   | Registrar pago (reportes)                                            | No: resetea al cerrar y al cancelar                                                                   | —                                |
| `src/app/cases/components/edit-case-dialog/*-tab.tsx`                          | Agregar deuda / bien / dependiente / libranza / servicio / apoderado | No: modo `onSubmit`, se desmontan con el diálogo                                                      | —                                |
| `src/app/cases/components/phase-transition-dialog.tsx`                         | Cambio de fase                                                       | No: no muestra mensajes, deshabilita el botón                                                         | —                                |
| `src/app/cases/components/delete-case-dialog.tsx`                              | Eliminar caso                                                        | No: resetea la confirmación al abrir                                                                  | —                                |
| `src/app/cases/components/case-details-dialog/pre-generation-form.tsx:55`      | Datos previos a la generación                                        | No: "Faltan los siguientes datos" es un aviso informativo en ámbar, que es el propósito de la tarjeta | —                                |
| `src/app/profile/components/profile-settings.tsx:70`                           | Perfil                                                               | No: página con `onBlur`                                                                               | —                                |
| `login` / `register` / `forgot-password` / `reset-password`                    | Autenticación                                                        | No: los errores salen tras enviar. "Token no válido" describe el estado del enlace                    | —                                |

También pasé un script por los 97 `<Button>`/`<button>` sin `type` del proyecto. El único dentro de un `<form>` era el de `debtor-section.tsx`.

## 4. Qué se corrigió (10 commits, todos de `MaxitoJM <maxitojam@hotmail.com>`)

| Commit    | Cambio                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9ba859f` | `type="button"` en "Crear nuevo deudor"                                                                                                                                                                                                                                                |
| `3e18fab` | `key` distinta en "Siguiente" y "Crear Caso"                                                                                                                                                                                                                                           |
| `4d6638a` | Apoyo: `totalDebt = '0'` en el reset                                                                                                                                                                                                                                                   |
| `0fc6893` | Wizard: `mode: 'onTouched'`. "Siguiente" valida la pestaña que se deja (mensajes + ícono), sin toast y sin bloquear. Revalida los campos llenados por código si ya mostraban error. Fuera el `useMemo` que conservaba el ícono viejo (`trigger()` muta `formState.errors` en el lugar) |
| `e3542bc` | 6 diálogos: reset en cada apertura + `onTouched`. El modal rápido de deudor pasa de `onBlur` a `onTouched`. En Nuevo Usuario, el Select de rol revalida al elegir                                                                                                                      |
| `ac16f04` | "Registrar pago": error propio, que se limpia al abrir y cerrar                                                                                                                                                                                                                        |
| `99de381` | E2E Playwright                                                                                                                                                                                                                                                                         |
| `842bafe` | CLAUDE.md (convención de formularios) + CHANGELOG (bajo `1.0.0-rc.1`)                                                                                                                                                                                                                  |
| `1db3b68` | Segunda vuelta (§10): "Crear Caso" con errores lleva a la primera pestaña con error del wizard actual y enfoca su primer campo con error; tests de componente y E2E de los 3 wizards (avanzar vacío pasa, crear con errores bloquea, crear completo crea)                              |
| `1d13fd1` | Benchmark del mapper por razón de crecimiento en vez de milisegundos (§10)                                                                                                                                                                                                             |

Nota: el hook de pre-commit corre prettier sobre el archivo entero. Reformateó 4 líneas preexistentes de `create-case-dialog.tsx` en `3e18fab` y alineó una tabla de CLAUDE.md en `842bafe`. No reescribí historial para separarlo.

## 5. Qué NO se corrigió (y por qué)

- **"Siguiente" no bloquea**: decisión de producto confirmada (ver §10).
- **Formularios marcados "No"** en la tabla: se dejaron con su modo actual (`onSubmit`), que ya cumple la regla.
- **Deuda total con error en la pestaña 1 tras "Crear Caso" sin acreedores.** El mensaje sigue bajo "Deuda Total (calculada)" en "1. Solicitante", mientras el ícono de pestaña marca "3. Acreedores". Es un desfase previo, no de este PR. El error se limpia solo al cargar capital.
- **Editar caso no tiene test de componente propio.** Su único arreglo es el de `debtor-section.tsx`, cubierto por `debtor-section-crear-deudor.test.tsx` y por el wizard. Montar `EditCaseDialog` entero en jsdom no aportaba más.
- **Benchmark `placeholder-mapper` "<100ms"**: fallaba en la corrida paralela completa de jest, también en la línea base. Resuelto en la segunda vuelta (§10).
- **La pestaña "7. Documentos" pinta en rojo los documentos obligatorios al entrar** (borde rojo + ícono). Es un checklist de estado, no un mensaje de validación, y el pedido de la segunda vuelta fue no tocar nada más: queda anotado para decidir.

## 6. Tests

| Archivo                                                       | Casos                                                                                                                                                                                                                  | Sin el arreglo                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `tests/unit/components/debtor-section-crear-deudor.test.tsx`  | 1                                                                                                                                                                                                                      | falla                                                                      |
| `tests/unit/components/create-case-dialog-errores.test.tsx`   | 14: al abrir sin errores (3 tipos), "+ deudor", "Siguiente" recorre los 3 tipos, nodo del botón no reutilizado, apoyo, "Siguiente" destapa la pestaña, "Crear Caso" vacío, blur, deuda total se limpia, cerrar/reabrir | fallan los 2 de `3e18fab`/`4d6638a` y 3 de `0fc6893`                       |
| `tests/unit/components/dialogos-errores-tras-accion.test.tsx` | 28 (7 diálogos × al abrir / guardar vacío / blur / cerrar-reabrir)                                                                                                                                                     | fallan 12 (blur + reabrir en los 6 corregidos). El modal rápido ya cumplía |
| `tests/unit/components/payment-dialog-errores.test.tsx`       | 2                                                                                                                                                                                                                      | fallan los 2                                                               |
| `tests/e2e/case-wizard-errores.e2e.test.ts`                   | 4                                                                                                                                                                                                                      | contra el código de `dev` fallan "+ deudor" y "Siguiente"                  |

En jsdom el envío espurio de "Siguiente" no se reproduce, porque `act()` aplaza el re-render hasta después de la acción por defecto. El test unitario comprueba el mecanismo (nodo nuevo, el viejo desconectado) y el E2E el efecto real.

## 7. Gates

| Gate               | Resultado                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | ✅                                                                                                                    |
| `npm run lint`     | 0 errores. 5 warnings, todos en archivos sin commitear de `docs/gantt` y `docs/jira` (igual que en la línea base)     |
| `npx jest --ci`    | ✅ 2167/2167 tras la segunda vuelta (antes: 2157/2158 por el benchmark; línea base 2112/2113)                         |
| `npm run test:db`  | ✅ 12 suites, 130 tests                                                                                               |
| `npm run test:e2e` | ✅ 26/26 tras la segunda vuelta (antes 17/17)                                                                         |
| Golden master      | sin cambios (`tests/unit/documents/golden/` intacto, `mapper-golden` 28/28)                                           |
| NO TOUCH           | `schema.prisma`, migraciones, `templates/*.html` y `validation-rules.ts` sin cambios. Vercel, Neon y `main` sin tocar |

Rate limit de login: usé el bypass documentado (`CI=true E2E_DISABLE_RATE_LIMIT=1`) en el servidor dev local, mediante una configuración temporal `insolventic-dev-e2e` en `.claude/launch.json` (archivo ignorado por git). Se retiró al terminar.

## 8. Verificación manual en el navegador local (antes → después)

Usuario de seed `beatriz.malavera@insolventic.com` (tenant `armonia`), Postgres local `insolventic-db-verif`.

| Formulario                                                | Antes                                                                                                                                                 | Después                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Insolvencia, al abrir                                     | Sin errores                                                                                                                                           | Sin errores                                                                                                            |
| Insolvencia, clic en "+" de deudor                        | "Deuda Total (calculada)" en rojo + "La deuda total es requerida" + "El operador es requerido", ícono en "1. Solicitante", toast "Campos incompletos" | Solo se abre "Crear Nuevo Deudor". Ningún error en ninguno de los dos diálogos, sin toast                              |
| Crear Nuevo Deudor (rápido)                               | Sin error al abrir. Error al salir del campo vacío                                                                                                    | Igual. Tab fuera de "Nombre completo" → "El nombre es obligatorio". Reabrir → limpio                                   |
| Insolvencia, "Siguiente" ×6                               | (en Conciliación, ver abajo)                                                                                                                          | Llega a "7. Documentos". Ícono solo en "1. Solicitante" tras el primer "Siguiente", sin toast                          |
| Insolvencia, "Crear Caso" vacío                           | Toast + errores                                                                                                                                       | Toast "Campos incompletos", vuelve a "1. Solicitante (!)", "El operador es requerido"                                  |
| Insolvencia, cerrar y reabrir                             | —                                                                                                                                                     | Limpio                                                                                                                 |
| Conciliación, "Siguiente" en "2. Partes"                  | Vuelve a "1. Solicitante (!)" con toast "Debe seleccionar un deudor • Debe asignar un operador"                                                       | Llega a "3. Solicitud", sin toast                                                                                      |
| Acuerdo de apoyo, "Crear Caso" vacío                      | Errores `{debtorId, totalDebt, operatorId}`: exige la deuda total                                                                                     | Toast "Debe seleccionar un deudor • Debe asignar un operador". Ya no pide deuda total                                  |
| Editar caso, clic en "+" de deudor                        | (no lo ejecuté antes: habría enviado y posiblemente guardado el caso)                                                                                 | Abre "Crear Nuevo Deudor" encima de "Editar Caso INS-2025-001". Sin toast, sin guardado, sin errores                   |
| Nuevo Deudor: guardar vacío → cerrar → reabrir            | Reabre con "El nombre es requerido" y "El número de identificación es requerido"                                                                      | Reabre limpio                                                                                                          |
| Editar Deudor: borrar nombre → guardar → cerrar → reabrir | (no comprobado antes: el panel del navegador se ocultó; el código es idéntico al de Editar Rol)                                                       | Sin error mientras se borra. Al salir del campo, "El nombre es requerido". Reabrir → limpio y con "Ana Martínez López" |
| Nuevo Acreedor: guardar vacío → cerrar → reabrir          | Reabre con "El nombre es requerido" y "El NIT es requerido"                                                                                           | Reabre limpio                                                                                                          |
| Nuevo Usuario: ídem                                       | Reabre con "El nombre es requerido", "Email inválido" y "El rol es requerido"                                                                         | Reabre limpio                                                                                                          |
| Nuevo Rol: ídem                                           | Reabre con "El nombre del rol es obligatorio" y "Debe seleccionar al menos un permiso"                                                                | Reabre limpio                                                                                                          |
| Editar Rol: borrar nombre → guardar → cerrar → reabrir    | Reabre con el error **y con el nombre vacío**                                                                                                         | Al salir del campo, error. Reabrir → limpio y con "Administrador"                                                      |
| Registrar Pago Manual (detalle del caso)                  | (sin fallo de carga en local; cubierto por test)                                                                                                      | Abre sin errores, con "Registrar Pago" deshabilitado mientras no hay monto                                             |

Incidente menor durante la verificación: en "Editar Deudor", un clic por coordenadas cayó fuera del campo y "Guardar Cambios" guardó el deudor **sin cambios** en la base local de pruebas. Solo cambió `updatedAt`.

## 9. Limpieza al terminar

Apagados el servidor dev local y el contenedor `insolventic-db-verif`. El daemon de Docker sigue prendido: los contenedores de liftrank siguen corriendo.

## 10. Segunda vuelta (2026-10-27): "Siguiente" pasa, "Crear Caso" bloquea

Decisión de producto: **"Siguiente" NO bloquea** (marca los errores de la pestaña que se deja, con su ícono, y deja pasar). **"Crear Caso" SÍ bloquea** con errores: marca todas las pestañas con error, lleva a la primera pestaña con error y enfoca su primer campo con error. Aplica a los 3 wizards.

**Commit `1db3b68`** (uno atómico, código + tests):

- "Siguiente" ya se comportaba así desde `0fc6893`; se agregan tests para los 3 wizards.
- `onInvalid` recorre las pestañas **del wizard actual** (`currentTabs`). Antes recorría siempre la lista de Insolvencia; daba igual porque los campos requeridos están en "1. Solicitante", común a los tres, pero ya no depende de eso.
- **Foco en el primer campo con error.** No sirve el `shouldFocusError` de react-hook-form: al enviar desde la última pestaña las demás están desmontadas (Radix desmonta el contenido inactivo), y los Select de deudor y operador no registran `ref`. Lo apagué, y tras navegar busco en el DOM de la pestaña activa ya renderizada el primer control focusable con `aria-invalid="true"` (`FormControl` lo pone). El selector de deudor no usa `FormControl` (se fija con `setValue`), así que recibe `aria-invalid` a mano en `debtor-section.tsx`.

| Test                                                                                                               | Insolvencia | Conciliación | Apoyo |
| ------------------------------------------------------------------------------------------------------------------ | ----------- | ------------ | ----- |
| Componente: "Siguiente" con la pestaña vacía avanza y marca la pestaña                                             | ✅          | ✅           | ✅    |
| Componente: "Crear Caso" con errores no crea, marca pestañas, va a "1. Solicitante" y enfoca el selector de deudor | ✅          | ✅           | ✅    |
| Componente (`create-case-dialog-crear.test.tsx`): "Crear Caso" completo llama a `createCase`                       | ✅          | ✅           | ✅    |
| E2E: avanzar vacío pasa                                                                                            | ✅          | ✅           | ✅    |
| E2E: crear con errores bloquea, navega y enfoca                                                                    | ✅          | ✅           | ✅    |
| E2E: crear completo crea                                                                                           | ✅          | ✅           | ✅    |

Sin el cambio fallan los 3 tests de componente de bloqueo/foco.

El "Crear completo" de E2E **crea un caso por wizard** en la base de la corrida. En CI es la base descartable con seed. En local, las 3 corridas de esta sesión dejaron 9 casos en `insolventic-db-verif`: INSOL-000002 a 000004, CONC-000001 a 000003 y APOYO-000001 a 000003. Es la base de pruebas; no los borré. Usa al deudor **Carlos Rodríguez Silva** (soltero en el seed), porque con uno casado o en unión libre el servidor exige además los datos del cónyuge. En Insolvencia agrega una causa, un acreedor (nombre, tipo, tasa) y los 3 anexos obligatorios. Ni en local ni en CI hay credenciales de Drive, así que la subida de anexos y la generación de documentos fallan sin salir a Google; el caso queda creado igual.

**Commit `1d13fd1`, benchmark del mapper.** La versión intermedia, con mínimo de 5 corridas calientes y el mismo límite de 100 ms, **seguía fallando** en la corrida completa (121 ms). Esta máquina tiene 32 workers de jest en paralelo más el servidor dev, así que no era solo el arranque en frío: el tiempo absoluto depende del hardware y de la carga. El test ahora compara la **razón** entre 100 deudas / 50 bienes y 10 / 5, medidos intercalados en el mismo proceso (mínimo de 7 corridas tras calentar). Con 10× más elementos, un costo lineal no puede pasar de ×10 (medido: ×2,09 aislado, ×2,20 y ×2,10 en corridas completas). El umbral es 10: con la parte fija medida, un O(n²) daría ≈ ×13, así que un umbral más holgado lo dejaría pasar. Tres corridas completas de jest seguidas: 2167/2167.

**Gates tras la segunda vuelta:** tsc ✅ · lint 0 errores (los mismos 5 warnings de `docs/` sin commitear) · jest 2167/2167 ✅ · test:db 130/130 ✅ · E2E 26/26 ✅ · golden master sin cambios (ni `tests/unit/documents/golden/` ni el mapper se tocaron) · NO TOUCH respetado.
