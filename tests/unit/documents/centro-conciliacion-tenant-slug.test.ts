/**
 * `resolveCenterFolderName` (src/lib/centro-conciliacion.ts) está indexado
 * por el SLUG del centro (`'armonia'` | `'constructores-paz'`), igual que
 * `CENTRO_BY_TENANT`. El bug real — confirmado en `main` desde el commit
 * `0b3c085` (2026-03-04) — nunca estuvo en esta función: está en que sus 7
 * llamadores le pasaban el `tenantId` de `authenticateUser()`, que es el
 * CUID de `Tenant.id`, no el slug. Con un cuid, `CENTRO_BY_TENANT[cuid]`
 * siempre da `undefined` y la función termina lanzando (no hay
 * `centroConciliacionNombre` escribible desde ninguna pantalla que la
 * salve por el fallback).
 *
 * Estos tests fijan el contrato correcto: un TENANT con cuid real y slug
 * conocido resuelve por SU SLUG, y pasarle el cuid (la forma en que fallaba
 * en producción) sigue fallando cerrado, con un error claro — nunca con un
 * default silencioso a la carpeta del otro centro.
 */

import { resolveCenterFolderName } from '@/lib/centro-conciliacion';

/** Formas reales de tenant, una por centro — igual que en producción. */
const TENANTS = [
  { cuid: 'cmg7x9k2f0000qarmoniaabc1', slug: 'armonia', carpeta: 'Armonía' },
  {
    cuid: 'cmg7x9k2f0001qconstruxyz2',
    slug: 'constructores-paz',
    carpeta: 'Constructores de Paz',
  },
] as const;

describe('resolveCenterFolderName — resolución por SLUG, no por cuid', () => {
  it.each(TENANTS)(
    '$slug: resuelve a su propia carpeta por el SLUG',
    ({ slug, carpeta }) => {
      expect(resolveCenterFolderName(slug)).toBe(carpeta);
    },
  );

  it('REGRESIÓN: el cuid real del tenant (lo que pasaban los 7 llamadores) no resuelve ningún centro', () => {
    // Esto es exactamente lo que generateInitialDocuments / batchGenerateDocuments
    // / uploadCaseDocuments / etc. le pasaban antes del fix: el cuid que
    // devuelve authenticateUser().tenantId, no el slug.
    for (const { cuid } of TENANTS) {
      expect(() => resolveCenterFolderName(cuid)).toThrow(
        /No se pudo determinar el centro de conciliación/,
      );
    }
  });

  it('un slug desconocido falla cerrado, con un mensaje claro — no un default a otro centro', () => {
    expect(() => resolveCenterFolderName('centro-que-no-existe')).toThrow(
      /No se pudo determinar el centro de conciliación para el tenant "centro-que-no-existe"/,
    );
  });

  it('un slug desconocido nunca devuelve la carpeta de Armonía ni la de Constructores por accidente', () => {
    try {
      resolveCenterFolderName('centro-que-no-existe');
      throw new Error('Se esperaba que lanzara');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('Armonía');
      expect(message).not.toContain('Constructores de Paz');
    }
  });
});
