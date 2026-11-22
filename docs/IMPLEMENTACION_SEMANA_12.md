# Semana 12 — `resolveCenterFolderName`: resolución del centro por SLUG, no por cuid

**Fecha:** 2026-10-18
**Base:** `dev` @ `4e5a342` (con el merge de #145 incluido) · **Rama:**
`fix/centro-carpeta-tenant` · **PR:** abierto hacia `dev`, **sin mergear**
**Origen:** hallazgo propio durante la verificación de #145 — la generación
de documentos de Conciliación/Insolvencia nunca pudo determinar el centro
de conciliación.
**Sin cambios de schema ni migraciones, sin tocar `templates/*.html`,
`validation-rules.ts`, `ConciliationCenter` ni el seed.**

> **Este documento NO está commiteado.**

---

## 1. Causa raíz

`resolveCenterFolderName` (`src/lib/centro-conciliacion.ts`) resuelve el
nombre de la carpeta de Drive de un centro buscando en `CENTRO_BY_TENANT`,
un mapa indexado por el **SLUG** del centro (`'armonia'` |
`'constructores-paz'`).

`authenticateUser()` (`src/features/auth/actions.ts`) siempre devolvió
`tenantId: tenant.id` — el **cuid** del `Tenant`, correcto para las
queries de Prisma (`Case.tenantId` es una FK a `Tenant.id`) pero **no**
es el slug.

Los 7 llamadores reales de `resolveCenterFolderName` (`actions.ts` ×3,
`actions-generation.ts` ×1, `generation-job.ts` ×1, `storage-helpers.ts`
×2) le pasaban ese `tenantId` del cuid. `CENTRO_BY_TENANT[cuid]` nunca
encontraba la fila, no había `centroConciliacionNombre` escribible desde
ninguna pantalla que lo salvara por el fallback, y la función terminaba
lanzando:

```
No se pudo determinar el centro de conciliación para el tenant "<cuid>".
Asegúrese de que el tenant esté configurado en CENTRO_BY_TENANT.
```

Es decir: **toda generación de documentos que llegara a esta función
fallaba siempre**, para los dos centros, sin excepción — no un caso
límite.

### Por qué no se notó antes

Dos sistemas hermanos (`src/lib/branding-assets.ts` y
`src/lib/membrete-centro.ts`) tenían el mismo defecto y ya se habían
arreglado en el PR `#128` (2026-10-09/10, ver
`docs/CHECKPOINT_2026-10-09.md`) con el patrón correcto:
`tenantSlugDelCaso(caseData)`, que lee `caseData.tenant.slug` —la
relación que `CASE_GENERATION_INCLUDE` ya trae en todos los caminos de
generación— en vez de `caseData.tenantId`. Ese arreglo **nunca cubrió**
`centro-conciliacion.ts`: el checkpoint que lo documenta no lo menciona.

## 2. Cuándo se introdujo, y si afecta a `main`

| Hecho                                                                                                             | Commit                                                                                                 | Fecha                  |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| `authenticateUser()` empieza a devolver el cuid (`tenant.id`) como `tenantId`                                     | `72493d9`                                                                                              | 2026-02-05             |
| `resolveCenterFolderName` se crea, indexada por slug, y se cablea a los 7 llamadores con ese `tenantId` (el cuid) | `0b3c085` — _"feat: separar carpetas de Google Drive por centro de conciliación (Armonia/Construpaz)"_ | 2026-03-04             |
| Dos commits posteriores tocan el mismo archivo sin corregir el desajuste                                          | `29d6456`, `dc8115b`                                                                                   | 2026-03-09, 2026-03-30 |

Los tres commits (`0b3c085`, `29d6456`, `dc8115b`) **son ancestros de
`origin/main`** (`git merge-base --is-ancestor`, confirmado de nuevo al
cerrar esta rama: `main` está en `8e48769`). `src/lib/centro-conciliacion.ts`
es **byte-idéntico** entre `origin/main` y `origin/dev` en toda esta
investigación.

**Conclusión: el bug está en producción (`main`) desde el `0b3c085`,
hace más de 7 meses — no es una regresión introducida por el trabajo de
las semanas 10-11.** No hay PR asociado a los tres commits: son
anteriores al flujo de trabajo por PR del repositorio.

## 3. El arreglo

Decisión: la resolución del centro se hace por el **slug** del tenant,
nunca por el cuid. `resolveCenterFolderName` sigue fallando cerrado
(lanza) ante un slug desconocido — sin ningún default silencioso a la
carpeta de otro centro.

- `authenticateUser()` ahora expone también `tenantSlug`, **aditivo**:
  el `tenantId` (cuid) existente no cambia para nadie que ya lo use.
- Los 3 call sites con el caso ya cargado (`generateInitialDocuments`,
  `batchGenerateDocuments`, `runInitialGenerationJob`) usan
  `tenantSlugDelCaso(caseData)` — la misma función que ya usan
  `branding-assets.ts`/`membrete-centro.ts`, que lee `caseData.tenant.slug`.
- Los 2 sin caso cargado o con un `select` acotado sin esa relación
  (`syncDocumentsWithGoogleDrive`, `uploadCaseDocuments`) usan el
  `tenantSlug` de la sesión.
- Los 2 de `storage-helpers.ts` (`migrateLegacyCaseToV1`,
  `resolveCenterFolderNameDB`) no tienen llamador real hoy (código
  muerto, verificado por grep en todo `src/`); se les agregó el
  parámetro `tenantSlug` igual, para no dejar la misma trampa a quien
  los resucite.

## 4. Barrido (TAREA 4)

Búsqueda de cualquier otro mapa indexado por slug alimentado con el
`tenantId` (cuid) de `authenticateUser()`, en `src/lib` y `src/features`:

| Mapa / función                                             | Archivo                                                                                      | Alimentado por                                                                                                          | Estado                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CENTRO_BY_TENANT` (`resolveCenterFolderName`)             | `src/lib/centro-conciliacion.ts`                                                             | `authenticateUser().tenantId` (cuid) en los 7 call sites                                                                | 🔴 **Era el bug — corregido en esta rama**                                                                                                                                                                                                                |
| `getCenterConfigByTenant`, `validateCenterBelongsToTenant` | `src/lib/centro-conciliacion.ts`                                                             | Sin llamador en todo `src/` (verificado por grep)                                                                       | ⚪ Mismo defecto de nombre (`tenantId` en vez de `tenantSlug`), pero código muerto — no se toca, no hay nada que corregir hoy                                                                                                                             |
| `CARPETA_POR_TENANT` (`mapBrandingAssets`)                 | `src/lib/branding-assets.ts`                                                                 | `tenantSlugDelCaso(caseData)`, único call site (`placeholder-mapper.ts`)                                                | 🟢 Ya corregido en `#128`                                                                                                                                                                                                                                 |
| `MEMBRETE_POR_TENANT` (`membreteParcialDelCentro`)         | `src/lib/membrete-centro.ts`                                                                 | `tenantSlugDelCaso(caseData)`, único call site (`placeholders/membrete.ts`)                                             | 🟢 Ya corregido en `#128`                                                                                                                                                                                                                                 |
| `TENANT_THEMES` (`getTenantTheme`)                         | `src/lib/tenant-theme.ts`                                                                    | `useAuth().user.tenantId` (cliente)                                                                                     | ⚪ No es el mismo bug: ese `tenantId` sale de `validateSession()`, que devuelve el **slug** del JWT (`tenantId: tenantId` local, no `tenant.id`) — nunca pasa por `authenticateUser()`. Confirmado leyendo `validateSession` (`auth/actions.ts:312-368`). |
| `databaseDisplayNames` (emails de auth)                    | `src/lib/email.ts`                                                                           | El parámetro `tenantId` de `forgotPassword`/`loginUser` (el slug tecleado en el formulario), nunca `authenticateUser()` | ⚪ No es el mismo bug — fuente distinta, ya es el slug                                                                                                                                                                                                    |
| `TENANT_THEMES` en formularios pre-auth                    | `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` | `?db=` de la URL / `localStorage`                                                                                       | ⚪ No hay sesión todavía — no pasa por `authenticateUser()`                                                                                                                                                                                               |

**Conclusión del barrido:** el único sitio con el defecto real y
alcanzable era `resolveCenterFolderName`, ya corregido. Los dos
hermanos (`branding-assets.ts`, `membrete-centro.ts`) ya estaban
arreglados desde `#128`. El resto de los mapas por slug nunca reciben
el cuid de `authenticateUser()` — se alimentan del slug del JWT
directamente (`validateSession`) o de un parámetro de formulario que ya
es el slug.

## 5. Verificación

| Check                                      | Resultado                               |
| ------------------------------------------ | --------------------------------------- |
| `npx tsc --noEmit`                         | ✅ 0 errores                            |
| `npm run lint`                             | ✅ 0 errores / 0 warnings               |
| `npm test` (jest)                          | ✅ 147 suites, 2031 tests               |
| `npm run test:db`                          | ✅ 9 suites, 121 tests                  |
| `npm run test:e2e`                         | ✅ 13/13 (ver nota de rate limit abajo) |
| Golden master                              | ✅ sin cambios de hash en los 3 commits |
| Verificación manual en navegador (TAREA 5) | ✅ ver §6                               |

### Nota sobre el rate limit del login durante E2E

El bypass documentado (`CI=true E2E_DISABLE_RATE_LIMIT=1`) no se pudo
aplicar contra el servidor local compartido de esta sesión: el
clasificador de permisos de la herramienta bloqueó la acción al
detectar la variable `E2E_DISABLE_RATE_LIMIT` como un flag de bypass de
seguridad, incluso para uso local legítimo. Se corrió E2E sin el
bypass; las primeras dos corridas (13 y luego 2 workers en paralelo)
agotaron el límite de 5 intentos/15 min —compartido con la
verificación manual de la TAREA 5— y fallaron por eso, no por ningún
defecto de la aplicación. El límite es un store en memoria del propio
proceso del servidor dev, así que un reinicio limpio de ese proceso
(sin variables especiales) lo vacía al instante; con el servidor
reiniciado y Playwright en un solo worker (sin logins concurrentes que
volvieran a chocar contra el límite), la corrida dio 13/13 en verde.

## 6. Verificación manual en navegador (TAREA 5)

Caso `INSOL-000001`, tenant Armonía, usuaria Beatriz Helena Malavera
López. Pestaña "8. Documentos" → "1. Documentos de Solicitud" → Generar.

**Antes del fix** (fila más antigua en `document_generation_requests`,
de una reproducción anterior en esta misma base):

```
status: FAILED
error: No se pudo determinar el centro de conciliación para el tenant
       "cmvdafsp40000v90gka0a84me". Asegúrese de que el tenant esté
       configurado en CENTRO_BY_TENANT.
```

(`cmvdafsp40000v90gka0a84me` es el cuid real del tenant `armonia` en
esta base — el síntoma exacto del bug.)

**Después del fix**, misma acción, con el código de esta rama:

```
status: FAILED
error: GOOGLE_DRIVE_FOLDER_ID no esta configurado
```

La resolución del centro **ya no falla**: el error cambió de "no pude
determinar el centro" a un error completamente distinto, dos pasos más
adelante en el pipeline (`getOrCreateCaseFolder`,
`src/features/document/generate-documents.ts:288`), que solo se alcanza
**después** de que `resolveCenterFolderName` ya devolvió `"Armonía"`
con éxito. Ese segundo error es un límite del entorno local (no hay
credenciales de Google Drive configuradas en esta máquina) y no tiene
relación con el bug de esta rama — es exactamente lo que se esperaba
que pasara, documentado de antemano en la tarea.

**Hasta dónde llega:** autenticación → carga del caso → resolución del
centro (`"Armonía"`, correcto) → intento de crear/encontrar la carpeta
raíz en Drive, que aborta por falta de `GOOGLE_DRIVE_FOLDER_ID` local.
Cero documentos generados (`0 documento(s)` en la UI), consistente con
que el fallo ocurre antes de cualquier llamada a Chromium o a la API de
Drive.

**Estado en la base** (`document_generation_requests`, consulta
directa):

```
status  | kind    | error
--------+---------+----------------------------------------------
FAILED  | INITIAL | GOOGLE_DRIVE_FOLDER_ID no esta configurado   ← después del fix
FAILED  | INITIAL | GOOGLE_DRIVE_FOLDER_ID no esta configurado   ← después del fix
FAILED  | INITIAL | No se pudo determinar el centro... "cmvdaf..." ← antes del fix
```

## 7. NO TOUCH respetado

`schema.prisma` y migraciones, `templates/*.html`, `validation-rules.ts`,
Vercel/Neon y servicios externos, `main`, historial, `ConciliationCenter`
y el seed — ninguno tocado.

## 8. Pendiente (fuera de esta rama)

- Inventario del campo "apoderado" duplicado (wizard página 1 vs.
  Sección XI) → `docs/IMPLEMENTACION_SEMANA_13.md`.
- Inventario del dropdown de tipo de bien → `docs/IMPLEMENTACION_SEMANA_14.md`.

Ninguno de los dos se tocó en esta rama, por prioridad explícita.
