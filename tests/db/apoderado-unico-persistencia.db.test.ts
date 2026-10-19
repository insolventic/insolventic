/**
 * Apoderado único (Sección XI) — persistencia crear → editar → leer, contra
 * Postgres real.
 *
 * La persistencia en sí no es nueva (buildApoderadosCreate/
 * mirrorPrincipalApoderado para crear, addApoderadoToCase/
 * removeApoderadoFromCase para editar, del PR #102/#103) — lo que este test
 * fija es el ciclo completo que el inventario A deja como único camino: un
 * caso creado con un apoderado en la Sección XI, editado agregando y
 * quitando apoderados después de creado, y releído con el mismo mapper que
 * usa la vista de detalle y los documentos.
 *
 * Puntos concretos que se verifican contra la base real:
 *  - `orden` se preserva (0, 1, …) y el hueco que deja un `remove` de en
 *    medio no se renumera.
 *  - El espejo legado (las 8 columnas `apoderado_*` de `Case`) se escribe
 *    SOLO al crear, con el primero — y queda congelado: editar después no lo
 *    toca, documentado en `addApoderadoToCase`. Importa porque
 *    `legal-process-section.tsx` ya no lee el espejo si hay `apoderados[]`:
 *    lee el PRIMERO de la lista viva, que si el original se borra deja de
 *    coincidir con el espejo — ese es el comportamiento esperado, no un bug.
 *  - `existePoderOtorgado` viaja por apoderado, no por caso: dos apoderados
 *    pueden tener valores distintos a la vez.
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
import { createCase, addApoderadoToCase, removeApoderadoFromCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { mockCookies } from '../__mocks__/next-headers';
import { crearTenantDePrueba, purgeTenant, wizardSubmit } from './helpers/tenant';
import { FIXTURES } from './helpers/casos-sinteticos';

const TAG = `apoderado-unico-${Date.now().toString(36)}`;
const FIXTURE = FIXTURES.find((f) => f.key === 'I2-insolvencia-minima')!;

const ctx = { tenantId: '', userId: '', caseId: '', primeroId: '' };

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('apoderado único — crear → editar → leer (Postgres real)', () => {
  beforeAll(async () => {
    const tenant = await crearTenantDePrueba(TAG);
    ctx.tenantId = tenant.tenantId;
    ctx.userId = tenant.userId;
    mockCookies.setToken('access-token', tenant.token);

    const debtor = await prisma.debtor.create({
      data: { ...FIXTURE.debtor, tenantId: ctx.tenantId },
    });

    const parsed = createCaseFormSchema.parse({
      ...FIXTURE.form,
      debtorId: debtor.id,
      operatorId: ctx.userId,
      // Apoderado SOLO en la Sección XI — nunca en el texto libre de la
      // Página 1 (que ya no tiene input, pero el campo attorney del schema
      // sigue existiendo).
      apoderados: [
        {
          nombreCompleto: 'Dra. Inicial Pérez',
          tipoIdentificacion: 'CC',
          identificacion: '11111111',
          tarjetaProfesional: 'TP-001',
          direccion: 'Calle 1 # 2-3',
          telefono: '3001112222',
          correo: 'inicial@abogados.co',
          existePoderOtorgado: false,
        },
      ],
    }) as Record<string, unknown>;

    const result = await createCase(wizardSubmit(parsed) as never);
    if (!result.success || !result.data) {
      throw new Error(`No se pudo crear el caso de prueba: ${result.error}`);
    }
    ctx.caseId = result.data.id;
  }, 60_000);

  it('CREAR: el apoderado de la Sección XI queda en la tabla nueva Y espejado en Case', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { apoderados: { orderBy: { orden: 'asc' } } },
    });

    expect(stored.apoderados).toHaveLength(1);
    expect(stored.apoderados[0]).toMatchObject({
      orden: 0,
      nombreCompleto: 'Dra. Inicial Pérez',
      identificacion: '11111111',
      existePoderOtorgado: false,
    });
    ctx.primeroId = stored.apoderados[0].id;

    // Espejo legado — solo el PRIMERO, en las 8 columnas de Case.
    expect(stored.apoderadoNombreCompleto).toBe('Dra. Inicial Pérez');
    expect(stored.apoderadoIdentificacion).toBe('11111111');
    expect(stored.existePoderOtorgado).toBe(false);
  });

  it('EDITAR (agregar): un segundo apoderado CON poder otorgado no pisa al primero', async () => {
    const added = await addApoderadoToCase({
      caseId: ctx.caseId,
      nombreCompleto: 'Dr. Segundo Gómez',
      identificacion: '22222222',
      tarjetaProfesional: 'TP-002',
      existePoderOtorgado: true,
    });
    expect(added.success).toBe(true);

    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { apoderados: { orderBy: { orden: 'asc' } } },
    });

    expect(stored.apoderados).toHaveLength(2);
    expect(stored.apoderados.map((a) => [a.orden, a.nombreCompleto, a.existePoderOtorgado])).toEqual([
      [0, 'Dra. Inicial Pérez', false],
      [1, 'Dr. Segundo Gómez', true],
    ]);

    // El espejo legado NO se toca al editar — sigue siendo el primero
    // original, aunque ahora haya un segundo apoderado con poder otorgado.
    expect(stored.apoderadoNombreCompleto).toBe('Dra. Inicial Pérez');
    expect(stored.existePoderOtorgado).toBe(false);
  });

  it('EDITAR (quitar): borrar el primero deja al segundo con SU orden intacto (sin renumerar)', async () => {
    const removed = await removeApoderadoFromCase({
      apoderadoId: ctx.primeroId,
    });
    expect(removed.success).toBe(true);

    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { apoderados: { orderBy: { orden: 'asc' } } },
    });

    expect(stored.apoderados).toHaveLength(1);
    expect(stored.apoderados[0]).toMatchObject({
      orden: 1, // el hueco que dejó el orden 0 no se renumera
      nombreCompleto: 'Dr. Segundo Gómez',
      existePoderOtorgado: true,
    });

    // El espejo legado queda tal como lo dejó la creación: apunta a un
    // apoderado que ya no existe en la lista viva. Es la contracara
    // documentada de que editar no lo toca — y es justo por lo que
    // legal-process-section.tsx lee apoderados[0] (la lista viva), no el
    // espejo, para no mostrar un nombre borrado.
    expect(stored.apoderadoNombreCompleto).toBe('Dra. Inicial Pérez');
  });

  it('LEER: lo que vería la vista de detalle (apoderados[0] de la lista viva) es el apoderado que SÍ sigue en el caso', async () => {
    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { apoderados: { orderBy: { orden: 'asc' } } },
    });

    // Mismo criterio que legal-process-section.tsx:
    // caseData.apoderados?.[0]?.nombreCompleto || caseData.attorney
    const nombreQueVeríaLaVista =
      stored.apoderados[0]?.nombreCompleto || stored.attorney || 'N/A';

    expect(nombreQueVeríaLaVista).toBe('Dr. Segundo Gómez');
  });
});
