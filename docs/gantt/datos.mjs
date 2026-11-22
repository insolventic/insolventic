// Fuente única del Gantt de INSOLVENTIC. `node docs/gantt/generar.mjs` reescribe
// gantt.html, gantt.md y gantt.xlsx a partir de este archivo; no editar las salidas a mano.
//
// Reglas de los datos:
// - Lo pasado sale del repo: cada tarea completada cita commit, PR o documento en `fuente`.
// - Lo futuro es estimación (`base: 'estimado'`): del plan Jira (docs/jira/PROCESO_SCRUM.md §5.5,
//   escenario bajo de 16 pts/semana) o, si no está en Jira, estimado aquí.
// - `base: 'inferido'` = hay evidencia del trabajo pero no de sus fechas exactas.
// - `base: 'dato'` = fecha aportada por el autor (calendario académico), no deducible del repo.
// - Horas = puntos Jira × HORAS_POR_PUNTO. En lo completado es esfuerzo EQUIVALENTE retroactivo
//   (los puntos se asignaron en octubre de 2026 a trabajo ya hecho), no horas medidas.

export const META = {
  proyecto: 'INSOLVENTIC',
  titulo: 'Diagrama de Gantt — Proyecto de grado',
  subtitulo: 'Sistema web de gestión de expedientes de insolvencia, conciliación y acuerdos de apoyo',
  equipo: 'Maximiliano Malavera, Julián Sánchez, José Suárez',
  hoy: '2026-10-21',
  inicioAcademico: '2026-08-03', // S1, lunes — dato del autor (semestre 2026-2)
  inicio20271: '2027-02-01', // S18, lunes — dato del autor (semestre 2027-1)
  horasPorPunto: 1.1, // 16 pts/semana (escenario bajo) ≈ 17,5 h ⇒ dentro de 15–20 h/semana
  dedicacion: '15–20 h/semana (desarrollador único con IA, en paralelo con carga universitaria)',
};

export const FASES = [
  { id: 'H', nombre: 'Hitos', color: '#111827' },
  { id: 'F0', nombre: 'Antecedentes (trabajo previo)', color: '#64748b' },
  { id: 'F1', nombre: 'Análisis y diseño', color: '#2563eb' },
  { id: 'F2', nombre: 'Construcción y remediación', color: '#d97706' },
  { id: 'F3', nombre: 'Infraestructura y despliegue', color: '#7c3aed' },
  { id: 'F4', nombre: 'Calidad, pruebas y cumplimiento', color: '#059669' },
  { id: 'F5', nombre: 'Documentación de tesis y cierre', color: '#db2777' },
];

// tipo: 'tarea' | 'hito' | 'buffer'
// estado: 'completado' | 'en_progreso' | 'pendiente'
const T = (o) => ({ tipo: 'tarea', deps: [], jira: [], critica: false, ...o });
const H = (o) => ({ tipo: 'hito', deps: [], jira: [], critica: false, horas: 0, ...o, fin: o.inicio });

