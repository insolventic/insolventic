/**
 * El SMMLV tiene UNA sola fuente: `SMMLV_BY_YEAR` en `validation-rules.ts`.
 *
 * Antes convivían tres. El servidor resolvía el umbral con `getSmmlv(año)`, el
 * wizard de alta con la constante `SMMLV_2025` (el valor de 2025) y el mapper
 * de documentos con un literal `1300000` (el de 2024). Para una misma deuda los
 * tres podían dar veredictos distintos sobre si el apoderado judicial es
 * obligatorio: con $60.000.000 radicados en 2026, el wizard avisaba, el
 * servidor no, y el Check List marcaba la casilla contraria a la del
 * formulario.
 *
 * Lo que fija este archivo:
 *   1. cliente y servidor coinciden en el umbral, por debajo y por encima, en
 *      los tres años que importan;
 *   2. el año sale del expediente y no del reloj;
 *   3. la degradación a un año no cargado deja rastro;
 *   4. el documento imprime el umbral del año correcto;
 *   5. no reaparece ningún literal de SMMLV fuera de la fuente.
 */

import fs from 'fs';
import path from 'path';

import {
  getSmmlv,
  smmlvYearForCase,
  validateMinimaCuantia,
  validateCaseBusinessRules,
  SMMLV_BY_YEAR,
  LATEST_SMMLV_YEAR,
} from '@/features/case/validation-rules';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { logger } from '@/lib/logger';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

type Row = Record<string, unknown>;

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

/**
 * El archivo sin comentarios.
 *
 * Las guardias de este archivo miran CÓDIGO. Los comentarios tienen que poder
 * nombrar lo que se quitó —`SMMLV_2025`, el literal `1300000`— porque explicar
 * de dónde viene un cambio es justamente para lo que están; una guardia que
 * prohibiera mencionarlos obligaría a borrar la explicación junto con el bug.
 */
const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ---------------------------------------------------------------------------
// 1. Paridad cliente ↔ servidor
// ---------------------------------------------------------------------------

/**
 * Lo que hace el wizard, extraído a una función para poder compararlo con el
 * servidor sin renderizar React. No es una reimplementación: es literalmente la
 * misma llamada que `create-case-dialog.tsx` hace en `runValidations`, y el
 * test de abajo verifica contra el código fuente que siga siendo así.
 */
function avisoDelWizard(
  totalDebt: number,
  hasAttorney: boolean,
  year: number,
): boolean {
  return validateMinimaCuantia(totalDebt, hasAttorney, year).length > 0;
}

/** Lo que decide el servidor, por el camino real de la server action. */
function cortaElServidor(
  totalDebt: number,
  hasAttorney: boolean,
  year: number,
): boolean {
  const resultado = validateCaseBusinessRules(
    {
      type: 'INSOLVENCY',
      debts: [{ capitalAmount: totalDebt, interestAmount: 0 } as never],
      ...(hasAttorney
        ? { apoderadoNombreCompleto: 'María Fernanda Torres Gil' }
        : {}),
    },
    { mode: 'create', year },
  );
  return [...resultado.issues, ...resultado.warnings].some(
    (i) => i.field === 'attorney',
  );
}

