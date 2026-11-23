// Genera BACKLOG.md, jira-import.csv y los bloques AUTO de PROCESO_SCRUM.md
// a partir de la fuente única docs/jira/data/*.json, y valida la consistencia.
// Uso: node docs/jira/generar.mjs [--parcial]
//   --parcial: durante la escritura incremental, las referencias a ítems que
//   todavía no existen y la cobertura de hallazgos son avisos, no errores.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const DATA = join(DIR, 'data');
const PARCIAL = process.argv.includes('--parcial');

const meta = JSON.parse(readFileSync(join(DATA, 'meta.json'), 'utf8'));
const epicFiles = readdirSync(DATA).filter((f) => /^E\d\d\.json$/.test(f)).sort();
const epics = epicFiles.map((f) => JSON.parse(readFileSync(join(DATA, f), 'utf8')));

const errores = [];
const avisos = [];
const err = (m) => errores.push(m);
const warn = (m) => avisos.push(m);

const TIPOS = ['Story', 'Bug', 'Task', 'Sub-task'];
const ESTADOS = ['To Do', 'In Progress', 'In Review', 'Done'];
const PRIORIDADES = ['Crítica', 'Alta', 'Media', 'Baja'];
// El JSON y BACKLOG.md conservan la escala del audit; el CSV emite los nombres de prioridad de Jira.
const PRIORIDAD_JIRA = { Crítica: 'Highest', Alta: 'High', Media: 'Medium', Baja: 'Low' };
const MOSCOW = ['Must', 'Should', 'Could', "Won't"];
const COMPONENTES = ['Frontend', 'Backend', 'Base-de-Datos', 'Infra-CI/CD', 'Documentos-PDF', 'Testing'];
const LABELS_BASE = ['nfr', 'feature', 'bug-regresion', 'inferido', 'legal-pendiente', 'seguridad', 'spike'];
const labelValido = (l) => LABELS_BASE.includes(l) || /^doc-semana-\d+$/.test(l);

// Hallazgos de AUDITORIA_INTEGRAL_PRE_LAUNCH.md (31). Numeración por sección y
// severidad, la misma que usan IMPLEMENTACION_SEMANA_3/4/7 (GC-A1, GD-M4, G-A1...).
const AUDIT_31 = [
  'GC-C1', 'GC-C2', 'GC-A1', 'GC-A2', 'GC-A3', 'GC-A4', 'GC-M1', 'GC-M2', 'GC-M3', 'GC-M4', 'GC-M5', 'GC-M6', 'GC-B1', 'GC-B2',
  'GD-C1', 'GD-C2', 'GD-A1', 'GD-A2', 'GD-A3', 'GD-A4', 'GD-M1', 'GD-M2', 'GD-M3', 'GD-M4', 'GD-M5', 'GD-B1', 'GD-B2',
  'G-A1', 'G-M1', 'G-M2', 'G-B1',
];
// AUDITORIA_PREPRODUCCION_2026-08-25.md (25): prefijo PP- para no chocar con los IDs C-1/C-2 de otras auditorías.
const AUDIT_PP = [
  'PP-C-1', 'PP-C-2', 'PP-A-1', 'PP-A-2', 'PP-A-3', 'PP-A-4', 'PP-A-5', 'PP-A-6', 'PP-A-7', 'PP-A-8',
  'PP-M-1', 'PP-M-2', 'PP-M-3', 'PP-M-4', 'PP-M-5', 'PP-M-6', 'PP-M-7', 'PP-M-8', 'PP-M-9', 'PP-M-10',
  'PP-B-1', 'PP-B-2', 'PP-B-3', 'PP-B-4', 'PP-B-5',
];

const sprintById = Object.fromEntries(meta.sprints.map((s) => [s.id, s]));
const versionById = Object.fromEntries(meta.versiones.map((v) => [v.id, v]));
const sprintNombre = (id) => (id ? `INS ${id}` : '');

// ---------- Aplanado ----------
const todos = []; // epics + items + subtareas, en el orden de import
const porId = new Map();
const add = (x) => {
  if (porId.has(x.id)) err(`ID duplicado: ${x.id}`);
  porId.set(x.id, x);
  todos.push(x);
};
for (const e of epics) add({ ...e.epica, tipo: 'Epic', _epic: e.epica.id });
const items = [];
for (const e of epics) {
  for (const it of e.items) {
    const x = { ...it, padre: e.epica.id, _epic: e.epica.id };
    items.push(x);
  }
}
for (const x of items) add(x);
const subtareas = [];
for (const x of items) {
  for (const s of x.subtareas || []) {
    const st = {
      id: s.id, tipo: 'Sub-task', titulo: s.titulo, descripcion: s.descripcion, padre: x.id, _epic: x._epic,
      prioridad: x.prioridad, labels: [], componentes: s.componentes || x.componentes, sprint: x.sprint,
      estado: x.estado, resuelto: x.resuelto, version: x.version, evidencia: s.evidencia || x.evidencia,
    };
    subtareas.push(st);
  }
}
for (const s of subtareas) add(s);

// IDs numéricos para el CSV (Issue ID / Parent): épicas, luego ítems, luego subtareas.
todos.forEach((x, i) => (x._num = 1000 + i + 1));

// ---------- Validación ----------
const gherkin = (t) => /\bDado\b/i.test(t) && /\bCuando\b/i.test(t) && /\bEntonces\b/i.test(t);
const enRango = (d, s) => d >= s.inicio && d <= s.fin;

for (const e of epics) {
  const ep = e.epica;
  if (!/^E\d\d$/.test(ep.id)) err(`Épica con id inválido: ${ep.id}`);
  if (!ep.titulo || !ep.descripcion) err(`${ep.id}: épica sin título o descripción`);
  if (!ep.evidencia?.length) err(`${ep.id}: épica sin evidencia`);
  if (!e.items.length) err(`${ep.id}: épica sin hijos`);
  // Una épica cerrada no tiene fecha propia: su Resolved se deriva de la fecha del último hijo cerrado,
  // y el JSON lo declara en resueltoDerivado para que quede explícito y se detecte si deja de cuadrar.
  const cerrada = e.items.length && e.items.every((x) => x.estado === 'Done');
  const fechas = e.items.filter((x) => x.estado === 'Done' && x.resuelto).map((x) => x.resuelto).sort();
  const max = fechas.at(-1) || '';
  const rd = ep.resueltoDerivado;
  if (!cerrada && rd) err(`${ep.id}: resueltoDerivado en una épica que no está cerrada`);
  if (cerrada) {
    if (!rd) err(`${ep.id}: épica cerrada sin resueltoDerivado`);
    else if ((rd.fecha || '') !== max) err(`${ep.id}: resueltoDerivado.fecha ${rd.fecha || '(vacía)'} ≠ último hijo cerrado ${max || '(ninguno)'}`);
    else {
      const desde = e.items.filter((x) => x.resuelto === max).map((x) => x.id);
      if (max && JSON.stringify(rd.desde || []) !== JSON.stringify(desde)) err(`${ep.id}: resueltoDerivado.desde debería ser ${desde.join(', ')}`);
    }
    if (!max) warn(`${ep.id}: épica cerrada sin ningún hijo con fecha; Resolved queda vacío`);
    porId.get(ep.id)._resuelto = max;
  }
}

