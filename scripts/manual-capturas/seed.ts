/**
 * Seed de las capturas del manual. Independiente del seed de la aplicación
 * (`src/prisma/seed.ts`), que no se toca: aquel crea usuarios con nombres de
 * personas del equipo y no sirve para figuras públicas.
 *
 * Qué hace, en orden:
 *  1. Verifica que la base sea `localhost/insolventic_manual_test`
 *     (`guarda-base.ts`). Si no, aborta sin conectarse.
 *  2. Recrea el esquema desde `schema.prisma` (`prisma db push --force-reset`):
 *     cada corrida parte de una base vacía, así el resultado es idéntico.
 *     Se usa `db push` y no las migraciones por la deriva conocida del
 *     historial (CLAUDE.md, "Si tocás migraciones").
 *  3. Siembra el centro, sus permisos y los 6 roles con las mismas
 *     asignaciones que el seed de la app, los usuarios ficticios y los datos
 *     de `datos.ts`.
 *
 * La contraseña de los usuarios se genera en cada corrida y solo vive en
 * memoria: `sembrar()` la devuelve al script de capturas.
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import { P } from '@/lib/permissions';

import { CENTRO, FECHA_ANCLA, RAIZ_REPO } from './config';
import {
  ACREEDORES,
  CASOS_CONTEXTO,
  DEUDOR_EJEMPLO,
  CRONOGRAMA_LUZ,
  DEUDORES_CONTEXTO,
  NOTIFICACIONES_ADMIN,
  ULTIMO_ACCESO_HORAS,
  USUARIOS,
  type ClaveRol,
} from './datos';
import { assertBaseDeCapturas } from './guarda-base';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha ancla menos `dias` días. */
export function diasAntesDelAncla(dias: number): Date {
  return new Date(FECHA_ANCLA.getTime() - dias * DIA_MS);
}

const CATEGORIA: Record<string, string> = {
  [P.VER_USUARIOS]: 'Usuarios y Roles',
  [P.CREAR_USUARIOS]: 'Usuarios y Roles',
  [P.EDITAR_USUARIOS]: 'Usuarios y Roles',
  [P.ELIMINAR_USUARIOS]: 'Usuarios y Roles',
  [P.VER_ROLES]: 'Usuarios y Roles',
  [P.CREAR_ROLES]: 'Usuarios y Roles',
  [P.EDITAR_ROLES]: 'Usuarios y Roles',
  [P.ELIMINAR_ROLES]: 'Usuarios y Roles',
  [P.VER_CASOS]: 'Casos',
  [P.CREAR_CASOS]: 'Casos',
  [P.EDITAR_CASOS]: 'Casos',
  [P.ELIMINAR_CASOS]: 'Casos',
  [P.ELIMINAR_CASOS_DEFINITIVAMENTE]: 'Casos',
  [P.VER_TODOS_CASOS]: 'Casos',
  [P.VER_CASOS_PROPIOS]: 'Casos',
  [P.VER_CASOS_CLIENTE]: 'Casos',
  [P.VER_ACREEDORES]: 'Acreedores',
  [P.CREAR_ACREEDORES]: 'Acreedores',
  [P.EDITAR_ACREEDORES]: 'Acreedores',
  [P.ELIMINAR_ACREEDORES]: 'Acreedores',
  [P.VER_DEUDORES]: 'Deudores',
  [P.CREAR_DEUDORES]: 'Deudores',
  [P.EDITAR_DEUDORES]: 'Deudores',
  [P.ELIMINAR_DEUDORES]: 'Deudores',
  [P.VER_DOCUMENTOS]: 'Documentos',
  [P.GENERAR_DOCUMENTOS]: 'Documentos',
  [P.VER_NOTIFICACIONES]: 'Notificaciones',
  [P.EDITAR_NOTIFICACIONES]: 'Notificaciones',
  [P.GESTIONAR_NOTIFICACIONES]: 'Notificaciones',
  [P.VER_AUDITORIA]: 'Auditoría',
  [P.VER_CALENDARIO]: 'Calendario',
  [P.VER_REPORTES]: 'Reportes',
  [P.REGISTRAR_PAGOS]: 'Pagos',
};

