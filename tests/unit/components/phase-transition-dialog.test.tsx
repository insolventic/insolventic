/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('sonner', () => ({ toast: mockToast }));

const mockUpdateCasePhase = jest.fn();
jest.mock('@/features/case/actions', () => ({
  updateCasePhase: (...args: unknown[]) => mockUpdateCasePhase(...args),
}));

jest.mock('lucide-react', () => ({
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
}));

// Dialog: sin portal ni animaciones — solo renderiza si open=true.
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

// Select: Context simple para enrutar onValueChange sin depender de Radix/portales.
jest.mock('@/components/ui/select', () => {
  const SelectCtx = React.createContext<(v: string) => void>(() => {});
  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (v: string) => void;
    }) => (
      <SelectCtx.Provider value={onValueChange ?? (() => {})}>
        <div data-testid="select" data-value={value}>
          {children}
        </div>
      </SelectCtx.Provider>
    ),
    SelectTrigger: ({
      children,
      id,
    }: {
      children: React.ReactNode;
      id?: string;
    }) => (
      <div data-testid="select-trigger" id={id}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <span>{placeholder}</span>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="select-content">{children}</div>
    ),
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const onValueChange = React.useContext(SelectCtx);
      return (
        <div
          role="option"
          aria-selected={false}
          data-testid="select-item"
          data-value={value}
          onClick={() => onValueChange(value)}
        >
          {children}
        </div>
      );
    },
  };
});

// ─── Import component (después de los mocks) ───────────────────────────────

import { PhaseTransitionDialog } from '@/app/cases/components/phase-transition-dialog';

// ─── Helpers ────────────────────────────────────────────────────────────────

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof PhaseTransitionDialog>> = {},
) => {
  const onOpenChange = jest.fn();
  const onPhaseChanged = jest.fn();
  render(
    <PhaseTransitionDialog
      open={true}
      onOpenChange={onOpenChange}
      caseId="case-1"
      caseNumber="INSOL-000001"
      currentPhase="En negociación"
      onPhaseChanged={onPhaseChanged}
      {...overrides}
    />,
  );
  return { onOpenChange, onPhaseChanged };
};

