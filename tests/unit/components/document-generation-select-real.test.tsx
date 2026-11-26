/**
 * @jest-environment jsdom
 */
/**
 * El selector de paquete de /documents con el `Select` REAL (Radix), sin caso
 * elegido y después de elegir uno.
 *
 * Por qué un archivo aparte: `document-generation.test.tsx` reemplaza
 * `@/components/ui/select` por un `<select>` nativo que siempre pinta sus
 * propias opciones y nunca su placeholder. Con ese mock, un `value="all"` sin
 * ninguna opción que lo represente se ve igual que uno válido, así que no
 * podía detectar lo que pasaba en el navegador: Radix solo muestra el
 * placeholder con `value` vacío (`shouldShowPlaceholder`), y con `'all'` el
 * trigger quedaba en blanco en vez de decir "Primero selecciona un caso".
 *
 * Se mockean solo las acciones, la sesión y el selector de casos (popover y
 * command, que no son lo que se prueba acá).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/documents',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    checkPermission: () => true,
    user: { id: '1', name: 'Test', permissions: [] },
  }),
}));

const mockGetCasesForSelector = jest.fn();
jest.mock('@/features/case/actions', () => ({
  getCasesForSelector: (...args: unknown[]) => mockGetCasesForSelector(...args),
}));

jest.mock('@/features/document/actions', () => ({
  batchGenerateDocuments: jest.fn(),
  planBatchGeneration: jest.fn(),
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandInput: () => <input />,
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <div data-testid="command-item" onClick={onSelect}>
      {children}
    </div>
  ),
}));

import { DocumentGeneration } from '@/app/documents/components/document-generation';

const CASOS = [
  {
    id: 'case-2',
    caseNumber: 'CON-2025-002',
    debtorName: 'María García',
    type: 'Conciliación',
    _count: { documents: 0 },
    driveFolderId: null,
    phase: null,
  },
];

/**
 * El trigger del selector de paquete: el `button[role=combobox]` real de
 * Radix. La pantalla tiene tres, en orden: caso, paquete y formato.
 */
function triggerDelPaquete(): HTMLElement {
  const [caso, paquete, formato] = screen.getAllByRole('combobox');
  // Sanity: si cambia el orden, el test estaría mirando otro selector.
  expect(caso).toHaveTextContent(/CON-2025-002|Buscar y seleccionar caso/);
  expect(formato).toHaveTextContent('Solo PDF');
  return paquete;
}

describe('selector de paquete con el Select real', () => {
  beforeEach(() => {
    mockGetCasesForSelector.mockResolvedValue({
      success: true,
      data: { items: CASOS, total: CASOS.length, limit: 500 },
    });
  });

  it('sin caso elegido: deshabilitado, con el placeholder visible y sin valor', async () => {
    render(<DocumentGeneration onDocumentsGenerated={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('CON-2025-002')).toBeInTheDocument();
    });

    const trigger = triggerDelPaquete();
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Primero selecciona un caso');
    // Radix marca el trigger con data-placeholder solo cuando el valor es
    // vacío: es lo que confirma que no le llega 'all'.
    expect(trigger).toHaveAttribute('data-placeholder');
  });

  it('con un caso elegido: habilitado y con "Todos los paquetes" del tipo del caso', async () => {
    render(<DocumentGeneration onDocumentsGenerated={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('CON-2025-002')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('command-item'));

    const trigger = triggerDelPaquete();
    expect(trigger).toBeEnabled();
    expect(trigger).not.toHaveAttribute('data-placeholder');
    expect(trigger).toHaveTextContent('Todos los paquetes (12 doc.)');
  });
});
