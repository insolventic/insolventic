/**
 * Sección 1 — Ingreso al sistema.
 *
 * Figuras (docs/manual-usuario/img/01-ingreso/), Figura 1-N del manual:
 *   01 selector de centro de conciliación (pantalla completa)
 *   02 formulario de inicio de sesión diligenciado
 *   03 mensaje de credenciales inválidas
 *
 * No se usa la contraseña real de la corrida: el formulario solo se envía en
 * la figura 03, y a propósito con una contraseña equivocada.
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { CENTRO } from '../config';

const CARPETA = '01-ingreso';
const N = (sufijo: string) => `01-ingreso-${sufijo}`;

export async function seccion01Ingreso(ctx: Contexto): Promise<void> {
  const page = await ctx.nuevaPagina();

  // 01 — Selector de centro.
  await page.goto('/');
  await esperarEstable(page);
  const tarjeta = page.getByRole('button', { name: new RegExp(CENTRO.nombre) });
  await anotar(page, [{ objetivo: tarjeta, numero: 1, holgura: 6 }]);
  await capturar(page, CARPETA, N('01-selector-centro'));
  await quitarAnotaciones(page);

  // 02 — Formulario de inicio de sesión.
  await tarjeta.click();
  await page.waitForURL(`**/login?db=${CENTRO.slug}`);
  await esperarEstable(page);
  const formulario = page.locator('[data-slot="card"]', {
    has: page.locator('form'),
  });
  const correo = page.locator('input[type="email"]');
  const clave = page.locator('input[type="password"]');
  await correo.fill(ctx.seed.usuarios.operadora.email);
  await clave.fill('contrasena-de-ejemplo');
  await clave.blur();
  await anotar(page, [
    {
      objetivo: page.getByText(`Acceso a la base de datos de ${CENTRO.nombre}`),
      numero: 1,
      badge: 'izq',
      holgura: 1,
    },
    { objetivo: correo, numero: 2, badge: 'izq' },
    { objetivo: clave, numero: 3, badge: 'izq' },
    {
      objetivo: page.getByRole('button', { name: 'Iniciar Sesión' }),
      numero: 4,
      badge: 'izq',
    },
    {
      objetivo: page.getByRole('link', { name: /Olvidó su contraseña/ }),
      numero: 5,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('02-formulario'), {
    recorte: formulario,
    margen: 20,
  });
  await quitarAnotaciones(page);

  // 03 — Credenciales inválidas.
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  const error = page.getByText(/Credenciales inválidas/);
  await error.waitFor();
  await esperarEstable(page);
  await anotar(page, [{ objetivo: error, numero: 1, badge: 'izq' }]);
  await capturar(page, CARPETA, N('03-credenciales-invalidas'), {
    recorte: formulario,
    margen: 20,
  });
  await quitarAnotaciones(page);

  await page.close();
}
