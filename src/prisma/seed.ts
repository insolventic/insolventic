import { PrismaClient, Role, User, Debtor, Creditor } from '@prisma/client';
import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import type { TenantId } from '@/lib/prisma';

async function seedTenant(tenantSlug: TenantId, tenantName: string) {
  console.log(`Seeding tenant: ${tenantSlug}`);

  // Create or get tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: {
      name: tenantName,
      slug: tenantSlug,
      description: `${tenantName} tenant for multi-tenancy`,
    },
  });

  const permissions = await createPermissions(prisma, tenant.id);

  const roles = await createRoles(permissions, prisma, tenant.id);

  const users = await createUsers(roles, prisma, tenant.id);

  const creditors = await createCreditors(prisma, tenant.id);

  const debtors = await createDebtors(prisma, tenant.id);

  await createCases(debtors, users, creditors, prisma, tenant.id);

  await createNotifications(users, prisma, tenant.id);

  console.log(`Tenant ${tenantSlug} seeded successfully`);
}

export async function main() {
  const tenants: Array<{ slug: TenantId; name: string }> = [
    { slug: 'armonia', name: 'Armonia' },
    { slug: 'constructores-paz', name: 'Constructores de Paz' },
  ];

  for (const tenant of tenants) {
    try {
      await seedTenant(tenant.slug, tenant.name);
    } catch (error) {
      console.error(`Error seeding tenant ${tenant.slug}:`, error);
    }
  }
}

async function createPermissions(prisma: PrismaClient, tenantId: string) {
  const permissionsData = [
    {
      name: 'Ver usuarios',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Crear usuarios',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Editar usuarios',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Eliminar usuarios',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Ver roles',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Crear roles',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Editar roles',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Eliminar roles',
      category: 'Usuarios y Roles',
    },
    {
      name: 'Ver casos',
      category: 'Casos',
    },
    {
      name: 'Crear casos',
      category: 'Casos',
    },
    {
      name: 'Editar casos',
      category: 'Casos',
    },
    {
      name: 'Eliminar casos',
      category: 'Casos',
    },
    {
      name: 'Ver acreedores',
      category: 'Acreedores',
    },
    {
      name: 'Crear acreedores',
      category: 'Acreedores',
    },
    {
      name: 'Editar acreedores',
      category: 'Acreedores',
    },
    {
      name: 'Eliminar acreedores',
      category: 'Acreedores',
    },
    {
      name: 'Ver deudores',
      category: 'Deudores',
    },
    {
      name: 'Crear deudores',
      category: 'Deudores',
    },
    {
      name: 'Editar deudores',
      category: 'Deudores',
    },
    {
      name: 'Eliminar deudores',
      category: 'Deudores',
    },
    {
      name: 'Ver documentos',
      category: 'Documentos',
    },
    {
      name: 'Generar documentos',
      category: 'Documentos',
    },
    {
      name: 'Ver notificaciones',
      category: 'Notificaciones',
    },
    {
      name: 'Editar notificaciones',
      category: 'Notificaciones',
    },
    {
      name: 'Gestionar notificaciones',
      category: 'Notificaciones',
    },
    {
      name: 'Ver todos los casos',
      category: 'Casos',
    },
    {
      name: 'Ver casos propios',
      category: 'Casos',
    },
    {
      name: 'Ver casos como cliente',
      category: 'Casos',
    },
    {
      name: 'Ver auditoría',
      category: 'Auditoría',
    },
    {
      name: 'Ver calendario',
      category: 'Calendario',
    },
    {
      name: 'Ver reportes',
      category: 'Reportes',
    },
    {
      name: 'Registrar pagos',
      category: 'Pagos',
    },
  ];

  const createdPermissions = [];
  for (const permissionData of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: {
        name_tenantId: {
          name: permissionData.name,
          tenantId,
        },
      },
      update: {},
      create: {
        ...permissionData,
        tenantId,
      },
    });
    createdPermissions.push(permission);
  }

  return createdPermissions;
}

