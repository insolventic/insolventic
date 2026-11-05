/**
 * @jest-environment jsdom
 */

/**
 * Los dos diálogos de registrar pago dicen el mismo límite que el servidor, y
 * un archivo demasiado grande se explica al elegirlo, sin esperar al envío.
 *
 * Antes prometían 10 MB y dejaban pasar archivos que la server action no podía
 * recibir: el usuario llenaba el formulario, pulsaba "Registrar Pago" y solo
 * veía "Error al registrar pago".
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
import {
  errorDeTamanoDeArchivo,
  MAX_ARCHIVO_BYTES,
} from '@/lib/limite-archivos';

const CASO = { id: 'caso-1' } as unknown as CaseWithRelations;

/** Un File de ese tamaño sin reservar la memoria en cada test. */
function pdfDe(tamano: number, nombre = 'comprobante.pdf'): File {
  const archivo = new File(['x'], nombre, { type: 'application/pdf' });
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}

function elegir(archivo: File) {
  const input = screen
    .getByRole('dialog')
    .querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [archivo] } });
  return input;
}

function erroresEnElDialogo(): string[] {
  return Array.from(
    screen.getByRole('dialog').querySelectorAll('p.text-red-600'),
  ).map((p) => p.textContent ?? '');
}

const DEMASIADO_GRANDE = MAX_ARCHIVO_BYTES + 1;

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

describe.each([
  ['detalle del caso', abrirDesdeElCaso],
  ['reporte de pagos', abrirDesdeElReporte],
] as const)('diálogo de pago en %s', (_nombre, abrir) => {
  it('anuncia el límite real', async () => {
    await abrir();
    expect(
      screen.getByText('PDF, JPG o PNG. Máximo 4 MB.'),
    ).toBeInTheDocument();
  });

  it('explica el problema al elegir un archivo demasiado grande y no lo adjunta', async () => {
    await abrir();

    const input = elegir(pdfDe(DEMASIADO_GRANDE, 'foto-del-celular.pdf'));

    await waitFor(() =>
      expect(erroresEnElDialogo()).toEqual([
        errorDeTamanoDeArchivo(DEMASIADO_GRANDE),
      ]),
    );
    expect(screen.queryByText('foto-del-celular.pdf')).not.toBeInTheDocument();
    // Vacío, para que volver a elegir el mismo archivo (ya reducido) dispare change.
    expect(input.value).toBe('');
  });

  it('elegir después uno que cabe quita el error y lo adjunta', async () => {
    await abrir();
    elegir(pdfDe(DEMASIADO_GRANDE));
    await waitFor(() => expect(erroresEnElDialogo()).toHaveLength(1));

    elegir(pdfDe(MAX_ARCHIVO_BYTES, 'reducido.pdf'));

    await screen.findByText('reducido.pdf');
    expect(erroresEnElDialogo()).toEqual([]);
  });
});

it('el comprobante llega a la acción como File, sin pasar por base64', async () => {
  await abrirDesdeElCaso();
  const archivo = pdfDe(1024);
  elegir(archivo);
  await screen.findByText('comprobante.pdf');
  fireEvent.change(screen.getByPlaceholderText('0'), {
    target: { value: '150000' },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
  });

  await waitFor(() => expect(mockRegisterPayment).toHaveBeenCalledTimes(1));
  expect(mockRegisterPayment.mock.calls[0][0].receipt).toBe(archivo);
});
