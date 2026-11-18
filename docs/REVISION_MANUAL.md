# Revisión del manual de usuario — cierre

Rama `docs/manual-usuario-capturas`, sin push. Este archivo no está
commiteado: es para revisar antes de aprobar.

## Estado al cierre

- **50 figuras** en 17 secciones (1, 3, 4.1, 4.2, 4.3, 4.3.1, 4.4, 5, 6, 7,
  8.1, 8.2, 8.4, 9, 10, 11 y 12), todas generadas por
  `scripts/manual-capturas/` con datos 100 % sintéticos.
- **Discrepancias de texto corregidas:** las autorizadas en los lotes 1 a 3
  y, en los pases finales, D26, D28, D29, D30, D31, D27 y D32, más la sigla
  "CRUD" de §5, un commit cada una (ver `git log origin/dev..HEAD`). Solo
  D32 deja una figura desactualizada: la 10-2 (ver la lista 1). No se
  regeneró nada.
- **Índice y verificaciones en el repositorio:** `indice.ts` y
  `verificar.ts` en `scripts/manual-capturas/`, documentados en su README
  (commit propio, sin cambios en `package.json`).
- **50 commits** sobre `origin/dev`, todos con autor
  `MaxitoJM <maxitojam@hotmail.com>` y sin trailers. Uno de un lote anterior
  lleva "¿" en el asunto (`1b61209`); no se reescribió.

## Verificaciones (último pase)

| Verificación                                                                                            | Resultado                                                |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `npx tsx scripts/manual-capturas/verificar.ts`: numeración consecutiva por sección, en orden de lectura | OK, 50 figuras en 17 secciones                           |
| Figuras referenciadas en el texto / con `alt` / en el índice                                            | 50 / 50 / 50                                             |
| Referencias rotas, anclas sin pie, PNG sin usar, listas de leyenda fusionadas                           | 0                                                        |
| Índice de figuras                                                                                       | Al día (regenerarlo no produce cambios)                  |
| `npx jest tests/unit/payments/comprobante-limite-tamano.test.ts`                                        | 17 de 17 pasan                                           |
| `npx tsc --noEmit`                                                                                      | 0 errores                                                |
| `npm run lint`                                                                                          | 0 errores, 0 warnings                                    |
| Determinismo (dos corridas completas)                                                                   | 50 figuras idénticas byte a byte                         |
| Barrido de datos reales (sin OCR disponible: volcado de la base de capturas, datos del script y manual) | Ninguna coincidencia con nombres, correos, cédulas, etc. |

El barrido cotejó los 70 nombres, correos, cédulas, tarjetas profesionales,
teléfonos y NIT de `src/prisma/seed.ts`, las identidades de git y los correos
de los `.env*` locales. Solo hubo coincidencias con palabras genéricas
(`juridica`, `cobranza`, `info` como parte local de un correo; "de
crédito"). Los placeholders con nombres de la app ("María González Pérez",
"52123456", "Pedro González", `maria@email.com`) solo están en "Nuevo
Deudor": la figura 5-2 los muestra reemplazados por datos sintéticos y la
pestaña Contacto no aparece en ninguna figura.

---

## 1. Decisiones pendientes

Ninguna de estas se tocó en el manual.

1. **D2 — ¿La Operadora elimina casos?** `src/prisma/seed.ts:362` le da
   "Eliminar casos". El manual se contradice: §2 dice que la Operadora "No
   elimina casos"; §4.3.1 dice que ve la papelera porque puede eliminar, y la
   Figura 4.3.1-2 lo muestra. Opciones: (a) corregir §2 al permiso real; (b)
   quitarle el permiso en el seed de la app y en las bases existentes, y
   ajustar §4.3.1 y su figura.
2. **D10 — Apoderados.** El título de §5 es "Deudores, acreedores,
   apoderados", pero no hay módulo de apoderados: se cargan dentro del caso
   (pestaña de apoderados de Editar caso,
   `edit-case-dialog/apoderados-tab.tsx`, y Partes de la conciliación,
   Figura 4.1-11). Opciones: quitar "apoderados" del título o agregar un
   párrafo que diga dónde se cargan.
3. **D7 / D19 — Segunda pasada.** Acuerdo de Apoyo, Calendario y Mi Perfil
   no tienen sección ni figuras.
