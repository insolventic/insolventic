/**
 * @jest-environment jsdom
 */

/**
 * Borradores de formularios y cierre de sesión.
 *
 * - Cierre VOLUNTARIO (menú del encabezado: "Cerrar Sesión" o "Cambiar
 *   Organización", en el menú de escritorio y en el móvil): borra los
 *   borradores de esa persona en este navegador, y solo los suyos.
 * - Cierre por INACTIVIDAD (use-session-timeout → logout()): los conserva,
 *   para restaurarlos al volver a entrar.
 */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom';

const mockLogout = jest.fn();
const mockSwitchDatabase = jest.fn();
const USUARIO = {
  id: 'u-ana',
  tenantId: 'armonia',
  name: 'Ana Torres',
  email: 'ana@centro.test',
  roleName: 'Abogada',
  permissions: [],
};
const mockAuth = {
  user: USUARIO,
  isLoading: false,
  isAuthenticated: true,
  logout: (...a: unknown[]) => mockLogout(...a),
  switchDatabase: (...a: unknown[]) => mockSwitchDatabase(...a),
  checkPermission: () => true,
};
jest.mock('@/hooks/use-auth', () => ({ useAuth: () => mockAuth }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/cases',
}));
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));
jest.mock('@/features/notification/actions', () => ({
  getUnreadCount: jest.fn().mockResolvedValue({ success: true, data: 0 }),
}));
jest.mock('@/components/global-search', () => ({ GlobalSearch: () => null }));
jest.mock('@/components/auth/change-password-dialog', () => ({
  ChangePasswordDialog: () => null,
}));
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn() },
}));

import { DashboardHeaderClient } from '@/app/dashboard/components/dashboard-header-client';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { claveBorrador, guardarBorrador } from '@/lib/borradores';
import { logger } from '@/lib/logger';

const ANA = { userId: USUARIO.id, tenantId: USUARIO.tenantId };
const BETO = { userId: 'u-beto', tenantId: 'armonia' };

function sembrarBorradores() {
  localStorage.clear();
  guardarBorrador(localStorage, ANA, 'caso-nuevo:INSOLVENCY', null, 1, {
    a: 1,
  });
  guardarBorrador(localStorage, ANA, 'deudor-edicion', 'd-1', 1, { b: 2 });
  guardarBorrador(localStorage, BETO, 'caso-nuevo:INSOLVENCY', null, 1, {
    c: 3,
  });
}
const deAna = () =>
  [
    claveBorrador(ANA, 'caso-nuevo:INSOLVENCY'),
    claveBorrador(ANA, 'deudor-edicion', 'd-1'),
  ].filter((k) => localStorage.getItem(k) !== null);
const deBeto = () =>
  localStorage.getItem(claveBorrador(BETO, 'caso-nuevo:INSOLVENCY'));

/**
 * Los dos menús de usuario del encabezado: el de escritorio (un div) y el
 * móvil (un botón). Radix marca ambos disparadores con aria-haspopup="menu".
 */
const disparadoresDeMenu = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]'));

/** Abre el menú de usuario número `indice` y pulsa la opción. */
async function elegirEnMenu(indice: number, opcion: string) {
  const disparador = disparadoresDeMenu()[indice];
  await act(async () => {
    fireEvent.pointerDown(disparador, {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });
    fireEvent.keyDown(disparador, { key: 'Enter' });
  });
  const item = await screen.findByRole('menuitem', { name: opcion });
  await act(async () => {
    fireEvent.click(item);
  });
}

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
  mockSwitchDatabase.mockResolvedValue(undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => {});
  jest.spyOn(logger, 'info').mockImplementation(() => {});
  sembrarBorradores();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('cierre voluntario (encabezado)', () => {
  it('hay dos puntos de cierre: el menú de escritorio y el móvil', () => {
    render(<DashboardHeaderClient />);
    expect(disparadoresDeMenu()).toHaveLength(2);
  });

  it.each([
    [0, 'escritorio'],
    [1, 'móvil'],
  ])(
    '"Cerrar Sesión" en el menú %i (%s) borra los borradores de la persona, no los de otra',
    async (indice) => {
      render(<DashboardHeaderClient />);
      expect(deAna()).toHaveLength(2);

      await elegirEnMenu(indice, 'Cerrar Sesión');

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(deAna()).toHaveLength(0);
      expect(deBeto()).not.toBeNull();
    },
  );

  it('"Cambiar Organización" (también cierra la sesión) los borra', async () => {
    render(<DashboardHeaderClient />);

    await elegirEnMenu(0, 'Cambiar Organización');

    expect(mockSwitchDatabase).toHaveBeenCalledTimes(1);
    expect(deAna()).toHaveLength(0);
    expect(deBeto()).not.toBeNull();
  });
});

describe('cierre por inactividad', () => {
  it('cierra la sesión pero conserva los borradores', async () => {
    jest.useFakeTimers();
    renderHook(() =>
      useSessionTimeout({ timeoutDuration: 1000, warningDuration: 500 }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(deAna()).toHaveLength(2);
    expect(deBeto()).not.toBeNull();
  });
});
