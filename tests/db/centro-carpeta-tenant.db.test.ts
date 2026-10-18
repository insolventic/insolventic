/**
 * El flujo REAL de generación inicial de documentos, contra Postgres real,
 * para los DOS centros reales (`armonia` y `constructores-paz`), sembrados
 * con su CUID real -no el slug inyectado a mano que usan los fixtures
 * unitarios.
 *
 * Esto es lo que ni el golden master ni los tests unitarios podían cazar:
 * `authenticateUser()` devuelve el cuid de `Tenant.id`, pero
 * `resolveCenterFolderName` (src/lib/centro-conciliacion.ts) está indexada
 * por el SLUG. Antes del fix, los 7 llamadores le pasaban el cuid y la
 * función SIEMPRE lanzaba "No se pudo determinar el centro de
 * conciliación" -confirmado por reproducción manual en el navegador local
 * contra este mismo bug, ver docs/IMPLEMENTACION_SEMANA_12.md.
 *
 * Se mockea SOLO lo que toca servicios externos (Drive, Chromium vía
 * `generateDocumentsForNewCase`) -nunca la resolución del centro, que es
 * exactamente lo que este test verifica. `generateInitialDocuments` resuelve
 * el centro ANTES de llamar a `generateDocumentsForNewCase`, así que
 * mockear esa función no mockea la parte que importa: se captura el
 * `centerFolderName` con el que la llama, que es la carpeta que de verdad
 * se usaría en Drive.
 *
 * Los tenants `armonia`/`constructores-paz` casi seguro ya existen (los crea
 * `src/prisma/seed.ts`); por eso todo lo compartido (Tenant, Role
 * "Administrador", Permission) se resuelve con upsert -nunca se crea
 * duplicado ni se borra al terminar. Solo se crea y se purga lo propio de
 * esta suite: el usuario de prueba, el deudor y el caso.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
// La generación automática post-creación (createCase → after() →
// runInitialGenerationJob) no es lo que este test ejercita: se ejercita
// generateInitialDocuments explícitamente, una vez, de forma determinista.
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

const mockGenerateDocumentsForNewCase = jest.fn();
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: (...args: unknown[]) =>
    mockGenerateDocumentsForNewCase(...args),
}));

import { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAccessToken } from '@/lib/auth';
import { createCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { generateInitialDocuments } from '@/features/document/actions-generation';
import { mockCookies } from '../__mocks__/next-headers';
import { wizardSubmit } from './helpers/tenant';
import { FIXTURES } from './helpers/casos-sinteticos';

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Borra TODO lo que cuelga de un `caseId` (Debt, Asset, Document,
 * DocumentGenerationRequest, etc.), en el orden correcto de FKs, y al
 * final el Case mismo. Misma idea que `tenantScopedModelsChildrenFirst`
 * de `./helpers/tenant.ts` pero por `caseId` en vez de `tenantId` -ningún
 * modelo de caso tiene `onDelete: Cascade` desde `Case` consistentemente,
 * así que no alcanza con borrar el Case y listo (ver `Debt_caseId_fkey`).
 */
async function purgeCase(caseId: string): Promise<void> {
  const models = Prisma.dmmf.datamodel.models.filter(
    (m) =>
      m.name !== 'Case' &&
      m.fields.some((f) => f.name === 'caseId' && f.kind === 'scalar'),
  );
  const names = new Set(models.map((m) => m.name));
  const referencedBy = new Map<string, Set<string>>(
    models.map((m) => [m.name, new Set<string>()]),
  );
  for (const m of models) {
    for (const f of m.fields) {
      const isForeignKey =
        f.kind === 'object' && (f.relationFromFields?.length ?? 0) > 0;
      if (isForeignKey && names.has(f.type) && f.type !== m.name) {
        referencedBy.get(f.type)!.add(m.name);
      }
    }
  }
  const order: string[] = [];
  const remaining = new Set(names);
  while (remaining.size > 0) {
    const leaves = [...remaining].filter(
      (name) => ![...referencedBy.get(name)!].some((c) => remaining.has(c)),
    );
    const batch = leaves.length > 0 ? leaves : [...remaining];
    for (const name of batch) {
      order.push(name);
      remaining.delete(name);
    }
  }

  for (const delegate of order.map(lowerFirst)) {
    await (
      prisma as unknown as Record<
        string,
        { deleteMany: (a: object) => Promise<unknown> }
      >
    )[delegate].deleteMany({ where: { caseId } });
  }
  await prisma.case.deleteMany({ where: { id: caseId } });
}

