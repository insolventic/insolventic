/**
 * @jest-environment jsdom
 */

/**
 * Las tres pantallas que listan casos distinguen "no hay casos" de "no se
 * pudieron cargar", y ante el error ofrecen reintentar sin mostrar el detalle
 * técnico (el `error.message` de Prisma que devuelve la acción).
 *
 * - `CasesLoadError`: el aviso que `/cases` muestra en lugar de la lista
 *   (la decisión de mostrarlo la cubre `cases-page-error-carga.test.tsx`).
 * - `RecentCases` (dashboard): antes decía "No hay casos recientes".
 * - `PapeleraDialog`: antes mostraba el mensaje crudo de la acción y, si la
 *   acción lanzaba, se quedaba en "Cargando la papelera..." para siempre.
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

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }),
}));

jest.mock('@/app/dashboard/components/dashboard-header', () => ({
  DashboardHeader: () => <header />,
}));

const mockGetAllCases = jest.fn();
jest.mock('@/features/case/actions', () => ({
  getAllCases: (...args: unknown[]) => mockGetAllCases(...args),
}));

const mockGetDeletedCases = jest.fn();
jest.mock('@/features/case/actions-papelera', () => ({
  getDeletedCases: (...args: unknown[]) => mockGetDeletedCases(...args),
  purgeCase: jest.fn(),
  restoreCase: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockLoggerWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  ...jest.requireActual('@/lib/logger'),
  logger: {
    error: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { CasesLoadError } from '@/app/cases/components/cases-load-error';
import { PapeleraDialog } from '@/app/cases/components/papelera-dialog';
import { RecentCases } from '@/app/dashboard/components/recent-cases';

const DETALLE_TECNICO = 'column "deleted_at" does not exist';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CasesLoadError', () => {
  it('avisa en español, sin detalle técnico, y "Reintentar" vuelve a pedir la página', () => {
    render(<CasesLoadError />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los casos',
    );
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('RecentCases (dashboard)', () => {
  it('{ success: false }: aviso de error, no "No hay casos recientes"', async () => {
    mockGetAllCases.mockResolvedValue({
      success: false,
      error: DETALLE_TECNICO,
    });

    render(<RecentCases />);

    expect(
      await screen.findByText(/no se pudieron cargar los casos recientes/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No hay casos recientes'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/deleted_at/)).not.toBeInTheDocument();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('la acción lanza: aviso de error, y "Reintentar" vuelve a consultar', async () => {
    mockGetAllCases.mockRejectedValueOnce(new Error('Failed to fetch'));
    mockGetAllCases.mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 5 },
    });

    render(<RecentCases />);

    expect(
      await screen.findByText(/no se pudieron cargar los casos recientes/i),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    });

    expect(mockGetAllCases).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText('No hay casos recientes'),
    ).toBeInTheDocument();
  });

  it('carga bien con 0 casos: estado vacío normal, sin aviso', async () => {
    mockGetAllCases.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 5 },
    });

    render(<RecentCases />);

    expect(
      await screen.findByText('No hay casos recientes'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

describe('PapeleraDialog', () => {
  function abrir() {
    return render(
      <PapeleraDialog
        open
        onOpenChange={jest.fn()}
        puedeEliminarDefinitivamente={false}
      />,
    );
  }

  it('{ success: false }: aviso genérico, sin el mensaje crudo de la acción', async () => {
    mockGetDeletedCases.mockResolvedValue({
      success: false,
      error: DETALLE_TECNICO,
    });

    abrir();

    expect(
      await screen.findByText(/no se pudo cargar la papelera/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/deleted_at/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('La papelera está vacía.'),
    ).not.toBeInTheDocument();
  });

  it('la acción lanza: no se queda cargando; aviso y "Reintentar" vuelve a consultar', async () => {
    mockGetDeletedCases.mockRejectedValueOnce(new Error('Failed to fetch'));
    mockGetDeletedCases.mockResolvedValueOnce({ success: true, data: [] });

    abrir();

    expect(
      await screen.findByText(/no se pudo cargar la papelera/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cargando la papelera/i)).not.toBeInTheDocument();

    // El botón queda deshabilitado mientras la transición sigue pendiente; el
    // aviso puede pintarse un instante antes de que termine.
    const reintentar = screen.getByRole('button', { name: /reintentar/i });
    await waitFor(() => expect(reintentar).toBeEnabled());
    await act(async () => {
      fireEvent.click(reintentar);
    });

    expect(mockGetDeletedCases).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText('La papelera está vacía.'),
    ).toBeInTheDocument();
  });

  it('carga bien y está vacía: estado vacío normal, sin aviso', async () => {
    mockGetDeletedCases.mockResolvedValue({ success: true, data: [] });

    abrir();

    expect(
      await screen.findByText('La papelera está vacía.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
