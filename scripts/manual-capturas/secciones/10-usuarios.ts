/**
 * Sección 10 — Gestión de usuarios y roles, como la administradora.
 *
 * Figuras (docs/manual-usuario/img/10-usuarios/), Figura 10-N del manual:
 *   01 lista de usuarios (pantalla completa)
 *   02 alta de usuario, diligenciada (se cancela)
 *   03 pestaña "Roles y Permisos"
 *   04 edición de los permisos de un rol (se cancela)
 *
 * Antes de capturar, el "Último acceso" vuelve a los valores del seed (el
 * login de la corrida lo había cambiado a la hora real). Nada se guarda.
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';

const CARPETA = '10-usuarios';
const N = (sufijo: string) => `10-usuarios-${sufijo}`;

export async function seccion10Usuarios(ctx: Contexto): Promise<void> {
  const page = await ctx.paginaComo('admin');
  await ctx.restituirUltimosAccesos();
  await page.goto('/users');
  const filaDiana = page.getByRole('row', {
    name: /Diana Marcela Restrepo Gil/,
  });
  await filaDiana.waitFor();
  await esperarEstable(page);

  // 01 — Lista de usuarios.
  await anotar(page, [
    { objetivo: page.getByRole('tablist'), numero: 1 },
    {
      objetivo: page.getByRole('button', { name: 'Nuevo Usuario' }),
      numero: 2,
      badge: 'izq',
    },
    {
      objetivo: page
        .getByRole('combobox')
        .filter({ hasText: 'Todos los roles' }),
      numero: 3,
      badge: 'arriba-der',
    },
    {
      objetivo: filaDiana.getByRole('cell').last(),
      numero: 4,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('01-lista'));
  await quitarAnotaciones(page);

  // 02 — Alta de usuario diligenciada. Se cancela.
  await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
  let dlg = page.getByRole('dialog');
  await dlg.waitFor();
  await dlg.locator('#name').fill('Camilo Andrés Herrera Pinto');
  await dlg.locator('#email').fill('camilo.herrera@cdp-ejemplo.test');
  await dlg.locator('#phone').fill('3125540871');
  await dlg.locator('#address').fill('Calle 26 # 13-19, Bogotá');
  const rol = dlg.getByRole('combobox');
  await rol.click();
  await page.getByRole('option', { name: 'Asistente Legal' }).click();
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: dlg.locator('#name'),
      numero: 1,
      badge: 'arriba-der',
      holgura: 0,
    },
    { objetivo: dlg.locator('#email'), numero: 2, badge: 'arriba-der' },
    { objetivo: rol, numero: 3, badge: 'arriba-der' },
    {
      objetivo: dlg.getByRole('button', { name: 'Crear Usuario' }),
      numero: 4,
      badge: 'arriba-izq',
    },
  ]);
  await capturar(page, CARPETA, N('02-nuevo-usuario'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await dlg.waitFor({ state: 'hidden' });

  // 03 — Pestaña Roles y Permisos.
  await page.getByRole('tab', { name: 'Roles y Permisos' }).click();
  const tarjetaRol = (nombre: string) =>
    page
      .locator('[data-slot="card"]', {
        has: page.getByText(nombre, { exact: true }),
      })
      .last();
  const operadora = tarjetaRol('Operadora de Insolvencia');
  await operadora.waitFor();
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: page.getByRole('button', { name: 'Nuevo Rol' }),
      numero: 1,
      badge: 'izq',
    },
    { objetivo: operadora, numero: 2 },
    {
      objetivo: operadora.getByRole('button', { name: 'Editar' }),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('03-roles'));
  await quitarAnotaciones(page);

  // 04 — Permisos de un rol, agrupados por módulo. Se cancela.
  await operadora.getByRole('button', { name: 'Editar' }).click();
  dlg = page.getByRole('dialog');
  await dlg.waitFor();
  await dlg.getByText('Permisos del Rol', { exact: true }).waitFor();
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await esperarEstable(page);
  const moduloCasos = dlg
    .getByText('Gestión de Casos', { exact: true })
    .locator(
      // La clase exacta "border" (no "border-b", que es la del encabezado).
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' border ')][1]",
    );
  await anotar(page, [
    { objetivo: dlg.locator('#name'), numero: 1, badge: 'arriba-der' },
    { objetivo: moduloCasos, numero: 2, badge: 'arriba-izq' },
    {
      // Contador del módulo y su casilla para marcarlo entero.
      objetivo: moduloCasos
        .getByText(/^\d+\/\d+$/)
        .first()
        .locator('xpath=..'),
      numero: 3,
      badge: 'izq',
    },
    {
      objetivo: dlg.getByRole('button', { name: 'Guardar Cambios' }),
      numero: 4,
      badge: 'arriba-izq',
    },
  ]);
  await capturar(page, CARPETA, N('04-permisos-rol'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  await page.close();
}
