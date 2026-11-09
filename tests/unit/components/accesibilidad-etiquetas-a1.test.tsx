/**
 * @jest-environment jsdom
 */

/**
 * A1 (auditoría 2026-10-27): dos campos sin nombre accesible. Un lector de
 * pantalla los anunciaba solo como "campo de edición".
 *
 *  - El buscador de /cases tenía solo `placeholder`.
 *  - La deuda total del asistente tenía `FormLabel`, pero `FormControl`
 *    envolvía el `<div>` contenedor: el `htmlFor` de la etiqueta apuntaba al
 *    div y no al input.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormProvider, useForm } from 'react-hook-form';

import { CaseFilters } from '@/app/cases/components/case-filters';
import { DebtorSection } from '@/app/cases/components/create-case-dialog/debtor-section';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

function SeccionDeudor() {
  const form = useForm({ defaultValues: { totalDebt: 1500000, causes: [] } });
  return (
    <FormProvider {...form}>
      <form>
        <DebtorSection
          debtors={[]}
          selectedDebtorId=""
          selectedDebtor={null}
          onDebtorSelect={() => {}}
          onCreateDebtorClick={() => {}}
          onCauseChange={() => {}}
        />
      </form>
    </FormProvider>
  );
}

describe('A1 — campos con nombre accesible', () => {
  it('el buscador de casos tiene nombre', () => {
    render(
      <CaseFilters
        searchTerm=""
        onSearchChange={() => {}}
        selectedPhase="all"
        onPhaseChange={() => {}}
        selectedType="all"
        onTypeChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('searchbox', { name: /Buscar casos/ }),
    ).toBeInTheDocument();
  });

  it('la deuda total calculada se asocia a su etiqueta', () => {
    render(<SeccionDeudor />);
    const campo = screen.getByLabelText('Deuda Total (calculada)');
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toHaveValue('1.500.000');
  });
});