/**
 * Roles y permisos: copia de las asignaciones de `src/prisma/seed.ts`, que es
 * lo que el manual describe en la sección 2. Si aquel cambia, cambiar aquí.
 */
const ROLES: ReadonlyArray<{
  clave: ClaveRol;
  nombre: string;
  descripcion: string;
  color: string;
  permisos: readonly string[];
}> = [
  {
    clave: 'admin',
    nombre: 'Administrador',
    descripcion: 'Acceso completo al sistema',
    color: 'bg-red-100 text-red-800',
    permisos: Object.values(P),
  },
  {
    clave: 'operadora',
    nombre: 'Operadora de Insolvencia',
    descripcion: 'Operador especializado en procesos de insolvencia',
    color: 'bg-purple-100 text-purple-800',
    permisos: [
      P.VER_CASOS,
      P.VER_TODOS_CASOS,
      P.CREAR_CASOS,
      P.EDITAR_CASOS,
      P.ELIMINAR_CASOS,
      P.VER_ACREEDORES,
      P.CREAR_ACREEDORES,
      P.EDITAR_ACREEDORES,
      P.VER_DEUDORES,
      P.CREAR_DEUDORES,
      P.EDITAR_DEUDORES,
      P.VER_DOCUMENTOS,
      P.GENERAR_DOCUMENTOS,
      P.VER_NOTIFICACIONES,
    ],
  },
  {
    clave: 'abogado',
    nombre: 'Abogado',
    descripcion: 'Gestión de casos y audiencias',
    color: 'bg-blue-100 text-blue-800',
    permisos: [
      P.VER_CASOS,
      P.VER_CASOS_PROPIOS,
      P.CREAR_CASOS,
      P.EDITAR_CASOS,
      P.VER_ACREEDORES,
      P.VER_DEUDORES,
      P.VER_DOCUMENTOS,
      P.GENERAR_DOCUMENTOS,
      P.VER_NOTIFICACIONES,
    ],
  },
  {
    clave: 'asistente',
    nombre: 'Asistente Legal',
    descripcion: 'Apoyo en gestión legal y documental',
    color: 'bg-green-100 text-green-800',
    permisos: [
      P.VER_CASOS,
      P.VER_CASOS_PROPIOS,
      P.VER_ACREEDORES,
      P.VER_DEUDORES,
      P.VER_DOCUMENTOS,
      P.GENERAR_DOCUMENTOS,
      P.VER_NOTIFICACIONES,
    ],
  },
  {
    clave: 'secretaria',
    nombre: 'Secretaria',
    descripcion: 'Apoyo administrativo',
    color: 'bg-yellow-100 text-yellow-800',
    permisos: [P.VER_DOCUMENTOS, P.VER_CASOS, P.VER_TODOS_CASOS],
  },
  {
    clave: 'usuario',
    nombre: 'Usuario',
    descripcion: 'Usuario registrado con permisos básicos',
    color: 'bg-gray-100 text-gray-800',
    permisos: [
      P.VER_NOTIFICACIONES,
      P.VER_CASOS,
      P.VER_CASOS_CLIENTE,
      P.VER_DEUDORES,
      P.VER_ACREEDORES,
      P.VER_DOCUMENTOS,
    ],
  },
];

export interface ResultadoSeed {
  /** Contraseña de todos los usuarios de esta corrida (solo en memoria). */
  password: string;
  usuarios: Record<
    Exclude<ClaveRol, 'usuario'>,
    { email: string; nombre: string }
  >;
}

/**
 * Recrea el esquema de la base de capturas desde `schema.prisma`. Vuelve a
 * validar el destino justo antes del reset, lo imprime, y le pasa a Prisma
 * DATABASE_URL y DIRECT_URL explícitas: nada sale de `.env` ni `.env.local`
 * (dotenv no pisa variables ya definidas).
 */
