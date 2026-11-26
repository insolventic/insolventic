/**
 * @jest-environment jsdom
 */

/**
 * Diálogo de aceptación de términos (N-G-07), con el Dialog real de Radix.
 *
 *  - Con documentos pendientes, bloquea: no se cierra con Escape y no tiene X.
 *  - Sin pendientes, o si la consulta falla, no aparece (falla abierto).
 *  - El error de "marque las casillas" sale solo después de pulsar Aceptar
 *    (regla de formularios de CLAUDE.md), y todos los botones son type=button.
 *  - Aceptar manda la versión que se mostró y cierra el diálogo.
 *  - Ya al día, navegar a otra página no vuelve a consultar.
 */

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPendientes = jest.fn();
const mockAceptar = jest.fn();
jest.mock('@/features/legal/actions', () => ({
  getAceptacionesPendientes: (...a: unknown[]) => mockPendientes(...a),
  aceptarDocumentosLegales: (...a: unknown[]) => mockAceptar(...a),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import {
  AceptacionTerminosGate,
  _olvidarAceptacionEnPestana,
} from '@/components/legal/aceptacion-terminos';
import { PRIVACIDAD, TERMINOS } from '@/features/legal/documentos';

const USUARIO = 'tenant-a:user-1';

function montar(onLogout = jest.fn(), usuario = USUARIO) {
  return render(
    <AceptacionTerminosGate usuario={usuario} onLogout={onLogout} />,
  );
}

const dialogo = () => screen.queryByTestId('aceptacion-terminos');

beforeEach(() => {
  _olvidarAceptacionEnPestana();
  mockPendientes.mockReset();
  mockAceptar.mockReset();
});

describe('AceptacionTerminosGate', () => {
  it('sin aceptación previa muestra los dos documentos y bloquea', async () => {
    mockPendientes.mockResolvedValue({
      success: true,
      data: [TERMINOS, PRIVACIDAD],
    });

    montar();

    expect(
      await screen.findByTestId('aceptacion-terminos'),
    ).toBeInTheDocument();
    expect(screen.getByText(TERMINOS.casilla)).toBeInTheDocument();
    expect(screen.getByText(PRIVACIDAD.casilla)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();

    fireEvent.keyDown(dialogo()!, { key: 'Escape' });
    expect(dialogo()).toBeInTheDocument();
  });

  it('los enlaces abren cada documento en otra pestaña', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [TERMINOS] });

    montar();

    const enlace = await screen.findByRole('link', { name: TERMINOS.titulo });
    expect(enlace).toHaveAttribute('href', '/terminos');
    expect(enlace).toHaveAttribute('target', '_blank');
  });

  it('con la versión vigente aceptada no aparece', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [] });

    montar();

    await waitFor(() => expect(mockPendientes).toHaveBeenCalled());
    expect(dialogo()).toBeNull();
  });

  it('si la consulta devuelve error, no bloquea (falla abierto)', async () => {
    mockPendientes.mockResolvedValue({ success: false, error: 'db' });

    montar();

    await waitFor(() => expect(mockPendientes).toHaveBeenCalled());
    expect(dialogo()).toBeNull();
  });

  it('si la action rechaza la promesa, tampoco bloquea', async () => {
    mockPendientes.mockRejectedValue(new Error('network'));

    montar();

    await waitFor(() => expect(mockPendientes).toHaveBeenCalled());
    expect(dialogo()).toBeNull();
  });

  it('el error de las casillas sale solo después de pulsar Aceptar', async () => {
    mockPendientes.mockResolvedValue({
      success: true,
      data: [TERMINOS, PRIVACIDAD],
    });

    montar();
    await screen.findByTestId('aceptacion-terminos');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Aceptar y continuar' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Marque las casillas para continuar.',
    );
    expect(mockAceptar).not.toHaveBeenCalled();
  });

  it('todos los botones son type=button', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [TERMINOS] });

    montar();
    await screen.findByTestId('aceptacion-terminos');

    for (const nombre of ['Aceptar y continuar', 'Cerrar sesión']) {
      expect(screen.getByRole('button', { name: nombre })).toHaveAttribute(
        'type',
        'button',
      );
    }
  });

  it('aceptar manda la versión mostrada y cierra el diálogo', async () => {
    mockPendientes.mockResolvedValue({
      success: true,
      data: [TERMINOS, PRIVACIDAD],
    });
    mockAceptar.mockResolvedValue({ success: true, data: [] });

    montar();
    await screen.findByTestId('aceptacion-terminos');
    fireEvent.click(screen.getByLabelText(TERMINOS.casilla));
    fireEvent.click(screen.getByLabelText(PRIVACIDAD.casilla));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Aceptar y continuar' }),
      );
    });

    expect(mockAceptar).toHaveBeenCalledWith({
      aceptados: [
        { documento: 'terminos', version: TERMINOS.version },
        { documento: 'privacidad', version: PRIVACIDAD.version },
      ],
    });
    await waitFor(() => expect(dialogo()).toBeNull());
  });

  it('si el registro falla, muestra el error y sigue bloqueando', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [TERMINOS] });
    mockAceptar.mockResolvedValue({
      success: false,
      error: 'No se pudo registrar la aceptación. Intente de nuevo.',
    });

    montar();
    await screen.findByTestId('aceptacion-terminos');
    fireEvent.click(screen.getByLabelText(TERMINOS.casilla));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Aceptar y continuar' }),
      );
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo registrar la aceptación',
    );
    expect(dialogo()).toBeInTheDocument();
  });

  it('Cerrar sesión llama a onLogout', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [TERMINOS] });
    const onLogout = jest.fn();

    montar(onLogout);
    await screen.findByTestId('aceptacion-terminos');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onLogout).toHaveBeenCalled();
  });

  it('ya al día, otra página no vuelve a consultar; otra cuenta sí', async () => {
    mockPendientes.mockResolvedValue({ success: true, data: [] });

    const primera = montar();
    await waitFor(() => expect(mockPendientes).toHaveBeenCalledTimes(1));
    primera.unmount();

    const segunda = montar();
    await act(async () => undefined);
    expect(mockPendientes).toHaveBeenCalledTimes(1);
    segunda.unmount();

    montar(jest.fn(), 'tenant-a:user-2');
    await waitFor(() => expect(mockPendientes).toHaveBeenCalledTimes(2));
  });
});