async function createRoles(
  permissions: Array<{
    id: string;
    name: string;
    category: string;
  }>,
  prisma: PrismaClient,
  tenantId: string,
) {
  const findPermission = (name: string) =>
    permissions.find((p) => p.name === name);

  const adminRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Administrador',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Administrador',
      description: 'Acceso completo al sistema',
      color: 'bg-red-100 text-red-800',
      tenantId,
    },
  });

  const adminPermissions = [
    'Ver usuarios',
    'Crear usuarios',
    'Editar usuarios',
    'Eliminar usuarios',
    'Ver casos',
    'Ver todos los casos',
    'Crear casos',
    'Editar casos',
    'Eliminar casos',
    'Ver acreedores',
    'Crear acreedores',
    'Editar acreedores',
    'Eliminar acreedores',
    'Ver deudores',
    'Crear deudores',
    'Editar deudores',
    'Eliminar deudores',
    'Ver contactos',
    'Ver documentos',
    'Generar documentos',
    'Ver roles',
    'Crear roles',
    'Editar roles',
    'Eliminar roles',
    'Ver notificaciones',
    'Editar notificaciones',
    'Gestionar notificaciones',
    'Ver auditoría',
    'Ver calendario',
    'Ver reportes',
    'Registrar pagos',
  ];

  for (const permissionName of adminPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  const operatorRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Operadora de Insolvencia',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Operadora de Insolvencia',
      description: 'Operador especializado en procesos de insolvencia',
      color: 'bg-purple-100 text-purple-800',
      tenantId,
    },
  });

  const operatorPermissions = [
    'Ver casos',
    'Ver todos los casos',
    'Crear casos',
    'Editar casos',
    'Eliminar casos',
    'Ver acreedores',
    'Crear acreedores',
    'Editar acreedores',
    'Ver deudores',
    'Crear deudores',
    'Editar deudores',
    'Ver documentos',
    'Generar documentos',
    'Ver notificaciones',
  ];

  for (const permissionName of operatorPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: operatorRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: operatorRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  const lawyerRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Abogado',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Abogado',
      description: 'Gestión de casos y audiencias',
      color: 'bg-blue-100 text-blue-800',
      tenantId,
    },
  });

  const lawyerPermissions = [
    'Ver casos',
    'Ver casos propios',
    'Crear casos',
    'Editar casos',
    'Ver acreedores',
    'Ver deudores',
    'Ver documentos',
    'Generar documentos',
    'Ver notificaciones',
  ];

  for (const permissionName of lawyerPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: lawyerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: lawyerRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  const assistantRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Asistente Legal',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Asistente Legal',
      description: 'Apoyo en gestión legal y documental',
      color: 'bg-green-100 text-green-800',
      tenantId,
    },
  });

  const assistantPermissions = [
    'Ver casos',
    'Ver casos propios',
    'Ver acreedores',
    'Ver deudores',
    'Ver documentos',
    'Generar documentos',
    'Ver notificaciones',
  ];

  for (const permissionName of assistantPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: assistantRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: assistantRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  const secretaryRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Secretaria',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Secretaria',
      description: 'Apoyo administrativo',
      color: 'bg-yellow-100 text-yellow-800',
      tenantId,
    },
  });

  const secretaryPermissions = [
    'Ver documentos',
    'Ver casos',
    'Ver todos los casos',
  ];

  for (const permissionName of secretaryPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: secretaryRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: secretaryRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  // Create default user role for registered users
  const userRole = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: 'Usuario',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Usuario',
      description: 'Usuario registrado con permisos básicos',
      color: 'bg-gray-100 text-gray-800',
      tenantId,
    },
  });

  const userPermissions = [
    'Ver notificaciones',
    'Ver casos',
    'Ver casos como cliente',
    'Ver deudores',
    'Ver acreedores',
    'Ver documentos',
  ];

  for (const permissionName of userPermissions) {
    const permission = findPermission(permissionName);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: permission.id,
          tenantId,
        },
      });
    }
  }

  return {
    adminRole,
    operatorRole,
    lawyerRole,
    assistantRole,
    secretaryRole,
    userRole,
  };
}

interface Roles {
  adminRole: Role;
  lawyerRole: Role;
  assistantRole: Role;
  operatorRole: Role;
  secretaryRole: Role;
  userRole: Role;
}

async function createUsers(
  roles: Roles,
  prisma: PrismaClient,
  tenantId: string,
) {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const beatriz = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'beatriz.malavera@insolventic.com',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Beatriz Helena Malavera López',
      email: 'beatriz.malavera@insolventic.com',
      password: hashedPassword,
      lastLogin: new Date('2025-01-29T08:30:00'),
      professionalCard: '194.548',
      phone: '3101234567',
      address: 'Calle 123 #45-67, Bogotá',
      createdDate: new Date('2025-01-01'),
      roleId: roles.adminRole.id,
      tenantId,
    },
  });

  const sofia = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'sofia.torres@insolventic.com',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Sofía Alejandra Torres Ramírez',
      email: 'sofia.torres@insolventic.com',
      password: hashedPassword,
      lastLogin: new Date('2025-01-29T09:15:00'),
      professionalCard: '198.765',
      phone: '3187654321',
      address: 'Carrera 11 #85-23, Bogotá',
      createdDate: new Date('2025-01-01'),
      roleId: roles.operatorRole.id,
      tenantId,
    },
  });

  const maximiliano = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'maximiliano.jaramillo@insolventic.com',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Maximiliano Jaramillo Jaramillo',
      email: 'maximiliano.jaramillo@insolventic.com',
      password: hashedPassword,
      lastLogin: new Date('2025-01-29T07:45:00'),
      professionalCard: '156.789',
      phone: '3202345678',
      address: 'Carrera 45 #12-34, Bogotá',
      createdDate: new Date('2025-01-01'),
      roleId: roles.lawyerRole.id,
      tenantId,
    },
  });

  const carlos = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'carlos.rodriguez@insolventic.com',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Carlos Andrés Rodríguez',
      email: 'carlos.rodriguez@insolventic.com',
      password: hashedPassword,
      lastLogin: new Date('2025-01-28T16:20:00'),
      professionalCard: 'N/A',
      phone: '3153456789',
      address: 'Avenida 34 #56-78, Bogotá',
      createdDate: new Date('2025-01-01'),
      roleId: roles.assistantRole.id,
      tenantId,
    },
  });

  const maria = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'maria.gonzalez@insolventic.com',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'María Fernanda González',
      email: 'maria.gonzalez@insolventic.com',
      password: hashedPassword,
      lastLogin: new Date('2025-01-25T14:15:00'),
      professionalCard: 'N/A',
      phone: '3164567890',
      address: 'Calle 89 #12-34, Bogotá',
      createdDate: new Date('2025-01-01'),
      roleId: roles.secretaryRole.id,
      tenantId,
    },
  });

  return { beatriz, sofia, maximiliano, carlos, maria };
}

