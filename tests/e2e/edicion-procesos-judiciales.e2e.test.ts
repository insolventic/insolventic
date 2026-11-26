/**
 * E2E: editar el juzgado de origen de un proceso judicial ya guardado y verlo
 * en la Solicitud de Insolvencia generada.
 *
 * Edita el segundo proceso del caso del seed INS-2025-001 (centro armonia)
 * desde "Editar caso", guarda, reabre para comprobar que persistió, y genera
 * la Solicitud con el mismo pipeline de la app (datos desde la base →
 * placeholders → plantilla). La generación se hace en el test y no desde la
 * pantalla: la de la pantalla sube a Google Drive, que en local y en CI no
 * está configurado.
 *
 * Modifica el juzgado de origen de ese proceso en la base de la corrida (en CI,
 * la descartable con seed).
 */

import fs from 'fs';

import { test, expect, type Page } from '@playwright/test';

import prisma from '@/lib/prisma';
import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  asCaseWithRelations,
  fetchCaseForGeneration,
} from '@/features/document/persistence';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

import { loginAs } from './helpers';

const CASO = 'INS-2025-001';
const ORIGEN = `Juzgado E2E de origen ${Date.now().toString(36)}`;

async function abrirEdicion(page: Page) {
  await page.goto('/cases');
  // La tabla pagina de a 20 y otros E2E crean casos: se filtra por número.
  await page.getByPlaceholder('Buscar por nombre, ID o cédula...').fill(CASO);
  const editar = page
    .locator('tr', { hasText: CASO })
    .first()
    .getByTitle('Editar caso');
  await expect(editar).toBeEnabled({ timeout: 20_000 });
  await editar.click();
  const dialogo = page.getByRole('dialog', { name: `Editar Caso ${CASO}` });
  await expect(dialogo).toBeVisible({ timeout: 15_000 });
  await dialogo.getByRole('tab', { name: '2. Situación' }).click();
  // El caso carga después de abrir: esperar a que aparezcan sus procesos.
  const origen = dialogo.locator('input[name="legalProcesses.1.originCourt"]');
  await expect(origen).toBeVisible({ timeout: 15_000 });
  return { dialogo, origen };
}

test.describe('Edición de procesos judiciales', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('editar el juzgado de origen y verlo en la Solicitud generada', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    let { dialogo, origen } = await abrirEdicion(page);
    await origen.fill(ORIGEN);
    await dialogo.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.getByText(/Caso actualizado/).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(dialogo).toBeHidden();

    // Reabrir: el valor persistió.
    ({ dialogo, origen } = await abrirEdicion(page));
    await expect(origen).toHaveValue(ORIGEN);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();

    // La Solicitud generada desde la base lo muestra junto al juzgado actual.
    const fila = await prisma.case.findFirstOrThrow({
      where: { caseNumber: CASO, tenant: { slug: 'armonia' } },
      select: { id: true, tenantId: true },
    });
    const datos = asCaseWithRelations(
      (await fetchCaseForGeneration(fila.id, fila.tenantId))!,
    );
    const plantilla = ALL_TEMPLATES.find(
      (t) => t.id === 'solicitud-insolvencia',
    )!;
    const { html } = renderDocumentHtml(
      fs.readFileSync(getTemplatePath(plantilla), 'utf8'),
      mapCaseToPlaceholders(datos),
      buildTemplateContext(datos),
    );
    expect(html).toContain(`(juzgado de origen: ${ORIGEN})`);
  });
});
