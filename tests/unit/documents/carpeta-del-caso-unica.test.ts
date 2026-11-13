/**
 * Guardián: la carpeta raíz de un caso en Drive se decide y se guarda SOLO en
 * `src/features/document/case-folder.ts` (`resolveCaseFolder`).
 *
 * Antes tres módulos la calculaban por su cuenta (la generación del alta con
 * la ruta v1, `/documents` con la v0, los adjuntos con la v0 si no había v1) y
 * dos la guardaban pisando la que hubiera. Divergieron, y un mismo expediente
 * quedó con documentos en dos carpetas. Este test falla si alguien vuelve a
 * armar o a guardar la carpeta del caso fuera de `case-folder.ts`.
 *
 * Las excepciones están nombradas una por una, con su motivo. Agregar una
 * nueva es una decisión, no un arreglo para que el test pase.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CASE_FOLDER = 'src/features/document/case-folder.ts';

/**
 * Excepciones conocidas. Cada una dice por qué no pasa por resolveCaseFolder.
 */
const EXCEPCIONES: Record<string, string> = {
  // Define el método; no lo usa para decidir la carpeta de un caso.
  'src/lib/google-drive.ts': 'definición de findOrCreateCaseFolder',
  // Comprobantes de pago: quedan fuera de esta fase por decisión (van en un
  // cambio aparte cuando se resuelva el #187, que toca el mismo archivo).
  'src/features/payment/actions.ts':
    'comprobantes de pago, pendiente de un cambio aparte',
  // migrateLegacyCaseToV1 mueve una carpeta v0 a la jerarquía v1. No tiene
  // llamadores (lo vigila el último test de este archivo).
  'src/features/document/storage-helpers.ts':
    'migración v0 → v1 sin llamadores',
};

function archivosDe(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDe(ruta, acc);
    else if (/\.(ts|tsx)$/.test(entrada))
      acc.push(ruta.split(/[\\/]/).join('/'));
  }
  return acc;
}

/** El código sin comentarios: un comentario que nombra algo no lo usa. */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const FUENTES = archivosDe('src').map((ruta) => ({
  ruta,
  texto: sinComentarios(readFileSync(ruta, 'utf8')),
}));

function quienes(patron: RegExp): string[] {
  return FUENTES.filter(({ texto }) => patron.test(texto)).map((f) => f.ruta);
}

function fueraDeLoPermitido(rutas: string[]): string[] {
  return rutas.filter((r) => r !== CASE_FOLDER && !(r in EXCEPCIONES));
}

describe('la carpeta raíz del caso se decide solo en case-folder.ts', () => {
  it('nadie más guarda driveFolderId ni layoutVersion en un update', () => {
    // `data: { ... driveFolderId: ... }` o `data: { ... layoutVersion: ... }`,
    // en una o varias líneas, sin llaves anidadas en medio. `\bdata` deja
    // fuera el `metadata` de la auditoría, que solo registra el id.
    const escriben = quienes(
      /\bdata:\s*\{[^{}]*\b(driveFolderId|layoutVersion)\s*:/,
    );
    expect(fueraDeLoPermitido(escriben)).toEqual([]);
    expect(escriben).toContain(CASE_FOLDER);
  });

  it('nadie más arma la ruta v1 (Insolventic/...) de un caso', () => {
    const arman = quienes(/\[\s*'Insolventic'/);
    expect(fueraDeLoPermitido(arman)).toEqual([]);
    expect(arman).toContain(CASE_FOLDER);
  });

  it('nadie más busca la carpeta del caso por su número', () => {
    expect(fueraDeLoPermitido(quienes(/findOrCreateCaseFolder\(/))).toEqual([]);
  });

  it('no vuelven las funciones que decidían la carpeta por su cuenta', () => {
    expect(
      quienes(/\b(getOrCreateCaseFolder|createCaseFolderInGoogleDrive)\b/),
    ).toEqual([]);
  });

  it('migrateLegacyCaseToV1 sigue sin llamadores (si se conecta, revisar este guardián)', () => {
    const usan = quienes(/migrateLegacyCaseToV1/).filter(
      (r) => r !== 'src/features/document/storage-helpers.ts',
    );
    expect(usan).toEqual([]);
  });
});
