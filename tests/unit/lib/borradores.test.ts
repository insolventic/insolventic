/**
 * Núcleo de los borradores de formularios: clave por centro + usuario +
 * formulario, versión del esquema, vencimiento a las 48 h, saneo de datos
 * sensibles y purga.
 */
import {
  PREFIJO_BORRADOR,
  VIGENCIA_BORRADOR_MS,
  claveBorrador,
  guardarBorrador,
  hayBorradores,
  leerBorrador,
  limpiarBorradoresDeUsuario,
  purgarBorradores,
  sanearDatos,
} from '@/lib/borradores';

/** Storage en memoria con la misma interfaz que localStorage. */
function crearStorage(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => (datos.has(k) ? datos.get(k)! : null),
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => {
      datos.delete(k);
    },
    setItem: (k, v) => {
      datos.set(k, String(v));
    },
  };
}

const ANA = { userId: 'u-ana', tenantId: 't-armonia' };
const BETO = { userId: 'u-beto', tenantId: 't-armonia' };
const ANA_OTRO_CENTRO = { userId: 'u-ana', tenantId: 't-paz' };
const T0 = Date.UTC(2026, 10, 25, 15, 0, 0);

describe('claveBorrador', () => {
  it('separa por centro, usuario, formulario y registro', () => {
    expect(claveBorrador(ANA, 'caso-nuevo:INSOLVENCY')).toBe(
      `${PREFIJO_BORRADOR}:t-armonia:u-ana:caso-nuevo%3AINSOLVENCY`,
    );
    expect(claveBorrador(ANA, 'caso-edicion', 'c-1')).toBe(
      `${PREFIJO_BORRADOR}:t-armonia:u-ana:caso-edicion:c-1`,
    );
    expect(claveBorrador(ANA, 'f')).not.toBe(claveBorrador(BETO, 'f'));
    expect(claveBorrador(ANA, 'f')).not.toBe(
      claveBorrador(ANA_OTRO_CENTRO, 'f'),
    );
  });
});

describe('guardar y leer', () => {
  it('guarda y devuelve el borrador vigente', () => {
    const s = crearStorage();
    expect(
      guardarBorrador(s, ANA, 'f', null, 1, { nombre: 'Ana' }, undefined, T0),
    ).toBe(true);
    const r = leerBorrador<{ nombre: string }>(s, ANA, 'f', null, 1, T0 + 1000);
    expect(r.estado).toBe('vigente');
    if (r.estado === 'vigente') {
      expect(r.sobre.datos).toEqual({ nombre: 'Ana' });
      expect(r.sobre.guardadoEn).toBe(T0);
    }
  });

  it('sin borrador devuelve "ninguno"', () => {
    expect(leerBorrador(crearStorage(), ANA, 'f', null, 1).estado).toBe(
      'ninguno',
    );
  });

  it('vence a las 48 h: se descarta y se borra', () => {
    const s = crearStorage();
    guardarBorrador(s, ANA, 'f', null, 1, { a: 1 }, undefined, T0);
    expect(
      leerBorrador(s, ANA, 'f', null, 1, T0 + VIGENCIA_BORRADOR_MS).estado,
    ).toBe('vigente');
    expect(
      leerBorrador(s, ANA, 'f', null, 1, T0 + VIGENCIA_BORRADOR_MS + 1),
    ).toEqual({
      estado: 'descartado',
      motivo: 'vencido',
    });
    expect(s.length).toBe(0);
  });

  it('una versión distinta del esquema se descarta sin romper', () => {
    const s = crearStorage();
    guardarBorrador(s, ANA, 'f', null, 1, { viejo: true }, undefined, T0);
    expect(leerBorrador(s, ANA, 'f', null, 2, T0)).toEqual({
      estado: 'descartado',
      motivo: 'version',
    });
    expect(s.length).toBe(0);
  });

  it('JSON roto o con otra forma se descarta como corrupto', () => {
    const s = crearStorage();
    s.setItem(claveBorrador(ANA, 'f'), '{no es json');
    expect(leerBorrador(s, ANA, 'f', null, 1).estado).toBe('descartado');
    s.setItem(claveBorrador(ANA, 'f'), JSON.stringify({ hola: 1 }));
    expect(leerBorrador(s, ANA, 'f', null, 1)).toEqual({
      estado: 'descartado',
      motivo: 'corrupto',
    });
  });

  it('un borrador puesto bajo la clave de otra identidad no se ofrece', () => {
    const s = crearStorage();
    guardarBorrador(s, BETO, 'f', null, 1, { de: 'beto' }, undefined, T0);
    // Copiado a mano bajo la clave de Ana: el contenido dice Beto.
    s.setItem(claveBorrador(ANA, 'f'), s.getItem(claveBorrador(BETO, 'f'))!);
    expect(leerBorrador(s, ANA, 'f', null, 1, T0)).toEqual({
      estado: 'descartado',
      motivo: 'ajeno',
    });
  });

  it('si el almacenamiento falla (cuota llena) no rompe: devuelve false', () => {
    const s = crearStorage();
    s.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(guardarBorrador(s, ANA, 'f', null, 1, { a: 1 })).toBe(false);
  });
});

