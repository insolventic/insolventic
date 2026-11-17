/**
 * Sección 1 — Ingreso al sistema.
 *
 * Figuras (docs/manual-usuario/img/01-ingreso/), Figura 1-N del manual:
 *   01 selector de centro de conciliación (pantalla completa)
 *   02 formulario de inicio de sesión diligenciado
 *   03 mensaje de credenciales inválidas
 *   04 contraseña pendiente de cambio (usuario con mustChangePassword)
 *   05 formulario de recuperación de contraseña (no se envía)
 *
 * El formulario de ingreso se envía en la figura 03 con una contraseña
 * equivocada, y en la 04 con la de prueba de la corrida (la cuenta tiene el
 * cambio de contraseña pendiente y la app no deja entrar).
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

  // 04 — Cuenta que aún no fijó su contraseña (la asistente, sembrada así):
  // el login la rechaza con un mensaje. Contraseña de prueba de la corrida.
  await correo.fill(ctx.seed.usuarios.asistente.email);
  await clave.fill(ctx.seed.password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  const aviso = page.getByText(/Debe establecer una nueva contraseña/);
  await aviso.waitFor();
  await clave.blur();
  await esperarEstable(page);
  await anotar(page, [{ objetivo: aviso, numero: 1, badge: 'izq' }]);
  await capturar(page, CARPETA, N('04-contrasena-pendiente'), {
    recorte: formulario,
    margen: 20,
  });
  await quitarAnotaciones(page);

  // 05 — Recuperar contraseña: formulario.
  await page.getByRole('link', { name: /Olvidó su contraseña/ }).click();
  await page.waitForURL('**/forgot-password**');
  const recuperar = page.locator('[data-slot="card"]', {
    has: page.locator('form'),
  });
  await recuperar.waitFor();
  const correoRecuperar = recuperar.locator('#email');
  await correoRecuperar.fill(ctx.seed.usuarios.asistente.email);
  await correoRecuperar.blur();
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: correoRecuperar, numero: 1, badge: 'izq' },
    {
      objetivo: recuperar.locator('button[type="submit"]'),
      numero: 2,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('05-recuperar-contrasena'), {
    recorte: recuperar,
    margen: 20,
  });
  await quitarAnotaciones(page);
  // No se envía: sin SMTP la acción responde con error y la pantalla de
  // "correo enviado" no aparece (ver README).

  await page.close();
}
