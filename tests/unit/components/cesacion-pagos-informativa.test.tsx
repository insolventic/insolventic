/**
 * @jest-environment jsdom
 */

/**
 * Sección IV — con "cesación de pagos" en Sí, los tres valores calculados se
 * muestran como información (lista de descripción), no como campos: sin
 * inputs ni aspecto de campo deshabilitado. Sin acreedores, un mensaje claro
 * en lugar de ceros. Los cambios se anuncian (aria-live).
 */
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { CesacionPagosSection } from '@/app/cases/components/create-case-dialog/cesacion-pagos-section';

type Deuda = { capitalAmount: string; daysOverdue?: number };

let setDeudas: ((d: Deuda[]) => void) | null = null;

function Host({
  deudas,
  cesacion = true,
}: {
  deudas: Deuda[];
  cesacion?: boolean;
}) {
  const form = useForm({
    defaultValues: { cesacionPagos: cesacion, debts: deudas } as never,
  });
  useEffect(() => {
    setDeudas = (d) => form.setValue('debts' as never, d as never);
  }, [form]);
  return (
    <FormProvider {...form}>
      <CesacionPagosSection />
    </FormProvider>
  );
}

const nb = (t: string | null) => (t ?? '').replace(/ /g, ' ');

describe('Cesación de pagos — datos calculados', () => {
  it('con "No" no muestra el bloque', () => {
    render(<Host deudas={[]} cesacion={false} />);
    expect(
      screen.queryByRole('region', {
        name: 'Datos calculados de los acreedores',
      }),
    ).not.toBeInTheDocument();
  });

  it('sin acreedores muestra un mensaje amable, no ceros', () => {
    render(<Host deudas={[]} />);
    const bloque = screen.getByRole('region', {
      name: 'Datos calculados de los acreedores',
    });
    expect(
      within(bloque).getByText(
        'Aún no hay acreedores registrados; estos valores se calcularán automáticamente.',
      ),
    ).toBeInTheDocument();
    expect(within(bloque).queryByText(/^0/)).not.toBeInTheDocument();
    expect(within(bloque).queryByText(/\$\s?0/)).not.toBeInTheDocument();
  });

  it('con acreedores: lista de descripción, sin inputs', () => {
    render(
      <Host
        deudas={[
          { capitalAmount: '1.000.000', daysOverdue: 120 },
          { capitalAmount: '3.000.000', daysOverdue: 0 },
        ]}
      />,
    );
    const bloque = screen.getByRole('region', {
      name: 'Datos calculados de los acreedores',
    });
    expect(within(bloque).queryAllByRole('textbox')).toHaveLength(0);
    expect(bloque.querySelectorAll('input')).toHaveLength(0);

    const terminos = within(bloque)
      .getAllByRole('term')
      .map((t) => t.textContent);
    expect(terminos).toEqual([
      'Número de acreedores',
      'Pasivo en mora',
      'Total de la deuda registrada',
    ]);
    const valores = within(bloque)
      .getAllByRole('definition')
      .map((d) => nb(d.textContent));
    expect(valores).toContain('2');
    expect(valores).toContain('25 %');
    expect(valores).toContain('$ 4.000.000');
    expect(
      within(bloque).getByText(
        /Se calculan solos a partir de los acreedores registrados/,
      ),
    ).toBeInTheDocument();
  });

  it('los valores viven en una región que se anuncia al cambiar', () => {
    render(<Host deudas={[]} />);
    const viva = screen
      .getByRole('region', { name: 'Datos calculados de los acreedores' })
      .querySelector('[aria-live="polite"]');
    expect(viva).not.toBeNull();

    act(() => setDeudas?.([{ capitalAmount: '500.000', daysOverdue: 30 }]));
    expect(within(viva as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(nb(viva!.textContent)).toContain('100 %');
  });
});
