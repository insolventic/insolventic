/**
 * Verificación de punta a punta: formulario → BD → documento.
 *
 * POR QUÉ EXISTE. `case-wizard.db.test.ts` comprueba que el wizard GUARDA bien.
 * Esta suite comprueba lo siguiente: que lo guardado LLEGA al documento. Son
 * dos preguntas distintas y la segunda no la cubría nada — ni los tests
 * unitarios (que mockean Prisma y arman el caso a mano), ni el golden master
 * (que congela la salida actual, con sus errores incluidos), ni el E2E.
 *
 * La ronda de verificación del 2026-10-03
 * (`docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`) encontró 17 defectos de
 * esta forma, 4 de ellos críticos. Seis los detecta este harness sin que nadie
 * mire: lo que sigue es ese harness, convertido en red permanente.
 *
 * QUÉ ES REAL Y QUÉ NO
 *  - Real: Postgres, el cliente de Prisma, `createCase` con sus reglas de
 *    negocio y su persistencia anidada, `mapCaseToPlaceholders`,
 *    `prepareTemplate` y las 65 plantillas del disco.
 *  - Simulado: solo lo que necesita el runtime de Next (cookies,
 *    `revalidateTag`, `after()`) y el job de generación, que iría a Google
 *    Drive y a Chromium.
 *
 * NO GENERA PDF. Todo lo que esta suite verifica vive en el HTML renderizado;
 * el PDF solo agrega el paso de Chromium, que es lento y no aporta señal. La
 * ronda manual sí los generó, para revisarlos a ojo.
 *
 * SEGURIDAD: `tests/db/setup.ts` aborta si DATABASE_URL no es una base local de
 * prueba. Cada corrida crea su propio tenant y lo borra al terminar.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { createCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import {
  mapCaseToPlaceholders,
  buildTemplateContext,
} from '@/features/document/placeholder-mapper';
import { prepareTemplate } from '@/features/document/prepare-template';
import {
  getTemplatesByCaseType,
  getTemplatePath,
} from '@/features/document/templates-config';
import {
  templateVariants,
  jobKey,
} from '@/features/document/template-variants';
import {
  asCaseWithRelations,
  CASE_GENERATION_INCLUDE,
} from '@/features/document/persistence';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';
import { FIXTURES, type CaseFixture } from './helpers/casos-sinteticos';
import {
  PLANTILLAS_CON_PLACEHOLDER_FALTANTE,
  VALORES_QUE_NO_LLEGAN,
} from './helpers/pendientes-conocidos';

const TAG = `e2edocs-${Date.now().toString(36)}`;

/** Un documento ya renderizado, con lo que hace falta para juzgarlo. */
interface DocumentoRenderizado {
  key: string;
  templateId: string;
  templateName: string;
  templatePath: string;
  html: string;
  unresolved: string[];
}

/** Lo que queda listo en `beforeAll` para que cada `it` solo mire. */
interface CasoRenderizado {
  fixture: CaseFixture;
  caseNumber: string;
  /** Fila de `Case` tal como la lee la generación. */
  stored: Record<string, unknown>;
  documentos: DocumentoRenderizado[];
  /** Todo el HTML junto, para buscar un valor en "algún documento". */
  htmlCompleto: string;
}

const ctx = { tenantId: '', userId: '' };
const renderizados = new Map<string, CasoRenderizado>();
const fallosDeCreacion: Array<{ key: string; error: string }> = [];

/** Normaliza para comparar: sin tildes, sin espacios repetidos, minúsculas. */
function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** `2026-02-11` → las dos formas en que las plantillas imprimen una fecha. */
function formasDeFecha(iso: string): string[] {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const opts = { timeZone: 'UTC' } as const;
  const dosDigitos = d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opts,
  });
  const enLetras = d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...opts,
  });
  const sinCero = enLetras.replace(/^0/, '');
  return [dosDigitos, enLetras, sinCero];
}

