# Reporte Técnico: Separación de Carpetas de Google Drive por Centro de Conciliación

**Fecha:** 2026-03-04
**Branch:** `feature/drive-centro-conciliacion`
**Base:** `dev`
**Tests:** 171/171 passing (60 nuevos + 111 existentes)

---

## 1. Resumen Ejecutivo

Se implementó un sistema de carpetas separadas en Google Drive según el centro de conciliación, de modo que los documentos generados y subidos se almacenen en rutas distintas dependiendo del contexto del tenant/caso.

### Estructura Anterior
```
GOOGLE_DRIVE_FOLDER_ID/
  documentos-generados/
    CON-2024-001/
      archivo1.pdf
      Personas/
        Juan/
          cedula.pdf
    CON-2024-002/
      ...
```

### Estructura Nueva
```
GOOGLE_DRIVE_FOLDER_ID/
  documentos-generados/
    Armonia/
      CON-2024-001/
        archivo1.pdf
        Personas/
          Juan/
            cedula.pdf
    Construpaz/
      INS-2024-050/
        archivo1.pdf
        Personas/
          Maria/
            cedula.pdf
```

---

## 2. Archivos Modificados/Creados

### Creados
| Archivo | Propósito |
|---------|-----------|
| `src/lib/centro-conciliacion.ts` | Módulo de configuración y validación de centros |
| `tests/integration/drive-centro.test.ts` | 60 tests de integración |
| `DRIVE-CENTRO-REPORT.md` | Este reporte |

### Modificados
| Archivo | Cambios |
|---------|---------|
| `src/features/document/actions.ts` | Refactorización de 4 funciones para usar centro |

---

## 3. Detalle de Implementación

### 3.1 Módulo `centro-conciliacion.ts`

**Funciones exportadas:**
- `resolveCenterFolderName(tenantId, caseCentroConciliacion?)` — Resuelve el nombre de carpeta. Prioriza el campo del caso, luego el mapeo por tenant.
- `sanitizeCenterName(name)` — Sanitiza nombres para prevenir path traversal e inyección.
- `isKnownCenter(name)` — Verifica si un centro es uno de los conocidos (Armonia/Construpaz).
- `validateCenterBelongsToTenant(tenantId, centerName)` — Validación cross-center para seguridad.
- `getCenterConfigByTenant(tenantId)` — Obtiene configuración completa de un centro.

**Configuración de centros:**
| Tenant ID | Carpeta Drive | Display Name |
|-----------|---------------|--------------|
| `armonia` | `Armonia` | Armonía |
| `constructores-paz` | `Construpaz` | Constructores de Paz |

### 3.2 Refactorización de `actions.ts`

**`findOrCreateDocumentosGeneradosFolder()`** — Nuevo helper que centraliza la lógica de buscar/crear la carpeta `documentos-generados`. Elimina la duplicación en 3 funciones.

**`createCaseFolderInGoogleDrive(caseNumber, centerFolderName, prisma, tenantId)`** — Nuevo parámetro `centerFolderName`. Crea la jerarquía `documentos-generados/{center}/{caseNumber}/`.

**`batchGenerateDocuments(input)`** — Ahora resuelve el centro desde `caseData.centroConciliacionNombre` o el tenant. Incluye validación cross-center que lanza error si el centro no pertenece al tenant.

**`uploadCaseDocuments(input)`** — Ahora consulta `centroConciliacionNombre` del caso. Incluye validación cross-center que retorna error si el centro no pertenece al tenant.

**`syncDocumentsWithGoogleDrive()`** — Ahora sincroniza solo desde la carpeta del centro del tenant autenticado. Todos los `folderPath` se prefijan con el nombre del centro.

**`getDocumentsFromDrive()`** — Función `extractCaseNumber()` actualizada para manejar tanto el formato nuevo `[center, caseNumber, ...]` como el legacy `[caseNumber, ...]`.

---

## 4. Seguridad

### 4.1 Prevención de Acceso Cross-Center
- El backend valida que el centro resuelto corresponda al tenant autenticado
- Si un caso tiene `centroConciliacionNombre = "Construpaz"` pero el tenant es `armonia`, la operación se bloquea
- Log de seguridad: `[SECURITY] Cross-center violation in ...`

### 4.2 Path Traversal Prevention
- `sanitizeCenterName()` elimina: `/`, `\`, null bytes, dots iniciales, caracteres especiales
- Solo permite alfanuméricos, guiones, underscores, espacios, y caracteres acentuados
- Longitud máxima de 100 caracteres

### 4.3 Drive Query Injection Prevention
- Comillas simples y caracteres especiales son eliminados de los nombres de centro
- Esto previene inyección en queries de la API de Drive (`'${folderId}' in parents...`)

### 4.4 Aislamiento de Sincronización
- `syncDocumentsWithGoogleDrive()` solo escanea la carpeta del centro del tenant actual
- Un tenant no puede ver/sincronizar documentos de otro centro

---

## 5. Compatibilidad con Datos Legacy

La implementación mantiene compatibilidad retroactiva con datos existentes:

| Formato | Ejemplo `folderPath` | Soporte |
|---------|---------------------|---------|
| Nuevo | `['Armonia', 'CON-2024-001', 'Personas', 'Juan']` | Completo |
| Legacy | `['CON-2024-001', 'Personas', 'Juan']` | Lectura |
| Legacy vacío | `[]` (folder con fileName = caseNumber) | Lectura |

La función `extractCaseNumber()` detecta automáticamente ambos formatos.

---

## 6. Tests (60 tests)

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| Resolución por Tenant | 10 | Mapeo tenant → centro, priorización, fallbacks |
| Configuración | 4 | Validación de centros configurados |
| Sanitización | 15 | Path traversal, chars especiales, longitud |
| Centro Conocido | 6 | Whitelist de centros válidos |
| Cross-Center | 6 | Aislamiento entre tenants |
| Estructura folderPath | 9 | Formato nuevo vs legacy, tipos de caso |
| Inyección | 5 | Drive query injection, directory traversal |
| Integración E2E | 5 | Escenarios completos de flujo |

---

## 7. Diagrama de Flujo

```
Usuario solicita generar documentos
         |
         v
authenticateUser() → tenantId
         |
         v
Case.findUnique() → centroConciliacionNombre
         |
         v
resolveCenterFolderName(tenantId, centro?)
         |
    ┌────┴────┐
    |         |
  centro    fallback
  del caso  del tenant
    |         |
    └────┬────┘
         |
         v
validateCenterBelongsToTenant()
         |
    ┌────┴────┐
    |         |
  PASS      FAIL → Error: "no pertenece al tenant"
    |
    v
findOrCreateDocumentosGeneradosFolder()
    → documentos-generados/
         |
         v
createFolderHierarchy([centerName])
    → documentos-generados/{center}/
         |
         v
findOrCreateCaseFolder(caseNumber)
    → documentos-generados/{center}/{caseNumber}/
         |
         v
Upload files / Generate PDFs
```

---

## 8. Variables de Entorno

No se requieren nuevas variables de entorno. La separación se basa en:
- `GOOGLE_DRIVE_FOLDER_ID` — Carpeta raíz (existente)
- Configuración hardcoded en `centro-conciliacion.ts` (tenant → centro mapping)

Para agregar un nuevo centro en el futuro, solo hay que agregar una entrada al objeto `CENTRO_BY_TENANT` en `src/lib/centro-conciliacion.ts`.