4. **Figura 10-2 pendiente de regenerar tras corregir el texto del
   diálogo.** §10 ya dice que el correo de alta trae un enlace de activación
   de 48 horas (D32), pero la figura muestra el aviso "Credenciales
   Automáticas — Se generará una contraseña segura y se enviará por correo
   electrónico al usuario", que dice lo contrario. Primero hay que corregir
   ese texto en la app (hallazgo de UI 6); después, regenerar la sección 10
   (`--seccion 10`, que necesita un reset de la base de capturas).
5. **Pantalla sin figura: la confirmación "Correo de recuperación
   enviado"** (`/forgot-password`). Sin SMTP la acción responde con error,
   así que §1 muestra solo el formulario (Figura 1-5) sin enviarlo.
   Capturarla exigiría falsear la respuesta del servidor; queda sin figura.

---

## 2. Hallazgos de UI, por importancia

No se cambió código de la app. Cada hallazgo indica dónde se ve y dónde está.

### Prioritarios

1. **La "Deuda Total" del deudor no se actualiza al crear un caso.** Un
   deudor nuevo queda en $0 en la lista de deudores aunque su caso sume
   45.440.000 (Figura 5-1, fila de Jorge): la app muestra un dato falso.
   `createCase` solo actualiza los ingresos del deudor
   (`src/features/case/actions.ts:621`); la columna lee `Debtor.totalDebt`
   (`src/app/debtors/components/debtor-management.tsx:300`).
2. **El selector de deudor aparece vacío al editar un caso.** "Editar Caso"
   muestra "Seleccione un deudor existente" aunque el caso tiene deudor y
   ese deudor está en la lista (verificado en build de producción local, con
   la operadora, que tiene "Ver todos los casos"). Quien edita puede creer
   que falta y elegir otro. La Figura 4.3-1 se recortó en el encabezado para
   no mostrarlo como correcto. `src/app/cases/components/edit-case-dialog.tsx:176`
   (fija `selectedDebtorId`) y `:365`; el `Select` está en
   `src/app/cases/components/create-case-dialog/debtor-section.tsx:104`.
   Causa no investigada.
3. **Una cuota vencida se muestra como "Pendiente".** En la pestaña Pagos
   del caso, `getEffectiveStatus` solo reconoce `pagado` y `pendiente`: una
   cuota que el proceso diario ya pasó a `vencido` cae en "Pendiente".
   `src/app/cases/components/case-details-dialog/payment-tracking-section.tsx:84`.
4. **El estado `parcial` nunca se asigna.** Registrar un pago deja la cuota
   en `pagado` aunque el monto sea menor al de la cuota.
   `src/features/payment/actions.ts:424` y `:542`. (El manual lo advierte en
   §8.3.)
5. **Los casos asignados a un usuario cuentan los de la papelera.**
   `src/features/user/actions.ts:132` (`assignedCases` sin `CASO_ACTIVO`).

### Media

6. **El alta de usuario promete una contraseña por correo y envía un
   enlace.** El diálogo dice "Se generará una contraseña segura y se enviará
   por correo electrónico al usuario" y el aviso de éxito habla de
   "credenciales de acceso", pero el correo lleva un enlace de activación
   (el texto de §10 ya está corregido, D32). Se ve en la Figura 10-2. `src/app/users/components/create-user-dialog.tsx:244`
   y `:92`.
7. **El monto del pago es `type="number"`, sin separador de miles** (ya
   conocido: son los 2 campos de dinero sin normalizar que registran las
   instrucciones del repositorio): `payment-tracking-section.tsx` y
   `src/app/reports/components/payment-tracking-report.tsx`.
8. **El aviso de contraseña pendiente nombra un enlace que no existe**: dice
   "¿Olvidaste tu contraseña?" y el enlace se llama "¿Olvidó su contraseña?"
   (Figura 1-4). `src/features/auth/actions.ts:232`.
