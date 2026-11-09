/**
 * @jest-environment jsdom
 */

/**
 * Subida desde el navegador: un archivo por llamada, y un fallo no se lleva a
 * los demás.
 *
 * Antes iban todos juntos en una sola llamada: si no cabían en el cuerpo, no
 * subía ninguno y el usuario solo veía "hubo un error al subir documentos".
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockUploadCaseDocument = jest.fn();
jest.mock('@/features/document/actions', () => ({
  uploadCaseDocument: (...a: unknown[]) => mockUploadCaseDocument(...a),
}));

const mockToast = { success: jest.fn(), warning: jest.fn() };
jest.mock('sonner', () => ({ toast: mockToast }));

import {
  avisarResultadoDeSubida,
  subirDocumentosDelCaso,
} from '@/app/cases/components/create-case-dialog/subir-documentos';

const CUATRO_MB = 4 * 1024 * 1024;

function pdf(nombre: string, tamano = 4): File {
  const archivo = new File(['%PDF'], nombre, { type: 'application/pdf' });
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}

const SELECCION = [
  { docName: 'Cédula', files: [pdf('cedula.pdf')] },
  { docName: 'Bienes', files: [pdf('bien-1.pdf'), pdf('bien-2.pdf')] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUploadCaseDocument.mockResolvedValue({ success: true });
});

describe('subirDocumentosDelCaso', () => {
  it('hace una llamada por archivo, con el File y su documento', async () => {
    const resultado = await subirDocumentosDelCaso('caso-1', SELECCION);

    expect(resultado).toEqual({ subidos: 3, fallos: [] });
    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(3);
    const [primero, , tercero] = mockUploadCaseDocument.mock.calls.map(
      ([arg]) => arg,
    );
    expect(primero).toEqual({
      caseId: 'caso-1',
      docName: 'Cédula',
      file: SELECCION[0].files[0],
    });
    expect(tercero.docName).toBe('Bienes');
    expect(tercero.file.name).toBe('bien-2.pdf');
  });

  it('el total del caso no está limitado: varios archivos de 4 MB van cada uno por su lado', async () => {
    const seleccion = [
      {
        docName: 'Bienes',
        files: [1, 2, 3, 4].map((i) => pdf(`bien-${i}.pdf`, CUATRO_MB)),
      },
    ];

    const resultado = await subirDocumentosDelCaso('caso-1', seleccion);

    expect(resultado).toEqual({ subidos: 4, fallos: [] });
    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(4);
  });

  it('sube de a uno: no empieza un archivo hasta que terminó el anterior', async () => {
    let enCurso = 0;
    let maximo = 0;
    mockUploadCaseDocument.mockImplementation(async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 1));
      enCurso--;
      return { success: true };
    });

    await subirDocumentosDelCaso('caso-1', SELECCION);

    expect(maximo).toBe(1);
  });

  it('si uno falla, los demás se suben igual y se dice cuál falló y por qué', async () => {
    mockUploadCaseDocument
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: false,
        error: 'No se pudo guardar el archivo.',
      })
      .mockResolvedValueOnce({ success: true });

    const resultado = await subirDocumentosDelCaso('caso-1', SELECCION);

    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(3);
    expect(resultado).toEqual({
      subidos: 2,
      fallos: [
        { fileName: 'bien-1.pdf', motivo: 'No se pudo guardar el archivo.' },
      ],
    });
  });

  it('un corte de red no se lleva a los demás y se explica como conexión', async () => {
    mockUploadCaseDocument
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ success: true });

    const resultado = await subirDocumentosDelCaso('caso-1', SELECCION);

    expect(resultado.subidos).toBe(2);
    expect(resultado.fallos).toEqual([
      {
        fileName: 'cedula.pdf',
        motivo:
          'No se pudo enviar el archivo. Revisa tu conexión e inténtalo de nuevo.',
      },
    ]);
  });

  it('el 413 de la plataforma (error genérico de Next) se explica con el mensaje de tamaño', async () => {
    // Se salta la validación del cliente: `size` miente, los bytes no.
    const grande = new File(
      [new Uint8Array(CUATRO_MB + 300_000)],
      'escritura.pdf',
      {
        type: 'application/pdf',
      },
    );
    Object.defineProperty(grande, 'size', { value: 1 });
    mockUploadCaseDocument
      .mockRejectedValueOnce(
        new Error('An unexpected response was received from the server.'),
      )
      .mockResolvedValue({ success: true });

    const resultado = await subirDocumentosDelCaso('caso-1', [
      { docName: 'Escritura', files: [grande] },
      { docName: 'REDAM', files: [pdf('redam.pdf')] },
    ]);

    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(2);
    expect(resultado.subidos).toBe(1);
    expect(resultado.fallos).toHaveLength(1);
    expect(resultado.fallos[0].fileName).toBe('escritura.pdf');
    expect(resultado.fallos[0].motivo).toBe(
      'El archivo pesa 4,3 MB y el máximo es 4 MB. Comprime el PDF o reduce la foto y vuelve a adjuntarlo.',
    );
  });

  it('un "Body exceeded" con un archivo que cabe también se explica por tamaño, no como error técnico', async () => {
    mockUploadCaseDocument.mockRejectedValueOnce(
      new Error('Body exceeded 4.25mb limit.'),
    );

    const resultado = await subirDocumentosDelCaso('caso-1', [
      { docName: 'Cédula', files: [pdf('cedula.pdf')] },
    ]);

    expect(resultado.fallos[0].motivo).toMatch(/hasta 4 MB/);
    expect(resultado.fallos[0].motivo).not.toMatch(/Body exceeded/);
  });

  it('un archivo que no cabe no se envía: se reporta con el mensaje de tamaño', async () => {
    const resultado = await subirDocumentosDelCaso('caso-1', [
      { docName: 'Cédula', files: [pdf('grande.pdf', CUATRO_MB + 1)] },
      { docName: 'REDAM', files: [pdf('redam.pdf')] },
    ]);

    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(1);
    expect(mockUploadCaseDocument.mock.calls[0][0].docName).toBe('REDAM');
    expect(resultado.subidos).toBe(1);
    expect(resultado.fallos[0].fileName).toBe('grande.pdf');
    expect(resultado.fallos[0].motivo).toMatch(/el máximo es 4 MB/);
  });

  it('un archivo sin tipo declarado viaja con el de su extensión', async () => {
    const sinTipo = new File(['%PDF'], 'CEDULA.PDF', { type: '' });

    await subirDocumentosDelCaso('caso-1', [
      { docName: 'Cédula', files: [sinTipo] },
    ]);

    const { file } = mockUploadCaseDocument.mock.calls[0][0];
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('CEDULA.PDF');
  });
});

describe('avisarResultadoDeSubida', () => {
  it('sin fallos, un aviso de éxito con la cantidad', () => {
    avisarResultadoDeSubida('Caso creado', { subidos: 3, fallos: [] });

    expect(mockToast.success).toHaveBeenCalledWith(
      'Caso creado y 3 documento(s) subido(s) exitosamente',
    );
    expect(mockToast.warning).not.toHaveBeenCalled();
  });

  it('con fallos, el aviso no se va solo y nombra cada archivo con su motivo', () => {
    avisarResultadoDeSubida('Caso creado', {
      subidos: 1,
      fallos: [
        { fileName: 'redam.pdf', motivo: 'No se pudo guardar el archivo.' },
        { fileName: 'bien.pdf', motivo: 'El archivo pesa 5 MB.' },
      ],
    });

    expect(mockToast.success).not.toHaveBeenCalled();
    const [titulo, opciones] = mockToast.warning.mock.calls[0];
    expect(titulo).toBe('Caso creado, pero 2 de 3 documentos no se subieron');
    expect(opciones.duration).toBe(Infinity);

    render(<>{opciones.description}</>);
    expect(screen.getByText(/redam\.pdf/)).toHaveTextContent(
      'redam.pdf: No se pudo guardar el archivo.',
    );
    expect(screen.getByText(/bien\.pdf/)).toHaveTextContent(
      'bien.pdf: El archivo pesa 5 MB.',
    );
    expect(screen.getByText(/Editar/)).toBeInTheDocument();
  });
});
