/**
 * Smoke test contra Postgres REAL: el wizard de creación de casos de punta a punta.
 *
 * POR QUÉ EXISTE. Los bugs de `apoderados` / `notificationCity` /
 * `otherCauseDetail` rompieron la creación de casos desde el 2026-04-01 sin que
 * ningún test lo viera: el test de integración mockea Prisma (nunca ve un
 * "Unknown argument" ni un tipo que la base rechaza) y el E2E de Playwright solo
 * comprueba que exista el botón. Aquí el cliente de Prisma es el REAL.
 *
 * QUÉ ES REAL Y QUÉ NO.
 *  - Real: Postgres, el cliente de Prisma, `createCase`, `updateCase`,
 *    `authenticateUser` (JWT firmado + rol + permisos leídos de la base),
 *    notificaciones, auditoría y el bloqueo de generación.
 *  - Simulado: solo lo que necesita el runtime de Next (cookies de la petición,
 *    revalidateTag, `after()`) y el job de generación de documentos, que iría a
 *    Google Drive / Chromium. `after()` se captura y se comprueba que se agendó.
 *
 * LA ENTRADA reproduce el wizard: se parsea con `createCaseFormSchema` (igual que
 * `zodResolver`) y se aplica la transformación de `handleSubmit`
 * (src/app/cases/components/create-case-dialog.tsx). Así viajan también los
 * valores por defecto ocultos, que fueron los que reventaron Prisma.
 *
 * SEGURIDAD: tests/db/setup.ts aborta si DATABASE_URL no es una base local de
 * prueba. Cada corrida crea su propio tenant y lo borra al terminar.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));

// El job iría a Google Drive y Chromium; aquí solo importa que se agende.
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAccessToken } from '@/lib/auth';
import { createCase, updateCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { mockCookies } from '../__mocks__/next-headers';
import { purgeTenant, wizardSubmit } from './helpers/tenant';

const TAG = `dbsmoke-${Date.now().toString(36)}`;

/** Filas de prueba de esta corrida; se borran en afterAll. */
const ctx = {
  tenantId: '',
  tenantSlug: TAG,
  userId: '',
  debtorId: '',
  otherTenantId: '',
  otherDebtorId: '',
};

/** Auditoría y notificaciones se escriben sin esperar: contamos lo esperado. */
let expectedAuditRows = 0;

