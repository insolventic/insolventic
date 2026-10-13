'use server';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/features/auth/actions';
import { P } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import {
  resolveCaseVisibility,
  caseWhereFromVisibility,
  type CaseVisibility,
} from '@/features/case/case-access';

/**
 * Búsqueda global (la barra del encabezado).
 *
 * HALLAZGO G-A1 (`docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md`, 🟠 Alto). Esta era
 * **la única server action del sistema sin ningún check de permisos**: sacaba
 * el `tenantId` de la sesión y nada más. Cualquier usuario autenticado
 * escribiendo dos caracteres obtenía nombre, cédula y correo de **todos** los
 * deudores del centro, más todos los casos y acreedores. Es la acción que más
 * datos personales expone del sistema, y cae de lleno bajo la Ley 1581 de 2012.
 *
 * LO QUE SE ARREGLA, EN DOS CAPAS:
 *
 *  1. **Permiso por categoría.** Cada una de las tres consultas exige el mismo
 *     permiso que su listado: `VER_CASOS` (como `getAllCases`), `VER_DEUDORES`
 *     (como `getAllDebtors`) y `VER_ACREEDORES` (como `getAllCreditors`). Un
 *     rol sin esos permisos no recibe resultados de esa categoría; sin ninguno
 *     de los tres, la búsqueda devuelve lista vacía. La `Secretaria`, por
 *     ejemplo, pasa a encontrar casos y nada más.
 *
 *  2. **Visibilidad por fila en los casos**, con el mismo alcance que
 *     `getCaseById`: quien solo tiene `Ver casos propios` encuentra los suyos,
 *     y quien tiene `Ver casos como cliente` encuentra su expediente.
 *
 * EL ROL CLIENTE, QUE ES EL CASO QUE MOTIVÓ EL HALLAZGO. El rol `Usuario` del
 * seed **tiene** `Ver deudores` y `Ver acreedores`, así que la capa 1 por sí
 * sola no lo detendría: seguiría enumerando a todos los deudores del centro.
 * Por eso cuando el alcance es `client` las dos consultas se acotan también por
 * fila — su propia ficha de deudor, y solo los acreedores que figuran en una
 * deuda de sus expedientes. Esto es MÁS estricto que `getAllDebtors`, que hoy
 * no scopea nada; esa asimetría es deliberada y está reportada aparte.
 */

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'case' | 'debtor' | 'creditor';
  href: string;
}

/** Longitud mínima de la consulta; por debajo no se toca la base. */
const MIN_QUERY_LENGTH = 2;

/** Resultados por categoría. */
const TAKE = 5;

/**
 * Acota deudores y acreedores cuando el usuario es un cliente.
 *
 * Devuelve `null` cuando no hay que consultar nada. Se separa de la consulta
 * para que el caso "cliente" sea explícito y testeable por sí mismo.
 */
function clientScope(visibility: CaseVisibility): { debtorId: string } | null {
  return visibility.scope === 'client'
    ? { debtorId: visibility.debtorId }
    : null;
}

export async function globalSearch(query: string): Promise<{
  success: boolean;
  data?: SearchResult[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!query || query.length < MIN_QUERY_LENGTH) {
      return { success: true, data: [] };
    }

    const canSearchCases = user.permissions.includes(P.VER_CASOS);
    const canSearchDebtors = user.permissions.includes(P.VER_DEUDORES);
    const canSearchCreditors = user.permissions.includes(P.VER_ACREEDORES);

    // Sin ninguno de los tres no hay nada que buscar. Se corta antes de
    // autenticar contra la base para no gastar tres consultas en un usuario
    // que no puede ver ningún resultado.
    if (!canSearchCases && !canSearchDebtors && !canSearchCreditors) {
      return { success: true, data: [] };
    }

    const visibility = await resolveCaseVisibility(user, tenantId);
    const caseScope = caseWhereFromVisibility(visibility);
    const asClient = clientScope(visibility);

    // `caseScope === null` es "no debe ver ningún caso", que no es lo mismo que
    // un `where` vacío. Ver el docblock de `caseWhereFromVisibility`.
    const searchCases = canSearchCases && caseScope !== null;

    // Un usuario con alcance `none` (sin permiso de alcance, o cliente sin
    // ficha de deudor) tampoco debe ver deudores ni acreedores: su expediente
    // no existe, así que no hay a qué acotarlos.
    const scopeIsEmpty = visibility.scope === 'none';

    const [cases, debtors, creditors] = await Promise.all([
      searchCases
        ? prisma.case.findMany({
            where: {
              tenantId,
              ...caseScope,
              OR: [
                { caseNumber: { contains: query, mode: 'insensitive' } },
                { debtorName: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              caseNumber: true,
              debtorName: true,
              type: true,
            },
            take: TAKE,
          })
        : Promise.resolve([]),

      canSearchDebtors && !scopeIsEmpty
        ? prisma.debtor.findMany({
            where: {
              tenantId,
              // Cliente: únicamente su propia ficha.
              ...(asClient ? { id: asClient.debtorId } : {}),
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { idNumber: { contains: query } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              idNumber: true,
            },
            take: TAKE,
          })
        : Promise.resolve([]),

      canSearchCreditors && !scopeIsEmpty
        ? prisma.creditor.findMany({
            where: {
              tenantId,
              // Cliente: solo los acreedores que figuran en una deuda de sus
              // expedientes. Un acreedor del centro con el que no tiene
              // ninguna relación no es información suya.
              ...(asClient
                ? {
                    debts: {
                      some: {
                        tenantId,
                        case: { debtorId: asClient.debtorId },
                      },
                    },
                  }
                : {}),
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { nit: { contains: query } },
              ],
            },
            select: {
              id: true,
              name: true,
              nit: true,
            },
            take: TAKE,
          })
        : Promise.resolve([]),
    ]);

    const results: SearchResult[] = [
      ...cases.map((c) => ({
        id: c.id,
        title: `${c.caseNumber} - ${c.debtorName}`,
        subtitle: c.type,
        category: 'case' as const,
        href: `/cases?search=${encodeURIComponent(c.caseNumber)}`,
      })),
      ...debtors.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: `CC: ${d.idNumber}`,
        category: 'debtor' as const,
        href: `/debtors?search=${encodeURIComponent(d.name)}`,
      })),
      ...creditors.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `NIT: ${c.nit}`,
        category: 'creditor' as const,
        href: `/creditors?search=${encodeURIComponent(c.name)}`,
      })),
    ];

    return { success: true, data: results };
  } catch (error) {
    logger.error('Global search failed', error, { action: 'globalSearch' });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en la búsqueda',
    };
  }
}
