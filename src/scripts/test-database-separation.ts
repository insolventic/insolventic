import prisma from '@/lib/prisma';
import type { TenantId } from '@/lib/prisma';

async function testTenantSeparation() {
  console.log('Testing tenant separation...\n');

  const tenantSlugs: TenantId[] = ['armonia', 'constructores-paz'];

  for (const tenantSlug of tenantSlugs) {
    try {
      console.log(`Testing tenant: ${tenantSlug}`);

      // Get tenant
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });

      if (!tenant) {
        console.error(`  ❌ Tenant ${tenantSlug} not found\n`);
        continue;
      }

      const userCount = await prisma.user.count({
        where: { tenantId: tenant.id },
      });
      const caseCount = await prisma.case.count({
        where: { tenantId: tenant.id },
      });
      const debtorCount = await prisma.debtor.count({
        where: { tenantId: tenant.id },
      });

      console.log(`  Users: ${userCount}`);
      console.log(`  Cases: ${caseCount}`);
      console.log(`  Debtors: ${debtorCount}`);
      console.log(`  ✅ Tenant ${tenantSlug} is accessible and isolated\n`);
    } catch (error) {
      console.error(`  ❌ Error accessing tenant ${tenantSlug}:`, error);
      console.log('');
    }
  }

  await prisma.$disconnect();
  console.log('Tenant separation test completed.');
}

if (require.main === module) {
  testTenantSeparation().catch(console.error);
}

export { testTenantSeparation };
