/**
 * Helpers de formato de los placeholders (src/features/document/placeholders/format.ts).
 *
 * Se movieron desde placeholder-mapper.ts SIN cambiar su código: estos tests
 * CARACTERIZAN lo que hacen hoy —incluidas sus rarezas, marcadas "RAREZA"— para que
 * un cambio futuro sea deliberado. Antes de la extracción no se podían probar de a
 * uno (eran privadas del mapper); solo se veían a través de las ~885 claves.
 *
 * La zona horaria del proceso es UTC (tests/global-setup.js), como en Vercel, y estos
 * helpers convierten explícitamente a America/Bogota (UTC-5).
 */

import { Prisma } from '@prisma/client';

import {
  boolToSiNo,
  formatCurrency,
  formatDate,
  formatDateComplete,
  formatIdNumber,
  formatShortDate,
  getDayInWords,
  getDayNumber,
  getGenderArticle,
  getGenderPrefix,
  getMonthName,
  getYear,
} from '@/features/document/placeholders/format';

// El formato de moneda esperado, sin copiar a mano los espacios invisibles de es-CO.
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

describe('formatCurrency', () => {
  it('null y undefined dan $0', () => {
    expect(formatCurrency(null)).toBe('$0');
    expect(formatCurrency(undefined)).toBe('$0');
  });

  it('REGRESIÓN: un valor PRESENTE pero no numérico (NaN) ya no da $0 en silencio', () => {
    // Ausente (null/undefined, arriba) y presente-pero-roto no son lo mismo:
    // el primero es "no se cargó", el segundo es un dato que falló al
    // parsearse. Antes los dos caían en "$0" -un documento legal podía salir
    // con un monto en cero pesos sin ningún aviso-. Ahora deja el marcador
    // de dato faltante que ya usa el resto del mapper ("____"), para que el
    // gate fail-closed de `canGenerateDocument` lo detenga si el placeholder
    // es crítico.
    expect(formatCurrency('abc' as unknown as number)).toBe('____');
    expect(formatCurrency(NaN)).toBe('____');
  });

  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCurrency(0)).toBe(cop(0));
    expect(formatCurrency(1_234_567)).toBe(cop(1_234_567));
    expect(formatCurrency(-50_000)).toBe(cop(-50_000));
  });

  it('redondea a 0 decimales', () => {
    expect(formatCurrency(1234.4)).toBe(cop(1234));
    expect(formatCurrency(1234.6)).toBe(cop(1235));
  });

  it('acepta un Prisma.Decimal y un string numérico (Number() los convierte)', () => {
    expect(
      formatCurrency(new Prisma.Decimal('180000000') as unknown as number),
    ).toBe(cop(180_000_000));
    expect(formatCurrency('35000000' as unknown as number)).toBe(
      cop(35_000_000),
    );
  });
});

