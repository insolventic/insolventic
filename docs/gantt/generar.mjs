// Genera gantt.html, gantt.md y gantt.xlsx desde datos.mjs.
// Uso: node docs/gantt/generar.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { META, FASES, TAREAS, RIESGOS } from './datos.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ───────────────────────── fechas ─────────────────────────
const d = (s) => new Date(`${s}T00:00:00Z`);
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(d(s).getTime() + n * DAY));
const diffDays = (a, b) => Math.round((d(b) - d(a)) / DAY);
const fmt = (s) => {
  const x = d(s);
  return `${String(x.getUTCDate()).padStart(2, '0')} ${MESES[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
const fmtCorto = (s) => {
  const x = d(s);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
};

// ───────────────────────── columnas ─────────────────────────
// Antecedentes en escala mensual (comprimida); semestres en escala semanal (lunes–domingo);
// el receso entre semestres en una sola columna. Las columnas son contiguas.
function construirColumnas() {
  const cols = [];
  const meses = [
    ['2025-11-03', '2025-11-30'], ['2025-12-01', '2025-12-31'], ['2026-01-01', '2026-01-31'],
    ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-31'], ['2026-04-01', '2026-04-30'],
    ['2026-05-01', '2026-05-31'], ['2026-06-01', '2026-06-30'], ['2026-07-01', '2026-08-02'],
  ];
  for (const [ini, fin] of meses) {
    const x = d(ini);
    cols.push({ seg: 'ant', label: MESES[x.getUTCMonth()], sub: String(x.getUTCFullYear()).slice(2), ini, fin });
  }
  for (let i = 0; i < 17; i++) {
    const ini = addDays(META.inicioAcademico, i * 7);
    cols.push({ seg: 's1', label: `S${i + 1}`, sub: fmtCorto(ini), ini, fin: addDays(ini, 6), semana: i + 1 });
  }
  const finS17 = addDays(META.inicioAcademico, 17 * 7 - 1);
  cols.push({ seg: 'rec', label: 'Rec.', sub: 'dic–ene', ini: addDays(finS17, 1), fin: addDays(META.inicio20271, -1) });
  for (let i = 0; i < 8; i++) {
    const ini = addDays(META.inicio20271, i * 7);
    cols.push({ seg: 's2', label: `S${18 + i}`, sub: fmtCorto(ini), ini, fin: addDays(ini, 6), semana: 18 + i });
  }
  for (let i = 1; i < cols.length; i++) {
    if (addDays(cols[i - 1].fin, 1) !== cols[i].ini) throw new Error(`Columnas no contiguas en ${cols[i].label}`);
  }
  return cols;
}
const COLS = construirColumnas();
const N = COLS.length;
const SEGMENTOS = [
  { seg: 'ant', nombre: 'Antecedentes · escala mensual' },
  { seg: 's1', nombre: 'Semestre 2026-2 · S1–S17 · escala semanal' },
  { seg: 'rec', nombre: 'Rec.' },
  { seg: 's2', nombre: 'Semestre 2027-1 · S18–S25' },
];

const colIndex = (s) => COLS.findIndex((c) => s >= c.ini && s <= c.fin);
// Posición fraccional [0, N] de un instante: inicio del día `s` (o fin del día si `finDeDia`).
function pos(s, finDeDia = false) {
  const i = colIndex(s);
  if (i < 0) throw new Error(`Fecha fuera del rango del Gantt: ${s}`);
  const c = COLS[i];
  const largo = diffDays(c.ini, c.fin) + 1;
  return i + (diffDays(c.ini, s) + (finDeDia ? 1 : 0)) / largo;
}
const etiquetaSemana = (s) => {
  const c = COLS[colIndex(s)];
  if (c.seg === 'ant') return `Ant. ${c.label}-${c.sub}`;
  if (c.seg === 'rec') return 'Receso';
  return c.label;
};

// ───────────────────────── modelo ─────────────────────────
const FASE = Object.fromEntries(FASES.map((f) => [f.id, f]));
const BY_ID = Object.fromEntries(TAREAS.map((t) => [t.id, t]));
for (const t of TAREAS) {
  for (const dep of t.deps) if (!BY_ID[dep]) throw new Error(`${t.id} depende de ${dep}, que no existe`);
  if (t.fin < t.inicio) throw new Error(`${t.id}: fin antes que inicio`);
  t.horas = t.horas ?? Math.round((t.puntos ?? 0) * META.horasPorPunto);
  t.avance = t.tipo === 'hito' ? (t.estado === 'completado' ? 100 : 0) : t.avance;
  t.semanaInicio = etiquetaSemana(t.inicio);
  t.duracionSem = t.tipo === 'hito' ? 0 : Math.ceil((diffDays(t.inicio, t.fin) + 1) / 7);
}
const esTrabajo = (t) => t.tipo === 'tarea';
const ESTADO = { completado: 'Completado', en_progreso: 'En progreso', pendiente: 'Pendiente' };
const BASE = { evidencia: 'Evidencia (repo)', inferido: 'Inferido', estimado: 'Estimado', dato: 'Dato del autor' };

const ordenadas = (fase) => TAREAS.filter((t) => t.fase === fase).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));

function resumen(lista) {
  const trabajo = lista.filter(esTrabajo);
  const horas = trabajo.reduce((a, t) => a + t.horas, 0);
  const hechas = trabajo.reduce((a, t) => a + (t.horas * t.avance) / 100, 0);
  return {
    ini: lista.reduce((a, t) => (t.inicio < a ? t.inicio : a), '9999'),
    fin: lista.reduce((a, t) => (t.fin > a ? t.fin : a), '0000'),
    horas,
    avance: horas ? Math.round((hechas / horas) * 100) : 0,
    tareas: trabajo.length,
  };
}
const RES_FASE = Object.fromEntries(FASES.map((f) => [f.id, resumen(TAREAS.filter((t) => t.fase === f.id))]));
const TOTAL = resumen(TAREAS);
const ACADEMICO = TAREAS.filter((t) => esTrabajo(t) && t.inicio >= META.inicioAcademico);
const RES_ACAD = resumen(ACADEMICO);
const FIN_20262 = addDays(META.inicioAcademico, 17 * 7 - 1);
const horas20262 = ACADEMICO.filter((t) => t.fin <= FIN_20262).reduce((a, t) => a + t.horas, 0);
const PCT_20262 = Math.round((horas20262 / RES_ACAD.horas) * 100);
const HOY_COL = COLS[colIndex(META.hoy)];
const CRITICAS = TAREAS.filter((t) => t.critica).sort((a, b) => a.fin.localeCompare(b.fin) || a.inicio.localeCompare(b.inicio));
const PROXIMO_HITO = TAREAS.filter((t) => t.tipo === 'hito' && t.inicio > META.hoy).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];

// Carga planificada por columna semanal: horas restantes de lo no terminado, repartidas por día.
const CARGA = COLS.map(() => 0);
for (const t of TAREAS.filter((x) => esTrabajo(x) && x.estado !== 'completado')) {
  const restante = (t.horas * (100 - t.avance)) / 100;
  const dias = diffDays(t.inicio, t.fin) + 1;
  for (let k = 0; k < dias; k++) CARGA[colIndex(addDays(t.inicio, k))] += restante / dias;
}

const RUTA_CRITICA = [
  'C12 Apoderado del acreedor (hecho)',
  'C20 Bloqueo del CYG · S14',
  'C22 Conflicto de apoderado en la UI · S15',
  'Q12 UAT en ambos centros · S16',
  'I12 Release 1.0.0 · S17 (29 nov)',
  'D02 Documento final · S18–S24',
  'D05 Sustentación · S25',
];
const RAMAS_CRITICAS = [
  'Q11 Aislamiento entre centros → Q12 UAT',
  'I08 Plan de Vercel → I11 Transferencia de cuentas → I12 Release',
  'I09 Restauración del backup → I12 Release',
  'D01 Informe del 70 % → H11 Corte 2026-2 → D02 Documento final',
  'H10 UAT firmado + H13 v1.1.0 → D04 Actas de aceptación → H15 Sustentación',
];

// ───────────────────────── HTML ─────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COL_W = 28;
const TL_W = COL_W * N;
const LEFT = [
  { k: 'id', w: 46, t: 'ID' },
  { k: 'nombre', w: 330, t: 'Tarea' },
  { k: 'estado', w: 80, t: 'Estado' },
  { k: 'avance', w: 42, t: '%' },
  { k: 'horas', w: 44, t: 'h' },
];
const LEFT_W = LEFT.reduce((a, c) => a + c.w, 0);
const leftOffsets = LEFT.reduce((acc, c, i) => [...acc, i ? acc[i - 1] + LEFT[i - 1].w : 0], []);
const px = (frac) => (frac * COL_W).toFixed(1);

function chipEstado(t) {
  const cls = { completado: 'ok', en_progreso: 'run', pendiente: 'todo' }[t.estado];
  return `<span class="chip ${cls}">${ESTADO[t.estado]}</span>`;
}
function marcaBase(t) {
  if (t.base === 'estimado') return '<span class="tag est">estimado</span>';
  if (t.base === 'inferido') return '<span class="tag inf">inferido</span>';
  if (t.base === 'dato') return '<span class="tag dato">dato</span>';
  return '';
}

function barra(t) {
  const color = FASE[t.fase].color;
  const attrs = `data-id="${t.id}" style="--c:${color};`;
  if (t.tipo === 'hito') {
    const x = px(pos(t.inicio, true) - 0.5 / (diffDays(COLS[colIndex(t.inicio)].ini, COLS[colIndex(t.inicio)].fin) + 1));
    const cls = ['ms', t.estado === 'completado' ? 'done' : 'todo', t.critica ? 'crit' : ''].join(' ');
    return `<div class="${cls}" ${attrs}left:${x}px"></div>`;
  }
  const x0 = pos(t.inicio);
  const x1 = pos(t.fin, true);
  const w = Math.max((x1 - x0) * COL_W, 4);
  const cls = ['bar', t.tipo === 'buffer' ? 'buffer' : t.estado, t.critica ? 'crit' : ''].join(' ');
  return `<div class="${cls}" ${attrs}left:${px(x0)}px;width:${w.toFixed(1)}px;--p:${t.avance}%"></div>`;
}

