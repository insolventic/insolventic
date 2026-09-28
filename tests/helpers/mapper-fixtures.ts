/**
 * Fixtures deterministas de casos completos para caracterizar el mapper de
 * placeholders (`mapCaseToPlaceholders`) y los documentos que se renderizan
 * con su salida.
 *
 * Diseño (importa para que la red de seguridad no dé falsos positivos):
 *
 *  - Valores estables POR CAMPO, no por orden de aparición: cada columna recibe
 *    un valor derivado del hash de su nombre. Agregar o reordenar columnas en el
 *    schema no cambia el valor de las demás, así que no altera ninguna salida.
 *  - Valores DISTINTOS entre campos (cadenas = el nombre del campo, fechas y
 *    montos derivados del hash): si un refactor cruza dos campos, la salida
 *    cambia.
 *  - El modelo real de Prisma (`Prisma.dmmf`) llena las ~270 columnas de Case y
 *    de sus tablas hijas, así el mapper (que referencia 234 columnas) ve datos
 *    en todas sus ramas sin listar campo por campo.
 *  - Sobre esa base, cada escenario fija a mano los datos realistas que importan
 *    (nombres, cédulas, montos, fechas, tipo y fase) y las combinaciones que
 *    activan cada colisión de orden de fusión.
 *
 * Los montos van como `number` (lo que produce la ruta manual): así el resultado
 * es el correcto tanto antes como después del arreglo de los `Prisma.Decimal`.
 */

import { Prisma } from '@prisma/client';

export type Row = Record<string, unknown>;
export type Fill = 'full' | 'minimal';

const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map((e) => [e.name, e]));

/** FNV-1a de 32 bits: estable entre plataformas y versiones de Node. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const DAY = 24 * 60 * 60 * 1000;
const EPOCH = Date.UTC(2026, 0, 5, 15, 0, 0); // 2026-01-05 10:00 en Bogotá

function scalarValue(
  prefix: string,
  f: { name: string; type: string; kind: string },
): unknown {
  const h = hash(`${prefix}.${f.name}`);
  if (f.kind === 'enum') return enums.get(f.type)!.values[0].name;
  switch (f.type) {
    case 'String':
      return `${prefix === 'Case' ? '' : prefix + '.'}${f.name}`;
    case 'Int':
      return 1 + (h % 9);
    case 'Float':
      return 1 + (h % 9) + 0.5;
    case 'Boolean':
      return h % 2 === 0;
    case 'DateTime':
      // Una fecha distinta por campo, dentro de 2026 (antes de la fecha "hoy" congelada).
      return new Date(EPOCH + (h % 60) * DAY);
    case 'Decimal':
      return 1_000_000 + (h % 9) * 250_000;
    case 'BigInt':
      return BigInt(h % 1000);
    case 'Json':
      return null;
    default:
      return null;
  }
}

/**
 * Una fila de `modelName` con todas sus columnas escalares. En modo `minimal`
 * las columnas opcionales quedan en null (el caso "recién creado").
 */
export function row(
  modelName: string,
  fill: Fill = 'full',
  overrides: Row = {},
): Row {
  const out: Row = {};
  for (const f of models.get(modelName)!.fields) {
    if (f.kind === 'object' || f.isList) continue;
    if (fill === 'minimal' && !f.isRequired) {
      out[f.name] = null;
      continue;
    }
    out[f.name] = scalarValue(modelName, f);
  }
  return { ...out, ...overrides };
}

// ---------------------------------------------------------------------------
// Datos realistas reutilizables
// ---------------------------------------------------------------------------

export const DEBTOR_FEMALE = {
  name: 'Ana María Torres Ruiz',
  idNumber: '52123456',
  idType: 'CC',
  email: 'ana.torres@example.com',
  phone: '3105551234',
  address: 'Calle 8 # 3-20 Apto 402',
  city: 'Bogotá',
  department: 'Cundinamarca',
};

export const DEBTOR_MALE = {
  name: 'Carlos Andrés Rojas Peña',
  idNumber: '79654321',
  idType: 'CC',
  email: 'carlos.rojas@example.com',
  phone: '3157778899',
  address: 'Carrera 15 # 82-30',
  city: 'Medellín',
  department: 'Antioquia',
};

export const CREDITORS = [
  'Bancolombia S.A.',
  'Banco de Bogotá',
  'Davivienda',
  'Cooperativa Financiera del Valle',
  'Tarjetas de Crédito Éxito',
  'Fondo de Empleados Progresar',
  'Financiera Comultrasan',
  'Banco Popular',
  'Scotiabank Colpatria',
  'Banco Agrario',
  'Banco Caja Social',
  'Banco AV Villas',
  'Banco de Occidente',
];

/** Representante legal de cada acreedor (mismo índice que CREDITORS). */
export const CREDITOR_REPRESENTATIVES = [
  'Andrés Felipe Cortés',
  'Marcela Ibáñez Trujillo',
  'Rodrigo Salazar Uribe',
  'Diana Patricia Loaiza',
  'Julián Restrepo Vélez',
  'Carolina Muñoz Escobar',
  'Fernando Bustamante Ríos',
  'Ángela Sofía Palacios',
  'Camilo Andrés Zapata',
  'Luz Elena Cárdenas',
  'Sebastián Gaviria Torres',
  'Paula Andrea Mesa',
  'Gustavo Adolfo Henao',
];

