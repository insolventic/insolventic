/**
 * @jest-environment jsdom
 */

/**
 * Mismo bug que `info-laboral-totales-nan.test.tsx`, en el componente que usa
 * el diálogo de EDITAR caso (`edit-case-dialog.tsx` → `IncomeSection` de
 * `create-case-dialog/income-section.tsx`): "Total Ingresos" y "Disponible"
 * sumaban con `Number()` directo sobre el texto de `MoneyInput`.
 */

import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { IncomeSection } from '@/app/cases/components/create-case-dialog/income-section';

function montarSeccion() {
  function Host() {
    const form = useForm({
      defaultValues: {
        monthlyIncome: '',
        otherIncomeAmount: '',
        monthlyExpenses: '',
        otherIncomeDescription: '',
        hasEmployerCertification: false,
      } as never,
    });
    return (
      <FormProvider {...form}>
        <IncomeSection />
      </FormProvider>
    );
  }
  render(<Host />);
}

function totalIngresosEnPantalla(): string {
  const label = screen.getByText('Total Ingresos');
  return (label.parentElement!.querySelector('input') as HTMLInputElement)
    .value;
}

function campoMonthlyIncome(): HTMLInputElement {
  return document.getElementById('monthlyIncome') as HTMLInputElement;
}

describe('IncomeSection (editar caso) — Total Ingresos nunca es NaN', () => {
  it('REGRESIÓN: coma decimal suma correctamente, sin NaN', () => {
    montarSeccion();

    act(() => {
      fireEvent.change(campoMonthlyIncome(), { target: { value: '1234,56' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
    expect(totalIngresosEnPantalla()).toBe('1.234,56');
  });

  it('REGRESIÓN: monto >= 1.000.000 (2+ grupos de miles) no da NaN', () => {
    montarSeccion();

    act(() => {
      fireEvent.change(campoMonthlyIncome(), { target: { value: '1500000' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
    expect(totalIngresosEnPantalla()).toContain('1.500.000');
  });

  it('escribir y borrar no deja el total dañado', () => {
    montarSeccion();

    act(() => {
      fireEvent.change(campoMonthlyIncome(), { target: { value: '1234,56' } });
    });
    act(() => {
      fireEvent.change(campoMonthlyIncome(), { target: { value: '' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
  });
});
