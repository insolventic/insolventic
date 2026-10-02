/**
 * Tres placeholders que leían la fuente equivocada o ninguna fuente,
 * hallazgo de la auditoría transversal formulario -> plantillas (2026-10-02).
 * El golden master (mapper-golden.test.ts) ya confirma el cambio de render
 * para CONYUGE_* y NOMBRE_ABOGADO/CEDULA_ABOGADO/TARJETA_PROFESIONAL (12
 * plantillas × escenario cambiaron de hash). Este archivo fija el mecanismo
 * aislado de cada uno, campo por campo, y cubre PROCESO_n_TIPO, que el
 * golden master NO alcanza a ejercitar (el fixture compartido usa
 * `processType: 'Ejecutivo singular'`, un string legado que no matchea
 * ningún código real y por eso cae en el mismo fallback antes y después).
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { mapLegalProcesses } from '@/features/document/placeholders/case-lists';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

const build = (name: string) => SCENARIOS[name].build() as never;

describe('CONYUGE_* — lee conyuge* (Sección II, UI viva), no spouse* (huérfano)', () => {
  it('con conyugeNombreCompleto y sin spouseName, igual se llena', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      conyugeNombreCompleto: 'Laura Gómez',
      conyugeIdentificacion: '1020304050',
      conyugeTelefono: '3001112233',
      conyugeCorreo: 'laura@example.com',
      spouseName: null,
      spouseIdNumber: null,
      spousePhone: null,
      spouseEmail: null,
    } as never);

    expect(p.CONYUGE_NOMBRE).toBe('Laura Gómez');
    expect(p.CONYUGE_CC).toBe('1020304050');
    expect(p.CONYUGE_TELEFONO).toBe('3001112233');
    expect(p.CONYUGE_EMAIL).toBe('laura@example.com');
  });

  it('sin conyuge*, cae al spouse* legado (casos viejos)', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      conyugeNombreCompleto: null,
      conyugeIdentificacion: null,
      conyugeTelefono: null,
      conyugeCorreo: null,
      spouseName: 'Nombre Legado',
      spouseIdNumber: '999',
      spousePhone: '300',
      spouseEmail: 'legado@example.com',
    } as never);

    expect(p.CONYUGE_NOMBRE).toBe('Nombre Legado');
    expect(p.CONYUGE_CC).toBe('999');
  });

  it('conyuge* gana sobre spouse* cuando los dos existen', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      conyugeNombreCompleto: 'El que debe ganar',
      spouseName: 'El que debe perder',
    } as never);

    expect(p.CONYUGE_NOMBRE).toBe('El que debe ganar');
  });

  it('SI_CONYUGAL/NO_CONYUGAL también miran conyugeNombreCompleto primero', () => {
    const conConyuge = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      conyugeNombreCompleto: 'Laura Gómez',
      spouseName: null,
    } as never);
    expect(conConyuge.SI_CONYUGAL).toBe('X');
    expect(conConyuge.NO_CONYUGAL).toBe('');

    const sinConyuge = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      conyugeNombreCompleto: null,
      spouseName: null,
    } as never);
    expect(sinConyuge.SI_CONYUGAL).toBe('');
    expect(sinConyuge.NO_CONYUGAL).toBe('X');
  });
});

describe('NOMBRE_ABOGADO / CEDULA_ABOGADO / TARJETA_PROFESIONAL — leen Apoderado[], no quedan vacíos', () => {
  it('con un apoderado en la tabla nueva, los tres se llenan', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      apoderados: [
        {
          id: 'apo-1',
          orden: 0,
          nombreCompleto: 'Dr. Pérez',
          tipoIdentificacion: 'CC',
          identificacion: '12345',
          tarjetaProfesional: 'TP-999',
          direccion: null,
          telefono: null,
          correo: null,
          existePoderOtorgado: true,
        },
      ],
    } as never);

    expect(p.NOMBRE_ABOGADO).toBe('Dr. Pérez');
    expect(p.CEDULA_ABOGADO).toBe('12345');
    expect(p.TARJETA_PROFESIONAL).toBe('TP-999');
  });

  it('sin apoderados en la tabla, cae al espejo legado apoderado_*', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      apoderados: [],
      apoderadoNombreCompleto: 'Dra. Legado',
      apoderadoIdentificacion: '54321',
      apoderadoTarjetaProfesional: 'TP-111',
    } as never);

    expect(p.NOMBRE_ABOGADO).toBe('Dra. Legado');
    expect(p.CEDULA_ABOGADO).toBe('54321');
    expect(p.TARJETA_PROFESIONAL).toBe('TP-111');
  });

  it('sin ningún dato, quedan vacíos (no "undefined")', () => {
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      apoderados: [],
      apoderadoNombreCompleto: null,
      apoderadoIdentificacion: null,
      apoderadoTarjetaProfesional: null,
    } as never);

    expect(p.NOMBRE_ABOGADO).toBe('');
    expect(p.CEDULA_ABOGADO).toBe('');
    expect(p.TARJETA_PROFESIONAL).toBe('');
  });

  it('attorney (texto libre) nunca alimenta estos 3 placeholders', () => {
    // No tiene cédula ni tarjeta propias: usarlo para NOMBRE_ABOGADO solo
    // dejaría los otros dos vacíos de forma inconsistente. No se usa en
    // ninguno de los tres.
    const p = mapCaseToPlaceholders({
      ...build('insolvencia-minima'),
      attorney: 'Nombre en el campo libre Apoderado',
      apoderados: [],
      apoderadoNombreCompleto: null,
    } as never);

    expect(p.NOMBRE_ABOGADO).not.toBe('Nombre en el campo libre Apoderado');
    expect(p.NOMBRE_ABOGADO).toBe('');
  });
});

describe('PROCESO_n_TIPO — usa tipoProcesoLabel, no el código crudo', () => {
  const proceso = (overrides: Record<string, unknown> = {}) => [
    {
      id: 'lp-1',
      processType: 'RESTITUCION_INMUEBLE',
      processTypeOther: null,
      plaintiff: 'Arrendador S.A.',
      court: 'Juzgado 3 Civil Municipal',
      courtEmail: null,
      fileNumber: '2024-00999-00',
      precautionaryMeasure: null,
      ...overrides,
    },
  ];

  it('un código reconocido muestra su etiqueta legible, no el código', () => {
    const result = mapLegalProcesses(proceso() as never);
    expect(result.PROCESO_1_TIPO).toBe('Restitución de inmueble');
  });

  it('"OTROS" con texto libre muestra el texto, no literalmente "OTROS"', () => {
    const result = mapLegalProcesses(
      proceso({
        processType: 'OTROS',
        processTypeOther: 'Acción de tutela',
      }) as never,
    );
    expect(result.PROCESO_1_TIPO).toBe('Acción de tutela');
    expect(result.PROCESO_1_TIPO).not.toBe('OTROS');
  });

  it('"OTROS" sin texto libre cae a la etiqueta genérica "Otros"', () => {
    const result = mapLegalProcesses(
      proceso({ processType: 'OTROS', processTypeOther: null }) as never,
    );
    expect(result.PROCESO_1_TIPO).toBe('Otros');
  });

  it('sin proceso, sigue mostrando "N/A" (no se tocó ese caso)', () => {
    const result = mapLegalProcesses([] as never);
    expect(result.PROCESO_1_TIPO).toBe('N/A');
  });

  it('un código legado que no matchea ningún tipo real cae a mostrarse tal cual', () => {
    // Esto es justamente por qué el golden master no mueve un byte en
    // PROCESO_n_TIPO: el fixture compartido (mapper-scenarios.ts) usa
    // 'Ejecutivo singular', un string que nunca fue un código real del
    // selector (la lista vigente es EJECUTIVO/COACTIVO/.../OTROS), así que
    // cae en este mismo fallback antes y después del fix.
    const result = mapLegalProcesses(
      proceso({ processType: 'Ejecutivo singular' }) as never,
    );
    expect(result.PROCESO_1_TIPO).toBe('Ejecutivo singular');
  });
});
