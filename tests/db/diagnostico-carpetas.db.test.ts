/**
 * Los dos scripts de diagnóstico de carpetas de Drive, contra Postgres real:
 *  - `scripts/diagnostico/carpetas-compartidas-entre-casos.sql`
 *  - `scripts/diagnostico/casos-v1-con-layout-0.sql`
 *
 * Se corren contra producción a mano. Este test fija que encuentran lo que
 * dicen, que no escriben (cada consulta corre en una transacción de solo
 * lectura, como en el script) y que no muestran ids de carpeta ni números de
 * caso.
 *
 * La base puede tener otros centros (el seed): las aserciones miran solo los
 * dos centros de prueba de esta suite, que se crean y se purgan aquí.
 */
import fs from 'node:fs';
import path from 'node:path';

import prisma from '@/lib/prisma';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = Date.now().toString(36);
const CARPETA = (n: string) => `diag-carpeta-${n}-${TAG}`;

type Fila = Record<string, unknown>;

/** Las consultas del script, sin comentarios ni el envoltorio de transacción. */
function consultasDe(archivo: string): string[] {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'scripts/diagnostico', archivo),
    'utf8',
  );
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '' && !/^(BEGIN|ROLLBACK|SET LOCAL)\b/i.test(s));
}

/** Corre cada consulta en una transacción de solo lectura; una escritura fallaría. */
async function correr(archivo: string): Promise<Fila[][]> {
  const consultas = consultasDe(archivo);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const resultados: Fila[][] = [];
    for (const q of consultas) {
      resultados.push(await tx.$queryRawUnsafe<Fila[]>(q));
    }
    return resultados;
  });
}

let a: TenantDePrueba;
let b: TenantDePrueba;
const casos: Record<string, { id: string; caseNumber: string }> = {};

async function crearCaso(
  centro: TenantDePrueba,
  nombre: string,
  driveFolderId: string | null,
  layoutVersion: number,
) {
  const deudor = await prisma.debtor.create({
    data: {
      name: 'Rubén Darío Castaño Pérez',
      idNumber: `${nombre}-${TAG}`,
      idType: 'CC',
      email: `ruben-${nombre}-${TAG}@correoejemplo.test`,
      phone: '3209981177',
      address: 'Carrera 48 # 22-14',
      city: 'Medellín',
      department: 'Antioquia',
      occupation: 'Mensajero motorizado',
      monthlyIncome: 1800000,
      totalDebt: 0,
      activeCases: 0,
      tenantId: centro.tenantId,
    },
  });
  const caso = await prisma.case.create({
    data: {
      // El mismo número en los dos centros, como en producción.
      caseNumber: `INSOL-${nombre.replace(/^[ab]/, '')}-${TAG}`,
      centroConciliacionNombre: 'Centro de prueba',
      debtorName: deudor.name,
      type: 'INSOLVENCY',
      totalDebt: 12000000,
      creditors: 1,
      debtorId: deudor.id,
      operatorId: centro.userId,
      tenantId: centro.tenantId,
      driveFolderId,
      layoutVersion,
    },
  });
  casos[nombre] = { id: caso.id, caseNumber: caso.caseNumber };
  return caso;
}

beforeAll(async () => {
  a = await crearTenantDePrueba(`diag-a-${TAG}`);
  b = await crearTenantDePrueba(`diag-b-${TAG}`);

  // Misma carpeta entre centros distintos: lo que se busca.
  await crearCaso(a, 'a1', CARPETA('compartida'), 0);
  await crearCaso(b, 'b1', CARPETA('compartida'), 0);
  // Misma carpeta dentro de un centro.
  await crearCaso(a, 'a2', CARPETA('mismo-centro'), 0);
  await crearCaso(a, 'a3', CARPETA('mismo-centro'), 0);
  // Sola, fuera del índice v0 y con un comprobante: candidata por la raíz.
  const a4 = await crearCaso(a, 'a4', CARPETA('sola'), 0);
  await prisma.payment.create({
    data: {
      caseId: a4.id,
      debtorId: a4.debtorId!,
      tenantId: a.tenantId,
      amount: 1000000,
      status: 'pagado',
      receiptFileId: `diag-comprobante-${TAG}`,
    },
  });
  // v0 de verdad: registrada en el índice de la pestaña Drive.
  await crearCaso(a, 'a5', CARPETA('v0'), 0);
  await prisma.documentFromDrive.create({
    data: {
      googleDriveId: CARPETA('v0'),
      fileName: 'INSOL-5',
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
      folderPath: ['Centro de prueba'],
      tenantId: a.tenantId,
    },
  });
  // v1 guardada como v1: ningún script la reporta.
  await crearCaso(b, 'b2', CARPETA('v1'), 1);
});

afterAll(async () => {
  await purgeTenant(a.tenantId);
  await purgeTenant(b.tenantId);
  await prisma.$disconnect();
});

