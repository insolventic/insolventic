/**
 * @jest-environment jsdom
 */

/**
 * Quitar un proceso judicial en la edición: una fila guardada anota su id en
 * `legalProcessesEliminados`; si el caso tiene documentos que lo citan, antes
 * se confirma nombrando el juzgado y el id va también a
 * `legalProcessesEliminacionConfirmada`. Una fila nueva se quita sin más.
 */
import { useEffect } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LegalProcessesSection } from '@/app/cases/components/create-case-dialog/legal-processes-section';

type Valores = {
  legalProcesses: Array<Record<string, string>>;
  legalProcessesEliminados: string[];
  legalProcessesEliminacionConfirmada: string[];
};

let formulario: UseFormReturn<Valores> | null = null;

function Host({ confirmar }: { confirmar: boolean }) {
  const form = useForm<Valores>({
    defaultValues: {
      legalProcesses: [
        {
          id: 'lp-1',
          processType: 'EJECUTIVO_SINGULAR',
          plaintiff: 'Banco X',
          court: 'Juzgado 5 Civil Municipal',
          fileNumber: '1',
        },
        {
          processType: 'EJECUTIVO_SINGULAR',
          plaintiff: 'Banco Y',
          court: 'Juzgado nuevo',
          fileNumber: '2',
        },
      ],
      legalProcessesEliminados: [],
      legalProcessesEliminacionConfirmada: [],
    },
  });
  useEffect(() => {
    formulario = form;
  }, [form]);
  return (
    <FormProvider {...form}>
      <LegalProcessesSection confirmarAlQuitar={confirmar} />
    </FormProvider>
  );
}

const valores = () => formulario!.getValues();

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe('quitar procesos judiciales', () => {
  it('fila guardada, sin documentos: se quita y anota su id', () => {
    render(<Host confirmar={false} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Quitar proceso 1' }));
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(valores().legalProcesses).toHaveLength(1);
    expect(valores().legalProcessesEliminados).toEqual(['lp-1']);
    expect(valores().legalProcessesEliminacionConfirmada).toEqual([]);
  });

  it('fila nueva: se quita sin anotar nada', () => {
    render(<Host confirmar />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Quitar proceso 2' }));
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(valores().legalProcesses).toHaveLength(1);
    expect(valores().legalProcessesEliminados).toEqual([]);
  });

  it('con documentos: pide confirmación nombrando el juzgado; "Cancelar" no quita nada', () => {
    render(<Host confirmar />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Quitar proceso 1' }));
    });
    const dialogo = screen.getByRole('alertdialog', {
      name: '¿Quitar este proceso judicial?',
    });
    expect(dialogo).toHaveTextContent('Juzgado 5 Civil Municipal');
    expect(dialogo).toHaveTextContent(/regenerarlos y reenviarlos/);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    });
    expect(valores().legalProcesses).toHaveLength(2);
    expect(valores().legalProcessesEliminados).toEqual([]);
  });

  it('con documentos y confirmado: quita y anota el id en las dos listas', () => {
    render(<Host confirmar />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Quitar proceso 1' }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Quitar proceso' }));
    });
    expect(valores().legalProcesses).toHaveLength(1);
    expect(valores().legalProcessesEliminados).toEqual(['lp-1']);
    expect(valores().legalProcessesEliminacionConfirmada).toEqual(['lp-1']);
  });
});
