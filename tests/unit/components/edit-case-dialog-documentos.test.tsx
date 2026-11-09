/**
 * @jest-environment jsdom
 */

/**
 * Editar un caso con documentos adjuntos: el usuario se entera de lo que no subió.
 *
 * Antes el resultado de la subida se ignoraba y había un `catch {}`: ante un
 * fallo solo se veía "Caso actualizado exitosamente". Además la selección
 * sobrevivía al cierre, así que cancelar y reabrir subía lo elegido antes.
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};
jest.mock('sonner', () => ({ toast: mockToast }));

const mockUpdateCase = jest.fn();
const mockGetCaseById = jest.fn();
jest.mock('@/features/case/actions', () => ({
  updateCase: (...a: unknown[]) => mockUpdateCase(...a),
  getCaseById: (...a: unknown[]) => mockGetCaseById(...a),
}));
const mockUploadCaseDocument = jest.fn();
jest.mock('@/features/document/actions', () => ({
  uploadCaseDocument: (...a: unknown[]) => mockUploadCaseDocument(...a),
}));
jest.mock('@/features/creditor/actions', () => ({
  getAllCreditors: jest.fn().mockResolvedValue({ success: true, data: [] }),
}));
jest.mock('@/features/debtor/actions', () => ({
  getAllDebtors: jest.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'deudor-1',
        name: 'Ana Martínez López',
        idNumber: '41234567',
        email: 'ana@example.com',
        phone: '3001234567',
        address: 'Calle 1',
        city: 'Bogotá',
        department: 'Cundinamarca',
        monthlyIncome: 0,
        monthlyExpenses: 0,
      },
    ],
  }),
  createDebtor: jest.fn(),
}));
jest.mock('@/features/user/actions', () => ({
  getAssignableOperators: jest.fn().mockResolvedValue({
    success: true,
    data: [{ id: 'operador-1', name: 'Olga Operadora', roleName: 'Operadora' }],
  }),
}));

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
    }) => (open ? <div data-testid="dialog">{children}</div> : null),
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollTo = function scrollTo() {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

import { EditCaseDialog } from '@/app/cases/components/edit-case-dialog';
import type { CaseListItem } from '@/features/case/schemas';

const CASO = {
  id: 'caso-1',
  debtorId: 'deudor-1',
  debtorName: 'Ana Martínez López',
  type: 'Insolvencia',
  totalDebt: 1000000,
  creditors: 1,
  operatorId: 'operador-1',
  causes: [],
} as unknown as CaseListItem;

const CASO_COMPLETO = {
  ...CASO,
  version: 1,
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
  monthlyIncome: 0,
  monthlyExpenses: 0,
};

function pdf(nombre: string): File {
  return new File(['%PDF'], nombre, { type: 'application/pdf' });
}

/** Abre la pestaña de documentos, sin esperar a que el usuario pase por las demás. */
async function irADocumentos() {
  const pestana = await screen.findByRole('tab', { name: /Documentos/ });
  await act(async () => {
    fireEvent.mouseDown(pestana, { button: 0 });
  });
  await waitFor(() =>
    expect(
      document.querySelectorAll('input[type="file"]').length,
    ).toBeGreaterThan(1),
  );
}

async function adjuntar(indice: number, archivo: File) {
  const input =
    document.querySelectorAll<HTMLInputElement>('input[type="file"]')[indice];
  await act(async () => {
    fireEvent.change(input, { target: { files: [archivo] } });
  });
}

async function guardar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCaseById.mockResolvedValue({ success: true, data: CASO_COMPLETO });
  mockUpdateCase.mockResolvedValue({ success: true });
  mockUploadCaseDocument.mockResolvedValue({ success: true });
});

describe('EditCaseDialog — documentos adjuntos', () => {
  it('sube cada archivo en su propia llamada y lo dice en un solo aviso', async () => {
    const onOpenChange = jest.fn();
    render(
      <EditCaseDialog
        open
        onOpenChange={onOpenChange}
        case={CASO}
        onCaseUpdated={() => {}}
      />,
    );
    await irADocumentos();
    await adjuntar(0, pdf('cedula.pdf'));
    await adjuntar(1, pdf('redam.pdf'));

    await guardar();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockUpdateCase).toHaveBeenCalledTimes(1);
    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(2);
    for (const [arg] of mockUploadCaseDocument.mock.calls) {
      expect(arg.caseId).toBe('caso-1');
      expect(arg.file).toBeInstanceOf(File);
    }
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith(
      'Caso actualizado y 2 documento(s) subido(s) exitosamente',
    );
  });

  it('si uno falla, sube los demás y dice cuál falló y por qué, sin anunciar éxito', async () => {
    mockUploadCaseDocument
      .mockResolvedValueOnce({
        success: false,
        error: 'No se pudo guardar el archivo.',
      })
      .mockResolvedValueOnce({ success: true });
    const onCaseUpdated = jest.fn();
    render(
      <EditCaseDialog
        open
        onOpenChange={() => {}}
        case={CASO}
        onCaseUpdated={onCaseUpdated}
      />,
    );
    await irADocumentos();
    await adjuntar(0, pdf('cedula.pdf'));
    await adjuntar(1, pdf('redam.pdf'));

    await guardar();

    await waitFor(() => expect(mockToast.warning).toHaveBeenCalled());
    expect(mockUploadCaseDocument).toHaveBeenCalledTimes(2);
    expect(mockToast.success).not.toHaveBeenCalled();
    const [titulo, opciones] = mockToast.warning.mock.calls[0];
    expect(titulo).toBe(
      'Caso actualizado, pero 1 de 2 documentos no se subieron',
    );
    render(<>{opciones.description}</>);
    expect(screen.getByText(/cedula\.pdf/)).toHaveTextContent(
      'cedula.pdf: No se pudo guardar el archivo.',
    );
    await waitFor(() => expect(onCaseUpdated).toHaveBeenCalled());
  });

  it('sin archivos no llama a la subida y conserva el aviso de siempre', async () => {
    render(
      <EditCaseDialog
        open
        onOpenChange={() => {}}
        case={CASO}
        onCaseUpdated={() => {}}
      />,
    );
    await screen.findByRole('tab', { name: /Documentos/ });
    await waitFor(() => expect(mockGetCaseById).toHaveBeenCalled());

    await guardar();

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Caso actualizado exitosamente',
      ),
    );
    expect(mockUploadCaseDocument).not.toHaveBeenCalled();
  });

  it('cancelar y reabrir no sube lo que se había elegido', async () => {
    const props = {
      onOpenChange: () => {},
      case: CASO,
      onCaseUpdated: () => {},
    };
    const { rerender } = render(<EditCaseDialog open {...props} />);
    await irADocumentos();
    await adjuntar(0, pdf('cedula.pdf'));

    rerender(<EditCaseDialog open={false} {...props} />);
    rerender(<EditCaseDialog open {...props} />);
    await screen.findByRole('tab', { name: /Documentos/ });

    await guardar();

    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    expect(mockUploadCaseDocument).not.toHaveBeenCalled();
  });
});