const clickTransitionButton = (targetPhaseLabel: string) => {
  // El botón de transición contiene dos badges (fase actual → destino); el
  // badge del destino tiene el texto exacto de la fase.
  const targetBadge = screen.getByText(targetPhaseLabel);
  const button = targetBadge.closest('button');
  if (!button) throw new Error(`No button found for ${targetPhaseLabel}`);
  fireEvent.click(button);
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PhaseTransitionDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateCasePhase.mockResolvedValue({ success: true });
  });

  describe('transiciones simples (sin subtipo) — comportamiento sin cambios', () => {
    it('lista las transiciones válidas desde la fase actual', () => {
      renderDialog({ currentPhase: 'En negociación' });

      expect(screen.getByText('Audiencia programada')).toBeInTheDocument();
      expect(screen.getByText('Acuerdo aprobado')).toBeInTheDocument();
      expect(screen.getByText('Desistimiento')).toBeInTheDocument();
      expect(screen.getByText('Fracaso')).toBeInTheDocument();
    });

    it('confirma de un clic una transición que no requiere subtipo', async () => {
      renderDialog({ currentPhase: 'En negociación' });

      clickTransitionButton('Audiencia programada');

      await waitFor(() => {
        expect(mockUpdateCasePhase).toHaveBeenCalledWith({
          caseId: 'case-1',
          newPhase: 'Audiencia programada',
        });
      });
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('no muestra el panel de subtipo/fecha para una transición simple', () => {
      renderDialog({ currentPhase: 'En negociación' });

      clickTransitionButton('Audiencia programada');

      expect(screen.queryByText(/Subtipo de/)).not.toBeInTheDocument();
      expect(
        screen.queryByText('Confirmar cambio de fase'),
      ).not.toBeInTheDocument();
    });
  });

  describe('panel inline de subtipo/fecha — Fracaso', () => {
    it('clicar "Fracaso" abre el panel en vez de confirmar de inmediato', () => {
      renderDialog({ currentPhase: 'En negociación' });

      clickTransitionButton('Fracaso');

      expect(mockUpdateCasePhase).not.toHaveBeenCalled();
      expect(screen.getByText('Subtipo de fracaso *')).toBeInTheDocument();
      expect(screen.getByText('Confirmar cambio de fase')).toBeInTheDocument();
    });

    it('prerellena la fecha con la de hoy', () => {
      renderDialog({ currentPhase: 'En negociación' });
      clickTransitionButton('Fracaso');

      const dateInput = document.getElementById(
        'phase-transition-date',
      ) as HTMLInputElement;
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(dateInput.value).toBe(expected);
    });

    it('lista los 13 subtipos de fracaso, incluido inasistencia del deudor', () => {
      renderDialog({ currentPhase: 'En negociación' });
      clickTransitionButton('Fracaso');

      const items = screen.getAllByTestId('select-item');
      expect(items).toHaveLength(13);
      expect(screen.getByText('Inasistencia del Deudor')).toBeInTheDocument();
    });

    it('el botón Confirmar está deshabilitado sin subtipo seleccionado', () => {
      renderDialog({ currentPhase: 'En negociación' });
      clickTransitionButton('Fracaso');

      expect(
        screen.getByText('Confirmar cambio de fase').closest('button'),
      ).toBeDisabled();
    });

    it('se habilita al elegir subtipo y confirma con newPhase/subtype/resultDate', async () => {
      renderDialog({ currentPhase: 'En negociación' });
      clickTransitionButton('Fracaso');

      fireEvent.click(screen.getByText('Incumplimiento'));

      const confirmBtn = screen
        .getByText('Confirmar cambio de fase')
        .closest('button')!;
      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockUpdateCasePhase).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-1',
            newPhase: 'Fracaso',
            subtype: 'incumplimiento',
          }),
        );
      });
      const call = mockUpdateCasePhase.mock.calls[0][0];
      expect(call.resultDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('Cancelar vuelve a la lista sin llamar a updateCasePhase', () => {
      renderDialog({ currentPhase: 'En negociación' });
      clickTransitionButton('Fracaso');

      fireEvent.click(screen.getByText('Cancelar'));

      expect(mockUpdateCasePhase).not.toHaveBeenCalled();
      expect(screen.getByText('Transiciones disponibles:')).toBeInTheDocument();
    });
  });

  describe('panel inline de subtipo/fecha — Desistimiento', () => {
    it('ofrece exactamente los 2 subtipos confirmados', () => {
      renderDialog({ currentPhase: 'Admisión' });
      clickTransitionButton('Desistimiento');

      expect(screen.getByText('No pago de tarifas')).toBeInTheDocument();
      expect(screen.getByText('Abandono total')).toBeInTheDocument();
      expect(screen.getAllByTestId('select-item')).toHaveLength(2);
    });

    it('confirma con el subtipo elegido', async () => {
      renderDialog({ currentPhase: 'Admisión' });
      clickTransitionButton('Desistimiento');

      fireEvent.click(screen.getByText('Abandono total'));
      fireEvent.click(
        screen.getByText('Confirmar cambio de fase').closest('button')!,
      );

      await waitFor(() => {
        expect(mockUpdateCasePhase).toHaveBeenCalledWith(
          expect.objectContaining({
            newPhase: 'Desistimiento',
            subtype: 'abandono-total',
          }),
        );
      });
    });
  });

  describe('manejo de errores del servidor', () => {
    it('muestra el error del servidor y no cierra el diálogo', async () => {
      mockUpdateCasePhase.mockResolvedValue({
        success: false,
        error: 'El subtipo es obligatorio para pasar a "Fracaso"',
      });
      const { onOpenChange } = renderDialog({ currentPhase: 'En negociación' });

      clickTransitionButton('Fracaso');
      fireEvent.click(screen.getByText('Incumplimiento'));
      fireEvent.click(
        screen.getByText('Confirmar cambio de fase').closest('button')!,
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'El subtipo es obligatorio para pasar a "Fracaso"',
        );
      });
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