export const TAREAS = [
  // ───────────────────────── Hitos ─────────────────────────
  H({ id: 'H01', fase: 'H', nombre: 'Creación del repositorio', inicio: '2025-11-23', estado: 'completado', base: 'evidencia', fuente: '74736d6 first commit' }),
  H({ id: 'H02', fase: 'H', nombre: 'MVP etiquetado v0.1.0', inicio: '2026-03-08', estado: 'completado', base: 'evidencia', fuente: '3cc0b73 · CHANGELOG [0.1.0]', deps: ['A03'] }),
  H({ id: 'H03', fase: 'H', nombre: 'v0.3.0: alertas, Sentry y E2E en CI', inicio: '2026-04-16', estado: 'completado', base: 'evidencia', fuente: '820461c · CHANGELOG [0.3.0]', deps: ['A05'] }),
  H({ id: 'H04', fase: 'H', nombre: 'Inicio del semestre 2026-2 (S1)', inicio: '2026-08-03', estado: 'completado', base: 'dato', fuente: 'Calendario académico (dato del autor)' }),
  H({ id: 'H05', fase: 'H', nombre: 'Auditoría pre-producción', inicio: '2026-08-25', estado: 'completado', base: 'evidencia', fuente: 'docs/AUDITORIA_PREPRODUCCION_2026-08-25.md' }),
  H({ id: 'H06', fase: 'H', nombre: 'Auditorías pre-launch y de cierre; producción estable', inicio: '2026-09-11', estado: 'completado', base: 'evidencia', fuente: '17c7de2 (AUDITORIA_INTEGRAL_PRE_LAUNCH) · 96f478d (AUDITORIA_CIERRE) · main d2f7cef', deps: ['C03', 'I03'] }),
  H({ id: 'H07', fase: 'H', nombre: 'Auditoría del formulario de conciliación', inicio: '2026-10-12', estado: 'completado', base: 'evidencia', fuente: 'docs/AUDITORIA_FORMULARIO_CONCILIACION_2026-10-12.md' }),
  H({ id: 'H08', fase: 'H', nombre: 'Release candidate v1.0.0-rc.1', inicio: '2026-10-18', estado: 'completado', base: 'evidencia', fuente: '2a35e51 · CHANGELOG [1.0.0-rc.1]', deps: ['I07'] }),
  H({ id: 'H09', fase: 'H', nombre: 'v1.0.0-rc.2', inicio: '2026-11-08', estado: 'pendiente', base: 'estimado', fuente: 'Jira Fix Version v1.0.0-rc.2 (PROCESO_SCRUM §4.8, §5.5)', deps: ['C19', 'C20', 'C21', 'Q07', 'Q08'] }),
  H({ id: 'H10', fase: 'H', nombre: 'UAT firmado por ambos centros', inicio: '2026-11-22', estado: 'pendiente', base: 'estimado', fuente: 'Jira E14-14 (sprint W47)', deps: ['Q12'], critica: true }),
  H({ id: 'H11', fase: 'H', nombre: 'Release 1.0.0 + corte del 70 % (fin de 2026-2)', inicio: '2026-11-29', estado: 'pendiente', base: 'estimado', fuente: 'Jira E10-30 (sprint W48) · requisito académico del 70 %', deps: ['I12', 'D01'], critica: true }),
  H({ id: 'H12', fase: 'H', nombre: 'Inicio del semestre 2027-1 (S18)', inicio: '2027-02-01', estado: 'pendiente', base: 'dato', fuente: 'Calendario académico (dato del autor)' }),
  H({ id: 'H13', fase: 'H', nombre: 'v1.1.0', inicio: '2027-03-07', estado: 'pendiente', base: 'estimado', fuente: 'Jira Fix Version v1.1.0 (ítems Should)', deps: ['X02', 'X03', 'X04', 'X05', 'X06'] }),
  H({ id: 'H14', fase: 'H', nombre: 'Entrega del documento final', inicio: '2027-03-21', estado: 'pendiente', base: 'estimado', fuente: 'Estimado (fecha a confirmar con la universidad)', deps: ['D02'], critica: true }),
  H({ id: 'H15', fase: 'H', nombre: 'Sustentación', inicio: '2027-03-26', estado: 'pendiente', base: 'estimado', fuente: 'Estimado (fecha a confirmar con la universidad)', deps: ['D05', 'D04'], critica: true }),

  // ─────────────── F0 · Antecedentes (antes del semestre 2026-2) ───────────────
  T({ id: 'A01', fase: 'F0', nombre: 'Análisis y diseño inicial (equipo de tesis)', inicio: '2025-11-03', fin: '2026-02-01', estado: 'completado', avance: 100, puntos: 36, base: 'inferido', fuente: 'docs/diseno/Diagrama de Gantt - Insolventic.png · Jira E00-01…E00-08 (fechas inferidas, PROCESO_SCRUM §5.1)', jira: ['E00-01', 'E00-08'] }),
  T({ id: 'A02', fase: 'F0', nombre: 'Prototipo base: auth, casos y documentos HTML', inicio: '2026-02-02', fin: '2026-03-01', estado: 'completado', avance: 100, puntos: 53, base: 'evidencia', fuente: '72493d9 · 83d2d71 · df0ba7c · ba65470 · fcd2670', deps: ['A01'] }),
  T({ id: 'A03', fase: 'F0', nombre: 'Pruebas, hardening y v0.1.0', inicio: '2026-03-02', fin: '2026-03-15', estado: 'completado', avance: 100, puntos: 36, base: 'evidencia', fuente: 'c40cfb7 (111 tests) · abfc674 · 0b3c085 · 3cc0b73', deps: ['A02'] }),
  T({ id: 'A04', fase: 'F0', nombre: 'RBAC, auditoría, dashboard, pagos y reportes', inicio: '2026-03-16', fin: '2026-03-29', estado: 'completado', avance: 100, puntos: 54, base: 'evidencia', fuente: 'eaf4df4 · 6323d88 · 82812b5 · e777c30', deps: ['A03'] }),
  T({ id: 'A05', fase: 'F0', nombre: 'Conciliación, DOCX, alertas y Sentry (v0.2–v0.3)', inicio: '2026-03-30', fin: '2026-04-19', estado: 'completado', avance: 100, puntos: 96, base: 'evidencia', fuente: 'CHANGELOG [0.2.0] y [0.3.0] · 820461c', deps: ['A04'] }),
  T({ id: 'A06', fase: 'F0', nombre: 'Acuerdos de Apoyo y pruebas de carga k6', inicio: '2026-04-20', fin: '2026-04-26', estado: 'completado', avance: 100, puntos: 11, base: 'evidencia', fuente: '19e4227 · 2c43446', deps: ['A05'] }),
  T({ id: 'A07', fase: 'F0', nombre: 'Auditoría de documentos (P2–P4) y logger', inicio: '2026-07-06', fin: '2026-07-12', estado: 'completado', avance: 100, puntos: 29, base: 'evidencia', fuente: 'docs/AUDITORIA_MODULO_GENERACION_2026-07.md · 758b733 · 177cf24 · 40a5a59', deps: ['A06'] }),

  // ─────────────── F1 · Análisis y diseño ───────────────
  T({ id: 'T01', fase: 'F1', nombre: 'Requisitos, MER, diccionario y diagramas', inicio: '2026-08-10', fin: '2026-08-16', estado: 'completado', avance: 100, puntos: 5, base: 'evidencia', fuente: '660fffd (REQUISITOS_INSOLVENTIC.xlsx) · 849d96b (diccionario, MER, clases) · 7280aa9 (componentes)', jira: ['E09-13'] }),
  T({ id: 'T02', fase: 'F1', nombre: 'Diseño de las 5 fases nuevas del expediente', inicio: '2026-09-11', fin: '2026-09-11', estado: 'completado', avance: 100, puntos: 2, base: 'evidencia', fuente: '9da5173 · docs/DISENO_FASES_NUEVAS_2026-09-11.md', jira: ['E12-01'] }),
  T({ id: 'T03', fase: 'F1', nombre: 'Diseño del branding por centro', inicio: '2026-09-30', fin: '2026-10-01', estado: 'completado', avance: 100, puntos: 2, base: 'evidencia', fuente: '#82 74aec37 · docs/BRANDING_POR_CENTRO_2026-09-30.md', jira: ['E04-06'] }),
  T({ id: 'T04', fase: 'F1', nombre: 'Diseño del apoderado del acreedor (CYG)', inicio: '2026-10-09', fin: '2026-10-09', estado: 'completado', avance: 100, puntos: 2, base: 'evidencia', fuente: 'bfaa37a · docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md', jira: ['E05-11'] }),
  T({ id: 'T05', fase: 'F1', nombre: 'Backlog Jira, proceso Scrum y cronograma', inicio: '2026-10-19', fin: '2026-10-25', estado: 'en_progreso', avance: 70, horas: 8, base: 'evidencia', fuente: 'docs/jira/ y docs/IMPLEMENTACION_SEMANA_6–15.md (sin commitear) · docs/gantt/' }),

  // ─────────────── F2 · Construcción y remediación ───────────────
  T({ id: 'C01', fase: 'F2', nombre: 'Seguridad crítica (Semana 1)', inicio: '2026-08-26', fin: '2026-08-26', estado: 'completado', avance: 100, puntos: 9, base: 'evidencia', fuente: 'docs/IMPLEMENTACION_SEMANA_1.md · bfdeb47 · 9e037be · a9a1e4d · c507501', deps: ['H05'], jira: ['E03-11', 'E03-15'] }),
  T({ id: 'C02', fase: 'F2', nombre: 'Rate limit, health check y runbook (Semana 2)', inicio: '2026-08-26', fin: '2026-08-26', estado: 'completado', avance: 100, puntos: 11, base: 'evidencia', fuente: 'docs/IMPLEMENTACION_SEMANA_2.md · 8a8a1ae · 57fd2c5 · f542f22', deps: ['H05'], jira: ['E03-16', 'E09-03', 'E09-05'] }),
  T({ id: 'C03', fase: 'F2', nombre: 'Lógica de negocio en el servidor (PR #4)', inicio: '2026-09-02', fin: '2026-09-11', estado: 'completado', avance: 100, puntos: 23, base: 'evidencia', fuente: 'docs/IMPLEMENTACION_SEMANA_3.md · PR #4 17c7de2', deps: ['C01'], jira: ['E01-16', 'E01-17', 'E02-14', 'E02-15', 'E14-04'] }),
  T({ id: 'C04', fase: 'F2', nombre: 'Apoderados del deudor, sesión y rendimiento', inicio: '2026-09-14', fin: '2026-09-20', estado: 'completado', avance: 100, puntos: 26, base: 'evidencia', fuente: 'e05e409 · issue #9 · e7af5bf · f87a5ec · 276eea4', deps: ['C03'], jira: ['E05-04', 'E03-18', 'E13-04', 'E13-07'] }),
  T({ id: 'C05', fase: 'F2', nombre: 'Fechas y placeholders de documentos', inicio: '2026-09-21', fin: '2026-09-27', estado: 'completado', avance: 100, puntos: 6, base: 'evidencia', fuente: '7d74953 · d55ac1a', jira: ['E02-18', 'E02-19'] }),
  T({ id: 'C06', fase: 'F2', nombre: 'Ronda del formulario maestro', inicio: '2026-09-28', fin: '2026-10-03', estado: 'completado', avance: 100, puntos: 43, base: 'evidencia', fuente: 'PRs #60–#103 · docs/HALLAZGOS_CALIDAD_FORMULARIO_2026-09-28.md', deps: ['C04'], jira: ['E01-19', 'E01-27', 'E05-05', 'E05-10'] }),
  T({ id: 'C07', fase: 'F2', nombre: 'Cinco fases nuevas del expediente (PR #40)', inicio: '2026-09-28', fin: '2026-09-30', estado: 'completado', avance: 100, puntos: 19, base: 'evidencia', fuente: '#40 a0ac5d7 · docs/DEPLOY_PR40.md', deps: ['T02'], jira: ['E12-02', 'E12-06'] }),
  T({ id: 'C08', fase: 'F2', nombre: 'División del placeholder-mapper', inicio: '2026-09-29', fin: '2026-10-03', estado: 'completado', avance: 100, puntos: 21, base: 'evidencia', fuente: '#52 d1320ae · #100 93e1efe · docs/PLAN_DIVISION_MAPPER.md', deps: ['Q01'], jira: ['E13-08', 'E13-12'] }),
  T({ id: 'C09', fase: 'F2', nombre: 'Generación: todos los acreedores y un navegador', inicio: '2026-09-29', fin: '2026-10-03', estado: 'completado', avance: 100, puntos: 24, base: 'evidencia', fuente: '#57 2a202f9 · #77 ce8dcb3 · #110 b32e892', jira: ['E02-20', 'E02-26'] }),
  T({ id: 'C10', fase: 'F2', nombre: 'Correcciones de documentos (fechas, causas, apoyo)', inicio: '2026-10-05', fin: '2026-10-08', estado: 'completado', avance: 100, puntos: 17, base: 'evidencia', fuente: '#112 · #113 · #117 · #118 · #119 · #120', deps: ['Q02'], jira: ['E02-27', 'E02-31', 'E01-28'] }),
  T({ id: 'C11', fase: 'F2', nombre: 'Membrete y branding por centro', inicio: '2026-10-09', fin: '2026-10-10', estado: 'completado', avance: 100, puntos: 27, base: 'evidencia', fuente: '#121 · #126 · #128 · #132–#135 · docs/CHECKPOINT_2026-10-09.md', deps: ['T03'], jira: ['E04-07', 'E04-13'] }),
  T({ id: 'C12', fase: 'F2', nombre: 'Apoderado del acreedor: modelo y captura', inicio: '2026-10-09', fin: '2026-10-09', estado: 'completado', avance: 100, puntos: 8, base: 'evidencia', fuente: '#130 af53a6f · #131 613e327', deps: ['T04'], jira: ['E05-12', 'E05-13'] }),
  T({ id: 'C13', fase: 'F2', nombre: 'Separador de miles y ESLint en cero', inicio: '2026-10-09', fin: '2026-10-11', estado: 'completado', avance: 100, puntos: 10, base: 'evidencia', fuente: '#136 c678020 · #124 4df5906 · #123 33ec217', jira: ['E01-29', 'E13-13', 'E03-21'] }),
  T({ id: 'C14', fase: 'F2', nombre: 'Bloqueantes de seguridad pre-entrega', inicio: '2026-10-17', fin: '2026-10-17', estado: 'completado', avance: 100, puntos: 25, base: 'evidencia', fuente: 'docs/IMPLEMENTACION_SEMANA_4.md y _7.md · #137 7ab6b5e · #140 376d83b', deps: ['H07'], jira: ['E03-22', 'E03-29'] }),
  T({ id: 'C15', fase: 'F2', nombre: 'Formulario de conciliación completo', inicio: '2026-10-17', fin: '2026-10-17', estado: 'completado', avance: 100, puntos: 14, base: 'evidencia', fuente: 'docs/IMPLEMENTACION_SEMANA_5.md y _6.md · #138 fe82fe6 · #139 0a41c56', deps: ['H07'], jira: ['E01-32', 'E01-35'] }),
  T({ id: 'C16', fase: 'F2', nombre: 'Generación de lotes grandes en tandas', inicio: '2026-10-17', fin: '2026-10-17', estado: 'completado', avance: 100, puntos: 8, base: 'evidencia', fuente: '#140 376d83b · issue #3 · docs/IMPLEMENTACION_SEMANA_7.md', deps: ['C09'], jira: ['E02-32'] }),
  T({ id: 'C17', fase: 'F2', nombre: 'Montos, carpeta de Drive y apoderado único', inicio: '2026-10-18', fin: '2026-10-19', estado: 'completado', avance: 100, puntos: 14, base: 'evidencia', fuente: '#144 · #145 · #146 · #147 · docs/IMPLEMENTACION_SEMANA_10–13.md', jira: ['E01-30', 'E01-31', 'E04-14', 'E05-14'] }),
  T({ id: 'C18', fase: 'F2', nombre: 'Bienes en dos niveles y notificaciones', inicio: '2026-10-19', fin: '2026-10-19', estado: 'completado', avance: 100, puntos: 8, base: 'evidencia', fuente: '#148 25d6d7e · #149 b29166c · docs/IMPLEMENTACION_SEMANA_14–15.md', jira: ['E01-36', 'E01-37', 'E07-07'] }),
  T({ id: 'C19', fase: 'F2', nombre: 'Riesgos de código: bloqueo optimista y requisitos', inicio: '2026-10-26', fin: '2026-11-01', estado: 'pendiente', avance: 0, puntos: 14, base: 'estimado', fuente: 'Jira sprint W44 (PROCESO_SCRUM §5.5)', jira: ['E01-38', 'E01-39', 'E02-33', 'E03-30', 'E14-10', 'E02-37'] }),
  T({ id: 'C20', fase: 'F2', nombre: 'Bloquear el CYG con apoderado contradictorio', inicio: '2026-11-02', fin: '2026-11-08', estado: 'pendiente', avance: 0, puntos: 5, base: 'estimado', fuente: 'Jira sprint W45', deps: ['C12'], jira: ['E05-15'], critica: true }),
  T({ id: 'C21', fase: 'F2', nombre: 'Documentos de Rechazo y de Retiro', inicio: '2026-11-02', fin: '2026-11-08', estado: 'pendiente', avance: 0, puntos: 5, base: 'estimado', fuente: 'Jira sprint W45 · legal-pendiente (R1)', deps: ['C07'], jira: ['E12-07'] }),
  T({ id: 'C22', fase: 'F2', nombre: 'Resolver conflicto de apoderado en la UI', inicio: '2026-11-09', fin: '2026-11-15', estado: 'pendiente', avance: 0, puntos: 5, base: 'estimado', fuente: 'Jira sprint W46', deps: ['C20'], jira: ['E05-16'], critica: true }),
  T({ id: 'C23', fase: 'F2', nombre: 'Regenerar documentos sin duplicados', inicio: '2026-11-16', fin: '2026-11-22', estado: 'pendiente', avance: 0, puntos: 5, base: 'estimado', fuente: 'Jira sprint W47', deps: ['Q06'], jira: ['E02-35'] }),
  T({ id: 'C24', fase: 'F2', nombre: 'Estado de la generación visible en el caso', inicio: '2026-11-16', fin: '2026-11-22', estado: 'pendiente', avance: 0, puntos: 3, base: 'estimado', fuente: 'Jira sprint W47 · Should: primer ítem en moverse si falta capacidad', jira: ['E02-36'] }),
  T({ id: 'X02', fase: 'F2', nombre: 'v1.1: borrado lógico de expedientes', inicio: '2027-02-08', fin: '2027-02-21', estado: 'pendiente', avance: 0, puntos: 8, base: 'estimado', fuente: 'Jira v1.1.0 · CLAUDE.md Fase 3 (soft-delete)', deps: ['Q10'], jira: ['E01-40', 'E01-42'] }),

  // ─────────────── F3 · Infraestructura y despliegue ───────────────
  T({ id: 'I01', fase: 'F3', nombre: 'Deploy nativo Vercel y migraciones gateadas', inicio: '2026-08-12', fin: '2026-08-18', estado: 'completado', avance: 100, puntos: 7, base: 'evidencia', fuente: 'ae6b2ae · 6090f1f · 70868c6 · CLAUDE.md Session 3', jira: ['E10-08', 'E10-09', 'E10-10'] }),
  T({ id: 'I02', fase: 'F3', nombre: 'CI: memoria del build y pruebas E2E', inicio: '2026-09-04', fin: '2026-09-10', estado: 'completado', avance: 100, puntos: 4, base: 'evidencia', fuente: '#5 1ad141b · #12 2360250', deps: ['I01'], jira: ['E10-11', 'E14-03'] }),
  T({ id: 'I03', fase: 'F3', nombre: 'Incidentes de producción y regla de autoría', inicio: '2026-09-07', fin: '2026-09-11', estado: 'completado', avance: 100, puntos: 12, base: 'evidencia', fuente: 'docs/CHECKPOINT_2026-09-09.md · a54d92e · #13 e9dd65a · 596dae6', deps: ['I01'], jira: ['E01-15', 'E09-06', 'E10-12', 'E10-13'] }),
  T({ id: 'I04', fase: 'F3', nombre: 'Runbooks de Drive y BD; robustez del build', inicio: '2026-09-18', fin: '2026-09-20', estado: 'completado', avance: 100, puntos: 8, base: 'evidencia', fuente: '1b7f7cd · 516bac9 · 5a7bec3 · 50d96ed', jira: ['E09-07', 'E09-08', 'E10-14', 'E10-15'] }),
  T({ id: 'I05', fase: 'F3', nombre: 'Observabilidad y CI (Sentry, versión, caché)', inicio: '2026-09-28', fin: '2026-10-03', estado: 'completado', avance: 100, puntos: 10, base: 'evidencia', fuente: '#38 cb4c525 · #55 db9c215 · #109 da6e928 · #111 a9802ee · 3eccc72', jira: ['E09-09', 'E09-11', 'E10-16', 'E10-17'] }),
  T({ id: 'I06', fase: 'F3', nombre: 'Migraciones desde cero y Postgres en CI', inicio: '2026-10-08', fin: '2026-10-09', estado: 'completado', avance: 100, puntos: 12, base: 'evidencia', fuente: '#58 7733272 · #122 2f1375c · #127 92b416b · 0dad100 · docs/DIAGNOSTICO_PROMOCION_MAIN_2026-10-08.md', jira: ['E10-18', 'E10-21'] }),
  T({ id: 'I07', fase: 'F3', nombre: 'CI en PRs apilados y versión rc.1', inicio: '2026-10-17', fin: '2026-10-17', estado: 'completado', avance: 100, puntos: 3, base: 'evidencia', fuente: '#142 7edc0cf · 2a35e51', jira: ['E10-22', 'E10-23'] }),
  T({ id: 'I08', fase: 'F3', nombre: 'Desplegar sin reescribir el autor (plan Vercel)', inicio: '2026-11-23', fin: '2026-11-25', estado: 'pendiente', avance: 0, puntos: 2, base: 'estimado', fuente: 'Jira sprint W48 · issue #7', jira: ['E10-25'], critica: true }),
  T({ id: 'I09', fase: 'F3', nombre: 'Prueba real de restauración del backup', inicio: '2026-11-23', fin: '2026-11-26', estado: 'pendiente', avance: 0, puntos: 3, base: 'estimado', fuente: 'Jira sprint W48 · docs/RUNBOOK.md', jira: ['E10-24'], critica: true }),
  T({ id: 'I10', fase: 'F3', nombre: 'Verificación operativa en producción', inicio: '2026-11-23', fin: '2026-11-27', estado: 'pendiente', avance: 0, puntos: 3, base: 'estimado', fuente: 'Jira sprint W48', jira: ['E09-17', 'E09-19', 'E09-20'] }),
  T({ id: 'I11', fase: 'F3', nombre: 'Transferir cuentas a los centros', inicio: '2026-11-25', fin: '2026-11-28', estado: 'pendiente', avance: 0, puntos: 3, base: 'estimado', fuente: 'Jira sprint W48 (inferido)', deps: ['I08'], jira: ['E10-26'], critica: true }),
  T({ id: 'I12', fase: 'F3', nombre: 'Publicar 1.0.0 y entregar a los centros', inicio: '2026-11-28', fin: '2026-11-29', estado: 'pendiente', avance: 0, puntos: 1, base: 'estimado', fuente: 'Jira sprint W48', deps: ['H10', 'I09', 'I11'], jira: ['E10-30'], critica: true }),
  { id: 'B01', fase: 'F3', tipo: 'buffer', nombre: 'Contingencia del release (solo si se desliza)', inicio: '2026-11-30', fin: '2026-12-11', estado: 'pendiente', avance: 0, horas: 0, base: 'estimado', fuente: 'Reserva fuera de las 25 semanas: absorbe R2/R3 sin mover el corte académico más de 2 semanas', deps: ['I12'], jira: [], critica: false },
  T({ id: 'X01', fase: 'F3', nombre: 'Estabilización y operación asistida', inicio: '2027-02-01', fin: '2027-02-14', estado: 'pendiente', avance: 0, horas: 8, base: 'estimado', fuente: 'Estimado: primeras semanas tras el receso (R9)', deps: ['I12'] }),
  T({ id: 'X03', fase: 'F3', nombre: 'v1.1: cerrar la deriva de migraciones', inicio: '2027-02-15', fin: '2027-02-28', estado: 'pendiente', avance: 0, puntos: 7, base: 'estimado', fuente: 'Jira v1.1.0 · CLAUDE.md Fase 3 (requiere acceso a Neon)', jira: ['E10-28', 'E10-29'] }),
  T({ id: 'X04', fase: 'F3', nombre: 'v1.1: observabilidad y seguridad', inicio: '2027-02-01', fin: '2027-02-21', estado: 'pendiente', avance: 0, puntos: 10, base: 'estimado', fuente: 'Jira v1.1.0', deps: ['I11'], jira: ['E13-15', 'E09-18', 'E07-08', 'E10-27'] }),

  // ─────────────── F4 · Calidad, pruebas y cumplimiento ───────────────
  T({ id: 'Q01', fase: 'F4', nombre: 'Red de pruebas: Postgres real y golden master', inicio: '2026-09-19', fin: '2026-09-20', estado: 'completado', avance: 100, puntos: 11, base: 'evidencia', fuente: '73841cc · 5ad7934 · e572146', jira: ['E14-05', 'E14-06', 'E14-07'] }),
  T({ id: 'Q02', fase: 'F4', nombre: 'Plan de pruebas y verificación E2E de documentos', inicio: '2026-10-03', fin: '2026-10-03', estado: 'completado', avance: 100, puntos: 3, base: 'evidencia', fuente: 'docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md · docs/TESTS.md', jira: ['E14-09'] }),
  T({ id: 'Q03', fase: 'F4', nombre: 'Suite formulario → BD → documento', inicio: '2026-10-08', fin: '2026-10-08', estado: 'completado', avance: 100, puntos: 5, base: 'evidencia', fuente: '#116 925c007', jira: ['E14-08'] }),
  T({ id: 'Q04', fase: 'F4', nombre: 'Fundamento normativo y pendientes legales', inicio: '2026-10-01', fin: '2026-10-09', estado: 'completado', avance: 100, puntos: 5, base: 'evidencia', fuente: '#90 fe7e1df · 0f15dbf · #129 1683150 · docs/PENDIENTES_DECISION_LEGAL.md', jira: ['E11-03', 'E11-06'] }),
  T({ id: 'Q05', fase: 'F4', nombre: 'Ley 1581: privacidad, términos, ARCO y manual', inicio: '2026-10-17', fin: '2026-10-17', estado: 'completado', avance: 100, puntos: 10, base: 'evidencia', fuente: '#141 6aa58d1 · docs/PROCEDIMIENTO_ARCO.md · docs/MANUAL_USUARIO.md', jira: ['E11-01', 'E11-02', 'E09-14', 'E09-15'] }),
  T({ id: 'Q06', fase: 'F4', nombre: 'Política de versiones al regenerar (spike)', inicio: '2026-10-26', fin: '2026-11-01', estado: 'pendiente', avance: 0, puntos: 2, base: 'estimado', fuente: 'Jira sprint W44 · legal-pendiente', jira: ['E02-34'] }),
  T({ id: 'Q07', fase: 'F4', nombre: 'Legal I: SMMLV 2026 y Check List Parágrafo 3', inicio: '2026-11-02', fin: '2026-11-08', estado: 'pendiente', avance: 0, puntos: 4, base: 'estimado', fuente: 'Jira sprint W45 · legal-pendiente (R1)', jira: ['E11-09', 'E11-10'] }),
  T({ id: 'Q08', fase: 'F4', nombre: 'Cierre técnico de rc.2 (Sentry y docs)', inicio: '2026-11-02', fin: '2026-11-08', estado: 'pendiente', avance: 0, puntos: 2, base: 'estimado', fuente: 'Jira sprint W45', jira: ['E09-16', 'E13-23'] }),
  T({ id: 'Q09', fase: 'F4', nombre: 'Legal II: umbrales y cuenta de Armonía', inicio: '2026-11-09', fin: '2026-11-15', estado: 'pendiente', avance: 0, puntos: 4, base: 'estimado', fuente: 'Jira sprint W46 · legal-pendiente (R1)', jira: ['E11-18', 'E04-15'] }),
  T({ id: 'Q10', fase: 'F4', nombre: 'Ley 1581: retención, privacidad y ARCO', inicio: '2026-11-09', fin: '2026-11-15', estado: 'pendiente', avance: 0, puntos: 7, base: 'estimado', fuente: 'Jira sprint W46 · legal-pendiente (R1)', deps: ['Q05'], jira: ['E11-17', 'E11-13', 'E11-14', 'E11-15'] }),
  T({ id: 'Q11', fase: 'F4', nombre: 'Prueba E2E de aislamiento entre centros', inicio: '2026-11-16', fin: '2026-11-18', estado: 'pendiente', avance: 0, puntos: 3, base: 'estimado', fuente: 'Jira sprint W47', jira: ['E14-13'], critica: true }),
  T({ id: 'Q12', fase: 'F4', nombre: 'UAT con guion por rol en ambos centros', inicio: '2026-11-18', fin: '2026-11-22', estado: 'pendiente', avance: 0, puntos: 5, base: 'estimado', fuente: 'Jira sprint W47 (R3)', deps: ['Q11', 'C22'], jira: ['E14-14'], critica: true }),
  { id: 'Q13', fase: 'F4', tipo: 'buffer', nombre: 'Buffer: correcciones post-UAT', inicio: '2026-11-23', fin: '2026-11-29', estado: 'pendiente', avance: 0, horas: 5, base: 'estimado', fuente: 'Holgura del sprint W48 (12/16 pts usados ⇒ 4 pts libres)', deps: ['Q12'], jira: [], critica: false },
  T({ id: 'X05', fase: 'F4', nombre: 'v1.1: pendientes legales', inicio: '2027-02-08', fin: '2027-03-07', estado: 'pendiente', avance: 0, puntos: 14, base: 'estimado', fuente: 'Jira v1.1.0 · legal-pendiente · issue #16', jira: ['E11-07', 'E11-08', 'E12-08', 'E11-11', 'E11-16'] }),
  T({ id: 'X06', fase: 'F4', nombre: 'v1.1: deuda técnica y pruebas', inicio: '2027-02-22', fin: '2027-03-07', estado: 'pendiente', avance: 0, puntos: 14, base: 'estimado', fuente: 'Jira v1.1.0 (ítems Should)', jira: ['E06-03', 'E13-16', 'E13-22', 'E14-11', 'E14-15'] }),

  // ─────────────── F5 · Documentación de tesis y cierre ───────────────
  T({ id: 'D01', fase: 'F5', nombre: 'Informe de avance del 70 %', inicio: '2026-10-26', fin: '2026-11-29', estado: 'pendiente', avance: 0, horas: 12, base: 'estimado', fuente: 'Estimado: entregable académico del semestre 2026-2', critica: true }),
  T({ id: 'D02', fase: 'F5', nombre: 'Documento final de tesis', inicio: '2027-02-01', fin: '2027-03-21', estado: 'pendiente', avance: 0, horas: 40, base: 'estimado', fuente: 'Estimado · Gantt original: "Documento final y actas de aceptación"', deps: ['D01', 'I12'], critica: true }),
  T({ id: 'D03', fase: 'F5', nombre: 'Guía y manuales de mantenimiento (v1.1)', inicio: '2027-03-01', fin: '2027-03-14', estado: 'pendiente', avance: 0, horas: 8, base: 'estimado', fuente: 'Estimado · Gantt original: "Guía y manuales de mantenimiento" · docs/RUNBOOK.md', deps: ['X01'] }),
  T({ id: 'D04', fase: 'F5', nombre: 'Actas de aceptación de los centros', inicio: '2027-03-08', fin: '2027-03-21', estado: 'pendiente', avance: 0, horas: 4, base: 'estimado', fuente: 'Estimado · Gantt original: "actas de aceptación"', deps: ['H10', 'H13'], critica: true }),
  T({ id: 'D05', fase: 'F5', nombre: 'Preparación de la sustentación', inicio: '2027-03-15', fin: '2027-03-26', estado: 'pendiente', avance: 0, horas: 12, base: 'estimado', fuente: 'Estimado', deps: ['D02'], critica: true }),
  { id: 'D06', fase: 'F5', tipo: 'buffer', nombre: 'Buffer de cierre', inicio: '2027-03-22', fin: '2027-03-28', estado: 'pendiente', avance: 0, horas: 4, base: 'estimado', fuente: 'Holgura para correcciones del jurado', deps: ['D02'], jira: [], critica: false },
];

