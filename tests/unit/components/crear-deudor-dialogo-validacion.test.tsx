/**
 * @jest-environment jsdom
 */
/**
 * Diálogo "Crear Nuevo Deudor" del asistente de casos
 * (`create-case-dialog/create-debtor-dialog.tsx`).
 *
 * Lo que se veía en producción: con la dirección vacía (o autocompletada sin
 * que el formulario se enterara), el servidor rechazaba el alta y la alerta
 * mostraba el JSON del error de Zod. Este archivo fija:
 *  - que la dirección vacía se bloquea en el cliente, bajo su campo;
 *  - que un error por campo del servidor sale bajo ese campo;
 *  - que la alerta muestra texto, nunca el JSON;
 *  - que un valor puesto por el autocompletado sin eventos llega al envío.
 */
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) => (open ? <div>{children}</div> : null),
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: Pass,
    DialogClose: Pass,
  };
});

import {
  CreateDebtorDialog,
  type ErrorAlCrearDeudor,
} from '@/app/cases/components/create-case-dialog/create-debtor-dialog';

const VALIDOS = {
  newDebtorName: 'Ana Pérez Gómez',
  newDebtorId: '1234567',
  newDebtorEmail: 'ana@example.com',
  newDebtorPhone: '3001234567',
  newDebtorAddress: 'Calle 45 #12-34',
};

function montar(
  onSubmit: jest.Mock<Promise<ErrorAlCrearDeudor | null>> = jest
    .fn()
    .mockResolvedValue(null),
) {
  render(
    <CreateDebtorDialog
      open
      onOpenChange={() => {}}
      creatingDebtor={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

function escribir(campos: Partial<typeof VALIDOS>) {
  for (const [id, valor] of Object.entries(campos)) {
    fireEvent.change(document.getElementById(id)!, {
      target: { value: valor },
    });
  }
}

async function enviar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Crear Deudor' }));
  });
}

/** El mensaje de error que está en el mismo bloque que el campo. */
function errorBajo(id: string): string | null {
  const bloque = document.getElementById(id)!.closest('.space-y-1\\.5')!;
  return bloque.querySelector('p.text-red-500')?.textContent ?? null;
}

describe('Crear Nuevo Deudor: validación', () => {
  it('la dirección vacía se bloquea en el cliente, con el mensaje bajo el campo', async () => {
    const onSubmit = montar();
    escribir({ ...VALIDOS, newDebtorAddress: '' });

    await enviar();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorBajo('newDebtorAddress')).toBe('La dirección es requerida');
  });

  it('ciudad y departamento también son obligatorios, con el mensaje del servidor', async () => {
    const onSubmit = montar();
    escribir(VALIDOS);
    fireEvent.change(document.getElementById('newDebtorCity')!, {
      target: { value: '' },
    });
    fireEvent.change(document.getElementById('newDebtorDept')!, {
      target: { value: '' },
    });

    await enviar();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorBajo('newDebtorCity')).toBe('La ciudad es requerida');
    expect(errorBajo('newDebtorDept')).toBe('El departamento es requerido');
  });

  it('un error por campo que devuelve el servidor sale bajo ese campo, no en la alerta', async () => {
    montar(
      jest.fn().mockResolvedValue({
        error: 'Ingrese un email válido',
        fieldErrors: { email: 'Ingrese un email válido' },
      }),
    );
    escribir(VALIDOS);

    await enviar();

    await waitFor(() =>
      expect(errorBajo('newDebtorEmail')).toBe('Ingrese un email válido'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un error sin campo del formulario va a la alerta como texto, nunca como JSON', async () => {
    montar(
      jest.fn().mockResolvedValue({
        error: 'La ocupación es requerida',
        fieldErrors: { occupation: 'La ocupación es requerida' },
      }),
    );
    escribir(VALIDOS);

    await enviar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('La ocupación es requerida');
    expect(alerta.textContent).not.toMatch(/"code"|"origin"|too_small|\[/);
  });

  it('un valor puesto por el autocompletado sin eventos llega al envío', async () => {
    const onSubmit = montar();
    escribir({ ...VALIDOS, newDebtorAddress: '' });
    // El autocompletado rellena el campo sin disparar `input`/`change`: el
    // valor está en el DOM y react-hook-form no se entera.
    (document.getElementById('newDebtorAddress') as HTMLInputElement).value =
      'Carrera 7 #71-21';

    await enviar();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      address: 'Carrera 7 #71-21',
      city: 'Bogotá',
      department: 'Cundinamarca',
    });
    expect(errorBajo('newDebtorAddress')).toBeNull();
  });

  it('ningún campo pide autocompletar: son datos del deudor, no del operador', () => {
    montar();
    const campos = [
      'newDebtorName',
      'newDebtorId',
      'newDebtorEmail',
      'newDebtorPhone',
      'newDebtorAddress',
      'newDebtorCity',
      'newDebtorDept',
    ];
    for (const id of campos) {
      expect(document.getElementById(id)!.getAttribute('autocomplete')).toBe(
        'off',
      );
    }
  });
});
