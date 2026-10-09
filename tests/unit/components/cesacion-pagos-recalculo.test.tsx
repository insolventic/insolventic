/**
 * @jest-environment jsdom
 */

/**
 * La Sección IV recalcula cuando cambian los acreedores.
 *
 * POR QUÉ EXISTE. `cesacion-pagos-section.tsx` derivaba `debts` con
 * `useWatch(...) || []`, que crea un ARRAY NUEVO en cada render: los tres
 * `useMemo` que dependen de `debts` veían una identidad distinta siempre y no
 * memoizaban nada (eran los warnings `react-hooks/exhaustive-deps` de
 * "The 'debts' logical expression could make the dependencies change on every
 * render"). Al estabilizar el fallback, la memoización empieza a funcionar de
 * verdad — y con eso aparece un riesgo que antes no existía: si `useWatch`
 * devolviera el MISMO array mutado en lugar de uno nuevo, el memo quedaría
 * stale y el operador vería "Número de acreedores: 2" con tres acreedores
 * cargados, sin que nada avise.
 *
 * Estos campos son de solo lectura y alimentan los supuestos del art. 538 en la
 * Solicitud, así que una cifra stale es un dato equivocado en un documento que
 * se radica. Nada cubría este componente.
 */

import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, act } from '@testing-library/react';

import { CesacionPagosSection } from '@/app/cases/components/create-case-dialog/cesacion-pagos-section';

/** Envuelve la sección en un form real y expone su API para mutarlo. */
function montarSeccion(debtsIniciales: unknown[]) {
  const api: { setValue?: (n: string, v: unknown) => void } = {};

  function Host() {
    const form = useForm({
      defaultValues: {
        cesacionPagos: true,
        debts: debtsIniciales,
      } as never,
    });
    api.setValue = (n, v) => form.setValue(n as never, v as never);
    return (
      <FormProvider {...form}>
        <CesacionPagosSection />
      </FormProvider>
    );
  }

  render(<Host />);
  return api;
}

/** El valor del input de solo lectura que muestra el número de acreedores. */
function numAcreedoresEnPantalla(): string {
  const label = screen.getByText('Número de acreedores');
  const campo = label.parentElement!.querySelector('input')!;
  return (campo as HTMLInputElement).value;
}

function porcentajeMoraEnPantalla(): string {
  const label = screen.getByText('Porcentaje de pasivo en mora (%)');
  const campo = label.parentElement!.querySelector('input')!;
  return (campo as HTMLInputElement).value;
}

describe('Sección IV — cifras derivadas de los acreedores', () => {
  it('calcula el número de acreedores y el % en mora del estado inicial', () => {
    montarSeccion([
      { amount: 1000, daysOverdue: 10 },
      { amount: 3000, daysOverdue: 0 },
    ]);

    expect(numAcreedoresEnPantalla()).toBe('2');
    // 1000 en mora sobre 4000 totales = 25%
    expect(porcentajeMoraEnPantalla()).toBe('25%');
  });

  it('REGRESIÓN: recalcula al agregar un acreedor (el memo no queda stale)', () => {
    const api = montarSeccion([{ amount: 1000, daysOverdue: 10 }]);
    expect(numAcreedoresEnPantalla()).toBe('1');

    act(() => {
      api.setValue!('debts', [
        { amount: 1000, daysOverdue: 10 },
        { amount: 1000, daysOverdue: 0 },
        { amount: 2000, daysOverdue: 0 },
      ]);
    });

    expect(numAcreedoresEnPantalla()).toBe('3');
    // 1000 en mora sobre 4000 = 25%
    expect(porcentajeMoraEnPantalla()).toBe('25%');
  });

  it('REGRESIÓN: recalcula al cambiar la mora de un acreedor existente', () => {
    const api = montarSeccion([
      { amount: 1000, daysOverdue: 0 },
      { amount: 1000, daysOverdue: 0 },
    ]);
    expect(porcentajeMoraEnPantalla()).toBe('0%');

    act(() => {
      api.setValue!('debts', [
        { amount: 1000, daysOverdue: 45 },
        { amount: 1000, daysOverdue: 0 },
      ]);
    });

    expect(porcentajeMoraEnPantalla()).toBe('50%');
  });

  it('sin acreedores no divide por cero', () => {
    montarSeccion([]);
    expect(numAcreedoresEnPantalla()).toBe('0');
    expect(porcentajeMoraEnPantalla()).toBe('0%');
  });
});
