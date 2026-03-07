/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/documents',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner toast
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};
jest.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock useAuth
const mockCheckPermission = jest.fn();
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    checkPermission: mockCheckPermission,
    user: { id: '1', name: 'Test', permissions: [] },
  }),
}));

// Mock server actions
const mockGetAllCases = jest.fn();
const mockBatchGenerateDocuments = jest.fn();

jest.mock('@/features/case/actions', () => ({
  getAllCases: (...args: unknown[]) => mockGetAllCases(...args),
}));

jest.mock('@/features/document/actions', () => ({
  batchGenerateDocuments: (...args: unknown[]) => mockBatchGenerateDocuments(...args),
}));

// Mock Radix Popover (simplify for testing)
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="popover" data-open={open}>{children}</div>
  ),
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

// Mock Command (cmdk)
jest.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command">{children}</div>
  ),
  CommandInput: ({ placeholder }: { placeholder?: string; className?: string }) => (
    <input data-testid="command-input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-list">{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-group">{children}</div>
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    value?: string;
  }) => (
    <div data-testid="command-item" data-value={value} onClick={onSelect} role="option">
      {children}
    </div>
  ),
}));

// Mock Select
jest.mock('@/components/ui/select', () => ({
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
    <div data-testid="select" data-value={value} data-disabled={disabled}>
      {children}
      <select
        data-testid="select-native"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="all">Todos los paquetes (49 doc.)</option>
        <option value="1">Paquete 1 - Solicitud (6 doc.)</option>
        <option value="2">Paquete 2 - Admisión (7 doc.)</option>
        <option value="3">Paquete 3 - Negociación (6 doc.)</option>
        <option value="4">Paquete 4 - Terminación (3 doc.)</option>
        <option value="5">Paquete 5 - Fracaso (27 doc.)</option>
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
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
  }) => (
    <option data-testid="select-item" value={value}>
      {children}
    </option>
  ),
}));

// Minimal mocks for remaining UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="card-description">{children}</p>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    title,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    title?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} title={title} className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    role,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    role?: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      role={role}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock lucide icons
jest.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className} />
    );
    Icon.displayName = name;
    return Icon;
  };

  return {
    Wand2: createIcon('Wand2'),
    Check: createIcon('Check'),
    FileDown: createIcon('FileDown'),
    Loader2: createIcon('Loader2'),
    ChevronsUpDown: createIcon('ChevronsUpDown'),
    Package: createIcon('Package'),
    ExternalLink: createIcon('ExternalLink'),
    AlertCircle: createIcon('AlertCircle'),
    FolderOpen: createIcon('FolderOpen'),
    Info: createIcon('Info'),
    XCircle: createIcon('XCircle'),
    FileText: createIcon('FileText'),
  };
});

// ─── Import component ─────────────────────────────────────────────────────────

import { DocumentGeneration } from '@/app/documents/components/document-generation';

// ─── Test Data ────────────────────────────────────────────────────────────────

const MOCK_CASES = [
  {
    id: 'case-1',
    caseNumber: 'INS-2025-001',
    debtorName: 'Juan Pérez',
    type: 'Insolvencia',
    _count: { documents: 5 },
    driveFolderId: 'drive-folder-123',
    phase: 'Admisión',
  },
  {
    id: 'case-2',
    caseNumber: 'CON-2025-002',
    debtorName: 'María García',
    type: 'Conciliación',
    _count: { documents: 0 },
    driveFolderId: null,
    phase: null,
  },
  {
    id: 'case-3',
    caseNumber: 'ACU-2025-003',
    debtorName: 'Carlos López',
    type: 'Acuerdo de Apoyo',
    _count: { documents: 12 },
    driveFolderId: 'drive-folder-456',
    phase: 'Negociación',
  },
];

