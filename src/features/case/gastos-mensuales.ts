/**
 * Gastos mensuales del deudor (Sección III del formulario de insolvencia).
 *
 * Fuente única del catálogo de conceptos, de su periodicidad y de la
 * aritmética. La consumen el formulario (para mostrar el total en vivo), las
 * server actions (que recalculan y no confían en lo que manda el cliente) y los
 * generadores de documentos y del Excel. Ajustar un divisor es cambiar una
 * línea de `CONCEPTOS_GASTO`.
 *
 * MODELO. Hasta 2026-11 había 7 montos agregados en columnas propias de `Case`
 * (`gastosVivienda` … `otrosGastos`) más `totalGastosMensuales`. Ahora el
 * detalle vive en la columna `Case.gastosMensualesDetalle` (Json?), con la
 * forma de `DetalleGastos`. Las 7 columnas viejas se conservan intactas y ya no
 * se escriben; un caso sin detalle se lee derivándolo de ellas
 * (`detalleDesdeCamposLegados`).
 *
 * ARITMÉTICA. Pesos colombianos enteros. Cada línea se convierte a su
 * equivalente mensual (valor ÷ divisor) redondeado half-up, y el total es la
 * SUMA DE LOS EQUIVALENTES YA REDONDEADOS: así lo que se ve en pantalla, lo que
 * se guarda y lo que sale en los documentos cuadra al peso.
 *
 * Este archivo no lleva `'use server'`: lo importan componentes cliente.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const GRUPOS_GASTO = [
  { id: 'VIVIENDA', titulo: 'Vivienda y servicios' },
  { id: 'ALIMENTACION', titulo: 'Alimentación y hogar' },
  { id: 'SALUD', titulo: 'Salud y seguros' },
  { id: 'EDUCACION', titulo: 'Educación' },
  { id: 'FAMILIA', titulo: 'Familia' },
  { id: 'TRANSPORTE', titulo: 'Transporte' },
  { id: 'IMPUESTOS', titulo: 'Impuestos' },
  { id: 'OTROS', titulo: 'Otros gastos' },
] as const;

export type GrupoGasto = (typeof GRUPOS_GASTO)[number]['id'];

/** Una forma de pagar el concepto: qué período digita el usuario y por cuánto se divide. */
export interface PeriodicidadGasto {
  readonly id: string;
  /** Texto del selector (solo se muestra si el concepto tiene más de una). */
  readonly etiqueta: string;
  /** Meses que cubre el valor digitado: el equivalente mensual es valor ÷ divisor. */
  readonly divisor: number;
}

const MENSUAL: PeriodicidadGasto = {
  id: 'MENSUAL',
  etiqueta: 'Mensual',
  divisor: 1,
};
const ANUAL: PeriodicidadGasto = {
  id: 'ANUAL',
  etiqueta: 'Anual',
  divisor: 12,
};

export interface ConceptoGasto {
  readonly clave: string;
  readonly etiqueta: string;
  readonly grupo: Exclude<GrupoGasto, 'OTROS'>;
  /** La primera es la que se usa por defecto. */
  readonly periodicidades: readonly [PeriodicidadGasto, ...PeriodicidadGasto[]];
}

