/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: comportamiento de DashboardChartsLazy (carga diferida de los
 * gráficos del /dashboard). El guardián de código fuente vive en
 * dashboard-charts-bundle-guard.test.ts.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

import type { DashboardStats } from '@/features/case/schemas';

const mockChartsModule = jest.fn();
jest.mock('@/app/dashboard/components/dashboard-charts', () => {
  mockChartsModule();
  return {
    DashboardCharts: () => <div data-testid="charts-cargados">gráficos</div>,
  };
});

import { DashboardChartsLazy } from '@/app/dashboard/components/dashboard-charts-lazy';

const emptyStats = (): DashboardStats =>
  ({
    totalCases: 0,
    casesThisMonth: 0,
    upcomingHearings: 0,
    totalDebt: 0,
    totalCreditors: 0,
    casesByPhase: [],
    casesByType: [],
    casesOverTime: [],
    overduePayments: 0,
  }) as DashboardStats;

describe('DashboardChartsLazy', () => {
  beforeEach(() => mockChartsModule.mockClear());

  // ORDEN: este es el único test que puede afirmar "el módulo pesado no se pidió".
  // La fábrica de jest.mock corre una sola vez, al primer import; en cuanto un test
  // carga los gráficos, el módulo queda en el registro y `not.toHaveBeenCalled()`
  // pasaría siempre. Por eso va primero. (El guardián de código fuente cubre el resto.)
  it('sin nada que graficar: no renderiza nada y NO pide el chunk de gráficos', async () => {
    const { container } = render(<DashboardChartsLazy stats={emptyStats()} />);

    expect(container).toBeEmptyDOMElement();
    // Dejar pasar microtareas: el módulo pesado no debe cargarse nunca.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockChartsModule).not.toHaveBeenCalled();
  });

  it('con datos: muestra un esqueleto y luego carga los gráficos', async () => {
    const stats = {
      ...emptyStats(),
      casesByType: [{ type: 'Insolvencia', count: 3 }],
    };

    render(<DashboardChartsLazy stats={stats} />);

    // Esqueleto accesible mientras baja el chunk...
    expect(screen.getByRole('status')).toBeInTheDocument();
    // ...y después los gráficos reales.
    expect(await screen.findByTestId('charts-cargados')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
  });

  it.each([
    ['por fase', { casesByPhase: [{ phase: 'Inicial', count: 2 }] }],
    ['en el tiempo', { casesOverTime: [{ month: '2026-09', count: 4 }] }],
  ])('carga con datos %s', async (_label, patch) => {
    render(<DashboardChartsLazy stats={{ ...emptyStats(), ...patch }} />);

    expect(await screen.findByTestId('charts-cargados')).toBeInTheDocument();
  });

  it('casesOverTime con todo en cero cuenta como "sin datos" (igual que antes)', async () => {
    const stats = {
      ...emptyStats(),
      casesOverTime: [
        { month: '2026-08', count: 0 },
        { month: '2026-09', count: 0 },
      ],
    };

    const { container } = render(<DashboardChartsLazy stats={stats} />);

    expect(container).toBeEmptyDOMElement();
  });
});
