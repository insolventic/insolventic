/**
 * Unit Tests: doble escritura de apoderados (src/features/case/apoderados.ts).
 *
 * Patrón strangler: la tabla `apoderados` guarda la lista completa y el
 * principal se espeja en las 8 columnas escalares de Case — solo si vienen
 * vacías, todo o nada.
 */

import {
  buildApoderadosCreate,
  mirrorPrincipalApoderado,
} from '@/features/case/apoderados';
import type { ApoderadoFormData } from '@/features/case/schemas';

const ANA: ApoderadoFormData = {
  nombreCompleto: 'Ana Torres',
  tipoIdentificacion: 'CC',
  identificacion: '52111222',
  tarjetaProfesional: 'TP-111',
  direccion: 'Calle 1 # 2-3',
  telefono: '3001112222',
  correo: 'ana@abogados.co',
  existePoderOtorgado: true,
};

const LUIS: ApoderadoFormData = {
  nombreCompleto: 'Luis Rojas',
  tipoIdentificacion: 'CE',
  identificacion: '99887766',
  tarjetaProfesional: 'TP-222',
  direccion: 'Carrera 9 # 8-7',
  telefono: '3105556666',
  correo: 'luis@abogados.co',
  existePoderOtorgado: false,
};

describe('buildApoderadosCreate', () => {
  it('devuelve undefined sin apoderados (no envía nested create vacío)', () => {
    expect(buildApoderadosCreate(undefined, 'tenant-1')).toBeUndefined();
    expect(buildApoderadosCreate([], 'tenant-1')).toBeUndefined();
  });

  it('crea una fila por apoderado, con orden y tenantId', () => {
    const result = buildApoderadosCreate([ANA, LUIS], 'tenant-1');

    expect(result?.create).toHaveLength(2);
    expect(result?.create[0]).toEqual({
      orden: 0,
      nombreCompleto: 'Ana Torres',
      tipoIdentificacion: 'CC',
      identificacion: '52111222',
      tarjetaProfesional: 'TP-111',
      direccion: 'Calle 1 # 2-3',
      telefono: '3001112222',
      correo: 'ana@abogados.co',
      existePoderOtorgado: true,
      tenantId: 'tenant-1',
    });
    expect(result?.create[1]).toMatchObject({
      orden: 1,
      nombreCompleto: 'Luis Rojas',
      existePoderOtorgado: false,
      tenantId: 'tenant-1',
    });
  });

  it('normaliza textos en blanco a null y existePoderOtorgado a false', () => {
    const result = buildApoderadosCreate(
      [
        {
          nombreCompleto: 'Solo Nombre',
          tipoIdentificacion: '',
          identificacion: '   ',
          correo: undefined,
        },
      ],
      'tenant-1',
    );

    expect(result?.create[0]).toMatchObject({
      nombreCompleto: 'Solo Nombre',
      tipoIdentificacion: null,
      identificacion: null,
      tarjetaProfesional: null,
      direccion: null,
      telefono: null,
      correo: null,
      existePoderOtorgado: false,
    });
  });
});

describe('mirrorPrincipalApoderado', () => {
  it('sin apoderados no espeja nada', () => {
    expect(mirrorPrincipalApoderado(undefined, {})).toEqual({});
    expect(mirrorPrincipalApoderado([], {})).toEqual({});
  });

  it('espeja el PRIMERO (no los demás) en las 8 columnas si vienen vacías', () => {
    expect(mirrorPrincipalApoderado([ANA, LUIS], {})).toEqual({
      apoderadoNombreCompleto: 'Ana Torres',
      apoderadoTipoIdentificacion: 'CC',
      apoderadoIdentificacion: '52111222',
      apoderadoTarjetaProfesional: 'TP-111',
      apoderadoDireccion: 'Calle 1 # 2-3',
      apoderadoTelefono: '3001112222',
      apoderadoCorreo: 'ana@abogados.co',
      existePoderOtorgado: true,
    });
  });

  it('trata como vacías las columnas con undefined, null, "" o solo espacios', () => {
    const legacy = {
      apoderadoNombreCompleto: '',
      apoderadoTipoIdentificacion: null,
      apoderadoIdentificacion: '   ',
      apoderadoTarjetaProfesional: undefined,
      existePoderOtorgado: false,
    };
    expect(mirrorPrincipalApoderado([ANA], legacy)).toMatchObject({
      apoderadoNombreCompleto: 'Ana Torres',
    });
  });

  it.each([
    ['apoderadoNombreCompleto', 'Dr. Legado'],
    ['apoderadoTipoIdentificacion', 'CC'],
    ['apoderadoIdentificacion', '123'],
    ['apoderadoTarjetaProfesional', 'TP-9'],
    ['apoderadoDireccion', 'Calle X'],
    ['apoderadoTelefono', '300'],
    ['apoderadoCorreo', 'x@y.co'],
  ])(
    'NO espeja nada si el flujo legado ya trajo %s (todo o nada, sin híbridos)',
    (field, value) => {
      expect(mirrorPrincipalApoderado([ANA], { [field]: value })).toEqual({});
    },
  );

  it('NO espeja si el legado ya marcó existePoderOtorgado', () => {
    expect(
      mirrorPrincipalApoderado([ANA], { existePoderOtorgado: true }),
    ).toEqual({});
  });

  it('un principal sin campos opcionales se espeja con null y poder en false', () => {
    expect(
      mirrorPrincipalApoderado([{ nombreCompleto: 'Solo Nombre' }], {}),
    ).toEqual({
      apoderadoNombreCompleto: 'Solo Nombre',
      apoderadoTipoIdentificacion: null,
      apoderadoIdentificacion: null,
      apoderadoTarjetaProfesional: null,
      apoderadoDireccion: null,
      apoderadoTelefono: null,
      apoderadoCorreo: null,
      existePoderOtorgado: false,
    });
  });
});