const FIXTURE = FIXTURES.find((f) => f.key === 'I2-insolvencia-minima')!;
const TAG = `centrocarpeta-${Date.now().toString(36)}`;

const PERMISOS = [
  P.CREAR_CASOS,
  P.VER_CASOS,
  P.EDITAR_CASOS,
  P.VER_TODOS_CASOS,
  P.GENERAR_DOCUMENTOS,
];

interface SesionDelCentro {
  tenantId: string;
  tenantSlug: 'armonia' | 'constructores-paz';
  userId: string;
  token: string;
}

/**
 * Sesión real para uno de los dos centros reales. Todo lo compartido
 * (Tenant, Role, Permission, RolePermission) se resuelve con upsert: si el
 * seed ya corrió, reutiliza esas filas tal cual están; si no, las crea. En
 * ningún caso duplica ni borra algo que no sea propio de esta suite.
 */
async function sesionDelCentroReal(
  slug: 'armonia' | 'constructores-paz',
): Promise<SesionDelCentro> {
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: slug === 'armonia' ? 'Armonía' : 'Constructores de Paz',
    },
  });

  const role = await prisma.role.upsert({
    where: { name_tenantId: { name: 'Administrador', tenantId: tenant.id } },
    update: {},
    create: {
      name: 'Administrador',
      description: 'Acceso completo al sistema',
      tenantId: tenant.id,
    },
  });

  for (const name of PERMISOS) {
    const permission = await prisma.permission.upsert({
      where: { name_tenantId: { name, tenantId: tenant.id } },
      update: {},
      create: { name, category: 'casos', tenantId: tenant.id },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id, tenantId: tenant.id },
    });
  }

  const user = await prisma.user.create({
    data: {
      name: 'Operador de prueba — centro-carpeta-tenant',
      email: `operador-${slug}-${TAG}@centroejemplo.test`,
      professionalCard: '155820',
      phone: '3178899001',
      address: 'Calle 72 # 10-34 Oficina 801, Bogotá D.C.',
      roleId: role.id,
      tenantId: tenant.id,
    },
  });

  const token = await createAccessToken({
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: role.id,
    roleName: role.name,
    permissions: PERMISOS,
    tenantId: tenant.slug,
    tenantName: tenant.name,
    lastLogin: new Date(),
  });

  return { tenantId: tenant.id, tenantSlug: slug, userId: user.id, token };
}

interface CasoDeCentro {
  sesion: SesionDelCentro;
  caseId: string;
  debtorId: string;
}

const CENTROS = ['armonia', 'constructores-paz'] as const;
const CARPETA_ESPERADA: Record<(typeof CENTROS)[number], string> = {
  armonia: 'Armonía',
  'constructores-paz': 'Constructores de Paz',
};

const casos = new Map<(typeof CENTROS)[number], CasoDeCentro>();