/** Todas las fechas `YYYY-MM-DD` del payload, con su ruta. */
function fechasDelFormulario(
  obj: Record<string, unknown>,
  prefijo = '',
  acc: Array<[string, string]> = [],
): Array<[string, string]> {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      acc.push([prefijo + k, v]);
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') {
          fechasDelFormulario(
            item as Record<string, unknown>,
            `${prefijo}${k}[${i}].`,
            acc,
          );
        }
      });
    }
  }
  return acc;
}

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG);
  ctx.tenantId = tenant.tenantId;
  ctx.userId = tenant.userId;
  mockCookies.setToken('access-token', tenant.token);

  for (const fixture of FIXTURES) {
    const debtor = await prisma.debtor.create({
      data: { ...fixture.debtor, tenantId: ctx.tenantId },
    });

    const parsed = createCaseFormSchema.parse({
      ...fixture.form,
      debtorId: debtor.id,
      operatorId: ctx.userId,
    }) as Record<string, unknown>;

    const result = await createCase(wizardSubmit(parsed) as never);
    if (!result.success || !result.data) {
      fallosDeCreacion.push({
        key: fixture.key,
        error: result.error ?? 'sin error',
      });
      continue;
    }

    const stored = await prisma.case.findUniqueOrThrow({
      where: { id: result.data.id },
      include: CASE_GENERATION_INCLUDE,
    });
    const caseData = asCaseWithRelations(stored as never);
    const placeholders = mapCaseToPlaceholders(caseData);
    const extraContext = buildTemplateContext(caseData);

    const documentos: DocumentoRenderizado[] = [];
    for (const template of getTemplatesByCaseType(fixture.caseType)) {
      for (const variant of templateVariants(template, caseData)) {
        const prepared = await prepareTemplate(
          template,
          placeholders,
          extraContext,
          variant,
        );
        documentos.push({
          key: jobKey(template, variant),
          templateId: template.id,
          templateName: template.name,
          templatePath: getTemplatePath(template),
          html: prepared.html,
          unresolved: prepared.unresolved,
        });
      }
    }

    renderizados.set(fixture.key, {
      fixture,
      caseNumber: result.data.caseNumber,
      stored: stored as unknown as Record<string, unknown>,
      documentos,
      htmlCompleto: norm(documentos.map((d) => d.html).join('\n')),
    });
  }
}, 180_000);

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('los 8 expedientes sintéticos se crean', () => {
  it('ninguno es rechazado por createCase', () => {
    expect(fallosDeCreacion).toEqual([]);
    expect(renderizados.size).toBe(FIXTURES.length);
  });
});

describe.each(FIXTURES.map((f) => [f.key, f] as const))(
  '%s',
  (key, fixture) => {
    const caso = () => {
      const c = renderizados.get(key);
      if (!c) throw new Error(`El expediente ${key} no se llegó a crear`);
      return c;
    };

    it('genera un documento por cada plantilla de su trámite', () => {
      const plantillas = getTemplatesByCaseType(fixture.caseType).length;
      expect(caso().documentos.length).toBeGreaterThanOrEqual(plantillas);
    });

    it('las plantillas con placeholders sin resolver son exactamente las conocidas', () => {
      // Un `unresolved` no vacío no es cosmético: las DOS rutas de generación
      // bloquean el documento, así que la plantilla no produce nada para ningún
      // expediente. Así se descubrió que el Check List nunca se generaba.
      //
      // Se compara contra el inventario de `pendientes-conocidos.ts`: falla si
      // aparece una plantilla nueva Y TAMBIÉN si se arregla una y nadie la
      // borra de la lista.
      const rotas = caso()
        .documentos.filter((d) => d.unresolved.length > 0)
        .map((d) => d.templateId)
        .sort();
      const esperadas = Object.keys(PLANTILLAS_CON_PLACEHOLDER_FALTANTE)
        .filter((id) => caso().documentos.some((d) => d.templateId === id))
        .sort();
      expect(rotas).toEqual(esperadas);
    });

    it('ningún documento generable muestra «FALTA:» ni llaves sin resolver', () => {
      const sucios = caso()
        .documentos.filter(
          (d) => !(d.templateId in PLANTILLAS_CON_PLACEHOLDER_FALTANTE),
        )
        .filter(
          (d) =>
            d.html.includes('«FALTA:') || /\{\{[A-Za-z0-9_]+\}\}/.test(d.html),
        )
        .map((d) => d.templatePath);
      expect(sucios).toEqual([]);
    });

    it('ningún documento muestra NaN, undefined, null ni [object Object]', () => {
      const artefactos = /\bNaN\b|\bundefined\b|\[object Object\]|Invalid Date/;
      const sucios = caso()
        .documentos.filter((d) => artefactos.test(d.html))
        .map((d) => d.templatePath);
      expect(sucios).toEqual([]);
    });

    it('los valores que no llegan al documento son exactamente los conocidos', () => {
      const { htmlCompleto } = caso();
      const ausentes = Object.entries(fixture.expectations)
        .filter(([, valor]) => valor && valor.length >= 6)
        .filter(([, valor]) => !htmlCompleto.includes(norm(valor).slice(0, 70)))
        .map(([campo]) => campo)
        .sort();
      // Una entrada de la lista aplica a todos los expedientes ("campo") o a
      // uno solo ("clave-del-caso:campo").
      const esperados = Object.keys(VALORES_QUE_NO_LLEGAN)
        .map((clave) =>
          clave.includes(':') ? clave.split(':') : [null, clave],
        )
        .filter(([caso]) => caso === null || caso === key)
        .map(([, campo]) => campo as string)
        .filter((campo) => campo in fixture.expectations)
        .sort();
      expect(ausentes).toEqual(esperados);
    });

    it('las fechas se imprimen con el día que se cargó, no el anterior', () => {
      const { htmlCompleto } = caso();
      const fechas = fechasDelFormulario(fixture.form);
      // El día anterior de una fecha puede ser, letra por letra, el día
      // CORRECTO de otra del mismo expediente (admissionDate = 25 frente a
      // suspensionDate = 26 corrida). Sin esto se acusa un corrimiento que no
      // existe, y encima en un campo que ninguna plantilla imprime.
      const formasCorrectas = new Set(
        fechas.flatMap(([, iso]) => formasDeFecha(iso).map(norm)),
      );
      const corridas: string[] = [];
      for (const [campo, iso] of fechas) {
        const correcta = formasDeFecha(iso).some((f) =>
          htmlCompleto.includes(norm(f)),
        );
        const anterior = new Date(`${iso}T12:00:00.000Z`);
        anterior.setUTCDate(anterior.getUTCDate() - 1);
        const formasAnteriores = formasDeFecha(
          anterior.toISOString().slice(0, 10),
        );
        const ambigua = formasAnteriores.some((f) =>
          formasCorrectas.has(norm(f)),
        );
        const corrida =
          !ambigua &&
          formasAnteriores.some((f) => htmlCompleto.includes(norm(f)));
        // Solo se acusa cuando aparece la corrida y NO la correcta.
        if (corrida && !correcta) corridas.push(`${campo} = ${iso}`);
      }
      expect(corridas).toEqual([]);
    });
  },
);