/** Espera a que las escrituras "fire-and-forget" (auditoría) lleguen a la base. */
async function waitForAuditRows(tenantId: string, expected: number) {
  for (let i = 0; i < 50; i++) {
    if ((await prisma.auditLog.count({ where: { tenantId } })) >= expected) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const APODERADOS = [
  {
    nombreCompleto: 'Ana Torres',
    tipoIdentificacion: 'CC',
    identificacion: '52111222',
    tarjetaProfesional: 'TP-111',
    direccion: 'Calle 1 # 2-3',
    telefono: '3001112222',
    correo: 'ana@abogados.co',
    existePoderOtorgado: true,
  },
  {
    nombreCompleto: 'Luis Rojas',
    tipoIdentificacion: 'CE',
    identificacion: '99887766',
    tarjetaProfesional: 'TP-222',
    direccion: 'Carrera 9 # 8-7',
    telefono: '3105556666',
    correo: 'luis@abogados.co',
    existePoderOtorgado: false,
  },
  {
    nombreCompleto: 'María Gómez',
    tipoIdentificacion: 'CC',
    identificacion: '41222333',
    tarjetaProfesional: 'TP-333',
    direccion: 'Avenida 30 # 4-5',
    telefono: '3157778888',
    correo: 'maria@abogados.co',
    existePoderOtorgado: true,
  },
];

/** Lo que el usuario rellena en el wizard (los strings van como strings). */
const wizardInput = () => ({
  debtorId: ctx.debtorId,
  operatorId: ctx.userId,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: 2,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Pérdida de empleo', 'Otros'],
  otherCauseDetail: 'Cierre del negocio familiar',
  notificationCity: 'Bogotá D.C.',
  filingDate: '2026-03-10',
  monthlyIncome: 3000000,
  monthlyExpenses: 2000000,
  debts: [
    {
      creditor: 'Banco Prueba S.A.',
      type: 'TARJETA_CREDITO',
      interestRate: '2.1',
      capitalAmount: '30000000',
      interestAmount: '1500000',
      creditorCity: 'Bogotá D.C.',
      grantDate: '2024-05-01',
      dueDate: '2027-05-01',
      daysOverdue: 45,
    },
    {
      creditor: 'Cooperativa Prueba',
      type: 'CREDITO_LIBRE_INVERSION',
      interestRate: '1.8',
      capitalAmount: '20000000',
      interestAmount: '900000',
    },
  ],
  assets: [
    {
      name: 'Apartamento',
      type: 'INMUEBLE',
      value: '180000000',
      propertyType: 'Apartamento',
      address: 'Calle 100 # 15-20',
      registrationNumber: '50N-1234567',
      encumbrance: 'Hipoteca',
      isFamilyHome: true,
    },
    {
      name: 'Vehículo',
      type: 'VEHICULO',
      value: '25000000',
      brand: 'Mazda',
      model: '2019',
      licensePlate: 'ABC123',
    },
  ],
  dependents: [{ name: 'Sofía Torres', age: 8, relationship: 'Hija' }],
  legalProcesses: [
    {
      processType: 'Ejecutivo',
      plaintiff: 'Banco Prueba S.A.',
      court: 'Juzgado 5 Civil Municipal',
      fileNumber: '2025-00123',
      precautionaryMeasure: 'Embargo de salario',
    },
  ],
  apoderados: APODERADOS,
});

/** Envía el wizard: parse del schema (zodResolver) + handleSubmit + createCase. */
async function submitWizard(overrides: Record<string, unknown> = {}) {
  const parsed = createCaseFormSchema.parse({ ...wizardInput(), ...overrides });
  return createCase(wizardSubmit(parsed) as never);
}

beforeAll(async () => {
  // --- Tenant, rol con permisos, operador y deudor (todo real) -------------
  const tenant = await prisma.tenant.create({
    data: { name: `Smoke ${TAG}`, slug: TAG },
  });
  ctx.tenantId = tenant.id;

  // GC-A1: + el permiso de alcance. Sin uno, `updateCase` rechaza por
  // visibilidad por fila (ninguna fila es visible). Ver tenant.ts.
  const permissionNames = [
    P.CREAR_CASOS,
    P.VER_CASOS,
    P.EDITAR_CASOS,
    P.VER_TODOS_CASOS,
  ];
  const role = await prisma.role.create({
    data: { name: 'Administrador', description: 'smoke', tenantId: tenant.id },
  });
  for (const name of permissionNames) {
    const permission = await prisma.permission.create({
      data: { name, category: 'casos', tenantId: tenant.id },
    });
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        tenantId: tenant.id,
      },
    });
  }

  const user = await prisma.user.create({
    data: {
      name: 'Operador Smoke',
      email: `operador-${TAG}@example.test`,
      professionalCard: 'TP-000',
      phone: '3000000000',
      address: 'Calle Falsa 123',
      roleId: role.id,
      tenantId: tenant.id,
    },
  });
  ctx.userId = user.id;

  const debtorData = {
    name: 'Ana Torres',
    idType: 'CC',
    email: 'ana.torres@example.test',
    phone: '3001112222',
    address: 'Calle 8 # 3-20',
    city: 'Bogotá D.C.',
    department: 'Bogotá D.C.',
    occupation: 'Docente',
    monthlyIncome: 3000000,
    totalDebt: 0,
    activeCases: 0,
  };
  const debtor = await prisma.debtor.create({
    data: { ...debtorData, idNumber: '52111222', tenantId: tenant.id },
  });
  ctx.debtorId = debtor.id;

  // Un segundo tenant con su propio deudor: para comprobar el aislamiento.
  const other = await prisma.tenant.create({
    data: { name: `Smoke otro ${TAG}`, slug: `${TAG}-otro` },
  });
  ctx.otherTenantId = other.id;
  const otherDebtor = await prisma.debtor.create({
    data: { ...debtorData, idNumber: '99000111', tenantId: other.id },
  });
  ctx.otherDebtorId = otherDebtor.id;

  // --- Sesión: JWT firmado con el secreto de test, como la emite el login --
  const token = await createAccessToken({
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: role.id,
    roleName: role.name,
    permissions: permissionNames,
    tenantId: tenant.slug,
    tenantName: tenant.name,
    lastLogin: new Date(),
  });
  mockCookies.setToken('access-token', token);
});

