/**
 * @jest-environment jsdom
 */

/**
 * DialogBlindado: no cierra con clic fuera ni con Esc; la X y "Cancelar"
 * cierran directo si no hay cambios y piden confirmación si los hay; un Esc
 * dentro de un Select no cierra el diálogo; con cambios, se avisa antes de
 * cerrar la pestaña.
 */
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DialogBlindado,
  DialogContentBlindado,
  useCambiosSinGuardar,
} from '@/components/form-guard/dialogo-blindado';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Radix Select usa APIs de puntero que jsdom no trae.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

/** Contenido que declara cambios por contexto, como CreateCaseWizard. */
function Contenido({ conCambios }: { conCambios: boolean }) {
  useCambiosSinGuardar(conCambios);
  return (
    <>
      <Select>
        <SelectTrigger aria-label="Tipo">
          <SelectValue placeholder="Elegir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opción A</SelectItem>
        </SelectContent>
      </Select>
      <DialogClose asChild>
        <button type="button">Cancelar</button>
      </DialogClose>
    </>
  );
}

function Host({
  conCambios = false,
  porProp = false,
}: {
  conCambios?: boolean;
  porProp?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? 'abierto' : 'cerrado'}</p>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <DialogBlindado
        open={open}
        onOpenChange={setOpen}
        hayCambios={porProp ? conCambios : undefined}
      >
        <DialogContentBlindado>
          <DialogHeader>
            <DialogTitle>Formulario largo</DialogTitle>
            <DialogDescription>Descripción</DialogDescription>
          </DialogHeader>
          <Contenido conCambios={porProp ? false : conCambios} />
        </DialogContentBlindado>
      </DialogBlindado>
    </>
  );
}

const dialogo = () => screen.getByRole('dialog', { name: 'Formulario largo' });

describe('DialogBlindado', () => {
  it('no se cierra con Esc', () => {
    render(<Host />);
    fireEvent.keyDown(dialogo(), { key: 'Escape' });
    expect(screen.getByText('abierto')).toBeInTheDocument();
    expect(dialogo()).toBeInTheDocument();
  });

  it('no se cierra con clic fuera', () => {
    render(<Host />);
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
    fireEvent.pointerDown(overlay);
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    expect(screen.getByText('abierto')).toBeInTheDocument();
  });

  it('sin cambios, la X cierra directo', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('cerrado')).toBeInTheDocument();
  });

  it('sin cambios, "Cancelar" cierra directo', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('cerrado')).toBeInTheDocument();
  });

  it.each([
    ['la X', 'Close'],
    ['"Cancelar"', 'Cancelar'],
  ])('con cambios, %s pide confirmación', (_, boton) => {
    render(<Host conCambios />);
    fireEvent.click(screen.getByRole('button', { name: boton }));
    expect(
      screen.getByRole('alertdialog', { name: '¿Salir sin guardar?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('abierto')).toBeInTheDocument();
  });

  it('"Seguir editando" vuelve al formulario sin cerrar', () => {
    render(<Host conCambios />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const seguir = screen.getByRole('button', { name: 'Seguir editando' });
    expect(seguir).toHaveFocus();
    fireEvent.click(seguir);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('abierto')).toBeInTheDocument();
  });

  it('"Salir" cierra el formulario', () => {
    render(<Host conCambios />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByText('cerrado')).toBeInTheDocument();
  });

  it('los cambios también pueden declararse por prop', () => {
    render(<Host conCambios porProp />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('Esc dentro de un Select cierra el Select, no el diálogo', () => {
    render(<Host conCambios />);
    const trigger = screen.getByRole('combobox', { name: 'Tipo' });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const opcion = screen.queryByRole('option', { name: 'Opción A' });
    if (opcion) fireEvent.keyDown(opcion, { key: 'Escape' });
    else fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.getByText('abierto')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('con cambios, avisa antes de cerrar la pestaña; sin cambios, no', () => {
    const { unmount } = render(<Host conCambios />);
    const evento = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(evento);
    });
    expect(evento.defaultPrevented).toBe(true);
    unmount();

    render(<Host />);
    const otro = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(otro);
    });
    expect(otro.defaultPrevented).toBe(false);
  });
});