describe('paridad wizard ↔ servidor en la mínima cuantía', () => {
  for (const year of [2025, 2026, 2027]) {
    describe(`año de radicación ${year}`, () => {
      const umbral = 40 * getSmmlv(year);

      const casos: Array<[string, number]> = [
        ['por debajo del umbral', umbral - 1],
        ['justo en el umbral', umbral],
        ['por encima del umbral', umbral + 1],
      ];

      for (const [rotulo, deuda] of casos) {
        it(`${rotulo} (${deuda}): los dos dicen lo mismo, sin apoderado`, () => {
          expect(avisoDelWizard(deuda, false, year)).toBe(
            cortaElServidor(deuda, false, year),
          );
        });

        it(`${rotulo} (${deuda}): los dos dicen lo mismo, con apoderado`, () => {
          expect(avisoDelWizard(deuda, true, year)).toBe(
            cortaElServidor(deuda, true, year),
          );
        });
      }

      it('el umbral es estricto: en el valor exacto todavía no exige apoderado', () => {
        expect(avisoDelWizard(umbral, false, year)).toBe(false);
        expect(avisoDelWizard(umbral + 1, false, year)).toBe(true);
      });

      it('con apoderado no se exige apoderado por encima del umbral', () => {
        expect(avisoDelWizard(umbral + 1, true, year)).toBe(false);
      });
    });
  }

  it('la banda que antes los separaba ahora coincide', () => {
    // Entre 40 × SMMLV de 2025 y 40 × SMMLV de 2026 estaba el desacuerdo: el
    // wizard avisaba sobre la base de 2025 y el servidor sobre la de 2026.
    const enLaBanda = (40 * getSmmlv(2025) + 40 * getSmmlv(2026)) / 2;
    expect(enLaBanda).toBeGreaterThan(40 * getSmmlv(2025));
    expect(enLaBanda).toBeLessThan(40 * getSmmlv(2026));

    expect(avisoDelWizard(enLaBanda, false, 2026)).toBe(false);
    expect(cortaElServidor(enLaBanda, false, 2026)).toBe(false);
    expect(avisoDelWizard(enLaBanda, false, 2025)).toBe(true);
    expect(cortaElServidor(enLaBanda, false, 2025)).toBe(true);
  });

  it('el wizard llama a la función compartida y no recalcula el umbral', () => {
    // Guardia de código fuente: lo que garantiza la paridad no es este archivo
    // de tests sino que el componente no tenga su propia aritmética.
    const wizard = sinComentarios(
      read('src/app/cases/components/create-case-dialog.tsx'),
    );
    expect(wizard).toContain('validateMinimaCuantia(');
    expect(wizard).toContain('smmlvYearForCase(');
    expect(wizard).not.toMatch(/40\s*\*/);
    expect(wizard).not.toContain('SMMLV_2025');
  });
});

// ---------------------------------------------------------------------------
// 2. El año sale del expediente
// ---------------------------------------------------------------------------