const MOCK_GENERATION_RESULT = {
  success: true,
  data: {
    caseId: 'case-1',
    caseNumber: 'INS-2025-001',
    folderId: 'folder-abc',
    folderUrl: 'https://drive.google.com/drive/folders/folder-abc',
    documents: [
      {
        templateId: 'tpl-1',
        templateName: 'Solicitud de Insolvencia',
        documentId: 'doc-1',
        documentName: 'Solicitud_de_Insolvencia_INS-2025-001.pdf',
        documentUrl: 'https://drive.google.com/file/d/doc-1/view',
        status: 'success' as const,
      },
      {
        templateId: 'tpl-2',
        templateName: 'Poder Especial',
        documentId: 'doc-2',
        documentName: 'Poder_Especial_INS-2025-001.pdf',
        documentUrl: 'https://drive.google.com/file/d/doc-2/view',
        status: 'success' as const,
      },
      {
        templateId: 'tpl-3',
        templateName: 'Declaración Juramentada',
        documentId: '',
        documentName: 'Declaracion_Juramentada_INS-2025-001.pdf',
        documentUrl: '',
        status: 'error' as const,
        error: 'Error leyendo plantilla: ENOENT',
      },
    ],
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    totalDocuments: 3,
    successfulDocuments: 2,
    failedDocuments: 1,
  },
  message: 'Generación completada: 2 exitosos, 1 fallidos',
};