export const CONCEPTOS_GASTO = [
  // Vivienda y servicios
  {
    clave: 'ARRIENDO',
    etiqueta: 'Arriendo',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'ADMINISTRACION',
    etiqueta: 'Administración (propiedad horizontal)',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'AGUA',
    etiqueta: 'Agua',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'LUZ',
    etiqueta: 'Luz',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'TELEFONO',
    etiqueta: 'Teléfono',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'INTERNET',
    etiqueta: 'Internet',
    grupo: 'VIVIENDA',
    periodicidades: [MENSUAL],
  },
  // Alimentación y hogar
  {
    clave: 'ALIMENTOS',
    etiqueta: 'Alimentos',
    grupo: 'ALIMENTACION',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'ASEO',
    etiqueta: 'Elementos de aseo',
    grupo: 'ALIMENTACION',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'ONCES_HIJOS',
    etiqueta: 'Onces hijos',
    grupo: 'ALIMENTACION',
    periodicidades: [MENSUAL],
  },
  // Salud y seguros
  {
    clave: 'SALUD',
    etiqueta: 'Salud',
    grupo: 'SALUD',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'MEDICAMENTOS',
    etiqueta: 'Medicamentos',
    grupo: 'SALUD',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'PENSION',
    etiqueta: 'Pensión (aporte/costo)',
    grupo: 'SALUD',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'SEGUROS',
    etiqueta: 'Seguros',
    grupo: 'SALUD',
    periodicidades: [MENSUAL],
  },
  // Educación
  {
    clave: 'EDUCACION',
    etiqueta: 'Educación',
    grupo: 'EDUCACION',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'PENSION_COLEGIO',
    etiqueta: 'Pensión colegio',
    grupo: 'EDUCACION',
    periodicidades: [MENSUAL],
  },
  {
    clave: 'UNIFORMES',
    etiqueta: 'Uniformes',
    grupo: 'EDUCACION',
    periodicidades: [ANUAL],
  },
  {
    clave: 'MATRICULA',
    etiqueta: 'Matrícula',
    grupo: 'EDUCACION',
    periodicidades: [
      { id: 'COLEGIO', etiqueta: 'Colegio', divisor: 12 },
      { id: 'UNIVERSIDAD', etiqueta: 'Universidad', divisor: 6 },
    ],
  },
  // Familia
  {
    clave: 'MANUTENCION_PADRES',
    etiqueta: 'Manutención padres',
    grupo: 'FAMILIA',
    periodicidades: [MENSUAL],
  },
  // Transporte
  {
    clave: 'TRANSPORTE',
    etiqueta: 'Transporte',
    grupo: 'TRANSPORTE',
    periodicidades: [MENSUAL],
  },
  // Impuestos
  {
    clave: 'IMPUESTOS',
    etiqueta: 'Impuestos',
    grupo: 'IMPUESTOS',
    periodicidades: [ANUAL],
  },
] as const satisfies readonly ConceptoGasto[];

export type ClaveConcepto = (typeof CONCEPTOS_GASTO)[number]['clave'];

export const CLAVES_CONCEPTO = CONCEPTOS_GASTO.map((c) => c.clave) as [
  ClaveConcepto,
  ...ClaveConcepto[],
];

/** Topes de la lista "Otros": cuántas filas y qué tan largo puede ser el concepto. */
export const MAX_OTROS_GASTOS = 50;
export const MAX_LARGO_CONCEPTO_OTRO = 120;

export function conceptoPorClave(clave: string): ConceptoGasto | undefined {
  return (CONCEPTOS_GASTO as readonly ConceptoGasto[]).find(
    (c) => c.clave === clave,
  );
}

/** La periodicidad pedida si el concepto la admite; si no, la por defecto. */
export function periodicidadDe(
  concepto: ConceptoGasto,
  id: string | null | undefined,
): PeriodicidadGasto {
  return (
    concepto.periodicidades.find((p) => p.id === id) ??
    concepto.periodicidades[0]
  );
}

// ---------------------------------------------------------------------------
// Lectura de pesos enteros
// ---------------------------------------------------------------------------

export const MENSAJE_PESOS_ENTEROS =
  'Escriba el valor en pesos enteros, sin decimales';
export const MENSAJE_VALOR_INVALIDO =
  'Valor no válido: escriba solo números en pesos enteros';
export const MENSAJE_VALOR_NEGATIVO = 'El valor no puede ser negativo';

export type LecturaPesos =
  | { tipo: 'vacio' }
  | { tipo: 'valor'; valor: number }
  | { tipo: 'error'; mensaje: string };

const MILES_CON_PUNTO = /^\d{1,3}(\.\d{3})+$/;
const MILES_CON_COMA = /^\d{1,3}(,\d{3})+$/;
/** Entero (con o sin puntos de miles) + coma + parte decimal. */
const DECIMAL_CON_COMA = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d+)$/;
/** Entero (con o sin comas de miles) + punto + parte decimal. */
const DECIMAL_CON_PUNTO = /^(\d{1,3}(?:,\d{3})+|\d+)\.(\d+)$/;

function aEntero(digitos: string): LecturaPesos {
  const n = Number(digitos);
  if (!Number.isSafeInteger(n)) {
    return { tipo: 'error', mensaje: MENSAJE_VALOR_INVALIDO };
  }
  return { tipo: 'valor', valor: n };
}

