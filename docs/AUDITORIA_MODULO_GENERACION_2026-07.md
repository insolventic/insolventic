# Auditoría Técnica — Módulo de Generación de Documentos

**Fecha:** 2026-07-10
**Alcance:** `src/features/document/*`, `src/lib/html-to-pdf.ts`, `src/lib/html-to-docx.ts`, flujo de creación de casos en `src/features/case/actions.ts`, plantillas en `templates/`.

---

## 1. Resumen ejecutivo

El módulo está bien encaminado: separación por capas razonable (config de plantillas → mapper de placeholders → motor de render → conversión PDF → subida a Drive → server actions), autenticación y scoping multi-tenant consistentes, y un motor de plantillas propio (`handlebars-lite`) con tests unitarios.

Se encontraron **2 bugs funcionales**, **1 riesgo de seguridad medio**, y varios problemas de duplicación/robustez. En esta auditoría se corrigieron los bugs y la deuda de duplicación más grave; el resto queda documentado como recomendaciones priorizadas.

---

## 2. Hallazgos

### 2.1 Bugs corregidos en esta auditoría

**B1 — PDFs de Conciliación y Acuerdos de Apoyo se generaban sin estilos (severidad: alta).**
`generateDocument`, `previewDocument` y `batchGenerateDocuments` pasaban siempre `templates/insolvency` como directorio de assets, pero las plantillas de conciliación referencian `./CSS/...` y `../CSS/...` dentro de `templates/conciliation/`. El CSS nunca se encontraba (solo un `console.warn`) y el PDF salía con el estilo de emergencia.
*Fix:* nuevo helper `getTemplateAssetsBaseDir(template)` en `templates-config.ts`; todos los caminos de generación resuelven assets según el `caseType` de la plantilla.

**B2 — Resolución incorrecta de rutas relativas en `inlineAssets` (severidad: alta, relacionado con B1).**
El if/else de resolución de rutas tenía **ambas ramas idénticas** (`path.join(assetsBaseDir, href)`), así que `../CSS/x.css` en una plantilla anidada (p. ej. `Actas de Conciliacion/Acta General.html`) resolvía a `templates/CSS/x.css`, que no existe.
*Fix:* `inlineAssets` ahora recibe `docDir` (directorio del HTML fuente): las rutas raíz (`/CSS/...`, convención de insolvencia) resuelven contra el directorio base del tipo de caso, y las relativas (`./`, `../`) contra el directorio de la propia plantilla. `htmlToPdf`, `batchHtmlToPdf`, `htmlToDocx` y `batchHtmlToDocx` propagan el parámetro (con override por documento en los batch).

**B3 — `mimeType` siempre 'application/pdf' en BD (severidad: media).**
Todos los registros `Document` se guardaban como PDF aunque el archivo fuera HTML, DOCX o el Excel consolidado.
*Fix:* `inferMimeType(fileName)` en el nuevo `persistence.ts`, usado por todos los caminos de persistencia.

### 2.2 Deuda corregida (refactor)

**R1 — Quintuplicación del `include` de Prisma y de la persistencia de documentos.**
El mismo bloque `include` de ~20 líneas estaba copiado 5 veces en `actions-generation.ts` y una sexta en `case/actions.ts`; el bucle de `prisma.document.create` estaba copiado 5 veces. Cualquier relación nueva exigía tocar 6 sitios (fuente clásica de bugs de "placeholder vacío porque faltó el include").
*Fix:* nuevo módulo `src/features/document/persistence.ts` con `CASE_GENERATION_INCLUDE`, `fetchCaseForGeneration()` y `persistGeneratedDocuments()` (usa `createMany` — 1 query en vez de N). Es un módulo normal (no `'use server'`) para poder compartirlo sin exponer helpers como server actions.

**R2 — Cuadruplicación del bucle de generación.**
`generateDocumentsForNewCase/Admission/Agreement/Failure` repetían el mismo bucle. Extraído a `generateFromTemplates()` en `generate-documents.ts`.

**R3 — Rate limiting inconsistente (seguridad/estabilidad).**
Solo `regenerateCaseDocument` tenía rate limit; `generateInitialDocuments`, `generateAdmissionDocuments`, `generateAgreementDocuments` y `generateFailureDocuments` (cada una lanza Puppeteer + N llamadas a Drive) no tenían ninguno. Un usuario podía disparar generaciones masivas concurrentes.
*Fix:* helper `checkGenerationRateLimit(userId)` aplicado a las 5 acciones.

**R4 — Llamadas redundantes a Drive por subcarpetas.**
`createDocumentSubfolder` resolvía la jerarquía `01-Generados/...` de nuevo por **cada documento** del lote (cada resolución son 1–2 llamadas HTTP a la API de Drive por nivel). Añadida caché `Map` por lote de generación.

