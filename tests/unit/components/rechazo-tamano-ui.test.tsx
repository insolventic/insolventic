/**
 * @jest-environment jsdom
 */

/**
 * Cada sitio donde la UI rechaza un archivo por tamaño deja constancia, sin
 * datos del expediente. Un archivo que cabe no registra nada: el conteo tiene
 * que significar "alguien quiso subir esto y no pudo".
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockGetPaymentSchedule = jest.fn();
const mockGetPaymentTrackingReport = jest.fn();
const mockGetCasePaymentSummaries = jest.fn();
const mockGetCasesForPayment = jest.fn();
jest.mock('@/features/payment/actions', () => ({
  getPaymentSchedule: (...a: unknown[]) => mockGetPaymentSchedule(...a),
  generatePaymentSchedule: jest.fn(),
  markPaymentPaid: jest.fn(),
  registerPayment: jest.fn(),
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
import { DocumentsSection } from '@/app/cases/components/create-case-dialog/documents-section';
import { PaymentTrackingReport } from '@/app/reports/components/payment-tracking-report';
import type { CaseWithRelations } from '@/features/case/schemas';
import { logger } from '@/lib/logger';

const MB = 1024 * 1024;
const CASO = {
  id: 'caso-secreto-1',
  caseNumber: '2026-001',
  debtorName: 'Juan Perez',
} as unknown as CaseWithRelations;
/** Un nombre de archivo como los reales: lleva datos del deudor. */
const NOMBRE_CON_DATOS = 'Juan Perez CC 1234567 caso 2026-001.pdf';
const DATOS_DEL_EXPEDIENTE = /juan|perez|1234567|2026-001|caso-secreto/i;

function pdfDe(tamano: number, nombre = NOMBRE_CON_DATOS): File {
  const archivo = new File(['x'], nombre, { type: 'application/pdf' });
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}

async function elegirEnElDialogo(archivo: File) {
  const input = screen
    .getByRole('dialog')
    .querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [archivo] } });
  });
}

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

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  mockGetPaymentSchedule.mockResolvedValue({ success: true, data: [] });
  mockGetPaymentTrackingReport.mockResolvedValue({ success: false });
  mockGetCasePaymentSummaries.mockResolvedValue({ success: true, data: [] });
  mockGetCasesForPayment.mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
  warn.mockRestore();
});

describe.each([
  ['detalle del caso', abrirDesdeElCaso],
  ['reporte de pagos', abrirDesdeElReporte],
] as const)('comprobante en %s', (_nombre, abrir) => {
  it('un rechazo deja un registro, sin datos del expediente', async () => {
    await abrir();

    await elegirEnElDialogo(pdfDe(6 * MB));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      'Archivo rechazado por tamaño | origen=comprobante | rango=5-10 MB | tipo=pdf',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(DATOS_DEL_EXPEDIENTE);
  });

  it('un archivo que cabe no registra nada', async () => {
    await abrir();

    await elegirEnElDialogo(pdfDe(1 * MB));

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('documentos del caso', () => {
  function primerInput(): HTMLInputElement {
    return document.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
  }

  async function elegir(...archivos: File[]) {
    await act(async () => {
      fireEvent.change(primerInput(), { target: { files: archivos } });
    });
  }

  it('cada archivo rechazado cuenta una vez y sin datos del expediente', async () => {
    render(<DocumentsSection />);

    await elegir(pdfDe(12 * MB), pdfDe(30 * MB), pdfDe(1 * MB, 'cabe.pdf'));

    expect(warn.mock.calls.map(([mensaje]) => mensaje)).toEqual([
      'Archivo rechazado por tamaño | origen=documento-caso | rango=10-25 MB | tipo=pdf',
      'Archivo rechazado por tamaño | origen=documento-caso | rango=más de 25 MB | tipo=pdf',
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(DATOS_DEL_EXPEDIENTE);
  });

  it('un archivo que cabe no registra nada', async () => {
    render(<DocumentsSection />);

    await elegir(pdfDe(1 * MB));

    expect(warn).not.toHaveBeenCalled();
  });
});