/**
 * Lee un valor en pesos enteros escrito por una persona.
 *
 * Tolera separadores de miles con punto (`1.234.567`, la forma es-CO que produce
 * el formulario) y con coma (`1,234,567`, la que llega al pegar desde otras
 * fuentes), y el signo `$`. Rechaza solo los decimales REALES: `1.234,50` y
 * `1234.5` dan error; `1.234,00` se acepta como 1234, porque una parte decimal
 * en cero no cambia el monto.
 *
 * El caso ambiguo `1.234` / `1,234` (un separador seguido de exactamente tres
 * dígitos) se lee como miles: en pesos enteros no hay otra lectura posible.
 *
 * Vacío devuelve `{ tipo: 'vacio' }`, no 0: "no lo cargué" y "cargué cero" no
 * son lo mismo.
 */
export function leerPesosEnteros(entrada: unknown): LecturaPesos {
  if (entrada === null || entrada === undefined) return { tipo: 'vacio' };

  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) {
      return { tipo: 'error', mensaje: MENSAJE_VALOR_INVALIDO };
    }
    if (entrada < 0) return { tipo: 'error', mensaje: MENSAJE_VALOR_NEGATIVO };
    if (!Number.isInteger(entrada)) {
      return { tipo: 'error', mensaje: MENSAJE_PESOS_ENTEROS };
    }
    return aEntero(String(entrada));
  }

  if (typeof entrada !== 'string') {
    return { tipo: 'error', mensaje: MENSAJE_VALOR_INVALIDO };
  }

  const limpio = entrada.replace(/[\s$]/g, '');
  if (limpio === '') return { tipo: 'vacio' };
  if (limpio.startsWith('-')) {
    return { tipo: 'error', mensaje: MENSAJE_VALOR_NEGATIVO };
  }

  if (/^\d+$/.test(limpio)) return aEntero(limpio);
  if (MILES_CON_PUNTO.test(limpio)) return aEntero(limpio.replace(/\./g, ''));
  if (MILES_CON_COMA.test(limpio)) return aEntero(limpio.replace(/,/g, ''));

  const decimal =
    DECIMAL_CON_COMA.exec(limpio) ?? DECIMAL_CON_PUNTO.exec(limpio);
  if (decimal) {
    const [, entero, fraccion] = decimal;
    if (/^0+$/.test(fraccion)) return aEntero(entero.replace(/[.,]/g, ''));
    return { tipo: 'error', mensaje: MENSAJE_PESOS_ENTEROS };
  }

  return { tipo: 'error', mensaje: MENSAJE_VALOR_INVALIDO };
}

/** El valor leído, o `undefined` si está vacío o no es válido. Para el total en vivo. */
export function pesosOIndefinido(entrada: unknown): number | undefined {
  const lectura = leerPesosEnteros(entrada);
  return lectura.tipo === 'valor' ? lectura.valor : undefined;
}

/** `1234567` → `"1.234.567"`, sin signo de moneda. */
export function formatearPesos(valor: number): string {
  return Math.trunc(valor).toLocaleString('es-CO', {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
}

/** `true` si el texto es exactamente como lo dejaría `formatearPesos` (o vacío). */
function estaFormateado(texto: string): boolean {
  if (texto === '') return true;
  const digitos = texto.replace(/\./g, '');
  return (
    /^\d{1,15}$/.test(digitos) && formatearPesos(Number(digitos)) === texto
  );
}

/**
 * Lo que muestra el campo mientras se escribe.
 *
 * Mientras se tipean solo dígitos, los reescribe con puntos de miles
 * (`1234` → `1.234`). En cuanto aparece algo que no es eso —una coma, un signo,
 * un punto escrito a mano— deja el texto tal cual hasta salir del campo, donde
 * `leerPesosEnteros` decide: lo normaliza si es un monto válido (`1,234,567` →
 * `1.234.567`) o muestra el error si tiene decimales. Así un `1500.50` escrito
 * a mano no se convierte en silencio en `150.050`.
 */
export function pesosMientrasEscribe(nuevo: string, anterior: string): string {
  if (/[^\d.]/.test(nuevo)) return nuevo;
  if (!estaFormateado(anterior)) return nuevo;
  const puntos = (t: string) => (t.match(/\./g) ?? []).length;
  if (puntos(nuevo) > puntos(anterior)) return nuevo;
  const digitos = nuevo.replace(/\D/g, '');
  if (digitos === '') return '';
  if (digitos.length > 15) return nuevo;
  return formatearPesos(Number(digitos));
}

/** Lo que muestra el campo al salir: el monto normalizado si es válido; si no, el texto tal cual. */
export function pesosAlSalir(texto: string): string {
  const lectura = leerPesosEnteros(texto);
  return lectura.tipo === 'valor' ? formatearPesos(lectura.valor) : texto;
}

// ---------------------------------------------------------------------------
// Aritmética
// ---------------------------------------------------------------------------

/**
 * `valor ÷ divisor` redondeado half-up, en aritmética entera (sin errores de
 * coma flotante): 100 ÷ 12 = 8,33 → 8; 6 ÷ 12 = 0,5 → 1; 150 ÷ 12 = 12,5 → 13.
 */
export function equivalenteMensual(valor: number, divisor: number): number {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`Valor de gasto inválido: ${valor}`);
  }
  if (!Number.isSafeInteger(divisor) || divisor < 1) {
    throw new RangeError(`Divisor de gasto inválido: ${divisor}`);
  }
  const cociente = Math.floor(valor / divisor);
  const resto = valor - cociente * divisor;
  return resto * 2 >= divisor ? cociente + 1 : cociente;
}

