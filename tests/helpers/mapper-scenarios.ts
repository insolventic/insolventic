/**
 * Escenarios de casos para la red de seguridad del mapper de placeholders.
 *
 * Cada escenario es un caso completo (ver mapper-fixtures.ts) pensado para
 * activar una combinación concreta. Las columnas "Colisiones" nombran las claves
 * de placeholders cuyo valor final depende del ORDEN en que mapCaseToPlaceholders
 * fusiona sus sub-mappers (el último gana): el escenario hace que las dos fuentes
 * emitan valores DISTINTOS, para que un cambio de orden se note.
 */

import {
  APODERADO,
  ASSET_TYPES_BY_CATEGORY,
  DEBTOR_MALE,
  makeAsset,
  makeCase,
  makeDebt,
  makeLegalProcess,
  row,
  type Row,
} from './mapper-fixtures';

export type ScenarioKind = 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';

export interface Scenario {
  kind: ScenarioKind;
  /** Qué combinación cubre y qué colisiones hace observables. */
  covers: string;
  build: () => Row;
}

const D = (iso: string) => new Date(iso);

const debts = (n: number) => Array.from({ length: n }, (_, i) => makeDebt(i));

const typicalAssets = () => [
  makeAsset('INMUEBLE', 180_000_000, {
    name: 'Apartamento',
    propertyType: 'Apartamento',
  }),
  makeAsset('VEHICULO', 35_000_000, { name: 'Mazda CX-5', brand: 'Mazda' }),
  makeAsset('ELECTRONICO', 4_200_000, { name: 'Portátil y televisor' }),
];

/** Documentos adjuntos por el operador (entran a LISTA_ANEXOS) y uno generado (no entra). */
const documents = () => [
  { id: 'd1', name: 'Cédula de ciudadanía', isGenerated: false },
  { id: 'd2', name: 'Certificado de tradición y libertad', isGenerated: false },
  { id: 'd3', name: 'Solicitud de Insolvencia', isGenerated: true },
];

const completa = (extra: Row = {}, opts: Parameters<typeof makeCase>[0] = {}) =>
  makeCase({
    debts: debts(3),
    assets: typicalAssets(),
    dependents: 2,
    libranzas: 1,
    suspendedServices: 1,
    legalProcesses: [makeLegalProcess(0), makeLegalProcess(1)],
    apoderados: [APODERADO],
    documents: documents(),
    causes: ['Pérdida de empleo', 'Enfermedad grave'],
    applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
    ...opts,
    overrides: { ...opts.overrides, ...extra },
  });

// ---------------------------------------------------------------------------
// XSS: todo texto que un usuario puede escribir lleva una carga reconocible.
// ---------------------------------------------------------------------------

export const XSS_MARK = 'XSSMARK';
export const XSS_PAYLOAD = `<b onmouseover=${XSS_MARK}>`;

/** Claves que gobiernan la lógica (no son texto libre del usuario) y se dejan intactas. */
const STRUCTURAL_KEYS = new Set([
  'type',
  'phase',
  'tenantId',
  'id',
  'creditorId',
  'bilateralCreditorId',
  'failureType',
  'resultType',
  'idType',
  'tipoIdentificacion',
]);

export function injectPayload(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    return STRUCTURAL_KEYS.has(key) ? value : `${XSS_PAYLOAD}${value}`;
  }
  if (Array.isArray(value)) return value.map((v) => injectPayload(v, key));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Row).map(([k, v]) => [k, injectPayload(v, k)]),
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Conciliación / apoyo: arreglos JSON y fechas en texto
// ---------------------------------------------------------------------------

const concJson = (): Row => ({
  concMenoresAlimentos: [
    { NOMBRE_MENOR: 'Juan Pérez Torres' },
    { NOMBRE_MENOR: 'Sofía Pérez Torres' },
  ],
  concMenoresUnion: [{ NOMBRE_MENOR_UNION: 'Mateo Rojas Peña' }],
  concClausulasAdicionalesAlimentos: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'PRIMERA',
      TEXTO_CLAUSULA_ADICIONAL:
        'El alimentante pagará los primeros 5 días de cada mes.',
    },
  ],
  concClausulasAdicionalesUnion: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'PRIMERA',
      TEXTO_CLAUSULA_ADICIONAL:
        'Los compañeros permanentes fijan su domicilio en Bogotá.',
    },
  ],
  concClausulasAdicionalesDisolucion: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'PRIMERA',
      TEXTO_CLAUSULA_ADICIONAL: 'Se liquida la sociedad patrimonial de hecho.',
    },
  ],
  concClausulasAcuerdo: [
    {
      NUMERO_CLAUSULA: 'PRIMERA',
      TEXTO_CLAUSULA: 'Las partes acuerdan lo siguiente…',
    },
    {
      NUMERO_CLAUSULA: 'SEGUNDA',
      TEXTO_CLAUSULA: 'Vigencia del acuerdo: doce meses.',
    },
  ],
});

