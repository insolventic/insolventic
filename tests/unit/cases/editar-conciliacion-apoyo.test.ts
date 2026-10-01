/**
 * Un caso de Conciliación o de Acuerdo de Apoyo se puede editar.
 *
 * Hallazgo A1 de la auditoría del formulario de conciliación (2026-10-01): el
 * diálogo de edición era de insolvencia y nada más. Ocho pestañas, todas de
 * insolvencia; no importaba `ConciliationPartiesSection` ni
 * `ConciliationDetailsSection` ni las dos de apoyo, y su `submitData` enumeraba
 * a mano ~69 campos sin un solo `conc*` ni `apoyo*`.
 *
 * El efecto no era perder datos —`updateCase` hace `...rest` sobre un esquema
 * parcial, así que una columna ausente del payload queda intacta— sino algo más
 * silencioso: los campos quedaban de **escritura única**. Un error de tipeo en
 * el nombre del convocado, en su dirección o en una cláusula del acuerdo era
 * permanente desde la aplicación.
 *
 * El guardián de abajo lee el código fuente a propósito: lo que hay que fijar
 * es que el diálogo **conozca** estos campos, y eso no se ve renderizando una
 * pestaña — se ve en qué importa y qué manda.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import fs from 'fs';
import path from 'path';

import { P } from '@/lib/permissions';
import { updateCase } from '@/features/case/actions';
import { createCaseSchema, updateCaseSchema } from '@/features/case/schemas';

import {
  isTypeSpecificField,
  pickTypeSpecificFields,
  pickTypeSpecificValues,
  TYPE_SPECIFIC_JSON_FIELDS,
} from '@/app/cases/components/edit-case-dialog/type-specific-fields';

const SRC = path.join(process.cwd(), 'src');
const leer = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Las columnas reales, leídas del schema: el contrato que hay que cubrir. */
function columnasDelCaso(prefijo: string): string[] {
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'src', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const modelo = /^model Case \{([\s\S]*?)^\}/m.exec(schema)![1];
  return [
    ...new Set(
      [...modelo.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9]*)\s/gm)]
        .map((m) => m[1])
        .filter((n) => n.startsWith(prefijo)),
    ),
  ];
}

describe('isTypeSpecificField — cubre las columnas reales del schema', () => {
  it('reconoce las 71 columnas conc* del modelo Case', () => {
    const conc = columnasDelCaso('conc');

    expect(conc.length).toBeGreaterThan(60);
    expect(conc.every(isTypeSpecificField)).toBe(true);
  });

  it('reconoce las columnas apoyo* del modelo Case', () => {
    const apoyo = columnasDelCaso('apoyo');

    expect(apoyo.length).toBeGreaterThan(20);
    expect(apoyo.every(isTypeSpecificField)).toBe(true);
  });

  it('no se lleva por delante campos de insolvencia', () => {
    for (const k of [
      'debtorId',
      'totalDebt',
      'operatorId',
      'spouseName',
      'conyugeNombreCompleto',
      'serviciosManutencion',
    ]) {
      expect(isTypeSpecificField(k)).toBe(false);
    }
  });
});

describe('pickTypeSpecificFields — la precarga', () => {
  it('recoge los campos del caso guardado', () => {
    const out = pickTypeSpecificFields({
      id: 'c1',
      debtorId: 'd1',
      concConvocadoName: 'Pedro Ramírez',
      apoyoResultado: 'ACUERDO',
    });

    expect(out).toEqual({
      concConvocadoName: 'Pedro Ramírez',
      apoyoResultado: 'ACUERDO',
    });
  });

  it('un null de la base se vuelve cadena vacía, no null', () => {
    // Un `null` en un <Input> lo vuelve no controlado y React avisa por consola.
    const out = pickTypeSpecificFields({ concConvocadoCiudad: null });

    expect(out.concConvocadoCiudad).toBe('');
  });

  it('las columnas Json nulas se vuelven arreglo vacío', () => {
    // `useFieldArray` necesita un arreglo: con null el bloque de cláusulas no
    // se renderiza.
    const out = pickTypeSpecificFields({
      concClausulasAcuerdo: null,
      apoyoClausulas: null,
    });

    expect(out.concClausulasAcuerdo).toEqual([]);
    expect(out.apoyoClausulas).toEqual([]);
  });

  it('un arreglo con contenido se conserva tal cual', () => {
    const clausulas = [{ texto: 'Primera' }, { texto: 'Segunda' }];
    const out = pickTypeSpecificFields({ concClausulasAcuerdo: clausulas });

    expect(out.concClausulasAcuerdo).toBe(clausulas);
  });

  it('sin caso devuelve vacío en vez de romper', () => {
    expect(pickTypeSpecificFields(null)).toEqual({});
    expect(pickTypeSpecificFields(undefined)).toEqual({});
  });

  it('las 7 columnas Json del schema están todas declaradas', () => {
    const json = [
      ...columnasDelCaso('conc'),
      ...columnasDelCaso('apoyo'),
    ].filter((c) => TYPE_SPECIFIC_JSON_FIELDS.has(c));

    expect(json).toHaveLength(TYPE_SPECIFIC_JSON_FIELDS.size);
  });
});

