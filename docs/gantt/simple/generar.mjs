// Versión simple del Gantt (25 semanas académicas), con el mismo formato que el
// Gantt original del equipo (docs/diseno/Diagrama de Gantt - Insolventic.png).
// Uso: node docs/gantt/simple/generar.mjs
// Genera Gantt_Insolventic.xlsx y, si encuentra Chrome, también .png y .pdf.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TITULO = 'Diagrama de Gantt - Insolventic';
const SUBTITULO = 'Maximiliano Malavera, Julián Sánchez, José Suárez | 21 de octubre de 2026';
const S1 = '2026-08-03'; // lunes de la semana 1 (semestre 2026-2)
const S18 = '2027-02-01'; // lunes de la semana 18 (semestre 2027-1)
const SEMANA_ACTUAL = 12; // 21 oct 2026
const SEMANAS = 25;

const FASES = [
  { nombre: 'Fase 1 - Análisis de requisitos', color: '4472C4' },
  { nombre: 'Fase 2 - Diseño de arquitectura', color: '70AD47' },
  { nombre: 'Fase 3 - Construcción del aplicativo', color: 'ED7D31' },
  { nombre: 'Fase 4 - Pruebas y validación', color: '7030A0' },
  { nombre: 'Fase 5 - Cierre del proyecto', color: 'C9A100' },
];

// semanas: lista de semanas (1..25) en que se trabaja la tarea.
const r = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TAREAS = [
  [0, 'Documento de requisitos', [2]],
  [0, 'Auditorías del sistema', [4, 6, 11]],
  [0, 'Planificación: backlog y cronograma', [12]],
  [1, 'Modelo de datos y diagramas', [2]],
  [1, 'Diseño de fases, branding y apoderados', [6, 9, 10]],
  [2, 'Seguridad y lógica de negocio', r(4, 6)],
  [2, 'Despliegue y CI/CD', [2, 3, 5, 6, 10, 11]],
  [2, 'Formulario maestro y fases del expediente', r(7, 9)],
  [2, 'Documentos legales y branding por centro', r(8, 11)],
  [2, 'Ajustes de formularios y apoderados', r(11, 12)],
  [2, 'Correcciones de código y requisitos legales', r(13, 15)],
  [3, 'Pruebas automatizadas y de documentos', [7, 9, 10]],
  [3, 'Pruebas de aceptación con los centros', [16]],
  [3, 'Versión 1.0.0 y entrega a los centros', [17]],
  [4, 'Informe de avance (70 %)', r(13, 17)],
  [4, 'Estabilización y mejoras (v1.1)', r(18, 22)],
  [4, 'Documento final', r(18, 24)],
  [4, 'Manuales y actas de aceptación', r(22, 24)],
  [4, 'Sustentación', [25]],
];