afterAll(async () => {
  if (ctx.tenantId) {
    await waitForAuditRows(ctx.tenantId, expectedAuditRows);
    await purgeTenant(ctx.tenantId);
  }
  if (ctx.otherTenantId) await purgeTenant(ctx.otherTenantId);
  await prisma.$disconnect();
});

describe('wizard de creación de casos contra Postgres real', () => {
  let createdId = '';
  let createdVersion = 0;

  it('crea un caso completo: la action responde OK y no queda ningún error de Prisma', async () => {
    const result = await submitWizard();

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    createdId = result.data!.id;
    expectedAuditRows += 1;
  });

  it('el caso quedó persistido con sus columnas y tipos correctos', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: createdId },
    });

    expect(stored).toMatchObject({
      tenantId: ctx.tenantId,
      type: 'INSOLVENCY',
      // C-1: la fase inicial no es negociable desde el cliente.
      phase: 'Inicial',
      debtorId: ctx.debtorId,
      debtorName: 'Ana Torres',
      operatorId: ctx.userId,
      // Las columnas nuevas del PR #19 (las que rompieron la creación):
      notificationCity: 'Bogotá D.C.',
      otherCauseDetail: 'Cierre del negocio familiar',
      causes: ['Pérdida de empleo', 'Otros'],
      // `version` arranca en 0 (@default(0)) y sube con cada edición.
      version: 0,
    });
    // Número de caso autogenerado con el prefijo del servicio.
    expect(stored.caseNumber).toBe('INSOL-000001');
    // Decimal y fechas: la base los guardó con el tipo correcto.
    expect(stored.totalDebt.toString()).toBe('50000000');
    expect(stored.filingDate?.toISOString().slice(0, 10)).toBe('2026-03-10');
    createdVersion = stored.version;
  });

  it('las relaciones anidadas se crearon: deudas con acreedor, bienes, dependientes y procesos', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: createdId },
      include: {
        debts: { include: { creditor: true }, orderBy: { amount: 'desc' } },
        assets: { orderBy: { value: 'asc' } },
        dependents: true,
        legalProcesses: true,
      },
    });

    expect(stored.debts.map((d) => d.creditor.name)).toEqual([
      'Banco Prueba S.A.',
      'Cooperativa Prueba',
    ]);
    expect(stored.debts.map((d) => d.capitalAmount?.toString())).toEqual([
      '30000000',
      '20000000',
    ]);
    expect(stored.debts.every((d) => d.tenantId === ctx.tenantId)).toBe(true);

    expect(stored.assets.map((a) => [a.name, a.value.toString()])).toEqual([
      ['Vehículo', '25000000'],
      ['Apartamento', '180000000'],
    ]);
    expect(stored.dependents).toHaveLength(1);
    expect(stored.dependents[0]).toMatchObject({
      name: 'Sofía Torres',
      age: 8,
    });
    expect(stored.legalProcesses[0]).toMatchObject({
      processType: 'Ejecutivo',
      fileNumber: '2025-00123',
    });
  });

  it('apoderados: lista completa en la tabla nueva (con orden y tenant) y espejo del principal en Case', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: createdId },
      include: { apoderados: { orderBy: { orden: 'asc' } } },
    });

    expect(stored.apoderados.map((a) => [a.orden, a.nombreCompleto])).toEqual([
      [0, 'Ana Torres'],
      [1, 'Luis Rojas'],
      [2, 'María Gómez'],
    ]);
    expect(stored.apoderados.every((a) => a.tenantId === ctx.tenantId)).toBe(
      true,
    );
    // Espejo del PRIMERO en las columnas escalares (doble escritura).
    expect(stored).toMatchObject({
      apoderadoNombreCompleto: 'Ana Torres',
      apoderadoIdentificacion: '52111222',
      apoderadoCorreo: 'ana@abogados.co',
      existePoderOtorgado: true,
    });
  });

  it('efectos secundarios reales: deudor actualizado, notificación y generación agendada', async () => {
    const debtor = await prisma.debtor.findUniqueOrThrow({
      where: { id: ctx.debtorId },
    });
    expect(debtor.monthlyIncome.toString()).toBe('3000000');

    const notifications = await prisma.notification.findMany({
      where: { tenantId: ctx.tenantId },
    });
    expect(notifications.length).toBeGreaterThan(0);

    // El bloqueo de generación quedó reclamado (P3) y after() se agendó (P4);
    // el job en sí (Drive/Chromium) no se ejecuta en este test.
    const requests = await prisma.documentGenerationRequest.findMany({
      where: { caseId: createdId },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      kind: 'INITIAL',
      tenantId: ctx.tenantId,
    });
    expect(mockAfter).toHaveBeenCalledTimes(1);
  });

  it('el siguiente caso del mismo servicio toma el número consecutivo', async () => {
    const result = await submitWizard();

    expect(result.success).toBe(true);
    expectedAuditRows += 1;
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: result.data!.id },
    });
    expect(stored.caseNumber).toBe('INSOL-000002');
  });

  it('editar el caso persiste el cambio y sube la versión (bloqueo optimista)', async () => {
    const result = await updateCase({
      id: createdId,
      debtorId: ctx.debtorId,
      operatorId: ctx.userId,
      version: createdVersion,
      attorney: 'Dra. Prueba',
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expectedAuditRows += 1;

    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: createdId },
    });
    expect(stored.attorney).toBe('Dra. Prueba');
    expect(stored.version).toBe(createdVersion + 1);
  });

  it('aislamiento entre centros: un deudor de otro tenant se rechaza y no se crea nada', async () => {
    const before = await prisma.case.count();

    const result = await submitWizard({ debtorId: ctx.otherDebtorId });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Deudor no encontrado');
    expect(await prisma.case.count()).toBe(before);
    expect(
      await prisma.case.count({ where: { tenantId: ctx.otherTenantId } }),
    ).toBe(0);
  });
});

