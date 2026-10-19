/**
 * Bienes en dos niveles (Categoría → Tipo) — ciclo crear → editar → leer,
 * contra Postgres real. Inventario B (simplificado), aprobado.
 *
 * Un bien de cada tipo de Mueble (los 8 de MOVABLE_ASSET_TYPES) y uno de
 * Inmueble al crear el caso; al editar se agrega un segundo Inmueble y se
 * quita uno de los muebles — mismo patrón add/remove que
 * `addAssetToCase`/`removeAssetFromCase` ya tenían (sin editar en el
 * lugar). Se lee de vuelta con `prisma.case.findUniqueOrThrow` para
 * confirmar que `type`/`propertyType` persisten exactamente como se
 * mandaron — sin normalización en el servidor: eso es solo al CARGAR el
 * formulario de edición (TAREA 3), nunca al guardar.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import {
  createCase,
  addAssetToCase,
  removeAssetFromCase,
} from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { MOVABLE_ASSET_TYPES } from '@/features/case/asset-category-types';
import { mockCookies } from '../__mocks__/next-headers';
import { crearTenantDePrueba, purgeTenant, wizardSubmit } from './helpers/tenant';
import { FIXTURES } from './helpers/casos-sinteticos';

const TAG = `bienes-dos-niveles-${Date.now().toString(36)}`;
const FIXTURE = FIXTURES.find((f) => f.key === 'I2-insolvencia-minima')!;

const ctx = { tenantId: '', userId: '', caseId: '' };
let segundoInmuebleId = '';

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('bienes en dos niveles — crear → editar → leer (Postgres real)', () => {
  beforeAll(async () => {
    const tenant = await crearTenantDePrueba(TAG);
    ctx.tenantId = tenant.tenantId;
    ctx.userId = tenant.userId;
    mockCookies.setToken('access-token', tenant.token);

    const debtor = await prisma.debtor.create({
      data: { ...FIXTURE.debtor, tenantId: ctx.tenantId },
    });

    // Un bien de inmueble + los 8 tipos de mueble, en una sola creación.
    const assets = [
      {
        name: 'Apartamento La Floresta',
        type: 'INMUEBLE',
        value: '250000000',
        propertyType: 'APARTAMENTO',
        address: 'Calle 10 # 5-20',
      },
      ...MOVABLE_ASSET_TYPES.map((t, i) => ({
        name: `Bien ${t.value}`,
        type: t.value,
        value: String(1_000_000 * (i + 1)),
      })),
    ];

    const parsed = createCaseFormSchema.parse({
      ...FIXTURE.form,
      debtorId: debtor.id,
      operatorId: ctx.userId,
      assets,
    }) as Record<string, unknown>;

    const result = await createCase(wizardSubmit(parsed) as never);
    if (!result.success || !result.data) {
      throw new Error(`No se pudo crear el caso de prueba: ${result.error}`);
    }
    ctx.caseId = result.data.id;
  }, 60_000);

  it('CREAR: el inmueble y los 8 tipos de mueble quedan guardados con su type/propertyType exactos', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { assets: { orderBy: { name: 'asc' } } },
    });

    expect(stored.assets).toHaveLength(9);

    const inmueble = stored.assets.find((a) => a.type === 'INMUEBLE');
    expect(inmueble).toMatchObject({
      type: 'INMUEBLE',
      propertyType: 'APARTAMENTO',
      address: 'Calle 10 # 5-20',
    });

    for (const t of MOVABLE_ASSET_TYPES) {
      const bien = stored.assets.find((a) => a.name === `Bien ${t.value}`);
      expect(bien).toBeDefined();
      expect(bien!.type).toBe(t.value);
      // Un mueble no tiene propertyType — eso es exclusivo de Inmueble.
      expect(bien!.propertyType).toBeNull();
    }
  });

  it('EDITAR (agregar): un segundo inmueble, tipo CASA, se guarda sin pisar al primero', async () => {
    const added = await addAssetToCase({
      caseId: ctx.caseId,
      name: 'Casa de descanso',
      type: 'INMUEBLE',
      propertyType: 'CASA',
      value: '120000000',
    });
    expect(added.success).toBe(true);
    segundoInmuebleId = added.data!.id;

    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { assets: { orderBy: { name: 'asc' } } },
    });

    expect(stored.assets).toHaveLength(10);
    const inmuebles = stored.assets.filter((a) => a.type === 'INMUEBLE');
    expect(inmuebles.map((a) => a.propertyType).sort()).toEqual([
      'APARTAMENTO',
      'CASA',
    ]);
  });

  it('EDITAR (quitar): borrar un mueble (OTRO) no afecta a los demás tipos ni a los inmuebles', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { assets: true },
    });
    const otro = stored.assets.find((a) => a.name === 'Bien OTRO');
    expect(otro).toBeDefined();

    const removed = await removeAssetFromCase({ assetId: otro!.id });
    expect(removed.success).toBe(true);

    const after = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { assets: { orderBy: { name: 'asc' } } },
    });

    expect(after.assets).toHaveLength(9);
    expect(after.assets.some((a) => a.name === 'Bien OTRO')).toBe(false);
    // Los 7 muebles restantes y los 2 inmuebles siguen ahí, intactos.
    const tiposRestantes = MOVABLE_ASSET_TYPES.filter(
      (t) => t.value !== 'OTRO',
    );
    for (const t of tiposRestantes) {
      expect(after.assets.some((a) => a.name === `Bien ${t.value}`)).toBe(
        true,
      );
    }
    expect(
      after.assets.filter((a) => a.type === 'INMUEBLE'),
    ).toHaveLength(2);
    expect(after.assets.some((a) => a.id === segundoInmuebleId)).toBe(true);
  });

  it('LEER: tipos y categorías finales, uno por uno', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { assets: { orderBy: { name: 'asc' } } },
    });

    const resumen = stored.assets
      .map((a) => `${a.name}: type=${a.type}${a.propertyType ? ` propertyType=${a.propertyType}` : ''}`)
      .sort();

    expect(resumen).toEqual(
      [
        'Apartamento La Floresta: type=INMUEBLE propertyType=APARTAMENTO',
        'Casa de descanso: type=INMUEBLE propertyType=CASA',
        'Bien ELECTRONICO: type=ELECTRONICO',
        'Bien ENSERES: type=ENSERES',
        'Bien VEHICULO: type=VEHICULO',
        'Bien JOYAS: type=JOYAS',
        'Bien EFECTIVO: type=EFECTIVO',
        'Bien ACCIONES: type=ACCIONES',
        'Bien CUENTAS: type=CUENTAS',
      ].sort(),
    );
  });
});
