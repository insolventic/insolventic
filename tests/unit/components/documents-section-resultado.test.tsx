/**
 * @jest-environment jsdom
 */
/**
 * Gestión de Casos → "Generar Documentos por Etapa": el aviso cuenta éxitos y
 * fallos por separado.
 *
 * En producción, con todas las plantillas caídas, "Regenerar" de la etapa 1
 * avisaba "Se generaron 6 documentos iniciales" (5 errores + el Excel): el
 * aviso usaba `documents.length`. El error quedaba solo en el servidor y en
 * Drive aparecía únicamente el consolidado.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};
jest.mock('sonner', () => ({ toast: mockToast }));

const mockGenerateInitial = jest.fn();
jest.mock('@/features/document/actions-generation', () => ({
  generateInitialDocuments: (...args: unknown[]) =>
    mockGenerateInitial(...args),
  generateAdmissionDocuments: jest.fn(),
  generateAgreementDocuments: jest.fn(),
  generateFailureDocuments: jest.fn(),
}));

jest.mock(
  '@/app/cases/components/case-details-dialog/pre-generation-form',
  () => ({ PreGenerationForm: () => null }),
);

import { DocumentsSection } from '@/app/cases/components/case-details-dialog/documents-section';

const CASO = {
  id: 'case-3',
  caseNumber: 'INSOL-000003',
  phase: 'Inicial',
  driveFolderId: 'folder-v1',
  documents: [],
} as never;

const ok = (templateName: string) => ({
  templateId: templateName,
  templateName,
  fileName: `${templateName}.pdf`,
  googleDriveId: 'f',
  googleDriveUrl: 'https://drive.example/f',
  status: 'success' as const,
});
const fallo = (templateName: string) => ({
  templateId: templateName,
  templateName,
  fileName: '',
  googleDriveId: '',
  googleDriveUrl: '',
  status: 'error' as const,
  error: `La plantilla "${templateName}" no está disponible en el servidor (ENOENT)`,
});

async function regenerarEtapa1(documents: unknown[]) {
  mockGenerateInitial.mockResolvedValue({
    success: true,
    data: { caseFolderId: 'folder-v1', caseFolderUrl: '', documents },
  });
  render(<DocumentsSection caseData={CASO} onDocumentsGenerated={jest.fn()} />);
  fireEvent.click(screen.getByText('Regenerar'));
  await waitFor(() => expect(mockGenerateInitial).toHaveBeenCalled());
}

describe('DocumentsSection (detalle del caso) — aviso del resultado', () => {
  beforeEach(() => jest.clearAllMocks());

  it('solo el Excel generado y las plantillas caídas: es un aviso parcial, no un éxito', async () => {
    await regenerarEtapa1([
      fallo('Solicitud de Insolvencia'),
      fallo('Check List'),
      fallo('Certificado de Ingresos'),
      fallo('Declaracion Juramentada Domicilio'),
      fallo('Hoja Guia'),
      ok('Consolidado Excel'),
    ]);

    await waitFor(() => expect(mockToast.warning).toHaveBeenCalled());
    expect(mockToast.success).not.toHaveBeenCalled();

    const [titulo, opciones] = mockToast.warning.mock.calls[0];
    expect(titulo).toBe('Se generaron 1 de 6 documentos iniciales');

    // La descripción nombra lo que falló y por qué.
    render(<>{opciones.description}</>);
    expect(screen.getByText(/5 con error/)).toBeInTheDocument();
    expect(
      screen.getByText(/Solicitud de Insolvencia: La plantilla/),
    ).toBeInTheDocument();
    expect(screen.getByText(/…y 2 más/)).toBeInTheDocument();
  });

  it('nada generado: aviso de error', async () => {
    await regenerarEtapa1([fallo('Solicitud de Insolvencia')]);

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockToast.error.mock.calls[0][0]).toBe(
      'No se generó ningún documento (1 documentos iniciales)',
    );
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('todo generado: aviso de éxito con la cuenta real', async () => {
    await regenerarEtapa1([ok('Solicitud de Insolvencia'), ok('Check List')]);

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Se generaron 2 documentos iniciales',
        undefined,
      ),
    );
  });
});