beforeAll(async () => {
  for (const slug of CENTROS) {
    const sesion = await sesionDelCentroReal(slug);
    mockCookies.setToken('access-token', sesion.token);

    const debtor = await prisma.debtor.create({
      data: { ...FIXTURE.debtor, tenantId: sesion.tenantId },
    });

    const parsed = createCaseFormSchema.parse({
      ...FIXTURE.form,
      debtorId: debtor.id,
      operatorId: sesion.userId,
    }) as Record<string, unknown>;

    const result = await createCase(wizardSubmit(parsed) as never);
    if (!result.success || !result.data) {
      throw new Error(
        `No se pudo crear el caso de prueba para ${slug}: ${result.error}`,
      );
    }

    // createCase reclama su propio DocumentGenerationRequest (kind
    // INITIAL) de forma síncrona y deja el job real para after() -que acá
    // está mockeado y nunca corre, así que el lock queda PENDING para
    // siempre. Sin liberarlo, el generateInitialDocuments explícito de
    // este test chocaría con "ya hay una generación en curso" sin que
    // tenga nada que ver con el bug que se está probando.
    const claimAutomatico = await prisma.documentGenerationRequest.findFirst({
      where: { caseId: result.data.id, kind: 'INITIAL' },
    });
    if (claimAutomatico) {
      const { failGenerationRequest } = await import(
        '@/features/document/generation-request'
      );
      await failGenerationRequest(
        claimAutomatico.id,
        'liberado por centro-carpeta-tenant.db.test.ts: la generación real se dispara explícitamente en el test',
      );
    }

    casos.set(slug, { sesion, caseId: result.data.id, debtorId: debtor.id });
  }
}, 60_000);

afterAll(async () => {
  // Se borra EXACTAMENTE lo que creó esta suite, por id -nunca un filtro
  // amplio sobre el tenant real (armonia/constructores-paz pueden tener
  // casos y deudores de verdad, del seed o de otra sesión).
  for (const { sesion, caseId, debtorId } of casos.values()) {
    await purgeCase(caseId);
    await prisma.debtor.deleteMany({ where: { id: debtorId } });
    await prisma.user.deleteMany({ where: { id: sesion.userId } });
  }
  // Tenant / Role / Permission / RolePermission son compartidos (del seed):
  // nunca se borran acá.
  await prisma.$disconnect();
});

describe('generateInitialDocuments resuelve el centro por SLUG, para los dos centros reales', () => {
  beforeEach(() => {
    mockGenerateDocumentsForNewCase.mockReset();
    mockGenerateDocumentsForNewCase.mockResolvedValue({
      caseFolderId: 'fake-drive-folder-id',
      caseFolderUrl: 'https://drive.google.com/fake',
      documents: [],
    });
  });

  it.each(CENTROS)(
    '%s: ya NO lanza "No se pudo determinar el centro" (el bug real, reproducido contra Postgres)',
    async (slug) => {
      const { sesion, caseId } = casos.get(slug)!;
      mockCookies.setToken('access-token', sesion.token);

      const result = await generateInitialDocuments(caseId);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
    },
  );

  it.each(CENTROS)(
    '%s: la carpeta de Drive que calcularía es la SUYA, no la del otro centro',
    async (slug) => {
      const { sesion, caseId } = casos.get(slug)!;
      mockCookies.setToken('access-token', sesion.token);

      await generateInitialDocuments(caseId);

      expect(mockGenerateDocumentsForNewCase).toHaveBeenCalledTimes(1);
      const [, , centerFolderName] =
        mockGenerateDocumentsForNewCase.mock.calls[0];
      expect(centerFolderName).toBe(CARPETA_ESPERADA[slug]);

      const otroCentro = slug === 'armonia' ? 'constructores-paz' : 'armonia';
      expect(centerFolderName).not.toBe(CARPETA_ESPERADA[otroCentro]);
    },
  );

  it('REGRESIÓN: el cuid del tenant (lo que se le pasaba antes del fix) sigue sin resolver ningún centro', async () => {
    // No es un re-test de generateInitialDocuments -esa función ya pasa el
    // slug-, sino la prueba directa de que el síntoma original (pasar el
    // cuid) sigue fallando cerrado, con los cuids REALES de los dos
    // tenants recién sembrados contra Postgres.
    const { resolveCenterFolderName } = await import(
      '@/lib/centro-conciliacion'
    );
    for (const slug of CENTROS) {
      const { sesion } = casos.get(slug)!;
      expect(() => resolveCenterFolderName(sesion.tenantId)).toThrow(
        /No se pudo determinar el centro de conciliación/,
      );
    }
  });
});