9. **La recuperación de contraseña dice si un correo está registrado** ("El
   correo electrónico no está registrado…"), lo que permite averiguar qué
   correos tienen cuenta. Según el comentario del código, fue pedido así.
   `src/features/auth/actions.ts:752`.

### Baja: presentación y textos

10. **Las pestañas del detalle del caso se parten en dos filas** a 1440 px, y
    "9. Pagos" / "10. Actividad" quedan montadas sobre el recuadro "Fase
    actual" (Figura 7-1). `src/app/cases/components/case-details-dialog.tsx:105`.
11. **"INSOLVENCY" sin traducir** en la columna Tipo de Trazabilidad de
    Pagos (Figura 8.4-1). `src/app/reports/components/payment-tracking-report.tsx:702`
    y `:1082`.
12. **El subtítulo del alta de conciliación dice "caso de insolvencia".**
    `src/app/cases/components/create-case-dialog.tsx:1225`.
13. **Cédula de 10 dígitos mal agrupada**: 1020745318 se muestra
    "1020.745.318". `src/app/cases/components/case-table.tsx:65`.
14. **Montos con decimales en algunos promedios** ("Promedio por Caso"):
    `formatCurrency` no fija decimales. `src/lib/utils.ts:23`.
15. **Dos tarjetas casi iguales en Usuarios**: "Total Usuarios" y "Total de
    Usuarios". `src/app/users/page.tsx:125` y `:138`.
16. **"…del todos los paquetes para este caso"** en el aviso del generador.
    `src/app/documents/components/document-generation.tsx:604`.
17. **Dos tarjetas "Casos por Fase" en el dashboard.**
    `src/app/dashboard/components/dashboard-stats.tsx:112` y
    `src/app/dashboard/components/dashboard-charts.tsx:107`.
18. **"Armonia" sin tilde** en el selector de centro (D23; el manual no se
    cambió). `src/app/login/components/database-selector.tsx:28`.
19. **Si el correo no se puede enviar, la recuperación culpa a la
    dirección** ("Verifique la dirección de correo…"), aunque la falla sea
    del servidor. `src/features/auth/actions.ts:795`.

---

## 3. Cómo regenerar las figuras

Detalle completo en `scripts/manual-capturas/README.md`.

1. **Base local de capturas** (una sola vez):

   ```bash
   docker run -d --name insolventic-manual-pg -e POSTGRES_USER=manual -e POSTGRES_PASSWORD=manual -e POSTGRES_DB=insolventic_manual_test -p 127.0.0.1:54330:5432 postgres:16-alpine
   ```

2. **Apuntar a esa base**, en la misma terminal. El script aborta si
   `DATABASE_URL` no es exactamente `127.0.0.1:54330/insolventic_manual_test`,
   y esa base **se borra y se recrea en cada corrida**:

   ```bash
   export DATABASE_URL=postgresql://manual:manual@127.0.0.1:54330/insolventic_manual_test
   ```

3. **Correr** (`--build` la primera vez y cada vez que cambie la UI):

   ```bash
   npx tsx scripts/manual-capturas/capturar.ts --build
   ```

   Una sección: `--seccion 7` (arrastra las que necesita, p. ej. 4.1).

4. **Revisar** con `git status docs/manual-usuario/img`: si la UI no cambió,
   no debe haber cambios. Las figuras que sí cambien se revisan a ojo antes
   de commitear.
5. **Manual:** insertar o ajustar las figuras y correr

   ```bash
   npx tsx scripts/manual-capturas/indice.ts
   npx jest tests/unit/payments/comprobante-limite-tamano.test.ts
   ```

   `indice.ts` regenera el índice de figuras y los anchos y corre
   `verificar.ts`, que también se puede correr solo.

Tener en cuenta:

- **Límite de login:** una corrida completa usa 5 intentos, el máximo de la
  app cada 15 minutos por IP; dos corridas seguidas necesitan esa espera
  entre una y otra.
- **Valores que dependen del día real:** "Casos este Mes", "Audiencias
  Próximas" y "Pagos Vencidos" del dashboard coinciden con el seed solo si
  se regenera en noviembre de 2026. Todo lo demás es estable.
- **Sin servicios externos:** Drive, SMTP, Sentry y Upstash van vacíos y la
  salida HTTP del servidor apunta a un puerto cerrado. El build (`--build`)
  sí descarga la fuente Inter de Google Fonts, como `npm run build`.
- **Al agregar o renombrar una figura:** formato "Figura <sección>-<n>",
  ancla `figura-<sección con guiones>-<n>`, `alt` descriptivo, pie y leyenda
  con ①…; el ancho y el índice los fija `indice.ts`.
