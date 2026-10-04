/**
 * Alta y baja del tenant descartable que usa cada suite de `npm run test:db`.
 *
 * Se extrajo de `case-wizard.db.test.ts` cuando apareció la segunda suite que
 * necesitaba exactamente lo mismo. El orden de borrado se deriva de
 * `Prisma.dmmf`, así que agregar una tabla con `tenantId` no obliga a mantener
 * ninguna lista a mano.
 */

import { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAccessToken } from '@/lib/auth';

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Modelos con `tenantId` en el orden en que se pueden borrar sin violar claves
 * foráneas (hijos antes que padres), derivado de Prisma.dmmf.
 */
export function tenantScopedModelsChildrenFirst(): string[] {
  const models = Prisma.dmmf.datamodel.models.filter(
    (m) =>
      m.name !== 'Tenant' &&
      m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar'),
  );
  const names = new Set(models.map((m) => m.name));

  // referencedBy[A] = modelos que dependen de A: se borran antes que A.
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
    // Un ciclo de FK no debería existir; si lo hubiera, se sigue sin bloquear.
    const batch = leaves.length > 0 ? leaves : [...remaining];
    for (const name of batch) {
      order.push(name);
      remaining.delete(name);
    }
  }
  return order.map(lowerFirst);
}

/** Borra todo lo del tenant y luego el tenant. */
export async function purgeTenant(tenantId: string): Promise<void> {
  for (const delegate of tenantScopedModelsChildrenFirst()) {
    await (
      prisma as unknown as Record<
        string,
        { deleteMany: (a: object) => Promise<unknown> }
      >
    )[delegate].deleteMany({ where: { tenantId } });
  }
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export interface TenantDePrueba {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  roleId: string;
  /** JWT firmado como lo emite el login, listo para la cookie mockeada. */
  token: string;
}

/**
 * Crea tenant + rol con permisos + operador, y firma el token de sesión.
 *
 * El operador trae `professionalCard`, `phone` y `address` porque son los que
 * alimentan la firma de los documentos de conciliación y acuerdo de apoyo.
 */
export async function crearTenantDePrueba(
  tag: string,
  permisos: string[] = [P.CREAR_CASOS, P.VER_CASOS, P.EDITAR_CASOS],
): Promise<TenantDePrueba> {
  const tenant = await prisma.tenant.create({
    data: { name: `Prueba ${tag}`, slug: tag },
  });

  const role = await prisma.role.create({
    data: { name: 'Administrador', description: tag, tenantId: tenant.id },
  });
  for (const name of permisos) {
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
      name: 'Liliana Patricia Arango Mejía',
      email: `conciliadora-${tag}@centroejemplo.test`,
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
    permissions: permisos,
    tenantId: tenant.slug,
    tenantName: tenant.name,
    lastLogin: new Date(),
  });

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userId: user.id,
    roleId: role.id,
    token,
  };
}

/**
 * Réplica de la transformación de `handleSubmit` del wizard
 * (`create-case-dialog.tsx`): `data` es la salida de zodResolver. Añade los
 * campos calculados y sincroniza los legados que el wizard siempre envía.
 */
export function wizardSubmit(data: Record<string, unknown>) {
  const d = data as Record<string, unknown> & { debts?: unknown[] };
  const spouseName =
    [
      d.conyugePrimerNombre,
      d.conyugeSegundoNombre,
      d.conyugePrimerApellido,
      d.conyugeSegundoApellido,
    ]
      .filter(Boolean)
      .join(' ') ||
    (d.spouseName as string) ||
    '';

  return {
    ...d,
    creditors: d.debts?.length ?? 0,
    phase: (d.phase as string | null) ?? undefined,
    spouseName,
    spouseIdNumber:
      (d.conyugeIdentificacion as string) || (d.spouseIdNumber as string) || '',
    spouseAddress: (d.spouseAddress as string) || '',
    spousePhone:
      (d.conyugeTelefono as string) || (d.spousePhone as string) || '',
    spouseEmail: (d.conyugeCorreo as string) || (d.spouseEmail as string) || '',
    conyugeNombreCompleto:
      spouseName || (d.conyugeNombreCompleto as string) || '',
    monthlyIncome:
      (d.ingresoPrincipalMensual as number) || (d.monthlyIncome as number) || 0,
    monthlyExpenses:
      (d.totalGastosMensuales as number) || (d.monthlyExpenses as number) || 0,
  };
}