const lunes = (n) => {
  const base = n <= 17 ? S1 : S18;
  const k = n <= 17 ? n - 1 : n - 18;
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k * 7);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
// Lo anterior a la semana actual (y la semana actual) es trabajo hecho; lo posterior, planeado.
const hecho = (s) => s <= SEMANA_ACTUAL;
const aclarar = (hex, t = 0.45) => {
  const n = parseInt(hex, 16);
  return [16, 8, 0].map((sh) => Math.round(((n >> sh) & 255) + (255 - ((n >> sh) & 255)) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
};
const NOTA = 'Semanas 1 a 17: semestre 2026-2 (3 ago - 29 nov 2026). Semanas 18 a 25: semestre 2027-1 (1 feb - 28 mar 2027). '
  + 'Color sólido: realizado · color claro: planeado. El prototipo previo (nov 2025 - jul 2026) no se incluye en las 25 semanas.';

// ───────────── Excel ─────────────
async function excel() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Gantt', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  ws.columns = [{ width: 42 }, ...Array.from({ length: SEMANAS }, () => ({ width: 5.2 }))];
  const ultima = SEMANAS + 1;
  const borde = { style: 'thin', color: { argb: 'FF808080' } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  ws.mergeCells(1, 1, 1, ultima);
  ws.getCell(1, 1).value = TITULO;
  ws.getCell(1, 1).font = { name: 'Arial', size: 16, bold: true };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, ultima);
  ws.getCell(2, 1).value = SUBTITULO;
  ws.getCell(2, 1).font = { name: 'Arial', size: 11 };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  // Fila 4: semestres · fila 5: semana · fila 6: fecha del lunes.
  ws.mergeCells(4, 2, 4, 18);
  ws.mergeCells(4, 19, 4, ultima);
  ws.getCell(4, 2).value = 'Semestre 2026-2';
  ws.getCell(4, 19).value = 'Semestre 2027-1';
  ws.mergeCells(4, 1, 6, 1);
  ws.getCell(4, 1).value = 'Tarea / Fase';
  for (let c = 1; c <= ultima; c++) {
    for (const f of [4, 5, 6]) {
      const cell = ws.getCell(f, c);
      cell.font = { name: 'Arial', size: f === 6 ? 7 : 9, bold: f !== 6 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cell.border = bordes;
    }
  }
  for (let s = 1; s <= SEMANAS; s++) {
    ws.getCell(5, s + 1).value = `Sem. ${s}`;
    ws.getCell(6, s + 1).value = lunes(s);
  }
  ws.getCell(5, SEMANA_ACTUAL + 1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC00000' } };
  ws.getRow(5).height = 26;

  let fila = 7;
  FASES.forEach((fase, i) => {
    ws.getCell(fila, 1).value = fase.nombre;
    for (let c = 1; c <= ultima; c++) {
      const cell = ws.getCell(fila, c);
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
      cell.border = bordes;
    }
    fila++;
    for (const [f, nombre, semanas] of TAREAS.filter((t) => t[0] === i)) {
      ws.getCell(fila, 1).value = nombre;
      ws.getCell(fila, 1).alignment = { indent: 1 };
      for (let c = 1; c <= ultima; c++) {
        const cell = ws.getCell(fila, c);
        cell.font = { name: 'Arial', size: 10 };
        cell.border = bordes;
        const s = c - 1;
        if (c > 1 && semanas.includes(s)) {
          const color = hecho(s) ? fase.color : aclarar(fase.color);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
        }
      }
      fila++;
    }
  });
  // Separación entre semestres y marca de la semana actual.
  for (let f = 4; f < fila; f++) {
    const c = ws.getCell(f, 19);
    c.border = { ...c.border, left: { style: 'medium', color: { argb: 'FF000000' } } };
    const h = ws.getCell(f, SEMANA_ACTUAL + 1);
    h.border = { ...h.border, left: { style: 'medium', color: { argb: 'FFC00000' } }, right: { style: 'medium', color: { argb: 'FFC00000' } } };
  }

  fila += 1;
  FASES.forEach((fase, i) => {
    const c = ws.getCell(fila + i, 2);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fase.color}` } };
    c.border = bordes;
    const c2 = ws.getCell(fila + i, 3);
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${aclarar(fase.color)}` } };
    c2.border = bordes;
    ws.getCell(fila + i, 4).value = fase.nombre;
    ws.getCell(fila + i, 4).font = { name: 'Arial', size: 9 };
  });
  ws.getCell(fila, 1).value = 'Convenciones';
  ws.getCell(fila, 1).font = { name: 'Arial', size: 10, bold: true };
  ws.getCell(fila + 1, 1).value = 'Sólido = realizado · claro = planeado';
  ws.getCell(fila + 2, 1).value = `Columna en rojo = semana actual (Sem. ${SEMANA_ACTUAL})`;
  for (const k of [1, 2]) ws.getCell(fila + k, 1).font = { name: 'Arial', size: 9 };
  const notaFila = fila + FASES.length + 1;
  ws.mergeCells(notaFila, 1, notaFila, ultima);
  ws.getCell(notaFila, 1).value = NOTA;
  ws.getCell(notaFila, 1).font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF595959' } };
  ws.getCell(notaFila, 1).alignment = { wrapText: true };
  ws.getRow(notaFila).height = 26;

  await wb.xlsx.writeFile(join(DIR, 'Gantt_Insolventic.xlsx'));
}

