/**
 * Borradores de formularios en el navegador (localStorage).
 *
 * Núcleo puro: recibe el `Storage` como parámetro para poder probarlo sin
 * navegador. Lo usan `useBorradorFormulario` (guardar y restaurar) y
 * `PurgaBorradores` (limpieza al cargar la app).
 *
 * DATOS PERSONALES. Un borrador puede contener nombres, cédulas, ingresos y
 * deudas, y queda en el disco del equipo. Mitigaciones (ver
 * docs/IMPLEMENTACION_MEJORAS_FORMULARIO.md):
 *  - vence a las 48 h y se borra al leerlo vencido o al cargar la app;
 *  - la clave lleva centro + usuario: el borrador de otra persona en el mismo
 *    navegador no se ofrece y se purga al cargar la app;
 *  - se borra al enviar con éxito y con "Descartar borrador";
 *  - nunca guarda archivos (File/Blob) ni campos que parezcan contraseñas,
 *    tokens o secretos (`sanearDatos`).
 */

export const PREFIJO_BORRADOR = 'insolventic:borrador';
export const VIGENCIA_BORRADOR_MS = 48 * 60 * 60 * 1000;

/** Versión del sobre (no del formulario). Cambia si cambia esta estructura. */
const VERSION_SOBRE = 1;

export interface IdentidadBorrador {
  userId: string;
  tenantId: string;
}

export interface SobreBorrador<T = unknown> {
  sobre: typeof VERSION_SOBRE;
  /** Versión del esquema del formulario que lo guardó. */
  version: number;
  userId: string;
  tenantId: string;
  formulario: string;
  guardadoEn: number;
  datos: T;
  /** Metadatos que no son valores del formulario. */
  extra?: {
    /** Nombres de archivos elegidos: los archivos mismos no se guardan. */
    adjuntos?: string[];
    /** Versión del registro editado cuando se guardó (formularios de edición). */
    versionEntidad?: string;
  };
}

export type LecturaBorrador<T> =
  | { estado: 'ninguno' }
  | { estado: 'vigente'; sobre: SobreBorrador<T> }
  | {
      estado: 'descartado';
      motivo: 'vencido' | 'version' | 'corrupto' | 'ajeno';
    };

const segmento = (s: string) => encodeURIComponent(s);

export function claveBorrador(
  identidad: IdentidadBorrador,
  formulario: string,
  entidadId?: string | null,
): string {
  const base = `${PREFIJO_BORRADOR}:${segmento(identidad.tenantId)}:${segmento(identidad.userId)}:${segmento(formulario)}`;
  return entidadId ? `${base}:${segmento(entidadId)}` : base;
}

/** Nombres de campo que nunca se guardan, en cualquier nivel. */
const CAMPO_SENSIBLE = /pass(word)?|contrase|token|secret|clave_?acceso/i;

/**
 * Copia apta para JSON sin archivos, funciones ni campos sensibles. Las
 * fechas pasan a ISO; `undefined` se omite.
 */
export function sanearDatos(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === 'function' || typeof valor === 'symbol')
    return undefined;
  if (typeof Blob !== 'undefined' && valor instanceof Blob) return undefined;
  if (typeof FileList !== 'undefined' && valor instanceof FileList)
    return undefined;
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) {
    return valor.map((v) => {
      const s = sanearDatos(v);
      return s === undefined ? null : s;
    });
  }
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (CAMPO_SENSIBLE.test(k)) continue;
      const s = sanearDatos(v);
      if (s !== undefined) salida[k] = s;
    }
    return salida;
  }
  return valor;
}

function esSobre(x: unknown): x is SobreBorrador {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.sobre === VERSION_SOBRE &&
    typeof o.version === 'number' &&
    typeof o.userId === 'string' &&
    typeof o.tenantId === 'string' &&
    typeof o.formulario === 'string' &&
    typeof o.guardadoEn === 'number' &&
    'datos' in o
  );
}

function leerCrudo(storage: Storage, clave: string): unknown {
  try {
    const texto = storage.getItem(clave);
    return texto === null ? null : (JSON.parse(texto) as unknown);
  } catch {
    return undefined; // JSON roto
  }
}

export function eliminarBorrador(storage: Storage, clave: string): void {
  try {
    storage.removeItem(clave);
  } catch {
    // almacenamiento no disponible: nada que limpiar
  }
}

