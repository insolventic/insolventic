/**
 * @jest-environment jsdom
 */

/**
 * Diálogos de alta y edición: los errores de validación aparecen solo después
 * de una acción del usuario, nunca al abrir.
 *
 * Regla de producto: un campo muestra su error solo si el usuario salió de él
 * (blur) o intentó guardar. Cerrar y reabrir un diálogo lo deja limpio.
 *
 * Lo que estaba roto (visto en el navegador antes del arreglo): estos diálogos
 * siguen montados cuando se cierran y solo se reseteaban tras guardar con
 * éxito (alta) o cuando cambiaba la entidad (edición). Un intento fallido +
 * cerrar dejaba los errores esperando: al volver a abrir "Nuevo Deudor",
 * "Crear Nuevo Acreedor", "Crear Nuevo Usuario" o "Crear Nuevo Rol" aparecían
 * los mensajes en rojo sin que el usuario hubiera hecho nada. En "Editar Rol" y
 * "Editar Deudor" volvía además la edición descartada (el nombre borrado).
 *
 * Cada `describe` corre las mismas cuatro comprobaciones contra un diálogo.
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const mockAccion = jest.fn();
jest.mock('@/features/debtor/actions', () => ({
  createDebtor: (...a: unknown[]) => mockAccion(...a),
  updateDebtor: (...a: unknown[]) => mockAccion(...a),
}));
jest.mock('@/features/creditor/actions', () => ({
  createCreditor: (...a: unknown[]) => mockAccion(...a),
}));
jest.mock('@/features/user/actions', () => ({
  createUser: (...a: unknown[]) => mockAccion(...a),
}));
jest.mock('@/features/role/actions', () => ({
  createRole: (...a: unknown[]) => mockAccion(...a),
  updateRole: (...a: unknown[]) => mockAccion(...a),
}));
jest.mock('@/features/permission/actions', () => ({
  getAllPermissions: jest.fn().mockResolvedValue({ success: true, data: [] }),
}));

// Dialog sin portal ni animaciones: solo renderiza si open=true.
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) => (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: Pass,
    DialogClose: Pass,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

import { CreateDebtorDialog } from '@/app/debtors/components/create-debtor-dialog';
import { EditDebtorDialog } from '@/app/debtors/components/edit-debtor-dialog';
import { CreateCreditorDialog } from '@/app/creditors/components/create-creditor-dialog';
import { CreateUserDialog } from '@/app/users/components/create-user-dialog';
import { CreateRoleDialog } from '@/app/users/components/create-role-dialog';
import { EditRoleDialog } from '@/app/users/components/edit-role-dialog';
import { CreateDebtorDialog as QuickCreateDebtorDialog } from '@/app/cases/components/create-case-dialog/create-debtor-dialog';
import type { Debtor } from '@/features/debtor/schemas';
import type { Role } from '@/features/role/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const DEUDOR = {
  id: 'deudor-1',
  name: 'Ana Martínez López',
  idNumber: '41234567',
  idType: 'CC',
  email: 'ana@example.com',
  phone: '3001234567',
  address: 'Calle 1 # 2-3',
  city: 'Bogotá',
  department: 'Cundinamarca',
  birthDate: null,
  occupation: 'Empleada',
  monthlyIncome: 2000000,
  monthlyExpenses: 1500000,
  dependents: 0,
  maritalStatus: null,
  educationLevel: null,
  emergencyContact: null,
  emergencyPhone: null,
  bankAccount: null,
  bankName: null,
  accountType: null,
  description: null,
} as unknown as Debtor;

const ROL = {
  id: 'rol-1',
  name: 'Coordinador',
  description: 'Coordina casos',
  permissions: ['ver_casos'],
  color: 'bg-muted text-foreground',
  users: [],
} as unknown as Role;

// ─── Casos ──────────────────────────────────────────────────────────────────

interface Caso {
  nombre: string;
  /** Elemento del diálogo con `open` dado. */
  dialogo: (open: boolean) => React.ReactElement;
  /** Texto del botón que guarda. */
  guardar: RegExp;
  /** Error que debe aparecer al dejar vacío el campo `name`. */
  errorNombre: string;
  /** Si es edición: valor que el campo `name` debe recuperar al reabrir. */
  nombreOriginal?: string;
}