function filaTarea(t) {
  const clases = ['row', `st-${t.estado}`, t.critica ? 'is-crit' : '', t.tipo === 'hito' ? 'is-hito' : ''].join(' ');
  return `<tr class="${clases}" data-id="${t.id}">
<td class="c-id sticky" style="left:${leftOffsets[0]}px">${t.id}</td>
<td class="c-nombre sticky" style="left:${leftOffsets[1]}px">${t.tipo === 'hito' ? '◆ ' : ''}${esc(t.nombre)} ${marcaBase(t)}${t.tipo === 'buffer' ? '<span class="tag buf">buffer</span>' : ''}${t.critica ? '<span class="tag crit">crítica</span>' : ''}</td>
<td class="c-estado sticky" style="left:${leftOffsets[2]}px">${chipEstado(t)}</td>
<td class="c-num sticky" style="left:${leftOffsets[3]}px">${t.tipo === 'hito' ? '' : `${t.avance}%`}</td>
<td class="c-num sticky" style="left:${leftOffsets[4]}px">${esTrabajo(t) || t.tipo === 'buffer' ? t.horas : ''}</td>
<td class="tl"><div class="track">${barra(t)}</div></td>
</tr>`;
}

function filaFase(f) {
  const r = RES_FASE[f.id];
  const etiqueta = f.id === 'H' ? '' : `${fmt(r.ini)} → ${fmt(r.fin)} · ${r.horas} h · ${r.avance}%`;
  let resumenBarra = '';
  if (f.id !== 'H') {
    const x0 = pos(r.ini);
    const x1 = pos(r.fin, true);
    resumenBarra = `<div class="phasebar" style="--c:${f.color};left:${px(x0)}px;width:${((x1 - x0) * COL_W).toFixed(1)}px;--p:${r.avance}%"></div>`;
  }
  const nota = f.id === 'F0'
    ? `<div class="gapnote" style="left:${px(pos('2026-05-01'))}px;width:${(2 * COL_W).toFixed(0)}px">pausa may–jun</div>`
    : '';
  return `<tr class="phase" style="--c:${f.color}">
<td colspan="${LEFT.length}" class="sticky phase-name" style="left:0"><span class="dot"></span>${esc(f.nombre)}<span class="phase-meta">${etiqueta}</span></td>
<td class="tl"><div class="track">${resumenBarra}${nota}</div></td>
</tr>`;
}

function cabecera() {
  const segs = SEGMENTOS.map((s) => {
    const n = COLS.filter((c) => c.seg === s.seg).length;
    return `<div class="seg seg-${s.seg}" style="width:${n * COL_W}px">${esc(s.nombre)}</div>`;
  }).join('');
  const cols = COLS.map((c) => {
    const hoy = c === HOY_COL ? ' is-hoy' : '';
    return `<div class="col col-${c.seg}${hoy}" style="width:${COL_W}px" title="${fmt(c.ini)} – ${fmt(c.fin)}"><b>${c.label}</b><span>${c.sub}</span></div>`;
  }).join('');
  const hoyX = px(pos(META.hoy, true) - 0.5 / 7);
  const leftHead = LEFT.map((c, i) => `<th class="sticky lh" style="left:${leftOffsets[i]}px;width:${c.w}px">${c.t}</th>`).join('');
  return `<thead>
<tr class="h1"><th class="sticky lh" colspan="${LEFT.length}" style="left:0"></th><th class="tl"><div class="segs">${segs}</div></th></tr>
<tr class="h2">${leftHead}<th class="tl"><div class="cols">${cols}<div class="hoy-label" style="left:${hoyX}px">HOY ${fmtCorto(META.hoy)}</div></div></th></tr>
</thead>`;
}