// ───────────── HTML plano (solo para producir PNG y PDF) ─────────────
function html() {
  const th = Array.from({ length: SEMANAS }, (_, i) => `<th class="${i + 1 === SEMANA_ACTUAL ? 'hoy' : ''}${i + 1 === 18 ? ' sep' : ''}">Semana<br>#${i + 1}<div class="f">${lunes(i + 1)}</div></th>`).join('');
  const filas = FASES.map((fase, i) => {
    const vacias = Array.from({ length: SEMANAS }, (_, k) => `<td class="${k + 1 === 18 ? 'sep' : ''}${k + 1 === SEMANA_ACTUAL ? ' hoy' : ''}"></td>`).join('');
    const tareas = TAREAS.filter((t) => t[0] === i).map(([, nombre, semanas]) => {
      const celdas = Array.from({ length: SEMANAS }, (_, k) => {
        const s = k + 1;
        const cls = `${s === 18 ? 'sep' : ''}${s === SEMANA_ACTUAL ? ' hoy' : ''}`;
        if (!semanas.includes(s)) return `<td class="${cls}"></td>`;
        return `<td class="${cls}" style="background:#${hecho(s) ? fase.color : aclarar(fase.color)}"></td>`;
      }).join('');
      return `<tr><td class="t">${nombre}</td>${celdas}</tr>`;
    }).join('');
    return `<tr class="fase"><td class="t">${fase.nombre}</td>${vacias}</tr>${tareas}`;
  }).join('');
  const leyenda = FASES.map((f) => `<div class="l"><span style="background:#${f.color}"></span><span style="background:#${aclarar(f.color)}"></span>${f.nombre}</div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${TITULO}</title><style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#000;background:#fff}
h1{text-align:center;font-size:24px;margin:0}
p.sub{text-align:center;font-size:15px;margin:6px 0 14px;border-top:1px solid #ccc;padding-top:6px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #808080;height:24px}
th{background:#f2f2f2;font-size:11px;font-weight:bold;width:34px;padding:2px 0}
th.sem{height:20px}
th .f{font-weight:normal;font-size:9px;color:#444}
td.t{font-size:12px;padding:0 8px;width:300px;white-space:nowrap}
tr.fase td{background:#f7f7f7}tr.fase td.t{font-weight:bold}
tr:not(.fase) td.t{padding-left:18px}
.sep{border-left:2px solid #000}
th.hoy{color:#c00000}
.hoy{border-left:2px solid #c00000;border-right:2px solid #c00000}
.ley{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:16px;font-size:12px}
.l{display:flex;align-items:center;gap:4px}.l span{display:inline-block;width:26px;height:14px;border:1px solid #808080}
.nota{font-size:11px;color:#444;margin-top:10px}
</style></head><body>
<h1>${TITULO}</h1><p class="sub">${SUBTITULO}</p>
<table><thead><tr><th rowspan="2" style="width:300px">Tarea/Fase</th><th colspan="17" class="sem">Semestre 2026-2</th><th colspan="8" class="sem sep">Semestre 2027-1</th></tr><tr>${th}</tr></thead><tbody>${filas}</tbody></table>
<div class="ley">${leyenda}</div>
<p class="nota">${NOTA} Columna en rojo: semana actual (semana ${SEMANA_ACTUAL}, 21 oct 2026).</p>
</body></html>`;
}

async function imagenes() {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (!existsSync(chrome)) {
    console.log('Chrome no encontrado: se omiten PNG y PDF (definir CHROME_PATH).');
    return;
  }
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1500, height: 900, deviceScaleFactor: 2 });
  await p.setContent(html(), { waitUntil: 'load' });
  const alto = await p.evaluate(() => document.body.scrollHeight + 48);
  await p.screenshot({ path: join(DIR, 'Gantt_Insolventic.png'), clip: { x: 0, y: 0, width: 1500, height: alto } });
  await p.pdf({ path: join(DIR, 'Gantt_Insolventic.pdf'), format: 'A4', landscape: true, printBackground: true, scale: 0.68, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
  await b.close();
}

await excel();
await imagenes();
console.log('Listo: docs/gantt/simple/Gantt_Insolventic.{xlsx,png,pdf}');
