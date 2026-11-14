/**
 * @jest-environment jsdom
 */
/**
 * Editar un caso → "Crear nuevo deudor" sigue funcionando con el diálogo
 * corregido (create-case-dialog/create-debtor-dialog.tsx), que también se usa
 * desde aquí (edit-case-dialog.tsx). Con dirección y ciudad rellenas el alta
 * llega a `createDebtor`; un error por campo del servidor sale bajo su campo.
 *
 * El montaje (mocks de acciones y del Dialog) es el de
 * edit-case-dialog-documentos.test.tsx.
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

const mockCreateDebtor = jest.requireMock('@/features/debtor/actions')
  .createDebtor as jest.Mock;

async function abrirCrearDeudor() {
  const boton = await screen.findByTitle('Crear nuevo deudor');
  await act(async () => {
    fireEvent.click(boton);
  });
  await screen.findByRole('heading', { name: 'Crear Nuevo Deudor' });
}

function escribir(campos: Record<string, string>) {
  for (const [id, valor] of Object.entries(campos)) {
    fireEvent.change(document.getElementById(id)!, {
      target: { value: valor },
    });
  }
}

async function crearDeudor() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Crear Deudor' }));
  });
}

const NUEVO = {
  newDebtorName: 'Pedro Gómez Ruiz',
  newDebtorId: '80123456',
  newDebtorEmail: 'pedro@example.com',
  newDebtorPhone: '3109876543',
  newDebtorAddress: 'Carrera 7 #71-21',
  newDebtorCity: 'Medellín',
  newDebtorDept: 'Antioquia',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCaseById.mockResolvedValue({ success: true, data: CASO_COMPLETO });
  mockUpdateCase.mockResolvedValue({ success: true });
});

describe('EditCaseDialog — crear un deudor desde la edición del caso', () => {
  it('con dirección y ciudad rellenas, el alta llega a createDebtor y se anuncia', async () => {
    mockCreateDebtor.mockResolvedValue({
      success: true,
      data: { id: 'deudor-2', name: NUEVO.newDebtorName },
    });
    render(
      <EditCaseDialog
        open
        onOpenChange={() => {}}
        case={CASO}
        onCaseUpdated={() => {}}
      />,
    );

    await abrirCrearDeudor();
    escribir(NUEVO);
    await crearDeudor();

    await waitFor(() => expect(mockCreateDebtor).toHaveBeenCalledTimes(1));
    expect(mockCreateDebtor.mock.calls[0][0]).toMatchObject({
      name: 'Pedro Gómez Ruiz',
      address: 'Carrera 7 #71-21',
      city: 'Medellín',
      department: 'Antioquia',
    });
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Deudor creado exitosamente',
      ),
    );
  });

  it('un error por campo del servidor sale bajo ese campo del diálogo', async () => {
    mockCreateDebtor.mockResolvedValue({
      success: false,
      error: 'Ingrese un email válido',
      fieldErrors: { email: 'Ingrese un email válido' },
    });
    render(
      <EditCaseDialog
        open
        onOpenChange={() => {}}
        case={CASO}
        onCaseUpdated={() => {}}
      />,
    );

    await abrirCrearDeudor();
    escribir(NUEVO);
    await crearDeudor();

    const bloque = document
      .getElementById('newDebtorEmail')!
      .closest('.space-y-1\\.5')!;
    await waitFor(() =>
      expect(bloque.querySelector('p.text-red-500')).toHaveTextContent(
        'Ingrese un email válido',
      ),
    );
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});