function pie() {
  const celdas = COLS.map((c, i) => {
    if (c.seg === 'ant' || c.seg === 'rec' || CARGA[i] < 0.5) return `<div class="load" style="width:${COL_W}px"></div>`;
    const h = Math.round(CARGA[i]);
    const nivel = h > 20 ? 'hi' : h > 17 ? 'mid' : 'lo';
    return `<div class="load ${nivel}" style="width:${COL_W}px" title="${c.label}: ${h} h planificadas">${h}</div>`;
  }).join('');
  return `<tfoot><tr class="foot"><td colspan="${LEFT.length}" class="sticky foot-name" style="left:0">Carga planificada restante (h/semana, sin buffers)</td><td class="tl"><div class="loads">${celdas}</div></td></tr></tfoot>`;
}

function overlay() {
  const partes = [];
  COLS.forEach((c, i) => {
    const borde = i > 0 && COLS[i - 1].seg !== c.seg ? ' segline' : '';
    partes.push(`<div class="vl${borde}" style="left:${LEFT_W + i * COL_W}px"></div>`);
  });
  const region = (seg, cls) => {
    const idx = COLS.map((c, i) => (c.seg === seg ? i : -1)).filter((i) => i >= 0);
    return `<div class="region ${cls}" style="left:${LEFT_W + idx[0] * COL_W}px;width:${idx.length * COL_W}px"></div>`;
  };
  partes.push(region('ant', 'r-ant'), region('rec', 'r-rec'));
  return `<div class="overlay">${partes.join('')}</div>
<div class="overlay top"><div class="hoy" style="left:${(LEFT_W + pos(META.hoy, true) * COL_W - (0.5 / 7) * COL_W).toFixed(1)}px"></div></div>`;
}

function leyenda() {
  const fases = FASES.filter((f) => f.id !== 'H')
    .map((f) => `<span class="lg"><i class="sw" style="background:${f.color}"></i>${esc(f.nombre)}</span>`).join('');
  return `<div class="legend">
<div class="lg-row"><b>Fases</b>${fases}</div>
<div class="lg-row"><b>Estado</b>
<span class="lg"><i class="swb completado" style="--c:#475569"></i>Completado (evidencia git)</span>
<span class="lg"><i class="swb en_progreso" style="--c:#475569;--p:60%"></i>En progreso</span>
<span class="lg"><i class="swb pendiente" style="--c:#475569"></i>Pendiente (estimado)</span>
<span class="lg"><i class="swb buffer"></i>Buffer / contingencia</span>
<span class="lg"><i class="swb completado crit" style="--c:#475569"></i>Ruta crítica</span>
<span class="lg"><i class="swm"></i>Hito</span>
<span class="lg"><i class="swhoy"></i>HOY (${fmt(META.hoy)})</span>
</div></div>`;
}

function tablaDetalle() {
  const filas = FASES.filter((f) => f.id !== 'H').flatMap((f) => ordenadas(f.id)).concat(ordenadas('H'))
    .map((t) => `<tr class="${t.critica ? 'is-crit' : ''}">
<td>${t.id}</td><td><i class="sw" style="background:${FASE[t.fase].color}"></i>${esc(FASE[t.fase].nombre)}</td>
<td>${esc(t.nombre)}${t.critica ? ' <span class="tag crit">crítica</span>' : ''}</td>
<td>${fmt(t.inicio)}</td><td>${t.tipo === 'hito' ? '—' : fmt(t.fin)}</td><td>${t.semanaInicio}</td>
<td class="n">${t.tipo === 'hito' ? 'hito' : `${t.duracionSem} sem`}</td><td>${t.deps.join(', ') || '—'}</td>
<td>${chipEstado(t)}</td><td class="n">${t.tipo === 'hito' ? '' : `${t.avance}%`}</td><td class="n">${t.tipo === 'hito' ? '' : t.horas}</td>
<td>${BASE[t.base]}</td><td class="src">${esc(t.fuente)}${t.jira.length ? `<br><span class="muted">Jira: ${t.jira.join(', ')}</span>` : ''}</td></tr>`).join('');
  return `<table class="detail"><thead><tr><th>ID</th><th>Fase</th><th>Tarea</th><th>Inicio</th><th>Fin</th><th>Sem. inicio</th><th>Duración</th><th>Depende de</th><th>Estado</th><th>%</th><th>Horas</th><th>Base</th><th>Fuente</th></tr></thead><tbody>${filas}</tbody></table>`;
}

function tablaFases() {
  return `<table class="detail compact"><thead><tr><th>Fase</th><th>Inicio</th><th>Fin</th><th>Tareas</th><th>Horas</th><th>Avance</th></tr></thead><tbody>${FASES.filter((f) => f.id !== 'H').map((f) => {
    const r = RES_FASE[f.id];
    return `<tr><td><i class="sw" style="background:${f.color}"></i>${esc(f.nombre)}</td><td>${fmt(r.ini)}</td><td>${fmt(r.fin)}</td><td class="n">${r.tareas}</td><td class="n">${r.horas}</td><td><div class="pbar"><div style="width:${r.avance}%;background:${f.color}"></div></div> ${r.avance}%</td></tr>`;
  }).join('')}</tbody></table>`;
}

function tablaRiesgos() {
  return `<table class="detail"><thead><tr><th>ID</th><th>Riesgo</th><th>Prob.</th><th>Impacto</th><th>Impacto en el cronograma</th><th>Mitigación</th><th>Fuente</th></tr></thead><tbody>${RIESGOS.map((r) => `<tr><td>${r.id}</td><td>${esc(r.riesgo)}</td><td><span class="lvl ${r.prob.toLowerCase()}">${r.prob}</span></td><td><span class="lvl ${r.impacto.toLowerCase().replace(' ', '-')}">${r.impacto}</span></td><td>${esc(r.cronograma)}</td><td>${esc(r.mitigacion)}</td><td class="src">${esc(r.fuente)}</td></tr>`).join('')}</tbody></table>`;
}

