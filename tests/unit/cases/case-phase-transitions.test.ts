/**
 * Unit Tests: máquina de estados del expediente (C-1).
 *
 * Dos niveles:
 *   1. `validatePhaseTransition` — función pura, sin Prisma ni I/O.
 *   2. Las tres mutaciones que escriben `phase` (`createCase`, `updateCase`,
 *      `updateCasePhase`), incluyendo los intentos de bypass que la auditoría
 *      identificó como el hallazgo crítico C-1.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
  generateDocumentsForAdmission: jest.fn().mockResolvedValue([]),
  generateDocumentsForAgreement: jest.fn().mockResolvedValue([]),
  generateDocumentsForFailure: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/payment/actions', () => ({
  generatePaymentSchedule: jest.fn().mockResolvedValue({ success: true }),
}));

import {
  CASE_PHASE_VALUES,
  INITIAL_CASE_PHASE,
  getPackageForPhase,
  isKnownPhase,
  validatePhaseTransition,
} from '@/lib/case-phases';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { updateCase, updateCasePhase } from '@/features/case/actions';

const authAsAdmin = () =>
  mockAuthenticateUser.mockResolvedValue({
    user: {
      ...ADMIN_USER,
      permissions: Object.values(P),
    },
    tenantId: TENANT.id,
  });

describe('validatePhaseTransition — guard puro (C-1)', () => {
  describe('camino feliz', () => {
    it.each([
      ['Inicial', 'Admisión'],
      ['Admisión', 'En negociación'],
      ['En negociación', 'Audiencia programada'],
      ['Audiencia programada', 'Acuerdo aprobado'],
      ['Acuerdo aprobado', 'Post-acuerdo'],
      ['Post-acuerdo', 'Terminado'],
      ['Fracaso', 'Terminado'],
      // Fases nuevas (docs/DISENO_FASES_NUEVAS_2026-09-11.md §2)
      ['Inicial', 'Rechazo'],
      ['Inicial', 'Retiro'],
      ['Rechazo', 'Terminado'],
      ['Retiro', 'Terminado'],
      ['Admisión', 'Desistimiento'],
      ['En negociación', 'Desistimiento'],
      ['Audiencia programada', 'Desistimiento'],
      ['Desistimiento', 'Terminado'],
      ['Acuerdo aprobado', 'Acuerdo impugnado'],
      ['Acuerdo impugnado', 'Post-acuerdo'], // ⓐ
      ['Acuerdo impugnado', 'Acuerdo reformado'], // ⓑ
      ['Acuerdo reformado', 'Post-acuerdo'], // ⓒ
      ['Acuerdo reformado', 'Terminado'], // ⓓ
    ])('permite la transición %s → %s', (from, to) => {
      const result = validatePhaseTransition(from, to);
      expect(result).toEqual({ valid: true, isNoop: false });
    });

    it('permite abortar a Fracaso solo desde una fase donde ya se intentó negociar', () => {
      // §2.1: se elimina Inicial→Fracaso y Admisión→Fracaso. El fracaso solo
      // existe después de notificar e intentar negociar.
      const puedenFracasar = [
        'En negociación',
        'Audiencia programada',
        'Acuerdo aprobado',
        'Post-acuerdo',
      ];
      for (const phase of CASE_PHASE_VALUES) {
        if (phase === 'Fracaso' || phase === 'Terminado') continue;
        const result = validatePhaseTransition(phase, 'Fracaso');
        expect(result.valid).toBe(puedenFracasar.includes(phase));
      }
    });

    it('ya no permite fracasar desde Inicial ni Admisión (§2.1)', () => {
      expect(validatePhaseTransition('Inicial', 'Fracaso').valid).toBe(false);
      expect(validatePhaseTransition('Admisión', 'Fracaso').valid).toBe(false);
    });

    it('Rechazo y Retiro solo son alcanzables desde Inicial', () => {
      for (const phase of CASE_PHASE_VALUES) {
        // Reescribir la misma fase es un no-op válido (no una transición real);
        // lo cubren los tests de no-op de más abajo.
        if (phase === 'Inicial' || phase === 'Rechazo' || phase === 'Retiro') {
          continue;
        }
        expect(validatePhaseTransition(phase, 'Rechazo').valid).toBe(false);
        expect(validatePhaseTransition(phase, 'Retiro').valid).toBe(false);
      }
    });

    it('Desistimiento no es alcanzable desde Inicial (todavía no hay admisión)', () => {
      expect(validatePhaseTransition('Inicial', 'Desistimiento').valid).toBe(
        false,
      );
    });

    it('una reforma ya no se puede volver a impugnar', () => {
      expect(
        validatePhaseTransition('Acuerdo reformado', 'Acuerdo impugnado').valid,
      ).toBe(false);
    });

    it('un acuerdo impugnado resuelto (ⓐ) no reabre Acuerdo aprobado', () => {
      // El cliente confirmó que un acuerdo, resuelta la impugnación, queda en
      // firme: ⓐ va a Post-acuerdo, nunca de vuelta a Acuerdo aprobado.
      expect(
        validatePhaseTransition('Acuerdo impugnado', 'Acuerdo aprobado').valid,
      ).toBe(false);
    });

    it('trata reescribir la misma fase como no-op válido', () => {
      expect(
        validatePhaseTransition('En negociación', 'En negociación'),
      ).toEqual({ valid: true, isNoop: true });
    });

    it('trata una fase actual nula como Inicial (expedientes legacy)', () => {
      expect(validatePhaseTransition(null, 'Admisión').valid).toBe(true);
      expect(validatePhaseTransition(undefined, 'Admisión').valid).toBe(true);
    });

    it('acepta reescribir una fase legacy inválida sin bloquear la edición', () => {
      // Antes de C-1 la columna aceptaba cualquier string. Un expediente con
      // basura persistida debe seguir siendo editable mientras no cambie de fase.
      const result = validatePhaseTransition('FaseInventada', 'FaseInventada');
      expect(result).toEqual({ valid: true, isNoop: true });
    });
  });

  describe('bypass intentado — debe fallar', () => {
    it('rechaza el salto Inicial → Terminado', () => {
      const result = validatePhaseTransition('Inicial', 'Terminado');
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toContain(
        'Transición no permitida',
      );
    });

    it('rechaza saltarse la admisión (Inicial → En negociación)', () => {
      expect(validatePhaseTransition('Inicial', 'En negociación').valid).toBe(
        false,
      );
    });

    it('rechaza reabrir un expediente Terminado', () => {
      for (const phase of CASE_PHASE_VALUES) {
        if (phase === 'Terminado') continue;
        const result = validatePhaseTransition('Terminado', phase);
        expect(result.valid).toBe(false);
        expect((result as { reason: string }).reason).toContain('terminal');
      }
    });

    it('rechaza retroceder de Post-acuerdo a En negociación', () => {
      expect(
        validatePhaseTransition('Post-acuerdo', 'En negociación').valid,
      ).toBe(false);
    });

    it('rechaza una fase destino desconocida', () => {
      const result = validatePhaseTransition('Inicial', 'Fase Inventada');
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toContain(
        'Fase desconocida',
      );
    });

    it('rechaza fase destino vacía o nula', () => {
      expect(validatePhaseTransition('Inicial', '').valid).toBe(false);
      expect(validatePhaseTransition('Inicial', null).valid).toBe(false);
      expect(validatePhaseTransition('Inicial', undefined).valid).toBe(false);
    });

    it('no permite escalar desde una fase legacy inválida', () => {
      // Fase actual desconocida se normaliza a Inicial: solo Admisión/Fracaso.
      expect(validatePhaseTransition('FaseInventada', 'Terminado').valid).toBe(
        false,
      );
      expect(validatePhaseTransition('FaseInventada', 'Admisión').valid).toBe(
        true,
      );
    });
  });

  it('isKnownPhase reconoce exactamente las 13 fases declaradas', () => {
    expect(CASE_PHASE_VALUES).toHaveLength(13);
    expect(CASE_PHASE_VALUES.every(isKnownPhase)).toBe(true);
    expect(isKnownPhase('Terminada')).toBe(false);
    expect(isKnownPhase(null)).toBe(false);
    expect(INITIAL_CASE_PHASE).toBe('Inicial');
  });
});

describe('getPackageForPhase — mapa de paquetes por fase (Fase 2 paso 1)', () => {
  it('mapea Fracaso al paquete 5, donde viven sus 27 plantillas (bug corregido)', () => {
    // Antes de este fix, PACKAGE_PHASE_MAP no incluía 'Fracaso' y
    // getPackageForPhase caía al paquete 1 (Solicitud) para un caso fracasado.
    expect(getPackageForPhase('Fracaso')).toBe(5);
  });

  it('mapea Desistimiento al paquete 4, donde vive su plantilla existente', () => {
    expect(getPackageForPhase('Desistimiento')).toBe(4);
  });

  it.each(['Rechazo', 'Retiro', 'Acuerdo impugnado', 'Acuerdo reformado'])(
    'cae al paquete 1 para %s: sus plantillas aún no existen (paso 4, bloqueado por el abogado)',
    (phase) => {
      expect(getPackageForPhase(phase)).toBe(1);
    },
  );

  it('mantiene el camino feliz existente', () => {
    expect(getPackageForPhase('Inicial')).toBe(1);
    expect(getPackageForPhase('En negociación')).toBe(2);
    expect(getPackageForPhase('Audiencia programada')).toBe(3);
    expect(getPackageForPhase('Acuerdo aprobado')).toBe(4);
    expect(getPackageForPhase('Terminado')).toBe(5);
  });
});

describe('updateCasePhase — server action (C-1)', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    authAsAdmin();
  });

  const existing = (phase: string | null) => ({
    id: 'case-1',
    phase,
    caseNumber: 'INSOL-000001',
    debtorName: 'Juan Pérez',
  });

  it('aplica una transición válida y persiste la nueva fase', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Inicial'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1', tenantId: TENANT.id },
        data: { phase: 'Admisión' },
      }),
    );
  });

  it('scopea la lectura del caso por tenant', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Inicial'));

    await updateCasePhase({ caseId: 'case-1', newPhase: 'Admisión' });

    expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1', tenantId: TENANT.id },
      }),
    );
  });

  it('BYPASS: rechaza el salto Inicial → Terminado sin escribir en BD', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Inicial'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Terminado',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Transición no permitida');
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza una fase arbitraria sin escribir en BD', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Inicial'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Archivado por el juez',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza reabrir un expediente Terminado', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Terminado'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'En negociación',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('no escribe ni audita cuando la fase no cambia (no-op)', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existing('Admisión'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('deniega sin el permiso "Editar casos"', async () => {
    mockAuthenticateUser.mockResolvedValue({
      // Puede ver casos pero NO editarlos.
      user: { ...ADMIN_USER, permissions: [P.VER_CASOS] },
      tenantId: TENANT.id,
    });

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('devuelve error si el caso no existe en el tenant', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const result = await updateCasePhase({
      caseId: 'ajeno',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Caso no encontrado');
  });
});

describe('updateCasePhase — subtipo y fecha obligatorios (Fase 2 paso 3)', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    authAsAdmin();
  });

  const existingNoFolder = (phase: string) => ({
    id: 'case-1',
    phase,
    caseNumber: 'INSOL-000001',
    debtorName: 'Juan Pérez',
    driveFolderId: null,
  });

  describe('Fracaso', () => {
    it('rechaza sin subtipo, sin escribir en BD', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('En negociación'),
      );

      const result = await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Fracaso',
        resultDate: '2026-03-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('subtipo es obligatorio');
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('rechaza sin fecha, sin escribir en BD', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('En negociación'),
      );

      const result = await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Fracaso',
        subtype: 'vencimiento-terminos',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('fecha es obligatoria');
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('rechaza un subtipo desconocido', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('En negociación'),
      );

      const result = await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Fracaso',
        subtype: 'motivo-inventado',
        resultDate: '2026-03-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Subtipo desconocido');
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('acepta cualquiera de los 13 subtipos oficiales (incluye inasistencia-deudor)', async () => {
      const {
        getFailureTypes,
      } = require('@/features/document/templates-config');
      expect(getFailureTypes().length).toBe(13);

      for (const { id } of getFailureTypes()) {
        mockPrisma.case.findUnique.mockResolvedValue(
          existingNoFolder('En negociación'),
        );
        mockPrisma.case.update.mockClear();

        const result = await updateCasePhase({
          caseId: 'case-1',
          newPhase: 'Fracaso',
          subtype: id,
          resultDate: '2026-03-01',
        });

        expect(result.success).toBe(true);
        expect(mockPrisma.case.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ failureType: id }),
          }),
        );
      }
    });

    it('persiste failureType/failureDate, no resultType/resultDate', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('En negociación'),
      );

      await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Fracaso',
        subtype: 'incumplimiento',
        resultDate: '2026-03-01',
      });

      const data = mockPrisma.case.update.mock.calls[0][0].data;
      expect(data).toEqual({
        phase: 'Fracaso',
        failureType: 'incumplimiento',
        failureDate: new Date('2026-03-01'),
      });
    });
  });

  describe('Desistimiento', () => {
    it('rechaza sin subtipo, sin escribir en BD', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('Admisión'),
      );

      const result = await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Desistimiento',
        resultDate: '2026-03-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('subtipo es obligatorio');
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('rechaza un subtipo que no es ni "no-pago-tarifas" ni "abandono-total"', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(
        existingNoFolder('Admisión'),
      );

      const result = await updateCasePhase({
        caseId: 'case-1',
        newPhase: 'Desistimiento',
        subtype: 'porque-si',
        resultDate: '2026-03-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Subtipo desconocido');
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it.each(['no-pago-tarifas', 'abandono-total'])(
      'acepta "%s" y persiste resultType/resultDate, no failureType/failureDate',
      async (subtype) => {
        mockPrisma.case.findUnique.mockResolvedValue(
          existingNoFolder('Admisión'),
        );

        const result = await updateCasePhase({
          caseId: 'case-1',
          newPhase: 'Desistimiento',
          subtype,
          resultDate: '2026-03-01',
        });

        expect(result.success).toBe(true);
        const data = mockPrisma.case.update.mock.calls[0][0].data;
        expect(data).toEqual({
          phase: 'Desistimiento',
          resultType: subtype,
          resultDate: new Date('2026-03-01'),
        });
      },
    );
  });

  it('no exige subtipo para fases que no lo necesitan (ej. Admisión)', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(existingNoFolder('Inicial'));

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phase: 'Admisión' } }),
    );
  });
});

describe('updateCasePhase — generación de documentos con lock (Fase 2 paso 2.3)', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    authAsAdmin();
  });

  const caseWithFolder = (
    phase: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: 'case-1',
    phase,
    caseNumber: 'INSOL-000001',
    debtorName: 'Juan Pérez',
    driveFolderId: 'drive-folder-1',
    failureType: null,
    ...overrides,
  });

  it('genera documentos protegido por el lock al pasar a Admisión', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(caseWithFolder('Inicial'));
    const {
      generateDocumentsForAdmission,
    } = require('@/features/document/generate-documents');

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(true);
    expect(generateDocumentsForAdmission).toHaveBeenCalledTimes(1);
    // El lock reclama vía DocumentGenerationRequest antes de generar (P3).
    expect(mockPrisma.documentGenerationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseId: 'case-1', kind: 'ADMISSION' }),
      }),
    );
  });

  it('usa generateDocumentsForFailure con el subtype validado del input', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(
      caseWithFolder('En negociación', { failureType: null }),
    );
    const {
      generateDocumentsForFailure,
    } = require('@/features/document/generate-documents');

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Fracaso',
      subtype: 'vencimiento-terminos',
      resultDate: '2026-03-01',
    });

    expect(result.success).toBe(true);
    expect(generateDocumentsForFailure).toHaveBeenCalledWith(
      expect.anything(),
      'drive-folder-1',
      'vencimiento-terminos',
    );
    expect(mockPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failureType: 'vencimiento-terminos',
          failureDate: new Date('2026-03-01'),
        }),
      }),
    );
  });

  it('no genera documentos si el caso no tiene carpeta de Drive', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(
      caseWithFolder('Inicial', { driveFolderId: null }),
    );
    const {
      generateDocumentsForAdmission,
    } = require('@/features/document/generate-documents');

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(true);
    expect(generateDocumentsForAdmission).not.toHaveBeenCalled();
  });

  it('no genera documentos para fases fuera de PHASES_WITH_DOCUMENTS', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(caseWithFolder('Admisión'));
    const {
      generateDocumentsForAdmission,
      generateDocumentsForAgreement,
      generateDocumentsForFailure,
    } = require('@/features/document/generate-documents');

    await updateCasePhase({ caseId: 'case-1', newPhase: 'En negociación' });

    expect(generateDocumentsForAdmission).not.toHaveBeenCalled();
    expect(generateDocumentsForAgreement).not.toHaveBeenCalled();
    expect(generateDocumentsForFailure).not.toHaveBeenCalled();
  });

  it('un fallo en la generación no revierte el cambio de fase ya persistido', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(caseWithFolder('Inicial'));
    const {
      generateDocumentsForAdmission,
    } = require('@/features/document/generate-documents');
    generateDocumentsForAdmission.mockRejectedValueOnce(
      new Error('Drive caído'),
    );

    const result = await updateCasePhase({
      caseId: 'case-1',
      newPhase: 'Admisión',
    });

    // La fase ya se persistió antes del bloque de documentos (antiguo bug:
    // el fire-and-forget no distinguía esto porque nunca se esperaba).
    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phase: 'Admisión' } }),
    );
  });
});

describe('updateCase — la puerta trasera de la máquina de estados (C-1)', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    authAsAdmin();
  });

  const baseInput = {
    id: 'case-1',
    debtorId: DEBTOR.id,
    operatorId: ADMIN_USER.id,
  };

  const persisted = (phase: string | null, version = 3) => ({
    version,
    phase,
  });

  it('permite editar el caso reenviando la fase actual sin cambios', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(persisted('En negociación'));
    mockPrisma.case.update.mockResolvedValue({
      ...CASE_DATA,
      id: 'case-1',
      phase: 'En negociación',
    });

    const result = await updateCase({
      ...baseInput,
      phase: 'En negociación',
      attorney: 'Nuevo apoderado',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).toHaveBeenCalled();
  });

  it('BYPASS: rechaza el salto Inicial → Terminado vía updateCase', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(persisted('Inicial'));

    const result = await updateCase({ ...baseInput, phase: 'Terminado' });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza una fase arbitraria vía updateCase', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(persisted('Inicial'));

    const result = await updateCase({
      ...baseInput,
      phase: 'Archivado por el juez',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza incluso una transición legal, y remite a "Cambiar fase"', async () => {
    // Inicial → Admisión es válida, pero debe pasar por updateCasePhase para
    // que se disparen auditoría, notificación y generación documental.
    mockPrisma.case.findUnique.mockResolvedValue(persisted('Inicial'));

    const result = await updateCase({ ...baseInput, phase: 'Admisión' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cambiar fase');
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('mantiene el bloqueo optimista: version desactualizada aborta la escritura', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(persisted('Inicial', 7));

    const result = await updateCase({ ...baseInput, version: 3 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('modificado por otro usuario');
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('deniega sin el permiso "Editar casos"', async () => {
    mockAuthenticateUser.mockResolvedValue({
      // Puede ver casos pero NO editarlos.
      user: { ...ADMIN_USER, permissions: [P.VER_CASOS] },
      tenantId: TENANT.id,
    });

    const result = await updateCase({ ...baseInput, attorney: 'X' });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('devuelve error si el caso no existe en el tenant', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const result = await updateCase({ ...baseInput, attorney: 'X' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Caso no encontrado');
  });
});