const deEstaSuite = (texto: unknown) =>
  typeof texto === 'string' &&
  Object.values(casos).some((c) => texto.includes(c.id));

describe('carpetas-compartidas-entre-casos.sql', () => {
  it('agrupa la carpeta compartida entre centros y la de un mismo centro, y no la que es de un solo caso', async () => {
    const [resumen, detalle] = await correr(
      'carpetas-compartidas-entre-casos.sql',
    );

    expect(resumen).toHaveLength(1);
    expect(Number(resumen[0].entre_centros_distintos)).toBeGreaterThanOrEqual(
      1,
    );
    expect(Number(resumen[0].dentro_de_un_mismo_centro)).toBeGreaterThanOrEqual(
      1,
    );

    const grupos = detalle.filter((g) => deEstaSuite(g.casos_y_centro));
    expect(grupos).toHaveLength(2);

    const entreCentros = grupos.find((g) => Number(g.centros) === 2)!;
    expect(Number(entreCentros.casos)).toBe(2);
    expect(entreCentros.slugs_de_centro).toBe(
      [a.tenantSlug, b.tenantSlug].sort().join(', '),
    );
    expect(entreCentros.casos_y_centro).toContain(
      `${casos.a1.id} (${a.tenantSlug})`,
    );
    expect(entreCentros.casos_y_centro).toContain(
      `${casos.b1.id} (${b.tenantSlug})`,
    );

    const mismoCentro = grupos.find((g) => Number(g.centros) === 1)!;
    expect(mismoCentro.casos_y_centro).toContain(casos.a2.id);
    expect(mismoCentro.casos_y_centro).toContain(casos.a3.id);

    // Una carpeta de un solo caso no es un grupo.
    for (const nombre of ['a4', 'a5', 'b2']) {
      const id = casos[nombre].id;
      expect(detalle.some((g) => String(g.casos_y_centro).includes(id))).toBe(
        false,
      );
    }
  });
});

describe('casos-v1-con-layout-0.sql', () => {
  it('cuenta por centro y lista como candidatos solo los casos con layout 0 fuera del índice v0', async () => {
    const [resumen, candidatos] = await correr('casos-v1-con-layout-0.sql');

    const deA = resumen.find((r) => r.centro === a.tenantSlug)!;
    // a1..a5 tienen layout 0 y carpeta; a5 está en el índice v0.
    expect(Number(deA.casos_con_layout_0)).toBe(5);
    expect(Number(deA.en_indice_v0)).toBe(1);
    expect(Number(deA.a_revisar_en_drive)).toBe(4);
    const deB = resumen.find((r) => r.centro === b.tenantSlug)!;
    // b1 tiene layout 0; b2 es v1 y no cuenta.
    expect(Number(deB.casos_con_layout_0)).toBe(1);

    const propios = candidatos.filter((c) => deEstaSuite(c.caso));
    expect(propios.map((c) => c.caso).sort()).toEqual(
      ['a1', 'a2', 'a3', 'a4', 'b1'].map((n) => casos[n].id).sort(),
    );

    const a4 = propios.find((c) => c.caso === casos.a4.id)!;
    expect(a4.con_comprobantes).toBe(true);
    expect(Number(a4.con_generados)).toBe(0);
    expect(Number(a4.otros_casos_con_la_misma_carpeta)).toBe(0);
    const a1 = propios.find((c) => c.caso === casos.a1.id)!;
    expect(a1.con_comprobantes).toBe(false);
    expect(Number(a1.otros_casos_con_la_misma_carpeta)).toBe(1);
  });
});

describe('lo que los dos scripts muestran', () => {
  it('no incluye ids de carpeta ni números de caso, y los dos corren en solo lectura y terminan en ROLLBACK', async () => {
    const salida = JSON.stringify(
      [
        ...(await correr('carpetas-compartidas-entre-casos.sql')),
        ...(await correr('casos-v1-con-layout-0.sql')),
      ],
      (_k, v) => (typeof v === 'bigint' ? Number(v) : v),
    );
    expect(salida).not.toContain('diag-carpeta-');
    for (const c of Object.values(casos)) {
      expect(salida).not.toContain(c.caseNumber);
    }

    for (const archivo of [
      'carpetas-compartidas-entre-casos.sql',
      'casos-v1-con-layout-0.sql',
    ]) {
      const sql = fs.readFileSync(
        path.join(process.cwd(), 'scripts/diagnostico', archivo),
        'utf8',
      );
      const sentencias = sql
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '' && !l.trim().startsWith('--'));
      expect(sentencias[0]).toBe('BEGIN TRANSACTION READ ONLY;');
      expect(sentencias.at(-1)).toBe('ROLLBACK;');
      expect(sql).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i,
      );
    }
  });
});
