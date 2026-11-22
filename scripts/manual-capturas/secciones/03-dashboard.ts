/**
 * Sección 3 — Dashboard, visto por la Administradora (ve todos los módulos).
 *
 * Figuras (docs/manual-usuario/img/03-dashboard/), Figura 3-N del manual:
 *   01 vista general: barra superior, módulos y panel de notificaciones
 *   02 indicadores y gráficos
 *   03 casos recientes
 *
 * "Casos este Mes", "Audiencias Próximas" y el gráfico de los últimos 6 meses
 * los calcula el servidor con la fecha real: ver README.
 */

import {
  anotar,
  capturar,
  desplazarAlInicio,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';

const CARPETA = '03-dashboard';
const N = (sufijo: string) => `03-dashboard-${sufijo}`;

export async function seccion03Dashboard(ctx: Contexto): Promise<void> {
  const page = await ctx.paginaComo('admin');
  await esperarEstable(page);
  const tarjeta = (titulo: string) =>
    page.locator('[data-slot="card"]', {
      has: page.getByText(titulo, { exact: true }),
    });
  // Los gráficos (Recharts) se cargan aparte y animan al aparecer.
  await tarjeta('Casos por Tipo').last().waitFor();
  await page.waitForTimeout(2500);

  // 01 — Vista general.
  const campana = page
    .locator('button[aria-label="Notificaciones"]')
    .filter({ visible: true })
    .first();
  const modulos = tarjeta('Selector de Tareas');
  await anotar(page, [
    {
      objetivo: page
        .getByText('Buscar...', { exact: true })
        .locator('xpath=..'),
      numero: 1,
    },
    { objetivo: campana, numero: 2, badge: 'izq' },
    { objetivo: modulos, numero: 3 },
    // El panel es la última tarjeta con ese título (antes está la del módulo).
    {
      objetivo: tarjeta('Notificaciones')
        .last()
        .locator('[data-slot="card-header"]'),
      numero: 4,
    },
  ]);
  await capturar(page, CARPETA, N('01-vista-general'));
  await quitarAnotaciones(page);

  // 02 — Indicadores y gráficos.
  const indicadores = tarjeta('Total Casos').locator('xpath=..');
  await desplazarAlInicio(indicadores, 24);
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: indicadores, numero: 1 },
    { objetivo: tarjeta('Casos por Tipo').last(), numero: 2 },
    { objetivo: tarjeta('Casos por Fase').last(), numero: 3 },
  ]);
  await capturar(page, CARPETA, N('02-indicadores'), {
    recorte: [indicadores, tarjeta('Casos por Fase').last()],
    margen: 24,
  });
  await quitarAnotaciones(page);

  // 03 — Casos recientes.
  const recientes = tarjeta('Casos Recientes');
  await desplazarAlInicio(recientes, 24);
  await esperarEstable(page);
  await anotar(page, [{ objetivo: recientes, numero: 1 }]);
  await capturar(page, CARPETA, N('03-casos-recientes'), {
    recorte: recientes,
    margen: 24,
  });
  await quitarAnotaciones(page);

  // 04 — La Secretaria ve menos módulos: el selector depende del rol.
  const secretaria = await ctx.paginaComo('secretaria');
  const selector = secretaria.locator('[data-slot="card"]', {
    has: secretaria.getByText('Selector de Tareas', { exact: true }),
  });
  await selector.waitFor();
  await esperarEstable(secretaria);
  await anotar(secretaria, [{ objetivo: selector, numero: 1 }]);
  await capturar(secretaria, CARPETA, N('04-secretaria'), {
    recorte: selector,
    margen: 24,
  });
  await quitarAnotaciones(secretaria);
  await secretaria.close();

  await page.close();
}
