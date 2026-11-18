/**
 * @jest-environment jsdom
 */

/**
 * Los dos diálogos de registrar pago capturan el monto con separador de miles
 * y lo envían como número (N-F-01).
 *
 * Antes eran `<input type="number">` leídos con `parseFloat`: el navegador no
 * deja escribir el punto de miles, y un monto pegado como `1.500.000` llegaba
 * a la acción como `1.5`. Ahora son `MoneyInputField` y se leen con
 * `parsearMonto`, igual que el resto de montos del proyecto. Lo que recibe la
 * acción no cambia de forma: `amount` sigue siendo un `number`
 * (`z.number().positive()` en `registerPayment` y `markPaymentPaid`).
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

const mockGetPaymentSchedule = jest.fn();
const mockRegisterPayment = jest.fn();
const mockMarkPaymentPaid = jest.fn();
const mockGetPaymentTrackingReport = jest.fn();
const mockGetCasePaymentSummaries = jest.fn();
const mockGetCasesForPayment = jest.fn();
jest.mock('@/features/payment/actions', () => ({
  getPaymentSchedule: (...a: unknown[]) => mockGetPaymentSchedule(...a),
  generatePaymentSchedule: jest.fn(),
  markPaymentPaid: (...a: unknown[]) => mockMarkPaymentPaid(...a),
  registerPayment: (...a: unknown[]) => mockRegisterPayment(...a),
  getPaymentTrackingReport: (...a: unknown[]) =>
    mockGetPaymentTrackingReport(...a),
  getCasePaymentSummaries: (...a: unknown[]) =>
    mockGetCasePaymentSummaries(...a),
  getCasesForPayment: (...a: unknown[]) => mockGetCasesForPayment(...a),
  getPaymentHistory: jest.fn(),
  exportPaymentTrackingToExcel: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
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
    }) => (open ? <div role="dialog">{children}</div> : null),
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
import { PaymentTrackingReport } from '@/app/reports/components/payment-tracking-report';
import type { CaseWithRelations } from '@/features/case/schemas';

const CASO = { id: 'caso-1' } as unknown as CaseWithRelations;

const campoMonto = () => screen.getByPlaceholderText('0') as HTMLInputElement;
// Dentro del diálogo: el reporte tiene otro "Registrar Pago" que lo abre.
const botonRegistrar = () =>
  within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Registrar Pago',
  });

async function escribirMonto(texto: string) {
  await act(async () => {
    fireEvent.change(campoMonto(), { target: { value: texto } });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPaymentSchedule.mockResolvedValue({ success: true, data: [] });
  mockGetPaymentTrackingReport.mockResolvedValue({ success: false });
  mockGetCasePaymentSummaries.mockResolvedValue({ success: true, data: [] });
  mockGetCasesForPayment.mockResolvedValue({
    success: true,
    data: [
      {
        id: 'caso-1',
        caseNumber: 'INSOL-000001',
        debtorName: 'Deudor Test',
        type: 'INSOLVENCY',
        totalDebt: 0,
      },
    ],
  });
  mockRegisterPayment.mockResolvedValue({ success: true });
  mockMarkPaymentPaid.mockResolvedValue({ success: true });
});

describe('detalle del caso — pago manual', () => {
  async function abrir() {
    render(<PaymentTrackingSection caseData={CASO} />);
    await screen.findByText('No hay cronograma de pagos para este caso.');
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: /Registrar Pago Manual/ })[0],
      );
    });
  }

  it('el campo es de texto y muestra el separador de miles al escribir', async () => {
    await abrir();
    expect(campoMonto()).toHaveAttribute('type', 'text');
    await escribirMonto('1500000');
    expect(campoMonto()).toHaveValue('1.500.000');
  });

  it('envía el monto como número, no 1.5', async () => {
    await abrir();
    await escribirMonto('1.500.000');
    await act(async () => {
      fireEvent.click(botonRegistrar());
    });

    await waitFor(() => expect(mockRegisterPayment).toHaveBeenCalledTimes(1));
    expect(mockRegisterPayment.mock.calls[0][0].amount).toBe(1_500_000);
  });

  it('conserva los decimales escritos con coma', async () => {
    await abrir();
    await escribirMonto('1.500.000,50');
    await act(async () => {
      fireEvent.click(botonRegistrar());
    });

    await waitFor(() => expect(mockRegisterPayment).toHaveBeenCalledTimes(1));
    expect(mockRegisterPayment.mock.calls[0][0].amount).toBe(1_500_000.5);
  });

  it('con monto vacío o cero no deja enviar', async () => {
    await abrir();
    expect(botonRegistrar()).toBeDisabled();
    await escribirMonto('0');
    expect(botonRegistrar()).toBeDisabled();
    await escribirMonto('1');
    expect(botonRegistrar()).not.toBeDisabled();
  });
});

describe('detalle del caso — pagar una cuota programada', () => {
  it('precarga el monto de la cuota formateado y lo envía como número', async () => {
    mockGetPaymentSchedule.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'pago-1',
          caseId: 'caso-1',
          installmentNumber: 1,
          dueDate: new Date('2026-12-01T12:00:00Z'),
          amount: 2_345_678.5,
          status: 'PENDING',
          paidDate: null,
          paymentMethod: null,
          observations: null,
          receiptUrl: null,
          createdAt: new Date('2026-11-01T12:00:00Z'),
          updatedAt: new Date('2026-11-01T12:00:00Z'),
        },
      ],
    });
    render(<PaymentTrackingSection caseData={CASO} />);
    const pagar = await screen.findAllByRole('button', { name: /Pagar/ });
    await act(async () => {
      fireEvent.click(pagar[0]);
    });

    expect(campoMonto()).toHaveValue('2.345.678,5');
    await act(async () => {
      fireEvent.click(botonRegistrar());
    });

    await waitFor(() => expect(mockMarkPaymentPaid).toHaveBeenCalledTimes(1));
    expect(mockMarkPaymentPaid.mock.calls[0][0]).toMatchObject({
      paymentId: 'pago-1',
      amount: 2_345_678.5,
    });
  });
});

describe('reporte de pagos — registrar pago', () => {
  async function abrirYElegirCaso() {
    render(<PaymentTrackingReport />);
    const boton = await screen.findByRole('button', { name: /Registrar Pago/ });
    await act(async () => {
      fireEvent.click(boton);
    });
    const caso = await screen.findByRole('button', { name: /INSOL-000001/ });
    await act(async () => {
      fireEvent.click(caso);
    });
  }

  it('el campo es de texto y muestra el separador de miles al escribir', async () => {
    await abrirYElegirCaso();
    expect(campoMonto()).toHaveAttribute('type', 'text');
    await escribirMonto('980000');
    expect(campoMonto()).toHaveValue('980.000');
  });

  it('envía el monto como número', async () => {
    await abrirYElegirCaso();
    await escribirMonto('980.000,25');
    await act(async () => {
      fireEvent.click(botonRegistrar());
    });

    await waitFor(() => expect(mockRegisterPayment).toHaveBeenCalledTimes(1));
    expect(mockRegisterPayment.mock.calls[0][0]).toMatchObject({
      caseId: 'caso-1',
      amount: 980_000.25,
    });
  });

  it('con monto cero no deja enviar', async () => {
    await abrirYElegirCaso();
    await escribirMonto('0');
    expect(botonRegistrar()).toBeDisabled();
  });
});
