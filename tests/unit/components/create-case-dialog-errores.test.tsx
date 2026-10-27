/**
 * @jest-environment jsdom
 */

/**
 * Wizard de alta de casos: los errores de validación aparecen solo después de
 * una acción del usuario, nunca al abrir.
 *
 * Regla de producto: un campo muestra su error solo si el usuario salió de él
 * (blur) o intentó avanzar o guardar. El ícono de error de cada pestaña y el
 * toast "Campos incompletos" aparecen solo tras pulsar "Siguiente" o "Crear
 * Caso". Cerrar y reabrir el diálogo deja todo limpio.
 *
 * Bugs que cubre, todos vistos en el navegador antes del arreglo:
 *   - "Siguiente" en la penúltima pestaña enviaba el formulario (React
 *     reutilizaba el <button> y le cambiaba el type a submit en mitad del
 *     clic): toast, ícono rojo y vuelta a la pestaña 1.
 *
 * El botón "Crear nuevo deudor" (submit implícito) tiene su propio test en
 * `debtor-section-crear-deudor.test.tsx`; acá se comprueba además desde el
 * diálogo completo.
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

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};
jest.mock('sonner', () => ({ toast: mockToast }));

const mockCreateCase = jest.fn();
jest.mock('@/features/case/actions', () => ({
  createCase: (...args: unknown[]) => mockCreateCase(...args),
}));
jest.mock('@/features/creditor/actions', () => ({
  getAllCreditors: jest.fn().mockResolvedValue({ success: true, data: [] }),
}));
jest.mock('@/features/debtor/actions', () => ({
  getAllDebtors: jest.fn().mockResolvedValue({ success: true, data: [] }),
  createDebtor: jest.fn(),
}));
jest.mock('@/features/user/actions', () => ({
  getAssignableOperators: jest
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}));
jest.mock('@/features/document/actions', () => ({
  uploadCaseDocuments: jest.fn(),
}));

// Dialog sin portal ni animaciones: solo renderiza si open=true.
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

// Radix mide con ResizeObserver y hace scroll con scrollTo; jsdom no trae
// ninguno de los dos.
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

function renderWizard(initialType: Tipo = 'INSOLVENCY') {
  const onOpenChange = jest.fn();
  const utils = render(
    <CreateCaseDialog
      open
      onOpenChange={onOpenChange}
      initialType={initialType}
    />,
  );
  const reabrir = (open: boolean) =>
    utils.rerender(
      <CreateCaseDialog
        open={open}
        onOpenChange={onOpenChange}
        initialType={initialType}
      />,
    );
  return { ...utils, reabrir };
}

/** Espera a que termine la carga de deudores/usuarios del useEffect de apertura. */
async function esperarCarga() {
  await waitFor(() =>
    expect(screen.queryByText('Cargando deudores...')).not.toBeInTheDocument(),
  );
}

/** Mensajes de error de campo visibles (FormMessage). */
function mensajesDeError(): string[] {
  return Array.from(document.querySelectorAll('p.text-destructive')).map(
    (p) => p.textContent ?? '',
  );
}

/** Pestañas que muestran el ícono de error. */
function pestanasConError(): string[] {
  return screen
    .getAllByRole('tab')
    .filter((t) => t.querySelector('svg'))
    .map((t) => t.textContent ?? '');
}

function pestanaActiva(): string {
  return (
    screen
      .getAllByRole('tab')
      .find((t) => t.getAttribute('data-state') === 'active')?.textContent ?? ''
  );
}

async function pulsarSiguiente() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  });
}

async function pulsarCrearCaso() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Crear Caso' }));
  });
}

function toastsDeCamposIncompletos() {
  return mockToast.error.mock.calls.filter(
    ([titulo]) => titulo === 'Campos incompletos',
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CreateCaseDialog — al abrir no hay errores', () => {
  it.each<Tipo>(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'])(
    '%s: sin mensajes, sin ícono en pestañas y sin toast',
    async (tipo) => {
      renderWizard(tipo);
      await esperarCarga();

      expect(mensajesDeError()).toEqual([]);
      expect(pestanasConError()).toEqual([]);
      expect(mockToast.error).not.toHaveBeenCalled();
    },
  );

  it('el botón "Crear nuevo deudor" no envía el formulario del caso', async () => {
    renderWizard('INSOLVENCY');
    await esperarCarga();

    await act(async () => {
      fireEvent.click(screen.getByTitle('Crear nuevo deudor'));
    });

    expect(mensajesDeError()).toEqual([]);
    expect(pestanasConError()).toEqual([]);
    expect(toastsDeCamposIncompletos()).toHaveLength(0);
    expect(screen.getByText('Crear Nuevo Deudor')).toBeInTheDocument();
  });
});

describe('CreateCaseDialog — "Siguiente" no envía el formulario', () => {
  it.each<[Tipo, string]>([
    ['INSOLVENCY', '7. Documentos'],
    ['CONCILIATION', '3. Solicitud'],
    ['SUPPORT_AGREEMENT', '3. Acuerdo'],
  ])(
    '%s: recorrer el wizard con "Siguiente" llega a la última pestaña sin toast',
    async (tipo, ultima) => {
      renderWizard(tipo);
      await esperarCarga();

      while (screen.queryByRole('button', { name: 'Siguiente' })) {
        await pulsarSiguiente();
      }

      expect(pestanaActiva()).toBe(ultima);
      expect(screen.getByRole('button', { name: 'Crear Caso' })).toBeVisible();
      expect(toastsDeCamposIncompletos()).toHaveLength(0);
      expect(mockCreateCase).not.toHaveBeenCalled();
    },
  );

  // En jsdom el envío espurio no se reproduce: `act()` aplaza el re-render
  // hasta después de la acción por defecto del clic, y en el navegador real
  // React lo hace antes (por eso el E2E lo cubre de verdad). Lo que sí se
  // puede comprobar acá es el mecanismo: que "Crear Caso" sea un <button>
  // NUEVO y no el mismo nodo de "Siguiente" con el type cambiado.
  it('"Crear Caso" no reutiliza el nodo de "Siguiente"', async () => {
    renderWizard('CONCILIATION');
    await esperarCarga();

    await pulsarSiguiente(); // → 2. Partes (penúltima)
    const siguiente = screen.getByRole('button', { name: 'Siguiente' });
    await act(async () => {
      fireEvent.click(siguiente);
    });

    const crear = screen.getByRole('button', { name: 'Crear Caso' });
    expect(crear).not.toBe(siguiente);
    expect(siguiente.isConnected).toBe(false);
  });
});
