/**
 * La sección de documentos verifica el contenido real de cada archivo elegido
 * leyendo su cabecera (asíncrono: Blob/FileReader). En los tests, tras simular
 * la elección, hay que dejar que esa lectura termine antes de afirmar nada.
 */
export function esperarLecturaDeArchivos(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}
