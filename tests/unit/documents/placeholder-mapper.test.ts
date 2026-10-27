/**
 * Unit Tests: Document Placeholder Mapper (src/features/document/placeholder-mapper.ts)
 * Tests currency formatting, date formatting, Decimal conversion safety.
 * Critical: validates the Prisma Decimal → Number() conversion fix.
 */

// We test the helper functions by importing the module
// Since helpers are not exported, we test through mapCaseToPlaceholders
// or re-implement the testable logic here.

describe('Placeholder Mapper — Helper Functions', () => {
  describe('formatCurrency (tested via behavior)', () => {
    // Replicate the formatCurrency function for direct testing
    function formatCurrency(value: number | null | undefined): string {
      if (value === null || value === undefined) return '$0';
      const num = Number(value);
      if (isNaN(num)) return '$0';
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    }

    it('should format a regular number as COP currency', () => {
      const result = formatCurrency(3000000);
      // Colombian format uses $ sign and thousands separator
      expect(result).toContain('3');
      expect(result).toContain('000');
      expect(result).toContain('000');
    });

    it('should return $0 for null', () => {
      expect(formatCurrency(null)).toBe('$0');
    });

    it('should return $0 for undefined', () => {
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('should return $0 for NaN', () => {
      expect(formatCurrency(NaN)).toBe('$0');
    });

    it('should handle Prisma Decimal objects (string valueOf)', () => {
      // Prisma Decimal has valueOf() that returns string
      const decimalLike = { valueOf: () => '25000000' } as unknown as number;
      const result = formatCurrency(decimalLike);
      expect(result).toContain('25');
    });

    it('should handle zero correctly', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-1500000);
      expect(result).toContain('1');
      expect(result).toContain('500');
    });
  });

  describe('Decimal reduce safety', () => {
    // This tests the critical fix: Prisma Decimal objects used in reduce()
    // would cause string concatenation instead of numeric addition.

    it('should sum numeric values correctly with Number() wrapping', () => {
      const debts = [
        { amount: 10000000 },
        { amount: 20000000 },
        { amount: 15000000 },
      ];

      const total = debts.reduce((sum, d) => sum + Number(d.amount), 0);
      expect(total).toBe(45000000);
      expect(typeof total).toBe('number');
    });

    it('should handle Prisma Decimal-like objects in reduce', () => {
      // Simulate Prisma Decimal: valueOf() returns string
      const createDecimal = (val: number) => ({
        valueOf: () => String(val),
        toString: () => String(val),
      });

      const debts = [
        { amount: createDecimal(10000000) },
        { amount: createDecimal(20000000) },
        { amount: createDecimal(15000000) },
      ];

      // WITHOUT Number() — this would produce "010000002000000015000000"
      const brokenTotal = debts.reduce(
        (sum, d) => sum + (d.amount as unknown as number),
        0,
      );
      // This assertion shows the bug
      expect(typeof brokenTotal).toBe('string'); // BUG: string concatenation

      // WITH Number() — correct behavior
      const fixedTotal = debts.reduce((sum, d) => sum + Number(d.amount), 0);
      expect(fixedTotal).toBe(45000000);
      expect(typeof fixedTotal).toBe('number');
    });

    it('should handle null/undefined Decimal values safely', () => {
      const values = [null, undefined, 0, 5000000];

      const total = values.reduce((sum, v) => {
        const num = v != null ? Number(v) || 0 : 0;
        return sum + num;
      }, 0);

      expect(total).toBe(5000000);
    });
  });

  describe('Date formatting helpers', () => {
    function formatDate(date: Date | string | null | undefined): string {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }

    function formatShortDate(date: Date | string | null | undefined): string {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    function getDayNumber(date: Date | string | null | undefined): string {
      if (!date) return '';
      return new Date(date).getDate().toString();
    }

    function getMonthName(date: Date | string | null | undefined): string {
      if (!date) return '';
      return new Date(date).toLocaleDateString('es-CO', { month: 'long' });
    }

    function getYear(date: Date | string | null | undefined): string {
      if (!date) return '';
      return new Date(date).getFullYear().toString();
    }

    it('should return empty string for null date', () => {
      expect(formatDate(null)).toBe('');
      expect(formatShortDate(null)).toBe('');
      expect(getDayNumber(null)).toBe('');
    });

    it('should return empty string for undefined date', () => {
      expect(formatDate(undefined)).toBe('');
      expect(getMonthName(undefined)).toBe('');
      expect(getYear(undefined)).toBe('');
    });

    it('should format Date object correctly', () => {
      // Use explicit time to avoid timezone offset issues
      const date = new Date('2025-06-15T12:00:00Z');
      const result = formatDate(date);
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should format string date correctly', () => {
      const result = formatDate('2025-06-15');
      expect(result).toContain('2025');
    });

    it('should extract day number', () => {
      // Use explicit time to avoid timezone offset issues
      expect(getDayNumber('2025-06-15T12:00:00Z')).toBe('15');
    });

    it('should extract year', () => {
      expect(getYear('2025-06-15')).toBe('2025');
    });
  });

  describe('Boolean to SI/NO conversion', () => {
    function boolToSiNo(value: boolean | null | undefined): string {
      return value ? 'SI' : 'NO';
    }

    it('should return SI for true', () => {
      expect(boolToSiNo(true)).toBe('SI');
    });

    it('should return NO for false', () => {
      expect(boolToSiNo(false)).toBe('NO');
    });

    it('should return NO for null', () => {
      expect(boolToSiNo(null)).toBe('NO');
    });

    it('should return NO for undefined', () => {
      expect(boolToSiNo(undefined)).toBe('NO');
    });
  });

  describe('toNum helper (Decimal conversion)', () => {
    // Replicates the toNum helper from actions.ts
    const toNum = (v: unknown): number | null =>
      v != null ? Number(v) || 0 : null;

    it('should convert number to number', () => {
      expect(toNum(3000000)).toBe(3000000);
    });

    it('should convert string number to number', () => {
      expect(toNum('3000000')).toBe(3000000);
    });

    it('should convert Prisma Decimal-like to number', () => {
      const decimal = { valueOf: () => '5000000' };
      expect(toNum(decimal)).toBe(5000000);
    });

    it('should return null for null', () => {
      expect(toNum(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(toNum(undefined)).toBeNull();
    });

    it('should return 0 for NaN-producing values', () => {
      expect(toNum('not-a-number')).toBe(0);
    });

    it('should handle zero correctly', () => {
      expect(toNum(0)).toBe(0);
    });
  });
});

describe('Placeholder Mapper — HTML escaping (P2)', () => {
  // Real imports: escaping happens inside mapCaseToPlaceholders (merge point)
  // and inside the HTML builders, so we test through the exported functions.
  const {
    mapCaseToPlaceholders,
    buildConciliationContext,
  } = require('@/features/document/placeholder-mapper');

  const makeCase = (overrides: Record<string, unknown> = {}) =>
    ({
      type: 'INSOLVENCY',
      caseNumber: 'INS-2026-001',
      debtor: {
        name: 'Juan <script>alert(1)</script> Pérez',
        idNumber: '123456789',
        address: 'Calle 5 & Carrera "10"',
        city: 'Bogotá',
        email: 'juan@example.com',
        phone: '3000000000',
        occupation: 'Ingeniero',
      },
      debts: [
        {
          amount: 1000000,
          capitalAmount: 1000000,
          creditor: { name: 'Banco <b>Evil</b> & Cía' },
        },
      ],
      assets: [],
      documents: [
        { name: '<img src=x onerror=alert(1)>.pdf', isGenerated: false },
      ],
      legalProcesses: [],
      libranzas: [],
      suspendedServices: [],
      dependents: [],
      causes: [],
      applicantScope: [],
      operator: null,
      ...overrides,
    }) as never;

  it('escapes scalar placeholders (user data) automatically', () => {
    const placeholders = mapCaseToPlaceholders(makeCase());
    expect(placeholders.NOMBRE_DEUDOR).toContain('&lt;script&gt;');
    expect(placeholders.NOMBRE_DEUDOR).not.toContain('<script>');
    expect(placeholders.DIRECCION_DEUDOR).toContain('&amp;');
    expect(placeholders.DIRECCION_DEUDOR).toContain('&quot;10&quot;');
  });

  it('keeps system-built HTML intact but escapes user data inside it', () => {
    const placeholders = mapCaseToPlaceholders(makeCase());
    // Table markup survives (allowlisted key)
    expect(placeholders.CUADRO_CALIFICACION_GRADUACION).toContain('<table');
    // ...but the creditor name interpolated into it is escaped
    expect(placeholders.CUADRO_CALIFICACION_GRADUACION).toContain(
      '&lt;b&gt;Evil&lt;/b&gt;',
    );
    expect(placeholders.CUADRO_CALIFICACION_GRADUACION).not.toContain(
      '<b>Evil</b>',
    );
    expect(placeholders.LISTA_ACREEDORES).toContain('&lt;b&gt;');
  });

  it('escapes uploaded document names in LISTA_ANEXOS but keeps <li> markup', () => {
    const placeholders = mapCaseToPlaceholders(makeCase());
    expect(placeholders.LISTA_ANEXOS).toContain('<li>');
    expect(placeholders.LISTA_ANEXOS).toContain('&lt;img');
    expect(placeholders.LISTA_ANEXOS).not.toContain('<img');
  });

  it('does not alter safe values (manual fills, SI/NO flags, currency)', () => {
    const placeholders = mapCaseToPlaceholders(makeCase());
    expect(placeholders.DIA_ACUERDO).toBe('____');
    expect(placeholders.TIENE_ACREEDORES).toBe('SI');
    expect(placeholders.GASTOS_MENSUALES).toContain('$');
  });

  it('handles unicode intact (tildes, ñ, emoji) — only HTML specials change', () => {
    const placeholders = mapCaseToPlaceholders(
      makeCase({
        debtor: {
          name: 'José Ñúñez Müller 日本 🚀',
          idNumber: '123',
          address: 'Cra 7 № 45–12',
          city: 'Bogotá',
          email: 'j@x.co',
          phone: '300',
          occupation: 'Ingeniería & Diseño',
        },
      }),
    );
    expect(placeholders.NOMBRE_DEUDOR).toBe('José Ñúñez Müller 日本 🚀');
    expect(placeholders.DIRECCION_DEUDOR).toBe('Cra 7 № 45–12');
  });

  it('handles null/undefined debtor fields without crashing', () => {
    const placeholders = mapCaseToPlaceholders(
      makeCase({
        debtor: {
          name: 'Juan',
          idNumber: null,
          address: undefined,
          city: null,
          email: null,
          phone: undefined,
          occupation: null,
        },
      }),
    );
    // null/undefined → string vacío o 'null'-free, nunca crash
    expect(typeof placeholders.CEDULA_DEUDOR).toBe('string');
    expect(typeof placeholders.DIRECCION_DEUDOR).toBe('string');
  });

  it('benchmark: el costo de mapear crece linealmente con deudas y bienes', () => {
    const casoCon = (deudas: number, bienes: number) =>
      makeCase({
        debts: Array.from({ length: deudas }, (_, i) => ({
          amount: 1000000 + i,
          capitalAmount: 1000000 + i,
          interestAmount: 5000,
          creditorClass: 'Quirografario',
          creditor: { name: `Acreedor & Cía ${i}` },
        })),
        assets: Array.from({ length: bienes }, (_, i) => ({
          type: 'VEHICULO',
          name: `Bien <${i}>`,
          description: `Descripción ${i}`,
          value: 5000000,
        })),
        paymentTermMonths: 60,
        monthlyPaymentAmount: 2000000,
      });
    const chico = casoCon(10, 5);
    const grande = casoCon(100, 50);

    // Antes era una sola medición en frío contra un límite absoluto de 100 ms,
    // y fallaba en la corrida completa de jest sin que el mapper cambiara (136
    // ms; 121 ms aun tomando el mínimo de 5 corridas calientes): el tiempo
    // absoluto depende de la máquina y de cuántos workers corren a la vez.
    //
    // Lo que el test quiere atrapar es una regresión de complejidad (un O(n²)
    // sobre deudas o bienes), y eso se ve en una RAZÓN, no en milisegundos:
    // con 10× más deudas y bienes, un costo lineal multiplica el tiempo por
    // 10 como MÁXIMO (la parte fija solo baja la razón; hoy da ~2,1), así que
    // pasar de 10 ya es superlineal. Un O(n²) con la parte fija actual daría
    // ~13, por eso el umbral no puede ser más holgado.
    // Los dos casos se miden intercalados en el mismo proceso, así que la
    // carga de la máquina afecta a ambos por igual; de cada uno se toma el
    // MÍNIMO de 7 corridas tras calentar, porque el ruido solo suma tiempo.
    const placeholders = mapCaseToPlaceholders(grande); // calentamiento
    mapCaseToPlaceholders(chico);
    const medir = (caso: ReturnType<typeof casoCon>) => {
      const start = performance.now();
      mapCaseToPlaceholders(caso);
      return performance.now() - start;
    };
    const tiemposChico: number[] = [];
    const tiemposGrande: number[] = [];
    for (let i = 0; i < 7; i++) {
      tiemposChico.push(medir(chico));
      tiemposGrande.push(medir(grande));
    }
    const razon = Math.min(...tiemposGrande) / Math.min(...tiemposChico);

    expect(Object.keys(placeholders).length).toBeGreaterThan(300);
    expect(razon).toBeLessThan(10);
  });

  it('escapes string values inside buildConciliationContext each-items', () => {
    const ctx = buildConciliationContext(
      makeCase({
        type: 'CONCILIATION',
        concClausulasAcuerdo: [
          {
            NUMERO_CLAUSULA: 'PRIMERA',
            TEXTO_CLAUSULA: 'Pagar <script>alert(1)</script> a tiempo',
          },
        ],
      }),
    );
    const clausulas = ctx.CLAUSULAS_ACUERDO as Array<Record<string, string>>;
    expect(clausulas[0].TEXTO_CLAUSULA).toContain('&lt;script&gt;');
    expect(clausulas[0].TEXTO_CLAUSULA).not.toContain('<script>');
    // Flags remain booleans
    expect(typeof ctx.HAS_CLAUSULAS_NUMERADAS).toBe('boolean');
    expect(ctx.HAS_CLAUSULAS_NUMERADAS).toBe(true);
  });
});

describe('Placeholder Mapper — apoderados desde la lista nueva (Sección XI)', () => {
  // Cambia SI/NO_APODERADO y SI/NO_DOC_PODER en Check List, Sentido Del Voto y
  // Tramite Audiencia: el mapper ya leía `caseData.apoderados`; lo que faltaba
  // era que el `include` de la generación trajera la relación.
  const {
    mapCaseToPlaceholders,
  } = require('@/features/document/placeholder-mapper');

  const makeCase = (overrides: Record<string, unknown> = {}) =>
    ({
      type: 'INSOLVENCY',
      caseNumber: 'INS-2026-010',
      debtor: {
        name: 'Ana Torres',
        idNumber: '987654321',
        address: 'Calle 8 # 3-20',
        city: 'Medellín',
        email: 'ana@example.com',
        phone: '3001112222',
        occupation: 'Comerciante',
      },
      debts: [],
      assets: [],
      documents: [],
      legalProcesses: [],
      libranzas: [],
      suspendedServices: [],
      dependents: [],
      causes: [],
      applicantScope: [],
      operator: null,
      ...overrides,
    }) as never;

  const apoderado = { id: 'a1', orden: 0, nombreCompleto: 'Ana Torres' };

  it('sin apoderado de ningún tipo: marca NO_APODERADO y no exige poder', () => {
    const p = mapCaseToPlaceholders(makeCase());
    expect(p.SI_APODERADO).not.toBe('X');
    expect(p.NO_APODERADO).toBe('X');
    expect(p.SI_DOC_PODER).not.toBe('X');
    expect(p.NO_DOC_PODER).not.toBe('X');
  });

  it('con apoderados solo en la lista nueva: marca SI_APODERADO y el poder', () => {
    const p = mapCaseToPlaceholders(makeCase({ apoderados: [apoderado] }));
    expect(p.SI_APODERADO).toBe('X');
    expect(p.NO_APODERADO).not.toBe('X');
    expect(p.NO_DOC_PODER).toBe('X');
  });

  it('con apoderado solo en las columnas escalares (caso anterior): sigue igual', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ apoderadoNombreCompleto: 'Dr. Legado' }),
    );
    expect(p.SI_APODERADO).toBe('X');
    expect(p.NO_APODERADO).not.toBe('X');
  });

  it('una lista vacía equivale a no tener apoderado', () => {
    const p = mapCaseToPlaceholders(makeCase({ apoderados: [] }));
    expect(p.SI_APODERADO).not.toBe('X');
    expect(p.NO_APODERADO).toBe('X');
  });
});

