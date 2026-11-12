/**
 * Regresión: ninguna server action crea usuarios en un centro tomado de la
 * petición.
 *
 * `registerUser` (eliminada el 2026-11-12) exigía `Crear usuarios` en la
 * sesión, pero tomaba el centro del cuerpo (`tenantId`, un slug) y asignaba el
 * rol "Usuario". Un administrador del centro A podía crear en el centro B una
 * cuenta con el correo de un deudor de B y, con el alcance "cliente" de
 * `case-access`, ver sus expedientes. El único llamador era un formulario
 * huérfano: `/register` redirige a `/login` desde el cierre del registro (C-2).
 *
 * Dos capas:
 *  1. Patrón de código: los únicos `user.create/createMany/upsert` en archivos
 *     `'use server'` son los de la lista; uno nuevo hace fallar este test hasta
 *     que alguien revise de dónde sale su centro.
 *  2. Comportamiento: `createUser` crea en el centro de la sesión aunque el
 *     cuerpo traiga otro.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/email', () => ({
  emailService: { sendUserCreatedEmail: jest.fn().mockResolvedValue(true) },
}));

import { createUser } from '@/features/user/actions';
import { createUserSchema } from '@/features/user/schemas';
import { P } from '@/lib/permissions';

const RAIZ = join(__dirname, '../..');
const SRC = join(RAIZ, 'src');

function archivosUseServer(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosUseServer(ruta));
    } else if (/\.(ts|tsx)$/.test(nombre)) {
      const fuente = readFileSync(ruta, 'utf8');
      if (/^\s*['"]use server['"]/.test(fuente)) salida.push(ruta);
    }
  }
  return salida;
}

const rel = (ruta: string) => relative(RAIZ, ruta).split(sep).join('/');

/**
 * Server actions que crean usuarios, y por qué su centro es el de la sesión.
 * Agregar una entrada exige revisar la action nueva con el mismo criterio.
 */
const CREAN_USUARIOS: Record<string, string> = {
  'src/features/user/actions.ts':
    'createUser: `tenant: { connect: { id: tenantId } }` con el tenantId de authenticateUser()',
};

describe('creación de usuarios — el centro sale de la sesión', () => {
  const archivos = archivosUseServer(SRC);

  it('encuentra las server actions (el recorrido no está vacío)', () => {
    expect(archivos.length).toBeGreaterThan(10);
  });

  it('solo los archivos revisados crean usuarios', () => {
    const queCrean = archivos
      .filter((ruta) =>
        /\buser\.(create|createMany|upsert)\(/.test(readFileSync(ruta, 'utf8')),
      )
      .map(rel)
      .sort();
    expect(queCrean).toEqual(Object.keys(CREAN_USUARIOS).sort());
  });

  it('ninguna server action exporta registerUser', () => {
    const conRegistro = archivos
      .filter((ruta) =>
        /export\s+async\s+function\s+registerUser\b/.test(
          readFileSync(ruta, 'utf8'),
        ),
      )
      .map(rel);
    expect(conRegistro).toEqual([]);
  });

  it('createUser toma el centro de authenticateUser() y lo usa al crear', () => {
    const fuente = readFileSync(join(SRC, 'features/user/actions.ts'), 'utf8');
    const inicio = fuente.indexOf('export async function createUser(');
    const fin = fuente.indexOf('\nexport ', inicio + 1);
    const cuerpo = fuente.slice(inicio, fin);
    expect(cuerpo).toMatch(
      /const \{ user, tenantId \} = await authenticateUser\(\)/,
    );
    expect(cuerpo).toMatch(/tenant: \{ connect: \{ id: tenantId \} \}/);
    // El centro no se lee del input en ninguna forma.
    expect(cuerpo).not.toMatch(/validatedInput\.tenant|input\.tenant/);
  });

  it('el esquema de entrada de createUser no tiene campo de centro', () => {
    const campos = Object.keys(createUserSchema.shape);
    expect(campos).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/tenant|center|centro/i)]),
    );
  });
});

describe('createUser — un usuario del centro A no crea en el centro B', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: 'admin-a',
        name: 'Admin A',
        email: 'admin@a.test',
        roleName: 'Administrador',
        professionalCard: null,
        permissions: [P.CREAR_USUARIOS],
      },
      tenantId: 'tenant-a',
    });
    mockPrisma.role.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.tenantId === 'tenant-a' ? { id: where.id } : null,
    );
    mockPrisma.user.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'nuevo',
        ...data,
        roleId: 'rol-usuario',
        role: { name: 'Usuario' },
        lastLogin: null,
        createdDate: new Date(),
      }),
    );
  });

  const cuerpoConOtroCentro = {
    name: 'Cliente',
    email: 'deudor@b.test',
    phone: '3000000000',
    address: 'Calle 1',
    professionalCard: 'N/A',
    roleId: 'rol-usuario',
    // Lo que mandaría quien intente crear en otro centro.
    tenantId: 'tenant-b',
    tenant: { connect: { id: 'tenant-b' } },
  };

  it('crea en el centro de la sesión e ignora el centro del cuerpo', async () => {
    const resultado = await createUser(cuerpoConOtroCentro);

    expect(resultado.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    const { data } = (mockPrisma.user.create as jest.Mock).mock.calls[0][0];
    expect(data.tenant).toEqual({ connect: { id: 'tenant-a' } });
    expect(data).not.toHaveProperty('tenantId');
    expect(JSON.stringify(data)).not.toContain('tenant-b');
  });

  it('un rol de otro centro se rechaza sin crear nada', async () => {
    mockPrisma.role.findFirst.mockResolvedValue(null);

    const resultado = await createUser({
      ...cuerpoConOtroCentro,
      roleId: 'rol-del-centro-b',
    });

    expect(resultado).toEqual({ success: false, error: 'Rol no encontrado' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
