/**
 * @jest-environment jsdom
 */

/**
 * Las pantallas que muestran el listado de casos funcionan con filas que traen
 * SOLO las columnas de `CASE_LIST_COLUMNS` (lo que ahora devuelve getAllCases).
 *
 * `tsc` ya avisa de cualquier lectura tipada de un campo que no está en la
 * máscara; estos tests cubren lo que el compilador no ve: que el componente
 * realmente renderice sin lanzar con una fila así (un `undefined.toString()` en
 * tiempo de ejecución).
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

import { DEBTOR, CASE_DATA } from '../../helpers/fixtures';

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ checkPermission: () => true }),
}));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

const mockGetAllCases = jest.fn();
jest.mock('@/features/case/actions', () => ({
  getAllCases: (...args: unknown[]) => mockGetAllCases(...args),
}));

import { CaseTable } from '@/app/cases/components/case-table';
import { RecentCases } from '@/app/dashboard/components/recent-cases';
import { CASE_LIST_COLUMNS, getAllCasesSchema } from '@/features/case/schemas';

/** Fila tal cual la devuelve Prisma con el select del listado, pasada por el schema del listado. */
function listItem(overrides: Record<string, unknown> = {}) {
  const base = CASE_DATA as Record<string, unknown>;
  const raw = {
    ...Object.fromEntries(
      Object.keys(CASE_LIST_COLUMNS).map((k) => [k, base[k] ?? null]),
    ),
    id: 'case-1',
    caseNumber: 'INS-2026-001',
    debtorName: 'Ana Torres',
    type: 'INSOLVENCY',
    totalDebt: 50_000_000,
    creditors: 3,
    version: 1,
    createdDate: new Date('2026-03-15T12:00:00Z'),
    hearingDate: null,
    phase: 'Inicial',
    causes: [],
    driveFolderId: null,
    debtor: DEBTOR,
    operator: { id: 'op-1', name: 'Operadora', email: 'op@example.com' },
    _count: { documents: 2 },
    ...overrides,
  };
  return getAllCasesSchema.parse([raw])[0];
}

const noop = () => undefined;

describe('CaseTable con filas del listado (solo CASE_LIST_COLUMNS)', () => {
  it('renderiza número de caso, deudor, tipo y fase sin lanzar', () => {
    render(
      <CaseTable
        cases={[listItem()]}
        onViewDetails={noop}
        onEdit={noop}
        onDelete={noop}
        onChangePhase={noop}
      />,
    );

    expect(screen.getByText('INS-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Insolvencia')).toBeInTheDocument();
  });

  it('con una fase vacía y una audiencia programada también renderiza', () => {
    render(
      <CaseTable
        cases={[
          listItem({
            id: 'case-2',
            caseNumber: 'INS-2026-002',
            phase: null,
            hearingDate: new Date('2026-05-10T15:00:00Z'),
          }),
        ]}
        onViewDetails={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByText('INS-2026-002')).toBeInTheDocument();
  });

  it('varias filas de tipos distintos', () => {
    render(
      <CaseTable
        cases={[
          listItem({ id: 'a', caseNumber: 'INS-1' }),
          listItem({ id: 'b', caseNumber: 'CON-1', type: 'CONCILIATION' }),
          listItem({ id: 'c', caseNumber: 'ACU-1', type: 'SUPPORT_AGREEMENT' }),
        ]}
        onViewDetails={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByText('INS-1')).toBeInTheDocument();
    expect(screen.getByText('CON-1')).toBeInTheDocument();
    expect(screen.getByText('ACU-1')).toBeInTheDocument();
  });
});

describe('RecentCases (dashboard) con filas del listado', () => {
  it('muestra los casos recientes que devuelve getAllCases', async () => {
    mockGetAllCases.mockResolvedValue({
      success: true,
      data: [listItem({ caseNumber: 'INS-2026-777' })],
    });

    render(<RecentCases />);

    await waitFor(() =>
      expect(screen.getByText('INS-2026-777')).toBeInTheDocument(),
    );
  });
});