describe('sanearDatos', () => {
  it('no guarda archivos, contraseñas, tokens ni secretos', () => {
    const archivo = new File(['x'], 'cedula.pdf', { type: 'application/pdf' });
    expect(
      sanearDatos({
        nombre: 'Ana',
        adjunto: archivo,
        password: '123',
        nuevaContrasena: 'abc',
        accessToken: 't',
        apiSecret: 's',
        anidado: { refreshToken: 'r', valor: 2, lista: [archivo, 'ok'] },
      }),
    ).toEqual({
      nombre: 'Ana',
      anidado: { valor: 2, lista: [null, 'ok'] },
    });
  });

  it('las fechas pasan a ISO y undefined se omite', () => {
    expect(sanearDatos({ f: new Date(T0), u: undefined, n: null })).toEqual({
      f: new Date(T0).toISOString(),
      n: null,
    });
  });
});

describe('purga y limpieza', () => {
  it('al cargar la app borra vencidos, corruptos y los de otros usuarios o centros', () => {
    const s = crearStorage();
    guardarBorrador(s, ANA, 'vigente', null, 1, {}, undefined, T0);
    guardarBorrador(
      s,
      ANA,
      'vencido',
      null,
      1,
      {},
      undefined,
      T0 - VIGENCIA_BORRADOR_MS - 1,
    );
    guardarBorrador(s, BETO, 'de-beto', null, 1, {}, undefined, T0);
    guardarBorrador(
      s,
      ANA_OTRO_CENTRO,
      'otro-centro',
      null,
      1,
      {},
      undefined,
      T0,
    );
    s.setItem(`${PREFIJO_BORRADOR}:roto`, '{');
    s.setItem('otra-app', 'no se toca');

    expect(purgarBorradores(s, ANA, T0)).toBe(4);
    expect(s.getItem(claveBorrador(ANA, 'vigente'))).not.toBeNull();
    expect(s.getItem('otra-app')).toBe('no se toca');
    expect(s.length).toBe(2);
  });

  it('sin sesión solo borra vencidos y corruptos', () => {
    const s = crearStorage();
    guardarBorrador(s, ANA, 'a', null, 1, {}, undefined, T0);
    guardarBorrador(s, BETO, 'b', null, 1, {}, undefined, T0);
    guardarBorrador(
      s,
      BETO,
      'viejo',
      null,
      1,
      {},
      undefined,
      T0 - VIGENCIA_BORRADOR_MS - 1,
    );
    expect(purgarBorradores(s, null, T0)).toBe(1);
    expect(s.length).toBe(2);
  });

  it('limpiarBorradoresDeUsuario borra solo los de esa identidad', () => {
    const s = crearStorage();
    guardarBorrador(s, ANA, 'a', null, 1, {});
    guardarBorrador(s, ANA, 'b', 'id-1', 1, {});
    guardarBorrador(s, BETO, 'a', null, 1, {});
    guardarBorrador(s, ANA_OTRO_CENTRO, 'a', null, 1, {});
    expect(limpiarBorradoresDeUsuario(s, ANA)).toBe(2);
    expect(s.length).toBe(2);
  });

  it('hayBorradores solo cuenta claves propias', () => {
    const s = crearStorage();
    s.setItem('otra-app', '1');
    expect(hayBorradores(s)).toBe(false);
    guardarBorrador(s, ANA, 'a', null, 1, {});
    expect(hayBorradores(s)).toBe(true);
  });
});