describe('Placeholder Mapper — fecha de desistimiento (Fase 2 paso 2.2)', () => {
  const {
    mapCaseToPlaceholders,
  } = require('@/features/document/placeholder-mapper');

  const makeCase = (overrides: Record<string, unknown> = {}) =>
    ({
      type: 'INSOLVENCY',
      caseNumber: 'INS-2026-002',
      debtor: {
        name: 'Ana Torres',
        idNumber: '987654321',
        address: 'Calle 8 # 3-20',
        city: 'Medellín',
        email: 'ana@example.com',
        phone: '3001112222',
        occupation: 'Comerciante',
      },
      debts: [],
      assets: [],
      documents: [],
      legalProcesses: [],
      libranzas: [],
      suspendedServices: [],
      dependents: [],
      causes: [],
      applicantScope: [],
      operator: null,
      resultDate: null,
      ...overrides,
    }) as never;

  it('antes del fix quedaban en blanco — ya no: usa resultDate cuando existe', () => {
    const placeholders = mapCaseToPlaceholders(
      makeCase({ resultDate: new Date('2026-03-15T12:00:00Z') }),
    );
    expect(placeholders.DIA_DESISTIMIENTO).toBe('15');
    expect(placeholders.MES_DESISTIMIENTO).toBe('marzo');
    expect(placeholders.ANO_DESISTIMIENTO).toBe('2026');
  });

  it('cae a la fecha de hoy si resultDate todavía no se registró', () => {
    const placeholders = mapCaseToPlaceholders(makeCase({ resultDate: null }));
    expect(placeholders.DIA_DESISTIMIENTO).not.toBe('');
    expect(placeholders.MES_DESISTIMIENTO).not.toBe('');
    expect(placeholders.ANO_DESISTIMIENTO).not.toBe('');
  });

  it('no toca DIA_FRACASO/MES_FRACASO — fuera de alcance de este paso', () => {
    // Siguen "Manual": el merge final los rellena con guiones bajos (línea en
    // blanco para completar a mano), igual que DIA_ACUERDO. Mismo bug de
    // fondo que el de Desistimiento, pero no forma parte de este paso.
    const placeholders = mapCaseToPlaceholders(makeCase());
    expect(placeholders.DIA_FRACASO).toMatch(/^_+$/);
    expect(placeholders.MES_FRACASO).toMatch(/^_+$/);
  });
});
