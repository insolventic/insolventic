/**
 * @jest-environment jsdom
 */

/**
 * El operador de un caso lo elige una persona, no el orden de una lista.
 *
 * Antes (issue #83) no existía ningún control: el diálogo de alta autoasignaba
 * `operatorId` al primer usuario con rol `Operadora de Insolvencia` o
 * `Abogado`, y si no encontraba ninguno, **al primer usuario que existiera**.
 * El de edición ni siquiera cargaba usuarios, así que la asignación no se podía
 * corregir después.
 *
 * De ese campo dependen tres cosas que ya corren en producción: a quién le
 * llegan las alertas del cron (`scanUpcomingHearings`, `scanOverduePayments`),
 * qué casos ve cada usuario con el permiso "Ver casos propios", y si un usuario
 * se puede borrar.
 *
 * Estos tests cubren las dos mitades del arreglo: el selector en sí, y un
 * guardián de código fuente para que la autoasignación no vuelva a colarse.
 *
 * `@/components/ui/select` va mockeado con un `<select>` nativo, el mismo
 * recurso que usa `document-generation.test.tsx`: el de Radix abre el menú con
 * eventos de puntero que jsdom no implementa.
 */

import React from 'react';

jest.mock('@/components/ui/select', () => {
  const ValorActual = React.createContext<string>('');
  return {
    __esModule: true,
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
      <ValorActual.Provider value={value ?? ''}>
        <select
          role="combobox"
          aria-label="Operador del caso"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          <option value="" />
          {children}
        </select>
      </ValorActual.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const valor = React.useContext(ValorActual);
      return valor ? null : <option value="__ph">{placeholder}</option>;
    },
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => <option value={value}>{children}</option>,
  };
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import { useForm, FormProvider } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import { CaseDetailsSection } from '@/app/cases/components/create-case-dialog/case-details-section';
import type { AssignableOperator } from '@/features/user/schemas';

const OPERADORES: AssignableOperator[] = [
  { id: 'u-ana', name: 'Ana Operadora', roleName: 'Operadora de Insolvencia' },
  { id: 'u-ben', name: 'Ben Abogado', roleName: 'Abogado' },
  { id: 'u-cam', name: 'Cam Asistente', roleName: 'Asistente Legal' },
];

let valoresDelFormulario: Record<string, unknown> = {};

function Host({
  operators = OPERADORES,
  loadingOperators = false,
  defaultOperatorId = '',
}: {
  operators?: AssignableOperator[];
  loadingOperators?: boolean;
  defaultOperatorId?: string;
}) {
  const form = useForm({
    defaultValues: {
      operatorId: defaultOperatorId,
      attorney: '',
      filingDate: '',
    },
  });
  valoresDelFormulario = form.watch() as Record<string, unknown>;
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form>
          <CaseDetailsSection
            operators={operators}
            loadingOperators={loadingOperators}
          />
        </form>
      </Form>
    </FormProvider>
  );
}

describe('selector de operador', () => {
  it('se muestra con su etiqueta', () => {
    render(<Host />);

    expect(screen.getByText('Operador del caso')).toBeInTheDocument();
  });

  it('NO preselecciona a nadie: el campo arranca vacío y hay que elegir', () => {
    render(<Host />);

    expect(valoresDelFormulario.operatorId).toBe('');
    expect(
      screen.getByText('Seleccione quién lleva el caso'),
    ).toBeInTheDocument();
  });

  it('elegir un operador escribe su id en el formulario', async () => {
    render(<Host />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'u-ben' },
    });

    await waitFor(() => {
      expect(valoresDelFormulario.operatorId).toBe('u-ben');
    });
  });

  it('lista a todos los usuarios del centro, con su rol, no solo a los operadores', () => {
    render(<Host />);

    expect(
      screen.getByText('Ana Operadora — Operadora de Insolvencia'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ben Abogado — Abogado')).toBeInTheDocument();
    expect(
      screen.getByText('Cam Asistente — Asistente Legal'),
    ).toBeInTheDocument();
  });

  it('un caso ya guardado muestra su operador actual', () => {
    render(<Host defaultOperatorId="u-cam" />);

    expect(screen.getByRole('combobox')).toHaveValue('u-cam');
  });

  it('mientras carga la lista queda deshabilitado y lo dice', () => {
    render(<Host operators={[]} loadingOperators />);

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('Cargando usuarios…')).toBeInTheDocument();
  });

  it('sin usuarios disponibles lo dice en vez de quedar mudo', () => {
    render(<Host operators={[]} />);

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('No hay usuarios disponibles')).toBeInTheDocument();
  });

  it('avisa para qué sirve el campo: de él dependen las alertas', () => {
    render(<Host />);

    expect(screen.getByText(/alertas de audiencia/i)).toBeInTheDocument();
  });
});

describe('guardián: la autoasignación no vuelve', () => {
  const SRC = path.join(process.cwd(), 'src');
  const leer = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

  const alta = leer('app/cases/components/create-case-dialog.tsx');
  const edicion = leer('app/cases/components/edit-case-dialog.tsx');

  it('el diálogo de alta no escribe operatorId por su cuenta', () => {
    expect(alta).not.toMatch(/setValue\(\s*['"]operatorId['"]/);
  });

  it('ningún diálogo elige por nombre de rol', () => {
    for (const fuente of [alta, edicion]) {
      expect(fuente).not.toContain("role?.name === 'Operadora de Insolvencia'");
      expect(fuente).not.toContain("role?.name === 'Abogado'");
    }
  });

  it('los dos diálogos piden la lista por la acción acotada, no por getAllUsers', () => {
    for (const fuente of [alta, edicion]) {
      expect(fuente).toContain('getAssignableOperators');
      expect(fuente).not.toContain('getAllUsers');
    }
  });

  it('los dos le pasan la lista a la sección que pinta el selector', () => {
    for (const fuente of [alta, edicion]) {
      expect(fuente).toMatch(/operators=\{operators\}/);
    }
  });

  it('el selector vive en la sección compartida por los dos diálogos', () => {
    const seccion = leer(
      'app/cases/components/create-case-dialog/case-details-section.tsx',
    );

    expect(seccion).toMatch(/name="operatorId"/);
  });
});
