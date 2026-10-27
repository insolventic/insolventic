/**
 * @jest-environment jsdom
 */

/**
 * El botón "Crear nuevo deudor" abre un diálogo; no envía el formulario.
 *
 * `DebtorSection` se renderiza DENTRO del <form> del caso, tanto en el alta
 * (`create-case-dialog.tsx`) como en la edición (`edit-case-dialog.tsx`). El
 * botón no tenía `type`, y un <button> sin `type` dentro de un <form> es
 * submit. Un clic hacía dos cosas a la vez: abría "Crear Nuevo Deudor" y
 * enviaba el formulario del caso. En el alta eso pintaba, sin que el usuario
 * hubiera intentado guardar, "La deuda total es requerida" en rojo, el ícono de
 * error en "1. Solicitante" y el toast "Campos incompletos". En la edición era
 * peor: si el caso era válido, lo guardaba.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormProvider, useForm } from 'react-hook-form';

import { DebtorSection } from '@/app/cases/components/create-case-dialog/debtor-section';

// Radix (Checkbox) mide con ResizeObserver, que jsdom no trae.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

function Harness({
  onSubmit,
  onCreateDebtorClick,
}: {
  onSubmit: () => void;
  onCreateDebtorClick: () => void;
}) {
  const form = useForm({ defaultValues: { totalDebt: '', causes: [] } });
  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <DebtorSection
          debtors={[]}
          selectedDebtorId=""
          selectedDebtor={null}
          onDebtorSelect={() => {}}
          onCreateDebtorClick={onCreateDebtorClick}
          onCauseChange={() => {}}
        />
      </form>
    </FormProvider>
  );
}

describe('DebtorSection — botón "Crear nuevo deudor"', () => {
  it('abre el diálogo sin enviar el formulario que lo contiene', () => {
    const onSubmit = jest.fn();
    const onCreateDebtorClick = jest.fn();
    render(
      <Harness onSubmit={onSubmit} onCreateDebtorClick={onCreateDebtorClick} />,
    );

    const boton = screen.getByTitle('Crear nuevo deudor');
    expect(boton).toHaveAttribute('type', 'button');

    fireEvent.click(boton);

    expect(onCreateDebtorClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