// ---------------------------------------------------------------------------
// Forma persistida (Case.gastosMensualesDetalle)
// ---------------------------------------------------------------------------

const enteroNoNegativo = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const lineaConceptoGuardadaSchema = z.object({
  clave: z.enum(CLAVES_CONCEPTO),
  /** Lo que digitó el usuario, en el período de `periodicidad`. */
  valor: enteroNoNegativo,
  periodicidad: z.string(),
  /** Divisor aplicado al guardar: si el catálogo cambia, el caso no cambia. */
  divisor: z.number().int().min(1),
  mensual: enteroNoNegativo,
});

export const lineaOtroGuardadaSchema = z.object({
  concepto: z.string().min(1).max(MAX_LARGO_CONCEPTO_OTRO),
  valor: enteroNoNegativo,
  mensual: enteroNoNegativo,
});

export const detalleGastosSchema = z.object({
  version: z.literal(1),
  conceptos: z.array(lineaConceptoGuardadaSchema),
  otros: z.array(lineaOtroGuardadaSchema).max(MAX_OTROS_GASTOS),
  total: enteroNoNegativo,
});

export type LineaConceptoGuardada = z.infer<typeof lineaConceptoGuardadaSchema>;
export type LineaOtroGuardada = z.infer<typeof lineaOtroGuardadaSchema>;
export type DetalleGastos = z.infer<typeof detalleGastosSchema>;

// ---------------------------------------------------------------------------
// Entrada del formulario
// ---------------------------------------------------------------------------

/** Lo que maneja el formulario: textos tal como se escriben. */
export interface EntradaConceptoGasto {
  valor?: string | number | null;
  periodicidad?: string | null;
}

export interface EntradaOtroGasto {
  concepto?: string | null;
  valor?: string | number | null;
}

export interface EntradaGastos {
  conceptos?: Partial<Record<ClaveConcepto, EntradaConceptoGasto>> | null;
  otros?: EntradaOtroGasto[] | null;
}

/** Formulario vacío: una entrada por concepto, con su periodicidad por defecto. */
export function entradaGastosVacia(): {
  conceptos: Record<ClaveConcepto, { valor: string; periodicidad: string }>;
  otros: { concepto: string; valor: string }[];
} {
  const conceptos = {} as Record<
    ClaveConcepto,
    { valor: string; periodicidad: string }
  >;
  for (const c of CONCEPTOS_GASTO) {
    conceptos[c.clave] = { valor: '', periodicidad: c.periodicidades[0].id };
  }
  return { conceptos, otros: [] };
}

export type ErroresGastos = { ruta: (string | number)[]; mensaje: string }[];

export type ResultadoCalculo =
  | { ok: true; detalle: DetalleGastos | null }
  | { ok: false; errores: ErroresGastos };

/**
 * Valida la entrada y calcula el detalle: equivalentes mensuales y total.
 *
 * Es la función que corre en el servidor (fuente de verdad) y la misma que usa
 * el formulario para el total en vivo. Ignora cualquier total, divisor o
 * equivalente que venga del cliente: solo lee valores y periodicidades.
 *
 * Devuelve `detalle: null` cuando no se cargó ningún gasto: así un caso con el
 * bloque vacío sigue resolviendo su gasto por la cadena legada
 * (`monthlyExpenses`) en vez de declarar $0.
 */
