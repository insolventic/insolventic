/**
 * @jest-environment jsdom
 */

/**
 * Pestaña "7. Documentos": los obligatorios no se pintan en rojo al entrar.
 *
 * Regla de producto: los errores se muestran solo después de una acción del
 * usuario. Antes, apenas se abría la pestaña, cada documento obligatorio
 * salía con borde rojo e ícono de alerta, y el título "Documentos
 * Obligatorios" en rojo. Ahora al entrar llevan una etiqueta neutra
 * "Obligatorio"; el rojo lo prende el wizard (`mostrarFaltantes`) tras
 * intentar "Crear Caso" o al salir de la pestaña con documentos faltantes.
 *
 * El componente se prueba solo; el cableado con el wizard está en
 * `create-case-dialog-errores.test.tsx`.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

import { DocumentsSection } from '@/app/cases/components/create-case-dialog/documents-section';

/** Filas de documento marcadas como faltantes (borde rojo + ícono). */
function filasFaltantes(): Element[] {
  return Array.from(document.querySelectorAll('[data-falta]'));
}

function pdf(nombre: string): File {
  return new File(['%PDF'], nombre, { type: 'application/pdf' });
}

describe('DocumentsSection — obligatorios', () => {
  it('al entrar: etiqueta neutra "Obligatorio", sin rojo ni íconos de alerta', () => {
    render(<DocumentsSection />);

    expect(screen.getAllByText('Obligatorio')).toHaveLength(3);
    expect(filasFaltantes()).toHaveLength(0);
    expect(screen.queryByLabelText('Falta este documento')).toBeNull();
    expect(screen.getByText('Documentos Obligatorios')).not.toHaveClass(
      'text-red-700',
    );
  });

  it('con mostrarFaltantes, los obligatorios sin archivo se pintan en rojo', () => {
    render(<DocumentsSection mostrarFaltantes />);

    expect(filasFaltantes()).toHaveLength(3);
    expect(screen.getAllByLabelText('Falta este documento')).toHaveLength(3);
    expect(screen.queryByText('Obligatorio')).toBeNull();
    for (const fila of filasFaltantes()) {
      expect(fila).toHaveClass('border-red-300');
    }
  });

  it('un obligatorio cargado deja de faltar, aunque mostrarFaltantes esté activo', async () => {
    const onFilesSelected = jest.fn();
    render(
      <DocumentsSection mostrarFaltantes onFilesSelected={onFilesSelected} />,
    );

    const primerInput =
      document.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
    await act(async () => {
      fireEvent.change(primerInput, { target: { files: [pdf('cedula.pdf')] } });
    });

    expect(filasFaltantes()).toHaveLength(2);
    expect(screen.getByText(/1 archivo\(s\)/)).toBeInTheDocument();
    expect(onFilesSelected).toHaveBeenLastCalledWith([
      expect.objectContaining({ docKey: 'cedula' }),
    ]);
  });

  it('arranca con la selección que guarda el wizard (la pestaña se desmonta al salir)', () => {
    render(
      <DocumentsSection
        mostrarFaltantes
        seleccionActual={[{ docKey: 'cedula', files: [pdf('cedula.pdf')] }]}
      />,
    );

    expect(screen.getByText(/1 archivo\(s\)/)).toBeInTheDocument();
    expect(filasFaltantes()).toHaveLength(2);
  });
});
