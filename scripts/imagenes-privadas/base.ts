/**
 * El host de `DATABASE_URL`, sin usuario ni contraseña. Los scripts lo imprimen
 * antes de hacer nada para que se vea contra qué base corren.
 */
export function hostDeLaBase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL.');
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return '(DATABASE_URL no es una URL válida)';
  }
}
