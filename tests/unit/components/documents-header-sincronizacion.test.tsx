/**
 * @jest-environment jsdom
 */

/**
 * "Sincronizar con Drive" avisa cuando la sincronización quedó a medias.
 *
 * La sincronización lee Drive con un tope de tiempo y deja para la próxima lo
 * que no alcanzó a leer. Antes el resultado solo iba a la consola: el usuario
 * no se enteraba de que faltaban carpetas.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ checkPermission: () => true }),
}));

const mockToastInfo = jest.fn();
jest.mock('sonner', () => ({
  toast: { info: (...a: unknown[]) => mockToastInfo(...a) },
}));

const mockSyncTemplates = jest.fn();
const mockSyncDocuments = jest.fn();
jest.mock('@/features/document/actions', () => ({
  syncTemplatesWithGoogleDrive: () => mockSyncTemplates(),
  syncDocumentsWithGoogleDrive: () => mockSyncDocuments(),
}));

import { DocumentsHeader } from '@/app/documents/components/documents-header';

const resultado = (pendientes: number) => ({
  success: true,
  data: {
    synced: 3,
    created: 3,
    updated: 0,
    unchanged: 0,
    folders: 1,
    pendientes,
  },
});

function sincronizar() {
  const onDocumentsSynced = jest.fn();
  render(
    <DocumentsHeader
      onShowPlaceholders={() => {}}
      onTemplatesSynced={() => {}}
      onDocumentsSynced={onDocumentsSynced}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: /Sincronizar con Drive/ }),
  );
  return onDocumentsSynced;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockSyncTemplates.mockResolvedValue({ success: true, data: {} });
});

describe('DocumentsHeader: resultado de la sincronización', () => {
  it('con carpetas pendientes, avisa cuántas faltan y que hay que volver a sincronizar', async () => {
    mockSyncDocuments.mockResolvedValue(resultado(2));

    const onDocumentsSynced = sincronizar();

    await waitFor(() => expect(onDocumentsSynced).toHaveBeenCalled());
    expect(mockToastInfo).toHaveBeenCalledWith(
      'La sincronización con Drive quedó a medias',
      {
        description:
          'Faltan 2 carpeta(s) por leer. Vuelve a sincronizar para terminar.',
      },
    );
  });

  it('completa, no avisa nada', async () => {
    mockSyncDocuments.mockResolvedValue(resultado(0));

    const onDocumentsSynced = sincronizar();

    await waitFor(() => expect(onDocumentsSynced).toHaveBeenCalled());
    expect(mockToastInfo).not.toHaveBeenCalled();
  });
});