export function calcularGastos(
  entrada: EntradaGastos | null | undefined,
): ResultadoCalculo {
  const errores: ErroresGastos = [];
  const conceptos: LineaConceptoGuardada[] = [];
  const otros: LineaOtroGuardada[] = [];

  const entradaConceptos = entrada?.conceptos ?? {};
  for (const clave of Object.keys(entradaConceptos)) {
    if (!conceptoPorClave(clave)) {
      errores.push({
        ruta: ['conceptos', clave],
        mensaje: `Concepto de gasto desconocido: ${clave}`,
      });
    }
  }

  for (const concepto of CONCEPTOS_GASTO) {
    const linea = entradaConceptos[concepto.clave];
    if (!linea) continue;
    const lectura = leerPesosEnteros(linea.valor);
    if (lectura.tipo === 'error') {
      errores.push({
        ruta: ['conceptos', concepto.clave, 'valor'],
        mensaje: lectura.mensaje,
      });
      continue;
    }
    if (lectura.tipo === 'vacio') continue;
    if (
      linea.periodicidad &&
      !concepto.periodicidades.some((p) => p.id === linea.periodicidad)
    ) {
      errores.push({
        ruta: ['conceptos', concepto.clave, 'periodicidad'],
        mensaje: 'Periodicidad no válida para este concepto',
      });
      continue;
    }
    const periodicidad = periodicidadDe(concepto, linea.periodicidad);
    conceptos.push({
      clave: concepto.clave,
      valor: lectura.valor,
      periodicidad: periodicidad.id,
      divisor: periodicidad.divisor,
      mensual: equivalenteMensual(lectura.valor, periodicidad.divisor),
    });
  }

  const entradaOtros = entrada?.otros ?? [];
  if (entradaOtros.length > MAX_OTROS_GASTOS) {
    errores.push({
      ruta: ['otros'],
      mensaje: `Se admiten hasta ${MAX_OTROS_GASTOS} gastos en "Otros"`,
    });
  }
  entradaOtros.slice(0, MAX_OTROS_GASTOS).forEach((fila, i) => {
    const nombre = (fila?.concepto ?? '').trim();
    const lectura = leerPesosEnteros(fila?.valor);
    if (lectura.tipo === 'error') {
      errores.push({ ruta: ['otros', i, 'valor'], mensaje: lectura.mensaje });
    }
    if (lectura.tipo === 'vacio' && nombre === '') return; // fila en blanco
    if (nombre === '') {
      errores.push({
        ruta: ['otros', i, 'concepto'],
        mensaje: 'Escriba el concepto del gasto',
      });
      return;
    }
    if (nombre.length > MAX_LARGO_CONCEPTO_OTRO) {
      errores.push({
        ruta: ['otros', i, 'concepto'],
        mensaje: `Máximo ${MAX_LARGO_CONCEPTO_OTRO} caracteres`,
      });
      return;
    }
    if (lectura.tipo === 'error') return;
    const valor = lectura.tipo === 'valor' ? lectura.valor : 0;
    otros.push({ concepto: nombre, valor, mensual: valor });
  });

  if (errores.length > 0) return { ok: false, errores };
  if (conceptos.length === 0 && otros.length === 0) {
    return { ok: true, detalle: null };
  }

  const total =
    conceptos.reduce((s, l) => s + l.mensual, 0) +
    otros.reduce((s, l) => s + l.mensual, 0);
  return { ok: true, detalle: { version: 1, conceptos, otros, total } };
}

const valorDeEntrada = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.undefined(),
]);

/**
 * Schema de borde (server actions y resolver del formulario) para el bloque de
 * gastos. Acepta los textos tal como se escriben y valida con `calcularGastos`,
 * así UI y servidor rechazan exactamente lo mismo, con el mismo mensaje y en la
 * misma ruta del campo. No transforma: el servidor llama `calcularGastos` sobre
 * el dato ya validado para obtener el detalle que guarda.
 */