const CASOS: Caso[] = [
  {
    nombre: 'Nuevo Deudor (debtors/create-debtor-dialog)',
    dialogo: (open) => (
      <CreateDebtorDialog open={open} onOpenChange={() => {}} />
    ),
    guardar: /Guardar Deudor/,
    errorNombre: 'El nombre es requerido',
  },
  {
    nombre: 'Editar Deudor (debtors/edit-debtor-dialog)',
    dialogo: (open) => (
      <EditDebtorDialog debtor={DEUDOR} open={open} onOpenChange={() => {}} />
    ),
    guardar: /Guardar Cambios/,
    errorNombre: 'El nombre es requerido',
    nombreOriginal: DEUDOR.name,
  },
  {
    nombre: 'Crear Nuevo Acreedor (creditors/create-creditor-dialog)',
    dialogo: (open) => (
      <CreateCreditorDialog open={open} onOpenChange={() => {}} />
    ),
    guardar: /Crear Acreedor/,
    errorNombre: 'El nombre es requerido',
  },
  {
    nombre: 'Crear Nuevo Usuario (users/create-user-dialog)',
    dialogo: (open) => (
      <CreateUserDialog roles={[]} open={open} onOpenChange={() => {}} />
    ),
    guardar: /Crear Usuario/,
    errorNombre: 'El nombre es requerido',
  },
  {
    nombre: 'Crear Nuevo Rol (users/create-role-dialog)',
    dialogo: (open) => <CreateRoleDialog open={open} onOpenChange={() => {}} />,
    guardar: /Crear Rol/,
    errorNombre: 'El nombre del rol es obligatorio',
  },
  {
    nombre: 'Editar Rol (users/edit-role-dialog)',
    dialogo: (open) => (
      <EditRoleDialog role={ROL} open={open} onOpenChange={() => {}} />
    ),
    guardar: /Guardar Cambios/,
    errorNombre: 'El nombre del rol es obligatorio',
    nombreOriginal: ROL.name,
  },
  {
    nombre:
      'Crear Nuevo Deudor desde el wizard (create-case-dialog/create-debtor-dialog)',
    dialogo: (open) => (
      <QuickCreateDebtorDialog
        open={open}
        onOpenChange={() => {}}
        creatingDebtor={false}
        onSubmit={async () => null}
      />
    ),
    guardar: /Crear Deudor/,
    errorNombre: 'El nombre es obligatorio',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Mensajes de error de campo visibles (FormMessage o <p> rojo propio). */
function mensajesDeError(): string[] {
  return Array.from(
    document.querySelectorAll('p.text-destructive, p.text-red-500'),
  ).map((p) => p.textContent ?? '');
}

function campoNombre(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]');
  if (!input) throw new Error('No se encontró el campo name');
  return input;
}

async function vaciarNombre() {
  await act(async () => {
    fireEvent.change(campoNombre(), { target: { value: '' } });
  });
}

async function guardar(texto: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: texto }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.each(CASOS)('$nombre', (caso) => {
  it('al abrir no muestra ningún error', async () => {
    render(caso.dialogo(true));
    // Deja correr los efectos de apertura (reset, carga de permisos).
    await act(async () => {});

    expect(mensajesDeError()).toEqual([]);
  });

  it('al guardar con el nombre vacío SÍ muestra el error', async () => {
    render(caso.dialogo(true));
    await act(async () => {});
    if (caso.nombreOriginal) await vaciarNombre();

    await guardar(caso.guardar);

    await waitFor(() => expect(mensajesDeError()).toContain(caso.errorNombre));
    expect(mockAccion).not.toHaveBeenCalled();
  });

  it('al tocar el nombre y salir vacío aparece su error, y solo ese', async () => {
    render(caso.dialogo(true));
    await act(async () => {});
    if (caso.nombreOriginal) await vaciarNombre();
    expect(mensajesDeError()).toEqual([]);

    await act(async () => {
      fireEvent.focus(campoNombre());
      fireEvent.blur(campoNombre());
    });

    await waitFor(() => expect(mensajesDeError()).toEqual([caso.errorNombre]));
  });

  it('cerrar y reabrir reinicia errores y valores', async () => {
    const { rerender } = render(caso.dialogo(true));
    await act(async () => {});
    if (caso.nombreOriginal) await vaciarNombre();
    await guardar(caso.guardar);
    await waitFor(() => expect(mensajesDeError()).toContain(caso.errorNombre));

    rerender(caso.dialogo(false));
    rerender(caso.dialogo(true));
    await act(async () => {});

    expect(mensajesDeError()).toEqual([]);
    expect(campoNombre().value).toBe(caso.nombreOriginal ?? '');
  });
});
