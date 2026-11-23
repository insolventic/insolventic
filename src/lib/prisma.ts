import { PrismaClient } from '@prisma/client';

import { conFiltroDePapelera } from './papelera';

type TenantId = 'armonia' | 'constructores-paz';

interface TenantConfig {
  id: TenantId;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = base;

/**
 * Papelera de expedientes: toda operación sobre `Case` que no nombre
 * `deletedAt` en su `where` recibe `deletedAt: null`. Ver `./papelera.ts`.
 * Aplica también dentro de `$transaction(async (tx) => …)`.
 *
 * El cast a `PrismaClient` es deliberado: una extensión de `query` no cambia
 * la forma de los resultados, y sin el cast el tipo extendido no encaja en
 * las firmas que reciben `PrismaClient` o `Prisma.TransactionClient`.
 */
const prisma = base.$extends({
  query: {
    case: {
      $allOperations({ operation, args, query }) {
        return query(conFiltroDePapelera(operation, args));
      },
    },
  },
}) as unknown as PrismaClient;

// Tenant configurations for UI and metadata
const tenantConfigs: TenantConfig[] = [
  {
    id: 'armonia',
    name: 'Armonia',
    slug: 'armonia',
    description: 'Base de datos principal de Armonia',
    logoUrl: '/images/toucan.png',
  },
  {
    id: 'constructores-paz',
    name: 'Constructores de Paz',
    slug: 'constructores-paz',
    description: 'Base de datos de Constructores de Paz',
    logoUrl: '/images/dove-of-peace.png',
  },
];

export function getTenantConfig(tenantId: TenantId): TenantConfig | undefined {
  return tenantConfigs.find((config) => config.id === tenantId);
}

export function getAvailableTenants(): TenantConfig[] {
  return tenantConfigs;
}

export default prisma;
export type { TenantId, TenantConfig };