export const gastosMensualesEntradaSchema = z
  .object({
    conceptos: z
      .record(
        z.string(),
        z.object({
          valor: valorDeEntrada,
          periodicidad: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
    otros: z
      .array(
        z.object({
          concepto: z.string().nullable().optional(),
          valor: valorDeEntrada,
        }),
      )
      .nullable()
      .optional(),
  })
  .superRefine((entrada, ctx) => {
    const r = calcularGastos(entrada);
    if (r.ok) return;
    for (const e of r.errores) {
      ctx.addIssue({ code: 'custom', path: e.ruta, message: e.mensaje });
    }
  });

/**
 * Total en vivo para la UI: suma lo que se puede leer e ignora lo inválido (el
 * error se muestra en su campo). Mismo redondeo que `calcularGastos`.
 */
export function totalEnVivo(entrada: EntradaGastos | null | undefined): number {
  let total = 0;
  for (const concepto of CONCEPTOS_GASTO) {
    const linea = entrada?.conceptos?.[concepto.clave];
    const valor = pesosOIndefinido(linea?.valor);
    if (valor === undefined) continue;
    total += equivalenteMensual(
      valor,
      periodicidadDe(concepto, linea?.periodicidad).divisor,
    );
  }
  for (const fila of entrada?.otros ?? []) {
    total += pesosOIndefinido(fila?.valor) ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Datos legados
// ---------------------------------------------------------------------------

/** Las 7 columnas agregadas que existían antes del detalle. */
export interface CamposGastosLegados {
  gastosVivienda?: unknown;
  gastosAlimentacion?: unknown;
  gastosServiciosPublicos?: unknown;
  gastosTransporte?: unknown;
  gastosEducacion?: unknown;
  gastosSalud?: unknown;
  otrosGastos?: unknown;
}

export const ETIQUETA_SERVICIOS_HISTORICO = 'Servicios públicos (histórico)';
export const ETIQUETA_OTROS_HISTORICO = 'Otros gastos (histórico)';

/** Decimal de Prisma, número o string → entero en pesos (half-up); 0 si no hay. */
function montoLegado(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const n =
    typeof valor === 'object' && valor !== null && 'toNumber' in valor
      ? (valor as { toNumber: () => number }).toNumber()
      : Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n + 0.5);
}

/**
 * Detalle equivalente a las 7 columnas viejas, o `null` si ninguna tiene valor.
 *
 * Mapeo: vivienda → Arriendo, alimentación → Alimentos, y transporte, educación
 * y salud a su concepto homónimo. Servicios públicos y "otros gastos" no se
 * pueden desglosar, así que pasan a filas de "Otros" marcadas como históricas.
 * Los montos legados con centavos se redondean half-up al peso.
 */
export function detalleDesdeCamposLegados(
  caso: CamposGastosLegados,
): DetalleGastos | null {
  const mensual = (
    clave: ClaveConcepto,
    valor: number,
  ): LineaConceptoGuardada => ({
    clave,
    valor,
    periodicidad: 'MENSUAL',
    divisor: 1,
    mensual: valor,
  });

  const conceptos: LineaConceptoGuardada[] = [];
  const otros: LineaOtroGuardada[] = [];

  const vivienda = montoLegado(caso.gastosVivienda);
  const alimentacion = montoLegado(caso.gastosAlimentacion);
  const servicios = montoLegado(caso.gastosServiciosPublicos);
  const transporte = montoLegado(caso.gastosTransporte);
  const educacion = montoLegado(caso.gastosEducacion);
  const salud = montoLegado(caso.gastosSalud);
  const otrosGastos = montoLegado(caso.otrosGastos);

  // Orden del catálogo, para que el detalle derivado se vea igual que uno nuevo.
  if (vivienda > 0) conceptos.push(mensual('ARRIENDO', vivienda));
  if (alimentacion > 0) conceptos.push(mensual('ALIMENTOS', alimentacion));
  if (salud > 0) conceptos.push(mensual('SALUD', salud));
  if (educacion > 0) conceptos.push(mensual('EDUCACION', educacion));
  if (transporte > 0) conceptos.push(mensual('TRANSPORTE', transporte));
  if (servicios > 0) {
    otros.push({
      concepto: ETIQUETA_SERVICIOS_HISTORICO,
      valor: servicios,
      mensual: servicios,
    });
  }
  if (otrosGastos > 0) {
    otros.push({
      concepto: ETIQUETA_OTROS_HISTORICO,
      valor: otrosGastos,
      mensual: otrosGastos,
    });
  }

  if (conceptos.length === 0 && otros.length === 0) return null;
  const total =
    conceptos.reduce((s, l) => s + l.mensual, 0) +
    otros.reduce((s, l) => s + l.mensual, 0);
  return { version: 1, conceptos, otros, total };
}

/** El detalle guardado si tiene la forma esperada; `null` si falta o está corrupto. */
export function leerDetalleGuardado(valor: unknown): DetalleGastos | null {
  if (valor === null || valor === undefined) return null;
  const parsed = detalleGastosSchema.safeParse(valor);
  return parsed.success ? parsed.data : null;
}

export interface CasoConGastos extends CamposGastosLegados {
  gastosMensualesDetalle?: unknown;
  monthlyExpenses?: unknown;
  debtor?: { monthlyExpenses?: unknown } | null;
}

export type OrigenGastos = 'DETALLE' | 'CAMPOS_LEGADOS' | 'MONTO_LEGADO';

export interface LineaGastoResuelta {
  grupo: GrupoGasto;
  etiqueta: string;
  mensual: number;
}

export interface GastosResueltos {
  origen: OrigenGastos;
  /** Detalle (guardado o derivado); `null` si solo hay un monto agregado. */
  detalle: DetalleGastos | null;
  /** Líneas en el orden del catálogo, sin las de $0: lo que va a los documentos. */
  lineas: LineaGastoResuelta[];
  total: number;
}

/** Líneas imprimibles de un detalle: orden del catálogo, "Otros" al final, sin $0. */
export function lineasDelDetalle(detalle: DetalleGastos): LineaGastoResuelta[] {
  const lineas: LineaGastoResuelta[] = [];
  for (const concepto of CONCEPTOS_GASTO) {
    for (const l of detalle.conceptos) {
      if (l.clave === concepto.clave && l.mensual > 0) {
        lineas.push({
          grupo: concepto.grupo,
          etiqueta: concepto.etiqueta,
          mensual: l.mensual,
        });
      }
    }
  }
  for (const o of detalle.otros) {
    if (o.mensual > 0) {
      lineas.push({ grupo: 'OTROS', etiqueta: o.concepto, mensual: o.mensual });
    }
  }
  return lineas;
}

/**
 * Gasto mensual de un caso, para documentos, Excel y vistas de solo lectura.
 *
 * Orden de resolución (aprobado el 2026-11-25):
 *  1. `gastosMensualesDetalle` guardado y válido.
 *  2. Las 7 columnas legadas, si alguna tiene valor > 0. CAMBIO DE
 *     COMPORTAMIENTO: antes los documentos de estos casos mostraban
 *     `monthlyExpenses` (en la práctica, el del deudor) y no esta suma.
 *  3. `Case.monthlyExpenses`, luego `Debtor.monthlyExpenses`: el comportamiento
 *     de siempre para casos sin ningún gasto desglosado.
 */
export function resolverGastosDelCaso(caso: CasoConGastos): GastosResueltos {
  const guardado = leerDetalleGuardado(caso.gastosMensualesDetalle);
  if (guardado) {
    return {
      origen: 'DETALLE',
      detalle: guardado,
      lineas: lineasDelDetalle(guardado),
      total: guardado.total,
    };
  }

  const derivado = detalleDesdeCamposLegados(caso);
  if (derivado) {
    return {
      origen: 'CAMPOS_LEGADOS',
      detalle: derivado,
      lineas: lineasDelDetalle(derivado),
      total: derivado.total,
    };
  }

  const monto =
    montoLegado(caso.monthlyExpenses) ||
    montoLegado(caso.debtor?.monthlyExpenses);
  return { origen: 'MONTO_LEGADO', detalle: null, lineas: [], total: monto };
}

/**
 * Valores iniciales del formulario para un caso existente: su detalle guardado,
 * o el derivado de las columnas viejas, o vacío.
 */
export function entradaGastosDesdeCaso(
  caso: CasoConGastos,
): ReturnType<typeof entradaGastosVacia> {
  const entrada = entradaGastosVacia();
  const detalle =
    leerDetalleGuardado(caso.gastosMensualesDetalle) ??
    detalleDesdeCamposLegados(caso);
  if (!detalle) return entrada;

  for (const linea of detalle.conceptos) {
    const concepto = conceptoPorClave(linea.clave);
    if (!concepto) continue;
    entrada.conceptos[linea.clave] = {
      valor: formatearPesos(linea.valor),
      periodicidad: periodicidadDe(concepto, linea.periodicidad).id,
    };
  }
  entrada.otros = detalle.otros.map((o) => ({
    concepto: o.concepto,
    valor: formatearPesos(o.valor),
  }));
  return entrada;
}
