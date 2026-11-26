/**
 * Aceptación de términos (N-G-07) contra Postgres real, con las actions reales
 * y la sesión de la cookie como en producción.
 *
 * Lo que el mock de Prisma no puede probar:
 *  - que la fila llega a la base con la versión, el hash, el usuario y el
 *    centro, y se lee de vuelta;
 *  - que aceptar dos veces la misma versión no duplica la fila (índice único +
 *    `skipDuplicates`);
 *  - que la constancia sobrevive al borrado del usuario (no hay FK);
 *  - que la vista del centro no ve las filas de otro centro.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import {
  aceptarDocumentosLegales,
  getAceptacionesPendientes,
  getEstadoAceptacionesDelCentro,
  getMisAceptaciones,
} from '@/features/legal/actions';
import { PRIVACIDAD, TERMINOS } from '@/features/legal/documentos';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `terminos-${Date.now().toString(36)}`;

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;

function entrarComo(centro: TenantDePrueba) {
  mockCookies.clear();
  mockCookies.setToken('access-token', centro.token);
}

const aceptarAmbos = () =>
  aceptarDocumentosLegales({
    aceptados: [
      { documento: 'terminos', version: TERMINOS.version },
      { documento: 'privacidad', version: PRIVACIDAD.version },
    ],
  });

beforeAll(async () => {
  centroA = await crearTenantDePrueba(`${TAG}-a`, [P.VER_USUARIOS]);
  centroB = await crearTenantDePrueba(`${TAG}-b`, [P.VER_USUARIOS]);
});

afterAll(async () => {
  // purgeTenant borra por `tenantId` toda tabla que lo tenga, esta incluida.
  for (const c of [centroA, centroB]) {
    if (c && (await prisma.tenant.findUnique({ where: { id: c.tenantId } })))
      await purgeTenant(c.tenantId);
  }
  await prisma.$disconnect();
});

describe('aceptaciones_documentos_legales en Postgres', () => {
  it('sin aceptación previa, los dos documentos están pendientes', async () => {
    entrarComo(centroA);

    const r = await getAceptacionesPendientes();

    expect(r).toEqual({ success: true, data: [TERMINOS, PRIVACIDAD] });
  });

  it('aceptar crea las filas con versión, hash, usuario y centro', async () => {
    entrarComo(centroA);

    expect(await aceptarAmbos()).toEqual({ success: true, data: [] });

    const filas = await prisma.aceptacionDocumentoLegal.findMany({
      where: { userId: centroA.userId },
      orderBy: { documento: 'asc' },
    });
    expect(filas).toEqual([
      expect.objectContaining({
        tenantId: centroA.tenantId,
        userId: centroA.userId,
        userName: 'Liliana Patricia Arango Mejía',
        userEmail: `conciliadora-${TAG}-a@centroejemplo.test`,
        documento: 'privacidad',
        version: PRIVACIDAD.version,
        sha256: PRIVACIDAD.sha256,
      }),
      expect.objectContaining({
        documento: 'terminos',
        version: TERMINOS.version,
        sha256: TERMINOS.sha256,
      }),
    ]);
    expect(filas[0].aceptadoEn).toBeInstanceOf(Date);
  });

  it('con la versión vigente aceptada ya no queda nada pendiente', async () => {
    entrarComo(centroA);

    expect(await getAceptacionesPendientes()).toEqual({
      success: true,
      data: [],
    });
  });

  it('aceptar otra vez la misma versión no duplica la fila', async () => {
    entrarComo(centroA);

    await aceptarAmbos();

    expect(
      await prisma.aceptacionDocumentoLegal.count({
        where: { userId: centroA.userId },
      }),
    ).toBe(2);
  });

  it('la base rechaza una segunda fila idéntica', async () => {
    const fila = await prisma.aceptacionDocumentoLegal.findFirstOrThrow({
      where: { userId: centroA.userId, documento: 'terminos' },
      select: {
        tenantId: true,
        userId: true,
        userName: true,
        userEmail: true,
        documento: true,
        version: true,
        sha256: true,
      },
    });

    await expect(
      prisma.aceptacionDocumentoLegal.create({ data: fila }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('con una versión vieja registrada, el documento vuelve a quedar pendiente', async () => {
    entrarComo(centroB);
    await prisma.aceptacionDocumentoLegal.createMany({
      data: [
        {
          tenantId: centroB.tenantId,
          userId: centroB.userId,
          userName: 'Liliana Patricia Arango Mejía',
          userEmail: `conciliadora-${TAG}-b@centroejemplo.test`,
          documento: 'terminos',
          version: '2026-01-01',
          sha256: 'hash-de-la-version-anterior',
        },
      ],
    });

    const r = await getAceptacionesPendientes();

    expect(r).toEqual({ success: true, data: [TERMINOS, PRIVACIDAD] });
  });

  it('el historial propio trae la vieja y la nueva, y marca la vigente', async () => {
    entrarComo(centroB);
    await aceptarAmbos();

    const r = await getMisAceptaciones();

    if (!r.success) throw new Error(r.error);
    const terminos = r.data.filter((a) => a.documento === 'terminos');
    expect(terminos.map((a) => [a.version, a.vigente])).toEqual([
      [TERMINOS.version, true],
      ['2026-01-01', false],
    ]);
  });

  it('la vista del centro solo ve a los usuarios de su centro', async () => {
    entrarComo(centroA);

    const r = await getEstadoAceptacionesDelCentro();

    if (!r.success) throw new Error(r.error);
    expect(Object.keys(r.data)).toEqual([centroA.userId]);
    expect(r.data[centroA.userId].alDia).toBe(true);
  });

  it('la constancia sobrevive al borrado del usuario', async () => {
    await prisma.user.delete({ where: { id: centroB.userId } });

    expect(
      await prisma.aceptacionDocumentoLegal.count({
        where: { userId: centroB.userId },
      }),
    ).toBe(3);
  });
});
