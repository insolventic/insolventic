/**
 * @jest-environment jsdom
 */

/**
 * GC-M6, la parte de UI: el diálogo de borrado exige teclear el número del
 * caso antes de habilitar el botón.
 *
 * La comprobación que de verdad protege está en el servidor
 * (`delete-case-confirmation.test.ts`). Esto cubre la otra mitad del
 * requisito: que la fricción exista para el operador y que no se pueda
 * disparar el borrado con un click por inercia. Si este test desapareciera,
 * el botón podría volver a estar habilitado de entrada y nadie lo notaría
 * hasta que alguien borrara un expediente real.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockDeleteCase = jest.fn();
jest.mock('@/features/case/actions', () => ({
  deleteCase: (...args: unknown[]) => mockDeleteCase(...args),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { DeleteCaseDialog } from '@/app/cases/components/delete-case-dialog';

const CASE_NUMBER = 'INSOL-000042';

const CASE_ITEM = {
  id: 'case-a-borrar',
  caseNumber: CASE_NUMBER,
  debtorName: 'Pepita Pérez',
  type: 'INSOLVENCY',
  totalDebt: 50000000,
  creditors: 3,
  version: 1,
  createdDate: new Date('2026-01-01'),
  hearingDate: null,
  phase: 'En negociación',
  debtorId: 'debtor-1',
  operatorId: 'user-1',
  driveFolderId: null,
  causes: [],
  debtor: null,
  operator: null,
  _count: { documents: 7 },
} as never;

function renderDialog() {
  return render(
    <DeleteCaseDialog
      case={CASE_ITEM}
      open
      onOpenChange={() => {}}
      onCaseDeleted={() => {}}
    />,
  );
}

function botonEliminar() {
  return screen.getByRole('button', { name: /Eliminar Caso/i });
}

function campoConfirmacion() {
  return screen.getByLabelText(/escriba el número del caso/i);
}

describe('DeleteCaseDialog — confirmación escrita (GC-M6)', () => {
  beforeEach(() => {
    mockDeleteCase.mockReset();
    mockDeleteCase.mockResolvedValue({ success: true });
  });

  it('el botón de eliminar arranca DESHABILITADO', () => {
    renderDialog();
    expect(botonEliminar()).toBeDisabled();
  });

  it('muestra el número que hay que escribir', () => {
    renderDialog();
    // Aparece en el label de confirmación, no solo en la descripción.
    expect(campoConfirmacion()).toBeInTheDocument();
    expect(
      screen.getByText(
        /El botón de eliminar se habilita cuando el número coincida/i,
      ),
    ).toBeInTheDocument();
  });

  it('con un número parecido pero distinto, sigue deshabilitado', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), {
      target: { value: 'INSOL-000041' },
    });

    expect(botonEliminar()).toBeDisabled();
    expect(screen.getByText(/no coincide todavía/i)).toBeInTheDocument();
  });

  it('con un prefijo del número, sigue deshabilitado', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), { target: { value: 'INSOL' } });

    expect(botonEliminar()).toBeDisabled();
  });

  it('con el número exacto, se habilita', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), { target: { value: CASE_NUMBER } });

    expect(botonEliminar()).toBeEnabled();
    expect(screen.getByText(/El número coincide/i)).toBeInTheDocument();
  });

  it('un click con la confirmación incompleta NO llama a la action', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), { target: { value: 'otra cosa' } });
    fireEvent.click(botonEliminar());

    expect(mockDeleteCase).not.toHaveBeenCalled();
  });

  it('con la confirmación correcta, manda el número a la action', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), { target: { value: CASE_NUMBER } });
    fireEvent.click(botonEliminar());

    expect(mockDeleteCase).toHaveBeenCalledWith({
      id: CASE_ITEM.id,
      confirmCaseNumber: CASE_NUMBER,
    });
  });

  it('acepta espacios alrededor (los recorta antes de enviar)', () => {
    renderDialog();
    fireEvent.change(campoConfirmacion(), {
      target: { value: `  ${CASE_NUMBER} ` },
    });

    expect(botonEliminar()).toBeEnabled();
    fireEvent.click(botonEliminar());
    expect(mockDeleteCase).toHaveBeenCalledWith({
      id: CASE_ITEM.id,
      confirmCaseNumber: CASE_NUMBER,
    });
  });

  it('al reabrir el diálogo el campo vuelve a estar en blanco', () => {
    const { rerender } = render(
      <DeleteCaseDialog
        case={CASE_ITEM}
        open
        onOpenChange={() => {}}
        onCaseDeleted={() => {}}
      />,
    );
    fireEvent.change(campoConfirmacion(), { target: { value: CASE_NUMBER } });
    expect(botonEliminar()).toBeEnabled();

    // Cerrar…
    rerender(
      <DeleteCaseDialog
        case={CASE_ITEM}
        open={false}
        onOpenChange={() => {}}
        onCaseDeleted={() => {}}
      />,
    );
    // …y volver a abrir: si el texto sobreviviera, el botón aparecería ya
    // habilitado y la fricción no existiría.
    rerender(
      <DeleteCaseDialog
        case={CASE_ITEM}
        open
        onOpenChange={() => {}}
        onCaseDeleted={() => {}}
      />,
    );

    expect(campoConfirmacion()).toHaveValue('');
    expect(botonEliminar()).toBeDisabled();
  });
});
