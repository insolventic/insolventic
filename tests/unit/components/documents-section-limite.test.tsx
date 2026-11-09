/**
 * @jest-environment jsdom
 */

/**
 * Pestaña de documentos del caso: el límite se dice antes de elegir y un
 * archivo que no cabe se explica al elegirlo, sin esperar a "Crear Caso".
 *
 * Antes prometía 10 MB y dejaba pasar archivos que la server action no podía
 * recibir: el caso ya estaba creado cuando la subida fallaba.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a) },
}));

import { DocumentsSection } from '@/app/cases/components/create-case-dialog/documents-section';

const CUATRO_MB = 4 * 1024 * 1024;

/** Un File de ese tamaño sin reservar la memoria en cada test. */
function pdfDe(tamano: number, nombre: string): File {
  const archivo = new File(['x'], nombre, { type: 'application/pdf' });
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}

function primerInput(): HTMLInputElement {
  return document.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
}

async function elegir(...archivos: File[]) {
  await act(async () => {
    fireEvent.change(primerInput(), { target: { files: archivos } });
  });
}

describe('DocumentsSection — límite por archivo', () => {
  beforeEach(() => {
    mockToastError.mockClear();
  });

  it('dice el límite real antes de elegir', () => {
    render(<DocumentsSection />);

    expect(screen.getByText(/máx\. 4 MB por archivo/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/10 ?MB/);
  });

  it('acepta un archivo justo por debajo del límite', async () => {
    const onFilesSelected = jest.fn();
    render(<DocumentsSection onFilesSelected={onFilesSelected} />);

    await elegir(pdfDe(CUATRO_MB - 1, 'cedula.pdf'));

    expect(mockToastError).not.toHaveBeenCalled();
    expect(onFilesSelected).toHaveBeenLastCalledWith([
      expect.objectContaining({
        docKey: 'cedula',
        files: [expect.objectContaining({ name: 'cedula.pdf' })],
      }),
    ]);
  });

  it('acepta un archivo exactamente en el límite', async () => {
    render(<DocumentsSection />);

    await elegir(pdfDe(CUATRO_MB, 'cedula.pdf'));

    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.getByText(/1 archivo\(s\)/)).toBeInTheDocument();
  });

  it('rechaza uno por encima al elegirlo: nombra el archivo, el límite y qué hacer', async () => {
    const onFilesSelected = jest.fn();
    render(<DocumentsSection onFilesSelected={onFilesSelected} />);

    await elegir(pdfDe(CUATRO_MB + 1, 'escaneado.pdf'));

    expect(mockToastError).toHaveBeenCalledTimes(1);
    const mensaje = mockToastError.mock.calls[0][0];
    expect(mensaje).toMatch(/escaneado\.pdf/);
    expect(mensaje).toMatch(/el máximo es 4 MB/);
    expect(mensaje).toMatch(/Comprime el PDF o reduce la foto/);
    expect(onFilesSelected).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText(/1 archivo\(s\)/)).toBeNull();
  });

  it('de varios elegidos, conserva los que caben y avisa por cada uno que no', async () => {
    render(<DocumentsSection />);

    await elegir(
      pdfDe(1024, 'chico.pdf'),
      pdfDe(CUATRO_MB + 1, 'grande-1.pdf'),
      pdfDe(CUATRO_MB + 1, 'grande-2.pdf'),
    );

    expect(mockToastError).toHaveBeenCalledTimes(2);
    expect(mockToastError.mock.calls[0][0]).toMatch(/grande-1\.pdf/);
    expect(mockToastError.mock.calls[1][0]).toMatch(/grande-2\.pdf/);
    expect(screen.getByText(/1 archivo\(s\)/)).toBeInTheDocument();
  });

  it('vacía el input para que volver a elegir el mismo archivo dispare el cambio', async () => {
    render(<DocumentsSection />);
    const input = primerInput();
    const valor = jest.fn();
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => 'C:\\fakepath\\escaneado.pdf',
      set: valor,
    });

    await elegir(pdfDe(CUATRO_MB + 1, 'escaneado.pdf'));

    expect(valor).toHaveBeenCalledWith('');
  });
});