interface Debtors {
  maria: Debtor;
  carlos: Debtor;
  ana: Debtor;
}

interface Users {
  beatriz: User;
  sofia: User;
  maximiliano: User;
  carlos: User;
  maria: User;
}

interface Creditors {
  bancolombia: Creditor;
  coopvalle: Creditor;
  tarjetasxyz: Creditor;
  finpopular: Creditor;
}

async function createCreditors(prisma: PrismaClient, tenantId: string) {
  const bancolombia = await prisma.creditor.upsert({
    where: {
      nit_tenantId: {
        nit: '860.002.964-4',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Banco Nacional de Colombia',
      type: 'FINANCIAL',
      email: 'cobranzas@banconal.com.co',
      phone: '+57 1 234-5678',
      address: 'Carrera 7 #32-16, Bogotá',
      representative: 'María García',
      nit: '860.002.964-4',
      city: 'Bogotá',
      department: 'Cundinamarca',
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const coopvalle = await prisma.creditor.upsert({
    where: {
      nit_tenantId: {
        nit: '890.300.567-8',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Cooperativa Financiera del Valle',
      type: 'Cooperativa',
      email: 'juridica@coopvalle.com.co',
      phone: '+57 2 345-6789',
      address: 'Avenida 6N #25-45, Cali',
      representative: 'Carlos Rodríguez',
      nit: '890.300.567-8',
      city: 'Cali',
      department: 'Valle del Cauca',
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const tarjetasxyz = await prisma.creditor.upsert({
    where: {
      nit_tenantId: {
        nit: '900.123.456-7',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Tarjetas de Crédito XYZ',
      type: 'FINANCIAL',
      email: 'recuperacion@tarjetasxyz.com',
      phone: '+57 4 456-7890',
      address: 'Calle 50 #45-30, Medellín',
      representative: 'Ana Martínez',
      nit: '900.123.456-7',
      city: 'Medellín',
      department: 'Antioquia',
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const finpopular = await prisma.creditor.upsert({
    where: {
      nit_tenantId: {
        nit: '800.456.789-1',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Financiera Popular',
      type: 'FINANCIAL',
      email: 'cobranza@finpopular.com.co',
      phone: '+57 5 567-8901',
      address: 'Carrera 54 #72-15, Barranquilla',
      representative: 'Luis Fernández',
      nit: '800.456.789-1',
      city: 'Barranquilla',
      department: 'Atlántico',
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  return { bancolombia, coopvalle, tarjetasxyz, finpopular };
}

async function createDebtors(prisma: PrismaClient, tenantId: string) {
  const maria = await prisma.debtor.upsert({
    where: {
      idNumber_tenantId: {
        idNumber: '52123456',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'María González Pérez',
      idNumber: '52123456',
      idType: 'CC',
      email: 'maria.gonzalez@email.com',
      phone: '+57 300 123-4567',
      address: 'Calle 45 #12-34, Bogotá',
      city: 'Bogotá',
      department: 'Cundinamarca',
      birthDate: new Date('1985-05-15'),
      maritalStatus: 'CASADO',
      occupation: 'Empleada',
      monthlyIncome: 2500000,
      monthlyExpenses: 2200000,
      otherIncomeDescription: 'Arriendos de propiedad familiar',
      otherIncomeAmount: 800000,
      hasEmployerCertification: true,
      dependents: 2,
      educationLevel: 'UNIVERSITARIO',
      totalDebt: 45000000,
      emergencyContact: 'Pedro González',
      emergencyPhone: '3112345678',
      bankAccount: '24536789',
      bankName: 'Bancolombia',
      accountType: 'AHORROS',
      activeCases: 1,
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const carlos = await prisma.debtor.upsert({
    where: {
      idNumber_tenantId: {
        idNumber: '80987654',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Carlos Rodríguez Silva',
      idNumber: '80987654',
      idType: 'CC',
      email: 'carlos.rodriguez@email.com',
      phone: '+57 310 987-6543',
      address: 'Carrera 15 #67-89, Medellín',
      city: 'Medellín',
      department: 'Antioquia',
      birthDate: new Date('1978-08-20'),
      maritalStatus: 'SOLTERO',
      occupation: 'Independiente',
      monthlyIncome: 1800000,
      monthlyExpenses: 1600000,
      otherIncomeDescription: 'Consultoría freelance',
      otherIncomeAmount: 1200000,
      hasEmployerCertification: false,
      dependents: 0,
      educationLevel: 'POSTGRADO',
      totalDebt: 28500000,
      emergencyContact: 'Ana Rodríguez',
      emergencyPhone: '3223456789',
      bankAccount: '98765432',
      bankName: 'Davivienda',
      accountType: 'CORRIENTE',
      activeCases: 1,
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const ana = await prisma.debtor.upsert({
    where: {
      idNumber_tenantId: {
        idNumber: '41234567',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Ana Martínez López',
      idNumber: '41234567',
      idType: 'CC',
      email: 'ana.martinez@email.com',
      phone: '+57 320 234-5678',
      address: 'Avenida 80 #45-12, Cali',
      city: 'Cali',
      department: 'Valle del Cauca',
      birthDate: new Date('1990-03-10'),
      maritalStatus: 'UNION_LIBRE',
      occupation: 'Pensionada',
      monthlyIncome: 1200000,
      monthlyExpenses: 1000000,
      otherIncomeDescription: null,
      otherIncomeAmount: null,
      hasEmployerCertification: true,
      dependents: 1,
      educationLevel: 'TECNICO',
      totalDebt: 15200000,
      bankAccount: '12345678',
      bankName: 'Banco de Bogotá',
      accountType: 'AHORROS',
      activeCases: 1,
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  return { maria, carlos, ana };
}

async function createCases(
  debtors: Debtors,
  users: Users,
  creditors: Creditors,
  prisma: PrismaClient,
  tenantId: string,
) {
  const case1 = await prisma.case.upsert({
    where: {
      caseNumber_tenantId: {
        caseNumber: 'INS-2025-001',
        tenantId,
      },
    },
    update: {},
    create: {
      caseNumber: 'INS-2025-001',
      debtorName: 'María González Pérez',
      type: 'INSOLVENCY',
      totalDebt: 45000000,
      creditors: 5,
      createdDate: new Date('2025-01-15'),
      hearingDate: new Date('2025-02-14'),
      phase: 'En negociación',
      debtorId: debtors.maria.id,
      operatorId: users.sofia.id,
      tramite: 'Insolvencia de Persona Natural No Comerciante',
      filingDate: new Date('2025-01-10'),
      debtorIdNumber: '52123456',
      convened: 'Cooperativa Financiera',
      attorney: 'Dr. Juan Carlos Pérez',
      owedCapital: 42000000,
      designatedOperator: 'Sofía Alejandra Torres Ramírez',
      designationDate: new Date('2025-01-12'),
      positionAcceptanceDate: new Date('2025-01-13'),
      inadmissionDate: null,
      admissionDate: new Date('2025-01-14'),
      firstHearingDate: new Date('2025-02-14'),
      firstHearingTime: '10:00',
      rejection: false,
      withdrawal: false,
      hasLegalProcesses: true,
      courtNumber: 'Juzgado 15 Civil del Circuito',
      city: 'Bogotá',
      processType: 'EJECUTIVO',
      plaintiff: 'Banco Nacional de Colombia',
      judicialFileNumber: '2024-00123',
      suspensionDate: new Date('2025-01-16'),
      resultDeliveryDate: null,
      resultType: null,
      resultDate: null,
      siccacNumber: null,
      riskCenterCommunication: true,

      // Ámbito de Aplicación
      applicantScope: ['Persona Natural No Comerciante', 'Asalariado'],

      // Propuesta de Pago
      gracePeriodRequested: true,
      gracePeriodMonths: 6,
      paymentInKind: false,
      paymentInKindDescription: null,
      assetSaleAuthorized: true,
      assetSaleDescription: 'Venta de vehículo particular',
      cashFlowPayment: true,
      paymentTermMonths: 60,
      monthlyPaymentAmount: 750000,
      variablePayment: 0,
      extraordinaryPayment: true,
      extraordinaryPaymentDate: 'Diciembre de cada año (prima)',
      capitalReduction: true,
      capitalReductionPercent: 15,
      insuranceOffering: 'Póliza de vida vigente por $50.000.000',
      forgiveAccruedInterest: true,
      forgiveFutureInterest: false,
      paymentOrder: [
        'Obligaciones alimentarias',
        'Créditos hipotecarios',
        'Créditos de consumo',
        'Tarjetas de crédito',
      ],
      hasClassPrivileges: true,
      classPrivilegesDescription:
        'Primer lugar: obligaciones con garantía real. Segundo lugar: créditos de consumo.',
      thirdPartyPaymentAuth: false,
      guaranteeSubstitution: true,

      // Sociedad Conyugal
      spouseName: 'Pedro Antonio González Martínez',
      spouseIdNumber: '79456123',
      spouseAddress: 'Calle 45 #12-34, Bogotá',
      spousePhone: '3152345678',
      spouseEmail: 'pedro.gonzalez@email.com',

      // Tarifa y Fundamentos
      requestedFee: 'Tarifa subsidiada según ingresos',
      legalFoundations:
        'Ley 1564 de 2012 (Código General del Proceso), Ley 1380 de 2010 (Insolvencia Persona Natural), artículos 531 a 577 del CGP.',

      // Notificaciones
      notificationAddress: 'Calle 45 #12-34, Apto 301, Bogotá',
      notificationPhone: '3001234567',
      notificationEmail: 'maria.gonzalez@email.com',

      // Firma
      applicantSignatureName: 'María González Pérez',
      applicantSignatureId: '52123456',
      applicantSignature: null,

      tenantId,
    },
  });

  const case2 = await prisma.case.upsert({
    where: {
      caseNumber_tenantId: {
        caseNumber: 'CON-2025-002',
        tenantId,
      },
    },
    update: {},
    create: {
      caseNumber: 'CON-2025-002',
      debtorName: 'Carlos Rodríguez Silva',
      type: 'CONCILIATION',
      totalDebt: 28500000,
      creditors: 3,
      createdDate: new Date('2025-01-10'),
      hearingDate: new Date('2025-02-09'),
      phase: 'Audiencia programada',
      debtorId: debtors.carlos.id,
      operatorId: users.maximiliano.id,
      tramite: 'Conciliación Extrajudicial',
      filingDate: new Date('2025-01-08'),
      debtorIdNumber: '80987654',
      convened: 'Banco Nacional',
      attorney: 'Dra. Ana María López',
      owedCapital: 26000000,
      designatedOperator: 'Maximiliano Jaramillo Pérez',
      designationDate: new Date('2025-01-09'),
      positionAcceptanceDate: new Date('2025-01-10'),
      inadmissionDate: null,
      admissionDate: new Date('2025-01-11'),
      firstHearingDate: new Date('2025-02-09'),
      firstHearingTime: '14:30',
      rejection: false,
      withdrawal: false,
      hasLegalProcesses: false,
      courtNumber: null,
      city: 'Medellín',
      processType: null,
      plaintiff: null,
      judicialFileNumber: null,
      suspensionDate: null,
      resultDeliveryDate: null,
      resultType: null,
      resultDate: null,
      siccacNumber: null,
      riskCenterCommunication: false,

      // Ámbito de Aplicación
      applicantScope: ['Persona Natural No Comerciante', 'Independiente'],

      // Propuesta de Pago
      gracePeriodRequested: false,
      gracePeriodMonths: null,
      paymentInKind: true,
      paymentInKindDescription:
        'Prestación de servicios profesionales de desarrollo de software',
      assetSaleAuthorized: false,
      assetSaleDescription: null,
      cashFlowPayment: true,
      paymentTermMonths: 36,
      monthlyPaymentAmount: 900000,
      variablePayment: 0,
      extraordinaryPayment: false,
      extraordinaryPaymentDate: null,
      capitalReduction: true,
      capitalReductionPercent: 20,
      insuranceOffering: null,
      forgiveAccruedInterest: true,
      forgiveFutureInterest: true,
      paymentOrder: [
        'Créditos con garantía real',
        'Tarjetas de crédito',
        'Créditos personales',
      ],
      hasClassPrivileges: false,
      classPrivilegesDescription: null,
      thirdPartyPaymentAuth: true,
      guaranteeSubstitution: false,

      // Sociedad Conyugal (soltero - sin datos)
      spouseName: null,
      spouseIdNumber: null,
      spouseAddress: null,
      spousePhone: null,
      spouseEmail: null,

      // Tarifa y Fundamentos
      requestedFee: 'Tarifa plena según tabla de honorarios',
      legalFoundations:
        'Ley 640 de 2001 (Conciliación Extrajudicial), Decreto 1829 de 2013, artículos aplicables del CGP.',

      // Notificaciones
      notificationAddress: 'Carrera 15 #67-89, Of 502, Medellín',
      notificationPhone: '3109876543',
      notificationEmail: 'carlos.rodriguez@email.com',

      // Firma
      applicantSignatureName: 'Carlos Rodríguez Silva',
      applicantSignatureId: '80987654',
      applicantSignature: null,

      tenantId,
    },
  });

  const case3 = await prisma.case.upsert({
    where: {
      caseNumber_tenantId: {
        caseNumber: 'ACU-2025-003',
        tenantId,
      },
    },
    update: {},
    create: {
      caseNumber: 'ACU-2025-003',
      debtorName: 'Ana Martínez López',
      type: 'SUPPORT_AGREEMENT',
      totalDebt: 15200000,
      creditors: 2,
      createdDate: new Date('2025-01-05'),
      hearingDate: null,
      phase: 'Documentos pendientes',
      debtorId: debtors.ana.id,
      operatorId: users.sofia.id,
      tramite: 'Acuerdo de Apoyo Económico',
      filingDate: new Date('2025-01-03'),
      debtorIdNumber: '41234567',
      convened: null,
      attorney: null,
      owedCapital: 14500000,
      designatedOperator: 'Sofía Alejandra Torres Ramírez',
      designationDate: new Date('2025-01-04'),
      positionAcceptanceDate: new Date('2025-01-05'),
      inadmissionDate: null,
      admissionDate: null,
      firstHearingDate: null,
      firstHearingTime: null,
      rejection: false,
      withdrawal: false,
      hasLegalProcesses: false,
      courtNumber: null,
      city: 'Cali',
      processType: null,
      plaintiff: null,
      judicialFileNumber: null,
      suspensionDate: null,
      resultDeliveryDate: null,
      resultType: null,
      resultDate: null,
      siccacNumber: null,
      riskCenterCommunication: false,

      // Ámbito de Aplicación
      applicantScope: ['Persona Natural No Comerciante', 'Pensionado'],

      // Propuesta de Pago
      gracePeriodRequested: true,
      gracePeriodMonths: 3,
      paymentInKind: false,
      paymentInKindDescription: null,
      assetSaleAuthorized: false,
      assetSaleDescription: null,
      cashFlowPayment: true,
      paymentTermMonths: 48,
      monthlyPaymentAmount: 350000,
      variablePayment: 0,
      extraordinaryPayment: false,
      extraordinaryPaymentDate: null,
      capitalReduction: true,
      capitalReductionPercent: 25,
      insuranceOffering: null,
      forgiveAccruedInterest: true,
      forgiveFutureInterest: true,
      paymentOrder: ['Obligaciones alimentarias', 'Tarjetas de crédito'],
      hasClassPrivileges: false,
      classPrivilegesDescription: null,
      thirdPartyPaymentAuth: false,
      guaranteeSubstitution: false,

      // Sociedad Conyugal (unión libre)
      spouseName: 'Jorge Enrique Salazar',
      spouseIdNumber: '80234567',
      spouseAddress: 'Avenida 80 #45-12, Cali',
      spousePhone: '3203456789',
      spouseEmail: 'jorge.salazar@email.com',

      // Tarifa y Fundamentos
      requestedFee: 'Tarifa subsidiada para pensionados',
      legalFoundations:
        'Ley 1380 de 2010, Ley 1564 de 2012, artículos relacionados con acuerdos de pago y reestructuración de deudas.',

      // Notificaciones
      notificationAddress: 'Avenida 80 #45-12, Casa 5, Cali',
      notificationPhone: '3202345678',
      notificationEmail: 'ana.martinez@email.com',

      // Firma
      applicantSignatureName: 'Ana Martínez López',
      applicantSignatureId: '41234567',
      applicantSignature: null,

      tenantId,
    },
  });

  const luis = await prisma.debtor.upsert({
    where: {
      idNumber_tenantId: {
        idNumber: '19876543',
        tenantId,
      },
    },
    update: {},
    create: {
      name: 'Luis Fernando Castro',
      idNumber: '19876543',
      idType: 'CC',
      email: 'luis.castro@email.com',
      phone: '+57 315 876-5432',
      address: 'Carrera 30 #25-90, Bogotá',
      city: 'Bogotá',
      department: 'Cundinamarca',
      birthDate: new Date('1975-12-01'),
      maritalStatus: 'CASADO',
      occupation: 'Empresario',
      monthlyIncome: 5000000,
      monthlyExpenses: 3500000,
      otherIncomeDescription: 'Dividendos de empresa familiar y alquileres',
      otherIncomeAmount: 2500000,
      hasEmployerCertification: true,
      dependents: 3,
      educationLevel: 'POSTGRADO',
      totalDebt: 67800000,
      emergencyContact: 'Carmen Castro',
      emergencyPhone: '3145678901',
      bankAccount: '11223344',
      bankName: 'BBVA',
      accountType: 'CORRIENTE',
      activeCases: 1,
      createdDate: new Date(),
      lastUpdate: new Date(),
      tenantId,
    },
  });

  const case4 = await prisma.case.upsert({
    where: {
      caseNumber_tenantId: {
        caseNumber: 'INS-2025-004',
        tenantId,
      },
    },
    update: {},
    create: {
      caseNumber: 'INS-2025-004',
      debtorName: 'Luis Fernando Castro',
      type: 'INSOLVENCY',
      totalDebt: 67800000,
      creditors: 8,
      createdDate: new Date('2025-01-01'),
      hearingDate: new Date('2025-01-24'),
      phase: 'Acuerdo aprobado',
      debtorId: luis.id,
      operatorId: users.sofia.id,
      tramite: 'Insolvencia de Persona Natural No Comerciante',
      filingDate: new Date('2024-12-28'),
      debtorIdNumber: '19876543',
      convened: 'Entidad Financiera XYZ',
      attorney: 'Dr. Roberto Sánchez',
      owedCapital: 65000000,
      designatedOperator: 'Sofía Alejandra Torres Ramírez',
      designationDate: new Date('2024-12-30'),
      positionAcceptanceDate: new Date('2025-01-02'),
      inadmissionDate: null,
      admissionDate: new Date('2025-01-03'),
      firstHearingDate: new Date('2025-01-24'),
      firstHearingTime: '09:00',
      rejection: false,
      withdrawal: false,
      hasLegalProcesses: true,
      courtNumber: 'Juzgado 8 Civil del Circuito',
      city: 'Bogotá',
      processType: 'ORDINARIO',
      plaintiff: 'Cooperativa Financiera del Valle',
      judicialFileNumber: '2024-00456',
      suspensionDate: new Date('2025-01-05'),
      resultDeliveryDate: new Date('2025-01-25'),
      resultType: 'ACUERDO',
      resultDate: new Date('2025-01-24'),
      siccacNumber: 'SICCAC-2025-001',
      riskCenterCommunication: true,

      // Ámbito de Aplicación
      applicantScope: [
        'Persona Natural No Comerciante',
        'Empresario',
        'Asalariado',
      ],

      // Propuesta de Pago
      gracePeriodRequested: true,
      gracePeriodMonths: 12,
      paymentInKind: false,
      paymentInKindDescription: null,
      assetSaleAuthorized: true,
      assetSaleDescription:
        'Venta de local comercial en Bogotá y vehículo de lujo',
      cashFlowPayment: true,
      paymentTermMonths: 72,
      monthlyPaymentAmount: 1200000,
      variablePayment: 500000,
      extraordinaryPayment: true,
      extraordinaryPaymentDate: 'Junio y Diciembre (utilidades de empresa)',
      capitalReduction: true,
      capitalReductionPercent: 10,
      insuranceOffering:
        'Póliza de vida y hogar por valor total de $120.000.000',
      forgiveAccruedInterest: true,
      forgiveFutureInterest: false,
      paymentOrder: [
        'Créditos hipotecarios',
        'Obligaciones alimentarias',
        'Créditos comerciales',
        'Tarjetas de crédito',
      ],
      hasClassPrivileges: true,
      classPrivilegesDescription:
        'Primera clase: créditos con garantía hipotecaria. Segunda clase: obligaciones tributarias. Tercera clase: créditos comerciales.',
      thirdPartyPaymentAuth: true,
      guaranteeSubstitution: true,

      // Sociedad Conyugal
      spouseName: 'Carmen Rosa Castro Villegas',
      spouseIdNumber: '52678901',
      spouseAddress: 'Carrera 30 #25-90, Bogotá',
      spousePhone: '3146789012',
      spouseEmail: 'carmen.castro@email.com',

      // Tarifa y Fundamentos
      requestedFee: 'Tarifa plena según complejidad del caso',
      legalFoundations:
        'Ley 1380 de 2010 (Insolvencia Persona Natural), Ley 1564 de 2012 (CGP), artículos 531 a 577 del CGP, jurisprudencia de la Corte Constitucional sobre insolvencia.',

      // Notificaciones
      notificationAddress: 'Carrera 30 #25-90, Torre B, Apto 1502, Bogotá',
      notificationPhone: '3158765432',
      notificationEmail: 'luis.castro@email.com',

      // Firma
      applicantSignatureName: 'Luis Fernando Castro',
      applicantSignatureId: '19876543',
      applicantSignature: null,

      tenantId,
    },
  });

  const cases = [case1, case2, case3, case4];
  const creditorsList = [
    creditors.bancolombia,
    creditors.coopvalle,
    creditors.tarjetasxyz,
    creditors.finpopular,
  ];

  for (const caseItem of cases) {
    const numDebts = Math.min(caseItem.creditors, 3);
    for (let i = 0; i < numDebts; i++) {
      const creditor = creditorsList[i % creditorsList.length];
      const debtAmount = Math.floor(
        caseItem.totalDebt.toNumber() / caseItem.creditors,
      );

      await prisma.debt.create({
        data: {
          amount: debtAmount + i * 1000000,
          interestRate: 1.5 + i * 0.5,
          type: 'PERSONAL',
          caseId: caseItem.id,
          creditorId: creditor.id,
          debtorId: caseItem.debtorId,
          tenantId,
        },
      });
    }

    const assetValueBase = 80000000;
    const assetValueVariation = cases.indexOf(caseItem) * 10000000;
    await prisma.asset.create({
      data: {
        name: 'Bien Inmueble',
        type: 'INMUEBLE',
        value: assetValueBase + assetValueVariation,
        caseId: caseItem.id,
        debtorId: caseItem.debtorId,
        tenantId,
      },
    });

    let documentTypeName: string;
    if (caseItem.type === 'INSOLVENCY') {
      documentTypeName = 'Insolvencia';
    } else if (caseItem.type === 'CONCILIATION') {
      documentTypeName = 'Conciliación';
    } else {
      documentTypeName = 'Acuerdo';
    }

    let caseNumberLower: string;
    const caseIndex = cases.indexOf(caseItem) + 1;
    if (caseItem.type === 'INSOLVENCY') {
      caseNumberLower = `ins-2025-00${caseIndex}`;
    } else if (caseItem.type === 'CONCILIATION') {
      caseNumberLower = 'con-2025-002';
    } else {
      caseNumberLower = `acu-2025-00${caseIndex}`;
    }

    await prisma.document.create({
      data: {
        name: `Solicitud de ${documentTypeName}`,
        type: 'LAWSUIT',
        status: 'PENDING',
        uploadDate: caseItem.createdDate,
        url: `/documents/${caseNumberLower}_solicitud.pdf`,
        caseId: caseItem.id,
        tenantId,
      },
    });
  }

  // Crear libranzas para case1 (María González - asalariada)
  await prisma.libranza.createMany({
    data: [
      {
        payerName: 'Banco Davivienda',
        payerAddress: 'Carrera 7 #12-34, Bogotá',
        payerEmail: 'libranzas@davivienda.com',
        payerPhone: '3001234567',
        deductedAmount: 450000,
        productAndCreditor:
          'Crédito de libranza para compra de vivienda - Saldo: $8.500.000',
        caseId: case1.id,
        tenantId,
      },
      {
        payerName: 'Cooperativa Colanta',
        payerAddress: 'Calle 45 #67-89, Bogotá',
        payerEmail: 'creditos@colanta.com',
        payerPhone: '3109876543',
        deductedAmount: 280000,
        productAndCreditor: 'Crédito rotativo - Saldo: $4.200.000',
        caseId: case1.id,
        tenantId,
      },
    ],
  });

  // Crear servicios suspendidos para case1 (María González)
  await prisma.suspendedService.createMany({
    data: [
      {
        creditorName: 'Claro Colombia',
        address: 'Carrera 10 #97-13, Bogotá',
        email: 'servicioalcliente@claro.com.co',
        phone: '3201234567',
        suspendedProduct: 'Internet y TV Cable',
        amountOwed: 120000,
        caseId: case1.id,
        tenantId,
      },
      {
        creditorName: 'Bodytech Gimnasios',
        address: 'Calle 80 #12-34, Bogotá',
        email: 'info@bodytech.com.co',
        phone: '3109876543',
        suspendedProduct: 'Membresía mensual',
        amountOwed: 85000,
        caseId: case1.id,
        tenantId,
      },
    ],
  });

  // Crear dependientes para case1 (María González - 2 hijos)
  await prisma.dependent.createMany({
    data: [
      {
        name: 'Laura González Martínez',
        relationship: 'Hija',
        age: 12,
        caseId: case1.id,
        tenantId,
      },
      {
        name: 'Diego González Martínez',
        relationship: 'Hijo',
        age: 8,
        caseId: case1.id,
        tenantId,
      },
    ],
  });

  // Crear procesos judiciales para case1 (María González - tiene 2 procesos ejecutivos)
  await prisma.legalProcess.createMany({
    data: [
      {
        description: 'Proceso ejecutivo hipotecario',
        processType: 'EJECUTIVO',
        plaintiff: 'Banco Nacional de Colombia',
        court: 'Juzgado 15 Civil del Circuito de Bogotá',
        fileNumber: '2024-00123',
        precautionaryMeasure: 'Embargo sobre el bien inmueble',
        caseId: case1.id,
        tenantId,
      },
      {
        description: 'Proceso ejecutivo singular',
        processType: 'EJECUTIVO',
        plaintiff: 'Cooperativa Financiera de Bogotá',
        court: 'Juzgado 27 Civil Municipal de Bogotá',
        fileNumber: '2024-00456',
        precautionaryMeasure: 'Embargo sobre salario',
        caseId: case1.id,
        tenantId,
      },
    ],
  });

  // Crear libranzas para case4 (Luis Fernando Castro - empresario con alto endeudamiento)
  await prisma.libranza.createMany({
    data: [
      {
        payerName: 'Banco de Occidente',
        payerAddress: 'Calle 100 #8A-49, Bogotá',
        payerEmail: 'empresarial@occidente.com.co',
        payerPhone: '3156789012',
        deductedAmount: 850000,
        productAndCreditor:
          'Crédito de libranza empresarial - Saldo: $15.600.000',
        caseId: case4.id,
        tenantId,
      },
      {
        payerName: 'Financiera Dann Regional',
        payerAddress: 'Carrera 15 #93-30, Bogotá',
        payerEmail: 'creditos@dann.com.co',
        payerPhone: '3102345678',
        deductedAmount: 620000,
        productAndCreditor:
          'Crédito para inversión comercial - Saldo: $9.800.000',
        caseId: case4.id,
        tenantId,
      },
    ],
  });

  // Crear servicios suspendidos para case4 (Luis Fernando Castro)
  await prisma.suspendedService.createMany({
    data: [
      {
        creditorName: 'Club El Nogal',
        address: 'Carrera 7 #73-55, Bogotá',
        email: 'socios@elnogal.com',
        phone: '3176543210',
        suspendedProduct: 'Membresía club social empresarial',
        amountOwed: 450000,
        caseId: case4.id,
        tenantId,
      },
      {
        creditorName: 'Revista Semana',
        address: 'Carrera 11 #77A-09, Bogotá',
        email: 'suscripciones@semana.com',
        phone: '3123456789',
        suspendedProduct: 'Suscripción anual digital',
        amountOwed: 180000,
        caseId: case4.id,
        tenantId,
      },
      {
        creditorName: 'Seguros Bolivar',
        address: 'Calle 72 #10-07, Bogotá',
        email: 'atencioncliente@bolivar.com',
        phone: '3198765432',
        suspendedProduct: 'Seguro todo riesgo vehículo BMW',
        amountOwed: 320000,
        caseId: case4.id,
        tenantId,
      },
    ],
  });

  // Crear dependientes para case4 (Luis Fernando Castro - 3 hijos)
  await prisma.dependent.createMany({
    data: [
      {
        name: 'María Fernanda Castro Villegas',
        relationship: 'Hija',
        age: 18,
        caseId: case4.id,
        tenantId,
      },
      {
        name: 'Luis Andrés Castro Villegas',
        relationship: 'Hijo',
        age: 15,
        caseId: case4.id,
        tenantId,
      },
      {
        name: 'Sofía Castro Villegas',
        relationship: 'Hija',
        age: 10,
        caseId: case4.id,
        tenantId,
      },
    ],
  });

  // Crear dependiente para case3 (Ana Martínez - 1 hijo)
  await prisma.dependent.create({
    data: {
      name: 'Camilo Salazar Martínez',
      relationship: 'Hijo',
      age: 14,
      caseId: case3.id,
      tenantId,
    },
  });
}

async function createNotifications(
  users: Users,
  prisma: PrismaClient,
  tenantId: string,
) {
  const case1 = await prisma.case.findFirst();

  const notifications = [
    {
      type: 'case_created',
      title: 'Nuevo caso creado',
      message: 'Se ha creado un nuevo caso de insolvencia',
      userId: users.beatriz.id,
      caseId: case1?.id,
    },
    {
      type: 'creditor_updated',
      title: 'Acreedor actualizado',
      message: 'Se ha actualizado la información de un acreedor',
      userId: users.beatriz.id,
    },
    {
      type: 'debtor_created',
      title: 'Nuevo deudor registrado',
      message: 'Se ha registrado un nuevo deudor en el sistema',
      userId: users.beatriz.id,
    },
    {
      type: 'user_updated',
      title: 'Usuario actualizado',
      message: 'Se ha actualizado la información de un usuario',
      userId: users.beatriz.id,
    },
    {
      type: 'case_deleted',
      title: 'Caso eliminado',
      message: 'Se ha eliminado un caso del sistema',
      userId: users.sofia.id,
    },
  ];

  await prisma.notification.deleteMany({});

  for (const notification of notifications) {
    await prisma.notification.create({
      data: {
        ...notification,
        tenantId,
      },
    });
  }
}

const isMainModule =
  process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');

if (isMainModule) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch((e) => {
        console.error('Error disconnecting from database:', e);
      });
    });
}
