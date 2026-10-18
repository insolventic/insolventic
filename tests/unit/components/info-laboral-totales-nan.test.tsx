/**
 * @jest-environment jsdom
 */

/**
 * Bug: "Total ingresos mensuales" (Sección III del wizard) daba NaN al
 * escribir un monto con coma decimal, y seguía dañado después aunque se
 * corrigiera el campo.
 *
 * CAUSA RAÍZ. `InfoLaboralSection` sumaba los 4 campos de ingresos y 7 de
 * gastos con `Number(valorDelCampo)` directo. `MoneyInput` entrega el texto
 * FORMATEADO ("1.234,56" o "1.500.000"), no un número: `Number()` no entiende
 * ni la coma decimal (`Number("1.234,56")` → NaN) ni el punto de miles con
 * dos o más grupos (`Number("1.500.000")` → NaN también, no solo el bug
 * silencioso de `1.5` que ya tenía el parseo viejo del schema). Reproducido
 * en el navegador contra el wizard real antes de escribir este test.
 *
 * No es un estado "atascado" que se arregla solo: CUALQUIER monto >= 1.000.000
 * mostrado con separador de miles vuelve a dar NaN en cada render, haya
 * pasado o no por una coma antes. Por eso el segundo test no depende del
 * primero — entra con el campo limpio.
 */

import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { InfoLaboralSection } from '@/app/cases/components/create-case-dialog/info-laboral-section';

function montarSeccion() {
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
        dependents: [],
      } as never,
    });
    return (
      <FormProvider {...form}>
        <InfoLaboralSection />
      </FormProvider>
    );
  }
  render(<Host />);
}

function totalIngresosEnPantalla(): string {
  const label = screen.getByText('Total ingresos mensuales');
  const campo = label.parentElement!.querySelector('input')!;
  return (campo as HTMLInputElement).value;
}

function campoIngresoPrincipal(): HTMLInputElement {
  const label = screen.getByText('Ingreso principal mensual');
  return label.parentElement!.querySelector('input') as HTMLInputElement;
}

describe('Sección III — Total ingresos mensuales nunca es NaN', () => {
  it('REGRESIÓN: 1.234,56 (coma decimal) suma correctamente, sin NaN', () => {
    montarSeccion();
    const campo = campoIngresoPrincipal();

    act(() => {
      fireEvent.change(campo, { target: { value: '1234,56' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
    expect(totalIngresosEnPantalla()).toContain('1.235');
  });

  it('REGRESIÓN: un monto >= 1.000.000 (2+ grupos de miles) no da NaN', () => {
    montarSeccion();
    const campo = campoIngresoPrincipal();

    act(() => {
      fireEvent.change(campo, { target: { value: '1500000' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
    expect(totalIngresosEnPantalla()).toContain('1.500.000');
  });

  it('"1500," (coma recién puesta, decimal incompleto) no da NaN', () => {
    montarSeccion();
    const campo = campoIngresoPrincipal();

    act(() => {
      fireEvent.change(campo, { target: { value: '1500,' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
  });

  it('escribir y borrar no deja el total dañado', () => {
    montarSeccion();
    const campo = campoIngresoPrincipal();

    act(() => {
      fireEvent.change(campo, { target: { value: '1234,56' } });
    });
    expect(totalIngresosEnPantalla()).not.toContain('NaN');

    act(() => {
      fireEvent.change(campo, { target: { value: '' } });
    });

    expect(totalIngresosEnPantalla()).not.toContain('NaN');
    expect(totalIngresosEnPantalla()).toContain('0');
  });

  it('escritura dígito por dígito nunca pasa por NaN, ni al final', () => {
    montarSeccion();
    const campo = campoIngresoPrincipal();
    const secuencia = ['1', '12', '123', '1234', '1234,', '1234,5', '1234,56'];

    for (const parcial of secuencia) {
      act(() => {
        fireEvent.change(campo, { target: { value: parcial } });
      });
      expect(totalIngresosEnPantalla()).not.toContain('NaN');
    }

    expect(totalIngresosEnPantalla()).toContain('1.235');
  });
});