**R5 — `section: 'GENERADO'` ausente.**
Los documentos generados no se clasificaban en la sección del layout v1 pese a existir la columna. Corregido en la persistencia unificada.

### 2.3 Hallazgos NO corregidos (recomendaciones priorizadas)

**P1 — Un navegador Chromium por documento (performance, prioridad alta).**
`generateFromTemplates` → `generateDocument` → `htmlToPdf` lanza y cierra un Chromium **por cada documento**. Para la creación de un caso (~6 documentos) son ~6 arranques de navegador (2–5 s cada uno en serverless). Ya existe `batchHtmlToPdf` (un navegador, N páginas) y `batchGenerateDocuments` en `actions.ts` lo usa — pero el flujo de creación de casos no. Recomendación: reestructurar `generateFromTemplates` en fases (1: validar + rellenar HTML; 2: `batchHtmlToPdf`; 3: subir), igual que hace `batchGenerateDocuments`. No se hizo aquí porque reordena el manejo de errores por documento y merece su propia tanda de pruebas E2E.

**P2 — Inyección de HTML en documentos (seguridad, prioridad alta).**
`substituteVars` inserta los valores sin escapar. Los datos del deudor/acreedores (nombres, direcciones) los captura el usuario y acaban crudos en el HTML. Riesgo doble: (a) un valor con `<script>` o markup rompe/manipula el PDF legal; (b) `previewDocument(format: 'html')` devuelve ese HTML al cliente — si el front lo renderiza (iframe/`dangerouslySetInnerHTML`), es un XSS almacenado dentro del tenant. Recomendación: escapar HTML en `mapCaseToPlaceholders` para todos los campos escalares, dejando sin escapar solo los placeholders que son HTML construido por el sistema (tablas `CUADRO_*`, `LISTA_*`, `PROYECCION_*`), idealmente marcándolos con un prefijo (`HTML_`) o un `Set` de exclusión.

**P3 — Doble generación concurrente (consistencia, prioridad media).**
`generateInitialDocuments` no comprueba si el caso ya tiene documentos generados ni usa lock alguno: doble clic o reintento ⇒ carpetas/documentos duplicados en Drive y filas duplicadas en BD. Recomendación: guard temprano (`driveFolderId` ya existe + count de generados > 0 ⇒ pedir confirmación/regeneración) o un flag `generationInProgress` con `updateMany` condicional como lock optimista.

**P4 — Generación en background sin observabilidad (robustez, prioridad media).**
En `createCase` la generación se dispara fire-and-forget con `.then/.catch` a `console.error`. Si falla (Drive caído, Chromium ausente), el usuario no lo ve y el caso queda sin carpeta ni documentos, sin reintento. Recomendación: persistir el resultado (campo `documentGenerationStatus` en `Case` o notificación al operador vía el módulo de notificaciones ya existente) y exponer un botón "reintentar" (ya existe `generateInitialDocuments` como acción manual — basta con señalizar el fallo). Nota adicional: en Vercel, una promesa no esperada puede ser cortada al terminar la respuesta; considerar `waitUntil` o mover a un job.

**P5 — Emparejamiento frágil en `validateDocumentRequirements` (correctitud, prioridad media).**
Los requisitos se buscan con `templateKey.includes(key)` / `template.name.includes(...)`. Es sensible a renombres y a colisiones por prefijo (p. ej. cualquier plantilla futura cuyo id contenga `check-list`). Recomendación: mover los requisitos a un campo `requirements` dentro de cada entrada de `ALL_TEMPLATES` (lookup exacto, imposible desincronizar).

**P6 — Versionado de documentos desconectado (código muerto, prioridad media).**
`archiveSupersededDocument` (storage-helpers.ts) no tiene ningún llamador, y depende de `Document.templateId`, que **ningún** camino de persistencia rellena (además ese FK apunta al modelo `DocumentTemplate` de BD, cuyos ids cuid no coinciden con los ids de config tipo `'solicitud-insolvencia'`). `regenerateCaseDocument` hoy empareja el documento previo por `name`, no por template. Recomendación: decidir una fuente de verdad (sugerido: columna `templateConfigId String?` sin FK, o sembrar `DocumentTemplate` con los ids de config) y conectar el archivado a `regenerateCaseDocument`.

**P7 — Sin transaccionalidad BD↔Drive (consistencia, prioridad baja).**
Subida a Drive y escritura en BD no son atómicas: un fallo entre ambas deja archivos huérfanos en Drive o registros sin archivo. Aceptable para el volumen actual; documentar y, si crece, introducir una tabla de outbox o reconciliación periódica contra Drive.

