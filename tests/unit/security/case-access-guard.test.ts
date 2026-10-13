/**
 * Regresión de GC-A1 / GD-M4 / GC-M5: las mutaciones de expediente, las
 * acciones de generación y los reportes no aplicaban visibilidad por fila.
 *
 * El modo de falla que esto atrapa: un rol con `Ver casos propios` tiene
 * `EDITAR_CASOS`, así que pasaba el check de permiso, y el único filtro
 * restante era `tenantId` — podía editar, borrar o cambiar de fase **cualquier
 * expediente del centro** pasando el id directo a la server action. No hacía
 * falta tocar la UI.
 *
 * Los casos positivos están tan presentes como los negativos a propósito: un
 * guard que bloquea de más rompe el trabajo diario de Abogado y Asistente
 * Legal, que son los dos roles que más usan el sistema.
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

import { TENANT, PERMISSIONS } from '../../helpers/fixtures';
import {
  assertCaseAccess,
  assertCaseAccessOnRow,
  resolveCaseVisibility,
  caseWhereFromVisibility,
  caseWhereOrNothing,
  isCaseAccessError,
  findParentCaseId,
} from '@/features/case/case-access';

const P = PERMISSIONS;

const OWNER = { id: 'user-abogado-dueno', email: 'duenio@test.com' };
const OTHER = { id: 'user-abogado-ajeno', email: 'ajeno@test.com' };

const CASE_ROW = {
  id: 'case-1',
  operatorId: OWNER.id,
  debtorId: 'debtor-1',
};

function userWith(permissions: string[], who = OWNER) {
  return { id: who.id, email: who.email, permissions };
}

describe('case-access — el guard de visibilidad por fila', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
  });

  describe('resolveCaseVisibility', () => {
    it('Ver todos los casos gana sobre Ver casos propios', async () => {
      const v = await resolveCaseVisibility(
        userWith([P.VIEW_ALL_CASES, P.VIEW_OWN_CASES]),
        TENANT.id,
      );
      expect(v).toEqual({ scope: 'all' });
    });

    it('Ver casos propios se resuelve al id del usuario', async () => {
      const v = await resolveCaseVisibility(
        userWith([P.VIEW_OWN_CASES]),
        TENANT.id,
      );
      expect(v).toEqual({ scope: 'own', operatorId: OWNER.id });
    });

    it('cliente con ficha de deudor se resuelve a su debtorId', async () => {
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-99' });
      const v = await resolveCaseVisibility(
        userWith([P.VIEW_AS_CLIENT]),
        TENANT.id,
      );
      expect(v).toEqual({ scope: 'client', debtorId: 'debtor-99' });
      expect(mockPrisma.debtor.findFirst).toHaveBeenCalledWith({
        where: { email: OWNER.email, tenantId: TENANT.id },
        select: { id: true },
      });
    });

    it('cliente SIN ficha de deudor cae a `none`, no a "ver todo"', async () => {
      mockPrisma.debtor.findFirst.mockResolvedValue(null);
      const v = await resolveCaseVisibility(
        userWith([P.VIEW_AS_CLIENT]),
        TENANT.id,
      );
      expect(v).toEqual({ scope: 'none' });
    });

    it('sin ningún permiso de alcance cae a `none`', async () => {
      const v = await resolveCaseVisibility(
        userWith([P.VIEW_CASES, P.EDIT_CASES]),
        TENANT.id,
      );
      expect(v).toEqual({ scope: 'none' });
    });
  });

  describe('caseWhereFromVisibility / caseWhereOrNothing', () => {
    it('`all` es un where vacío; `none` es null — y NO son lo mismo', () => {
      expect(caseWhereFromVisibility({ scope: 'all' })).toEqual({});
      expect(caseWhereFromVisibility({ scope: 'none' })).toBeNull();
    });

    it('`own` y `client` filtran por su columna', () => {
      expect(
        caseWhereFromVisibility({ scope: 'own', operatorId: 'u1' }),
      ).toEqual({ operatorId: 'u1' });
      expect(
        caseWhereFromVisibility({ scope: 'client', debtorId: 'd1' }),
      ).toEqual({ debtorId: 'd1' });
    });

    it('caseWhereOrNothing convierte `none` en un where que no matchea nada', () => {
      expect(caseWhereOrNothing({ scope: 'none' })).toEqual({ id: { in: [] } });
      // Y no en `{}`, que devolvería TODO el tenant: ese es el bug.
      expect(caseWhereOrNothing({ scope: 'none' })).not.toEqual({});
    });
  });

  describe('assertCaseAccessOnRow', () => {
    it('deja pasar a quien ve todos los casos', async () => {
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.VIEW_ALL_CASES]),
          tenantId: TENANT.id,
        }),
      ).resolves.toBeUndefined();
    });

    it('deja pasar al operador asignado', async () => {
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.VIEW_OWN_CASES], OWNER),
          tenantId: TENANT.id,
        }),
      ).resolves.toBeUndefined();
    });

    it('RECHAZA a otro operador del mismo tenant (caso ajeno)', async () => {
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.VIEW_OWN_CASES], OTHER),
          tenantId: TENANT.id,
        }),
      ).rejects.toThrow('No tienes permisos para acceder a este caso');
    });

    it('RECHAZA al cliente cuyo debtorId no es el del caso', async () => {
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'otro-debtor' });
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.VIEW_AS_CLIENT]),
          tenantId: TENANT.id,
        }),
      ).rejects.toThrow('No tienes permisos para acceder a este caso');
    });

    it('deja pasar al cliente dueño del expediente', async () => {
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: CASE_ROW.debtorId });
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.VIEW_AS_CLIENT]),
          tenantId: TENANT.id,
        }),
      ).resolves.toBeUndefined();
    });

    it('RECHAZA a quien no tiene permiso de alcance', async () => {
      await expect(
        assertCaseAccessOnRow({
          caseRow: CASE_ROW,
          user: userWith([P.EDIT_CASES]),
          tenantId: TENANT.id,
        }),
      ).rejects.toThrow('No tienes permisos para acceder a este caso');
    });
  });

  describe('assertCaseAccess (carga la fila)', () => {
    it('consulta acotada por tenantId y devuelve la fila mínima', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(CASE_ROW);

      const row = await assertCaseAccess({
        caseId: 'case-1',
        user: userWith([P.VIEW_ALL_CASES]),
        tenantId: TENANT.id,
      });

      expect(row).toEqual(CASE_ROW);
      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-1', tenantId: TENANT.id },
        select: { id: true, operatorId: true, debtorId: true },
      });
    });

    it('un caso de OTRO TENANT se ve como no encontrado', async () => {
      // El `where` lleva tenantId, así que Prisma devuelve null.
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        assertCaseAccess({
          caseId: 'case-de-otro-tenant',
          user: userWith([P.VIEW_ALL_CASES]),
          tenantId: TENANT.id,
        }),
      ).rejects.toThrow('Caso no encontrado');
    });

    it('un caso ajeno del MISMO tenant se rechaza por permisos, no por existencia', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(CASE_ROW);

      await expect(
        assertCaseAccess({
          caseId: 'case-1',
          user: userWith([P.VIEW_OWN_CASES], OTHER),
          tenantId: TENANT.id,
        }),
      ).rejects.toThrow('No tienes permisos para acceder a este caso');
    });

    it('el error es reconocible como CaseAccessError', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);
      try {
        await assertCaseAccess({
          caseId: 'x',
          user: userWith([P.VIEW_ALL_CASES]),
          tenantId: TENANT.id,
        });
        throw new Error('debió lanzar');
      } catch (error) {
        expect(isCaseAccessError(error)).toBe(true);
      }
    });
  });

  describe('findParentCaseId (las remove*FromCase reciben el id de la hija)', () => {
    const modelos = [
      ['debt', 'debt'],
      ['libranza', 'libranza'],
      ['suspendedService', 'suspendedService'],
      ['asset', 'asset'],
      ['dependent', 'dependent'],
      ['apoderado', 'apoderado'],
    ] as const;

    it.each(modelos)(
      'sube al expediente padre de %s, acotado por tenantId',
      async (modelo, delegate) => {
        (
          mockPrisma[delegate as keyof typeof mockPrisma] as unknown as {
            findUnique: jest.Mock;
          }
        ).findUnique.mockResolvedValue({ caseId: 'case-padre' });

        const caseId = await findParentCaseId(modelo, 'hija-1', TENANT.id);

        expect(caseId).toBe('case-padre');
        expect(
          (
            mockPrisma[delegate as keyof typeof mockPrisma] as unknown as {
              findUnique: jest.Mock;
            }
          ).findUnique,
        ).toHaveBeenCalledWith({
          where: { id: 'hija-1', tenantId: TENANT.id },
          select: { caseId: true },
        });
      },
    );

    it('devuelve null cuando la fila hija no existe en el tenant', async () => {
      mockPrisma.debt.findUnique.mockResolvedValue(null);
      await expect(findParentCaseId('debt', 'x', TENANT.id)).resolves.toBeNull();
    });
  });
});