const MOCK_SUCCESS_RESULT = {
  success: true,
  data: {
    caseId: 'case-2',
    caseNumber: 'CON-2025-002',
    folderId: 'folder-xyz',
    folderUrl: 'https://drive.google.com/drive/folders/folder-xyz',
    documents: [
      {
        templateId: 'tpl-1',
        templateName: 'Solicitud',
        documentId: 'doc-a',
        documentName: 'Solicitud_CON-2025-002.pdf',
        documentUrl: 'https://drive.google.com/file/d/doc-a/view',
        status: 'success' as const,
      },
    ],
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    totalDocuments: 1,
    successfulDocuments: 1,
    failedDocuments: 0,
  },
  message: 'Generación completada: 1 exitosos, 0 fallidos',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DocumentGeneration', () => {
  const mockOnDocumentsGenerated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPermission.mockReturnValue(true);
    mockGetAllCases.mockResolvedValue({
      success: true,
      data: MOCK_CASES,
    });
    mockBatchGenerateDocuments.mockResolvedValue(MOCK_SUCCESS_RESULT);
  });

  // ─── Rendering ──────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders the component with title and description', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(screen.getByText('Generación de Documentos')).toBeInTheDocument();
      expect(
        screen.getByText(/Selecciona un caso y un paquete para generar documentos/),
      ).toBeInTheDocument();
    });

    it('renders case selector with placeholder text', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(
        screen.getByText('Buscar y seleccionar caso...'),
      ).toBeInTheDocument();
    });

    it('renders package selector with all package options', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(screen.getByText('Paquete de Documentos')).toBeInTheDocument();
    });

    it('renders generate button', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(
        screen.getByText('Generar Documentos'),
      ).toBeInTheDocument();
    });

    it('shows permission notice when user lacks Generar documentos permission', async () => {
      mockCheckPermission.mockReturnValue(false);

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(
        screen.getByText(/No tienes permisos para generar documentos/),
      ).toBeInTheDocument();
    });

    it('does not show permission notice when user has permission', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      expect(
        screen.queryByText(/No tienes permisos para generar documentos/),
      ).not.toBeInTheDocument();
    });
  });

  // ─── Case Loading ───────────────────────────────────────────────────────

  describe('Case Loading', () => {
    it('calls getAllCases on mount', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(mockGetAllCases).toHaveBeenCalledTimes(1);
      });
    });

    it('renders case items from getAllCases response', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        expect(screen.getByText('CON-2025-002')).toBeInTheDocument();
        expect(screen.getByText('María García')).toBeInTheDocument();
        expect(screen.getByText('ACU-2025-003')).toBeInTheDocument();
        expect(screen.getByText('Carlos López')).toBeInTheDocument();
      });
    });

    it('renders case type badges in the combobox items', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('Insolvencia')).toBeInTheDocument();
        expect(screen.getByText('Conciliación')).toBeInTheDocument();
        expect(screen.getByText('Acuerdo de Apoyo')).toBeInTheDocument();
      });
    });

    it('handles getAllCases failure gracefully', async () => {
      mockGetAllCases.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      // Should still render without crashing
      expect(screen.getByText('Generación de Documentos')).toBeInTheDocument();
    });
  });

  // ─── Case Selection ─────────────────────────────────────────────────────

  describe('Case Selection', () => {
    it('shows selected case info panel after selection', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // Click on case to select it
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]); // Select case-1

      // Should show case info panel
      await waitFor(() => {
        expect(screen.getByText('5 doc. existentes')).toBeInTheDocument();
      });
    });

    it('shows existing documents warning when case has documents', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // Select case-1 which has 5 documents
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/ya tiene 5 documento\(s\) generado\(s\)/),
        ).toBeInTheDocument();
      });
    });

    it('does NOT show existing documents warning when case has zero documents', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('CON-2025-002')).toBeInTheDocument();
      });

      // Select case-2 which has 0 documents
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[1]);

      await waitFor(() => {
        expect(screen.getByText('0 doc. existentes')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/ya tiene .* documento\(s\) generado\(s\)/),
      ).not.toBeInTheDocument();
    });

    it('shows phase badge when case has a phase', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      await waitFor(() => {
        expect(screen.getByText('Admisión')).toBeInTheDocument();
      });
    });

    it('shows document count info for selected package', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/Se generarán/),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Generate Button State ──────────────────────────────────────────────

  describe('Generate Button State', () => {
    it('disables generate button when no case is selected', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      const generateBtn = screen.getByText('Generar Documentos').closest('button');
      expect(generateBtn).toBeDisabled();
    });

    it('enables generate button when case is selected and has permission', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button');
      expect(generateBtn).not.toBeDisabled();
    });

    it('disables generate button when user lacks permission', async () => {
      mockCheckPermission.mockReturnValue(false);

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button');
      expect(generateBtn).toBeDisabled();
    });
  });

  // ─── Document Generation ────────────────────────────────────────────────

  describe('Document Generation', () => {
    it('calls batchGenerateDocuments with correct caseId and default package (all)', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // Select case
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      // Click generate
      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockBatchGenerateDocuments).toHaveBeenCalledWith({
          caseId: 'case-1',
          packageNumber: undefined, // 'all' => undefined
        });
      });
    });

    it('calls batchGenerateDocuments with specific packageNumber when selected', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // Select case
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      // Change package to "3"
      const selectNative = screen.getByTestId('select-native');
      fireEvent.change(selectNative, { target: { value: '3' } });

      // Click generate
      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockBatchGenerateDocuments).toHaveBeenCalledWith({
          caseId: 'case-1',
          packageNumber: 3,
        });
      });
    });

    it('calls onDocumentsGenerated callback on success', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockOnDocumentsGenerated).toHaveBeenCalled();
      });
    });

    it('shows success toast on successful generation', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('documentos generados exitosamente'),
        );
      });
    });

    it('shows error toast on failed generation', async () => {
      mockBatchGenerateDocuments.mockResolvedValue({
        success: false,
        message: 'Caso no encontrado',
        data: null,
      });

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Caso no encontrado'),
        );
      });
    });
  });

  // ─── Generation Results ─────────────────────────────────────────────────

  describe('Generation Results', () => {
    it('shows successful generation results with completion summary', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText('Generación Completada')).toBeInTheDocument();
      });
    });

    it('shows Google Drive folder link when folderUrl is available', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[1]); // Select case-2

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        const driveLink = screen.getByText('Abrir en Drive');
        expect(driveLink).toBeInTheDocument();
        const anchor = driveLink.closest('a');
        expect(anchor).toHaveAttribute(
          'href',
          'https://drive.google.com/drive/folders/folder-xyz',
        );
        expect(anchor).toHaveAttribute('target', '_blank');
      });
    });

    it('shows document badges with clickable Drive links', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('CON-2025-002')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[1]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        // Check that the document badge is rendered
        expect(screen.getByText('Solicitud')).toBeInTheDocument();
        // Check it has an anchor parent
        const badge = screen.getByText('Solicitud');
        const anchor = badge.closest('a');
        expect(anchor).toHaveAttribute(
          'href',
          'https://drive.google.com/file/d/doc-a/view',
        );
      });
    });

    it('shows failed documents with error toggle', async () => {
      mockBatchGenerateDocuments.mockResolvedValue(MOCK_GENERATION_RESULT);

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/1 documento\(s\) con error/),
        ).toBeInTheDocument();
      });
    });

    it('toggles error details when clicking on error toggle', async () => {
      mockBatchGenerateDocuments.mockResolvedValue(MOCK_GENERATION_RESULT);

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/1 documento\(s\) con error/),
        ).toBeInTheDocument();
      });

      // Error details should not be visible initially
      expect(
        screen.queryByText('Error leyendo plantilla: ENOENT'),
      ).not.toBeInTheDocument();

      // Click toggle to show errors
      fireEvent.click(screen.getByText(/1 documento\(s\) con error/));

      // Now error details should be visible
      expect(
        screen.getByText('Error leyendo plantilla: ENOENT'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Declaración Juramentada'),
      ).toBeInTheDocument();
    });

    it('shows amber/warning style when there are failed documents', async () => {
      mockBatchGenerateDocuments.mockResolvedValue(MOCK_GENERATION_RESULT);

      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/1 documento\(s\) fallaron/),
        ).toBeInTheDocument();
      });
    });

    it('clears generation result when case changes', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // Select case and generate
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[1]); // case-2

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText('Generación Completada')).toBeInTheDocument();
      });

      // Now select a different case
      fireEvent.click(caseItems[0]); // case-1

      // Generation result should be cleared
      await waitFor(() => {
        expect(
          screen.queryByText('Generación Completada'),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ─── Package Selection ──────────────────────────────────────────────────

  describe('Package Selection', () => {
    it('defaults to "all" package', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      const selectEl = screen.getByTestId('select');
      expect(selectEl).toHaveAttribute('data-value', 'all');
    });

    it('sends undefined packageNumber for "all" selection', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockBatchGenerateDocuments).toHaveBeenCalledWith({
          caseId: 'case-1',
          packageNumber: undefined,
        });
      });
    });

    it('sends specific packageNumber (1-5) when selected', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      // Select package 5
      const selectNative = screen.getByTestId('select-native');
      fireEvent.change(selectNative, { target: { value: '5' } });

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockBatchGenerateDocuments).toHaveBeenCalledWith({
          caseId: 'case-1',
          packageNumber: 5,
        });
      });
    });
  });

  // ─── Integration ────────────────────────────────────────────────────────

  describe('Integration: batchGenerateDocuments pipeline', () => {
    it('invokes batchGenerateDocuments (not actions-generation pipeline)', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        // Verify the correct action was called
        expect(mockBatchGenerateDocuments).toHaveBeenCalledTimes(1);
        // Verify the arguments structure matches batchGenerateDocuments signature
        const args = mockBatchGenerateDocuments.mock.calls[0][0];
        expect(args).toHaveProperty('caseId');
        expect(args.caseId).toBe('case-1');
      });
    });

    it('passes packageNumber as typed number (1|2|3|4|5), not string', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      await waitFor(() => {
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[0]);

      const selectNative = screen.getByTestId('select-native');
      fireEvent.change(selectNative, { target: { value: '2' } });

      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      await waitFor(() => {
        const args = mockBatchGenerateDocuments.mock.calls[0][0];
        expect(args.packageNumber).toBe(2);
        expect(typeof args.packageNumber).toBe('number');
      });
    });

    it('handles the full flow: load cases → select → generate → show results', async () => {
      render(
        <DocumentGeneration onDocumentsGenerated={mockOnDocumentsGenerated} />,
      );

      // 1. Cases are loaded
      await waitFor(() => {
        expect(mockGetAllCases).toHaveBeenCalled();
        expect(screen.getByText('INS-2025-001')).toBeInTheDocument();
      });

      // 2. Select a case
      const caseItems = screen.getAllByTestId('command-item');
      fireEvent.click(caseItems[1]); // CON-2025-002

      // 3. Verify case info is shown
      await waitFor(() => {
        expect(screen.getByText('0 doc. existentes')).toBeInTheDocument();
      });

      // 4. Generate
      const generateBtn = screen.getByText('Generar Documentos').closest('button')!;
      fireEvent.click(generateBtn);

      // 5. Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText('Generación Completada')).toBeInTheDocument();
        expect(screen.getByText('Abrir en Drive')).toBeInTheDocument();
        expect(mockOnDocumentsGenerated).toHaveBeenCalled();
      });
    });
  });
});
