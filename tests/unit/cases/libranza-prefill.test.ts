/**
 * Unit Tests: prefill del pagador de libranza (src/features/case/libranza-prefill.ts).
 *
 * Lo que se fija es el comportamiento de producto: que el dato se ofrezca
 * escrito, y que siga siendo del usuario. El caso importante es el último —
 * borrar el pagador a mano tiene que quedar borrado— porque es la forma en que
 * un prefill mal hecho vuelve inusable un campo.
 */

import {
  EMPLOYER_FIELD,
  LIBRANZAS_FIELD,
  resolvePayerPrefill,
} from '@/features/case/libranza-prefill';

const EMPLEADOR = 'Constructora del Caribe S.A.S.';

describe('resolvePayerPrefill', () => {
  it('los nombres de campo son los que observa la suscripción del wizard', () => {
    expect(EMPLOYER_FIELD).toBe('deudorNombreEmpleador');
    expect(LIBRANZAS_FIELD).toBe('libranzas');
  });

  describe('al declarar el empleador', () => {
    it('completa las libranzas que estén vacías', () => {
      const { indices, value } = resolvePayerPrefill({
        changedField: EMPLOYER_FIELD,
        employerName: EMPLEADOR,
        libranzas: [{ payerName: '' }, { payerName: '' }],
        previousCount: 2,
      });

      expect(indices).toEqual([0, 1]);
      expect(value).toBe(EMPLEADOR);
    });

    it('no pisa las que ya tienen un pagador distinto', () => {
      const { indices } = resolvePayerPrefill({
        changedField: EMPLOYER_FIELD,
        employerName: EMPLEADOR,
        libranzas: [{ payerName: 'Pagaduría Nacional' }, { payerName: '' }],
        previousCount: 2,
      });

      expect(indices).toEqual([1]);
    });

    it('recorta el nombre antes de escribirlo', () => {
      const { value } = resolvePayerPrefill({
        changedField: EMPLOYER_FIELD,
        employerName: `  ${EMPLEADOR}  `,
        libranzas: [{ payerName: '' }],
        previousCount: 1,
      });

      expect(value).toBe(EMPLEADOR);
    });

    it('no hace nada si el empleador está vacío o es solo espacios', () => {
      for (const empleador of ['', '   ', null, undefined, 42]) {
        const { indices } = resolvePayerPrefill({
          changedField: EMPLOYER_FIELD,
          employerName: empleador,
          libranzas: [{ payerName: '' }],
          previousCount: 1,
        });
        expect(indices).toEqual([]);
      }
    });
  });

  describe('al agregar una libranza', () => {
    it('la nueva arranca con el empleador ya declarado', () => {
      // Flujo habitual: el empleador se llenó en la Página 2 y la libranza se
      // agrega en la Página 3, así que el cambio de empleador ya pasó.
      const { indices, nextCount } = resolvePayerPrefill({
        changedField: 'libranzas',
        employerName: EMPLEADOR,
        libranzas: [{ payerName: 'Pagaduría Nacional' }, { payerName: '' }],
        previousCount: 1,
      });

      expect(indices).toEqual([1]);
      expect(nextCount).toBe(2);
    });

    it('no actúa si el arreglo no creció', () => {
      const { indices } = resolvePayerPrefill({
        changedField: 'libranzas.0.deductedAmount',
        employerName: EMPLEADOR,
        libranzas: [{ payerName: '' }],
        previousCount: 1,
      });

      expect(indices).toEqual([]);
    });

    it('al borrar una libranza no rellena las que quedan', () => {
      const { indices, nextCount } = resolvePayerPrefill({
        changedField: 'libranzas',
        employerName: EMPLEADOR,
        libranzas: [{ payerName: '' }],
        previousCount: 2,
      });

      expect(indices).toEqual([]);
      expect(nextCount).toBe(1);
    });
  });

  describe('el pagador sigue siendo del usuario', () => {
    it('borrarlo a mano lo deja borrado', () => {
      // Esta es la regresión que importa: si el prefill reaccionara a cualquier
      // cambio de `libranzas` en vez de a que el arreglo crezca, vaciar el campo
      // lo volvería a rellenar en el acto y no habría forma de dejarlo vacío.
      const { indices } = resolvePayerPrefill({
        changedField: 'libranzas.0.payerName',
        employerName: EMPLEADOR,
        libranzas: [{ payerName: '' }],
        previousCount: 1,
      });

      expect(indices).toEqual([]);
    });

    it('un cambio ajeno al empleador y a las libranzas no dispara nada', () => {
      const { indices } = resolvePayerPrefill({
        changedField: 'debts.0.capitalAmount',
        employerName: EMPLEADOR,
        libranzas: [{ payerName: '' }],
        previousCount: 1,
      });

      expect(indices).toEqual([]);
    });
  });

  it('tolera filas nulas y payerName no-string', () => {
    const { indices } = resolvePayerPrefill({
      changedField: EMPLOYER_FIELD,
      employerName: EMPLEADOR,
      libranzas: [null, undefined, { payerName: 123 }, {}],
      previousCount: 4,
    });

    expect(indices).toEqual([0, 1, 2, 3]);
  });
});