describe('separador de miles: el punto no trunca el monto en la base', () => {
  /**
   * EL BUG QUE ESTO FIJA, contra Postgres real.
   *
   * Los campos de dinero del formulario pasaron a `type="text"` para poder
   * mostrar `1.500.000` mientras se escribe. Ese texto es lo que viaja al
   * schema y a la server action, y hasta el 2026-10-11 las dos lo leían con
   *
   *     parseFloat(valor.replace(/[^0-9.-]/g, ''))
   *
   * que **conserva el punto**: `"30.000.000"` daba `30`. Treinta millones se
   * habrían guardado como treinta pesos en una columna `Decimal`, y de ahí
   * salen el Excel de ingresos y gastos y el cálculo de capacidad de pago.
   *
   * NO ALCANZA CON PROBAR `parsearMonto` EN AISLAMIENTO. El mismo parseo vivía
   * en TRES capas —`schemas.ts`, las server actions y el `amount` de la deuda—
   * y arreglar dos dejaba el bug vivo en la tercera. Este test fue el que
   * encontró la tercera: Prisma rechazó el create con "invalid digit found in
   * string", que ningún test de unidad podía ver porque ninguno llega a Prisma.
   *
   * Se eligen los campos que SÍ se escriben en el Case y sus relaciones por
   * este camino. `monthlyIncome` del Case no se asserta a propósito: en el
   * wizard el ingreso viaja por otros campos y acá termina en 0 con cualquier
   * entrada, así que afirmarlo no probaría nada.
   */
  let casoId = '';

  const CON_PUNTOS = {
    totalDebt: '31.500.000',
    debts: [
      {
        creditor: 'Banco Separador S.A.',
        type: 'TARJETA_CREDITO',
        interestRate: '2.1',
        capitalAmount: '30.000.000',
        interestAmount: '1.500.000',
        creditorCity: 'Bogotá D.C.',
      },
    ],
    assets: [{ name: 'Apartamento', type: 'INMUEBLE', value: '180.000.000' }],
  };

  it('crea el caso con los montos escritos con separador de miles', async () => {
    const result = await submitWizard(CON_PUNTOS);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    casoId = result.data!.id;
    expectedAuditRows += 1;
  });

  it('Postgres guardó el entero COMPLETO, no el truncado', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: casoId },
      include: { debts: true, assets: true },
    });

    // Si el bug volviera, estos serían 31.5, 30, 1.5 y 180.
    expect(Number(stored.totalDebt)).toBe(31_500_000);
    expect(stored.debts).toHaveLength(1);
    expect(Number(stored.debts[0].capitalAmount)).toBe(30_000_000);
    expect(Number(stored.debts[0].interestAmount)).toBe(1_500_000);
    // `Debt.amount` es la columna que hizo fallar el create: se escribía con
    // el string crudo del formulario, sin pasar por `parsearMonto`.
    expect(Number(stored.debts[0].amount)).toBe(30_000_000);
    expect(stored.assets).toHaveLength(1);
    expect(Number(stored.assets[0].value)).toBe(180_000_000);
  });
});

