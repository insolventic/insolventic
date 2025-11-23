'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { createNotificationForAction } from '@/features/notification/actions';

import {
  createCreditorSchema,
  updateCreditorSchema,
  creditorWithCasesSchema,
  creditorSummarySchema,
  getAllCreditorsSchema,
  getCreditorByIdSchema,
  deleteCreditorSchema,
} from './schemas';

import type {
  Creditor,
  CreditorWithCases,
  CreditorSummaryData,
} from './schemas';

export async function getAllCreditors(): Promise<{
  success: boolean;
  data?: Creditor[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver acreedores')) {
      throw new Error('No tiene permisos para: Ver acreedores');
    }

    // Check user permissions to determine case visibility scope
    const canViewAllCases = user.permissions.includes('Ver todos los casos');
    const canViewOwnCases = user.permissions.includes('Ver casos propios');
    const canViewAsClient = user.permissions.includes('Ver casos como cliente');

    let creditors: Awaited<ReturnType<typeof prisma.creditor.findMany>>;

    if (canViewAllCases) {
      // Administrador, Operadora de Insolvencia, Secretaria: see all creditors
      creditors = await prisma.creditor.findMany({
        where: {
          tenantId,
        },
        include: {
          contacts: true,
          debts: true,
          _count: {
            select: {
              debts: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (canViewOwnCases) {
      // Abogado, Asistente Legal: only creditors from cases they are working on
      const accessibleCases = await prisma.case.findMany({
        where: {
          operatorId: user.id,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      const caseIds = accessibleCases.map((c) => c.id);

      // Get debts from accessible cases
      const debtsFromAccessibleCases = await prisma.debt.findMany({
        where: {
          caseId: { in: caseIds },
          tenantId,
        },
        select: {
          creditorId: true,
        },
      });

      const creditorIds = [
        ...new Set(debtsFromAccessibleCases.map((d) => d.creditorId)),
      ];

      creditors = await prisma.creditor.findMany({
        where: {
          id: { in: creditorIds },
          tenantId,
        },
        include: {
          contacts: true,
          debts: {
            where: {
              caseId: { in: caseIds },
            },
          },
          _count: {
            select: {
              debts: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (canViewAsClient) {
      // Usuario: only creditors from cases where they are the debtor
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      if (!userDebtor) {
        return {
          success: true,
          data: [],
        };
      }

      const accessibleCases = await prisma.case.findMany({
        where: {
          debtorId: userDebtor.id,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      const caseIds = accessibleCases.map((c) => c.id);

      const debtsFromAccessibleCases = await prisma.debt.findMany({
        where: {
          caseId: { in: caseIds },
          tenantId,
        },
        select: {
          creditorId: true,
        },
      });

      const creditorIds = [
        ...new Set(debtsFromAccessibleCases.map((d) => d.creditorId)),
      ];

      creditors = await prisma.creditor.findMany({
        where: {
          id: { in: creditorIds },
          tenantId,
        },
        include: {
          contacts: true,
          debts: {
            where: {
              caseId: { in: caseIds },
            },
          },
          _count: {
            select: {
              debts: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else {
      // No permissions to view creditors
      return {
        success: true,
        data: [],
      };
    }

    // Validate with schema
    const validatedCreditors = getAllCreditorsSchema.parse(creditors);

    return {
      success: true,
      data: validatedCreditors,
    };
  } catch (error) {
    console.error('Error fetching creditors:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener acreedores',
    };
  }
}

export async function getCreditorById(id: string): Promise<{
  success: boolean;
  data?: CreditorWithCases;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Ver acreedores')) {
      throw new Error('No tiene permisos para: Ver acreedores');
    }

    // Validate input
    const validatedId = getCreditorByIdSchema.parse(id);

    const creditor = await prisma.creditor.findUnique({
      where: {
        id: validatedId,
        tenantId,
      },
      include: {
        contacts: true,
        debts: {
          include: {
            case: {
              include: {
                debtor: true,
              },
            },
          },
        },
        _count: {
          select: {
            debts: true,
          },
        },
      },
    });

    if (!creditor) {
      return {
        success: false,
        error: 'Acreedor no encontrado',
      };
    }

    // Check user permissions to determine if they can view this creditor
    const canViewAllCases = user.permissions.includes('Ver todos los casos');
    const canViewOwnCases = user.permissions.includes('Ver casos propios');
    const canViewAsClient = user.permissions.includes('Ver casos como cliente');

    if (canViewAllCases) {
      // Can see all creditors
      const validated = creditorWithCasesSchema.parse(creditor);
      return {
        success: true,
        data: validated,
      };
    } else if (canViewOwnCases) {
      // Can only see creditors from cases they are working on
      const hasAccessToCreditor = await prisma.debt.findFirst({
        where: {
          creditorId: creditor.id,
          case: {
            operatorId: user.id,
            tenantId,
          },
        },
      });

      if (hasAccessToCreditor) {
        // Filter debts to only show those from cases the user has access to
        const filteredCreditor = {
          ...creditor,
          debts: creditor.debts.filter(
            (debt) => debt.case.operatorId === user.id,
          ),
        };
        const validated = creditorWithCasesSchema.parse(filteredCreditor);
        return {
          success: true,
          data: validated,
        };
      }
    } else if (canViewAsClient) {
      // Can only see creditors from cases where they are the debtor
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
        select: { id: true },
      });

      if (userDebtor) {
        const hasAccessToCreditor = await prisma.debt.findFirst({
          where: {
            creditorId: creditor.id,
            case: {
              debtorId: userDebtor.id,
              tenantId,
            },
          },
        });

        if (hasAccessToCreditor) {
          // Filter debts to only show those from cases the user has access to
          const filteredCreditor = {
            ...creditor,
            debts: creditor.debts.filter(
              (debt) => debt.case.debtorId === userDebtor.id,
            ),
          };
          const validated = creditorWithCasesSchema.parse(filteredCreditor);
          return {
            success: true,
            data: validated,
          };
        }
      }
    }

    // User doesn't have permission to view this creditor
    throw new Error('No tienes permisos para ver este acreedor');
  } catch (error) {
    console.error('Error fetching creditor:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener acreedor',
    };
  }
}

export async function createCreditor(input: unknown): Promise<{
  success: boolean;
  data?: CreditorSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Crear acreedores')) {
      throw new Error('No tiene permisos para: Crear acreedores');
    }

    // Validate input
    const validatedInput = createCreditorSchema.parse(input);

    const creditor = await prisma.creditor.create({
      data: {
        ...validatedInput,
        tenantId,
      },
      include: {
        contacts: true,
        debts: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
    });

    revalidatePath('/creditors');

    await createNotificationForAction(
      'creditor_created',
      creditor.name,
      prisma,
      tenantId,
      creditor.id,
    );

    const validated = creditorSummarySchema.parse(creditor);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error creating creditor:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al crear el acreedor',
    };
  }
}

export async function updateCreditor(input: unknown): Promise<{
  success: boolean;
  data?: CreditorSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Editar acreedores')) {
      throw new Error('No tiene permisos para: Editar acreedores');
    }

    // Validate input
    const validatedInput = updateCreditorSchema.parse(input);
    const { id, ...rest } = validatedInput;

    const updatedCreditor = await prisma.creditor.update({
      where: {
        id,
        tenantId,
      },
      data: rest,
      include: {
        contacts: true,
        debts: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
    });

    revalidatePath('/creditors');

    await createNotificationForAction(
      'creditor_updated',
      updatedCreditor.name,
      prisma,
      tenantId,
      updatedCreditor.id,
    );

    const validated = creditorSummarySchema.parse(updatedCreditor);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error updating creditor:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al actualizar el acreedor',
    };
  }
}

export async function deleteCreditor(input: unknown): Promise<{
  success: boolean;
  data?: CreditorSummaryData;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    // Check permission
    if (!user.permissions.includes('Eliminar acreedores')) {
      throw new Error('No tiene permisos para: Eliminar acreedores');
    }

    // Validate input
    const { id } = deleteCreditorSchema.parse(input);

    const deletedCreditor = await prisma.creditor.delete({
      where: {
        id,
        tenantId,
      },
      include: {
        contacts: true,
        debts: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
    });

    revalidatePath('/creditors');

    await createNotificationForAction(
      'creditor_deleted',
      deletedCreditor.name,
      prisma,
      tenantId,
      deletedCreditor.id,
    );

    const validated = creditorSummarySchema.parse(deletedCreditor);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    console.error('Error deleting creditor:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al eliminar el acreedor',
    };
  }
}