function recrearEsquema(env: NodeJS.ProcessEnv, url: string): void {
  const envPrisma = { ...env, DATABASE_URL: url, DIRECT_URL: url };
  const destino = assertBaseDeCapturas(envPrisma);
  console.log(
    `› Reset de la base de capturas: host ${destino.host}, puerto ${destino.puerto}, ` +
      `base ${destino.base}`,
  );
  execFileSync(
    process.execPath,
    [
      path.join(RAIZ_REPO, 'node_modules', 'prisma', 'build', 'index.js'),
      'db',
      'push',
      '--force-reset',
      '--skip-generate',
    ],
    { cwd: RAIZ_REPO, env: envPrisma, stdio: 'inherit' },
  );
}

export async function sembrar(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoSeed> {
  const { url } = assertBaseDeCapturas(env);

  recrearEsquema(env, url);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const password = randomBytes(18).toString('base64url');
    const hash = await bcrypt.hash(password, 12);

    const tenant = await prisma.tenant.create({
      data: {
        name: CENTRO.nombre,
        slug: CENTRO.slug,
        description:
          'Centro de conciliación del manual de usuario (datos sintéticos)',
      },
    });
    const tenantId = tenant.id;

    const permisos = new Map<string, string>();
    for (const nombre of Object.values(P)) {
      const p = await prisma.permission.create({
        data: {
          name: nombre,
          category: CATEGORIA[nombre] ?? 'Otros',
          tenantId,
        },
      });
      permisos.set(nombre, p.id);
    }

    const roles = new Map<ClaveRol, string>();
    for (const rol of ROLES) {
      const r = await prisma.role.create({
        data: {
          name: rol.nombre,
          description: rol.descripcion,
          color: rol.color,
          tenantId,
          permissions: {
            create: rol.permisos.map((nombre) => ({
              permissionId: permisos.get(nombre)!,
              tenantId,
            })),
          },
        },
      });
      roles.set(rol.clave, r.id);
    }

    const usuarios = {} as ResultadoSeed['usuarios'];
    const idsUsuario = new Map<string, string>();
    for (const u of USUARIOS) {
      const creado = await prisma.user.create({
        data: {
          name: u.nombre,
          email: u.email,
          password: hash,
          mustChangePassword: false,
          professionalCard: u.tarjetaProfesional,
          phone: u.telefono,
          address: u.direccion,
          createdDate: diasAntesDelAncla(300),
          lastLogin: new Date(
            FECHA_ANCLA.getTime() - ULTIMO_ACCESO_HORAS[u.clave] * 3600_000,
          ),
          roleId: roles.get(u.clave)!,
          tenantId,
        },
      });
      usuarios[u.clave] = { email: u.email, nombre: u.nombre };
      idsUsuario.set(u.clave, creado.id);
    }

    const idsAcreedor = new Map<string, string>();
    for (const a of ACREEDORES) {
      const creado = await prisma.creditor.create({
        data: {
          name: a.nombre,
          type: a.tipo,
          nit: a.nit,
          email: a.email,
          phone: a.telefono,
          address: a.direccion,
          representative: a.representante,
          city: a.ciudad,
          department: a.departamento,
          createdDate: diasAntesDelAncla(280),
          tenantId,
        },
      });
      idsAcreedor.set(a.clave, creado.id);
    }

    const idsDeudor = new Map<string, string>();
    const deudores = [
      { ...DEUDOR_EJEMPLO },
      ...DEUDORES_CONTEXTO.map((d) => ({ ...d })),
    ];
    for (const d of deudores) {
      // La papelera no cuenta como caso activo del deudor.
      const casos = CASOS_CONTEXTO.filter(
        (c) => c.deudor === d.clave && !c.papelera,
      );
      const deuda = casos
        .flatMap((c) => c.deudas)
        .reduce((s, x) => s + x.monto, 0);
      const creado = await prisma.debtor.create({
        data: {
          name: d.nombre,
          idNumber: d.cedula,
          idType: 'CC',
          email: d.email,
          phone: d.telefono,
          address: d.direccion,
          city: d.ciudad,
          department: d.departamento,
          occupation: d.ocupacion,
          monthlyIncome: d.ingresoMensual,
          monthlyExpenses: d.gastoMensual,
          totalDebt: deuda,
          activeCases: casos.length,
          createdDate: diasAntesDelAncla(casos[0]?.diasAntes ?? 20),
          tenantId,
        },
      });
      idsDeudor.set(d.clave, creado.id);
    }

    const idsCaso = new Map<string, string>();
    for (const c of CASOS_CONTEXTO) {
      const deudor = deudores.find((d) => d.clave === c.deudor)!;
      const operador = USUARIOS.find((u) => u.clave === c.operador)!;
      const total = c.deudas.reduce((s, x) => s + x.monto, 0);
      const papelera = c.papelera
        ? {
            // A media tarde del día indicado: una hora verosímil de oficina.
            deletedAt: new Date(
              diasAntesDelAncla(c.papelera.diasAntes).getTime() +
                5 * 60 * 60 * 1000,
            ),
            deletedById: idsUsuario.get('operadora')!,
            deletedByName: USUARIOS.find((u) => u.clave === 'operadora')!
              .nombre,
          }
        : {};
      const caso = await prisma.case.create({
        data: {
          ...papelera,
          caseNumber: c.numero,
          debtorName: deudor.nombre,
          debtorIdNumber: deudor.cedula,
          type: c.tipo,
          phase: c.fase,
          totalDebt: total,
          creditors: c.deudas.length,
          createdDate: diasAntesDelAncla(c.diasAntes),
          filingDate: diasAntesDelAncla(c.diasAntes),
          city: deudor.ciudad,
          designatedOperator: operador.nombre,
          debtorId: idsDeudor.get(c.deudor)!,
          operatorId: idsUsuario.get(c.operador)!,
          tenantId,
        },
      });
      for (const d of c.deudas) {
        await prisma.debt.create({
          data: {
            amount: d.monto,
            capitalAmount: d.monto,
            interestRate: d.tasa,
            type: d.tipo,
            caseId: caso.id,
            creditorId: idsAcreedor.get(d.acreedor)!,
            debtorId: idsDeudor.get(c.deudor)!,
            tenantId,
          },
        });
      }
      idsCaso.set(c.numero, caso.id);
    }

    // Cronograma del acuerdo de Luz (sección 8).
    {
      const c = CRONOGRAMA_LUZ;
      const casoLuz = CASOS_CONTEXTO.find((x) => x.numero === c.caso)!;
      for (let k = 1; k <= c.cuotas; k++) {
        const { anio, mes, dia } = c.primerVencimiento;
        // 10:00 en Bogotá (15:00 UTC) del día 15 de cada mes.
        const vence = new Date(Date.UTC(anio, mes - 1 + (k - 1), dia, 15));
        const pagada = k <= c.pagadas;
        const n = String(k).padStart(2, '0');
        await prisma.payment.create({
          data: {
            caseId: idsCaso.get(c.caso)!,
            debtorId: idsDeudor.get(casoLuz.deudor)!,
            tenantId,
            amount: c.valorCuota,
            paymentNumber: k,
            dueDate: vence,
            status: pagada ? 'pagado' : 'pendiente',
            ...(pagada
              ? {
                  paymentDate: new Date(vence.getTime() - 2 * 24 * 3600_000),
                  paymentMethod: c.metodos[k - 1],
                  registeredById: idsUsuario.get('admin')!,
                  receiptFileName: `comprobante-cuota-${n}.pdf`,
                  receiptFileUrl: `https://example.invalid/comprobantes/${c.caso}/cuota-${n}.pdf`,
                }
              : {}),
          },
        });
      }
    }

    for (const n of NOTIFICACIONES_ADMIN) {
      await prisma.notification.create({
        data: {
          type: n.tipo,
          title: n.titulo,
          message: n.mensaje,
          userId: idsUsuario.get('admin')!,
          caseId: n.caso ? idsCaso.get(n.caso)! : null,
          read: n.leida,
          createdDate: new Date(
            FECHA_ANCLA.getTime() - n.horasAntes * 3600_000,
          ),
          tenantId,
        },
      });
    }

    return { password, usuarios };
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecución directa: `npx tsx scripts/manual-capturas/seed.ts`.
if (require.main === module) {
  sembrar()
    .then(({ usuarios }) => {
      console.log(
        `Base de capturas lista: ${Object.keys(usuarios).length} usuarios, ` +
          `${CASOS_CONTEXTO.length} casos de contexto. La contraseña de esta ` +
          'corrida no se imprime: la usa solo capturar.ts.',
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