describe('coma decimal: el monto se guarda exacto, sin NaN', () => {
  /**
   * El gemelo del bloque de arriba para la OTRA mitad de la regla de
   * `parsearMonto`: con coma, la coma es el decimal y los puntos son miles
   * ("1.234.567,89" → 1234567.89). Esta rama pasa por las mismas tres capas
   * (schema, server action, `Debt.amount`), así que se verifica contra
   * Postgres igual que el caso de solo puntos — un bug en cualquiera de las
   * tres habría hecho fallar el `create` o guardado `NaN`/truncado.
   */
  let casoId = '';

  const CON_COMA = {
    totalDebt: '31.500.000,75',
    debts: [
      {
        creditor: 'Banco Coma S.A.',
        type: 'TARJETA_CREDITO',
        interestRate: '2.1',
        capitalAmount: '1.234,56',
        interestAmount: '1.500.000,25',
        creditorCity: 'Bogotá D.C.',
      },
    ],
    assets: [{ name: 'Lote', type: 'INMUEBLE', value: '180.000.000,50' }],
  };

  it('crea el caso con montos en coma decimal', async () => {
    const result = await submitWizard(CON_COMA);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    casoId = result.data!.id;
    expectedAuditRows += 1;
  });

  it('Postgres guardó el valor exacto, ni NaN ni truncado', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: casoId },
      include: { debts: true, assets: true },
    });

    // Si la coma rompiera el parseo, estos serían NaN (create habría
    // fallado) o el resultado del bug viejo: 1.23456, 1.5000025, etc.
    expect(Number(stored.totalDebt)).toBe(31_500_000.75);
    expect(stored.debts).toHaveLength(1);
    expect(Number(stored.debts[0].capitalAmount)).toBe(1_234.56);
    expect(Number(stored.debts[0].interestAmount)).toBe(1_500_000.25);
    expect(Number(stored.debts[0].amount)).toBe(1_234.56);
    expect(stored.assets).toHaveLength(1);
    expect(Number(stored.assets[0].value)).toBe(180_000_000.5);
  });
});
