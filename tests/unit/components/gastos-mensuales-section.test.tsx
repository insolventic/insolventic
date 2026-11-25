/**
 * @jest-environment jsdom
 */

/**
 * Bloque "Gastos mensuales" de la Sección III: total en vivo, prorrateo,
 * separadores de miles, errores solo después de salir del campo y la lista
 * dinámica de "Otros" (agregar, quitar y foco).
 */
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import { GastosMensualesSection } from '@/app/cases/components/create-case-dialog/gastos-mensuales-section';
import {
  MENSAJE_PESOS_ENTEROS,
  entradaGastosVacia,
  gastosMensualesEntradaSchema,
} from '@/features/case/gastos-mensuales';

const schema = z.object({ gastosMensuales: gastosMensualesEntradaSchema });

function montar(valores = entradaGastosVacia()) {
  function Host() {
    const form = useForm({
      resolver: zodResolver(schema),
      mode: 'onTouched',
      defaultValues: { gastosMensuales: valores },
    });
    return (
      <FormProvider {...form}>
        <form>
          <GastosMensualesSection />
        </form>
      </FormProvider>
    );
  }
  render(<Host />);
}

const total = () =>
  (screen.getByLabelText('Total gastos mensuales') as HTMLInputElement).value;
const campo = (etiqueta: string) =>
  screen.getByLabelText(etiqueta) as HTMLInputElement;
const escribir = (input: HTMLInputElement, valor: string) =>
  act(() => {
    fireEvent.change(input, { target: { value: valor } });
  });

// Intl de Node usa espacio duro entre "$" y el número.
const pesos = (texto: string) => texto.replace(/\s/g, ' ');

describe('GastosMensualesSection', () => {
  it('muestra los 20 conceptos agrupados, con label asociado a cada valor', () => {
    montar();
    for (const grupo of [
      'Vivienda y servicios',
      'Alimentación y hogar',
      'Salud y seguros',
      'Educación',
      'Familia',
      'Transporte',
      'Impuestos',
      'Otros gastos',
    ]) {
      expect(
        screen.getByText(grupo, { selector: 'legend' }),
      ).toBeInTheDocument();
    }
    expect(campo('Arriendo')).toBeInTheDocument();
    expect(campo('Administración (propiedad horizontal)')).toBeInTheDocument();
    expect(campo('Manutención padres')).toBeInTheDocument();
    expect(campo('Impuestos')).toBeInTheDocument();
  });

  it('el total se actualiza en vivo y formatea con separador de miles', () => {
    montar();
    escribir(campo('Arriendo'), '800000');
    expect(campo('Arriendo').value).toBe('800.000');
    escribir(campo('Alimentos'), '600000');
    expect(pesos(total())).toBe('$ 1.400.000');
  });

  it('prorratea impuestos (÷ 12) y muestra solo el equivalente mensual', () => {
    montar();
    escribir(campo('Impuestos'), '1200000');
    expect(
      pesos(screen.getByTestId('gasto-IMPUESTOS-mensual').textContent ?? ''),
    ).toContain('$ 100.000');
    expect(pesos(total())).toBe('$ 100.000');
  });

  it('matrícula universitaria se divide por 6', () => {
    const valores = entradaGastosVacia();
    valores.conceptos.MATRICULA = {
      valor: '1.200.000',
      periodicidad: 'UNIVERSIDAD',
    };
    montar(valores);
    expect(screen.getByTestId('gasto-MATRICULA-mensual').textContent).toContain(
      '÷ 6',
    );
    expect(pesos(total())).toBe('$ 200.000');
  });

  it('acepta "1,234,567" pegado y lo normaliza al salir', () => {
    montar();
    const arriendo = campo('Arriendo');
    escribir(arriendo, '1,234,567');
    act(() => {
      fireEvent.blur(arriendo);
    });
    expect(arriendo.value).toBe('1.234.567');
    expect(pesos(total())).toBe('$ 1.234.567');
  });

  it('un decimal real no se reinterpreta: da error "pesos enteros" solo después del blur', async () => {
    montar();
    const agua = campo('Agua');
    escribir(agua, '1500.50');
    expect(agua.value).toBe('1500.50');
    expect(screen.queryByText(MENSAJE_PESOS_ENTEROS)).not.toBeInTheDocument();

    act(() => {
      fireEvent.blur(agua);
    });
    expect(await screen.findByText(MENSAJE_PESOS_ENTEROS)).toBeInTheDocument();
    expect(agua).toHaveAttribute('aria-invalid', 'true');
    expect(agua.getAttribute('aria-describedby')).toContain('gasto-AGUA-error');
    // El total ignora lo inválido en vez de mostrar NaN.
    expect(total()).not.toContain('NaN');
  });

  it('rechaza negativos', async () => {
    montar();
    const luz = campo('Luz');
    escribir(luz, '-5000');
    act(() => {
      fireEvent.blur(luz);
    });
    expect(
      await screen.findByText('El valor no puede ser negativo'),
    ).toBeInTheDocument();
  });

  describe('Otros', () => {
    it('agregar una fila enfoca su concepto y suma su valor', async () => {
      montar();
      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: /Agregar otro gasto/ }),
        );
      });
      const concepto = await screen.findByLabelText('Concepto del gasto 1');
      await waitFor(() => expect(concepto).toHaveFocus());
      fireEvent.change(concepto, { target: { value: 'Gas' } });
      escribir(campo('Valor mensual del gasto 1'), '45000');
      expect(pesos(total())).toBe('$ 45.000');
    });

    it('exige concepto si hay valor (al salir del campo)', async () => {
      montar();
      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: /Agregar otro gasto/ }),
        );
      });
      const concepto = await screen.findByLabelText('Concepto del gasto 1');
      escribir(campo('Valor mensual del gasto 1'), '1000');
      act(() => {
        fireEvent.blur(concepto);
      });
      expect(
        await screen.findByText('Escriba el concepto del gasto'),
      ).toBeInTheDocument();
    });

    it('quitar una fila no pierde el foco y descuenta su valor', async () => {
      const valores = entradaGastosVacia();
      valores.otros = [
        { concepto: 'Gas', valor: '45.000' },
        { concepto: 'Cuota de manejo', valor: '12.000' },
      ];
      montar(valores);
      expect(pesos(total())).toBe('$ 57.000');

      const quitar = screen.getByRole('button', {
        name: 'Quitar gasto 1: Gas',
      });
      act(() => {
        quitar.focus();
        fireEvent.click(quitar);
      });
      await waitFor(() => expect(pesos(total())).toBe('$ 12.000'));
      await waitFor(() =>
        expect(
          screen.getByRole('button', {
            name: 'Quitar gasto 1: Cuota de manejo',
          }),
        ).toHaveFocus(),
      );

      act(() => {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'Quitar gasto 1: Cuota de manejo',
          }),
        );
      });
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Agregar otro gasto/ }),
        ).toHaveFocus(),
      );
      expect(pesos(total())).toBe('$ 0');
    });
  });

  it('ningún botón del bloque envía el formulario', () => {
    montar();
    for (const boton of screen.getAllByRole('button')) {
      if (boton.getAttribute('role') === 'combobox') continue;
      expect(boton).toHaveAttribute('type', 'button');
    }
  });
});
