/**
 * @jest-environment jsdom
 */

/**
 * Wizard de alta de casos: con los datos completos, "Crear Caso" crea.
 *
 * Contraparte de `create-case-dialog-errores.test.tsx`, donde "Crear Caso"
 * con errores bloquea. Acá se llenan los campos que el formulario exige en
 * cada uno de los 3 wizards y se comprueba que la acción `createCase` recibe
 * el envío.
 *
 * Archivo aparte porque necesita elegir deudor y operador: el Select de Radix
 * abre con eventos de puntero que jsdom no implementa, así que acá va
 * mockeado con un <select> nativo (mismo recurso que `operator-selector`).
 * El de errores necesita el Select real, que es el que recibe `aria-invalid`
 * y el foco.
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

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};
jest.mock('sonner', () => ({ toast: mockToast }));

const mockCreateCase = jest.fn();
const mockUploadCaseDocuments = jest.fn();
jest.mock('@/features/case/actions', () => ({
  createCase: (...args: unknown[]) => mockCreateCase(...args),
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
jest.mock('@/features/document/actions', () => ({
  uploadCaseDocuments: (...args: unknown[]) => mockUploadCaseDocuments(...args),
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
    DialogContent: React.forwardRef<
      HTMLDivElement,
      { children?: React.ReactNode }
    >(function DialogContent({ children }, ref) {
      return <div ref={ref}>{children}</div>;
    }),
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: Pass,
    DialogClose: Pass,
  };
});

jest.mock('@/components/ui/select', () => ({
  __esModule: true,
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;
Element.prototype.scrollTo = function scrollTo() {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

import { CreateCaseDialog } from '@/app/cases/components/create-case-dialog';

// ─── Helpers ────────────────────────────────────────────────────────────────

type Tipo = 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';

/** El <select> que tiene una opción con ese value. */
function selectCon(value: string): HTMLSelectElement {
  const option = document.querySelector(`select option[value="${value}"]`);
  if (!option?.parentElement) throw new Error(`No hay select con ${value}`);
  return option.parentElement as HTMLSelectElement;
}

async function elegir(value: string) {
  await act(async () => {
    fireEvent.change(selectCon(value), { target: { value } });
  });
}

async function pulsar(nombre: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateCase.mockResolvedValue({
    success: true,
    data: { id: 'caso-nuevo' },
  });
  mockUploadCaseDocuments.mockResolvedValue({ success: true });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CreateCaseDialog — "Crear Caso" con los datos completos crea', () => {
  it.each<Tipo>(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'])(
    '%s',
    async (tipo) => {
      const onCaseCreated = jest.fn();
      render(
        <CreateCaseDialog
          open
          onOpenChange={() => {}}
          onCaseCreated={onCaseCreated}
          initialType={tipo}
        />,
      );
      await waitFor(() => selectCon('deudor-1'));
      await waitFor(() => selectCon('operador-1'));

      // Pestaña 1: deudor y operador, lo único que el formulario exige.
      await elegir('deudor-1');
      await elegir('operador-1');

      // Recorrer el wizard: en Insolvencia, pasar por "3. Acreedores" deja la
      // deuda total calculada ('0' sin acreedores, que es válida).
      while (screen.queryByRole('button', { name: 'Siguiente' })) {
        await pulsar('Siguiente');
      }

      // Insolvencia exige además los 3 documentos obligatorios (cédula, REDAM
      // y certificado de ingresos), que se cargan en la última pestaña.
      if (tipo === 'INSOLVENCY') {
        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
        ).slice(0, 3);
        for (const [i, input] of inputs.entries()) {
          await act(async () => {
            fireEvent.change(input, {
              target: {
                files: [
                  new File(['%PDF'], `doc-${i}.pdf`, {
                    type: 'application/pdf',
                  }),
                ],
              },
            });
          });
        }
      }

      await pulsar('Crear Caso');

      await waitFor(() => expect(mockCreateCase).toHaveBeenCalledTimes(1));
      expect(mockCreateCase.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          type: tipo,
          debtorId: 'deudor-1',
          operatorId: 'operador-1',
        }),
      );
      await waitFor(() => expect(onCaseCreated).toHaveBeenCalled());
      expect(
        mockToast.error.mock.calls.filter(([t]) => t === 'Campos incompletos'),
      ).toHaveLength(0);
    },
  );
});
