/**
 * @jest-environment jsdom
 */

/**
 * Diálogo "Registrar pago" del detalle del caso: abre sin errores.
 *
 * El diálogo pintaba el mismo `error` que la sección de pagos. Eso hacía que
 * abriera con un mensaje en rojo que no tenía nada que ver con lo que el
 * usuario iba a hacer ("Error al cargar pagos", "Error al generar
 * cronograma"), y que el error de un registro fallido siguiera ahí al cerrar
 * y volver a abrir. Ahora el diálogo tiene su propio error, que solo pone el
 * intento de registrar y que se limpia al abrir y al cerrar.
 *
 * Este diálogo no valida campo por campo: "Registrar Pago" queda deshabilitado
 * mientras el monto esté vacío, así que no hay mensaje de "requerido" que
 * mostrar ni al salir de un campo ni al pulsar.
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

const mockGetPaymentSchedule = jest.fn();
const mockRegisterPayment = jest.fn();
jest.mock('@/features/payment/actions', () => ({
  getPaymentSchedule: (...a: unknown[]) => mockGetPaymentSchedule(...a),
  generatePaymentSchedule: jest.fn(),
  markPaymentPaid: jest.fn(),
  registerPayment: (...a: unknown[]) => mockRegisterPayment(...a),
}));

// Dialog sin portal: solo renderiza si open=true y expone onOpenChange en
// un botón para poder cerrarlo como lo haría la X o Escape.
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      open ? (
        <div role="dialog">
          <button type="button" onClick={() => onOpenChange?.(false)}>
            Cerrar diálogo
          </button>
          {children}
        </div>
      ) : null,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: Pass,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

import { PaymentTrackingSection } from '@/app/cases/components/case-details-dialog/payment-tracking-section';
import type { CaseWithRelations } from '@/features/case/schemas';

const CASO = { id: 'caso-1' } as unknown as CaseWithRelations;

function erroresEnElDialogo(): string[] {
  const dialogo = screen.queryByRole('dialog');
  if (!dialogo) return [];
  return Array.from(dialogo.querySelectorAll('p.text-red-600')).map(
    (p) => p.textContent ?? '',
  );
}

async function abrirPagoManual() {
  await act(async () => {
    fireEvent.click(
      screen.getAllByRole('button', { name: /Registrar Pago Manual/ })[0],
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PaymentTrackingSection — diálogo de registrar pago', () => {
  it('no arrastra al diálogo el error de carga de la sección', async () => {
    mockGetPaymentSchedule.mockResolvedValue({
      success: false,
      error: 'Error al cargar pagos',
    });
    render(<PaymentTrackingSection caseData={CASO} />);
    await screen.findByText('Error al cargar pagos');

    await abrirPagoManual();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(erroresEnElDialogo()).toEqual([]);
    // Con el monto vacío no se puede enviar: no hay "requerido" que mostrar.
    expect(
      screen.getByRole('button', { name: 'Registrar Pago' }),
    ).toBeDisabled();
  });

  it('el error de un registro fallido se muestra, y cerrar y reabrir lo limpia', async () => {
    mockGetPaymentSchedule.mockResolvedValue({ success: true, data: [] });
    mockRegisterPayment.mockResolvedValue({
      success: false,
      error: 'El monto supera el saldo',
    });
    render(<PaymentTrackingSection caseData={CASO} />);
    await screen.findByText('No hay cronograma de pagos para este caso.');

    await abrirPagoManual();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('0'), {
        target: { value: '150000' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    });
    await waitFor(() =>
      expect(erroresEnElDialogo()).toEqual(['El monto supera el saldo']),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar diálogo' }));
    });
    await abrirPagoManual();

    expect(erroresEnElDialogo()).toEqual([]);
    expect(screen.getByPlaceholderText('0')).toHaveValue(null);
  });
});