describe('pickTypeSpecificValues — el envío', () => {
  it('manda lo que el formulario tenga, sin normalizar', () => {
    const out = pickTypeSpecificValues({
      concConvocadoName: 'Pedro',
      concConvocadoCiudad: '',
      apoyoClausulas: [],
      totalDebt: '100',
    });

    expect(out).toEqual({
      concConvocadoName: 'Pedro',
      concConvocadoCiudad: '',
      apoyoClausulas: [],
    });
  });

  it('una clave ausente no viaja: updateCase deja esa columna como estaba', () => {
    const out = pickTypeSpecificValues({ debtorId: 'd1' });

    expect(out).toEqual({});
    expect('concConvocadoName' in out).toBe(false);
  });
});

describe('guardián: el diálogo de edición conoce los dos tipos', () => {
  const dialogo = leer('app/cases/components/edit-case-dialog.tsx');

  it('importa las dos secciones de conciliación', () => {
    expect(dialogo).toContain('ConciliationPartiesSection');
    expect(dialogo).toContain('ConciliationDetailsSection');
  });

  it('importa las dos secciones de acuerdo de apoyo', () => {
    expect(dialogo).toContain('SupportAgreementPartiesSection');
    expect(dialogo).toContain('SupportAgreementDetailsSection');
  });

  it('precarga los campos del tipo al resetear el formulario', () => {
    expect(dialogo).toContain('pickTypeSpecificFields');
  });

  it('los manda en el submit: era lo que faltaba y los volvía de escritura única', () => {
    expect(dialogo).toContain('pickTypeSpecificValues');
  });

  it('las pestañas se eligen por tipo de caso, como en el alta', () => {
    expect(dialogo).toMatch(/CONCILIATION_TABS|conc-parties/);
    expect(dialogo).toMatch(/SUPPORT_AGREEMENT_TABS|apoyo-parties/);
  });
});

/**
 * La otra mitad: que el dato efectivamente se escriba.
 *
 * Los guardianes de arriba fijan que el diálogo CONOZCA los campos. Esto fija
 * la consecuencia en la base, que es donde se veía el defecto: un payload sin
 * las claves deja la columna como estaba —por eso no se perdían datos y nadie
 * lo notó— y uno con las claves sí la escribe.
 */
