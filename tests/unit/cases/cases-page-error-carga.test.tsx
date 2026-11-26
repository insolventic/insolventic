/**
 * `/cases` distingue "no hay casos" de "no se pudieron cargar".
 *
 * Antes, la página hacía `casesResult.data ?? { items: [], total: 0 }`: si
 * `getAllCases` fallaba, la pantalla decía "Total Casos 0" sin avisar y el
 * error solo quedaba en el log. Pasó el 2026-11-13 con un Preview apuntado a
 * una rama de Neon sin la columna `deleted_at`: la base tenía 3 casos y la
 * pantalla se veía vacía.
 *
 * Se mira el árbol que devuelve la página (como en
 * `users-page-sin-password.test.tsx`), sin renderizar los componentes cliente:
 * lo que importa es cuál de los dos recibe el control.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import React from 'react';

const mockGetAllCases = jest.fn();
const mockGetCaseStats = jest.fn();
jest.mock('@/features/case/actions', () => ({
  getAllCases: (...args: unknown[]) => mockGetAllCases(...args),
  getCaseStats: (...args: unknown[]) => mockGetCaseStats(...args),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn().mockResolvedValue({ id: 'operador-1' }),
}));

const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  ...jest.requireActual('@/lib/logger'),
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import CasesPage from '@/app/cases/page';
import { CasesContent } from '@/app/cases/components/cases-content';
import { CasesLoadError } from '@/app/cases/components/cases-load-error';
import { mockCookies } from '../../__mocks__/next-headers';

const STATS_VACIAS = {
  total: 0,
  byType: [],
  averageDebt: 0,
  totalDebt: null,
  totalCreditors: null,
};

/** Busca en el árbol que devuelve la página, sin renderizar componentes cliente. */
function buscarElemento(
  nodo: React.ReactNode,
  tipo: React.ElementType,
): React.ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarElemento(hijo, tipo);
      if (encontrado) return encontrado;
    }
    return undefined;
  }
  if (!React.isValidElement<Record<string, unknown>>(nodo)) return undefined;
  if (nodo.type === tipo) return nodo;
  return buscarElemento(nodo.props.children as React.ReactNode, tipo);
}

function renderPagina() {
  return CasesPage({ searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCookies.setToken('access-token', 'token-de-prueba');
  mockGetCaseStats.mockResolvedValue({ success: true, data: STATS_VACIAS });
});

describe('/cases — error al cargar vs. sin casos', () => {
  it('getAllCases devuelve { success: false }: muestra el aviso, no la lista en cero', async () => {
    mockGetAllCases.mockResolvedValue({
      success: false,
      error: 'column "deleted_at" does not exist',
    });

    const pagina = await renderPagina();

    expect(buscarElemento(pagina, CasesLoadError)).toBeDefined();
    expect(buscarElemento(pagina, CasesContent)).toBeUndefined();
    // El detalle técnico no viaja al componente cliente.
    expect(
      JSON.stringify(buscarElemento(pagina, CasesLoadError)!.props),
    ).not.toContain('deleted_at');
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'cases-page' }),
    );
  });

  it('la acción lanza una excepción: muestra el aviso y registra el error', async () => {
    const fallo = new Error('Connection terminated unexpectedly');
    mockGetAllCases.mockRejectedValue(fallo);

    const pagina = await renderPagina();

    expect(buscarElemento(pagina, CasesLoadError)).toBeDefined();
    expect(buscarElemento(pagina, CasesContent)).toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.any(String),
      fallo,
      expect.objectContaining({ action: 'cases-page' }),
    );
  });

  it('fallan solo las estadísticas: tampoco se muestran en cero', async () => {
    mockGetAllCases.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 10 },
    });
    mockGetCaseStats.mockResolvedValue({ success: false, error: 'boom' });

    const pagina = await renderPagina();

    expect(buscarElemento(pagina, CasesLoadError)).toBeDefined();
    expect(buscarElemento(pagina, CasesContent)).toBeUndefined();
  });

  it('carga bien con 0 casos reales: sigue el estado vacío normal, sin aviso', async () => {
    const paginaVacia = { items: [], total: 0, page: 1, pageSize: 10 };
    mockGetAllCases.mockResolvedValue({ success: true, data: paginaVacia });

    const pagina = await renderPagina();

    expect(buscarElemento(pagina, CasesLoadError)).toBeUndefined();
    const contenido = buscarElemento(pagina, CasesContent);
    expect(contenido).toBeDefined();
    expect(contenido!.props.casesPage).toEqual(paginaVacia);
    expect(contenido!.props.stats).toEqual(STATS_VACIAS);
    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
