/**
 * Integration Tests: apoderados del deudor, editables después de crear el caso.
 *
 * Hallazgo más severo de la auditoría transversal formulario -> plantillas
 * (2026-10-02): `apoderados` (la tabla relacional, `Apoderado[]`) no aparece
 * en `updateCaseSchema` ni en ningún lugar que `updateCase()` lea. El
 * componente `ApoderadoSection` se monta en el diálogo de edición y sugiere
 * que se puede agregar/editar/borrar, pero nada de eso llega al servidor:
 * es estructuralmente imposible agregar, editar o borrar un apoderado
 * después de crear el caso.
 *
 * Se resuelve con el mismo patrón que Debt/Asset/Libranza/SuspendedService/
 * Dependent: acciones dedicadas de alta y baja (`addApoderadoToCase`,
 * `removeApoderadoFromCase`), no un campo más de `updateCase`. "Editar" un
 * apoderado es, como en esos otros casos, borrarlo y agregarlo de nuevo con
 * el dato corregido -- no hay edición en el lugar en ninguno de los 5
 * modelos hermanos, y este no es la excepción.
 *
 * A propósito NO se toca acá: el espejo del apoderado principal en las 8
 * columnas escalares `apoderado_*` de `Case` (`mirrorPrincipalApoderado`).
 * Esas columnas ya son editables directamente desde el 2026-10-02
 * (`general-fields.ts`, PR #102) y mezclar las dos vías aquí fabricaría un
 * registro híbrido si alguien las edita por separado a propósito.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { TENANT, ADMIN_USER } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import {
  addApoderadoToCase,
  removeApoderadoFromCase,
} from '@/features/case/actions';

const CASE_ID = 'case-1';

describe('apoderados del deudor — alta y baja post-creación', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    mockCreateAuditLog.mockClear();

    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });
  });

  describe('addApoderadoToCase', () => {
    it('sin el permiso EDITAR_CASOS, rechaza sin tocar la base', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: { ...ADMIN_USER, permissions: [] },
        tenantId: TENANT.id,
      });

      const result = await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dr. Pérez',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.apoderado.create).not.toHaveBeenCalled();
    });

    it('si el caso no existe (o es de otro tenant), rechaza sin crear nada', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const result = await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dr. Pérez',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.apoderado.create).not.toHaveBeenCalled();
    });

    it('crea el apoderado con los datos enviados, scopeado al tenant', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.apoderado.count.mockResolvedValue(0);
      mockPrisma.apoderado.create.mockResolvedValue({
        id: 'apo-1',
        orden: 0,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: 'CC',
        identificacion: '123456',
        tarjetaProfesional: 'TP-1',
        direccion: 'Calle 1',
        telefono: '3001234567',
        correo: 'perez@example.com',
        existePoderOtorgado: true,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      const result = await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: 'CC',
        identificacion: '123456',
        tarjetaProfesional: 'TP-1',
        direccion: 'Calle 1',
        telefono: '3001234567',
        correo: 'perez@example.com',
        existePoderOtorgado: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.nombreCompleto).toBe('Dr. Pérez');

      const call = mockPrisma.apoderado.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        caseId: CASE_ID,
        tenantId: TENANT.id,
        nombreCompleto: 'Dr. Pérez',
        orden: 0,
      });
    });

    it('el segundo apoderado de un caso recibe orden: 1, no vuelve a 0', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.apoderado.count.mockResolvedValue(1); // ya hay uno (orden 0)
      mockPrisma.apoderado.create.mockResolvedValue({
        id: 'apo-2',
        orden: 1,
        nombreCompleto: 'Dra. Gómez',
        tipoIdentificacion: null,
        identificacion: null,
        tarjetaProfesional: null,
        direccion: null,
        telefono: null,
        correo: null,
        existePoderOtorgado: false,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dra. Gómez',
      });

      const call = mockPrisma.apoderado.create.mock.calls[0][0];
      expect(call.data.orden).toBe(1);
    });

    it('campos de texto en blanco se guardan como null, no como cadena vacía', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.apoderado.count.mockResolvedValue(0);
      mockPrisma.apoderado.create.mockResolvedValue({
        id: 'apo-1',
        orden: 0,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: null,
        identificacion: null,
        tarjetaProfesional: null,
        direccion: null,
        telefono: null,
        correo: null,
        existePoderOtorgado: false,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dr. Pérez',
      });

      const call = mockPrisma.apoderado.create.mock.calls[0][0];
      expect(call.data.identificacion).toBeNull();
      expect(call.data.existePoderOtorgado).toBe(false);
    });

    it('registra auditoría con el apoderado como sub-entidad', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.apoderado.count.mockResolvedValue(0);
      mockPrisma.apoderado.create.mockResolvedValue({
        id: 'apo-1',
        orden: 0,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: null,
        identificacion: null,
        tarjetaProfesional: null,
        direccion: null,
        telefono: null,
        correo: null,
        existePoderOtorgado: false,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      await addApoderadoToCase({
        caseId: CASE_ID,
        nombreCompleto: 'Dr. Pérez',
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityId: CASE_ID,
          metadata: expect.objectContaining({
            subEntity: 'apoderado',
            subEntityId: 'apo-1',
          }),
        }),
      );
    });
  });

  describe('removeApoderadoFromCase', () => {
    // GC-A1: igual que removeDebtFromCase, ahora sube al expediente padre.
    beforeEach(() => {
      mockPrisma.apoderado.findUnique.mockResolvedValue({ caseId: CASE_ID });
      mockPrisma.case.findUnique.mockResolvedValue({
        id: CASE_ID,
        operatorId: ADMIN_USER.id,
        debtorId: 'debtor-1',
      });
    });

    it('sin el permiso EDITAR_CASOS, rechaza sin borrar nada', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: { ...ADMIN_USER, permissions: [] },
        tenantId: TENANT.id,
      });

      const result = await removeApoderadoFromCase({ apoderadoId: 'apo-1' });

      expect(result.success).toBe(false);
      expect(mockPrisma.apoderado.delete).not.toHaveBeenCalled();
    });

    it('borra scopeado al tenant: el where incluye tenantId, no solo el id', async () => {
      mockPrisma.apoderado.delete.mockResolvedValue({
        id: 'apo-1',
        orden: 0,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: null,
        identificacion: null,
        tarjetaProfesional: null,
        direccion: null,
        telefono: null,
        correo: null,
        existePoderOtorgado: false,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      const result = await removeApoderadoFromCase({ apoderadoId: 'apo-1' });

      expect(result.success).toBe(true);
      const call = mockPrisma.apoderado.delete.mock.calls[0][0];
      expect(call.where).toMatchObject({ id: 'apo-1', tenantId: TENANT.id });
    });

    it('si el apoderado no existe (o es de otro tenant), devuelve error y no explota', async () => {
      mockPrisma.apoderado.delete.mockRejectedValue(
        new Error('Record to delete does not exist.'),
      );

      const result = await removeApoderadoFromCase({ apoderadoId: 'apo-x' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('registra auditoría de baja con el apoderado como sub-entidad', async () => {
      mockPrisma.apoderado.delete.mockResolvedValue({
        id: 'apo-1',
        orden: 0,
        nombreCompleto: 'Dr. Pérez',
        tipoIdentificacion: null,
        identificacion: null,
        tarjetaProfesional: null,
        direccion: null,
        telefono: null,
        correo: null,
        existePoderOtorgado: false,
        caseId: CASE_ID,
        tenantId: TENANT.id,
      });

      await removeApoderadoFromCase({ apoderadoId: 'apo-1' });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityId: CASE_ID,
          metadata: expect.objectContaining({
            subEntity: 'apoderado',
            subEntityId: 'apo-1',
          }),
        }),
      );
    });
  });
});

describe('el diálogo de edición usa ApoderadosTab, no el ApoderadoSection de alta', () => {
  // No se mockea nada acá: es una lectura de texto del archivo real, el mismo
  // patrón que ya usan case-generation-include-single-source.test.ts (#101) y
  // edit-case-dialog-general-fields.test.ts (#102) para que un revert
  // silencioso de esta parte del wiring haga fallar un test, no solo se note
  // en producción.
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');

  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/cases/components/edit-case-dialog.tsx'),
    'utf8',
  );

  it('importa ApoderadosTab desde edit-case-dialog/apoderados-tab', () => {
    expect(source).toMatch(
      /import\s*\{\s*ApoderadosTab\s*\}\s*from\s*['"]\.\/edit-case-dialog\/apoderados-tab['"]/,
    );
  });

  it('renderiza <ApoderadosTab>, no el <ApoderadoSection> de alta', () => {
    expect(source).toContain('<ApoderadosTab caseId={caseData.id} />');
    expect(source).not.toContain('<ApoderadoSection');
  });

  it('el reset puebla apoderados desde fullCase.apoderados', () => {
    expect(source).toMatch(
      /apoderados:\s*\(fullCase\.apoderados\s*\?\?\s*\[\]\)/,
    );
  });
});
