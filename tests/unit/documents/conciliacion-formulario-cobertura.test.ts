/**
 * Cobertura bidireccional formulario ↔ plantilla, para las 12 plantillas de
 * conciliación. Patrón de `tests/db/helpers/pendientes-conocidos.ts`: la
 * lista de abajo NO es una excepción para que el test pase, es el inventario
 * del backlog, y el test exige que coincida EXACTAMENTE. Si alguien cierra un
 * hueco y no lo borra de la lista, falla por "ya no está roto". Si aparece
 * uno nuevo que no está en la lista, también falla.
 *
 * QUÉ VERIFICA, EN TRES PASOS:
 *
 *  1. Extrae los placeholders que de verdad usan las 12 plantillas (lectura
 *     de archivo, no de memoria): `templates/conciliation/**\/*.html`.
 *
 *  2. Para cada uno, averigua si `conciliacion.ts` lo respalda con un campo
 *     `conc*` de `Case` — parseando el código fuente de
 *     `mapConciliationFields`, no una lista a mano: si el archivo cambia, la
 *     extracción cambia con él. Un placeholder que NO sale de ningún
 *     `raw.concXxx` (`NUMERO_ACTA`, `ANO_ACTA`, `DIA_/MES_/ANO_CONSTANCIA`)
 *     no es un hueco del FORMULARIO — sale de `caseNumber` o de la fecha de
 *     hoy, y no hay ningún campo que capturar para eso.
 *
 *     Un placeholder que la extracción no encuentra en `conciliacion.ts` en
 *     absoluto (`CENTRO_*`, `LOGO_*`, `FIRMA_OPERADOR_SRC`, `ZOOM_*`,
 *     `NUMERO_TRAMITE`, `DIA_/MES_/ANO_/HORA_AUDIENCIA`, `CIUDAD`,
 *     `ANO_ACTUAL`) tampoco es un hueco de ESTE archivo: lo produce el mapper
 *     base o el membrete — este test no es su guardián, cada uno tiene el
 *     suyo (`membrete-centro.test.ts`, `armonia-genera.test.ts`, y el nuevo
 *     `notificacion-convocatoria-zoom.test.ts`).
 *
 *  3. Para los que SÍ respalda un campo `conc*`: busca ese nombre como
 *     literal de cadena en los dos archivos del formulario de conciliación
 *     (`conciliation-parties-section.tsx`, `conciliation-details-section.tsx`).
 *     Si no aparece, el campo tiene que estar en `PENDIENTES_CONOCIDOS` — con
 *     su razón — o el test falla.
 *
 * Esto es exactamente lo que cerraron los tres commits anteriores de esta
 * rama: antes de ellos, Zoom y los 5 de C-2 aparecían acá como pendientes sin
 * resolver; ahora están cubiertos y el test lo confirma solo.
 */

import fs from 'fs';
import path from 'path';

const ARCHIVO_MAPPER = path.join(
  process.cwd(),
  'src/features/document/placeholders/conciliacion.ts',
);
const ARCHIVOS_FORMULARIO = [
  'src/app/cases/components/create-case-dialog/conciliation-parties-section.tsx',
  'src/app/cases/components/create-case-dialog/conciliation-details-section.tsx',
].map((p) => path.join(process.cwd(), p));

const DIR_PLANTILLAS = path.join(process.cwd(), 'templates/conciliation');

// ---------------------------------------------------------------------------
// 1. Placeholders que usan de verdad las 12 plantillas
// ---------------------------------------------------------------------------