describe('fechas — siempre en la zona horaria de Colombia (UTC-5)', () => {
  const NOON = '2026-03-15T17:00:00Z'; // 12:00 en Bogotá
  const AFTER_MIDNIGHT_UTC = '2026-03-16T03:00:00Z'; // 22:00 del 15 en Bogotá
  const NEW_YEAR_UTC = '2026-01-01T03:00:00Z'; // 22:00 del 31-dic-2025 en Bogotá

  describe('formatDate', () => {
    it('vacío para null, undefined y cadena vacía', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('día de dos dígitos, mes en letras y año', () => {
      expect(formatDate(NOON)).toBe('15 de marzo de 2026');
      expect(formatDate('2026-05-01T15:00:00Z')).toBe('01 de mayo de 2026');
    });

    it('usa el día de Colombia, no el de UTC', () => {
      expect(formatDate(AFTER_MIDNIGHT_UTC)).toBe('15 de marzo de 2026');
    });

    it('acepta un Date', () => {
      expect(formatDate(new Date(NOON))).toBe('15 de marzo de 2026');
    });
  });

  describe('formatShortDate', () => {
    it('vacío para null y undefined', () => {
      expect(formatShortDate(null)).toBe('');
      expect(formatShortDate(undefined)).toBe('');
    });

    it('DD/MM/AAAA', () => {
      expect(formatShortDate(NOON)).toBe('15/03/2026');
      expect(formatShortDate(AFTER_MIDNIGHT_UTC)).toBe('15/03/2026');
    });

    it('"DESCONOZCO" (dato que el asistente permite) sale como "Desconoce"', () => {
      expect(formatShortDate('DESCONOZCO')).toBe('Desconoce');
    });

    it('una fecha inválida da vacío', () => {
      expect(formatShortDate('no es una fecha')).toBe('');
    });
  });

  describe('getDayNumber', () => {
    it('sin cero a la izquierda', () => {
      expect(getDayNumber('2026-03-05T17:00:00Z')).toBe('5');
      expect(getDayNumber(NOON)).toBe('15');
    });

    it('usa el día de Colombia', () => {
      expect(getDayNumber(AFTER_MIDNIGHT_UTC)).toBe('15');
    });

    it('vacío para null', () => {
      expect(getDayNumber(null)).toBe('');
    });
  });

  describe('getDayInWords', () => {
    const WORDS = [
      'uno',
      'dos',
      'tres',
      'cuatro',
      'cinco',
      'seis',
      'siete',
      'ocho',
      'nueve',
      'diez',
      'once',
      'doce',
      'trece',
      'catorce',
      'quince',
      'dieciseis',
      'diecisiete',
      'dieciocho',
      'diecinueve',
      'veinte',
      'veintiuno',
      'veintidos',
      'veintitres',
      'veinticuatro',
      'veinticinco',
      'veintiseis',
      'veintisiete',
      'veintiocho',
      'veintinueve',
      'treinta',
      'treinta y uno',
    ];

    it.each(WORDS.map((w, i) => [i + 1, w] as const))(
      'el día %i es "%s"',
      (day, word) => {
        const iso = `2026-01-${String(day).padStart(2, '0')}T17:00:00Z`;
        expect(getDayInWords(iso)).toBe(word);
      },
    );

    it('RAREZA: sin tildes ("dieciseis", "veintidos", "veintitres", "veintiseis")', () => {
      expect(getDayInWords('2026-01-16T17:00:00Z')).toBe('dieciseis');
      expect(getDayInWords('2026-01-22T17:00:00Z')).toBe('veintidos');
    });

    it('vacío para null', () => {
      expect(getDayInWords(null)).toBe('');
    });
  });

  describe('getMonthName', () => {
    const MONTHS = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    it.each(MONTHS.map((m, i) => [i + 1, m] as const))(
      'el mes %i es "%s"',
      (month, name) => {
        const iso = `2026-${String(month).padStart(2, '0')}-15T17:00:00Z`;
        expect(getMonthName(iso)).toBe(name);
      },
    );

    it('vacío para null', () => {
      expect(getMonthName(null)).toBe('');
    });
  });

  describe('getYear', () => {
    it('devuelve el año de Colombia', () => {
      expect(getYear(NOON)).toBe('2026');
      expect(getYear('2025-12-31T23:00:00Z')).toBe('2025');
    });

    it('en la madrugada UTC de año nuevo todavía es el año anterior en Colombia', () => {
      expect(getYear(NEW_YEAR_UTC)).toBe('2025');
    });

    it('vacío para null', () => {
      expect(getYear(null)).toBe('');
    });
  });

  describe('formatDateComplete', () => {
    it('"D de mes de AAAA" con el día sin cero a la izquierda', () => {
      expect(formatDateComplete(NOON)).toBe('15 de marzo de 2026');
      expect(formatDateComplete('2026-05-01T15:00:00Z')).toBe(
        '1 de mayo de 2026',
      );
    });

    it('vacío para null', () => {
      expect(formatDateComplete(null)).toBe('');
    });
  });
});

describe('boolToSiNo', () => {
  it('SI solo para true; NO para false, null y undefined', () => {
    expect(boolToSiNo(true)).toBe('SI');
    expect(boolToSiNo(false)).toBe('NO');
    expect(boolToSiNo(null)).toBe('NO');
    expect(boolToSiNo(undefined)).toBe('NO');
  });
});

describe('getGenderPrefix (heurística por terminación del NOMBRE COMPLETO)', () => {
  // Alimenta {{GENERO_DEUDOR}}: 39 usos en 10 plantillas ("…a cargo de {{GENERO_DEUDOR}}…").
  it.each(['Ana', 'María', 'Andrea', 'Julieta'])(
    'un nombre suelto que termina en "a" (%s) → La señora',
    (name) => {
      expect(getGenderPrefix(name)).toBe('La señora');
    },
  );

  it('un nombre suelto que no termina en "a" → El señor', () => {
    expect(getGenderPrefix('Carlos')).toBe('El señor');
    expect(getGenderPrefix('Juan')).toBe('El señor');
  });

  it('RAREZA: se mira el FINAL del nombre completo, es decir el apellido, no el nombre de pila', () => {
    // Una mujer con apellido que no termina en "a" sale como señor...
    expect(getGenderPrefix('Ana María Torres Ruiz')).toBe('El señor');
    expect(getGenderPrefix('María Fernanda Torres Gil')).toBe('El señor');
    // ...y un hombre con apellido que termina en "a" sale como señora.
    expect(getGenderPrefix('Carlos Andrés Rojas Peña')).toBe('La señora');
    expect(getGenderPrefix('Carlos Mejía')).toBe('La señora');
    // Solo acierta cuando el apellido "coincide" con el género.
    expect(getGenderPrefix('Carlos Andrés Rojas Pérez')).toBe('El señor');
    expect(getGenderPrefix('Ana Torres Correa')).toBe('La señora');
  });

  it('ignora mayúsculas y espacios de los extremos', () => {
    expect(getGenderPrefix('  ANA  ')).toBe('La señora');
    expect(getGenderPrefix('  CARLOS  ')).toBe('El señor');
  });

  it('un nombre masculino que termina en "a" sale femenino (heurística)', () => {
    expect(getGenderPrefix('Joshua')).toBe('La señora');
  });
});

describe('getGenderArticle (heurística por terminación del PRIMER nombre)', () => {
  it('vacío o sin nombre da "el"', () => {
    expect(getGenderArticle('')).toBe('el');
    expect(getGenderArticle(undefined as unknown as string)).toBe('el');
  });

  it('mira el primer nombre', () => {
    expect(getGenderArticle('Ana María Torres Ruiz')).toBe('la');
    expect(getGenderArticle('Carlos Andrés Rojas Peña')).toBe('el');
    expect(getGenderArticle('Susana Gómez')).toBe('la');
    expect(getGenderArticle('Marta Pérez')).toBe('la');
  });

  it('las excepciones masculinas conocidas dan "el"', () => {
    expect(getGenderArticle('Joshua Torres')).toBe('el');
    expect(getGenderArticle('Borja Sanz')).toBe('el');
  });

  it('RAREZA: una excepción con tilde ("García") no coincide con la lista y sale "la"', () => {
    expect(getGenderArticle('García Márquez')).toBe('la');
    expect(getGenderArticle('Garcia Márquez')).toBe('el');
  });

  it('un nombre que no termina en las terminaciones femeninas da "el"', () => {
    expect(getGenderArticle('Juan Pablo')).toBe('el');
    expect(getGenderArticle('Jesús')).toBe('el');
  });
});

describe('formatIdNumber', () => {
  it('vacío da vacío', () => {
    expect(formatIdNumber('')).toBe('');
    expect(formatIdNumber(undefined as unknown as string)).toBe('');
  });

  it('separa los miles con puntos', () => {
    expect(formatIdNumber('52123456')).toBe('52.123.456');
    expect(formatIdNumber('1023456789')).toBe('1.023.456.789');
    expect(formatIdNumber('123')).toBe('123');
  });

  it('limpia lo que no sea dígito antes de formatear', () => {
    expect(formatIdNumber('CC 79.654.321')).toBe('79.654.321');
    expect(formatIdNumber('79 654 321')).toBe('79.654.321');
  });
});
