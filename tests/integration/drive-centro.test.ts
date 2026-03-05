/**
 * Tests de Integración — Separación de Carpetas de Google Drive por Centro de Conciliación
 *
 * Valida que:
 * 1. La resolución de centro funcione correctamente (tenant → folder name)
 * 2. La sanitización de nombres de centro prevenga path traversal
 * 3. La validación cross-center bloquee acceso entre centros
 * 4. La estructura de carpetas se construya correctamente
 * 5. Compatibilidad con formatos legacy (folderPath sin centro)
 */

import {
  resolveCenterFolderName,
  sanitizeCenterName,
  isKnownCenter,
  validateCenterBelongsToTenant,
  getCenterConfigByTenant,
  VALID_CENTER_FOLDER_NAMES,
} from '@/lib/centro-conciliacion';

// ============================================================
// 1. RESOLUCIÓN DE CENTRO POR TENANT
// ============================================================

describe('Centro de Conciliación — Resolución por Tenant', () => {
  it('debe resolver "Armonia" para el tenant "armonia"', () => {
    const result = resolveCenterFolderName('armonia');
    expect(result).toBe('Armonia');
  });

  it('debe resolver "Construpaz" para el tenant "constructores-paz"', () => {
    const result = resolveCenterFolderName('constructores-paz');
    expect(result).toBe('Construpaz');
  });

  it('debe lanzar error para un tenant desconocido sin centroConciliacion', () => {
    expect(() => resolveCenterFolderName('tenant-inexistente')).toThrow(
      /No se pudo determinar el centro de conciliación/,
    );
  });

  it('debe priorizar centroConciliacionNombre del caso sobre el tenant', () => {
    // Si el caso dice "Construpaz" pero el tenant es "armonia",
    // debe usar el valor del caso (cuando es un centro conocido)
    const result = resolveCenterFolderName('armonia', 'Construpaz');
    expect(result).toBe('Construpaz');
  });

  it('debe normalizar "Armonía" (con tilde) a "Armonia" (folder name)', () => {
    const result = resolveCenterFolderName('constructores-paz', 'Armonía');
    expect(result).toBe('Armonia');
  });

  it('debe normalizar "Constructores de Paz" al folder "Construpaz"', () => {
    const result = resolveCenterFolderName('armonia', 'Constructores de Paz');
    expect(result).toBe('Construpaz');
  });

  it('debe usar fallback del tenant cuando centroConciliacion es null', () => {
    const result = resolveCenterFolderName('armonia', null);
    expect(result).toBe('Armonia');
  });

  it('debe usar fallback del tenant cuando centroConciliacion es vacío', () => {
    const result = resolveCenterFolderName('constructores-paz', '');
    expect(result).toBe('Construpaz');
  });

  it('debe usar fallback del tenant cuando centroConciliacion es solo espacios', () => {
    const result = resolveCenterFolderName('armonia', '   ');
    expect(result).toBe('Armonia');
  });

  it('debe aceptar un centro personalizado válido (no conocido) con sanitización', () => {
    const result = resolveCenterFolderName('armonia', 'Centro Nuevo Legal');
    expect(result).toBe('Centro Nuevo Legal');
  });
});

// ============================================================
// 2. CONFIGURACIÓN DE CENTROS
// ============================================================

describe('Centro de Conciliación — Configuración', () => {
  it('debe listar exactamente 2 centros válidos', () => {
    expect(VALID_CENTER_FOLDER_NAMES).toHaveLength(2);
    expect(VALID_CENTER_FOLDER_NAMES).toContain('Armonia');
    expect(VALID_CENTER_FOLDER_NAMES).toContain('Construpaz');
  });

  it('getCenterConfigByTenant debe retornar config para armonia', () => {
    const config = getCenterConfigByTenant('armonia');
    expect(config).toBeDefined();
    expect(config!.driveFolderName).toBe('Armonia');
    expect(config!.displayName).toBe('Armonía');
  });

  it('getCenterConfigByTenant debe retornar config para constructores-paz', () => {
    const config = getCenterConfigByTenant('constructores-paz');
    expect(config).toBeDefined();
    expect(config!.driveFolderName).toBe('Construpaz');
    expect(config!.displayName).toBe('Constructores de Paz');
  });

  it('getCenterConfigByTenant debe retornar undefined para tenant desconocido', () => {
    const config = getCenterConfigByTenant('otro-tenant');
    expect(config).toBeUndefined();
  });
});

