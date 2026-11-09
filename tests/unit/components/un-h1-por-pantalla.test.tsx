/**
 * @jest-environment jsdom
 */

/**
 * A3 (auditoría 2026-10-27): cada pantalla tenía dos <h1>, la marca
 * «INSOLVENTIC» del encabezado común y el título de la pantalla. Un lector de
 * pantalla no podía saber cuál era el título. La marca pasa a ser texto, y
 * las pantallas sin título visible (/dashboard, /creditors, /debtors) llevan
 * un <h1> solo para lectores de pantalla.
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/dashboard',
}));
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      name: 'Operadora',
      email: 'op@centro.co',
      tenantId: 'armonia',
      permissions: [],
    },
    isLoading: false,
    logout: jest.fn(),
    switchDatabase: jest.fn(),
    checkPermission: () => false,
  }),
}));
jest.mock('@/features/notification/actions', () => ({
  getUnreadCount: jest.fn().mockResolvedValue({ success: true, data: 0 }),
}));
jest.mock('@/components/global-search', () => ({ GlobalSearch: () => null }));
jest.mock('@/components/auth/change-password-dialog', () => ({
  ChangePasswordDialog: () => null,
}));

import { DashboardHeaderClient } from '@/app/dashboard/components/dashboard-header-client';
import { DashboardHeaderSkeleton } from '@/app/dashboard/components/dashboard-header-skeleton';

describe('A3 — un solo <h1> por pantalla', () => {
  it.each([
    ['encabezado', DashboardHeaderClient],
    ['encabezado (cargando)', DashboardHeaderSkeleton],
  ])('el %s muestra la marca sin ser un título', (_n, Componente) => {
    render(<Componente />);
    expect(screen.getByText('INSOLVENTIC')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  // Las tres pantallas cuyo único <h1> era la marca. Son componentes de
  // servidor con datos; se comprueba el título en el código fuente.
  it.each([
    ['src/app/dashboard/page.tsx', 'Panel principal'],
    ['src/app/creditors/page.tsx', 'Acreedores'],
    ['src/app/debtors/page.tsx', 'Deudores'],
  ])('%s tiene su propio <h1>', (archivo, titulo) => {
    const fuente = fs.readFileSync(path.join(process.cwd(), archivo), 'utf8');
    expect(fuente).toContain(`<h1 className="sr-only">${titulo}</h1>`);
  });
});