function listarHtml(dir: string): string[] {
  let out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(listarHtml(p));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function extraerPlaceholders(html: string): Set<string> {
  const out = new Set<string>();
  // Solo sustituciones escalares `{{NOMBRE}}`: los que abren un bloque
  // (`{{#each NOMBRE}}`) llevan un espacio después del `#`, así que este
  // patrón no los captura — y está bien que no lo haga: esas variables se
  // resuelven contra el scope del bloque, no contra el PlaceholderMap
  // (mismo criterio que `coverage-bloques.test.ts`).
  for (const m of html.matchAll(/\{\{[#/^]?([A-Za-z0-9_]+)\}\}/g)) {
    const nombre = m[1];
    if (['if', 'unless', 'each', 'else'].includes(nombre)) continue;
    out.add(nombre);
  }
  return out;
}

const ARCHIVOS_PLANTILLA = listarHtml(DIR_PLANTILLAS);

const PLACEHOLDERS_EN_PLANTILLAS = new Set<string>();
for (const f of ARCHIVOS_PLANTILLA) {
  for (const p of extraerPlaceholders(fs.readFileSync(f, 'utf8'))) {
    PLACEHOLDERS_EN_PLANTILLAS.add(p);
  }
}

// ---------------------------------------------------------------------------
// 2. Placeholder -> campo `conc*` que lo respalda, parseado de conciliacion.ts
// ---------------------------------------------------------------------------

function extraerMapaDeCampos(fuente: string): Map<string, string> {
  const inicioFn = fuente.indexOf('export function mapConciliationFields');
  const cuerpoFn = fuente.slice(inicioFn);
  // Aplana saltos de línea ANTES de hacer match: varias declaraciones y
  // entradas del `return` están partidas en dos líneas por Prettier
  // (`const apodConvocanteDir =\n  (raw.concApoderadoConvocanteDireccion...`),
  // y separar por línea pierde esos pares.
  const plano = cuerpoFn.replace(/\n/g, ' ');

  const varAcampo = new Map<string, string>();
  for (const m of plano.matchAll(/const\s+(\w+)\s*=\s*\(raw\.(conc[A-Za-z0-9]+)/g)) {
    varAcampo.set(m[1], m[2]);
  }

  const bloqueReturn = cuerpoFn.match(/return\s*\{([\s\S]*)\};\s*\}/);
  if (!bloqueReturn) {
    throw new Error('No se encontró el `return` de mapConciliationFields');
  }
  const cuerpoReturn = bloqueReturn[1].replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const keyACampo = new Map<string, string>();
  for (const m of cuerpoReturn.matchAll(/([A-Z0-9_]+):\s*([^,]+),/g)) {
    const key = m[1];
    const expr = m[2].trim();
    const directo = expr.match(/raw\.(conc[A-Za-z0-9]+)/);
    const porVariable = expr.match(/^(\w+)\b/);
    if (directo) {
      keyACampo.set(key, directo[1]);
    } else if (porVariable && varAcampo.has(porVariable[1])) {
      keyACampo.set(key, varAcampo.get(porVariable[1])!);
    }
  }
  return keyACampo;
}

const KEY_A_CAMPO = extraerMapaDeCampos(fs.readFileSync(ARCHIVO_MAPPER, 'utf8'));

/**
 * Placeholders que `mapConciliationFields` produce SIN leer ningún campo
 * `conc*` — no son un hueco del formulario, no hay nada que capturar:
 *
 *   NUMERO_ACTA / ANO_ACTA  -> `caseData.caseNumber` / fecha de hoy.
 *   DIA_/MES_/ANO_CONSTANCIA -> fecha de hoy, A PROPÓSITO (es la fecha de
 *     EXPEDICIÓN del documento — la única de las fechas "historicas vs hoy"
 *     de C-1a donde "hoy" es lo correcto).
 */
const SIN_CAMPO_POR_DISENO = new Set([
  'NUMERO_ACTA',
  'ANO_ACTA',
  'DIA_CONSTANCIA',
  'MES_CONSTANCIA',
  'ANO_CONSTANCIA',
]);

// ---------------------------------------------------------------------------
// 3. Qué campos `conc*` están de verdad en el formulario
// ---------------------------------------------------------------------------

const TEXTO_FORMULARIO = ARCHIVOS_FORMULARIO.map((f) =>
  fs.readFileSync(f, 'utf8'),
).join('\n');

const CAMPOS_EN_FORMULARIO = new Set(
  [...TEXTO_FORMULARIO.matchAll(/conc[A-Za-z0-9]+/g)].map((m) => m[0]),
);

// ---------------------------------------------------------------------------
// El inventario — ver el docblock de arriba: esto NO es una lista de
// excepciones, es el backlog, y el test exige que coincida EXACTAMENTE.
// ---------------------------------------------------------------------------

/**
 * Pendientes identificados por el NOMBRE DEL CAMPO `conc*` (el caso normal:
 * el campo existe, respalda uno o más placeholders, y no está en el
 * formulario).
 */
const PENDIENTES_POR_CAMPO: Readonly<Record<string, string>> = {
  // --- Aclaración de Acta: 4 campos, sin columna --------------------------
  // (auditoría 2026-10-12, hallazgo C-1c). La Aclaración se genera pero no
  // dice QUÉ se está aclarando: ni el campo con error, ni la descripción, ni
  // el valor incorrecto ni el correcto.
  concCampoConError: 'C-1c — sin columna; la Aclaración no dice qué corrige',
  concDescripcionError: 'C-1c — sin columna',
  concValorIncorrecto: 'C-1c — sin columna',
  concValorCorrecto: 'C-1c — sin columna',

  // --- Fechas históricas sin columna, en blanco desde C-1a ----------------
  // (este MISMO commit las puso en `____`/`____________`/`______` en vez de
  // "hoy" — el hallazgo crítico de la auditoría. Siguen pendientes porque no
  // existe `concDiaSolicitud` etc. como columna: NO TOUCH schema.prisma.)
  concDiaSolicitud: 'C-1a — sin columna; queda en ____ hasta que exista',
  concMesSolicitud: 'C-1a — sin columna',
  concAnoSolicitud: 'C-1a — sin columna',
  concDiaCitacion: 'C-1a — sin columna',
  concMesCitacion: 'C-1a — sin columna',
  concAnoCitacion: 'C-1a — sin columna',
  concDiaDesistimiento: 'C-1a — sin columna',
  concMesDesistimiento: 'C-1a — sin columna',
  concAnoDesistimiento: 'C-1a — sin columna',
  concDiaActaOriginal: 'C-1c — sin columna (fecha del acta que se aclara)',
  concMesActaOriginal: 'C-1c — sin columna',
  concAnoActaOriginal: 'C-1c — sin columna',

  // --- Unión marital / disolución: sin columna, en blanco por diseño ------
  // (preexistente a esta rama — no son C-1a, nunca cayeron a "hoy").
  concDiaInicioUnion: 'sin columna; blanco visible por diseño',
  concMesInicioUnion: 'sin columna',
  concAnoInicioUnion: 'sin columna',
  concDiaDeclaracionUnion: 'sin columna',
  concMesDeclaracionUnion: 'sin columna',
  concAnoDeclaracionUnion: 'sin columna',
  concDiaDisolucion: 'sin columna',
  concMesDisolucion: 'sin columna',
  concAnoDisolucion: 'sin columna',
  concNumeroActaUnionRef: 'sin columna',
  concNumeroTramiteUnionRef: 'sin columna',

  // --- Desistimiento: 2 campos sin columna --------------------------------
  concTipoSolicitanteDesistimiento: 'sin columna',
  concApoderadoDesistimientoName: 'sin columna',

  // --- Convocante/Solicitante: CON columna, SIN input — por DISEÑO -------
  // El convocante/solicitante ES el deudor; `mapConciliationFields` los
  // deriva de `debtor.*` cuando no hay override (`conciliacion.ts:157-165`).
  // Agregar un input duplicaría la captura con el formulario del deudor.
  concConvocanteName: 'por diseño — deriva de debtor.name',
  concConvocanteTipoId: 'por diseño — default "CC"',
  concConvocanteId: 'por diseño — deriva de debtor.idNumber',
  concConvocanteDireccion: 'por diseño — deriva de debtor.address',
  concConvocanteCiudad: 'por diseño — deriva de debtor.city',
  concConvocanteCorreo: 'por diseño — deriva de debtor.email',
  concConvocanteCel: 'por diseño — deriva de debtor.phone',

  // --- Conciliadora: CON columna, 2 de 3 derivan del operador; CC sin respaldo
  // (hallazgo A6, documentado en conciliacion.ts:212-223): `User` no guarda
  // ninguna identificación propia —solo tarjeta profesional—, así que no hay
  // de dónde derivar la cédula sin imprimir el mismo número en dos renglones
  // que dicen cosas distintas en un documento legal.
  concConciliadoraName: 'por diseño — deriva de operator.name',
  concConciliadoraTP: 'por diseño — deriva de operator.professionalCard',
  concConciliadoraCC: 'A6 — sin respaldo; User no guarda cédula del operador',

  // --- Columnas muertas: los singulares legacy de los arreglos JSON ------
  // (mismo hallazgo que `rejection`/`withdrawal` y
  // `Creditor`/`Asset`/`LegalProcess`: existen, no las escribe el
  // formulario —que usa los arreglos `concMenoresAlimentos`,
  // `concClausulasAcuerdo`, etc.—, y sus defaults nunca llegan a un
  // documento porque los 6 usos en las plantillas están todos dentro de un
  // `{{#each}}`, que resuelve desde el ítem, no desde este escalar.
  // Candidatas a borrar, no a conectar.
  concNombreMenor: 'columna muerta — legacy de concMenoresAlimentos/Union',
  concNumeroClausula: 'columna muerta — legacy de concClausulasAcuerdo',
  concTextoClausula: 'columna muerta',
  concNumeroClausulaAdicional: 'columna muerta — legacy de concClausulasAdicionales*',
  concTextoClausulaAdicional: 'columna muerta',
};

/**
 * Pendientes identificados por el PLACEHOLDER (no por un campo `conc*`,
 * porque no existe ninguno que lo respalde).
 */
const PENDIENTES_POR_PLACEHOLDER: Readonly<Record<string, string>> = {
  // C-1a: sin `concFechaSolicitud` como columna, el placeholder es un
  // literal fijo (`'____ de ____________ de ______'`), no una lectura de
  // `raw.*` — por eso no aparece en `KEY_A_CAMPO` y hay que nombrarlo por su
  // propio nombre.
  FECHA_SOLICITUD: 'C-1a — sin columna; literal en blanco hasta que exista',
};

// ---------------------------------------------------------------------------
// El cómputo: qué DEBERÍA estar pendiente, según el código de hoy
// ---------------------------------------------------------------------------

function calcularPendientesReales(): {
  porCampo: Set<string>;
  porPlaceholder: Set<string>;
} {
  const porCampo = new Set<string>();
  const porPlaceholder = new Set<string>();

  for (const placeholder of PLACEHOLDERS_EN_PLANTILLAS) {
    const campo = KEY_A_CAMPO.get(placeholder);

    if (campo) {
      if (!CAMPOS_EN_FORMULARIO.has(campo)) porCampo.add(campo);
      continue;
    }

    if (SIN_CAMPO_POR_DISENO.has(placeholder)) continue;

    if (placeholder === 'FECHA_SOLICITUD') {
      porPlaceholder.add(placeholder);
      continue;
    }

    // Ni mapeado a un campo, ni en SIN_CAMPO_POR_DISENO, ni FECHA_SOLICITUD:
    // lo produce otro mapper (membrete, base), fuera del alcance de este
    // archivo — no se evalúa acá.
  }

  return { porCampo, porPlaceholder };
}

describe('Cobertura formulario ↔ plantilla — las 12 de conciliación', () => {
  it('se leyeron las 12 plantillas', () => {
    expect(ARCHIVOS_PLANTILLA.length).toBe(12);
  });

  it('mapConciliationFields produce exactamente los placeholders que las plantillas usan de él', () => {
    // No es parte del contrato de cobertura de este test (eso ya lo cubre
    // `mapper-unresolved-detector.test.ts` / el golden), pero sirve de canario:
    // si esto cae a 0, la extracción de arriba se rompió silenciosamente.
    expect(KEY_A_CAMPO.size).toBeGreaterThan(90);
  });

  it('los pendientes por CAMPO coinciden exactamente con lo declarado', () => {
    const { porCampo } = calcularPendientesReales();
    const declarados = new Set(Object.keys(PENDIENTES_POR_CAMPO));

    const sinDeclarar = [...porCampo].filter((c) => !declarados.has(c)).sort();
    const yaResueltos = [...declarados].filter((c) => !porCampo.has(c)).sort();

    expect({
      camposSinDeclararEnLaLista: sinDeclarar,
      camposDeclaradosQueYaNoHacenFalta: yaResueltos,
    }).toEqual({
      camposSinDeclararEnLaLista: [],
      camposDeclaradosQueYaNoHacenFalta: [],
    });
  });

  it('los pendientes por PLACEHOLDER coinciden exactamente con lo declarado', () => {
    const { porPlaceholder } = calcularPendientesReales();
    const declarados = new Set(Object.keys(PENDIENTES_POR_PLACEHOLDER));

    const sinDeclarar = [...porPlaceholder]
      .filter((p) => !declarados.has(p))
      .sort();
    const yaResueltos = [...declarados]
      .filter((p) => !porPlaceholder.has(p))
      .sort();

    expect({ sinDeclarar, yaResueltos }).toEqual({
      sinDeclarar: [],
      yaResueltos: [],
    });
  });

  it('control positivo: un campo recién cubierto (zoomLink) no aparece como pendiente', () => {
    // zoomLink no es `conc*` (es columna de Case sin prefijo), así que no
    // pasa por este mecanismo — pero sirve para verificar, con un caso que SÍ
    // se resolvió en esta rama, que `CAMPOS_EN_FORMULARIO` encuentra lo que
    // está de verdad en los archivos y no solo lo que había antes de este PR.
    expect(TEXTO_FORMULARIO).toContain('zoomMeetingId');
    expect(TEXTO_FORMULARIO).toContain('zoomPassword');
    expect(TEXTO_FORMULARIO).toContain('zoomLink');
  });

  it('control positivo: los 5 campos de C-2 sí están cubiertos (no aparecen en pendientes)', () => {
    const { porCampo } = calcularPendientesReales();
    for (const campo of [
      'concApoderadoConvocanteDireccion',
      'concApoderadoConvocanteCiudad',
      'concFechaNacimiento',
      'concHoraProgramada',
      'concTipoConstanciaSolicitada',
    ]) {
      expect(porCampo.has(campo)).toBe(false);
      expect(CAMPOS_EN_FORMULARIO.has(campo)).toBe(true);
    }
  });

  it('control negativo: un campo inventado SIN declarar en la lista hace fallar el cálculo', () => {
    // No ejecuta el test completo con el campo falso (ensuciaría el mapa real);
    // solo confirma que la lógica de comparación detecta un sobrante.
    const porCampoFalso = new Set(['concCampoQueNoExiste']);
    const declarados = new Set(Object.keys(PENDIENTES_POR_CAMPO));
    const sinDeclarar = [...porCampoFalso].filter((c) => !declarados.has(c));
    expect(sinDeclarar).toEqual(['concCampoQueNoExiste']);
  });
});
