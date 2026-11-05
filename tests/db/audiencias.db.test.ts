/**
 * El flujo de audiencias contra Postgres real: programar, reprogramar y cancelar,
 * y que todas las lecturas (calendario, alertas, documentos) digan lo mismo.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/server', () => ({
  after: jest.fn(),
  NextResponse: { json: jest.fn() },
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import {
  cancelarAudiencia,
  getHearings,
  programarAudiencia,
} from '@/features/calendar/actions';
import {
  getDashboardStats,
  updateCase,
  updateCasePhase,
} from '@/features/case/actions';
import { scanUpcomingHearings } from '@/features/notification/alerts';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { CASE_GENERATION_INCLUDE } from '@/features/document/persistence';
import { mockCookies } from '../__mocks__/next-headers';
import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `e2eaud-${Date.now().toString(36)}`;
const CRUD = [P.VER_CASOS, P.EDITAR_CASOS, P.VER_CALENDARIO];

let centro: TenantDePrueba;
let otroCentro: TenantDePrueba;
let soloLectura: TenantDePrueba;
let alcancePropio: TenantDePrueba;
const deudores = new Map<string, string>();
let n = 0;

const como = (t: TenantDePrueba) =>
  mockCookies.setToken('access-token', t.token);

const dias = (cuantos: number) => {
  const d = new Date(Date.now() + cuantos * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};
const mediodia = (dia: string) => new Date(`${dia}T12:00:00.000Z`);

async function deudorDe(t: TenantDePrueba) {
  const existente = deudores.get(t.tenantId);
  if (existente) return existente;
  const { id } = await prisma.debtor.create({
    data: {
      name: 'Deudor de prueba',
      idNumber: '123',
      idType: 'CC',
      email: `${t.tenantSlug}@deudor.test`,
      phone: '3000000000',
      address: 'Calle 1',
      city: 'Bogotá',
      department: 'Cundinamarca',
      occupation: 'Empleado',
      monthlyIncome: 1,
      totalDebt: 1,
      activeCases: 1,
      lastUpdate: new Date(),
      tenantId: t.tenantId,
    },
  });
  deudores.set(t.tenantId, id);
  return id;
}

async function crearCaso(
  t: TenantDePrueba,
  extra: Record<string, unknown> = {},
) {
  n += 1;
  return prisma.case.create({
    data: {
      caseNumber: `${TAG}-${n}`,
      debtorName: `Deudor ${n}`,
      type: 'INSOLVENCY',
      totalDebt: 1000,
      creditors: 1,
      phase: 'En negociación',
      debtorId: await deudorDe(t),
      operatorId: t.userId,
      tenantId: t.tenantId,
      ...extra,
    },
  });
}

const leer = (id: string) => prisma.case.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [...CRUD, P.VER_TODOS_CASOS]);
  otroCentro = await crearTenantDePrueba(`${TAG}-b`, [
    ...CRUD,
    P.VER_TODOS_CASOS,
  ]);
  soloLectura = await crearTenantDePrueba(`${TAG}-sl`, [
    P.VER_CASOS,
    P.VER_TODOS_CASOS,
  ]);
  alcancePropio = await crearTenantDePrueba(`${TAG}-pr`, [
    ...CRUD,
    P.VER_CASOS_PROPIOS,
  ]);
});

afterAll(async () => {
  // La auditoría y las notificaciones pueden seguir escribiéndose un instante.
  await new Promise((r) => setTimeout(r, 500));
  for (const t of [centro, otroCentro, soloLectura, alcancePropio]) {
    if (t) await purgeTenant(t.tenantId);
  }
  await prisma.$disconnect();
});

describe('programarAudiencia', () => {
  it('la primera vez fija la primera audiencia y la vigente', async () => {
    como(centro);
    const caso = await crearCaso(centro);

    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
      version: caso.version,
    });

    expect(r).toEqual({ success: true });
    const fila = await leer(caso.id);
    expect(fila.hearingDate).toEqual(mediodia('2026-11-20'));
    expect(fila.hearingTime).toBe('10:00');
    expect(fila.firstHearingDate).toEqual(mediodia('2026-11-20'));
    expect(fila.firstHearingTime).toBe('10:00');
    expect(fila.version).toBe(caso.version + 1);
  });

  it('reprogramar cambia la vigente y conserva la primera', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });

    await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-12-04',
      hora: '15:30',
    });

    const fila = await leer(caso.id);
    expect(fila.hearingDate).toEqual(mediodia('2026-12-04'));
    expect(fila.hearingTime).toBe('15:30');
    expect(fila.firstHearingDate).toEqual(mediodia('2026-11-20'));
    expect(fila.firstHearingTime).toBe('10:00');
  });

  it('deja constancia con el antes y el después', async () => {
    como(centro);
    const caso = await crearCaso(centro, {
      hearingDate: mediodia('2026-11-20'),
      hearingTime: '10:00',
      firstHearingDate: mediodia('2026-11-20'),
    });

    await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-12-04',
      hora: '15:30',
    });

    const registro = await prisma.auditLog.findFirst({
      where: { tenantId: centro.tenantId, entityId: caso.id },
      orderBy: { createdAt: 'desc' },
    });
    const texto = JSON.stringify(registro);
    expect(texto).toContain('hearingDate');
    expect(texto).toContain('15:30');
  });

  it('una fecha pasada se acepta como registro', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-01-15',
      hora: '09:00',
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ['fecha imposible', '2026-02-31', '10:00'],
    ['fecha basura', 'no-es-fecha', '10:00'],
    ['hora basura', '2026-11-20', 'hola'],
  ])('rechaza %s sin escribir', async (_nombre, fecha, hora) => {
    como(centro);
    const caso = await crearCaso(centro);
    const r = await programarAudiencia({ caseId: caso.id, fecha, hora });
    expect(r.success).toBe(false);
    expect((await leer(caso.id)).hearingDate).toBeNull();
  });

  it('no programa en un caso cerrado', async () => {
    como(centro);
    const caso = await crearCaso(centro, { phase: 'Terminado' });
    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Terminado');
  });

  it('una versión vieja no pisa a otro operador', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });

    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-12-04',
      hora: '15:30',
      version: caso.version,
    });

    expect(r.success).toBe(false);
    expect((await leer(caso.id)).hearingDate).toEqual(mediodia('2026-11-20'));
  });

  it('avisa al operador del caso cuando lo cambia otra persona', async () => {
    const colega = await prisma.user.create({
      data: {
        name: 'Colega',
        email: `colega-${TAG}@centro.test`,
        professionalCard: '1',
        phone: '3',
        address: 'x',
        roleId: centro.roleId,
        tenantId: centro.tenantId,
      },
    });
    como(centro);
    const caso = await crearCaso(centro, { operatorId: colega.id });

    await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });

    const avisos = await prisma.notification.findMany({
      where: { tenantId: centro.tenantId, caseId: caso.id },
      select: { userId: true },
    });
    expect(avisos.map((a) => a.userId)).toEqual([colega.id]);
  });
});

describe('aviso al operador', () => {
  it('no llega a un operador cuyo rol no le deja ver el caso', async () => {
    const permiso = await prisma.permission.findFirstOrThrow({
      where: { tenantId: centro.tenantId, name: P.VER_CASOS },
    });
    const rol = await prisma.role.create({
      data: {
        name: `Sin alcance ${TAG}`,
        description: TAG,
        tenantId: centro.tenantId,
        permissions: {
          create: { permissionId: permiso.id, tenantId: centro.tenantId },
        },
      },
    });
    const sinAlcance = await prisma.user.create({
      data: {
        name: 'Operador sin alcance',
        email: `sin-alcance-${TAG}@centro.test`,
        professionalCard: '4',
        phone: '3',
        address: 'x',
        roleId: rol.id,
        tenantId: centro.tenantId,
      },
    });
    como(centro);
    const caso = await crearCaso(centro, { operatorId: sinAlcance.id });

    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });

    expect(r.success).toBe(true);
    const avisos = await prisma.notification.count({
      where: { tenantId: centro.tenantId, caseId: caso.id },
    });
    expect(avisos).toBe(0);
  });
});

describe('permisos', () => {
  it('sin Editar casos no programa ni cancela', async () => {
    const caso = await crearCaso(soloLectura);
    como(soloLectura);
    const r1 = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });
    const r2 = await cancelarAudiencia({ caseId: caso.id });
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    expect((await leer(caso.id)).hearingDate).toBeNull();
  });

  it('otro centro no encuentra el caso', async () => {
    const caso = await crearCaso(centro);
    como(otroCentro);
    const r = await programarAudiencia({
      caseId: caso.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });
    expect(r).toEqual({ success: false, error: 'Caso no encontrado' });
    expect((await leer(caso.id)).hearingDate).toBeNull();
  });

  it('con alcance propio solo toca sus casos', async () => {
    const ajeno = await prisma.user.create({
      data: {
        name: 'Otro operador',
        email: `otro-${TAG}@centro.test`,
        professionalCard: '2',
        phone: '3',
        address: 'x',
        roleId: alcancePropio.roleId,
        tenantId: alcancePropio.tenantId,
      },
    });
    const suyo = await crearCaso(alcancePropio);
    const deOtro = await crearCaso(alcancePropio, { operatorId: ajeno.id });
    como(alcancePropio);

    const rSuyo = await programarAudiencia({
      caseId: suyo.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });
    const rOtro = await programarAudiencia({
      caseId: deOtro.id,
      fecha: '2026-11-20',
      hora: '10:00',
    });

    expect(rSuyo.success).toBe(true);
    expect(rOtro.success).toBe(false);
    expect((await leer(deOtro.id)).hearingDate).toBeNull();
  });
});

describe('cancelarAudiencia', () => {
  it('una audiencia futura desaparece del todo', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    await programarAudiencia({
      caseId: caso.id,
      fecha: dias(30),
      hora: '10:00',
    });

    const r = await cancelarAudiencia({ caseId: caso.id });

    expect(r).toEqual({ success: true });
    const fila = await leer(caso.id);
    expect(fila.hearingDate).toBeNull();
    expect(fila.hearingTime).toBeNull();
    expect(fila.firstHearingDate).toBeNull();
    expect(fila.firstHearingTime).toBeNull();
  });

  it('conserva la primera audiencia si ya pasó', async () => {
    como(centro);
    const pasada = mediodia(dias(-60));
    const caso = await crearCaso(centro, {
      firstHearingDate: pasada,
      firstHearingTime: '09:00',
      hearingDate: mediodia(dias(30)),
      hearingTime: '10:00',
    });

    await cancelarAudiencia({ caseId: caso.id });

    const fila = await leer(caso.id);
    expect(fila.hearingDate).toBeNull();
    expect(fila.firstHearingDate).toEqual(pasada);
  });

  it('sin audiencia, o ya celebrada, no hay nada que cancelar', async () => {
    como(centro);
    const sinNada = await crearCaso(centro);
    const yaPaso = await crearCaso(centro, {
      firstHearingDate: mediodia(dias(-60)),
    });
    expect((await cancelarAudiencia({ caseId: sinNada.id })).success).toBe(
      false,
    );
    expect((await cancelarAudiencia({ caseId: yaPaso.id })).success).toBe(
      false,
    );
  });
});

describe('todas las lecturas dicen lo mismo', () => {
  it('el calendario muestra un reprogramado solo en su mes vigente', async () => {
    como(otroCentro);
    const caso = await crearCaso(otroCentro, {
      firstHearingDate: mediodia('2030-10-15'),
      firstHearingTime: '09:00',
      hearingDate: mediodia('2030-11-20'),
      hearingTime: '15:30',
    });

    const octubre = await getHearings({ month: 10, year: 2030 });
    const noviembre = await getHearings({ month: 11, year: 2030 });

    expect(octubre.data?.some((h) => h.id === caso.id)).toBe(false);
    const fila = noviembre.data?.find((h) => h.id === caso.id);
    expect(fila?.date).toEqual(mediodia('2030-11-20'));
    expect(fila?.time).toBe('15:30');
  });

  it('el calendario no mezcla centros', async () => {
    const mio = await crearCaso(centro, {
      hearingDate: mediodia('2031-03-10'),
    });
    await crearCaso(otroCentro, { hearingDate: mediodia('2031-03-10') });
    como(centro);

    const marzo = await getHearings({ month: 3, year: 2031 });

    expect(marzo.data?.map((h) => h.id)).toEqual([mio.id]);
  });

  it('el aviso cita la fecha vigente y la hora guardada', async () => {
    const manana = mediodia(dias(1));
    const caso = await crearCaso(otroCentro, {
      firstHearingDate: mediodia(dias(-60)),
      firstHearingTime: '07:00',
      hearingDate: manana,
      hearingTime: '08:30',
    });

    await scanUpcomingHearings(prisma as never, otroCentro.tenantId);

    const aviso = await prisma.notification.findFirstOrThrow({
      where: { caseId: caso.id, type: 'hearing_upcoming' },
    });
    expect(aviso.message).toContain('a las 08:30');
    expect(aviso.message).not.toContain('12:00');
  });

  it('el documento cita la vigente, y el Auto de Admisión la primera', async () => {
    const caso = await crearCaso(centro, {
      firstHearingDate: mediodia('2026-11-05'),
      firstHearingTime: '09:00',
      hearingDate: mediodia('2026-11-20'),
      hearingTime: '15:30',
    });
    const fila = await prisma.case.findUniqueOrThrow({
      where: { id: caso.id },
      include: CASE_GENERATION_INCLUDE,
    });

    const p = mapCaseToPlaceholders(fila as never) as unknown as Record<
      string,
      string
    >;

    expect(p.FECHA_AUDIENCIA).toBe('20 de noviembre de 2026');
    expect(p.HORA_AUDIENCIA).toBe('15:30');
    expect(p.DIA_AUDIENCIA).toBe('20');
    expect(p.FECHA_PRIMERA_AUDIENCIA).toBe('05 de noviembre de 2026');
    expect(p.HORA_PRIMERA_AUDIENCIA).toBe('09:00');
  });
});

describe('casos cerrados', () => {
  const FASES_CERRADAS = [
    'Terminado',
    'Fracaso',
    'Rechazo',
    'Retiro',
    'Desistimiento',
  ];

  it.each(FASES_CERRADAS)(
    'con fecha futura en fase %s no aparece en el calendario',
    async (phase) => {
      const fecha = mediodia(dias(40));
      const caso = await crearCaso(centro, { phase, hearingDate: fecha });
      como(centro);

      const mes = await getHearings({
        month: fecha.getUTCMonth() + 1,
        year: fecha.getUTCFullYear(),
      });

      expect(mes.success).toBe(true);
      expect(mes.data?.some((h) => h.id === caso.id)).toBe(false);
    },
  );

  it('con fecha ya pasada sigue en el calendario, como registro', async () => {
    const fecha = mediodia(dias(-40));
    const caso = await crearCaso(centro, {
      phase: 'Terminado',
      hearingDate: fecha,
    });
    como(centro);

    const mes = await getHearings({
      month: fecha.getUTCMonth() + 1,
      year: fecha.getUTCFullYear(),
    });

    expect(mes.data?.some((h) => h.id === caso.id)).toBe(true);
  });

  it('un caso abierto o sin fase sigue en el calendario', async () => {
    const fecha = mediodia(dias(41));
    const abierto = await crearCaso(centro, { hearingDate: fecha });
    const sinFase = await crearCaso(centro, {
      phase: null,
      hearingDate: fecha,
    });
    como(centro);

    const mes = await getHearings({
      month: fecha.getUTCMonth() + 1,
      year: fecha.getUTCFullYear(),
    });

    const ids = mes.data?.map((h) => h.id);
    expect(ids).toContain(abierto.id);
    expect(ids).toContain(sinFase.id);
  });

  it('no genera alertas, pero un caso abierto o sin fase sí', async () => {
    const manana = mediodia(dias(1));
    const cerrado = await crearCaso(centro, {
      phase: 'Fracaso',
      hearingDate: manana,
    });
    const abierto = await crearCaso(centro, { hearingDate: manana });
    const sinFase = await crearCaso(centro, {
      phase: null,
      hearingDate: manana,
    });

    await scanUpcomingHearings(prisma as never, centro.tenantId);

    const avisos = await prisma.notification.findMany({
      where: {
        caseId: { in: [cerrado.id, abierto.id, sinFase.id] },
        type: 'hearing_upcoming',
      },
      select: { caseId: true },
    });
    const conAviso = avisos.map((a) => a.caseId);
    expect(conAviso).not.toContain(cerrado.id);
    expect(conAviso).toContain(abierto.id);
    expect(conAviso).toContain(sinFase.id);
  });

  it('no cuenta en las audiencias próximas del dashboard', async () => {
    como(soloLectura);
    const antes = await getDashboardStats();
    await crearCaso(soloLectura, {
      phase: 'Terminado',
      hearingDate: mediodia(dias(2)),
    });

    const despues = await getDashboardStats();

    expect(despues.data?.upcomingHearings).toBe(antes.data?.upcomingHearings);
  });
});

describe('fase "Audiencia programada"', () => {
  const FASE = 'Audiencia programada';

  it('no se puede asignar sin audiencia', async () => {
    como(centro);
    const caso = await crearCaso(centro);

    const r = await updateCasePhase({ caseId: caso.id, newPhase: FASE });

    expect(r.success).toBe(false);
    expect((await leer(caso.id)).phase).toBe('En negociación');
  });

  it('no se puede asignar con una audiencia que ya pasó', async () => {
    como(centro);
    const caso = await crearCaso(centro, {
      hearingDate: mediodia(dias(-5)),
      firstHearingDate: mediodia(dias(-5)),
    });

    const r = await updateCasePhase({ caseId: caso.id, newPhase: FASE });

    expect(r.success).toBe(false);
    expect((await leer(caso.id)).phase).toBe('En negociación');
  });

  it('se puede asignar con una audiencia pendiente', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    await programarAudiencia({
      caseId: caso.id,
      fecha: dias(20),
      hora: '10:00',
    });

    const r = await updateCasePhase({ caseId: caso.id, newPhase: FASE });

    expect(r).toEqual({ success: true });
    expect((await leer(caso.id)).phase).toBe(FASE);
  });

  it('un caso que ya está en la fase sin fecha sigue editándose y puede salir', async () => {
    como(centro);
    const caso = await crearCaso(centro, { phase: FASE });

    const editar = await updateCase({
      id: caso.id,
      phase: FASE,
      city: 'Cali',
    } as never);
    const mismaFase = await updateCasePhase({
      caseId: caso.id,
      newPhase: FASE,
    });
    const salir = await updateCasePhase({
      caseId: caso.id,
      newPhase: 'En negociación',
    });

    expect(editar.success).toBe(true);
    expect(mismaFase.success).toBe(true);
    expect(salir.success).toBe(true);
    expect((await leer(caso.id)).phase).toBe('En negociación');
  });

  it('cancelar la audiencia devuelve el caso a "En negociación"', async () => {
    como(centro);
    const caso = await crearCaso(centro);
    await programarAudiencia({
      caseId: caso.id,
      fecha: dias(20),
      hora: '10:00',
    });
    await updateCasePhase({ caseId: caso.id, newPhase: FASE });

    const r = await cancelarAudiencia({ caseId: caso.id });

    expect(r.success).toBe(true);
    const fila = await leer(caso.id);
    expect(fila.phase).toBe('En negociación');
    expect(fila.hearingDate).toBeNull();
  });

  it('cancelar en conciliación también devuelve a "En negociación"', async () => {
    como(centro);
    const caso = await crearCaso(centro, { type: 'CONCILIATION' });
    await programarAudiencia({
      caseId: caso.id,
      fecha: dias(20),
      hora: '10:00',
    });
    await updateCasePhase({ caseId: caso.id, newPhase: FASE });
    expect((await leer(caso.id)).phase).toBe(FASE);

    const r = await cancelarAudiencia({ caseId: caso.id });

    expect(r.success).toBe(true);
    const fila = await leer(caso.id);
    expect(fila.type).toBe('CONCILIATION');
    expect(fila.phase).toBe('En negociación');
    expect(fila.hearingDate).toBeNull();
  });

  it('cancelar en otra fase no la cambia', async () => {
    como(centro);
    const caso = await crearCaso(centro, { phase: 'Admisión' });
    await programarAudiencia({
      caseId: caso.id,
      fecha: dias(20),
      hora: '10:00',
    });

    await cancelarAudiencia({ caseId: caso.id });

    expect((await leer(caso.id)).phase).toBe('Admisión');
  });
});

describe('calendario para quien programa', () => {
  let abogado: TenantDePrueba;
  let sinEditar: TenantDePrueba;

  beforeAll(async () => {
    // Como el rol Abogado de un centro en producción: edita y ve sus casos, sin
    // el permiso `Ver calendario`.
    abogado = await crearTenantDePrueba(`${TAG}-ab`, [
      P.VER_CASOS,
      P.EDITAR_CASOS,
      P.VER_CASOS_PROPIOS,
    ]);
    sinEditar = await crearTenantDePrueba(`${TAG}-se`, [
      P.VER_CASOS,
      P.VER_CASOS_PROPIOS,
    ]);
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 300));
    for (const t of [abogado, sinEditar]) if (t) await purgeTenant(t.tenantId);
  });

  it('con Editar casos ve el calendario, solo con sus casos y su centro', async () => {
    const fecha = mediodia('2032-05-10');
    const otro = await prisma.user.create({
      data: {
        name: 'Otro abogado',
        email: `abogado2-${TAG}@centro.test`,
        professionalCard: '3',
        phone: '3',
        address: 'x',
        roleId: abogado.roleId,
        tenantId: abogado.tenantId,
      },
    });
    const suyo = await crearCaso(abogado, { hearingDate: fecha });
    await crearCaso(abogado, { hearingDate: fecha, operatorId: otro.id });
    await crearCaso(centro, { hearingDate: fecha });
    como(abogado);

    const mes = await getHearings({ month: 5, year: 2032 });

    expect(mes.success).toBe(true);
    expect(mes.data?.map((h) => h.id)).toEqual([suyo.id]);
  });

  it('sin Editar casos ni Ver calendario sigue sin poder', async () => {
    como(sinEditar);
    const mes = await getHearings({ month: 5, year: 2032 });
    expect(mes.success).toBe(false);
  });
});
