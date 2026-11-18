/**
 * @jest-environment jsdom
 */

/**
 * Los 2 campos de dinero que quedaban fuera de MoneyInput: "Monto" del
 * seguimiento de pagos del caso y "Valor pagado" de Reportes. Eran
 * `type="number"` + `parseFloat`: no aceptaban el separador de miles que usa
 * el resto del sistema, y `parseFloat("1.500.000")` da 1.5 (el bug de #136).
 * Ahora escriben `1.500.000` y envían 1500000.
 *
 * Arnés (mocks y helpers) copiado de `comprobante-limite-ui.test.tsx`.
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
const mockGetPaymentTrackingReport = jest.fn();
const mockGetCasePaymentSummaries = jest.fn();
const mockGetCasesForPayment = jest.fn();
jest.mock('@/features/payment/actions', () => ({
  getPaymentSchedule: (...a: unknown[]) => mockGetPaymentSchedule(...a),
  generatePaymentSchedule: jest.fn(),
  markPaymentPaid: jest.fn(),
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

async function abrirDesdeElCaso() {
  render(<PaymentTrackingSection caseData={CASO} />);
  await screen.findByText('No hay cronograma de pagos para este caso.');
  await act(async () => {
    fireEvent.click(
      screen.getAllByRole('button', { name: /Registrar Pago Manual/ })[0],
    );
  });
}

async function abrirDesdeElReporte() {
  render(<PaymentTrackingReport />);
  const boton = await screen.findByRole('button', { name: /Registrar Pago/ });
  await act(async () => {
    fireEvent.click(boton);
  });
  await screen.findByRole('dialog');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPaymentSchedule.mockResolvedValue({ success: true, data: [] });
  mockGetPaymentTrackingReport.mockResolvedValue({ success: false });
  mockGetCasePaymentSummaries.mockResolvedValue({ success: true, data: [] });
  mockGetCasesForPayment.mockResolvedValue({ success: true, data: [] });
  mockRegisterPayment.mockResolvedValue({ success: true });
});

function campo(etiqueta: string): HTMLInputElement {
  return screen
    .getByRole('dialog')
    .querySelector(`input[aria-label="${etiqueta}"]`) as HTMLInputElement;
}

describe('montos de pago con separador de miles', () => {
  it('el seguimiento del caso envía 1500000 al escribir 1.500.000', async () => {
    await abrirDesdeElCaso();

    const monto = campo('Monto');
    expect(monto).toBeTruthy();
    fireEvent.change(monto, { target: { value: '1.500.000' } });
    expect(monto.value).toBe('1.500.000');

    const fecha = screen
      .getByRole('dialog')
      .querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: '2026-11-09' } });

    const botones = screen.getAllByRole('button', { name: 'Registrar Pago' });
    await act(async () => {
      fireEvent.click(botones[botones.length - 1]);
    });

    await waitFor(() =>
      expect(mockRegisterPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1_500_000 }),
      ),
    );
  });

  it('Reportes muestra el valor pagado con separador de miles', async () => {
    await abrirDesdeElReporte();

    const valor = campo('Valor pagado');
    expect(valor).toBeTruthy();
    fireEvent.change(valor, { target: { value: '2500000' } });
    expect(valor.value).toBe('2.500.000');
  });
});
