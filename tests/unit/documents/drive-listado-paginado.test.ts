/**
 * Listados de Drive con paginación y por niveles (`src/lib/google-drive.ts`).
 *
 * `listFoldersAndFiles` no pedía `nextPageToken`: Drive devuelve una página
 * por llamada (100 elementos si no se pide otro tamaño), así que una carpeta
 * con más elementos se leía a medias y en silencio. `listarArbolesPorNiveles`
 * lee el árbol de muchas carpetas con pocas consultas: los hijos de varias
 * carpetas padre a la vez, en tandas de tamaño fijo.
 *
 * Drive es un fake en memoria del cliente de `googleapis` que, como la API,
 * puede devolver menos elementos que los pedidos: corta cada página en 100.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const CARPETA = 'application/vnd.google-apps.folder';

interface Item {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}
let items: Item[] = [];
/** Consultas que deben fallar: si el `q` contiene este id de padre. */
let fallaSiPide: string | null = null;

type Consulta = { q: string; pageSize?: number; pageToken?: string };

const listarFake = async (p: Consulta) => {
  const padres = [...p.q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
  if (fallaSiPide && padres.includes(fallaSiPide)) {
    throw Object.assign(new Error('Drive 500'), { status: 500 });
  }
  const soloCarpetas = p.q.includes(`mimeType='${CARPETA}'`);
  const sinCarpetas = p.q.includes(`mimeType!='${CARPETA}'`);
  const hallados = items.filter(
    (i) =>
      i.parents.some((x) => padres.includes(x)) &&
      (!soloCarpetas || i.mimeType === CARPETA) &&
      (!sinCarpetas || i.mimeType !== CARPETA),
  );
  // Como la API: una página puede traer menos de lo pedido.
  const tamano = Math.min(p.pageSize ?? 100, 100);
  const desde = Number(p.pageToken ?? 0);
  const pagina = hallados.slice(desde, desde + tamano);
  const siguiente = desde + tamano < hallados.length ? desde + tamano : null;
  return {
    data: {
      files: pagina,
      ...(siguiente !== null && { nextPageToken: String(siguiente) }),
    },
  };
};
const mockList = jest.fn(listarFake);

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials = jest.fn();
      },
    },
    drive: () => ({
      files: {
        list: (p: Consulta) => mockList(p),
      },
    }),
  },
}));

import { logger } from '@/lib/logger';
import { PADRES_POR_CONSULTA, googleDriveService } from '@/lib/google-drive';

const carpeta = (id: string, padre: string, name = id): Item => ({
  id,
  name,
  mimeType: CARPETA,
  parents: [padre],
});
const archivo = (id: string, padre: string): Item => ({
  id,
  name: `${id}.pdf`,
  mimeType: 'application/pdf',
  parents: [padre],
});

/** Un caso con la estructura v1: 01-Generados/<plantilla>/archivo y 02-Adjuntos/archivo. */
function casoV1(n: number): Item[] {
  const c = `caso-${n}`;
  return [
    carpeta(`${c}-gen`, c, '01-Generados'),
    carpeta(`${c}-sol`, `${c}-gen`, 'Solicitud'),
    archivo(`${c}-doc`, `${c}-sol`),
    carpeta(`${c}-adj`, c, '02-Adjuntos'),
    archivo(`${c}-ced`, `${c}-adj`),
  ];
}

beforeEach(() => {
  items = [];
  fallaSiPide = null;
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockList.mockImplementation(listarFake);
});

describe('listFoldersAndFiles: recorre todas las páginas', () => {
  it('con más de 100 carpetas y 100 archivos en la misma carpeta, los devuelve todos', async () => {
    for (let i = 0; i < 130; i++) items.push(carpeta(`c${i}`, 'raiz'));
    for (let i = 0; i < 250; i++) items.push(archivo(`a${i}`, 'raiz'));

    const { folders, files } =
      await googleDriveService.listFoldersAndFiles('raiz');

    expect(folders).toHaveLength(130);
    expect(files).toHaveLength(250);
    // 2 páginas de carpetas y 3 de archivos.
    expect(mockList).toHaveBeenCalledTimes(5);
  });
});

