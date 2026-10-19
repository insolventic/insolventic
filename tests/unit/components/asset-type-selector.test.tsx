/**
 * @jest-environment jsdom
 */

/**
 * `AssetTypeSelector` — selector de bienes en dos niveles (Categoría →
 * Tipo), compartido entre alta (`assets-section.tsx`) y edición
 * (`assets-tab.tsx`).
 */

import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AssetTypeSelector } from '@/app/cases/components/asset-type-selector';

// Radix Select usa estas dos APIs del DOM real que jsdom no implementa.
// Sin esto, el trigger nunca abre el listbox en los tests (el click llega,
// pero Radix lo descarta porque hasPointerCapture no existe).
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

/** Envuelve el selector como lo usarían los dos formularios reales: estado controlado. */
function Host({
  initialType = '',
  initialPropertyType = '',
}: {
  initialType?: string;
  initialPropertyType?: string;
}) {
  const [type, setType] = useState(initialType);
  const [propertyType, setPropertyType] = useState(initialPropertyType);
  return (
    <AssetTypeSelector
      type={type}
      propertyType={propertyType}
      onTypeChange={setType}
      onPropertyTypeChange={setPropertyType}
    />
  );
}

function openSelect(name: RegExp) {
  const trigger = screen.getByRole('combobox', { name });
  fireEvent.click(trigger);
}

function pickOption(name: string) {
  fireEvent.click(screen.getByRole('option', { name }));
}

describe('AssetTypeSelector', () => {
  it('sin bien cargado: ninguna categoría elegida, el selector de tipo está deshabilitado', () => {
    render(<Host />);
    expect(
      screen.getByRole('combobox', { name: /categoría/i }),
    ).toHaveTextContent(/seleccione categoría/i);
    expect(screen.getByRole('combobox', { name: /tipo/i })).toBeDisabled();
  });

  it('elegir "Inmueble" habilita el segundo selector con los 8 tipos de inmueble', () => {
    render(<Host />);
    openSelect(/categoría/i);
    pickOption('Inmueble');

    const tipo = screen.getByRole('combobox', { name: /tipo/i });
    expect(tipo).not.toBeDisabled();
    openSelect(/^tipo/i);
    expect(screen.getByRole('option', { name: 'Casa' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Apartamento' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Finca' })).toBeInTheDocument();
  });

  it('elegir "Mueble" habilita el segundo selector con los 8 tipos de mueble', () => {
    render(<Host />);
    openSelect(/categoría/i);
    pickOption('Mueble');

    const tipo = screen.getByRole('combobox', { name: /tipo/i });
    expect(tipo).not.toBeDisabled();
    openSelect(/^tipo/i);
    expect(
      screen.getByRole('option', {
        name: 'Equipos eléctricos y electrónicos',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Joyas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Otro' })).toBeInTheDocument();
  });

  it('un bien existente con type="INMUEBLE" y propertyType="APARTAMENTO" se muestra correctamente', () => {
    render(<Host initialType="INMUEBLE" initialPropertyType="APARTAMENTO" />);
    expect(
      screen.getByRole('combobox', { name: /categoría/i }),
    ).toHaveTextContent('Inmueble');
    expect(screen.getByRole('combobox', { name: /tipo/i })).toHaveTextContent(
      'Apartamento',
    );
  });

  it('un bien existente con type="ELECTRONICO" (ya normalizado) se muestra correctamente', () => {
    render(<Host initialType="ELECTRONICO" />);
    expect(
      screen.getByRole('combobox', { name: /categoría/i }),
    ).toHaveTextContent('Mueble');
    expect(screen.getByRole('combobox', { name: /tipo/i })).toHaveTextContent(
      'Equipos eléctricos y electrónicos',
    );
  });

  it('cambiar de Inmueble a Mueble limpia el tipo (obliga a elegir, no adivina)', () => {
    render(<Host initialType="INMUEBLE" initialPropertyType="CASA" />);

    openSelect(/categoría/i);
    pickOption('Mueble');

    expect(
      screen.getByRole('combobox', { name: /categoría/i }),
    ).toHaveTextContent('Mueble');
    expect(screen.getByRole('combobox', { name: /tipo/i })).toHaveTextContent(
      /seleccione tipo de mueble/i,
    );
  });

  it('cambiar de Mueble a Inmueble fija type="INMUEBLE" de inmediato', () => {
    render(<Host initialType="JOYAS" />);

    openSelect(/categoría/i);
    pickOption('Inmueble');

    expect(
      screen.getByRole('combobox', { name: /categoría/i }),
    ).toHaveTextContent('Inmueble');
  });
});
