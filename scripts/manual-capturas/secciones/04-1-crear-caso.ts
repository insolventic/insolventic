/**
 * Sección 4.1 — Crear un caso.
 *
 * Historia: la operadora Diana Marcela Restrepo Gil radica el caso de
 * insolvencia de Jorge Enrique Salazar Peña (datos de `datos.ts`). Al final
 * se muestran las dos pestañas que cambian en un caso de conciliación.
 *
 * Figuras (docs/manual-usuario/img/04-casos/), Figura 4.1-N del manual:
 *   01 menú "Crear nuevo caso"            07 pestaña 3: un acreedor
 *   02 pestaña 1 vacía (orientación)      08 pestaña 5: propuesta calculada
 *   03 error de validación al enviar      09 pestaña 7: documentos y rechazo
 *   04 pestaña 1: deudor y causas         10 el caso nuevo en el listado
 *   05 pestaña 1: ámbito y operador       11 conciliación: 2. Partes
 *   06 pestaña 2: ingresos y gastos       12 conciliación: 3. Solicitud
 *
 * El orden de captura no es el de numeración: 04 y 05 se toman después de
 * cargar los acreedores, para que la deuda total ya aparezca calculada.
 */

import type { Locator, Page } from '@playwright/test';

import {
  anotar,
  capturar,
  desplazarAlInicio,
  esperarEstable,
  mostrarAvisos,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { DEUDOR_EJEMPLO } from '../datos';

const CARPETA = '04-casos';
const N = (sufijo: string) => `04-casos-crear-caso-${sufijo}`;

/** PDF mínimo válido con un texto, para los documentos obligatorios. */
export function pdfSintetico(texto: string): Buffer {
  const contenido = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets)
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** Elige una opción de un Select de Radix. */
async function elegir(
  page: Page,
  disparador: Locator,
  opcion: string | RegExp,
): Promise<void> {
  await disparador.click();
  await page.getByRole('option', { name: opcion }).click();
}

/** El rótulo visible con ese texto exacto (no todos los campos tienen <label for>). */
function rotulo(contenedor: Locator, texto: string): Locator {
  return contenedor.getByText(texto, { exact: true }).first();
}

/** El campo de texto más cercano a un rótulo visible. */
function campo(contenedor: Locator, texto: string): Locator {
  return rotulo(contenedor, texto)
    .locator('xpath=ancestor::div[.//input][1]')
    .locator('input')
    .first();
}

/** Escribe en un campo como lo haría una persona (el MoneyInput formatea al teclear). */
async function escribir(campo: Locator, texto: string): Promise<void> {
  await campo.click();
  await campo.fill('');
  await campo.pressSequentially(texto);
  // Sin foco, para que ningún campo salga con el anillo azul en la figura.
  await campo.blur();
}

async function abrirAlta(
  page: Page,
  tipo: 'Insolvencia' | 'Conciliación',
): Promise<Locator> {
  await page.getByRole('button', { name: /Crear nuevo caso/ }).click();
  await page.getByRole('menuitem', { name: tipo }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.waitFor();
  // Los selectores de deudor y operador se llenan con datos del servidor.
  await page
    .getByRole('combobox')
    .first()
    .getByText('Seleccione un deudor existente')
    .waitFor();
  await esperarEstable(page);
  return dialogo;
}

export async function seccion041CrearCaso(ctx: Contexto): Promise<void> {
  const page = await ctx.paginaComo('operadora');
  await page.goto('/cases');
  await esperarEstable(page);

  // 01 — Menú "Crear nuevo caso". Por texto y no por rol: con el menú abierto,
  // Radix marca el resto de la página como aria-hidden.
  const botonCrear = page.locator('button', { hasText: 'Crear nuevo caso' });
  await botonCrear.click();
  const menu = page.getByRole('menu');
  await menu.waitFor();
  await anotar(page, [
    { objetivo: botonCrear, numero: 1, badge: 'izq' },
    {
      objetivo: menu.getByRole('menuitem', { name: 'Insolvencia' }),
      numero: 2,
      badge: 'izq',
      holgura: -2,
    },
    {
      objetivo: menu.getByRole('menuitem', { name: 'Conciliación' }),
      numero: 3,
      badge: 'izq',
      holgura: -2,
    },
  ]);
  await capturar(page, CARPETA, N('01-menu'), {
    recorte: [botonCrear, menu],
    margen: 44,
  });
  await quitarAnotaciones(page);
  await page.keyboard.press('Escape');

  // 02 — Pestaña 1 vacía: orientación del formulario.
  let dlg = await abrirAlta(page, 'Insolvencia');
  const pestanas = dlg.getByRole('tablist');
  const selectorDeudor = dlg.getByRole('combobox').first();
  await anotar(page, [
    { objetivo: pestanas, numero: 1 },
    { objetivo: selectorDeudor, numero: 2, badge: 'izq' },
    {
      objetivo: dlg.getByTitle('Crear nuevo deudor'),
      numero: 3,
      badge: 'arriba-der',
    },
    {
      objetivo: dlg.getByPlaceholder('Se calcula de los acreedores'),
      numero: 4,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('02-solicitante-vacio'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);

  // 03 — Error de validación: "Crear Caso" sin datos lleva a la pestaña con errores.
  await dlg.getByRole('tab', { name: '7. Documentos' }).click();
  await mostrarAvisos(page, true);
  await dlg.getByRole('button', { name: 'Crear Caso' }).click();
  const errorDeuda = dlg.getByText('La deuda total es requerida');
  await errorDeuda.waitFor();
  const aviso = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Campos incompletos' });
  await aviso.waitFor();
  await anotar(page, [
    { objetivo: dlg.getByRole('tab', { name: /1\. Solicitante/ }), numero: 1 },
    { objetivo: dlg.getByRole('tab', { name: /3\. Acreedores/ }), numero: 2 },
    { objetivo: selectorDeudor, numero: 3, badge: 'izq' },
    { objetivo: errorDeuda, numero: 4, badge: 'izq' },
    { objetivo: aviso, numero: 5 },
  ]);
  await capturar(page, CARPETA, N('03-error-validacion'));
  await quitarAnotaciones(page);
  await page
    .locator('[data-sonner-toast] button[aria-label]')
    .first()
    .click()
    .catch(() => undefined);
  await mostrarAvisos(page, false);

  // 04 — Pestaña 1 diligenciada. Se llena ahora; la figura se toma después de
  // cargar los acreedores, cuando la deuda total ya está calculada.
  await elegir(page, selectorDeudor, new RegExp(DEUDOR_EJEMPLO.nombre));
  await dlg.getByRole('checkbox', { name: 'Disminución de ingresos' }).check();
  await dlg
    .getByRole('checkbox', {
      name: 'Acudí a nuevos créditos para cubrir otros',
    })
    .check();
  await dlg
    .getByRole('radio', { name: 'Persona natural no comerciante' })
    .check();
  const selectorOperador = dlg.getByRole('combobox').nth(1);
  await elegir(page, selectorOperador, /Diana Marcela Restrepo Gil/);

  // 05 — Pestaña 2: ingresos y gastos (alimentan la propuesta de pago).
  await dlg.getByRole('tab', { name: '2. Situación' }).click();
  await escribir(campo(dlg, 'Ocupación'), DEUDOR_EJEMPLO.ocupacion);
  await escribir(
    campo(dlg, 'Ingreso principal mensual'),
    String(DEUDOR_EJEMPLO.ingresoMensual),
  );
  const gastos: Array<[string, number]> = [
    ['Vivienda', 1_300_000],
    ['Alimentación', 900_000],
    ['Servicios públicos', 300_000],
    ['Transporte', 350_000],
    ['Salud', 250_000],
  ];
  for (const [r, valor] of gastos) await escribir(campo(dlg, r), String(valor));
  const ingresos = rotulo(dlg, 'Ingresos mensuales');
  const recursos = rotulo(dlg, 'Recursos disponibles').locator('xpath=..');
  await desplazarAlInicio(ingresos);
  await anotar(page, [
    {
      objetivo: campo(dlg, 'Ingreso principal mensual'),
      numero: 1,
      badge: 'arriba-der',
    },
    {
      objetivo: campo(dlg, 'Total gastos mensuales'),
      numero: 2,
      badge: 'arriba-der',
    },
    { objetivo: recursos, numero: 3, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, N('06-ingresos-gastos'), {
    recorte: [ingresos, recursos],
    anchoDe: dlg,
    margen: 20,
  });
  await quitarAnotaciones(page);

  // 06 — Pestaña 3: acreedores con su deuda.
  await dlg.getByRole('tab', { name: '3. Acreedores' }).click();
  const acreedores = [
    {
      nombre: 'Banco Andino de Fomento S.A.',
      ciudad: 'Bogotá',
      direccion: 'Carrera 7 # 71-52, Bogotá',
      capital: 32_500_000,
      intereses: 4_180_000,
      tasa: '24.5',
      tipo: 'Personal',
      documento: 'Pagaré',
    },
    {
      nombre: 'Almacenes El Trébol S.A.S.',
      ciudad: 'Bogotá',
      direccion: 'Avenida Boyacá # 80-94, Bogotá',
      capital: 7_900_000,
      intereses: 860_000,
      tasa: '28.1',
      tipo: 'Tarjeta de crédito',
      documento: 'Contrato de crédito rotativo',
    },
  ];
  const tipoDeuda = (i: number) =>
    dlg
      .locator(`input[name="debts.${i}.creditClassification"]`)
      .locator('xpath=ancestor::div[.//button[@role="combobox"]][1]')
      .getByRole('combobox');
  for (const [i, a] of acreedores.entries()) {
    await dlg.getByRole('button', { name: 'Agregar Acreedor' }).click();
    await escribir(dlg.locator(`input[name="debts.${i}.creditor"]`), a.nombre);
    await escribir(
      dlg.locator(`input[name="debts.${i}.creditorCity"]`),
      a.ciudad,
    );
    await escribir(
      dlg.locator(`input[name="debts.${i}.creditorAddress"]`),
      a.direccion,
    );
    await escribir(
      dlg.locator(`input[name="debts.${i}.capitalAmount"]`),
      String(a.capital),
    );
    await escribir(
      dlg.locator(`input[name="debts.${i}.interestAmount"]`),
      String(a.intereses),
    );
    await escribir(
      dlg.locator(`input[name="debts.${i}.interestRate"]`),
      a.tasa,
    );
    await elegir(page, tipoDeuda(i), a.tipo);
    await escribir(
      dlg.locator(`input[name="debts.${i}.documentType"]`),
      a.documento,
    );
  }
  const titulo1 = dlg.getByText('Acreedor #1', { exact: true });
  const clase1 = dlg.locator('input[name="debts.0.creditorClass"]');
  await desplazarAlInicio(titulo1, 24);
  await anotar(page, [
    {
      objetivo: dlg.locator('input[name="debts.0.creditor"]'),
      numero: 1,
      badge: 'izq',
    },
    {
      objetivo: dlg.locator('input[name="debts.0.capitalAmount"]'),
      numero: 2,
      badge: 'izq',
    },
    { objetivo: tipoDeuda(0), numero: 3, badge: 'izq' },
    { objetivo: clase1, numero: 4, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, N('07-acreedor'), {
    recorte: [titulo1, dlg.locator('input[name="debts.0.documentType"]')],
    anchoDe: dlg,
    margen: 14,
  });
  await quitarAnotaciones(page);

  // 04 y 05 (captura) — de vuelta en la pestaña 1, con la deuda total ya
  // calculada. No cabe en una vista: deudor y causas, luego ámbito y operador.
  await dlg.getByRole('tab', { name: /1\. Solicitante/ }).click();
  const rotuloDeudor = dlg.getByText('Seleccionar Deudor', { exact: true });
  const fichaDeudor = dlg
    .getByText('Ingresos Mensuales', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  const causas = rotulo(dlg, 'Causas de la Insolvencia').locator('xpath=..');
  await desplazarAlInicio(rotuloDeudor);
  await anotar(page, [
    { objetivo: selectorDeudor, numero: 1, badge: 'izq' },
    { objetivo: fichaDeudor, numero: 2, badge: 'izq' },
    {
      objetivo: dlg.getByPlaceholder('Se calcula de los acreedores'),
      numero: 3,
      badge: 'izq',
    },
    { objetivo: causas, numero: 4, badge: 'izq' },
  ]);
  await capturar(page, CARPETA, N('04-solicitante-deudor'), {
    recorte: [rotuloDeudor, causas],
    anchoDe: dlg,
    margen: 20,
  });
  await quitarAnotaciones(page);

  const tituloAmbito = rotulo(dlg, 'Ámbito de Aplicación');
  const ayudaOperador = dlg.getByText(/Recibe las alertas de audiencia/);
  await desplazarAlInicio(tituloAmbito, 24);
  await anotar(page, [
    { objetivo: dlg.getByRole('radiogroup'), numero: 1, badge: 'arriba-der' },
    { objetivo: selectorOperador, numero: 2, badge: 'izq' },
  ]);
  await capturar(page, CARPETA, N('05-solicitante-datos-caso'), {
    recorte: [tituloAmbito, ayudaOperador],
    anchoDe: dlg,
    margen: 24,
  });
  await quitarAnotaciones(page);

  // 07 — Pestaña 5: propuesta de pago calculada.
  await dlg.getByRole('tab', { name: '5. Propuesta' }).click();
  const resumen = rotulo(dlg, 'Resumen Financiero por Clase');
  const cuota = rotulo(dlg, 'Cuota mensual propuesta').locator('xpath=..');
  const plazo = rotulo(dlg, 'Plazo estimado (meses)').locator('xpath=..');
  const total = rotulo(dlg, 'Total Obligaciones').locator('xpath=..');
  await desplazarAlInicio(resumen, 24);
  await anotar(page, [
    { objetivo: total, numero: 1, badge: 'izq' },
    { objetivo: cuota, numero: 2, badge: 'izq' },
    { objetivo: plazo, numero: 3, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, N('08-propuesta'), {
    recorte: [resumen, plazo],
    anchoDe: dlg,
    margen: 24,
  });
  await quitarAnotaciones(page);

  // 08 — Pestaña 7: documentos, con un rechazo por tamaño.
  await dlg.getByRole('tab', { name: '6. Legal' }).click();
  for (const d of [
    'Veracidad de la información',
    'Buena fe',
    'No ocultamiento de bienes',
  ]) {
    await rotulo(dlg, d)
      .locator(
        'xpath=ancestor::div[.//button[@role="switch" or @role="checkbox"]][1]',
      )
      .locator('button[role="switch"], button[role="checkbox"]')
      .first()
      .click();
  }
  await dlg.getByRole('tab', { name: '7. Documentos' }).click();
  // Cada documento es una fila con borde que conserva su <input type=file>
  // oculto; al cargar un archivo su texto cambia ("… — 1 archivo(s)").
  const fila = (nombre: string) =>
    dlg
      .locator('div.rounded.border')
      .filter({ hasText: nombre })
      .filter({ has: page.locator('input[type=file]') });
  const subir = (nombre: string, archivo: string, buffer: Buffer) =>
    fila(nombre)
      .locator('input[type=file]')
      .setInputFiles({ name: archivo, mimeType: 'application/pdf', buffer });
  await mostrarAvisos(page, true);
  await subir(
    'Cédula de ciudadanía',
    'cedula-jorge-salazar.pdf',
    pdfSintetico('Cedula de ciudadania - ejemplo'),
  );
  await subir(
    'Certificado REDAM',
    'redam-jorge-salazar.pdf',
    pdfSintetico('Certificado REDAM - ejemplo'),
  );
  // Un escaneo de 5,2 MB: se rechaza al elegirlo, con un aviso.
  const pesado = Buffer.concat([
    pdfSintetico('Certificado de ingresos'),
    Buffer.alloc(5_450_000, 0x20),
  ]);
  await subir(
    'Certificado de ingresos',
    'certificado-ingresos-escaneado.pdf',
    pesado,
  );
  const avisoTamano = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'certificado-ingresos-escaneado.pdf' });
  await avisoTamano.waitFor();
  const descripcion = dlg.getByText(/máx\. 4 MB por archivo/);
  await desplazarAlInicio(dlg.getByRole('tablist'), 24);
  await anotar(page, [
    { objetivo: descripcion, numero: 1, badge: 'izq' },
    { objetivo: fila('Cédula de ciudadanía'), numero: 2, badge: 'izq' },
    { objetivo: fila('Certificado de ingresos'), numero: 3, badge: 'izq' },
    { objetivo: avisoTamano, numero: 4 },
  ]);
  await capturar(page, CARPETA, N('09-documentos'));
  await quitarAnotaciones(page);
  await mostrarAvisos(page, false);

  // 09 — Se corrige el archivo, se crea el caso y aparece en el listado.
  await subir(
    'Certificado de ingresos',
    'certificado-ingresos-jorge-salazar.pdf',
    pdfSintetico('Certificado de ingresos - ejemplo'),
  );
  await dlg.getByRole('button', { name: 'Crear Caso' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 60_000 });
  await esperarEstable(page);
  const filaNueva = page.getByRole('row', {
    name: new RegExp(DEUDOR_EJEMPLO.nombre),
  });
  await filaNueva.waitFor();
  // La generación inicial corre en segundo plano y, al fallar (no hay Drive),
  // notifica: se espera para que las secciones siguientes sean estables.
  await ctx.esperarGeneraciones();
  // Lo creado con la hora real (alta del caso, notificaciones, auditoría)
  // pasa a la fecha ancla, para que las secciones siguientes sean estables.
  await ctx.normalizarFechas(20);
  const tabla = page.getByRole('table');
  await anotar(page, [
    { objetivo: filaNueva, numero: 1, badge: 'izq', holgura: 2 },
  ]);
  await capturar(page, CARPETA, N('10-caso-en-listado'), {
    recorte: tabla,
    margen: 16,
  });
  await quitarAnotaciones(page);

  // 11 y 12 — Conciliación: las pestañas que cambian. Contexto: Rosa Elena
  // Quiroga Díaz convoca al arrendador del local que tuvo en arriendo.
  dlg = await abrirAlta(page, 'Conciliación');
  await dlg.getByRole('tab', { name: '2. Partes' }).click();
  await escribir(
    dlg.getByPlaceholder('Nombre del convocado', { exact: true }),
    'Gustavo Adolfo Ríos Mejía',
  );
  await escribir(dlg.getByPlaceholder('Número', { exact: true }), '80442719');
  await escribir(
    dlg.getByPlaceholder('Dirección del convocado', { exact: true }),
    'Carrera 19 # 134-27',
  );
  await escribir(dlg.getByPlaceholder('Ciudad', { exact: true }), 'Bogotá');
  const convocado = rotulo(dlg, 'Convocado (Contraparte)').locator(
    'xpath=ancestor::fieldset[1]',
  );
  await desplazarAlInicio(dlg.getByRole('tablist'), 24);
  await anotar(page, [
    { objetivo: dlg.getByRole('tablist'), numero: 1 },
    { objetivo: convocado, numero: 2 },
    {
      objetivo: dlg.getByText('Apoderado del Convocante (opcional)'),
      numero: 3,
      badge: 'arriba-der',
    },
    {
      objetivo: dlg.getByText('Apoderado del Convocado (opcional)'),
      numero: 4,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('11-conciliacion-partes'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);

  await dlg.getByRole('tab', { name: '3. Solicitud' }).click();
  await escribir(
    dlg.getByPlaceholder(/Ej: Alimentos, Obligaciones civiles/),
    'Obligaciones civiles: cánones de arrendamiento',
  );
  await escribir(campo(dlg, 'Cuantía (pesos)'), '6800000');
  await escribir(
    campo(dlg, 'Cuantía (en letras)'),
    'Seis millones ochocientos mil pesos',
  );
  const grupo = (titulo: string) =>
    rotulo(dlg, titulo).locator('xpath=ancestor::fieldset[1]');
  await desplazarAlInicio(
    dlg.getByRole('heading', { name: 'Crear Nuevo Caso' }),
    48,
  );
  await anotar(page, [
    { objetivo: grupo('Asunto y Cuantía'), numero: 1 },
    { objetivo: grupo('Fechas reales del trámite'), numero: 2 },
    { objetivo: grupo('Audiencia virtual (Zoom)'), numero: 3 },
  ]);
  await capturar(page, CARPETA, N('12-conciliacion-solicitud'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);

  await page.close();
}
