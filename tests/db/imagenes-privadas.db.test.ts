/**
 * Firmas por centro contra Postgres real: la restricción única, el borrado en
 * cascada y el aislamiento entre centros con la consulta que usa producción.
 * El mock de Prisma no puede probar ninguna de las tres.
 */

import prisma from '@/lib/prisma';
import {
  ImagenPrivadaFaltanteError,
  resolverImagenesPrivadas,
} from '@/lib/imagenes-privadas';
import { dataUriDePrueba, firmasDelCentro } from '../helpers/imagenes-privadas';

import { purgeTenant } from './helpers/tenant';

const TAG = `firmas-${Date.now().toString(36)}`;

let centroA: string;
let centroB: string;

beforeAll(async () => {
  centroA = (
    await prisma.tenant.create({
      data: { name: `Centro A ${TAG}`, slug: `${TAG}-a` },
    })
  ).id;
  centroB = (
    await prisma.tenant.create({
      data: { name: `Centro B ${TAG}`, slug: `${TAG}-b` },
    })
  ).id;
  await prisma.imagenPrivada.createMany({
    data: [...firmasDelCentro(centroA), ...firmasDelCentro(centroB)],
  });
});

afterAll(async () => {
  for (const id of [centroA, centroB]) {
    if (await prisma.tenant.findUnique({ where: { id } }))
      await purgeTenant(id);
  }
  await prisma.$disconnect();
});

describe('imagenes_privadas en Postgres', () => {
  it('cada centro obtiene solo sus firmas', async () => {
    const a = await resolverImagenesPrivadas(centroA);
    const b = await resolverImagenesPrivadas(centroB);

    expect(a.get('firma-operador')).toBe(
      dataUriDePrueba(`${centroA}/firma-operador`),
    );
    expect(b.get('firma-operador')).toBe(
      dataUriDePrueba(`${centroB}/firma-operador`),
    );
    expect(a.get('firma-director')).not.toBe(b.get('firma-director'));
  });

  it('una segunda fila del mismo centro y tipo la rechaza la base', async () => {
    await expect(
      prisma.imagenPrivada.create({ data: firmasDelCentro(centroA)[0] }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('borrar una firma de un centro no lo deja usar la del otro', async () => {
    await prisma.imagenPrivada.delete({
      where: { tenantId_tipo: { tenantId: centroA, tipo: 'firma-director' } },
    });

    const error = await resolverImagenesPrivadas(centroA).catch((e) => e);
    expect(error).toBeInstanceOf(ImagenPrivadaFaltanteError);
    expect(error.message).toBe(
      `Falta la firma del director para Centro A ${TAG}. Contacta al administrador.`,
    );
    await expect(resolverImagenesPrivadas(centroB)).resolves.toBeDefined();
  });

  it('borrar el centro borra sus firmas', async () => {
    await purgeTenant(centroB);
    expect(
      await prisma.imagenPrivada.count({ where: { tenantId: centroB } }),
    ).toBe(0);
  });
});