export function makeDebt(
  i: number,
  overrides: Row = {},
  fill: Fill = 'full',
): Row {
  const capital = 8_000_000 + i * 2_750_000;
  return {
    ...row('Debt', fill),
    amount: capital + 1_200_000,
    capitalAmount: capital,
    interestAmount: 1_200_000,
    interestRate: 1.9 + (i % 3) * 0.2,
    creditorId: `cred-${i}`,
    creditor: {
      name: CREDITORS[i % CREDITORS.length],
      representative:
        CREDITOR_REPRESENTATIVES[i % CREDITOR_REPRESENTATIVES.length],
    },
    creditorClass: i % 2 === 0 ? 'Quirografario' : 'Hipotecario',
    daysOverdue: 30 * (i + 1),
    hasActiveLibranza: i === 1,
    isDeferred: false,
    ...overrides,
  };
}

export function makeAsset(
  type: string,
  value: number | null,
  overrides: Row = {},
  fill: Fill = 'full',
): Row {
  return {
    ...row('Asset', fill),
    type,
    value,
    name: `Bien ${type.toLowerCase()}`,
    description: `Descripción del bien ${type.toLowerCase()}`,
    ...overrides,
  };
}

export const ASSET_TYPES_BY_CATEGORY = [
  'ELECTRONICO',
  'MUEBLES',
  'VEHICULO',
  'JOYAS',
  'EFECTIVO',
  'ACCIONES',
  'CUENTAS_POR_COBRAR',
] as const;

export interface CaseOptions {
  type?: 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';
  fill?: Fill;
  debtor?: Row;
  debts?: Row[];
  assets?: Row[];
  dependents?: number;
  libranzas?: number;
  suspendedServices?: number;
  legalProcesses?: Row[];
  acreedores?: number;
  bienes?: number;
  procesosJudiciales?: number;
  apoderados?: Row[];
  documents?: Row[];
  causes?: string[];
  applicantScope?: string[];
  overrides?: Row;
}

/**
 * Un caso completo listo para `mapCaseToPlaceholders` / `buildConciliationContext`.
 * Cada colección se puede fijar; por defecto va vacía (caso mínimo) o con datos
 * genéricos según `fill`.
 */
export function makeCase(opts: CaseOptions = {}): Row {
  const fill = opts.fill ?? 'full';
  const type = opts.type ?? 'INSOLVENCY';
  const many = (model: string, n: number) =>
    Array.from({ length: n }, () => row(model, fill));

  const c = row('Case', fill, {
    id: 'case-golden-1',
    caseNumber: 'INS-2026-042',
    type,
    debtorName: (opts.debtor ?? DEBTOR_FEMALE).name as string,
    phase: 'Admisión',
    totalDebt: 87_500_000,
    creditors: (opts.debts ?? []).length,
    version: 1,
    tenantId: 'tenant-golden',
    createdDate: new Date(Date.UTC(2026, 1, 10, 15, 0, 0)),
    ...opts.overrides,
  });

  c.debtor = row('Debtor', fill, { ...DEBTOR_FEMALE, ...opts.debtor });
  c.operator = {
    id: 'op-1',
    name: 'Beatriz Malavera',
    email: 'beatriz@example.com',
  };
  c._count = { documents: (opts.documents ?? []).length };
  c.documents = opts.documents ?? [];
  c.debts = opts.debts ?? [];
  c.assets = opts.assets ?? [];
  c.dependents = many('Dependent', opts.dependents ?? 0);
  c.libranzas = many('Libranza', opts.libranzas ?? 0);
  c.suspendedServices = many('SuspendedService', opts.suspendedServices ?? 0);
  c.legalProcesses = opts.legalProcesses ?? [];
  c.acreedores = many('Acreedor', opts.acreedores ?? 0);
  c.bienes = many('Bien', opts.bienes ?? 0);
  c.procesosJudiciales = many('ProcesoJudicial', opts.procesosJudiciales ?? 0);
  c.apoderados = opts.apoderados ?? [];
  c.causes = opts.causes ?? [];
  c.applicantScope = opts.applicantScope ?? [];
  return c;
}

export const APODERADO = {
  id: 'apo-1',
  orden: 0,
  nombreCompleto: 'María Fernanda Torres Gil',
  tipoIdentificacion: 'CC',
  identificacion: '51876543',
  tarjetaProfesional: 'TP-123456',
  direccion: 'Carrera 7 # 45-67 Of. 301',
  telefono: '3115678901',
  correo: 'mftorres@abogados.example.com',
};

export function makeLegalProcess(i: number, overrides: Row = {}): Row {
  return {
    ...row('LegalProcess'),
    processType: 'Ejecutivo singular',
    plaintiff: CREDITORS[i % CREDITORS.length],
    court: `Juzgado ${10 + i} Civil Municipal de Bogotá`,
    fileNumber: `11001-40-03-0${10 + i}-2025-00${100 + i}`,
    precautionaryMeasure: 'Embargo de salario',
    ...overrides,
  };
}