/**
 * Campos que el mapper de conciliación LEE (`raw.concXxx`) pero que el modelo Case
 * NO tiene como columna (medido contra Prisma.dmmf: 29 de las 128 lecturas
 * `raw.conc*`). En producción siempre llegan `undefined` y el mapper cae al valor
 * por defecto (la fecha de hoy, o vacío).
 *
 * Los escenarios de conciliación los inyectan como propiedades extra para fijar
 * también la rama "hay valor" del código (un refactor que mueva esas líneas no
 * debe romperla aunque hoy no corra), y los dejan ausentes o vacíos para fijar la
 * rama real de producción.
 */
const NON_COLUMN_CONC_DATE_READS = [
  'concDiaInicioUnion',
  'concMesInicioUnion',
  'concAnoInicioUnion',
  'concDiaDeclaracionUnion',
  'concMesDeclaracionUnion',
  'concAnoDeclaracionUnion',
  'concDiaDisolucion',
  'concMesDisolucion',
  'concAnoDisolucion',
  'concDiaActaOriginal',
  'concMesActaOriginal',
  'concAnoActaOriginal',
  'concDiaCitacion',
  'concMesCitacion',
  'concAnoCitacion',
  'concDiaSolicitud',
  'concMesSolicitud',
  'concAnoSolicitud',
  'concDiaDesistimiento',
  'concMesDesistimiento',
  'concAnoDesistimiento',
];

const NON_COLUMN_CONC_TEXT_READS: Row = {
  concApoderadoDesistimientoName: 'Dr. Mauricio Vélez Arango',
  concTipoSolicitanteDesistimiento: 'convocante',
  concCampoConError: 'Nombre del convocado',
  concDescripcionError: 'Error de digitación en el segundo apellido',
  concValorIncorrecto: 'Peña',
  concValorCorrecto: 'Peña Rodríguez',
  concNumeroActaUnionRef: '0087',
  concNumeroTramiteUnionRef: 'CON-2025-003',
};

/** Fechas de conciliación en texto: realistas (con-fechas) o vacías (sin-fechas: cae a "hoy"). */
function concDates(mode: 'con-fechas' | 'sin-fechas'): Row {
  const out: Row = {};
  for (const k of NON_COLUMN_CONC_DATE_READS) {
    if (mode === 'sin-fechas') out[k] = '';
    else out[k] = /Dia/.test(k) ? '15' : /Mes/.test(k) ? 'febrero' : '2025';
  }
  return mode === 'con-fechas'
    ? { ...out, ...NON_COLUMN_CONC_TEXT_READS }
    : out;
}

