/**
 * Único lugar donde se decide qué es un éxito, un fallo y un omitido al
 * generar documentos, y cómo se dice. Ver el encabezado del módulo.
 */

import {
  avisoDeGeneracion,
  estadoDeGeneracion,
  resumirGeneracion,
  tituloDeGeneracion,
  type ResultadoDeDocumento,
} from '@/features/document/resumen-generacion';

const ok = (n: string): ResultadoDeDocumento => ({
  status: 'success',
  templateName: n,
});
const err = (n: string, error = 'ENOENT'): ResultadoDeDocumento => ({
  status: 'error',
  templateName: n,
  error,
});
const omitido = (n: string): ResultadoDeDocumento => ({
  status: 'skipped',
  templateName: n,
  error: 'Falta la fecha de radicación',
});

describe('estadoDeGeneracion', () => {
  it.each([
    [{ total: 8, generados: 8, fallidos: 0, omitidos: 0 }, 'completa'],
    [{ total: 8, generados: 3, fallidos: 5, omitidos: 0 }, 'parcial'],
    [{ total: 8, generados: 7, fallidos: 0, omitidos: 1 }, 'parcial'],
    [{ total: 8, generados: 0, fallidos: 8, omitidos: 0 }, 'fallida'],
    [{ total: 2, generados: 0, fallidos: 0, omitidos: 2 }, 'fallida'],
  ] as const)('%o → %s', (conteo, esperado) => {
    expect(estadoDeGeneracion(conteo)).toBe(esperado);
  });
});

describe('tituloDeGeneracion', () => {
  it('"Completada" solo cuando se generó todo', () => {
    expect(tituloDeGeneracion('completa')).toBe('Generación Completada');
    expect(tituloDeGeneracion('parcial')).not.toMatch(/Completada/);
    expect(tituloDeGeneracion('fallida')).not.toMatch(/Completada/);
  });
});

describe('resumirGeneracion', () => {
  it('cuenta cada estado por separado y conserva los motivos', () => {
    const r = resumirGeneracion([
      ok('A'),
      err('B', 'La plantilla "B" no está disponible'),
      omitido('C'),
      { ...ok('D'), displayName: 'D — Juzgado 1' },
    ]);

    expect(r).toMatchObject({
      total: 4,
      generados: 2,
      fallidos: 1,
      omitidos: 1,
      estado: 'parcial',
    });
    expect(r.problemas).toEqual([
      {
        nombre: 'B',
        motivo: 'La plantilla "B" no está disponible',
        omitido: false,
      },
      { nombre: 'C', motivo: 'Falta la fecha de radicación', omitido: true },
    ]);
  });

  it('usa el nombre de la variante cuando lo hay', () => {
    const r = resumirGeneracion([
      { ...err('Oficio'), displayName: 'Oficio — Juzgado 2' },
    ]);
    expect(r.problemas[0].nombre).toBe('Oficio — Juzgado 2');
  });
});

describe('avisoDeGeneracion', () => {
  it('todo generado: éxito, sin descripción', () => {
    expect(
      avisoDeGeneracion(resumirGeneracion([ok('A'), ok('B')]), 'documentos'),
    ).toEqual({ tipo: 'success', titulo: 'Se generaron 2 documentos' });
  });

  it('0 de 8: error, nunca éxito', () => {
    const aviso = avisoDeGeneracion(
      resumirGeneracion(Array.from({ length: 8 }, (_, i) => err(`P${i}`))),
      'documentos',
    );
    expect(aviso.tipo).toBe('error');
    expect(aviso.titulo).toBe('No se generó ningún documento (8 documentos)');
    expect(aviso.descripcion).toContain('8 con error');
    expect(aviso.descripcion).toContain('• P0: ENOENT');
    expect(aviso.descripcion).toContain('…y 5 más.');
  });

  it('parcial: warning que separa errores de datos incompletos', () => {
    const aviso = avisoDeGeneracion(
      resumirGeneracion([ok('A'), err('B'), omitido('C')]),
      'documentos de admisión',
    );
    expect(aviso.tipo).toBe('warning');
    expect(aviso.titulo).toBe('Se generaron 1 de 3 documentos de admisión');
    expect(aviso.descripcion).toContain(
      'No generados: 1 con error, 1 por datos incompletos.',
    );
  });

  it('sin documentos que generar: warning, no éxito', () => {
    expect(avisoDeGeneracion(resumirGeneracion([]), 'documentos').tipo).toBe(
      'warning',
    );
  });
});
