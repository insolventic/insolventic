/**
 * @jest-environment jsdom
 */

/**
 * useBorradorFormulario: guarda con debounce, restaura, empieza de cero,
 * descarta, limpia tras el envío, y descarta borradores de otra versión del
 * esquema o del registro.
 */
import { useForm } from 'react-hook-form';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  DEBOUNCE_BORRADOR_MS,
  useBorradorFormulario,
} from '@/hooks/use-borrador-formulario';
import {
  AvisoBorrador,
  BotonDescartarBorrador,
} from '@/components/form-guard/aviso-borrador';
import { claveBorrador, guardarBorrador } from '@/lib/borradores';

const ANA = { userId: 'u-ana', tenantId: 't-armonia' };
const resolverAna = () => Promise.resolve(ANA);
const CLAVE = claveBorrador(ANA, 'prueba');

let limpiarDesdeFuera: (() => void) | null = null;

function Formulario({
  version = 1,
  versionEntidad,
  entidadId,
}: {
  version?: number;
  versionEntidad?: string;
  entidadId?: string;
}) {
  const form = useForm({ defaultValues: { nombre: '', cedula: '' } });
  const borrador = useBorradorFormulario({
    form,
    formulario: 'prueba',
    entidadId,
    version,
    activo: true,
    versionEntidad,
    resolverIdentidad: resolverAna,
  });
  limpiarDesdeFuera = borrador.limpiar;
  return (
    <form>
      <AvisoBorrador borrador={borrador} />
      <label htmlFor="nombre">Nombre</label>
      <input id="nombre" {...form.register('nombre')} />
      <label htmlFor="cedula">Cédula</label>
      <input id="cedula" {...form.register('cedula')} />
      <BotonDescartarBorrador borrador={borrador} />
    </form>
  );
}

async function montar(props: Parameters<typeof Formulario>[0] = {}) {
  render(<Formulario {...props} />);
  // Deja resolver la identidad (promesa) y el efecto que lee el borrador.
  await act(async () => {
    await Promise.resolve();
  });
}

const guardado = () => {
  const t = localStorage.getItem(CLAVE);
  return t ? (JSON.parse(t) as { datos: Record<string, string> }) : null;
};

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('autoguardado', () => {
  it('guarda tras 1 s sin escribir, no antes', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Ana Ruiz' },
    });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_BORRADOR_MS - 10);
    });
    expect(guardado()).toBeNull();
    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(guardado()?.datos).toEqual({ nombre: 'Ana Ruiz', cedula: '' });
  });

  it('cada tecla reinicia la espera (debounce)', async () => {
    await montar();
    const nombre = screen.getByLabelText('Nombre');
    fireEvent.change(nombre, { target: { value: 'A' } });
    act(() => jest.advanceTimersByTime(800));
    fireEvent.change(nombre, { target: { value: 'An' } });
    act(() => jest.advanceTimersByTime(800));
    expect(guardado()).toBeNull();
    act(() => jest.advanceTimersByTime(300));
    expect(guardado()?.datos.nombre).toBe('An');
  });

  it('cerrar antes de que venza la espera guarda lo último escrito', async () => {
    const { unmount } = render(<Formulario />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Último' },
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(guardado()).toBeNull();
    // El diálogo se cierra (el formulario se desmonta) con la espera pendiente.
    act(() => unmount());
    expect(guardado()?.datos.nombre).toBe('Último');
  });

  it('sin cambios no guarda nada', async () => {
    await montar();
    act(() => jest.advanceTimersByTime(5000));
    expect(guardado()).toBeNull();
  });
});

describe('al abrir con un borrador', () => {
  beforeEach(() => {
    guardarBorrador(localStorage, ANA, 'prueba', null, 1, {
      nombre: 'Borrador',
      cedula: '123',
    });
  });

  it('avisa con la fecha y no lo pisa mientras no se decida', async () => {
    await montar();
    expect(
      screen.getByText(/Tienes un borrador sin guardar de/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'X' },
    });
    act(() => jest.advanceTimersByTime(2000));
    expect(guardado()?.datos.nombre).toBe('Borrador');
  });

  it('"Restaurar" carga los valores y deja de avisar', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Borrador');
    expect(screen.getByLabelText('Cédula')).toHaveValue('123');
    expect(screen.queryByText(/Tienes un borrador/)).not.toBeInTheDocument();
  });

  it('"Empezar de cero" borra el borrador y deja el formulario vacío', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar de cero' }));
    expect(guardado()).toBeNull();
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
  });

  it('"Descartar borrador" lo borra y devuelve el formulario a su estado inicial', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar borrador/ }));
    expect(guardado()).toBeNull();
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
  });

  it('limpiar() (envío exitoso) lo borra', async () => {
    await montar();
    act(() => limpiarDesdeFuera?.());
    expect(guardado()).toBeNull();
  });

  it('un borrador de otra versión del esquema se descarta sin romper', async () => {
    await montar({ version: 2 });
    expect(screen.queryByText(/Tienes un borrador/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Se descartó un borrador anterior/),
    ).toBeInTheDocument();
    expect(guardado()).toBeNull();
  });
});

describe('formularios de edición', () => {
  it('descarta el borrador si el registro cambió de versión', async () => {
    guardarBorrador(
      localStorage,
      ANA,
      'prueba',
      'c-1',
      1,
      { nombre: 'Viejo', cedula: '' },
      { versionEntidad: '3' },
    );
    await montar({ entidadId: 'c-1', versionEntidad: '4' });
    expect(screen.queryByText(/Tienes un borrador/)).not.toBeInTheDocument();
    expect(
      localStorage.getItem(claveBorrador(ANA, 'prueba', 'c-1')),
    ).toBeNull();
  });

  it('lo ofrece si la versión del registro es la misma', async () => {
    guardarBorrador(
      localStorage,
      ANA,
      'prueba',
      'c-1',
      1,
      { nombre: 'Igual', cedula: '' },
      { versionEntidad: '4' },
    );
    await montar({ entidadId: 'c-1', versionEntidad: '4' });
    expect(screen.getByText(/Tienes un borrador/)).toBeInTheDocument();
  });
});
