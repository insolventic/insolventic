/**
 * @jest-environment jsdom
 */

/**
 * Bloque "Poder" de la pestaña de documentos: dos zonas de carga con su estado,
 * indicador Completo/Incompleto, rechazo de un archivo cuyo contenido no es el
 * que dice ser, y un poder ya subido como anexo único que cuenta como firmado.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a) },
}));

import { DocumentsSection } from '@/app/cases/components/create-case-dialog/documents-section';
import { NOMBRE_PODER_ANEXO_UNICO, PIEZAS_PODER } from '@/features/case/poder';
import { esperarLecturaDeArchivos } from '../../helpers/lectura-archivos';

const CON_PODER = [{ nombreCompleto: 'Ana Torres', existePoderOtorgado: true }];
const [CAPTURA, FIRMADO] = PIEZAS_PODER;

const pdf = (nombre: string) =>
  new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });
const png = (nombre: string) =>
  new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    nombre,
    {
      type: 'image/png',
    },
  );

async function elegir(zona: string, archivo: File) {
  const input = screen
    .getByTestId(`zona-${zona}`)
    .querySelector<HTMLInputElement>('input[type="file"]')!;
  await act(async () => {
    fireEvent.change(input, { target: { files: [archivo] } });
    await esperarLecturaDeArchivos();
  });
}

beforeEach(() => mockToastError.mockClear());

describe('bloque Poder', () => {
  it('muestra las dos zonas con su ayuda y empieza Incompleto', () => {
    render(<DocumentsSection hasAttorney apoderados={CON_PODER} />);
    const bloque = screen.getByRole('region', { name: 'Poder' });
    expect(within(bloque).getByText(CAPTURA.nombre)).toBeInTheDocument();
    expect(within(bloque).getByText(FIRMADO.nombre)).toBeInTheDocument();
    expect(within(bloque).getAllByText(/\[VALIDAR CON ABOGADO/)).toHaveLength(
      2,
    );
    expect(screen.getByTestId('estado-poder')).toHaveTextContent('Incompleto');
    // Cada zona tiene su botón con nombre accesible y su ayuda enlazada.
    const boton = screen.getByRole('button', {
      name: `Cargar ${CAPTURA.nombre}`,
    });
    expect(boton).toHaveAttribute('aria-describedby', `ayuda-${CAPTURA.id}`);
  });

  it('con una pieza sigue Incompleto; con las dos, Completo', async () => {
    const onFilesSelected = jest.fn();
    render(
      <DocumentsSection
        hasAttorney
        apoderados={CON_PODER}
        onFilesSelected={onFilesSelected}
      />,
    );
    await elegir(CAPTURA.id, png('captura.png'));
    expect(screen.getByTestId('estado-poder')).toHaveTextContent('Incompleto');
    expect(
      screen.getByText(/Listo para subir: captura\.png/),
    ).toBeInTheDocument();

    await elegir(FIRMADO.id, pdf('poder-firmado.pdf'));
    expect(screen.getByTestId('estado-poder')).toHaveTextContent('Completo');
    expect(onFilesSelected).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          docKey: CAPTURA.id,
          docName: CAPTURA.nombre,
        }),
        expect.objectContaining({
          docKey: FIRMADO.id,
          docName: FIRMADO.nombre,
        }),
      ]),
    );
  });

  it('rechaza un archivo cuyo contenido no es PDF/JPG/PNG aunque se llame .pdf', async () => {
    render(<DocumentsSection hasAttorney apoderados={CON_PODER} />);
    await elegir(
      FIRMADO.id,
      new File(['MZ ejecutable'], 'poder.pdf', { type: 'application/pdf' }),
    );
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringMatching(
        /poder\.pdf: el contenido no es un PDF, JPG o PNG válido/,
      ),
    );
    expect(screen.getByTestId('estado-poder')).toHaveTextContent('Incompleto');
    expect(
      within(screen.getByTestId(`zona-${FIRMADO.id}`)).getByText('Sin cargar'),
    ).toBeInTheDocument();
  });

  it('un poder ya subido como anexo único cuenta como firmado y se ve', () => {
    render(
      <DocumentsSection
        poderRequerido
        documentosCargados={[
          { name: NOMBRE_PODER_ANEXO_UNICO, url: 'https://drive/x' },
          { name: CAPTURA.nombre, url: 'https://drive/y' },
        ]}
      />,
    );
    expect(screen.getByTestId('estado-poder')).toHaveTextContent('Completo');
    expect(
      within(screen.getByTestId(`zona-${FIRMADO.id}`)).getByText(
        new RegExp(
          `Ya cargado en el caso: ${NOMBRE_PODER_ANEXO_UNICO.replace(/[()]/g, '\\$&')}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/anexo único \(formato anterior\)/),
    ).toBeInTheDocument();
  });

  it('con mostrarFaltantes y sin ninguna pieza, el bloque se marca como faltante', () => {
    render(
      <DocumentsSection hasAttorney apoderados={CON_PODER} mostrarFaltantes />,
    );
    expect(screen.getByRole('region', { name: 'Poder' })).toHaveAttribute(
      'data-falta',
      'true',
    );
    expect(
      screen.getByText('Cargue al menos una de las dos piezas del poder.'),
    ).toBeInTheDocument();
  });
});