const titulos = new Map();
for (const x of [...items, ...subtareas]) {
  const id = x.id;
  if (!TIPOS.includes(x.tipo)) err(`${id}: tipo inválido ${x.tipo}`);
  if (!x.titulo) err(`${id}: sin título`);
  const k = (x.titulo || '').toLowerCase().trim();
  if (titulos.has(k)) err(`${id}: título duplicado con ${titulos.get(k)}`);
  titulos.set(k, id);
  if (!x.evidencia?.length) err(`${id}: sin evidencia`);
  if (!ESTADOS.includes(x.estado)) err(`${id}: estado inválido ${x.estado}`);
  if (!PRIORIDADES.includes(x.prioridad)) err(`${id}: prioridad inválida ${x.prioridad}`);
  for (const l of x.labels || []) if (!labelValido(l)) err(`${id}: label no permitido ${l}`);
  for (const c of x.componentes || []) if (!COMPONENTES.includes(c)) err(`${id}: component no permitido ${c}`);
  if (!x.componentes?.length) err(`${id}: sin components`);
  if (x.version && !versionById[x.version]) err(`${id}: fix version inexistente ${x.version}`);
  if (!x.version) err(`${id}: sin fix version`);
  if (x.sprint && !sprintById[x.sprint]) err(`${id}: sprint inexistente ${x.sprint}`);

  if (x.tipo === 'Sub-task') {
    const p = porId.get(x.padre);
    if (!p || p.tipo === 'Epic' || p.tipo === 'Sub-task') err(`${id}: padre de sub-task inválido`);
    else if (!(p.puntos > 5)) err(`${id}: sub-task bajo un ítem de ${p.puntos} pts (solo se permiten bajo > 5)`);
    continue;
  }

  // puntos
  const pts = x.puntos;
  if (pts === 13) err(`${id}: 13 puntos — hay que dividir`);
  if (pts != null && !meta.escala.includes(pts)) err(`${id}: puntos fuera de escala (${pts})`);
  if (x.tipo === 'Story' || x.tipo === 'Task') {
    if (pts == null) err(`${id}: ${x.tipo} sin estimación`);
  }
  if (x.tipo === 'Bug' && pts == null && !x.trivial) err(`${id}: bug sin puntos y no marcado trivial`);
  if (x.tipo === 'Bug' && pts != null && x.trivial) err(`${id}: bug trivial con puntos`);
  if (pts >= 5 && !x.justificacion) err(`${id}: ${pts} pts sin justificación`);

  // criterios
  const ac = x.ac || [];
  const minAc = x.tipo === 'Story' ? 3 : x.tipo === 'Bug' ? 2 : 1;
  if (ac.length < minAc || ac.length > 6) err(`${id}: ${ac.length} criterios (esperado ${minAc}-6)`);
  for (const a of ac) if (!gherkin(a)) err(`${id}: criterio no Gherkin: "${a.slice(0, 60)}"`);
  if (x.tipo === 'Story') {
    const h = x.historia || {};
    if (!h.rol || !h.quiero || !h.para) err(`${id}: historia incompleta (rol/quiero/para)`);
    if (!ac.some((a) => /^\[(error|borde)\]/.test(a))) err(`${id}: sin criterio de error o borde`);
  }
  if (x.tipo === 'Bug') {
    const b = x.bug || {};
    for (const f of ['entorno', 'esperado', 'actual', 'severidad', 'causaRaiz', 'fix', 'regresion'])
      if (!b[f]) err(`${id}: bug sin ${f}`);
    if (!b.pasos?.length) err(`${id}: bug sin pasos`);
    if (!PRIORIDADES.includes(b.severidad)) err(`${id}: severidad inválida ${b.severidad}`);
    if (x.estado === 'Done' && !x.evidencia.some((e) => /#\d+|\b[0-9a-f]{7}\b/.test(e)))
      err(`${id}: bug histórico sin commit/PR en la evidencia`);
  }
  if (x.tipo === 'Task') {
    const t = x.tarea || {};
    if (!t.objetivo || !t.alcance || !t.dod) err(`${id}: task sin objetivo/alcance/dod`);
  }

  // estado / sprint / fechas
  if (x.estado === 'Done') {
    if (!x.resuelto) err(`${id}: Done sin fecha de resolución`);
    const s = sprintById[x.sprint];
    if (!s) err(`${id}: Done sin sprint`);
    else if (s.estado === 'Futuro') err(`${id}: Done en sprint futuro`);
    else if (x.resuelto && !enRango(x.resuelto, s)) err(`${id}: resuelto ${x.resuelto} fuera de ${s.id}`);
  } else {
    if (x.resuelto) err(`${id}: no-Done con fecha de resolución`);
    if (!MOSCOW.includes(x.moscow)) err(`${id}: pendiente sin MoSCoW`);
    const s = x.sprint && sprintById[x.sprint];
    if (s && s.estado !== 'Futuro') err(`${id}: pendiente asignado a sprint cerrado ${s.id}`);
    if (versionById[x.version]?.estado === 'Released') err(`${id}: pendiente en versión ya publicada`);
  }

  // dependencias
  for (const d of x.bloqueadoPor || []) {
    if (!porId.has(d)) (PARCIAL ? warn : err)(`${id}: bloqueadoPor inexistente ${d}`);
    if (d === id) err(`${id}: se bloquea a sí mismo`);
  }
  for (const h of x.hallazgos || [])
    if (!AUDIT_31.includes(h) && !AUDIT_PP.includes(h) && !/^(CIERRE|CONC|LEGAL|DOCS)-/.test(h))
      err(`${id}: hallazgo desconocido ${h}`);
}

// dependencias: ciclos y orden de sprint
const bloquea = new Map();
for (const x of items) for (const d of x.bloqueadoPor || []) {
  if (!bloquea.has(d)) bloquea.set(d, []);
  bloquea.get(d).push(x.id);
}
const sprintIdx = (id) => meta.sprints.findIndex((s) => s.id === id);
for (const x of items) for (const d of x.bloqueadoPor || []) {
  const dep = porId.get(d);
  if (!dep || !x.sprint || !dep.sprint) continue;
  if (sprintIdx(dep.sprint) > sprintIdx(x.sprint))
    err(`${x.id} (${x.sprint}) planificado antes que su bloqueante ${d} (${dep.sprint})`);
}
const visit = (id, pila) => {
  if (pila.includes(id)) return err(`Ciclo de dependencias: ${[...pila, id].join(' → ')}`);
  for (const d of porId.get(id)?.bloqueadoPor || []) if (porId.has(d)) visit(d, [...pila, id]);
};
for (const x of items) visit(x.id, []);

// cobertura de auditorías
const cubiertos = new Map();
for (const x of items) for (const h of x.hallazgos || []) {
  if (!cubiertos.has(h)) cubiertos.set(h, []);
  cubiertos.get(h).push(x.id);
}
const faltan31 = AUDIT_31.filter((h) => !cubiertos.has(h));
const faltanPP = AUDIT_PP.filter((h) => !cubiertos.has(h));
if (faltan31.length) (PARCIAL ? warn : err)(`Hallazgos del audit integral sin cubrir: ${faltan31.join(', ')}`);
if (faltanPP.length) (PARCIAL ? warn : err)(`Hallazgos de la auditoría pre-producción sin cubrir: ${faltanPP.join(', ')}`);

// referencia
if (!PARCIAL) {
  const ref = porId.get(meta.referencia.id);
  if (!ref) err(`Historia de referencia ${meta.referencia.id} no existe`);
  else if (ref.puntos !== meta.referencia.puntos) err(`La referencia no vale ${meta.referencia.puntos} pts`);
}

// ---------- Métricas ----------
const conPuntos = (x) => typeof x.puntos === 'number';
const velocidad = meta.sprints.map((s) => {
  const hechos = items.filter((x) => x.sprint === s.id && x.estado === 'Done');
  const plan = items.filter((x) => x.sprint === s.id);
  return {
    ...s,
    puntosDone: hechos.filter(conPuntos).reduce((a, x) => a + x.puntos, 0),
    puntosPlan: plan.filter(conPuntos).reduce((a, x) => a + x.puntos, 0),
    nDone: hechos.length,
    nPlan: plan.length,
  };
});
const historicas = velocidad.filter((s) => s.estado !== 'Futuro' && !s.excluirVelocidad).map((s) => s.puntosDone).sort((a, b) => a - b);
const excluidas = velocidad.filter((s) => s.estado !== 'Futuro' && s.excluirVelocidad);
for (const s of excluidas) if (!s.motivoExclusion) err(`Sprint ${s.id}: excluido de la velocidad sin motivoExclusion`);
const medianaDe = (a) => (!a.length ? 0 : a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
const mediana = medianaDe(historicas);
const bajo = Math.floor(mediana * meta.velocidad.factorBajo);
const promedio = historicas.length ? Math.round((historicas.reduce((a, b) => a + b, 0) / historicas.length) * 10) / 10 : 0;
for (const s of velocidad) {
  if (s.estado === 'Futuro' && s.puntosPlan > bajo)
    (PARCIAL ? warn : err)(`Sprint ${s.id}: plan de ${s.puntosPlan} pts excede el escenario bajo de ${bajo}`);
  if (s.estado !== 'Futuro' && s.nDone === 0) (PARCIAL ? warn : err)(`Sprint ${s.id} sin ítems Done (no se crean sprints vacíos)`);
  if (s.estado === 'Futuro' && s.nPlan === 0) (PARCIAL ? warn : err)(`Sprint futuro ${s.id} vacío`);
}

// ranking del backlog pendiente: MoSCoW → sprint (sin sprint al final) → prioridad → orden de archivo
const pendientes = items.filter((x) => x.estado !== 'Done');
const ord = (arr, v) => (arr.indexOf(v) === -1 ? 99 : arr.indexOf(v));
pendientes
  .map((x, i) => ({ x, i }))
  .sort((a, b) =>
    ord(MOSCOW, a.x.moscow) - ord(MOSCOW, b.x.moscow) ||
    (a.x.sprint ? sprintIdx(a.x.sprint) : 999) - (b.x.sprint ? sprintIdx(b.x.sprint) : 999) ||
    ord(PRIORIDADES, a.x.prioridad) - ord(PRIORIDADES, b.x.prioridad) ||
    a.i - b.i)
  .forEach(({ x }, i) => (x.rank = i + 1));

const cuenta = (t) => items.filter((x) => x.tipo === t).length;
const spikes = items.filter((x) => (x.labels || []).includes('spike')).length;
const inferidos = items.filter((x) => (x.labels || []).includes('inferido'));
const totalPts = items.filter(conPuntos).reduce((a, x) => a + x.puntos, 0);
const ptsDone = items.filter((x) => x.estado === 'Done' && conPuntos(x)).reduce((a, x) => a + x.puntos, 0);
const ptsEpic = (eid) => items.filter((x) => x._epic === eid && conPuntos(x)).reduce((a, x) => a + x.puntos, 0);
const distrib = Object.fromEntries(meta.escala.map((p) => [p, items.filter((x) => x.puntos === p).length]));

// ---------- Pronóstico hasta v1.0 (dos escenarios) ----------
const alcanceV1 = items.filter((x) => x.estado !== 'Done' && meta.velocidad.versionesAlcanceV1.includes(x.version));
const ptsV1 = alcanceV1.filter(conPuntos).reduce((a, x) => a + x.puntos, 0);
for (const x of alcanceV1) if (!x.sprint) err(`${x.id}: en el alcance de v1.0 pero sin sprint`);
for (const x of items) if (x.estado !== 'Done' && x.sprint && !meta.velocidad.versionesAlcanceV1.includes(x.version))
  err(`${x.id}: planificado en ${x.sprint} pero fuera del alcance de v1.0 (${x.version})`);
const enAlcance = new Set(alcanceV1.map((x) => x.id));
const prof = new Map();
const profundidad = (x) => {
  if (prof.has(x.id)) return prof.get(x.id);
  const ds = (x.bloqueadoPor || []).filter((d) => enAlcance.has(d)).map((d) => porId.get(d));
  const v = ds.length ? 1 + Math.max(...ds.map(profundidad)) : 0;
  prof.set(x.id, v);
  return v;
};
const ordenV1 = [...alcanceV1].sort((a, b) =>
  sprintIdx(a.sprint) - sprintIdx(b.sprint) || profundidad(a) - profundidad(b) || a.rank - b.rank);
// Empaqueta respetando: (1) el orden de fases del plan (nada de un sprint planificado posterior
// se adelanta a uno anterior: legal/código → aceptación → infraestructura y pagos) y (2) las dependencias.
const empacar = (cap) => {
  const carga = [];
  const bucket = new Map();
  let piso = 0, maxB = 0, sprintActual = null;
  for (const x of ordenV1) {
    if (x.sprint !== sprintActual) { piso = maxB; sprintActual = x.sprint; }
    const p = conPuntos(x) ? x.puntos : 0;
    let b = Math.max(piso, ...(x.bloqueadoPor || []).filter((d) => bucket.has(d)).map((d) => bucket.get(d)));
    while ((carga[b] || 0) + p > cap) b++;
    carga[b] = (carga[b] || 0) + p;
    bucket.set(x.id, b);
    maxB = Math.max(maxB, b);
  }
  return { sprints: carga.length, minimo: cap ? Math.ceil(ptsV1 / cap) : 0, carga, bucket };
};
const escBase = empacar(mediana);
const escBajo = empacar(bajo);
const futurosPlan = meta.sprints.filter((s) => s.estado === 'Futuro');
if (escBajo.sprints !== futurosPlan.length)
  (PARCIAL ? warn : err)(`El plan tiene ${futurosPlan.length} sprints futuros y el escenario bajo necesita ${escBajo.sprints}`);
const finTras = (n) => {
  const d = new Date(`${futurosPlan[0].inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n - 1);
  return d.toISOString().slice(0, 10);
};
// Nota de plan por sprint futuro: tope alcanzado y, si se declara, el ítem colchón que sale primero.
for (const s of futurosPlan.filter((s) => s.colchon)) {
  const it = porId.get(s.colchon.item);
  const dest = velocidad.find((v) => v.id === s.colchon.destino);
  if (!it) { err(`${s.id}: colchón ${s.colchon.item} inexistente`); continue; }
  if (it.sprint !== s.id) err(`${s.id}: el colchón ${it.id} no está en ese sprint`);
  if (!dest || dest.estado !== 'Futuro' || sprintIdx(dest.id) <= sprintIdx(s.id)) err(`${s.id}: destino del colchón inválido`);
  else if (bajo - dest.puntosPlan < (it.puntos || 0)) err(`${s.id}: ${it.id} (${it.puntos} pts) no cabe en ${dest.id} (${bajo - dest.puntosPlan} libres)`);
  if ((bloquea.get(it.id) || []).some((b) => porId.get(b)?.sprint === s.id)) err(`${s.id}: el colchón ${it.id} bloquea otro ítem del mismo sprint`);
}
const notaPlan = (s) => {
  const v = velocidad.find((x) => x.id === s.id);
  const out = [];
  if (v.puntosPlan === bajo) out.push(`Sprint al tope del escenario bajo (${v.puntosPlan}/${bajo} pts).`);
  if (s.colchon) {
    const it = porId.get(s.colchon.item);
    const dest = velocidad.find((x) => x.id === s.colchon.destino);
    out.push(`Si el UAT genera bugs, \`${it.id}\` (${it.titulo}, ${it.puntos} pts) es el primer ítem en pasar a ${sprintNombre(dest.id)}, que tiene ${bajo - dest.puntosPlan} pts libres. ${s.colchon.motivo}`);
  }
  return out.join(' ');
};
const bloquePlan = () => [
  `| Sprint | Fechas | Pts / tope | Sprint Goal | Nota |`,
  `| --- | --- | ---: | --- | --- |`,
  ...futurosPlan.map((s) => {
    const v = velocidad.find((x) => x.id === s.id);
    return `| ${sprintNombre(s.id)} | ${s.inicio} → ${s.fin} | ${v.puntosPlan}/${bajo} | ${s.objetivo} | ${notaPlan(s) || '—'} |`;
  }),
];
const bloqueForecast = () => [
  '> **Los puntos históricos son estimaciones retroactivas**: se asignaron en octubre de 2026 a trabajo ya terminado, relativos a la historia de referencia. La velocidad que sale de ellos es una **referencia para planificar, no una medición**, y se recalibra tras los primeros 2-3 sprints reales en Jira.',
  '',
  `Semanas que cuentan: **${historicas.length}** · semanas excluidas: **${excluidas.map((s) => s.id).join(', ')}** · promedio (solo informativo): ${promedio} pts.`,
  '',
  `Alcance hasta v1.0 (Fix Version ${meta.velocidad.versionesAlcanceV1.join(' + ')}): **${alcanceV1.length} ítems, ${ptsV1} pts**. Pendiente total del backlog (incluye v1.1.0): **${totalPts - ptsDone} pts**.`,
  '',
  '| Escenario | Velocidad | Sprints hasta v1.0 | Fin estimado |',
  '| --- | ---: | ---: | --- |',
  `| Base (mediana) | ${mediana} pts/sprint | **${escBase.sprints}** | ${finTras(escBase.sprints)} |`,
  `| Bajo (${Math.round(meta.velocidad.factorBajo * 100)}% de la mediana) | ${bajo} pts/sprint | **${escBajo.sprints}** | ${finTras(escBajo.sprints)} |`,
  '',
  `Los dos escenarios difieren en **${escBajo.sprints - escBase.sprints} sprints** (${escBajo.sprints - escBase.sprints} semanas de calendario): con ${mediana} pts por sprint los ${ptsV1} pts del alcance caben en ${escBase.sprints}; con ${bajo}, hacen falta ${escBajo.sprints}. ` +
    (escBase.sprints === escBase.minimo && escBajo.sprints === escBajo.minimo
      ? 'En ninguno de los dos el orden obligatorio (legal y código → aceptación → infraestructura y pagos) ni las dependencias agregan sprints: cada cifra coincide con el mínimo que da la capacidad sola.'
      : `Respetar el orden obligatorio y las dependencias agrega sprints sobre el mínimo por capacidad (base: mínimo ${escBase.minimo}; bajo: mínimo ${escBajo.minimo}).`),
  '',
  `El plan cargado en Jira (campo Sprint) sigue el **escenario bajo**: ${futurosPlan.length} sprints, ninguno por encima de ${bajo} pts. En el escenario base, el mismo orden se comprime así:`,
  '',
  ...escBase.carga.map((c, i) => `- **Sprint base ${i + 1}** (${c} pts, hasta ${finTras(i + 1)}): ${ordenV1.filter((x) => escBase.bucket.get(x.id) === i).map((x) => x.id).join(', ')}`),
];

// ---------- Render helpers ----------
const linea = (s) => String(s ?? '').replace(/\r?\n/g, ' ');
const acMd = (a) => a.replace(/^\[(error|borde)\]\s*/, (_, t) => `**(${t})** `);
const historiaTxt = (x) => `Como **${x.historia.rol}**, quiero ${x.historia.quiero}, para ${x.historia.para}.`;
const deps = (x) => {
  const out = [];
  if (x.bloqueadoPor?.length) out.push(`is blocked by ${x.bloqueadoPor.join(', ')}`);
  if (bloquea.get(x.id)?.length) out.push(`blocks ${bloquea.get(x.id).join(', ')}`);
  return out.join(' · ');
};
const ptsTxt = (x) => (conPuntos(x) ? `${x.puntos} pts` : x.tipo === 'Bug' ? 'sin puntos (trivial)' : '—');

// ---------- BACKLOG.md ----------
const md = [];
md.push('> **Team-managed:** el CSV asume proyecto company-managed; en team-managed `Story Points` se mapea a *Story point estimate*, `Components` no existe (mapear a labels o ignorar) y el vínculo épica→hijo usa igualmente la columna `Parent` con el `Issue ID`.');
md.push('');
md.push('# Backlog Jira — INSOLVENTIC');
md.push('');
md.push(`> Generado por \`docs/jira/generar.mjs\` desde \`docs/jira/data/*.json\` (fuente única). **No editar a mano**: editar el JSON y regenerar. Corte de evidencia: ${meta.proyecto.fechaCorte}.`);
md.push('');
md.push('## Notas de importación');
md.push('');
md.push('- **Jerarquía:** `Parent` contiene el `Issue ID` numérico del padre (Epic → Story/Bug/Task → Sub-task). Las filas van ordenadas épicas → ítems → sub-tasks, como pide el importador.');
md.push('- **Sprint:** Jira Cloud espera el **ID numérico** del sprint, no su nombre. La columna `Sprint` trae el nombre (`INS 2026-W35`) y conviene dejarla sin mapear. Cada fila lleva además en **Labels** la etiqueta de su sprint (`sprint-2026-W35`) para moverla en bloque al sprint real después de importar (tabla en PROCESO_SCRUM.md §5.6).');
md.push('- **Resolution:** vale `Done` solo en las filas con Status Done (incluidas las épicas cerradas) y queda vacía en las demás, para que Jira no deje ítems cerrados como "Unresolved".');
md.push(`- **Resolved de épicas:** una épica cerrada no tiene fecha propia; su Resolved es **derivado** = fecha del último hijo cerrado (marcado en el JSON con \`resueltoDerivado\`): ${epics.filter((e) => e.epica.resueltoDerivado).map((e) => `${e.epica.id} → ${e.epica.resueltoDerivado.fecha || '(vacía)'}`).join(', ') || 'ninguna'}.`);
md.push(`- **Prioridad:** este documento usa la escala del audit (Crítica/Alta/Media/Baja); el CSV ya emite los nombres de Jira (${Object.entries(PRIORIDAD_JIRA).map(([a, b]) => `${a} → ${b}`).join(', ')}).`);
md.push('- **Resolved:** formato `yyyy-MM-dd` (configurarlo en el paso de fechas del asistente).');
md.push('- **Labels / Components / Blocks:** columnas repetidas con el mismo encabezado = valores múltiples. `Blocks` es el vínculo saliente (*este ítem bloquea a*) por `Issue ID`.');
md.push('- **Spike:** no existe como tipo estándar; va como Task con label `spike`. **MoSCoW / Rank / Clave temporal / Evidencia:** mapear a campos personalizados o dejar sin mapear (quedan también dentro de la Description).');
md.push('- **Features:** se modelan como Épicas (capacidades de negocio multi-sprint); una mejora puntual dentro de una capacidad es una Story con label `feature`, no una épica propia.');
md.push('');
md.push('## Resumen');
md.push('');
md.push(`| Métrica | Valor |`);
md.push(`| --- | --- |`);
md.push(`| Épicas | ${epics.length} |`);
md.push(`| Historias | ${cuenta('Story')} |`);
md.push(`| Bugs | ${cuenta('Bug')} (${items.filter((x) => x.tipo === 'Bug' && x.trivial).length} triviales sin puntos) |`);
md.push(`| Tasks | ${cuenta('Task')} (de ellas ${spikes} spikes) |`);
md.push(`| Sub-tasks | ${subtareas.length} |`);
md.push(`| Puntos totales | ${totalPts} (Done: ${ptsDone} · pendientes: ${totalPts - ptsDone}) |`);
md.push(`| Distribución de puntos | ${meta.escala.map((p) => `${p}: ${distrib[p]}`).join(' · ')} |`);
md.push(`| Ítems \`inferido\` | ${inferidos.length} |`);
md.push(`| Historia de referencia (${meta.referencia.puntos} pts) | ${meta.referencia.id} — ${meta.referencia.titulo} |`);
md.push('');
md.push(`**Por qué es la referencia:** ${meta.referencia.porQue}`);
md.push('');
md.push(`**Regla de bugs:** ${meta.reglaBugs}`);
md.push('');
md.push('## Épicas');
md.push('');
md.push('| Épica | Título | Ítems | Done | Puntos | Pendientes (pts) |');
md.push('| --- | --- | ---: | ---: | ---: | ---: |');
for (const e of epics) {
  const its = items.filter((x) => x._epic === e.epica.id);
  const pend = its.filter((x) => x.estado !== 'Done' && conPuntos(x)).reduce((a, x) => a + x.puntos, 0);
  md.push(`| [${e.epica.id}](#${e.epica.id.toLowerCase()}) | ${e.epica.titulo} | ${its.length} | ${its.filter((x) => x.estado === 'Done').length} | ${ptsEpic(e.epica.id)} | ${pend} |`);
}
md.push('');

for (const e of epics) {
  const ep = e.epica;
  md.push(`---`);
  md.push('');
  md.push(`<a id="${ep.id.toLowerCase()}"></a>`);
  md.push(`## ${ep.id} — ${ep.titulo}`);
  md.push('');
  md.push(ep.descripcion);
  md.push('');
  md.push(`**Objetivo de negocio:** ${ep.objetivo}`);
  md.push('');
  md.push(`**Evidencia:** ${ep.evidencia.join(' · ')}`);
  md.push('');
  md.push('| ID | Tipo | Título | Pts | Estado | Sprint | Versión |');
  md.push('| --- | --- | --- | ---: | --- | --- | --- |');
  for (const x of items.filter((i) => i._epic === ep.id))
    md.push(`| ${x.id} | ${x.tipo}${(x.labels || []).includes('spike') ? ' (spike)' : ''} | ${linea(x.titulo)} | ${conPuntos(x) ? x.puntos : '—'} | ${x.estado} | ${x.sprint || 'Backlog'} | ${x.version} |`);
  md.push('');
  for (const x of items.filter((i) => i._epic === ep.id)) {
    md.push(`### ${x.id} · ${x.tipo}${(x.labels || []).includes('spike') ? ' (spike)' : ''} · ${x.titulo}`);
    md.push('');
    const cab = [
      `**Estado:** ${x.estado}${x.resuelto ? ` (${x.resuelto})` : ''}`,
      `**Sprint:** ${x.sprint ? sprintNombre(x.sprint) : 'Backlog (sin sprint)'}`,
      `**Versión:** ${x.version}`,
      `**Prioridad:** ${x.prioridad}`,
      `**Estimación:** ${ptsTxt(x)}`,
    ];
    if (x.estado !== 'Done') cab.push(`**MoSCoW:** ${x.moscow} · **Rank:** ${x.rank}`);
    md.push(cab.join(' · '));
    md.push('');
    md.push(`**Labels:** ${(x.labels || []).join(', ') || '—'} · **Components:** ${x.componentes.join(', ')}`);
    md.push('');
    if (x.tipo === 'Story') {
      md.push(historiaTxt(x));
      md.push('');
    }
    if (x.tipo === 'Bug') {
      const b = x.bug;
      md.push(`- **Entorno:** ${b.entorno}`);
      md.push(`- **Severidad:** ${b.severidad}`);
      md.push(`- **Pasos para reproducir:**`);
      b.pasos.forEach((p, i) => md.push(`  ${i + 1}. ${p}`));
      md.push(`- **Esperado:** ${b.esperado}`);
      md.push(`- **Actual:** ${b.actual}`);
      md.push(`- **Causa raíz:** ${b.causaRaiz}`);
      md.push(`- **Fix:** ${b.fix}`);
      md.push(`- **Test de regresión:** ${b.regresion}`);
      md.push('');
    }
    if (x.tipo === 'Task') {
      const t = x.tarea;
      md.push(`- **Objetivo:** ${t.objetivo}`);
      md.push(`- **Alcance:** ${t.alcance}`);
      md.push(`- **Definición de terminado:** ${t.dod}`);
      md.push('');
    }
    if (x.nota) {
      md.push(`> ${x.nota}`);
      md.push('');
    }
    md.push(x.tipo === 'Bug' ? '**Criterios de aceptación del fix:**' : '**Criterios de aceptación:**');
    md.push('');
    for (const a of x.ac) md.push(`- ${acMd(a)}`);
    md.push('');
    if (x.justificacion) md.push(`**Justificación de la estimación:** ${x.justificacion}`), md.push('');
    if (x.hallazgos?.length) md.push(`**Hallazgos:** ${x.hallazgos.join(', ')}`), md.push('');
    const dp = deps(x);
    if (dp) md.push(`**Dependencias:** ${dp}`), md.push('');
    if (x.subtareas?.length) {
      md.push('**Sub-tasks:**');
      md.push('');
      for (const s of x.subtareas) md.push(`- \`${s.id}\` ${s.titulo} — ${s.descripcion}`);
      md.push('');
    }
    md.push(`**Evidencia:** ${x.evidencia.join(' · ')}`);
    md.push('');
  }
}

// planificación
const tablaSprints = (filtro) => {
  const out = ['| Sprint | Fechas | Objetivo | Ítems | Pts Done | Pts plan | Velocidad |', '| --- | --- | --- | ---: | ---: | ---: | --- |'];
  for (const s of velocidad.filter(filtro)) {
    const nota = s.estado === 'Futuro' ? `plan (≤ ${bajo})` : s.excluirVelocidad ? '**excluido**' : 'cuenta';
    out.push(`| ${sprintNombre(s.id)}${s.docsSemana ? ` (docs Semana ${s.docsSemana.join(', ')})` : ''} | ${s.inicio} → ${s.fin} | ${s.objetivo} | ${s.nPlan} | ${s.puntosDone} | ${s.puntosPlan} | ${nota} |`);
  }
  return out;
};
md.push('---');
md.push('');
md.push('## Planificación');
md.push('');
md.push('### Sprints históricos (reconstruidos desde las fechas de commit)');
md.push('');
md.push('Una fila por semana ISO con actividad real; no se crean sprints para semanas sin commits. Las semanas marcadas **excluido** no entran en el cálculo de velocidad (motivo abajo).');
md.push('');
md.push(...tablaSprints((s) => s.estado !== 'Futuro'));
md.push('');
md.push('**Semanas excluidas de la velocidad**');
md.push('');
md.push('| Sprint | Pts retroactivos | Motivo |');
md.push('| --- | ---: | --- |');
for (const s of excluidas) md.push(`| ${sprintNombre(s.id)} | ${s.puntosDone} | ${s.motivoExclusion} |`);
md.push('');
md.push('### Velocidad y pronóstico hasta v1.0');
md.push('');
md.push(...bloqueForecast());
md.push('');
md.push('Supuestos del pronóstico:');
md.push('');
for (const s of meta.velocidad.supuestos) md.push(`- ${s}`);
md.push('');
md.push('### Sprints futuros');
md.push('');
md.push(...tablaSprints((s) => s.estado === 'Futuro'));
md.push('');
for (const s of meta.sprints.filter((s) => s.estado === 'Futuro')) {
  md.push(`#### ${sprintNombre(s.id)} (${s.inicio} → ${s.fin})`);
  md.push('');
  md.push(`**Sprint Goal:** ${s.objetivo}`);
  if (notaPlan(s)) md.push('', `**Nota del plan:** ${notaPlan(s)}`);
  md.push('');
  for (const x of items.filter((i) => i.sprint === s.id).sort((a, b) => a.rank - b.rank))
    md.push(`- \`${x.id}\` ${x.titulo} — ${ptsTxt(x)} · ${x.moscow}${(x.labels || []).includes('legal-pendiente') ? ' · ⚠ legal-pendiente' : ''}`);
  md.push('');
}
md.push('### Versiones (Fix Version)');
md.push('');
md.push('| Versión | Fecha | Estado | Origen | Ítems | Descripción |');
md.push('| --- | --- | --- | --- | ---: | --- |');
for (const v of meta.versiones)
  md.push(`| ${v.id} | ${v.fecha || '—'} | ${v.estado} | ${v.real ? 'real (tag/CHANGELOG)' : v.estado === 'Released' ? 'reconstruida' : 'propuesta'} | ${items.filter((x) => x.version === v.id).length} | ${v.descripcion} |`);
md.push('');
md.push('### Backlog priorizado (pendientes, por rank)');
md.push('');
md.push('Orden: MoSCoW → sprint planificado (sin sprint al final) → prioridad → orden de la épica.');
md.push('');
md.push('| Rank | ID | Título | MoSCoW | Prioridad | Pts | Sprint | Versión |');
md.push('| ---: | --- | --- | --- | --- | ---: | --- | --- |');
for (const x of [...pendientes].sort((a, b) => a.rank - b.rank))
  md.push(`| ${x.rank} | ${x.id} | ${linea(x.titulo)} | ${x.moscow} | ${x.prioridad} | ${conPuntos(x) ? x.puntos : '—'} | ${x.sprint || 'Backlog'} | ${x.version} |`);
md.push('');
md.push('### Cobertura de auditorías');
md.push('');
md.push('**AUDITORIA_INTEGRAL_PRE_LAUNCH.md (31 hallazgos)**');
md.push('');
md.push('| Hallazgo | Ítems | Estado |');
md.push('| --- | --- | --- |');
for (const h of AUDIT_31) {
  const its = cubiertos.get(h) || [];
  const est = its.length ? (its.every((i) => porId.get(i).estado === 'Done') ? 'Cerrado' : its.some((i) => porId.get(i).estado === 'Done') ? 'Parcial' : 'Abierto') : '**SIN CUBRIR**';
  md.push(`| ${h} | ${its.join(', ') || '—'} | ${est} |`);
}
md.push('');
md.push('**AUDITORIA_PREPRODUCCION_2026-08-25.md (25 hallazgos, prefijo PP-)**');
md.push('');
md.push('| Hallazgo | Ítems | Estado |');
md.push('| --- | --- | --- |');
for (const h of AUDIT_PP) {
  const its = cubiertos.get(h) || [];
  const est = its.length ? (its.every((i) => porId.get(i).estado === 'Done') ? 'Cerrado' : its.some((i) => porId.get(i).estado === 'Done') ? 'Parcial' : 'Abierto') : '**SIN CUBRIR**';
  md.push(`| ${h} | ${its.join(', ') || '—'} | ${est} |`);
}
md.push('');
writeFileSync(join(DIR, 'BACKLOG.md'), md.join('\n'), 'utf8');

// ---------- CSV ----------
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const descripcion = (x) => {
  const d = [];
  if (x.tipo === 'Epic') {
    d.push(x.descripcion, '', `*Objetivo de negocio:* ${x.objetivo}`);
  } else if (x.tipo === 'Sub-task') {
    d.push(x.descripcion);
  } else {
    if (x.tipo === 'Story') d.push(`*Historia:* Como ${x.historia.rol}, quiero ${x.historia.quiero}, para ${x.historia.para}.`, '');
    if (x.tipo === 'Bug') {
      const b = x.bug;
      d.push(`*Entorno:* ${b.entorno}`, `*Severidad:* ${b.severidad}`, '*Pasos:*');
      b.pasos.forEach((p) => d.push(`# ${p}`));
      d.push(`*Esperado:* ${b.esperado}`, `*Actual:* ${b.actual}`, `*Causa raíz:* ${b.causaRaiz}`, `*Fix:* ${b.fix}`, `*Test de regresión:* ${b.regresion}`, '');
    }
    if (x.tipo === 'Task') {
      const t = x.tarea;
      d.push(`*Objetivo:* ${t.objetivo}`, `*Alcance:* ${t.alcance}`, `*Definición de terminado:* ${t.dod}`, '');
    }
    if (x.nota) d.push(`_${x.nota}_`, '');
    d.push(`h4. ${x.tipo === 'Bug' ? 'Criterios de aceptación del fix' : 'Criterios de aceptación'}`);
    for (const a of x.ac) d.push(`* ${a.replace(/^\[(error|borde)\]\s*/, (_, t) => `*(${t})* `)}`);
    if (x.justificacion) d.push('', `*Estimación:* ${x.puntos} pts — ${x.justificacion}`);
    if (x.hallazgos?.length) d.push(`*Hallazgos:* ${x.hallazgos.join(', ')}`);
    const dp = deps(x);
    if (dp) d.push(`*Dependencias:* ${dp}`);
    if (x.estado !== 'Done') d.push(`*MoSCoW:* ${x.moscow} · *Rank:* ${x.rank}`);
  }
  d.push('', `*Evidencia:* ${x.evidencia.join(' · ')}`);
  return d.join('\n');
};
// Jira Cloud no asigna sprints por nombre desde CSV: cada ítem lleva además la etiqueta de su sprint
// (solo en el CSV) para filtrarlos y moverlos en bloque al sprint real después de importar.
const sprintLabel = (id) => (id ? `sprint-${id}` : '');
const labelsCsv = (x) => [...(x.labels || []), ...(x.tipo !== 'Epic' && x.sprint ? [sprintLabel(x.sprint)] : [])];
const maxL = Math.max(1, ...todos.map((x) => labelsCsv(x).length));
const maxC = Math.max(1, ...todos.map((x) => (x.componentes || []).length));
const maxB = Math.max(1, ...todos.map((x) => (bloquea.get(x.id) || []).length));
const header = [
  'Issue ID', 'Clave temporal', 'Issue Type', 'Summary', 'Description', 'Parent', 'Priority', 'Story Points',
  ...Array(maxL).fill('Labels'), ...Array(maxC).fill('Components'),
  'Sprint', 'Status', 'Resolution', 'Resolved', 'Fix Version', 'Evidencia', ...Array(maxB).fill('Blocks'), 'MoSCoW', 'Rank',
];
const pad = (arr, n) => [...arr, ...Array(n - arr.length).fill('')];
const filas = [header.map(q).join(',')];
for (const x of todos) {
  const estadoEpic = x.tipo === 'Epic'
    ? (items.filter((i) => i._epic === x.id).every((i) => i.estado === 'Done') ? 'Done' : items.some((i) => i._epic === x.id && i.estado === 'Done') ? 'In Progress' : 'To Do')
    : x.estado;
  const row = [
    x._num, x.id, x.tipo, x.titulo, descripcion(x), x.tipo === 'Epic' ? '' : porId.get(x.padre)._num,
    PRIORIDAD_JIRA[x.prioridad], conPuntos(x) && x.tipo !== 'Sub-task' ? x.puntos : '',
    ...pad(labelsCsv(x), maxL), ...pad(x.componentes || [], maxC),
    x.tipo === 'Epic' ? '' : sprintNombre(x.sprint), estadoEpic, estadoEpic === 'Done' ? 'Done' : '',
    x.tipo === 'Epic' ? x._resuelto || '' : x.resuelto || '',
    x.tipo === 'Epic' ? '' : x.version, x.evidencia.join(' · '),
    ...pad((bloquea.get(x.id) || []).map((b) => porId.get(b)._num), maxB),
    x.tipo === 'Epic' || x.estado === 'Done' ? '' : x.moscow || '', x.rank || '',
  ];
  filas.push(row.map(q).join(','));
}
writeFileSync(join(DIR, 'jira-import.csv'), filas.join('\n') + '\n', 'utf8');

// verificación del CSV escrito: re-parseo y conteos
const csv = readFileSync(join(DIR, 'jira-import.csv'), 'utf8');
const parse = (txt) => {
  const rows = []; let row = []; let f = ''; let inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (inQ) { if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; } else if (c === '"') inQ = false; else f += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  return rows;
};
const filasCsv = parse(csv);
const cab = filasCsv[0];
const datos = filasCsv.slice(1);
if (datos.length !== todos.length) err(`CSV: ${datos.length} filas, se esperaban ${todos.length}`);
if (datos.some((r) => r.length !== cab.length)) err('CSV: filas con distinto número de columnas');
const ids = new Set(datos.map((r) => r[0]));
const iParent = cab.indexOf('Parent');
const iPts = cab.indexOf('Story Points');
const iTipo = cab.indexOf('Issue Type');
for (const r of datos) {
  if (r[iParent] && !ids.has(r[iParent])) err(`CSV: Parent ${r[iParent]} inexistente (fila ${r[0]})`);
  if (r[iTipo] !== 'Epic' && !r[iParent]) err(`CSV: ${r[1]} sin Parent`);
  if (r[iPts] && !meta.escala.includes(Number(r[iPts]))) err(`CSV: puntos fuera de escala en ${r[1]}`);
  if (!Object.values(PRIORIDAD_JIRA).includes(r[cab.indexOf('Priority')])) err(`CSV: prioridad no válida para Jira en ${r[1]}: ${r[cab.indexOf('Priority')]}`);
  const done = r[cab.indexOf('Status')] === 'Done';
  if ((r[cab.indexOf('Resolution')] === 'Done') !== done) err(`CSV: Resolution incoherente con Status en ${r[1]}`);
  for (let i = 0; i < cab.length; i++) if (cab[i] === 'Labels' && /\s/.test(r[i])) err(`CSV: label con espacios en ${r[1]}: ${r[i]}`);
}
const iSprint = cab.indexOf('Sprint');
for (const r of datos) {
  const lab = r.filter((v, i) => cab[i] === 'Labels' && v.startsWith('sprint-'));
  const esperado = r[iSprint] ? [sprintLabel(r[iSprint].replace(/^INS /, ''))] : [];
  if (JSON.stringify(lab) !== JSON.stringify(esperado)) err(`CSV: etiqueta de sprint incoherente en ${r[1]}`);
}
const bloqueEtiquetas = () => {
  const filasT = meta.sprints.map((s) => {
    const its = items.filter((x) => x.sprint === s.id);
    const subs = subtareas.filter((x) => x.sprint === s.id);
    const pts = its.filter(conPuntos).reduce((a, x) => a + x.puntos, 0);
    return `| ${sprintNombre(s.id)} | \`${sprintLabel(s.id)}\` | ${its.length} | ${subs.length} | ${pts} | ${s.inicio} → ${s.fin} | ${s.estado} |`;
  });
  const sinSprint = items.filter((x) => !x.sprint);
  return [
    'Jira Cloud no asigna sprints por nombre al importar un CSV. Cada ítem y sub-task lleva en **Labels** la etiqueta de su sprint (solo en el CSV; el JSON y BACKLOG.md no cambian). Después de importar: crear el sprint en el board, filtrar con `labels = sprint-…` y moverlos en bloque.',
    '',
    '| Sprint | Etiqueta | Ítems | Sub-tasks | Puntos | Fechas | Estado |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |',
    ...filasT,
    `| Sin sprint (backlog) | — | ${sinSprint.length} | ${subtareas.filter((x) => !x.sprint).length} | ${sinSprint.filter(conPuntos).reduce((a, x) => a + x.puntos, 0)} | — | — |`,
    '',
    'Las épicas no llevan etiqueta de sprint. Los puntos son de historias, bugs y tasks (las sub-tasks no se puntúan).',
  ];
};
const csvPorTipo = Object.fromEntries(['Epic', ...TIPOS].map((t) => [t, datos.filter((r) => r[iTipo] === t).length]));
const csvPts = datos.reduce((a, r) => a + (Number(r[iPts]) || 0), 0);
if (csvPts !== totalPts) err(`CSV: suma de puntos ${csvPts} ≠ JSON ${totalPts}`);
const mdTxt = readFileSync(join(DIR, 'BACKLOG.md'), 'utf8');
const mdItems = (mdTxt.match(/^### E\d\d-\d+ · /gm) || []).length;
if (mdItems !== items.length) err(`BACKLOG.md: ${mdItems} ítems, JSON ${items.length}`);

// ---------- PROCESO_SCRUM.md (bloques AUTO) ----------
const PS = join(DIR, 'PROCESO_SCRUM.md');
if (existsSync(PS)) {
  let ps = readFileSync(PS, 'utf8');
  const bloque = (nombre, contenido) => {
    const re = new RegExp(`(<!-- AUTO:${nombre} -->)[\\s\\S]*?(<!-- /AUTO:${nombre} -->)`);
    if (!re.test(ps)) return warn(`PROCESO_SCRUM.md sin marcador AUTO:${nombre}`);
    ps = ps.replace(re, `$1\n${contenido}\n$2`);
  };
  bloque('SPRINTS', [
    '| Sprint | Fechas | Tipo | Ítems Done | Pts Done | Cuenta para velocidad |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...velocidad.filter((s) => s.estado !== 'Futuro').map((s) =>
      `| ${sprintNombre(s.id)} | ${s.inicio} → ${s.fin} | reconstruido${s.docsSemana ? ` · docs Semana ${s.docsSemana.join(', ')}` : ''} | ${s.nDone} | ${s.puntosDone} | ${s.excluirVelocidad ? `**no** — ${s.motivoExclusion}` : 'sí'} |`),
    '',
    `Velocidad de referencia: mediana **${mediana}** pts/sprint (n=${historicas.length}) · escenario bajo **${bajo}** pts/sprint (${Math.round(meta.velocidad.factorBajo * 100)}%).`,
  ].join('\n'));
  bloque('FORECAST', bloqueForecast().join('\n'));
  bloque('PLAN', bloquePlan().join('\n'));
  bloque('ETIQUETAS_SPRINT', bloqueEtiquetas().join('\n'));
  bloque('INFERIDOS', inferidos.length
    ? inferidos.map((x) => `- [ ] \`${x.id}\` ${x.titulo} — ${x.evidencia.join(' · ')}`).join('\n')
    : '_Ninguno._');
  writeFileSync(PS, ps, 'utf8');
}

// ---------- Salida ----------
const resumen = {
  epicas: epics.length, historias: cuenta('Story'), bugs: cuenta('Bug'), tasks: cuenta('Task'), spikes,
  subtasks: subtareas.length, puntosTotales: totalPts, puntosDone: ptsDone, puntosPendientes: totalPts - ptsDone,
  distribucion: distrib, inferidos: inferidos.length,
  velocidad: { n: historicas.length, excluidas: excluidas.map((s) => `${s.id}:${s.puntosDone}`), mediana, bajo, promedio },
  alcanceV1: { items: alcanceV1.length, puntos: ptsV1 },
  sprintsHastaV1: {
    base: { capacidadPura: escBase.minimo, conOrden: escBase.sprints, fin: finTras(escBase.sprints), carga: escBase.carga },
    bajo: { capacidadPura: escBajo.minimo, conOrden: escBajo.sprints, fin: finTras(escBajo.sprints), carga: escBajo.carga },
  },
  futuros: velocidad.filter((s) => s.estado === 'Futuro').map((s) => `${s.id}:${s.puntosPlan}`),
  csv: { filas: datos.length, porTipo: csvPorTipo, puntos: csvPts },
  audit31: `${AUDIT_31.length - faltan31.length}/31`, auditPP: `${AUDIT_PP.length - faltanPP.length}/25`,
  ptsPorEpica: Object.fromEntries(epics.map((e) => [e.epica.id, ptsEpic(e.epica.id)])),
};
console.log(JSON.stringify(resumen, null, 1));
for (const a of avisos) console.log('AVISO:', a);
for (const e of errores) console.log('ERROR:', e);
console.log(errores.length ? `\n${errores.length} errores` : '\nOK — sin errores');
process.exit(errores.length ? 1 : 0);