**P8 — `handlebars-lite`: bloques anidados dentro de `{{#each}}` (limitación conocida, prioridad baja).**
Un `{{#if}}` dentro de un `{{#each}}` se resuelve contra el contexto padre, no contra el ítem (el diseño "innermost-first" lo impide). Está señalado como YAGNI en el propio archivo y las plantillas actuales no lo usan — pero conviene un test que lo haga explícito para que nadie escriba una plantilla que dependa de ello.

**P9 — Cobertura de tests del corazón del módulo (prioridad media).**
Hay buenos tests para `handlebars-lite` y `placeholder-mapper`, pero **cero** tests para `generate-documents.ts` (validación de requisitos, saltos/errores por documento, rutas de carpetas v0/v1) ni para `templates-config.ts` (invariantes: ids únicos, archivos de plantilla existentes en disco — un rename silencioso hoy solo falla en runtime). Recomendación: test de invariantes que recorra `ALL_TEMPLATES` y haga `fs.access(getTemplatePath(t))`, y tests de `validateDocumentRequirements` con casos sin acreedores/sin propuesta de pago.

### 2.4 Lo que está bien

- **Seguridad de acceso:** todas las server actions autentican, verifican permisos (`P.GENERAR_DOCUMENTOS`/`P.VER_DOCUMENTOS`) y scopean por `tenantId` en cada query. `failureType` pasa por un mapa blanco (no hay path traversal posible); los ids de plantilla solo resuelven contra `ALL_TEMPLATES` (config estática), nunca contra input del usuario.
- **Diferenciación de los 3 servicios:** limpia y declarativa — `caseType` en cada plantilla + `TEMPLATES_BASE_PATHS` + etiquetas de carpeta (`Insolvencia`/`Conciliación`/`Acuerdos de Apoyo`). Añadir un cuarto tipo de trámite sería localizado.
- **Errores por documento:** `generateDocument` nunca lanza; devuelve `status: success|error|skipped` con razón, de modo que un documento fallido no aborta el lote. Mismo patrón en los batch de PDF/DOCX.
- **Estructura de expedientes v1** (`Insolventic/{Centro}/{Tipo}/{Año}/{Nº - Apellido}/01-Generados…04-Historial`) con retrocompatibilidad v0 y migrador perezoso idempotente.
- **`handlebars-lite`:** decisión acertada frente a una dependencia completa; puro, testeado, con fast-path que garantiza salida byte-idéntica para las plantillas legadas.
- **Validación previa por documento** (`DOCUMENT_REQUIREMENTS`): requisitos de datos + variables críticas + % de cobertura antes de generar — buen diseño (solo su mecanismo de emparejamiento es frágil, ver P5).

---

## 3. Archivos modificados en esta auditoría

| Archivo | Cambio |
|---|---|
| `src/features/document/persistence.ts` | **Nuevo** — include compartido, `fetchCaseForGeneration`, `persistGeneratedDocuments` (createMany + section + mimeType), `inferMimeType` |
| `src/features/document/templates-config.ts` | Nuevo helper `getTemplateAssetsBaseDir` |
| `src/features/document/generate-documents.ts` | Assets por tipo de caso + `docDir`; helper `generateFromTemplates`; caché de subcarpetas Drive |
| `src/features/document/actions-generation.ts` | Usa persistence.ts (−~180 líneas duplicadas); rate limit en las 5 acciones; mimeType correcto en regeneración |
| `src/features/document/actions.ts` | Batch: assets/docDir por documento según su plantilla |
| `src/features/case/actions.ts` | Usa `fetchCaseForGeneration` + `persistGeneratedDocuments` |
| `src/lib/html-to-pdf.ts` | `inlineAssets` distingue rutas raíz vs. relativas (`docDir`); overrides por documento en batch |
| `src/lib/html-to-docx.ts` | Propaga `docDir` y overrides por documento |

**Verificación:** `tsc --noEmit` limpio · 23 suites / 422 tests en verde · ESLint sin errores nuevos (1 warning preexistente en `case/actions.ts`).

---

## 4. Hoja de ruta sugerida (próxima fase)

1. **P2** Escapado HTML de placeholders escalares (seguridad).
2. **P1** Batch de Chromium en el flujo de creación de casos (performance ~5×).
3. **P3 + P4** Lock anti-duplicados + estado visible de la generación en background.
4. **P6** Conectar el versionado (`archiveSupersededDocument`) definiendo la fuente de verdad del `templateId`.
5. **P5 + P9** Requisitos dentro de `ALL_TEMPLATES` + test de invariantes de plantillas en disco.