function html() {
  const datosJs = Object.fromEntries(TAREAS.map((t) => [t.id, {
    id: t.id, nombre: t.nombre, fase: FASE[t.fase].nombre, color: FASE[t.fase].color, tipo: t.tipo,
    inicio: fmt(t.inicio), fin: fmt(t.fin), semana: t.semanaInicio, duracion: t.duracionSem,
    deps: t.deps.map((x) => `${x} ${BY_ID[x].nombre}`), estado: ESTADO[t.estado], avance: t.avance,
    horas: t.horas, base: BASE[t.base], fuente: t.fuente, jira: t.jira, critica: t.critica,
  }]));
  const dependientes = Object.fromEntries(TAREAS.map((t) => [t.id, TAREAS.filter((x) => x.deps.includes(t.id)).map((x) => x.id)]));
  const cuerpo = FASES.map((f) => filaFase(f) + ordenadas(f.id).map(filaTarea).join('')).join('');
  const chartW = LEFT_W + TL_W;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gantt INSOLVENTIC</title>
<meta name="description" content="Diagrama de Gantt del proyecto de grado INSOLVENTIC, generado desde docs/gantt/datos.mjs con corte al ${fmt(META.hoy)}.">
<style>
:root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--grid:#eef2f7;--bg:#f8fafc;--card:#ffffff;--today:#dc2626;--crit:#dc2626}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,sans-serif}
.page{padding:24px 16px 48px;max-width:${chartW + 40}px;margin:0 auto}
h1{font-size:22px;margin:0 0 2px;letter-spacing:-.01em}
h2{font-size:16px;margin:32px 0 10px}
.sub{color:var(--muted);margin:0 0 4px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:16px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.kpi .k{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.kpi .v{font-size:18px;font-weight:650;margin-top:2px}
.kpi .s{font-size:12px;color:var(--muted)}
.pbar{display:inline-block;vertical-align:middle;width:90px;height:7px;background:#e5e7eb;border-radius:4px;overflow:hidden}
.pbar>div{height:100%}
.kpi .pbar{width:100%;margin-top:6px}
.legend{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:10px}
.lg-row{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;padding:3px 0}
.lg-row b{width:54px;font-size:11px;text-transform:uppercase;color:var(--muted)}
.lg{display:inline-flex;align-items:center;gap:6px;font-size:12px}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.lg .sw{margin:0}
.swb{display:inline-block;width:30px;height:12px;border-radius:3px;position:relative}
.swm{display:inline-block;width:10px;height:10px;background:#111827;transform:rotate(45deg)}
.swhoy{display:inline-block;width:2px;height:14px;background:var(--today)}
.toolbar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:0 0 8px;font-size:12px;color:var(--muted)}
.toolbar label{display:inline-flex;gap:5px;align-items:center;cursor:pointer}
.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:8px}
.chart{position:relative;width:${chartW}px}
table.g{position:relative;z-index:1;border-collapse:separate;border-spacing:0;table-layout:fixed;width:${chartW}px}
table.g td,table.g th{padding:0;border-bottom:1px solid var(--grid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
table.g td.tl,table.g th.tl{width:${TL_W}px;background:transparent}
.sticky{position:sticky;z-index:3;background:var(--card)}
th.lh{font-size:11px;text-align:left;padding:0 6px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;background:#f1f5f9}
thead th{background:#f1f5f9!important;border-bottom:1px solid var(--line)!important}
.h1 th{height:22px}.h2 th{height:32px}
.segs,.cols,.loads{display:flex;position:relative}
.seg{font-size:11px;font-weight:600;text-align:center;line-height:22px;color:#334155;border-left:1px solid #cbd5e1;overflow:hidden;white-space:nowrap}
.seg-ant{background:#e2e8f0}.seg-s1{background:#dbeafe}.seg-rec{background:#f1f5f9;color:var(--muted)}.seg-s2{background:#fce7f3}
.col{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;line-height:1.15;border-left:1px solid var(--line);height:32px}
.col b{font-size:10.5px}.col span{color:var(--muted);font-size:9px}
.col-ant b{text-transform:capitalize;color:#475569}
.col.is-hoy{background:#fee2e2}
.hoy-label{position:absolute;top:-21px;transform:translateX(-50%);background:var(--today);color:#fff;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap}
td.c-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--muted);padding-left:8px!important}
td.c-nombre{padding:0 6px!important;font-size:12.5px}
td.c-estado{padding:0 4px!important}
td.c-num{text-align:right;padding-right:8px!important;font-variant-numeric:tabular-nums;font-size:12px}
.track{position:relative;height:24px}
tr.row:hover td{background-color:#f8fafc}
tr.row:hover td.tl{background:rgba(15,23,42,.035)}
tr.hl td.sticky{background:#fef9c3}
tr.hl td.tl{background:rgba(250,204,21,.18)}
tr.phase td{background:color-mix(in srgb,var(--c) 9%,transparent);border-top:1px solid color-mix(in srgb,var(--c) 30%,transparent);height:26px}
tr.phase td.sticky{background:color-mix(in srgb,var(--c) 9%,#fff)}
.phase-name{font-weight:650;padding:0 8px!important;font-size:12.5px}
.phase-name .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c);margin-right:7px}
.phase-meta{font-weight:400;color:var(--muted);font-size:11.5px;margin-left:10px}
.phasebar{position:absolute;top:10px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--c) 25%,transparent);overflow:hidden}
.phasebar::after{content:"";position:absolute;inset:0;width:var(--p);background:var(--c)}
.gapnote{position:absolute;top:4px;z-index:3;font-size:8.5px;color:#475569;font-style:italic;text-align:center;white-space:nowrap;line-height:16px;background:#fff;border:1px solid var(--line);border-radius:3px}
.chip{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:10px}
.chip.ok{background:#dcfce7;color:#166534}.chip.run{background:#dbeafe;color:#1e40af}.chip.todo{background:#f1f5f9;color:#475569}
.tag{display:inline-block;font-size:9.5px;padding:0 5px;border-radius:3px;margin-left:4px;vertical-align:1px;font-weight:600}
.tag.est{background:#fef3c7;color:#92400e}.tag.inf{background:#ede9fe;color:#5b21b6}.tag.dato{background:#e0f2fe;color:#075985}
.tag.buf{background:#f1f5f9;color:#475569}.tag.crit{background:#fee2e2;color:#b91c1c}
.bar,.swb{border-radius:3px}
.bar{position:absolute;top:6px;height:12px;cursor:pointer;z-index:2}
.completado{background:var(--c)}
.en_progreso{background:linear-gradient(90deg,var(--c) 0 var(--p),transparent var(--p)),repeating-linear-gradient(45deg,color-mix(in srgb,var(--c) 45%,#fff) 0 3px,color-mix(in srgb,var(--c) 18%,#fff) 3px 6px);box-shadow:inset 0 0 0 1px var(--c)}
.pendiente{background:color-mix(in srgb,var(--c) 30%,#fff);box-shadow:inset 0 0 0 1.5px var(--c);background-image:repeating-linear-gradient(90deg,transparent 0 5px,rgba(255,255,255,.55) 5px 7px)}
.buffer{background:repeating-linear-gradient(45deg,#94a3b8 0 2px,#f1f5f9 2px 6px);box-shadow:inset 0 0 0 1px #94a3b8}
.crit{outline:2px solid var(--crit);outline-offset:1px}
.ms{position:absolute;top:6px;width:12px;height:12px;margin-left:-6px;transform:rotate(45deg);background:var(--c);z-index:2;cursor:pointer}
.ms.todo{background:#fff;box-shadow:inset 0 0 0 2px var(--c)}
.ms.crit{outline:none;box-shadow:inset 0 0 0 2px var(--crit),0 0 0 2px #fff;background:#fecaca}
.overlay{position:absolute;inset:0;z-index:0;pointer-events:none}
.overlay.top{z-index:4}
.vl{position:absolute;top:54px;bottom:0;width:1px;background:var(--grid)}
.vl.segline{background:#94a3b8;width:1.5px}
.region{position:absolute;top:54px;bottom:0}
.r-ant{background:rgba(100,116,139,.06)}
.r-rec{background:repeating-linear-gradient(135deg,rgba(148,163,184,.16) 0 4px,transparent 4px 9px)}
.hoy{position:absolute;top:54px;bottom:0;width:2px;background:var(--today);opacity:.85}
tfoot td{height:24px;border-top:1px solid var(--line)}
.foot-name{font-size:11px;color:var(--muted);padding:0 8px!important}
.load{font-size:10px;text-align:center;line-height:24px;font-variant-numeric:tabular-nums}
.load.lo{background:#ecfdf5;color:#047857}.load.mid{background:#fef3c7;color:#92400e}.load.hi{background:#fee2e2;color:#b91c1c;font-weight:700}
.hide{display:none}
#tip{position:fixed;z-index:50;max-width:380px;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.45;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none}
#tip h4{margin:0 0 6px;font-size:13px;color:#fff}
#tip .r{display:flex;gap:8px}#tip .r span:first-child{color:#94a3b8;min-width:92px}
#tip .sw{width:10px;height:10px}
table.detail{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);font-size:12px}
table.detail th{background:#f1f5f9;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#475569;padding:6px 8px;border-bottom:1px solid var(--line)}
table.detail td{padding:5px 8px;border-bottom:1px solid var(--grid);vertical-align:top}
table.detail td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
table.detail td.src{font-size:11px;color:#334155;max-width:360px}
table.detail tr.is-crit td:first-child{box-shadow:inset 3px 0 0 var(--crit)}
table.compact{width:auto;min-width:640px}
.muted{color:var(--muted)}
.lvl{font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px;white-space:nowrap}
.lvl.alta,.lvl.muy-alto,.lvl.alto{background:#fee2e2;color:#b91c1c}.lvl.media,.lvl.medio{background:#fef3c7;color:#92400e}.lvl.baja,.lvl.bajo{background:#ecfdf5;color:#047857}
.cp{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.cp ol{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cp li{background:#fee2e2;color:#7f1d1d;border-radius:4px;padding:3px 8px;font-size:12px}
.cp li+li::before{content:"→";color:var(--crit);margin:0 8px 0 -4px;font-weight:700}
.cp ul{margin:8px 0 0 18px;padding:0}
.notes{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 16px}
.notes li{margin:4px 0}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;background:#f1f5f9;padding:0 4px;border-radius:3px}
@media (max-width:700px){.page{padding:16px}h1{font-size:19px}}
@page{size:A4 landscape;margin:7mm}
@media print{
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 body{background:#fff;font-size:11px}
 .page{padding:0;max-width:none}
 .noprint,#tip{display:none!important}
 .scroll{overflow:visible;border:none;border-radius:0}
 .chart{zoom:.70}
 .sticky{position:static}
 tr{break-inside:avoid}
 .kpis{grid-template-columns:repeat(6,1fr)}
 .print-break{break-before:page}
 table.detail{font-size:10px}
}
</style>
</head>
<body>
<div class="page">
<header>
<h1>${esc(META.proyecto)} — ${esc(META.titulo)}</h1>
<p class="sub">${esc(META.subtitulo)}</p>
<p class="sub">${esc(META.equipo)} · Corte: <b>${fmt(META.hoy)}</b> (${HOY_COL.label}) · Generado desde <code>docs/gantt/datos.mjs</code></p>
</header>
<div class="kpis">
<div class="kpi"><div class="k">Periodo académico</div><div class="v">25 semanas</div><div class="s">${fmt(META.inicioAcademico)} → ${fmt(addDays(META.inicio20271, 8 * 7 - 1))}<br>17 en 2026-2 + 8 en 2027-1</div></div>
<div class="kpi"><div class="k">Antecedentes</div><div class="v">nov 2025 – jul 2026</div><div class="s">Trabajo previo con fechas reales, fuera de las 25 semanas</div></div>
<div class="kpi"><div class="k">Avance total (esfuerzo)</div><div class="v">${TOTAL.avance}%</div><div class="pbar"><div style="width:${TOTAL.avance}%;background:#059669"></div></div><div class="s">${TOTAL.horas} h equivalentes, ${TOTAL.tareas} tareas</div></div>
<div class="kpi"><div class="k">Avance del periodo académico</div><div class="v">${RES_ACAD.avance}%</div><div class="pbar"><div style="width:${RES_ACAD.avance}%;background:#2563eb"></div></div><div class="s">S1–S25 · ${RES_ACAD.horas} h</div></div>
<div class="kpi"><div class="k">Corte 2026-2 (29 nov)</div><div class="v">${PCT_20262}% esfuerzo</div><div class="s">17/25 semanas = 68 % del calendario · meta académica 70 %</div></div>
<div class="kpi"><div class="k">Próximo hito</div><div class="v">${esc(PROXIMO_HITO.nombre)}</div><div class="s">${fmt(PROXIMO_HITO.inicio)} · ${PROXIMO_HITO.semanaInicio} (${esc(BASE[PROXIMO_HITO.base].toLowerCase())})</div></div>
</div>
${leyenda()}
<div class="toolbar noprint">
<label><input type="checkbox" data-f="st-completado" checked> Completadas</label>
<label><input type="checkbox" data-f="st-en_progreso" checked> En progreso</label>
<label><input type="checkbox" data-f="st-pendiente" checked> Pendientes</label>
<label><input type="checkbox" id="solo-crit"> Solo ruta crítica e hitos</label>
<span>· Pasa el cursor por una barra para ver el detalle; se resaltan sus dependencias (amarillo).</span>
</div>
<div class="scroll"><div class="chart">
${overlay()}
<table class="g"><colgroup>${LEFT.map((c) => `<col style="width:${c.w}px">`).join('')}<col style="width:${TL_W}px"></colgroup>${cabecera()}<tbody>${cuerpo}</tbody>${pie()}</table>
</div></div>

<h2>Ruta crítica (de hoy a la sustentación)</h2>
<div class="cp"><ol>${RUTA_CRITICA.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
<ul>${RAMAS_CRITICAS.map((x) => `<li>Rama que converge: ${esc(x)}</li>`).join('')}
<li>Fuera de la ruta crítica, a propósito: Q07, Q09, Q10 y C21 (legal-pendiente; si la respuesta no llega pasan a v1.1, ver R1) y C24 (Should, primer ítem en moverse si falta capacidad, ver R2).</li></ul></div>

<h2>Resumen por fase</h2>
${tablaFases()}

<h2 class="print-break">Riesgos y su impacto en el cronograma</h2>
${tablaRiesgos()}

<h2 class="print-break">Tabla de tareas</h2>
${tablaDetalle()}

<h2>Notas de método</h2>
<div class="notes"><ul>
<li><b>Pasado = evidencia, futuro = estimación.</b> Cada tarea completada cita commit, PR o documento del repo. Las pendientes salen del plan Jira (<code>docs/jira/PROCESO_SCRUM.md</code> §5.5, escenario bajo de 16 pts/semana) o se marcan <span class="tag est">estimado</span>.</li>
<li><b>Horas</b> = puntos Jira × ${META.horasPorPunto} h (16 pts ≈ 17,5 h/semana, dentro de ${esc(META.dedicacion)}). En lo completado es <b>esfuerzo equivalente retroactivo</b>, no horas medidas. Las semanas S9 (W40) y S11 (W42) fueron sesiones intensivas con IA y Jira las excluye de la velocidad (§5.1), así que ese esfuerzo está inflado frente a una semana normal.</li>
<li><b>Fechas académicas</b> (S1 = ${fmt(META.inicioAcademico)}, S18 = ${fmt(META.inicio20271)}): las da el autor. El receso entre semestres no cuenta dentro de las 25 semanas.</li>
<li><b>Antecedentes</b>: trabajo anterior al semestre 2026-2, con sus fechas reales de git. La fase de análisis y diseño inicial (A01) tiene fechas <span class="tag inf">inferido</span>: el Gantt original del equipo no trae fechas de calendario. En mayo y junio de 2026 no hay commits.</li>
<li>Los documentos <code>IMPLEMENTACION_SEMANA_N.md</code> <b>no</b> son semanas de calendario (las 4 a 15 ocurrieron entre el 17 y el 19 de octubre). Aquí solo se usan como evidencia.</li>
<li>El historial de git no se modifica: este cronograma se ajusta al repositorio, no al revés.</li>
<li>Para regenerar: editar <code>docs/gantt/datos.mjs</code> y correr <code>node docs/gantt/generar.mjs</code>.</li>
</ul></div>
</div>
<div id="tip"></div>
<script>
const T=${JSON.stringify(datosJs)};
const DEPEND=${JSON.stringify(dependientes)};
const tip=document.getElementById('tip');
const filas=[...document.querySelectorAll('tr.row')];
const porId=Object.fromEntries(filas.map(r=>[r.dataset.id,r]));
function e(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mostrar(id,ev){const t=T[id];if(!t)return;
 const fila=(k,v)=>v===''||v==null?'':'<div class="r"><span>'+k+'</span><span>'+v+'</span></div>';
 tip.innerHTML='<h4><i class="sw" style="background:'+t.color+'"></i>'+e(t.id+' · '+t.nombre)+'</h4>'+
  fila('Fase',e(t.fase))+fila('Fechas',t.tipo==='hito'?e(t.inicio):e(t.inicio+' → '+t.fin))+fila('Semana inicio',e(t.semana))+
  (t.tipo==='hito'?'':fila('Duración',t.duracion+' sem'))+fila('Estado',e(t.estado)+(t.tipo==='hito'?'':' · '+t.avance+'%'))+
  (t.tipo==='hito'?'':fila('Horas',t.horas+' h'))+fila('Depende de',t.deps.length?t.deps.map(e).join('<br>'):'—')+
  fila('Base',e(t.base))+fila('Fuente',e(t.fuente))+(t.jira.length?fila('Jira',e(t.jira.join(', '))):'')+
  (t.critica?fila('Ruta crítica','sí'):'');
 tip.style.display='block';mover(ev);
 filas.forEach(r=>r.classList.remove('hl'));
 [...t.deps.map(x=>x.split(' ')[0]),...(DEPEND[id]||[])].forEach(x=>porId[x]&&porId[x].classList.add('hl'));}
function mover(ev){const w=tip.offsetWidth,h=tip.offsetHeight;let x=ev.clientX+14,y=ev.clientY+14;
 if(x+w>innerWidth-8)x=ev.clientX-w-14;if(y+h>innerHeight-8)y=ev.clientY-h-14;tip.style.left=x+'px';tip.style.top=y+'px';}
document.querySelectorAll('.bar,.ms').forEach(b=>{b.addEventListener('mouseenter',ev=>mostrar(b.dataset.id,ev));b.addEventListener('mousemove',mover);
 b.addEventListener('mouseleave',()=>{tip.style.display='none';filas.forEach(r=>r.classList.remove('hl'));});});
function filtrar(){const on=[...document.querySelectorAll('[data-f]')].filter(c=>c.checked).map(c=>c.dataset.f);
 const crit=document.getElementById('solo-crit').checked;
 filas.forEach(r=>{const st=on.some(f=>r.classList.contains(f));const c=!crit||r.classList.contains('is-crit')||r.classList.contains('is-hito');r.classList.toggle('hide',!(st&&c));});}
document.querySelectorAll('.toolbar input').forEach(i=>i.addEventListener('change',filtrar));
</script>
</body>
</html>
`;
}

// ───────────────────────── Markdown + Mermaid ─────────────────────────
function markdown() {
  const limpio = (s) => s.replace(/[:;#,]/g, '').replace(/\s+/g, ' ').trim();
  const lineas = [];
  for (const f of FASES) {
    lineas.push(`    section ${limpio(f.id === 'H' ? 'Hitos' : `${f.id} ${f.nombre}`)}`);
    for (const t of ordenadas(f.id)) {
      const tags = [];
      if (t.critica) tags.push('crit');
      if (t.estado === 'completado') tags.push('done');
      if (t.estado === 'en_progreso') tags.push('active');
      if (t.tipo === 'hito') tags.push('milestone');
      const id = t.id.toLowerCase();
      const rango = t.tipo === 'hito' ? `${t.inicio}, 0d` : `${t.inicio}, ${addDays(t.fin, 1)}`;
      lineas.push(`    ${limpio(`${t.id} ${t.nombre}`)} :${[...tags, id].join(', ')}, ${rango}`);
    }
    if (f.id === 'H') lineas.push(`    HOY corte ${fmt(META.hoy)} :crit, milestone, hoy, ${META.hoy}, 0d`);
  }
  const tabla = (cab, filas) => [`| ${cab.join(' | ')} |`, `| ${cab.map(() => '---').join(' | ')} |`, ...filas.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const pipe = (s) => String(s).replace(/\|/g, '\\|');

  const fases = tabla(['Fase', 'Inicio', 'Fin', 'Tareas', 'Horas', 'Avance'], FASES.filter((f) => f.id !== 'H').map((f) => {
    const r = RES_FASE[f.id];
    return [f.nombre, fmt(r.ini), fmt(r.fin), r.tareas, r.horas, `${r.avance}%`];
  }));
  const hitos = tabla(['ID', 'Hito', 'Fecha', 'Semana', 'Estado', 'Base', 'Fuente'], ordenadas('H').map((t) => [t.id, `${t.critica ? '**' : ''}${t.nombre}${t.critica ? '**' : ''}`, fmt(t.inicio), t.semanaInicio, ESTADO[t.estado], BASE[t.base], pipe(t.fuente)]));
  const riesgos = tabla(['ID', 'Riesgo', 'Prob.', 'Impacto', 'Impacto en el cronograma', 'Mitigación'], RIESGOS.map((r) => [r.id, pipe(r.riesgo), r.prob, r.impacto, pipe(r.cronograma), pipe(r.mitigacion)]));
  const semanas = tabla(['Semana', 'Lunes', 'Domingo', 'Semestre', 'ISO'], COLS.filter((c) => c.semana).map((c) => {
    const x = d(c.ini);
    const jueves = new Date(x.getTime() + 3 * DAY);
    const w1 = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
    const isoW = 1 + Math.round(((jueves - w1) / DAY - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
    return [c.label + (c === HOY_COL ? ' ← HOY' : ''), fmt(c.ini), fmt(c.fin), c.seg === 's1' ? '2026-2' : '2027-1', `${jueves.getUTCFullYear()}-W${String(isoW).padStart(2, '0')}`];
  }));
  const tareas = tabla(['ID', 'Fase', 'Tarea', 'Sem. inicio', 'Duración', 'Depende de', 'Estado', '%', 'Horas', 'Base', 'Fuente'],
    FASES.filter((f) => f.id !== 'H').flatMap((f) => ordenadas(f.id)).map((t) => [t.id, FASE[t.fase].nombre, `${t.nombre}${t.critica ? ' ⚑' : ''}`, t.semanaInicio, `${t.duracionSem} sem`, t.deps.join(', ') || '—', ESTADO[t.estado], `${t.avance}%`, t.horas, BASE[t.base], pipe(t.fuente)]));

  return `# INSOLVENTIC — Diagrama de Gantt del proyecto de grado

> Generado por \`node docs/gantt/generar.mjs\` desde \`docs/gantt/datos.mjs\`; no editar a mano.
> Corte: **${fmt(META.hoy)} (${HOY_COL.label})**. Versión visual completa: [\`gantt.html\`](gantt.html) · hoja de cálculo: [\`gantt.xlsx\`](gantt.xlsx).

- **Periodo académico:** 25 semanas — S1–S17 en 2026-2 (${fmt(META.inicioAcademico)} → ${fmt(FIN_20262)}) y S18–S25 en 2027-1 (${fmt(META.inicio20271)} → ${fmt(addDays(META.inicio20271, 55))}). El receso no cuenta.
- **Antecedentes:** nov 2025 – jul 2026, con fechas reales del repositorio, fuera de las 25 semanas.
- **Avance:** ${TOTAL.avance} % del esfuerzo total · ${RES_ACAD.avance} % del periodo académico. Al corte de 2026-2 (29 nov) quedaría hecho el **${PCT_20262} % del esfuerzo** del periodo académico (17/25 semanas = 68 % del calendario).
- **Pasado = evidencia** (commit, PR o documento citado). **Futuro = estimado** (plan Jira, escenario bajo de 16 pts/semana, o estimación propia). Horas = puntos × ${META.horasPorPunto}; en lo completado son esfuerzo equivalente retroactivo, no horas medidas.

\`\`\`mermaid
gantt
    title INSOLVENTIC — Proyecto de grado (corte ${fmt(META.hoy)})
    dateFormat YYYY-MM-DD
    axisFormat %b %y
    todayMarker off
${lineas.join('\n')}
\`\`\`

> En Mermaid el eje es lineal: los antecedentes (9 meses) ocupan más ancho que en el HTML, que los comprime en escala mensual. La línea de HOY es el hito \`hoy\` (fecha de corte), no la fecha en que se renderiza el diagrama.

## Fases

${fases}

## Hitos

${hitos}

## Ruta crítica

${RUTA_CRITICA.join(' → ')}

Ramas que convergen en ella:

${RAMAS_CRITICAS.map((x) => `- ${x}`).join('\n')}

Fuera de la ruta crítica, a propósito: Q07, Q09, Q10 y C21 (legal-pendiente: si la respuesta no llega pasan a v1.1, ver R1) y C24 (Should, primer ítem en moverse si falta capacidad, ver R2).

## Buffers

- **Q13** — correcciones post-UAT en S17 (los 4 pts libres del sprint W48 ≈ 5 h).
- **B01** — contingencia del release, 30 nov – 11 dic, en el receso. Solo se usa si el release se desliza (R2, R3, R4).
- **D06** — buffer de cierre en S25, para las correcciones del jurado.

## Riesgos

${riesgos}

## Semanas académicas

${semanas}

## Tareas

⚑ = ruta crítica.

${tareas}
`;
}

// ───────────────────────── XLSX ─────────────────────────
const mezcla = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * (1 - t)));
  return `FF${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
const argb = (hex) => `FF${hex.slice(1).toUpperCase()}`;

async function xlsx() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'docs/gantt/generar.mjs';
  wb.created = d(META.hoy);

  const ws = wb.addWorksheet('Gantt', { views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const izq = [
    ['ID', 6], ['Fase', 20], ['Tarea', 44], ['Inicio', 11], ['Fin', 11], ['Sem. inicio', 11], ['Dur. (sem)', 8],
    ['Depende de', 14], ['Estado', 12], ['% avance', 8], ['Horas', 7], ['Base', 14],
  ];
  const c0 = izq.length + 1;
  ws.columns = [...izq.map(([, w]) => ({ width: w })), ...COLS.map(() => ({ width: 4.2 })), { width: 70 }];
  const colFuente = c0 + N;

  // Fila 1: segmentos; fila 2: etiqueta de columna; fila 3: fecha.
  ws.getCell(1, 1).value = `INSOLVENTIC — Gantt del proyecto de grado · corte ${fmt(META.hoy)}`;
  ws.getCell(1, 1).font = { bold: true, size: 12 };
  for (const s of SEGMENTOS) {
    const idx = COLS.map((c, i) => (c.seg === s.seg ? i : -1)).filter((i) => i >= 0);
    const a = c0 + idx[0];
    const b = c0 + idx[idx.length - 1];
    if (b > a) ws.mergeCells(1, a, 1, b);
    const cell = ws.getCell(1, a);
    cell.value = s.seg === 'rec' ? 'Rec.' : s.nombre;
    cell.alignment = { horizontal: 'center' };
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: { ant: 'FFE2E8F0', s1: 'FFDBEAFE', rec: 'FFF1F5F9', s2: 'FFFCE7F3' }[s.seg] } };
  }
  izq.forEach(([t], i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = t;
  });
  ws.getCell(3, colFuente).value = 'Fuente';
  COLS.forEach((c, i) => {
    const top = ws.getCell(2, c0 + i);
    const bot = ws.getCell(3, c0 + i);
    top.value = c === HOY_COL ? `${c.label}·HOY` : c.label;
    bot.value = c.seg === 'rec' ? 'dic–ene' : c.seg === 'ant' ? c.sub : fmtCorto(c.ini);
    for (const cell of [top, bot]) {
      cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: c === HOY_COL ? 90 : 0 };
      cell.font = { size: 8, bold: cell === top, color: { argb: c === HOY_COL ? 'FFDC2626' : 'FF334155' } };
      if (c === HOY_COL) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }
  });
  ws.getRow(2).height = 28;
  for (let col = 1; col <= colFuente; col++) {
    const cell = ws.getCell(3, col);
    cell.font = { ...(cell.font || {}), bold: true, size: col < c0 ? 9 : 8 };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF94A3B8' } } };
    if (col < c0 || col === colFuente) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  let r = 4;
  const hoyIdx = COLS.indexOf(HOY_COL);
  for (const f of FASES) {
    const res = RES_FASE[f.id];
    const fila = ws.getRow(r);
    fila.getCell(1).value = f.id;
    fila.getCell(2).value = f.nombre;
    fila.getCell(3).value = f.id === 'H' ? 'Hitos clave' : `${f.nombre} — ${res.horas} h · ${res.avance}%`;
    for (let col = 1; col <= colFuente; col++) {
      const cell = fila.getCell(col);
      cell.font = { bold: true, color: { argb: argb(f.color) } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mezcla(f.color, 0.12) } };
    }
    r++;
    for (const t of ordenadas(f.id)) {
      const row = ws.getRow(r);
      const vals = [t.id, FASE[t.fase].nombre, t.nombre, d(t.inicio), d(t.fin), t.semanaInicio, t.duracionSem, t.deps.join(', '), ESTADO[t.estado], t.avance / 100, t.horas, BASE[t.base]];
      vals.forEach((v, i) => { row.getCell(i + 1).value = v; });
      row.getCell(4).numFmt = 'dd/mm/yyyy';
      row.getCell(5).numFmt = 'dd/mm/yyyy';
      row.getCell(10).numFmt = '0%';
      row.getCell(colFuente).value = t.fuente + (t.jira.length ? ` · Jira: ${t.jira.join(', ')}` : '');
      row.getCell(colFuente).font = { size: 9, color: { argb: 'FF475569' } };
      if (t.critica) row.getCell(3).font = { bold: true, color: { argb: 'FFB91C1C' } };
      if (t.base === 'estimado') row.getCell(12).font = { italic: true, color: { argb: 'FF92400E' } };

      const i0 = colIndex(t.inicio);
      const i1 = colIndex(t.fin);
      for (let i = i0; i <= i1; i++) {
        const cell = row.getCell(c0 + i);
        if (t.tipo === 'hito') {
          cell.value = '◆';
          cell.alignment = { horizontal: 'center' };
          cell.font = { bold: true, color: { argb: t.critica ? 'FFDC2626' : 'FF111827' } };
          continue;
        }
        let fill;
        if (t.tipo === 'buffer') fill = { type: 'pattern', pattern: 'lightUp', fgColor: { argb: 'FF94A3B8' }, bgColor: { argb: 'FFF1F5F9' } };
        else if (t.estado === 'completado') fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(FASE[t.fase].color) } };
        else if (t.estado === 'en_progreso') fill = { type: 'pattern', pattern: 'darkUp', fgColor: { argb: argb(FASE[t.fase].color) }, bgColor: { argb: mezcla(FASE[t.fase].color, 0.35) } };
        else fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mezcla(FASE[t.fase].color, 0.3) } };
        cell.fill = fill;
        if (t.critica) cell.border = { top: { style: 'medium', color: { argb: 'FFDC2626' } }, bottom: { style: 'medium', color: { argb: 'FFDC2626' } } };
      }
      r++;
    }
  }
  // Línea de HOY sobre la columna de la semana actual.
  for (let row = 2; row < r; row++) {
    const cell = ws.getCell(row, c0 + hoyIdx);
    cell.border = { ...(cell.border || {}), left: { style: 'medium', color: { argb: 'FFDC2626' } } };
  }
  // Carga planificada.
  r++;
  ws.getCell(r, 3).value = 'Carga planificada restante (h/semana, sin buffers)';
  ws.getCell(r, 3).font = { italic: true, color: { argb: 'FF64748B' } };
  COLS.forEach((c, i) => {
    if (c.seg === 'ant' || c.seg === 'rec' || CARGA[i] < 0.5) return;
    const cell = ws.getCell(r, c0 + i);
    const h = Math.round(CARGA[i]);
    cell.value = h;
    cell.alignment = { horizontal: 'center' };
    cell.font = { size: 8, bold: h > 20 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h > 20 ? 'FFFEE2E2' : h > 17 ? 'FFFEF3C7' : 'FFECFDF5' } };
  });
  r += 2;
  const leyenda = [
    ['Completado (evidencia git)', { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }],
    ['En progreso', { type: 'pattern', pattern: 'darkUp', fgColor: { argb: 'FF475569' }, bgColor: { argb: 'FFCBD5E1' } }],
    ['Pendiente (estimado)', { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } }],
    ['Buffer / contingencia', { type: 'pattern', pattern: 'lightUp', fgColor: { argb: 'FF94A3B8' }, bgColor: { argb: 'FFF1F5F9' } }],
  ];
  ws.getCell(r, 3).value = 'Leyenda';
  ws.getCell(r, 3).font = { bold: true };
  leyenda.forEach(([txt, fill], i) => {
    ws.getCell(r + 1 + i, c0).fill = fill;
    ws.getCell(r + 1 + i, 3).value = txt;
  });
  ws.getCell(r + 5, 3).value = 'Borde rojo = ruta crítica · ◆ = hito · línea roja vertical = HOY';

  const hoja = (nombre, cab, filas, anchos) => {
    const s = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    s.columns = cab.map((h, i) => ({ header: h, width: anchos[i] }));
    s.getRow(1).font = { bold: true };
    s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    filas.forEach((f) => s.addRow(f).alignment = { wrapText: true, vertical: 'top' });
    return s;
  };
  hoja('Fases', ['Fase', 'Inicio', 'Fin', 'Tareas', 'Horas', 'Avance'], FASES.filter((f) => f.id !== 'H').map((f) => {
    const x = RES_FASE[f.id];
    return [f.nombre, fmt(x.ini), fmt(x.fin), x.tareas, x.horas, `${x.avance}%`];
  }), [34, 14, 14, 8, 8, 8]);
  hoja('Hitos', ['ID', 'Hito', 'Fecha', 'Semana', 'Estado', 'Base', 'Crítico', 'Fuente'], ordenadas('H').map((t) => [t.id, t.nombre, fmt(t.inicio), t.semanaInicio, ESTADO[t.estado], BASE[t.base], t.critica ? 'sí' : '', t.fuente]), [6, 44, 14, 10, 12, 16, 8, 70]);
  hoja('Riesgos', ['ID', 'Riesgo', 'Prob.', 'Impacto', 'Impacto en el cronograma', 'Mitigación', 'Fuente'], RIESGOS.map((x) => [x.id, x.riesgo, x.prob, x.impacto, x.cronograma, x.mitigacion, x.fuente]), [6, 50, 8, 10, 50, 50, 30]);
  hoja('Semanas', ['Columna', 'Desde', 'Hasta', 'Segmento'], COLS.map((c) => [c.seg === 'ant' ? `${c.label}-${c.sub}` : c.label, fmt(c.ini), fmt(c.fin), { ant: 'Antecedentes', s1: '2026-2', rec: 'Receso', s2: '2027-1' }[c.seg]]), [12, 14, 14, 14]);

  await wb.xlsx.writeFile(join(DIR, 'gantt.xlsx'));
}

writeFileSync(join(DIR, 'gantt.html'), html());
writeFileSync(join(DIR, 'gantt.md'), markdown());
await xlsx();
console.log(`Gantt generado: ${TAREAS.length} filas (${TAREAS.filter(esTrabajo).length} tareas), ${N} columnas.`);
console.log(`Avance total ${TOTAL.avance}% · periodo académico ${RES_ACAD.avance}% · corte 2026-2 = ${PCT_20262}% del esfuerzo académico.`);
console.log(`Carga S13–S17: ${COLS.filter((c) => c.semana >= 13 && c.semana <= 17).map((c) => `${c.label}=${Math.round(CARGA[COLS.indexOf(c)])}h`).join(' ')}`);