describe('la Solicitud de Insolvencia declara las causas que marcó el deudor', () => {
  // Las dos formas que conviven en la base: etiqueta (expedientes anteriores a
  // la unificación) y valor canónico (lo que guarda el wizard desde entonces).
  it.each([
    [
      'I1-insolvencia-completa',
      'etiquetas',
      ['PERDIDA DE EMPLEO', 'ENFERMEDAD'],
    ],
    [
      'I3-insolvencia-volumen',
      'valores canónicos',
      ['SOBREENDEUDAMIENTO POR FALTA DE RECURSOS', 'DISMINUCIÓN DE INGRESOS'],
    ],
  ])('%s (%s)', (key, _forma, filasEsperadas) => {
    const solicitud = renderizados
      .get(key)!
      .documentos.find((d) => d.templateId === 'solicitud-insolvencia')!;

    // Cada fila de la tabla es `<td>N</td><td>CAUSA</td><td>SI|NO</td>`.
    const filas = [
      ...solicitud.html.matchAll(
        /<td>(\d+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>(SI|NO)<\/td>/g,
      ),
    ].map(([, , causa, marca]) => [norm(causa), marca] as const);

    expect(filas.length).toBeGreaterThanOrEqual(12);

    // Se arma el par causa→marca esperado y se compara de una, para que el
    // mensaje de fallo diga qué fila salió mal y con qué valor.
    const marcas = filasEsperadas.map((esperada) => {
      const fila = filas.find(([causa]) => causa === norm(esperada));
      return `${esperada}: ${fila ? fila[1] : 'NO ENCONTRÉ LA FILA'}`;
    });
    expect(marcas).toEqual(filasEsperadas.map((e) => `${e}: SI`));

    // Y las no marcadas siguen en NO: la tabla no puede decir SI a todo.
    expect(filas.some(([, marca]) => marca === 'NO')).toBe(true);
  });
});

describe('lo que el wizard envía queda guardado', () => {
  const NO_SON_COLUMNAS_DE_CASE = new Set([
    'debts',
    'assets',
    'libranzas',
    'suspendedServices',
    'dependents',
    'legalProcesses',
    'apoderados',
    'monthlyIncome',
    'monthlyExpenses',
    'otherIncomeDescription',
    'otherIncomeAmount',
    'hasEmployerCertification',
    'debtorId',
    'operatorId',
    'caseNumber',
    'phase',
    'creditors',
    // `causes` se normaliza al guardar, así que no se compara literal.
    'causes',
  ]);

  it.each(FIXTURES.map((f) => [f.key] as const))(
    '%s: ningún campo escalar se pierde entre el formulario y la fila',
    (key) => {
      const { fixture, stored } = renderizados.get(key)!;
      const perdidos: string[] = [];

      for (const [campo, valor] of Object.entries(fixture.form)) {
        if (NO_SON_COLUMNAS_DE_CASE.has(campo)) continue;
        if (valor === undefined || valor === null || valor === '') continue;
        if (Array.isArray(valor) || typeof valor === 'object') continue;

        if (!(campo in stored)) {
          perdidos.push(`${campo}: no existe la columna`);
          continue;
        }
        const guardado = stored[campo];
        if (guardado === null || guardado === undefined || guardado === '') {
          perdidos.push(`${campo}: se envió "${String(valor)}" y quedó vacío`);
        }
      }

      expect(perdidos).toEqual([]);
    },
  );

  it.each(FIXTURES.map((f) => [f.key] as const))(
    '%s: las listas anidadas se guardan completas',
    (key) => {
      const { fixture, stored } = renderizados.get(key)!;
      const listas = [
        'debts',
        'assets',
        'libranzas',
        'suspendedServices',
        'dependents',
        'legalProcesses',
        'apoderados',
      ] as const;

      const cuentas = Object.fromEntries(
        listas.map((l) => [
          l,
          {
            enviadas: ((fixture.form[l] as unknown[]) ?? []).length,
            guardadas: ((stored[l] as unknown[]) ?? []).length,
          },
        ]),
      );

      for (const [lista, { enviadas, guardadas }] of Object.entries(cuentas)) {
        expect(`${lista}: ${guardadas}`).toBe(`${lista}: ${enviadas}`);
      }
    },
  );
});
