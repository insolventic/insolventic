import { main as seedMain } from './seed';
import prisma from '@/lib/prisma';
import type { TenantId } from '@/lib/prisma';

async function resetDatabase(tenantId?: TenantId) {
  if (tenantId) {
    console.log(`Resetting data for tenant: ${tenantId}`);

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantId },
    });

    if (!tenant) {
      console.error(`Tenant ${tenantId} not found`);
      return;
    }

    const tenantFilter = { tenantId: tenant.id };

    // Delete in dependency order
    await prisma.notification.deleteMany({ where: tenantFilter });
    await prisma.document.deleteMany({ where: tenantFilter });
    await prisma.documentFromDrive.deleteMany({ where: tenantFilter });
    await prisma.documentTemplate.deleteMany({ where: tenantFilter });
    await prisma.legalProcess.deleteMany({ where: tenantFilter });
    await prisma.dependent.deleteMany({ where: tenantFilter });
    await prisma.suspendedService.deleteMany({ where: tenantFilter });
    await prisma.libranza.deleteMany({ where: tenantFilter });
    await prisma.asset.deleteMany({ where: tenantFilter });
    await prisma.debt.deleteMany({ where: tenantFilter });

    await prisma.case.deleteMany({ where: tenantFilter });

    await prisma.contact.deleteMany({ where: tenantFilter });
    await prisma.user.deleteMany({ where: tenantFilter });
    await prisma.creditor.deleteMany({ where: tenantFilter });
    await prisma.debtor.deleteMany({ where: tenantFilter });

    await prisma.rolePermission.deleteMany({ where: tenantFilter });
    await prisma.role.deleteMany({ where: tenantFilter });
    await prisma.permission.deleteMany({ where: tenantFilter });
    await prisma.passwordResetToken.deleteMany({ where: tenantFilter });

    console.log(`Tenant ${tenantId} data reset completed`);
  } else {
    console.log('Resetting entire database');

    // Reset everything - delete in dependency order
    await prisma.notification.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.documentFromDrive.deleteMany({});
    await prisma.documentTemplate.deleteMany({});
    await prisma.legalProcess.deleteMany({});
    await prisma.dependent.deleteMany({});
    await prisma.suspendedService.deleteMany({});
    await prisma.libranza.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.debt.deleteMany({});

    await prisma.case.deleteMany({});

    await prisma.contact.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.creditor.deleteMany({});
    await prisma.debtor.deleteMany({});

    await prisma.rolePermission.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.tenant.deleteMany({});

    console.log('Database reset completed');
  }
}

async function main() {
  // Check if a specific tenant is requested
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const tenantId = tenantArg
    ? (tenantArg.split('=')[1] as TenantId)
    : undefined;

  try {
    await resetDatabase(tenantId);
  } catch (error) {
    console.error(`Error resetting database:`, error);
    throw error;
  }
}

main()
  .then(async () => {
    const shouldSeed = process.argv.includes('--seed');
    if (shouldSeed) {
      await seedMain();
    }
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Reset failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
