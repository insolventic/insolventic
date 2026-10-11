/**
 * Montos de dinero del formulario: un solo lugar para formatearlos y leerlos.
 *
 * POR QUÉ EXISTE. Los campos de dinero pasaron de `<input type="number">` a
 * `type="text"` para poder mostrar separador de miles mientras se escribe
 * (`1.500.000`), porque un input numérico nativo **rechaza el punto**: el
 * navegador no deja escribirlo y el valor queda inválido.
 *
 * EL BUG QUE ESTO ARREGLA DE RAÍZ. El schema traía 54 copias de este transform:
 *
 *     z.string().transform((val) =>
 *       val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined)
 *
 * Ese strip **conserva el punto**, así que `"1.500.000"` → `parseFloat("1.500.000")`
 * → **`1.5`**. Un gasto de millón y medio se guardaba como un peso cincuenta, y
 * ese número alimenta la hoja "Ingresos y Gastos" del Excel y el cálculo de
 * capacidad de pago de la propuesta. Sin separadores de miles el bug era
 * inalcanzable desde la UI; agregarlos sin tocar el parseo lo habría activado.
 *
 * LA AMBIGÜEDAD, Y LA REGLA QUE LA RESUELVE. En es-CO el punto separa miles y
 * la coma los decimales, pero los valores viejos vienen de inputs con
 * `step="0.01"`, que producen `"1234.56"` con el punto como decimal. O sea que
 * el punto significa dos cosas distintas según de dónde venga el dato. La regla,
 * en orden:
 *
 *   1. Si hay **coma**, la coma es el decimal y los puntos son miles.
 *        "1.500.000,50" → 1500000.5
 *   2. Si no hay coma y la cadena es `^\d{1,3}(\.\d{3})+$`, son **miles**.
 *        "1.500.000" → 1500000   ·   "1.500" → 1500
 *   3. Cualquier otro punto es **decimal**, que es la forma vieja.
 *        "1234.56" → 1234.56
 *
 * El caso 2 es el único que decide algo discutible: `"1.500"` podría haber sido
 * 1,5 escrito con tres decimales. Se elige 1500 porque es lo que produce la UI
 * nueva, porque tres decimales en pesos no significan nada, y porque el caso
 * contrario (`1.5`) se sigue leyendo bien por la regla 3.
 *
 * NO sirve para campos numéricos que no son dinero —edad, meses, porcentaje,
 * días de mora—: ésos siguen siendo `type="number"` y no llevan separador.
 */

/** Lo que se considera "sin valor": el campo quedó vacío. */
function estaVacio(valor: unknown): boolean {
  return (
    valor === null ||
    valor === undefined ||
    (typeof valor === 'string' && valor.trim() === '')
  );
}

const SOLO_MILES = /^\d{1,3}(\.\d{3})+$/;

/**
 * Lee un monto escrito por una persona y devuelve el número.
 *
 * - Un número pasa tal cual (los 3 campos que todavía usan `valueAsNumber`).
 * - Vacío devuelve `undefined`, no `0`: "no lo cargué" y "cargué cero" no son
 *   lo mismo en un expediente.
 * - Una cadena que no es un monto devuelve `NaN` **a propósito**, para que el
 *   `z.number()` de abajo la rechace con un error visible. Antes se guardaba
 *   `NaN` en silencio, porque el transform no se validaba.
 */
export function parsearMonto(valor: unknown): number | undefined {
  if (estaVacio(valor)) return undefined;
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return Number(valor);

  const limpio = valor.trim().replace(/\s/g, '').replace(/\$/g, '');
  const negativo = limpio.startsWith('-');
  const cuerpo = negativo ? limpio.slice(1) : limpio;

  let normalizado: string;
  if (cuerpo.includes(',')) {
    // Regla 1: la coma manda. Los puntos que haya son miles.
    normalizado = cuerpo.replace(/\./g, '').replace(',', '.');
  } else if (SOLO_MILES.test(cuerpo)) {
    // Regla 2: grupos de tres exactos → separador de miles.
    normalizado = cuerpo.replace(/\./g, '');
  } else {
    // Regla 3: la forma vieja, con el punto como decimal.
    normalizado = cuerpo;
  }

  const n = Number(normalizado);
  return negativo ? -n : n;
}

/**
 * Escribe un monto con separador de miles, para mostrarlo en el input.
 *
 * Devuelve `''` para vacío y para `NaN`: un input no puede mostrar "NaN" sin
 * que el usuario crea que el sistema se rompió.
 */
export function formatearMonto(valor: unknown): string {
  const n = parsearMonto(valor);
  if (n === undefined || Number.isNaN(n)) return '';
  const negativo = n < 0;
  const abs = Math.abs(n);
  const entero = Math.trunc(abs);
  const decimales = abs - entero;
  const enteroConPuntos = entero.toLocaleString('es-CO', {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  const cola =
    decimales > 0
      ? ',' + decimales.toFixed(2).slice(2).replace(/0+$/, '')
      : '';
  return `${negativo ? '-' : ''}${enteroConPuntos}${cola}`;
}

/**
 * Reformatea lo que la persona está escribiendo, conservando lo que todavía no
 * es un número completo.
 *
 * Mientras se tipea hay estados intermedios que `formatearMonto` destruiría: la
 * coma recién puesta (`"1500,"`) o un cero decimal a la derecha (`"1500,50"` →
 * `,5`). Acá se formatea **solo la parte entera** y se deja la decimal como
 * está, que es lo que hace que el campo no "pelee" con quien escribe.
 */
export function formatearMientrasEscribe(texto: string): string {
  if (texto.trim() === '') return '';
  const negativo = texto.trim().startsWith('-');
  // Solo dígitos y UNA coma: se descarta cualquier otra cosa que se pegue.
  const crudo = texto.replace(/[^\d,]/g, '');
  const [entero = '', ...resto] = crudo.split(',');
  const hayComa = crudo.includes(',');
  const decimal = resto.join('').slice(0, 2);
  const enteroConPuntos = entero
    ? Number(entero).toLocaleString('es-CO', { maximumFractionDigits: 0 })
    : '';
  const signo = negativo ? '-' : '';
  if (!hayComa) return `${signo}${enteroConPuntos}`;
  return `${signo}${enteroConPuntos},${decimal}`;
}
