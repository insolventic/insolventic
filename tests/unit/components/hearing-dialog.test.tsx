/**
 * @jest-environment jsdom
 *
 * Diálogo de programar audiencia. Cumple la regla de formularios de CLAUDE.md:
 * nada valida al abrir, y cerrar y reabrir lo deja limpio.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockProgramar = jest.fn();
const mockCancelar = jest.fn();
jest.mock('@/features/calendar/actions', () => ({
  programarAudiencia: (...args: unknown[]) => mockProgramar(...args),
  cancelarAudiencia: (...args: unknown[]) => mockCancelar(...args),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { HearingDialog } from '@/components/hearings/hearing-dialog';
import { toast } from 'sonner';

const FUTURA = { fecha: new Date('2099-11-20T12:00:00.000Z'), hora: '10:00' };

function abrir(props: Partial<Parameters<typeof HearingDialog>[0]> = {}) {
  const onOpenChange = jest.fn();
  const onSaved = jest.fn();
  const base = {
    open: true,
    onOpenChange,
    onSaved,
    caseId: 'caso-1',
    caseNumber: 'INS-1',
    version: 3,
    audiencia: null,
  };
  const utils = render(<HearingDialog {...base} {...props} />);
  return { ...utils, onOpenChange, onSaved, base };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProgramar.mockResolvedValue({ success: true });
  mockCancelar.mockResolvedValue({ success: true });
});

describe('HearingDialog', () => {
  it('al abrir no muestra errores', () => {
    abrir();
    expect(
      screen.getByRole('heading', { name: 'Programar audiencia' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('La fecha es requerida')).toBeNull();
    expect(screen.queryByText('La hora es requerida')).toBeNull();
  });

  it('guardar vacío muestra los errores y no llama al servidor', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La fecha es requerida'),
    ).toBeInTheDocument();
    expect(screen.getByText('La hora es requerida')).toBeInTheDocument();
    expect(mockProgramar).not.toHaveBeenCalled();
  });

  it('programa con la versión del caso', async () => {
    const { onOpenChange, onSaved } = abrir();
    fireEvent.change(screen.getByLabelText('Fecha *'), {
      target: { value: '2099-11-20' },
    });
    fireEvent.change(screen.getByLabelText('Hora *'), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(mockProgramar).toHaveBeenCalledWith({
        caseId: 'caso-1',
        version: 3,
        fecha: '2099-11-20',
        hora: '10:00',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSaved).toHaveBeenCalled();
  });

  it('con audiencia vigente, arranca con su fecha y permite reprogramar', () => {
    abrir({ audiencia: FUTURA });
    expect(
      screen.getByRole('heading', { name: 'Reprogramar audiencia' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha *')).toHaveValue('2099-11-20');
    expect(screen.getByLabelText('Hora *')).toHaveValue('10:00');
    expect(screen.getByText(/20\/11\/2099 a las 10:00/)).toBeInTheDocument();
  });

  it('sin audiencia no ofrece cancelar', () => {
    abrir();
    expect(
      screen.queryByRole('button', { name: 'Cancelar audiencia' }),
    ).toBeNull();
  });

  it('cancelar pide confirmación antes de llamar al servidor', async () => {
    const { onOpenChange } = abrir({ audiencia: FUTURA });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar audiencia' }));
    expect(mockCancelar).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Sí, cancelar audiencia' }),
    );

    await waitFor(() =>
      expect(mockCancelar).toHaveBeenCalledWith({
        caseId: 'caso-1',
        version: 3,
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('avisa si la fecha ya pasó, sin bloquear', async () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Fecha *'), {
      target: { value: '2020-01-15' },
    });
    expect(await screen.findByText(/Esta fecha ya pasó/)).toBeInTheDocument();
  });

  it('un error del servidor se muestra y deja el diálogo abierto', async () => {
    mockProgramar.mockResolvedValue({ success: false, error: 'Caso cerrado' });
    const { onOpenChange } = abrir({ audiencia: FUTURA });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Caso cerrado'),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('cerrar y reabrir lo deja limpio', async () => {
    const { rerender, base } = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La fecha es requerida'),
    ).toBeInTheDocument();

    rerender(<HearingDialog {...base} open={false} />);
    rerender(<HearingDialog {...base} open />);

    await waitFor(() =>
      expect(screen.queryByText('La fecha es requerida')).toBeNull(),
    );
  });
});