export const RIESGOS = [
  { id: 'R1', riesgo: 'Las respuestas legales (abogada, centros) no llegan a tiempo: SMMLV, Check List P3, umbrales, textos de Rechazo/Retiro, Ley 1581.', prob: 'Alta', impacto: 'Alto', cronograma: 'Q07, Q09, Q10 y C21 (S14–S15) pasan a v1.1 en 2027-1. El release 1.0.0 no se mueve (no dependen de él), pero sale sin esos documentos.', mitigacion: 'Enviar una sola hoja con reglas y valores a confirmar al inicio de S13; registrar respuestas en PENDIENTES_DECISION_LEGAL.md.', fuente: 'PROCESO_SCRUM §6 R1, R11, R13' },
  { id: 'R2', riesgo: 'Capacidad al tope en S13–S17: 16 pts/semana + informe del 70 % ≈ 19–20 h/semana, justo en parciales y finales.', prob: 'Alta', impacto: 'Alto', cronograma: 'Release y corte del 70 % +1 semana (consume la contingencia B01, 30 nov – 11 dic).', mitigacion: 'C24 (Should, 3 pts) es el primero en pasar a v1.1; recalibrar la velocidad al cerrar S14 (PROCESO_SCRUM §5.2).', fuente: 'PROCESO_SCRUM §5.1, R9 · este Gantt (fila de carga)' },
  { id: 'R3', riesgo: 'Los centros no tienen agenda para ejecutar y firmar el UAT en S16.', prob: 'Media', impacto: 'Alto', cronograma: 'Sin UAT no hay release (I12 depende de H10): +1 semana.', mitigacion: 'Agendar al cerrar S14 y enviar el guion una semana antes; permitir firmas por separado; I09/I11 siguen en paralelo.', fuente: 'PROCESO_SCRUM §6 R10' },
  { id: 'R4', riesgo: 'El backup de producción nunca se ha restaurado: el runbook es teórico.', prob: 'Media', impacto: 'Muy alto', cronograma: 'Si falla en S17, el release espera la corrección (contingencia B01).', mitigacion: 'I09 antes del release; si se puede, adelantarlo a S15.', fuente: 'PROCESO_SCRUM §6 R5' },
  { id: 'R5', riesgo: 'El plan Hobby de Vercel bloquea deploys por el autor del commit.', prob: 'Alta', impacto: 'Medio', cronograma: 'Cada deploy requiere un amend manual; si se olvida, el release de S17 queda Blocked.', mitigacion: 'Regla de autoría de CLAUDE.md; solución de fondo en I08 (vincular la cuenta o pasar a Pro).', fuente: 'issue #7 · CLAUDE.md Session 3' },
  { id: 'R6', riesgo: 'Desarrollador único: el conocimiento está en una persona y en los documentos de sesión.', prob: 'Alta', impacto: 'Alto', cronograma: 'Cualquier ausencia detiene la ruta crítica.', mitigacion: 'Runbooks, manual, CLAUDE.md al día (Q08) y transferencia de cuentas (I11).', fuente: 'PROCESO_SCRUM §6 R3' },
  { id: 'R7', riesgo: 'Reconocimiento académico del trabajo previo (Antecedentes, nov 2025 – jul 2026) ante el director y el jurado.', prob: 'Media', impacto: 'Alto', cronograma: 'No mueve el software. Si no se acuerda pronto, obliga a reescribir el informe del 70 % (D01).', mitigacion: 'Acordarlo con el director al inicio de S13 y presentarlo como prototipo previo con fechas reales. El historial de git no se modifica.', fuente: 'Este Gantt (decisión de enfoque)' },
  { id: 'R8', riesgo: 'Cerrar la deriva de migraciones requiere acceso a Neon y una ventana segura.', prob: 'Baja', impacto: 'Alto', cronograma: 'X03 (S20–S21) puede quedar documentada sin cerrarse; no bloquea la sustentación.', mitigacion: 'Guardián BRECHA_CONOCIDA en tests/db; decidir el camino (catch-up vs. baseline) en el spike E10-28.', fuente: 'CLAUDE.md Fase 3 · PROCESO_SCRUM §6 R6' },
  { id: 'R9', riesgo: 'Receso de diciembre y enero: producción sin cobertura y pérdida de contexto.', prob: 'Media', impacto: 'Medio', cronograma: 'S18–S19 se dedican a estabilizar antes de abrir v1.1.', mitigacion: 'Alertas proactivas activas, runbook de incidentes, X01 al regreso.', fuente: 'Este Gantt' },
  { id: 'R10', riesgo: 'Decisiones del cliente sin ratificar: bloqueo duro vs. marca de agua; generación individual vs. por lote.', prob: 'Media', impacto: 'Medio', cronograma: 'Cambia el alcance de C19, C24 y Q12; puede reabrir trabajo en S16.', mitigacion: 'Llevar ambas preguntas a la review de S13 con ejemplos.', fuente: 'PROCESO_SCRUM §6 R12' },
  { id: 'R11', riesgo: 'Las fechas de entrega del documento final y de la sustentación no están confirmadas.', prob: 'Media', impacto: 'Medio', cronograma: 'H14/H15 pueden moverse dentro de 2027-1; D02 y D05 se reajustan.', mitigacion: 'Confirmar el calendario de 2027-1 en cuanto se publique y actualizar datos.mjs.', fuente: 'Este Gantt' },
];
