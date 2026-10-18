/**
 * @jest-environment jsdom
 */

/**
 * Mismo bug que `info-laboral-totales-nan.test.tsx`, dos lugares más:
 * `PaymentProposalSection` (Pág. 5) suma ingresos/gastos de la Pág. 2 Y los
 * `capitalAmount`/`interestAmount` de cada acreedor con `Number()` directo
 * sobre el texto de `MoneyInput` — ambos NaN con coma decimal o con montos
 * de 2+ grupos de miles.
 */

import { useForm, FormProvider } from 'react-hook-form';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PaymentProposalSection } from '@/app/cases/components/create-case-dialog/payment-proposal-section';

function montarSeccion(debts: unknown[]) {
  function Host() {
    const form = useForm({
      defaultValues: {
        ingresoPrincipalMensual: '',
        otrosIngresosMensuales: '',
        ingresosVariablesPromedio: '',
        ingresosNoOperacionales: '',
        gastosVivienda: '',
        gastosAlimentacion: '',
        gastosServiciosPublicos: '',
        gastosTransporte: '',
        gastosEducacion: '',
        gastosSalud: '',
        otrosGastos: '',
        capitalReductionPercent: '',
        debts,
      } as never,
    });
    return (
      <FormProvider {...form}>
        <PaymentProposalSection />
      </FormProvider>
    );
  }
  render(<Host />);
}

function totalObligacionesEnPantalla(): string {
  const label = screen.getByText('Total Obligaciones');
  return label.parentElement!.querySelector('p')!.textContent ?? '';
}

describe('Pág. 5 — Total Obligaciones nunca es NaN', () => {
  it('REGRESIÓN: suma correctamente acreedores con coma decimal', () => {
    montarSeccion([
      { type: 'PERSONAL', capitalAmount: '1.234,56', interestAmount: '0' },
      { type: 'TARJETA_CREDITO', capitalAmount: '1.500.000', interestAmount: '0' },
    ]);

    const texto = totalObligacionesEnPantalla();
    expect(texto).not.toContain('NaN');
    // 1.234,56 + 1.500.000 = 1.501.234,56 -> formatCurrency sin decimales
    expect(texto).toContain('1.501.235');
  });

  it('un capitalAmount vacío o parcial ("1500,") cuenta como 0, no NaN', () => {
    montarSeccion([
      { type: 'PERSONAL', capitalAmount: '1500,', interestAmount: '' },
    ]);

    expect(totalObligacionesEnPantalla()).not.toContain('NaN');
  });

  it('sin acreedores, el total es 0', () => {
    montarSeccion([]);
    const texto = totalObligacionesEnPantalla();
    expect(texto).not.toContain('NaN');
    expect(texto).toContain('0');
  });
});