describe('listarArbolesPorNiveles', () => {
  it('da el mismo árbol que el listado recursivo, para cada raíz', async () => {
    items = [...casoV1(1), ...casoV1(2), ...casoV1(3)];

    const { arboles, incompletas } =
      await googleDriveService.listarArbolesPorNiveles([
        'caso-1',
        'caso-2',
        'caso-3',
      ]);

    expect(incompletas.size).toBe(0);
    for (const raiz of ['caso-1', 'caso-2', 'caso-3']) {
      const recursivo =
        await googleDriveService.listAllFoldersAndFilesRecursively(raiz);
      const porNiveles = arboles.get(raiz)!;
      const clave = (x: { id: string; path: string[]; parentId: string }) =>
        `${x.id}|${x.path.join('/')}|${x.parentId}`;
      expect(porNiveles.folders.map(clave).sort()).toEqual(
        recursivo.folders.map(clave).sort(),
      );
      expect(porNiveles.files.map(clave).sort()).toEqual(
        recursivo.files.map(clave).sort(),
      );
    }
    expect(
      arboles.get('caso-1')!.files.find((f) => f.id === 'caso-1-doc'),
    ).toMatchObject({
      path: ['01-Generados', 'Solicitud'],
      parentId: 'caso-1-sol',
    });
  });

  it('pide los hijos de muchas carpetas por consulta, sin pasar del tope de padres', async () => {
    const raices = Array.from({ length: 95 }, (_, i) => `caso-${i}`);
    items = raices.flatMap((_, i) => casoV1(i));

    const { incompletas } =
      await googleDriveService.listarArbolesPorNiveles(raices);

    expect(incompletas.size).toBe(0);
    for (const [p] of mockList.mock.calls) {
      const padres = (p.q.match(/' in parents/g) ?? []).length;
      expect(padres).toBeLessThanOrEqual(PADRES_POR_CONSULTA);
    }
    // 95 casos con 3 niveles bajo la raíz: unas pocas decenas de consultas,
    // no dos por carpeta (serían 5 carpetas × 95 casos × 2 = 950).
    expect(mockList.mock.calls.length).toBeLessThan(60);
  });

  it('pasado el tope de tiempo, deja de consultar y devuelve las raíces que no terminó', async () => {
    const raices = Array.from({ length: 100 }, (_, i) => `caso-${i}`);
    items = raices.flatMap((_, i) => casoV1(i));
    // El reloj avanza 1 s por consulta: con tope de 5 s alcanza para el
    // primer lote de 40 raíces (4 niveles) y corta en el segundo.
    let ahora = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    mockList.mockImplementation(async (p) => {
      ahora += 1000;
      return listarFake(p);
    });

    const { arboles, incompletas } =
      await googleDriveService.listarArbolesPorNiveles(raices, { hasta: 5000 });

    const completas = raices.filter((r) => !incompletas.has(r));
    expect(completas).toEqual(raices.slice(0, PADRES_POR_CONSULTA));
    expect(incompletas.size).toBe(raices.length - PADRES_POR_CONSULTA);
    // Lo completo está entero.
    expect(arboles.get('caso-0')!.files).toHaveLength(2);
  });

  it('una tanda que falla deja incompletas sus raíces y sigue con el resto', async () => {
    const raices = Array.from({ length: 45 }, (_, i) => `caso-${i}`);
    items = raices.flatMap((_, i) => casoV1(i));
    // caso-41 va en la segunda tanda de raíces (la de 41 a 44).
    fallaSiPide = 'caso-41';

    const { arboles, incompletas } =
      await googleDriveService.listarArbolesPorNiveles(raices);

    expect([...incompletas].sort()).toEqual(
      ['caso-40', 'caso-41', 'caso-42', 'caso-43', 'caso-44'].sort(),
    );
    expect(arboles.get('caso-0')!.files).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'No se pudo listar una tanda de carpetas de Drive',
      expect.objectContaining({ carpetas: 5 }),
    );
  });
});
