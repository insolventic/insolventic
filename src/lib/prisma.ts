import { PrismaClient } from '@prisma/client';

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

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