// ============================================================
// 3. SANITIZACIÓN DE NOMBRES DE CENTRO (Path Traversal Prevention)
// ============================================================

describe('Centro de Conciliación — Sanitización de Nombres', () => {
  it('debe mantener un nombre válido sin cambios', () => {
    expect(sanitizeCenterName('Armonia')).toBe('Armonia');
  });

  it('debe mantener nombre con espacios', () => {
    expect(sanitizeCenterName('Centro Legal')).toBe('Centro Legal');
  });

  it('debe mantener caracteres acentuados', () => {
    expect(sanitizeCenterName('Armonía Conciliación')).toBe('Armonía Conciliación');
  });

  it('debe eliminar path separators (forward slash)', () => {
    expect(sanitizeCenterName('Centro/../../etc')).toBe('Centroetc');
  });

  it('debe eliminar path separators (backslash)', () => {
    expect(sanitizeCenterName('Centro\\..\\..\\admin')).toBe('Centroadmin');
  });

  it('debe eliminar null bytes', () => {
    expect(sanitizeCenterName('Centro\0Malicioso')).toBe('CentroMalicioso');
  });

  it('debe eliminar dots iniciales (hidden folders)', () => {
    expect(sanitizeCenterName('..Centro')).toBe('Centro');
  });

  it('debe eliminar dots finales', () => {
    expect(sanitizeCenterName('Centro...')).toBe('Centro');
  });

  it('debe eliminar caracteres especiales peligrosos', () => {
    expect(sanitizeCenterName('Centro<script>alert(1)</script>')).toBe('Centroscriptalert1script');
  });

  it('debe colapsar espacios múltiples', () => {
    expect(sanitizeCenterName('Centro   Legal   SAS')).toBe('Centro Legal SAS');
  });

  it('debe limitar longitud a 100 caracteres', () => {
    const longName = 'A'.repeat(200);
    const result = sanitizeCenterName(longName);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('debe retornar vacío para entrada solo de caracteres especiales', () => {
    expect(sanitizeCenterName('!@#$%^&*()')).toBe('');
  });

  it('debe retornar vacío para solo dots', () => {
    expect(sanitizeCenterName('...')).toBe('');
  });

  it('debe manejar string vacío', () => {
    expect(sanitizeCenterName('')).toBe('');
  });

  it('debe permitir guiones y underscores', () => {
    expect(sanitizeCenterName('Centro-Legal_SAS')).toBe('Centro-Legal_SAS');
  });
});

// ============================================================
// 4. VALIDACIÓN DE CENTRO CONOCIDO
// ============================================================

describe('Centro de Conciliación — Validación de Centro Conocido', () => {
  it('debe reconocer "Armonia" como centro conocido', () => {
    expect(isKnownCenter('Armonia')).toBe(true);
  });

  it('debe reconocer "Construpaz" como centro conocido', () => {
    expect(isKnownCenter('Construpaz')).toBe(true);
  });

  it('debe reconocer "armonia" (minúsculas) como centro conocido', () => {
    expect(isKnownCenter('armonia')).toBe(true);
  });

  it('debe reconocer "CONSTRUPAZ" (mayúsculas) como centro conocido', () => {
    expect(isKnownCenter('CONSTRUPAZ')).toBe(true);
  });

  it('debe rechazar "CentroDesconocido"', () => {
    expect(isKnownCenter('CentroDesconocido')).toBe(false);
  });

  it('debe rechazar string vacío', () => {
    expect(isKnownCenter('')).toBe(false);
  });
});

// ============================================================
// 5. VALIDACIÓN CROSS-CENTER (Seguridad)
// ============================================================

describe('Centro de Conciliación — Validación Cross-Center', () => {
  it('debe aceptar Armonia para tenant armonia', () => {
    const result = validateCenterBelongsToTenant('armonia', 'Armonia');
    expect(result).toBeNull();
  });

  it('debe aceptar Construpaz para tenant constructores-paz', () => {
    const result = validateCenterBelongsToTenant('constructores-paz', 'Construpaz');
    expect(result).toBeNull();
  });

  it('debe rechazar Construpaz para tenant armonia', () => {
    const result = validateCenterBelongsToTenant('armonia', 'Construpaz');
    expect(result).not.toBeNull();
    expect(result).toContain('no pertenece al tenant');
  });

  it('debe rechazar Armonia para tenant constructores-paz', () => {
    const result = validateCenterBelongsToTenant('constructores-paz', 'Armonia');
    expect(result).not.toBeNull();
    expect(result).toContain('no pertenece al tenant');
  });

  it('debe rechazar tenant desconocido', () => {
    const result = validateCenterBelongsToTenant('tenant-desconocido', 'Armonia');
    expect(result).not.toBeNull();
    expect(result).toContain('no tiene un centro de conciliación configurado');
  });

  it('debe ser case-insensitive en la comparación', () => {
    const result = validateCenterBelongsToTenant('armonia', 'armonia');
    expect(result).toBeNull();
  });
});

// ============================================================
// 6. ESTRUCTURA DE CARPETAS (folderPath)
// ============================================================

describe('Centro de Conciliación — Estructura de folderPath', () => {
  const caseNumberPattern = /(CON|INS|ACU)-\d{4}-\d{3}/;

  /**
   * Simulates the extractCaseNumber logic from getDocumentsFromDrive
   */
  function extractCaseNumber(doc: {
    folderPath: string[];
    fileName: string;
    isFolder: boolean;
  }): string | undefined {
    // New format: folderPath[0] = center name, folderPath[1] = case number
    if (
      doc.folderPath.length > 1 &&
      caseNumberPattern.test(doc.folderPath[1])
    ) {
      return doc.folderPath[1];
    }
    // Legacy format: folderPath[0] = case number
    if (
      doc.folderPath.length > 0 &&
      caseNumberPattern.test(doc.folderPath[0])
    ) {
      return doc.folderPath[0];
    }
    // Folder with no path but name is case number
    if (
      doc.isFolder &&
      doc.folderPath.length === 0 &&
      caseNumberPattern.test(doc.fileName)
    ) {
      return doc.fileName;
    }
    // Case folder with center prefix
    if (
      doc.isFolder &&
      doc.folderPath.length === 1 &&
      caseNumberPattern.test(doc.fileName)
    ) {
      return doc.fileName;
    }
    return undefined;
  }

  it('debe extraer caso del formato nuevo [center, caseNumber, ...]', () => {
    const doc = {
      folderPath: ['Armonia', 'CON-2024-001', 'Personas', 'Juan'],
      fileName: 'cedula.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBe('CON-2024-001');
  });

  it('debe extraer caso del formato legacy [caseNumber, ...]', () => {
    const doc = {
      folderPath: ['CON-2024-001', 'Personas', 'Juan'],
      fileName: 'cedula.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBe('CON-2024-001');
  });

  it('debe extraer caso de folder sin path (fileName = caseNumber)', () => {
    const doc = {
      folderPath: [],
      fileName: 'INS-2024-015',
      isFolder: true,
    };
    expect(extractCaseNumber(doc)).toBe('INS-2024-015');
  });

  it('debe extraer caso de folder con path de un elemento (center)', () => {
    const doc = {
      folderPath: ['Construpaz'],
      fileName: 'ACU-2024-003',
      isFolder: true,
    };
    expect(extractCaseNumber(doc)).toBe('ACU-2024-003');
  });

  it('no debe extraer caso de archivo sin folderPath relevante', () => {
    const doc = {
      folderPath: [],
      fileName: 'template.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBeUndefined();
  });

  it('no debe extraer caso de folder con nombre no-caso', () => {
    const doc = {
      folderPath: [],
      fileName: 'Armonia',
      isFolder: true,
    };
    expect(extractCaseNumber(doc)).toBeUndefined();
  });

  it('debe manejar formato CON (conciliación)', () => {
    const doc = {
      folderPath: ['Armonia', 'CON-2025-100'],
      fileName: 'doc.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBe('CON-2025-100');
  });

  it('debe manejar formato INS (insolvencia)', () => {
    const doc = {
      folderPath: ['Construpaz', 'INS-2024-050'],
      fileName: 'doc.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBe('INS-2024-050');
  });

  it('debe manejar formato ACU (acuerdo)', () => {
    const doc = {
      folderPath: ['Armonia', 'ACU-2023-001'],
      fileName: 'doc.pdf',
      isFolder: false,
    };
    expect(extractCaseNumber(doc)).toBe('ACU-2023-001');
  });
});

// ============================================================
// 7. PREVENCIÓN DE INYECCIÓN EN QUERIES DRIVE (Folder name injection)
// ============================================================

describe('Centro de Conciliación — Prevención de Inyección', () => {
  it('debe prevenir inyección via nombre de centro con comillas', () => {
    const malicious = "Armonia' and trashed=true and name='";
    const sanitized = sanitizeCenterName(malicious);
    // Comillas son removidas
    expect(sanitized).not.toContain("'");
  });

  it('debe prevenir inyección con caracteres de query Drive', () => {
    const malicious = "Armonia' in parents and mimeType!='";
    const sanitized = sanitizeCenterName(malicious);
    expect(sanitized).not.toContain("'");
    expect(sanitized).not.toContain('!');
  });

  it('debe prevenir directory traversal con ../..', () => {
    const malicious = '../../root/secret';
    const sanitized = sanitizeCenterName(malicious);
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toContain('/');
  });

  it('debe prevenir escape con backslash', () => {
    const malicious = '..\\..\\windows\\system32';
    const sanitized = sanitizeCenterName(malicious);
    expect(sanitized).not.toContain('\\');
    expect(sanitized).not.toContain('..');
  });

  it('debe prevenir uso de null byte para bypass de extensión', () => {
    const malicious = 'Armonia\x00.exe';
    const sanitized = sanitizeCenterName(malicious);
    expect(sanitized).not.toContain('\x00');
  });
});

// ============================================================
// 8. ESCENARIOS DE INTEGRACIÓN END-TO-END
// ============================================================

describe('Centro de Conciliación — Escenarios de Integración', () => {
  it('caso de Armonia debe generar path [Armonia, CON-2024-001]', () => {
    const tenantId = 'armonia';
    const caseCentro = 'Armonia';
    const caseNumber = 'CON-2024-001';

    const centerFolder = resolveCenterFolderName(tenantId, caseCentro);
    expect(centerFolder).toBe('Armonia');

    const folderPath = [centerFolder, caseNumber, 'Adjuntos'];
    expect(folderPath).toEqual(['Armonia', 'CON-2024-001', 'Adjuntos']);
  });

  it('caso de Construpaz debe generar path [Construpaz, INS-2024-050]', () => {
    const tenantId = 'constructores-paz';
    const caseCentro = null; // sin centro explícito
    const caseNumber = 'INS-2024-050';

    const centerFolder = resolveCenterFolderName(tenantId, caseCentro);
    expect(centerFolder).toBe('Construpaz');

    const folderPath = [centerFolder, caseNumber, 'Personas', 'María'];
    expect(folderPath).toEqual([
      'Construpaz',
      'INS-2024-050',
      'Personas',
      'María',
    ]);
  });

  it('caso con centro explícito override del tenant', () => {
    // Caso raro pero posible: caso creado en tenant armonia
    // pero con centroConciliacionNombre = 'Armonia'
    const tenantId = 'armonia';
    const caseCentro = 'Armonía'; // con tilde
    const caseNumber = 'ACU-2025-010';

    const centerFolder = resolveCenterFolderName(tenantId, caseCentro);
    expect(centerFolder).toBe('Armonia'); // normalizado sin tilde

    // Validar que sí pertenece al tenant
    const error = validateCenterBelongsToTenant(tenantId, centerFolder);
    expect(error).toBeNull();
  });

  it('debe bloquear caso de otro centro en batch generation', () => {
    // Simula un caso que tiene centroConciliacionNombre de otro tenant
    const tenantId = 'armonia';
    const caseCentro = 'Construpaz'; // centro de constructores-paz

    const centerFolder = resolveCenterFolderName(tenantId, caseCentro);
    expect(centerFolder).toBe('Construpaz');

    // Validación cross-center debe fallar
    const error = validateCenterBelongsToTenant(tenantId, centerFolder);
    expect(error).not.toBeNull();
    expect(error).toContain('no pertenece al tenant');
  });

  it('debe mantener aislamiento total entre tenants', () => {
    // Verificar que cada tenant resuelve a su propio centro
    const armoniaCenter = resolveCenterFolderName('armonia');
    const construpazCenter = resolveCenterFolderName('constructores-paz');

    expect(armoniaCenter).not.toBe(construpazCenter);

    // Cada uno solo acepta su propio centro
    expect(validateCenterBelongsToTenant('armonia', armoniaCenter)).toBeNull();
    expect(
      validateCenterBelongsToTenant('constructores-paz', construpazCenter),
    ).toBeNull();

    // Cross-check falla
    expect(
      validateCenterBelongsToTenant('armonia', construpazCenter),
    ).not.toBeNull();
    expect(
      validateCenterBelongsToTenant('constructores-paz', armoniaCenter),
    ).not.toBeNull();
  });
});
