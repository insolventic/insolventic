'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import { createNotificationForAction } from '@/features/notification/actions';
import { createAuditLog } from '@/features/audit-log/actions';

import {
  createDebtorSchema,
  updateDebtorSchema,
  debtorSchema,
  debtorSummarySchema,
  getAllDebtorsSchema,
  getDebtorByIdSchema,
  deleteDebtorSchema,
  type Debtor,
  type DebtorSummaryData,
} from './schemas';

export async function getAllDebtors(): Promise<{
  success: boolean;
  data?: Debtor[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.VER_DEUDORES)) {
      throw new Error('No tiene permisos para: Ver deudores');
    }

    // Build where clause for cases based on user permissions
    let caseWhereClause: {
      operatorId?: string;
      debtorId?: string;
      tenantId: string;
    } = {
      tenantId,
    };

    // Check user permissions to determine case visibility scope
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    let debtors: Awaited<ReturnType<typeof prisma.debtor.findMany>>;

    if (canViewAllCases) {
      // Administrador, Operadora de Insolvencia, Secretaria: see all debtors
      debtors = await prisma.debtor.findMany({
        where: {
          tenantId,
        },
        include: {
          cases: true,
          debts: {
            include: {
              creditor: {
                select: {
                  name: true,
                },
              },
            },
          },
          assets: true,
          _count: {
            select: {
              cases: true,
              debts: true,
              assets: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (canViewOwnCases) {
      // Abogado, Asistente Legal: only debtors from cases they are working on
      caseWhereClause = {
        ...caseWhereClause,
        operatorId: user.id,
      };

      // Get cases the user has access to
      const accessibleCases = await prisma.case.findMany({
        where: caseWhereClause,
        select: {
          debtorId: true,
        },
      });

      const debtorIds = [...new Set(accessibleCases.map((c) => c.debtorId))];

      debtors = await prisma.debtor.findMany({
        where: {
          id: { in: debtorIds },
          tenantId,
        },
        include: {
          cases: {
            where: caseWhereClause,
          },
          debts: {
            include: {
              creditor: {
                select: {
                  name: true,
                },
              },
            },
          },
          assets: true,
          _count: {
            select: {
              cases: true,
              debts: true,
              assets: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (canViewAsClient) {
      // Usuario: only their own debtor record
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        include: {
          cases: true,
          debts: {
            include: {
              creditor: {
                select: {
                  name: true,
                },
              },
            },
          },
          assets: true,
          _count: {
            select: {
              cases: true,
              debts: true,
              assets: true,
            },
          },
        },
      });

      debtors = userDebtor ? [userDebtor] : [];
    } else {
      // No permissions to view debtors
      debtors = [];
    }

    const validated = getAllDebtorsSchema.parse(debtors);
    return { success: true, data: validated };
  } catch (error) {
    console.error('Error in getAllDebtors:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener deudores',
    };
  }
}

export async function getDebtorById(id: string): Promise<{
  success: boolean;
  data?: Debtor;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.VER_DEUDORES)) {
      throw new Error('No tiene permisos para: Ver deudores');
    }

    // Validate input
    const validatedId = getDebtorByIdSchema.parse(id);

    const debtor = await prisma.debtor.findUnique({
      where: {
        id: validatedId,
        tenantId,
      },
      include: {
        cases: true,
        debts: {
          include: {
            creditor: {
              select: {
                name: true,
              },
            },
          },
        },
        assets: true,
        _count: {
          select: {
            cases: true,
            debts: true,
            assets: true,
          },
        },
      },
    });

    if (!debtor) {
      throw new Error('Deudor no encontrado');
    }

    // Check user permissions to determine if they can view this debtor
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // Can see all debtors
      const validated = debtorSchema.parse(debtor);
      return { success: true, data: validated };
    } else if (canViewOwnCases) {
      // Can only see debtors from cases they are working on
      const hasAccessToDebtor = await prisma.case.findFirst({
        where: {
          debtorId: debtor.id,
          operatorId: user.id,
          tenantId,
        },
      });

      if (hasAccessToDebtor) {
        const validated = debtorSchema.parse(debtor);
        return { success: true, data: validated };
      }
    } else if (canViewAsClient) {
      // Can only see their own debtor record
      if (debtor.email === user.email) {
        const validated = debtorSchema.parse(debtor);
        return { success: true, data: validated };
      }
    }

    // User doesn't have permission to view this debtor
    throw new Error('No tienes permisos para ver este deudor');
  } catch (error) {
    console.error('Error in getDebtorById:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener deudor',
    };
  }
}

export async function createDebtor(input: unknown): Promise<{
  success: boolean;
  data?: DebtorSummaryData;
  error?: string;
}> {
  try {
    const { tenantId } = await authenticateUser();

    // Check permission - using authenticateUser's user object
    const { user } = await authenticateUser();
    if (!user.permissions.includes(P.CREAR_DEUDORES)) {
      throw new Error('No tiene permisos para: Crear deudores');
    }

    // Validate input
    const validatedInput = createDebtorSchema.parse(input);

    const debtor = await prisma.debtor.create({
      data: {
        ...validatedInput,
        tenantId,
      },
    });

    revalidatePath('/debtors');

    await createNotificationForAction(
      'debtor_created',
      debtor.name,
      prisma,
      tenantId,
      debtor.id,
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'created',
      entityType: 'debtor',
      entityId: debtor.id,
      entityName: debtor.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    const validated = debtorSummarySchema.parse(debtor);
    return { success: true, data: validated };
  } catch (error) {
    console.error('Error in createDebtor:', error);

    // Handle Prisma unique constraint violations
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      const meta =
        'meta' in error ? (error.meta as { target?: string[] }) : null;
      const fields = meta?.target ?? [];
      if (fields.includes('idNumber')) {
        return {
          success: false,
          error: 'Ya existe un deudor con ese número de cédula.',
        };
      }
      if (fields.includes('email')) {
        return {
          success: false,
          error: 'Ya existe un deudor con ese correo electrónico.',
        };
      }
      return {
        success: false,
        error: 'Ya existe un deudor con esos datos.',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear deudor',
    };
  }
}

export async function updateDebtor(input: unknown): Promise<{
  success: boolean;
  data?: DebtorSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.EDITAR_DEUDORES)) {
      throw new Error('No tiene permisos para: Editar deudores');
    }

    // Validate input
    const validatedInput = updateDebtorSchema.parse(input);
    const { id, ...rest } = validatedInput;

    const updatedDebtor = await prisma.debtor.update({
      where: {
        id,
        tenantId,
      },
      data: rest,
    });

    revalidatePath('/debtors');

    await createNotificationForAction(
      'debtor_updated',
      updatedDebtor.name,
      prisma,
      tenantId,
      updatedDebtor.id,
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'updated',
      entityType: 'debtor',
      entityId: updatedDebtor.id,
      entityName: updatedDebtor.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    const validated = debtorSummarySchema.parse(updatedDebtor);
    return { success: true, data: validated };
  } catch (error) {
    console.error('Error in updateDebtor:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al actualizar deudor',
    };
  }
}

export async function deleteDebtor(id: string): Promise<{
  success: boolean;
  data?: DebtorSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes(P.ELIMINAR_DEUDORES)) {
      throw new Error('No tiene permisos para: Eliminar deudores');
    }

    // Validate input
    const validatedId = deleteDebtorSchema.parse(id);

    // Delete debtor and all related records in a transaction
    // Chain: Debtor → Cases → (Documents, Debts, Assets, etc.)
    const deletedDebtor = await prisma.$transaction(async (tx) => {
      // 1. Get all case IDs for this debtor
      const cases = await tx.case.findMany({
        where: { debtorId: validatedId, tenantId },
        select: { id: true },
      });
      const caseIds = cases.map((c) => c.id);

      if (caseIds.length > 0) {
        // 2. Delete all case-related records without onDelete: Cascade
        // Include tenantId for defense-in-depth
        await tx.document.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.debt.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.asset.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.legalProcess.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.libranza.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.suspendedService.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });
        await tx.dependent.deleteMany({
          where: { caseId: { in: caseIds }, tenantId },
        });

        // 3. Delete all cases (Acreedor, Bien, ProcesoJudicial, Notification cascade automatically)
        await tx.case.deleteMany({ where: { id: { in: caseIds }, tenantId } });
      }

      // 4. Delete orphaned debts/assets linked directly to debtor (not via case)
      await tx.debt.deleteMany({ where: { debtorId: validatedId, tenantId } });
      await tx.asset.deleteMany({ where: { debtorId: validatedId, tenantId } });

      // 5. Delete the debtor
      return tx.debtor.delete({
        where: {
          id: validatedId,
          tenantId,
        },
      });
    });

    revalidatePath('/debtors');

    await createNotificationForAction(
      'debtor_deleted',
      deletedDebtor.name,
      prisma,
      tenantId,
      deletedDebtor.id,
      undefined,
      undefined,
      {
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        professionalCard: user.professionalCard,
      },
    );

    createAuditLog({
      action: 'deleted',
      entityType: 'debtor',
      entityId: deletedDebtor.id,
      entityName: deletedDebtor.name,
      actor: {
        userId: user.id,
        userName: user.name,
        userCedula: user.professionalCard,
      },
      tenantId,
    });

    const validated = debtorSummarySchema.parse(deletedDebtor);
    return { success: true, data: validated };
  } catch (error) {
    console.error('Error in deleteDebtor:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al eliminar deudor',
    };
  }
}
