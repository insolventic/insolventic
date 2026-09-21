/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: comportamiento de GlobalSearch (shell liviano) con el diálogo
 * cargado de forma diferida. El guardián de código fuente vive en
 * global-search-bundle-guard.test.ts.
 *
 * ORDEN: el primer test es el único que puede afirmar "el módulo pesado aún no
 * se pidió": la fábrica de jest.mock corre una sola vez, cuando se importa el
 * módulo por primera vez, y después queda en el registro. Los demás tests
 * afirman sobre el DOM.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockDialogModule = jest.fn();
jest.mock('@/components/global-search-dialog', () => {
  mockDialogModule();
  return {
    GlobalSearchDialog: ({ open }: { open: boolean }) => (
      <div data-testid="dialogo" data-open={String(open)} />
    ),
  };
});

import { GlobalSearch } from '@/components/global-search';

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const ctrlK = () =>
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true, bubbles: true });

describe('GlobalSearch (carga diferida del diálogo)', () => {
  it('no pide el módulo pesado al montarse; sí lo precarga por intención sin abrir nada', async () => {
    render(<GlobalSearch />);
    await tick();

    // Al montarse: solo el botón. Ni módulo pesado ni diálogo.
    expect(screen.getByRole('button', { name: /buscar/i })).toBeInTheDocument();
    expect(mockDialogModule).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dialogo')).not.toBeInTheDocument();

    // Pasar el mouse por el botón empieza la descarga...
    fireEvent.mouseEnter(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(mockDialogModule).toHaveBeenCalledTimes(1));
    // ...pero no monta ni abre el diálogo.
    expect(screen.queryByTestId('dialogo')).not.toBeInTheDocument();
  });

  it.each([
    ['el foco (teclado)', (b: HTMLElement) => fireEvent.focus(b)],
    ['el toque (móvil)', (b: HTMLElement) => fireEvent.touchStart(b)],
  ])('precargar con %s tampoco monta el diálogo', async (_n, intent) => {
    render(<GlobalSearch />);

    intent(screen.getByRole('button', { name: /buscar/i }));
    await tick();

    expect(screen.queryByTestId('dialogo')).not.toBeInTheDocument();
  });

  it('un montaje sin ninguna acción del usuario no muestra el diálogo', async () => {
    render(<GlobalSearch />);
    await tick();

    expect(screen.queryByTestId('dialogo')).not.toBeInTheDocument();
  });

  it('al hacer clic carga el diálogo y lo abre', async () => {
    render(<GlobalSearch />);

    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    const dialogo = await screen.findByTestId('dialogo');
    expect(dialogo).toHaveAttribute('data-open', 'true');
  });

  it.each([
    ['Ctrl+K', { key: 'k', ctrlKey: true }],
    ['Cmd+K', { key: 'k', metaKey: true }],
  ])('%s abre el diálogo aunque no se haya tocado el botón', async (_n, ev) => {
    render(<GlobalSearch />);

    fireEvent.keyDown(document, { ...ev, bubbles: true });

    const dialogo = await screen.findByTestId('dialogo');
    expect(dialogo).toHaveAttribute('data-open', 'true');
  });

  it('Ctrl+K alterna: una segunda pulsación cierra el diálogo sin desmontarlo', async () => {
    render(<GlobalSearch />);

    ctrlK();
    expect(await screen.findByTestId('dialogo')).toHaveAttribute(
      'data-open',
      'true',
    );

    ctrlK();
    await waitFor(() =>
      expect(screen.getByTestId('dialogo')).toHaveAttribute(
        'data-open',
        'false',
      ),
    );
  });

  it('la tecla k sola, o con otro modificador, no hace nada', async () => {
    render(<GlobalSearch />);

    fireEvent.keyDown(document, { key: 'k', bubbles: true });
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true, bubbles: true });
    await tick();

    expect(screen.queryByTestId('dialogo')).not.toBeInTheDocument();
  });
});