describe('updateCase — el payload decide si la columna cambia', () => {
  const dataDeUpdate = (): Record<string, unknown> => {
    const llamada = (mockPrisma.case.update as jest.Mock).mock.calls.at(-1);
    return (llamada?.[0] as { data: Record<string, unknown> }).data;
  };

  const payloadBase = {
    id: 'case-1',
    version: 1,
    debtorId: 'debtor-1',
    operatorId: 'user-1',
    type: 'CONCILIATION' as const,
    totalDebt: 0,
    // `updateCaseSchema` exige al menos un acreedor INCLUSO en conciliacion,
    // donde no hay acreedores: es una regla de insolvencia que se cuela en
    // los otros dos tipos. Queda anotado; no se arregla aca.
    creditors: 1,
  };

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: { id: 'user-1', name: 'Operadora', permissions: [P.EDITAR_CASOS] },
      tenantId: 'tenant-1',
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      tenantId: 'tenant-1',
      version: 1,
      debtorId: 'debtor-1',
      caseNumber: 'CON-2026-001',
      debtorName: 'Ana Torres',
    });
    mockPrisma.case.update.mockResolvedValue({
      id: 'case-1',
      caseNumber: 'CON-2026-001',
      debtorName: 'Ana Torres',
      type: 'CONCILIATION',
      totalDebt: 0,
      creditors: 0,
      phase: 'Inicial',
      createdDate: new Date(),
      operatorId: 'user-1',
      tenantId: 'tenant-1',
    });
  });

  it('EL DEFECTO: sin la clave en el payload, la columna no se toca', async () => {
    await updateCase(payloadBase as never);

    // Era exactamente el payload que armaba el diálogo de edición: ni un
    // `conc*`. La columna queda como estaba, así que el dato sobrevive pero
    // no hay manera de corregirlo.
    expect('concConvocadoName' in dataDeUpdate()).toBe(false);
  });

  it('con la clave en el payload, la columna sí se escribe', async () => {
    await updateCase({
      ...payloadBase,
      concConvocadoName: 'Pedro Ramírez Gómez',
      concConvocadoCiudad: 'Cali',
    } as never);

    expect(dataDeUpdate().concConvocadoName).toBe('Pedro Ramírez Gómez');
    expect(dataDeUpdate().concConvocadoCiudad).toBe('Cali');
  });

  it('un valor vacío también se escribe: borrar un dato es una edición válida', async () => {
    await updateCase({
      ...payloadBase,
      concConvocadoCiudad: '',
    } as never);

    expect(dataDeUpdate().concConvocadoCiudad).toBe('');
  });

  it('lo mismo para los campos de acuerdo de apoyo', async () => {
    await updateCase({
      ...payloadBase,
      type: 'SUPPORT_AGREEMENT',
      apoyoResultado: 'ACUERDO',
    } as never);

    expect(dataDeUpdate().apoyoResultado).toBe('ACUERDO');
  });
});

/**
 * El hallazgo que salió al escribir los tests de arriba, y que era peor que A1.
 *
 * `caseSchema` (lectura) declaraba las 29 columnas `apoyo*`, pero
 * `createCaseSchema` y `updateCaseSchema` **no declaraban ninguna**. Zod
 * descarta las claves que no conoce, así que los 28 campos que recoge el
 * formulario de Acuerdo de Apoyo se perdían en silencio en el alta y en la
 * edición: nunca llegaban a la base, aunque las columnas, el mapper y las
 * plantillas existieran. Las de conciliación sí estaban declaradas; estas se
 * quedaron afuera.
 *
 * Sin esto, las pestañas de apoyo que agrega este PR habrían sido un formulario
 * que no guarda nada.
 */
describe('los esquemas de entrada declaran los campos de los tres tipos', () => {
  const declarados = (
    schema: { shape: Record<string, unknown> },
    pre: string,
  ) => Object.keys(schema.shape).filter((k) => k.startsWith(pre));

  it('createCaseSchema declara las 29 columnas apoyo* del modelo', () => {
    expect(declarados(createCaseSchema, 'apoyo')).toHaveLength(
      columnasDelCaso('apoyo').length,
    );
  });

  it('updateCaseSchema declara las 29 columnas apoyo* del modelo', () => {
    expect(declarados(updateCaseSchema, 'apoyo')).toHaveLength(
      columnasDelCaso('apoyo').length,
    );
  });

  it('y las conc*, que ya estaban, siguen declaradas en los dos', () => {
    const conc = columnasDelCaso('conc').length;

    expect(declarados(createCaseSchema, 'conc')).toHaveLength(conc);
    expect(declarados(updateCaseSchema, 'conc')).toHaveLength(conc);
  });

  it('un payload de apoyo sobrevive al parse en vez de quedar vacío', () => {
    const parsed = createCaseSchema.partial().parse({
      apoyoResultado: 'ACUERDO',
      apoyoConciliadoraName: 'Dra. Marta Gómez',
    });

    expect(parsed.apoyoResultado).toBe('ACUERDO');
    expect(parsed.apoyoConciliadoraName).toBe('Dra. Marta Gómez');
  });
});