/**
 * Guarda el borrador. Devuelve `false` si no se pudo (cuota llena, modo
 * privado): el formulario sigue funcionando, solo sin borrador.
 */
export function guardarBorrador<T>(
  storage: Storage,
  identidad: IdentidadBorrador,
  formulario: string,
  entidadId: string | null | undefined,
  version: number,
  datos: T,
  extra?: SobreBorrador['extra'],
  ahora: number = Date.now(),
): boolean {
  const sobre: SobreBorrador = {
    sobre: VERSION_SOBRE,
    version,
    userId: identidad.userId,
    tenantId: identidad.tenantId,
    formulario,
    guardadoEn: ahora,
    datos: sanearDatos(datos),
    ...(extra ? { extra } : {}),
  };
  try {
    storage.setItem(
      claveBorrador(identidad, formulario, entidadId),
      JSON.stringify(sobre),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee el borrador del formulario. Uno vencido, de otra versión del esquema,
 * corrupto o de otra identidad se BORRA y se informa como descartado.
 */
export function leerBorrador<T>(
  storage: Storage,
  identidad: IdentidadBorrador,
  formulario: string,
  entidadId: string | null | undefined,
  version: number,
  ahora: number = Date.now(),
): LecturaBorrador<T> {
  const clave = claveBorrador(identidad, formulario, entidadId);
  const crudo = leerCrudo(storage, clave);
  if (crudo === null) return { estado: 'ninguno' };

  let motivo: 'vencido' | 'version' | 'corrupto' | 'ajeno' | null = null;
  if (!esSobre(crudo)) motivo = 'corrupto';
  else if (
    crudo.userId !== identidad.userId ||
    crudo.tenantId !== identidad.tenantId
  )
    motivo = 'ajeno';
  else if (crudo.version !== version) motivo = 'version';
  else if (
    ahora - crudo.guardadoEn > VIGENCIA_BORRADOR_MS ||
    crudo.guardadoEn > ahora + 60_000
  )
    motivo = 'vencido';

  if (motivo) {
    eliminarBorrador(storage, clave);
    return { estado: 'descartado', motivo };
  }
  return { estado: 'vigente', sobre: crudo as SobreBorrador<T> };
}

function clavesDeBorradores(storage: Storage): string[] {
  const claves: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(`${PREFIJO_BORRADOR}:`)) claves.push(k);
    }
  } catch {
    return [];
  }
  return claves;
}

export function hayBorradores(storage: Storage): boolean {
  return clavesDeBorradores(storage).length > 0;
}

/**
 * Limpieza al cargar la app: borra los vencidos y los corruptos y, si se
 * conoce la identidad de la sesión, los de cualquier otro usuario o centro.
 * Devuelve cuántos borró.
 */
export function purgarBorradores(
  storage: Storage,
  identidad: IdentidadBorrador | null,
  ahora: number = Date.now(),
): number {
  let borrados = 0;
  for (const clave of clavesDeBorradores(storage)) {
    const crudo = leerCrudo(storage, clave);
    const borrar =
      !esSobre(crudo) ||
      ahora - crudo.guardadoEn > VIGENCIA_BORRADOR_MS ||
      (identidad !== null &&
        (crudo.userId !== identidad.userId ||
          crudo.tenantId !== identidad.tenantId));
    if (borrar) {
      eliminarBorrador(storage, clave);
      borrados++;
    }
  }
  return borrados;
}

/** Borra todos los borradores de una identidad (cierre de sesión). */
export function limpiarBorradoresDeUsuario(
  storage: Storage,
  identidad: IdentidadBorrador,
): number {
  const prefijo = `${PREFIJO_BORRADOR}:${segmento(identidad.tenantId)}:${segmento(identidad.userId)}:`;
  let borrados = 0;
  for (const clave of clavesDeBorradores(storage)) {
    if (clave.startsWith(prefijo)) {
      eliminarBorrador(storage, clave);
      borrados++;
    }
  }
  return borrados;
}

/** `localStorage` si existe y se puede usar; `null` en SSR o si está bloqueado. */
export function almacenamientoLocal(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const prueba = `${PREFIJO_BORRADOR}:__prueba__`;
    window.localStorage.setItem(prueba, '1');
    window.localStorage.removeItem(prueba);
    return window.localStorage;
  } catch {
    return null;
  }
}