const conciliacion = (extra: Row = {}) =>
  makeCase({
    type: 'CONCILIATION',
    debtor: DEBTOR_MALE,
    debts: debts(2),
    apoderados: [APODERADO],
    documents: documents(),
    overrides: {
      caseNumber: 'CON-2026-015',
      phase: 'Audiencia programada',
      concConvocanteName: 'Laura Patricia Gómez Díaz',
      ...concJson(),
      ...extra,
    },
  });

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const SCENARIOS: Record<string, Scenario> = {
  'insolvencia-minima': {
    kind: 'INSOLVENCY',
    covers:
      'Caso recién creado: todo lo opcional en null, sin deudas, activos, dependientes ni procesos. Los valores por defecto ("____", "N/A", "No declara").',
    build: () => makeCase({ fill: 'minimal', debtor: { ...DEBTOR_MALE } }),
  },

  'insolvencia-completa': {
    kind: 'INSOLVENCY',
    covers:
      'Caso admitido con todas las ramas pobladas: 3 acreedores, inmueble + vehículo + electrónicos, dependientes, libranza, servicio suspendido, 2 procesos, apoderado y anexos. Colisiones: base<mapDynamicTables (DETALLE_BIENES, DETALLE_PAGO_CAPITAL, FORMA_PAGO_ACREEDORES, PROYECCION_PAGOS, CUADRO_CALIFICACION_GRADUACION) y base<mapAgreementResult (ANO_FIRMA).',
    build: () => completa(),
  },

  'insolvencia-acuerdo-aprobado': {
    kind: 'INSOLVENCY',
    covers:
      'Acuerdo aprobado: con fecha de inicio de pago y de vigencia. ANO_INICIO_PAGO y ANO_VIGENCIA se calculan en el bloque base desde esas fechas (ya no hay colisión: mapExtendedDates dejó de pisarlos con "", Hallazgo 2).',
    build: () =>
      completa({
        phase: 'Acuerdo aprobado',
        approvalPercentage: 72.5,
        monthlyPaymentAmount: 1_850_000,
        paymentStartDate: D('2026-05-01T15:00:00Z'),
        agreementValidityDate: D('2029-05-01T15:00:00Z'),
        admissionDate: D('2026-02-20T15:00:00Z'),
      }),
  },

  'insolvencia-fracaso-con-datos': {
    kind: 'INSOLVENCY',
    covers:
      'Fracaso con fecha de otro año, acuerdo bilateral y proceso judicial. Colisiones mapExtendedDates<mapFracasoVariables (DIA/MES/ANO_FRACASO, NUMERO_CONSTANCIA: número de caso vs solo dígitos, ANO_BILATERAL, ANO_CONSTANCIA) y mapExternalEntities<mapFracasoVariables (NUMERO_JUZGADO, RADICADO_BILATERAL).',
    build: () =>
      completa({
        caseNumber: 'INS-2025-117',
        phase: 'Fracaso',
        failureDate: D('2025-12-30T15:00:00Z'),
        failureType: 'propuesta-mala',
        isBilateral: true,
        bilateralCreditorId: 'cred-1',
        bilateralAgreementNumber: 'ACU-BIL-2025-09',
      }),
  },

  'insolvencia-fracaso-sin-datos': {
    kind: 'INSOLVENCY',
    covers:
      'Fracaso sin fecha, sin acuerdo bilateral y sin proceso judicial: en las colisiones mapExtendedDates ("") vs mapFracasoVariables ("____"), gana la segunda. Los mismos en NUMERO_JUZGADO y RADICADO_BILATERAL.',
    build: () =>
      completa(
        {
          caseNumber: 'INS-2025-118',
          phase: 'Fracaso',
          failureDate: null,
          failureType: null,
          isBilateral: false,
          bilateralCreditorId: null,
          bilateralAgreementNumber: null,
        },
        { legalProcesses: [] },
      ),
  },

  'insolvencia-desistimiento': {
    kind: 'INSOLVENCY',
    covers:
      'Desistimiento con fecha de resultado. Hoy DIA/MES_DESISTIMIENTO salen vacíos en insolvencia (mapExtendedDates); la fecha de desistimiento por resultDate llega en otra rama.',
    build: () =>
      completa({
        phase: 'Desistimiento',
        resultType: 'no-pago-tarifas',
        resultDate: D('2026-03-01T15:00:00Z'),
      }),
  },

  'insolvencia-muchos': {
    kind: 'INSOLVENCY',
    covers:
      'Más filas de las que caben en las tablas (13 acreedores, 6 dependientes) y varios activos en cada una de las 7 categorías de muebles: ejercita sumValues y los totales con varios sumandos.',
    build: () =>
      completa(
        {},
        {
          debts: debts(13),
          dependents: 6,
          assets: [
            makeAsset('INMUEBLE', 250_000_000),
            makeAsset('INMUEBLE', 120_000_000),
            makeAsset('REAL_ESTATE', 60_000_000),
            ...ASSET_TYPES_BY_CATEGORY.flatMap((t, i) => [
              makeAsset(t, 3_000_000 + i * 500_000),
              makeAsset(t, 1_250_000 + i * 250_000),
            ]),
            makeAsset('OTRO', 900_000),
          ],
        },
      ),
  },

  'insolvencia-alcance-texto': {
    kind: 'INSOLVENCY',
    covers:
      'Alcance de la solicitud escrito en texto libre ("pequeño comerciante") y no con el código: mapApplicantScope dice "Pequeño Comerciante" pero mapAgreementResult (que va después y solo mira el código) lo pisa con "No Comerciante" en TIPO_SOLICITANTE, mientras APLICACION_PEQUENA_COMERCIANTE dice SI.',
    build: () =>
      completa(
        { otherCauseDetail: 'Cierre del negocio por la pandemia' },
        {
          applicantScope: ['Persona natural pequeño comerciante'],
          causes: ['Otro'],
        },
      ),
  },

  'insolvencia-alcance-codigo': {
    kind: 'INSOLVENCY',
    covers:
      'Alcance con el código PERSONA_NATURAL_PEQUENA_COMERCIANTE: las dos fuentes de TIPO_SOLICITANTE coinciden.',
    build: () =>
      completa({}, { applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'] }),
  },

  'insolvencia-caracteres-especiales': {
    kind: 'INSOLVENCY',
    covers:
      'Acentos, eñes, comillas, apóstrofos y "&" en datos reales (sin HTML): el "&" sale como &amp; y nada más se altera.',
    build: () =>
      completa(
        {},
        {
          debtor: {
            name: "José Ángel O'Brien Muñoz & Hijos",
            address: 'Calle 45 # 12-30, Torre "B"',
          },
          debts: [
            makeDebt(0, {
              creditor: { name: 'Banco "Del Pueblo" & Cía. S.A.' },
            }),
            makeDebt(1, { creditor: { name: "Cooperativa D'Avila" } }),
          ],
        },
      ),
  },

  'insolvencia-varon': {
    kind: 'INSOLVENCY',
    covers:
      'Deudor varón: variantes de género (GENERO_DEUDOR, GENERO_DEUDOR_SINGULAR).',
    build: () => completa({}, { debtor: DEBTOR_MALE }),
  },

  'insolvencia-xss': {
    kind: 'INSOLVENCY',
    covers:
      'Todo texto libre lleva una carga <b onmouseover=XSSMARK>: ninguna salida (tampoco las claves HTML del sistema) puede contenerla sin escapar.',
    build: () => injectPayload(completa()) as Row,
  },

  'conciliacion-basica': {
    kind: 'CONCILIATION',
    covers:
      'Conciliación con convocante propio y arreglos JSON (menores, cláusulas). Colisión base<mapConciliationFields: NOMBRE_CONVOCANTE (deudor vs convocante).',
    build: () => conciliacion(),
  },

  'conciliacion-con-fechas': {
    kind: 'CONCILIATION',
    covers:
      'Fechas de desistimiento y constancia en texto: mapConciliationFields (último) pisa a mapExtendedDates en DIA/MES/ANO_DESISTIMIENTO y ANO_CONSTANCIA.',
    build: () => conciliacion(concDates('con-fechas')),
  },

  'conciliacion-sin-fechas': {
    kind: 'CONCILIATION',
    covers: 'Mismas claves con las fechas vacías: caen a la fecha de "hoy".',
    build: () => conciliacion(concDates('sin-fechas')),
  },

  'conciliacion-varios-menores': {
    kind: 'CONCILIATION',
    covers:
      'Acta de Unión Marital con 3 menores (MENORES_UNION): ejercita {{#unless @last}} dentro de {{#each}} — con 1 solo menor (el fixture por defecto) el separador nunca se nota, con 2+ sí.',
    build: () =>
      conciliacion({
        concMenoresUnion: [
          { NOMBRE_MENOR_UNION: 'Mateo Rojas Peña' },
          { NOMBRE_MENOR_UNION: 'Valentina Rojas Peña' },
          { NOMBRE_MENOR_UNION: 'Samuel Rojas Peña' },
        ],
      }),
  },

  'conciliacion-xss': {
    kind: 'CONCILIATION',
    covers:
      'Conciliación con carga en todo texto libre, incluidos los arreglos JSON que alimentan los bloques {{#each}} (buildConciliationContext).',
    build: () => injectPayload(conciliacion()) as Row,
  },

  'apoyo-completo': {
    kind: 'SUPPORT_AGREEMENT',
    covers: 'Acuerdo de apoyo con todos sus campos y cláusulas.',
    build: () =>
      makeCase({
        type: 'SUPPORT_AGREEMENT',
        debtor: DEBTOR_MALE,
        documents: documents(),
        overrides: {
          caseNumber: 'ACU-2026-007',
          phase: 'Documentos pendientes',
          apoyoClausulas: [
            {
              NUMERO_CLAUSULA: 'PRIMERA',
              TEXTO_CLAUSULA:
                'El prestador de apoyo acompañará las decisiones financieras.',
            },
          ],
        },
      }),
  },

  'apoyo-minimo': {
    kind: 'SUPPORT_AGREEMENT',
    covers: 'Acuerdo de apoyo recién creado: campos opcionales en null.',
    build: () =>
      makeCase({
        type: 'SUPPORT_AGREEMENT',
        fill: 'minimal',
        debtor: DEBTOR_MALE,
      }),
  },
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);

// `row` se reexporta para tests que necesitan una fila suelta.
export { row };