describe('smmlvYearForCase — de dónde sale el año', () => {
  it('manda la fecha de radicación', () => {
    expect(
      smmlvYearForCase({
        filingDate: '2025-06-15',
        createdDate: new Date('2026-06-15T12:00:00Z'),
      }),
    ).toBe(2025);
  });

  it('sin radicación, la fecha de creación del expediente', () => {
    expect(
      smmlvYearForCase({
        filingDate: null,
        createdDate: new Date('2024-09-01T12:00:00Z'),
      }),
    ).toBe(2024);
  });

  it('sin ninguna de las dos, el año en curso', () => {
    expect(smmlvYearForCase({})).toBe(new Date().getFullYear());
    expect(smmlvYearForCase({ filingDate: null, createdDate: null })).toBe(
      new Date().getFullYear(),
    );
  });

  it('el 1 de enero no se va al año anterior', () => {
    // El riesgo real: Colombia está detrás de UTC, así que leer `getFullYear()`
    // crudo sobre una fecha-sin-hora del 1 de enero devuelve el año anterior.
    expect(smmlvYearForCase({ filingDate: '2026-01-01' })).toBe(2026);
    expect(smmlvYearForCase({ filingDate: '2025-01-01' })).toBe(2025);
  });

  it('el 31 de diciembre no se va al año siguiente', () => {
    expect(smmlvYearForCase({ filingDate: '2025-12-31' })).toBe(2025);
  });

  it('las filas viejas ancladas a medianoche UTC se leen en UTC', () => {
    // Así las guardaba el sistema antes de `parseDateOnly`. Leerlas en hora de
    // Colombia las correría un día, y un 1 de enero, un año.
    expect(
      smmlvYearForCase({ filingDate: new Date('2026-01-01T00:00:00.000Z') }),
    ).toBe(2026);
  });

  it('una fecha con hora real se lee en hora de Colombia', () => {
    // 2026-01-01T02:00Z son las 21:00 del 31-dic-2025 en Bogotá.
    expect(
      smmlvYearForCase({ filingDate: new Date('2026-01-01T02:00:00.000Z') }),
    ).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// 3. La degradación deja rastro
// ---------------------------------------------------------------------------

describe('getSmmlv — año no cargado', () => {
  afterEach(() => jest.restoreAllMocks());

  it('avisa y cae al último año conocido', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const sinCargar = LATEST_SMMLV_YEAR + 5;

    expect(getSmmlv(sinCargar)).toBe(SMMLV_BY_YEAR[LATEST_SMMLV_YEAR]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({
      action: 'smmlv',
      anioPedido: sinCargar,
      anioUsado: LATEST_SMMLV_YEAR,
    });
  });

  it('con el año cargado no avisa', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    for (const year of Object.keys(SMMLV_BY_YEAR).map(Number)) {
      expect(getSmmlv(year)).toBe(SMMLV_BY_YEAR[year]);
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. El documento usa el mismo umbral
// ---------------------------------------------------------------------------

describe('Check List — umbrales del documento', () => {
  /** Caso de insolvencia con la deuda y las fechas que se le pidan. */
  const caso = (deuda: number, fechas: Row): Row => {
    const base = SCENARIOS['insolvencia-completa'].build() as Row;
    return {
      ...base,
      ...fechas,
      debts: [
        {
          ...(base.debts as Row[])[0],
          amount: deuda,
          capitalAmount: deuda,
          interestAmount: 0,
        },
      ],
    };
  };

  it('imprime el SMMLV del año de radicación, no uno fijo', () => {
    const de2025 = mapCaseToPlaceholders(
      caso(1_000_000, { filingDate: '2025-04-10' }) as never,
    );
    const de2026 = mapCaseToPlaceholders(
      caso(1_000_000, { filingDate: '2026-04-10' }) as never,
    );

    expect(de2025.SMMLV_VALOR).toContain('1.423.500');
    expect(de2026.SMMLV_VALOR).toContain('1.750.905');
    expect(de2025.SMMLV_VALOR).not.toBe(de2026.SMMLV_VALOR);
  });

  it('la casilla de 40 SMMLV coincide con la validación del expediente', () => {
    // El valor EXACTO del umbral queda fuera a propósito: el documento y el
    // validador no comparten el borde. `mapCheckList` marca SI_40 con
    // `totalDebt < 40 × SMMLV` (estricto), mientras `validateMinimaCuantia`
    // exige apoderado con `totalDebt > 40 × SMMLV`, también estricto. En el
    // valor exacto el servidor no exige apoderado y el documento tampoco dice
    // que esté por debajo. Es una diferencia de semántica del borde anterior a
    // este cambio —el texto de la plantilla dice "hasta 40 SMMLV", que sugiere
    // ≤— y unificarla cambiaría lo que afirma una casilla de un documento
    // legal, así que no se toca acá. Lo que este test fija es que fuera del
    // borde los dos lados coincidan, que es lo que antes fallaba.
    for (const year of [2025, 2026]) {
      const umbral = 40 * getSmmlv(year);
      for (const deuda of [umbral - 1, umbral + 1]) {
        const map = mapCaseToPlaceholders(
          caso(deuda, { filingDate: `${year}-05-20` }) as never,
        );
        const documentoDiceQueEstaDebajo = map.SI_40 === 'X';
        expect(documentoDiceQueEstaDebajo).toBe(
          !cortaElServidor(deuda, false, year),
        );
        expect(map.NO_40).toBe(documentoDiceQueEstaDebajo ? '' : 'X');
      }
    }
  });

  it('la banda que antes discrepaba ahora da lo mismo en documento y servidor', () => {
    // $60.000.000 radicados en 2026: con el literal viejo el Check List marcaba
    // NO_40 (por encima de la mínima cuantía, porque 60M > 40 × 1.300.000) y el
    // servidor no exigía apoderado (60M < 40 × 1.750.905).
    const deuda = 60_000_000;
    const map = mapCaseToPlaceholders(
      caso(deuda, { filingDate: '2026-07-01' }) as never,
    );
    expect(map.SI_40).toBe('X');
    expect(map.NO_40).toBe('');
    expect(cortaElServidor(deuda, false, 2026)).toBe(false);
  });

  it('la casilla de 150 SMMLV se mueve con el año', () => {
    const deuda = 150 * getSmmlv(2025) + 1; // supera el tope de 2025, no el de 2026
    expect(deuda).toBeLessThan(150 * getSmmlv(2026));

    const en2025 = mapCaseToPlaceholders(
      caso(deuda, { filingDate: '2025-05-20' }) as never,
    );
    const en2026 = mapCaseToPlaceholders(
      caso(deuda, { filingDate: '2026-05-20' }) as never,
    );

    expect(en2025.SI_MAS_150).toBe('X');
    expect(en2026.SI_MAS_150).toBe('');
    expect(en2026.NO_MAS_150).toBe('X');
  });

  it('sin fecha de radicación usa la de creación del expediente', () => {
    const map = mapCaseToPlaceholders(
      caso(1_000_000, {
        filingDate: null,
        createdDate: new Date('2024-03-03T12:00:00Z'),
      }) as never,
    );
    expect(map.SMMLV_VALOR).toContain('1.300.000');
  });
});

// ---------------------------------------------------------------------------
// 5. Guardia: ningún literal fuera de la fuente
// ---------------------------------------------------------------------------

describe('guardia — ningún literal de SMMLV fuera de la fuente', () => {
  /** La única ruta donde los valores pueden aparecer escritos. */
  const FUENTE = 'src/features/case/validation-rules.ts';

  /**
   * Los tres valores de la tabla, en las formas en que se escriben en código:
   * `1300000`, `1_300_000` y `1.300.000` (esta última, en comentarios o en un
   * texto formateado).
   */
  const VALORES = Object.values(SMMLV_BY_YEAR);

  const formas = (n: number): RegExp[] => {
    const plano = String(n);
    const conGuiones = plano.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
    const conPuntos = plano.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return [plano, conGuiones, conPuntos].map(
      (f) => new RegExp(f.replace(/\./g, '\\.')),
    );
  };

  const archivosTs = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...archivosTs(p));
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };

  it('src/ no contiene ningún valor de SMMLV salvo en la tabla', () => {
    const raiz = path.join(process.cwd(), 'src');
    const fuente = path.join(process.cwd(), FUENTE);

    const infracciones: string[] = [];
    for (const archivo of archivosTs(raiz)) {
      if (archivo === fuente) continue;
      const contenido = sinComentarios(fs.readFileSync(archivo, 'utf-8'));
      for (const valor of VALORES) {
        for (const forma of formas(valor)) {
          if (forma.test(contenido)) {
            infracciones.push(
              `${path.relative(process.cwd(), archivo)} → ${forma.source}`,
            );
          }
        }
      }
    }

    expect(infracciones).toEqual([]);
  });

  it('la fuente sigue exportando la tabla y ya no exporta SMMLV_2025', () => {
    const fuente = sinComentarios(read(FUENTE));
    expect(fuente).toContain('export const SMMLV_BY_YEAR');
    expect(fuente).not.toContain('SMMLV_2025');
  });

  it('las plantillas no traen ningún valor de SMMLV escrito a mano', () => {
    // Las plantillas solo deben nombrar los umbrales ("40 SMMLV"), nunca el
    // monto: si alguna lo escribiera, quedaría congelado en el año en que se
    // editó.
    const plantillas: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.html')) plantillas.push(p);
      }
    };
    walk(path.join(process.cwd(), 'templates'));

    const infracciones: string[] = [];
    for (const archivo of plantillas) {
      const contenido = fs.readFileSync(archivo, 'utf-8');
      for (const valor of VALORES) {
        for (const forma of formas(valor)) {
          if (forma.test(contenido)) {
            infracciones.push(
              `${path.relative(process.cwd(), archivo)} → ${forma.source}`,
            );
          }
        }
      }
    }

    expect(infracciones).toEqual([]);
  });
});
