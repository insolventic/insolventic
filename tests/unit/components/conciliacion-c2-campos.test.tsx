/**
 * @jest-environment jsdom
 */

/**
 * C-2 de la auditoría del formulario de conciliación (2026-10-12): 5 campos
 * con columna en schema.prisma y aceptados por Zod desde antes de esta
 * auditoría, cuya plantilla ya los imprime, pero sin ningún input:
 *
 *   concApoderadoConvocanteDireccion -> DIRECCION_APODERADO_CONVOCANTE
 *   concApoderadoConvocanteCiudad    -> CIUDAD_APODERADO_CONVOCANTE
 *       (Solicitud de Audiencia de Conciliacion.html, fieldset "Apoderado
 *       del Convocante" de ConciliationPartiesSection)
 *
 *   concFechaNacimiento -> FECHA_NACIMIENTO_SOLICITANTE
 *       (Solicitud de Audiencia; nuevo fieldset "Solicitante — Datos
 *       Adicionales" de ConciliationPartiesSection — el resto de los datos
 *       del solicitante no tiene input a propósito: lo deriva el mapper del
 *       deudor, ver conciliacion.ts:163-171)
 *
 *   concHoraProgramada -> HORA_PROGRAMADA
 *       (Terminacion Anormal.html, fieldset "Causa de Terminación (anormal)"
 *       de ConciliationDetailsSection)
 *
 *   concTipoConstanciaSolicitada -> TIPO_CONSTANCIA_SOLICITADA
 *       (Informe Conciliador.html, fieldset "Resultado del Informe" de
 *       ConciliationDetailsSection)
 *
 * Los 5 ya pasan por el mecanismo genérico de campos `conc*`
 * (`type-specific-fields.ts`, PR #89) tanto al cargar el diálogo de edición
 * como al enviarlo, así que agregar el input alcanza para que el dato se
 * capture, se guarde y se edite después — no hace falta tocar
 * `edit-case-dialog.tsx` ni `general-fields.ts`. El ciclo completo contra
 * Postgres real está en `tests/db/conciliacion-formulario.db.test.ts`.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';

import { ConciliationPartiesSection } from '@/app/cases/components/create-case-dialog/conciliation-parties-section';
import { ConciliationDetailsSection } from '@/app/cases/components/create-case-dialog/conciliation-details-section';

function HostParties({ onReady }: { onReady: (f: UseFormReturn) => void }) {
  const form = useForm();
  React.useEffect(() => {
    onReady(form as unknown as UseFormReturn);
  }, [form, onReady]);
  return (
    <FormProvider {...form}>
      <ConciliationPartiesSection />
    </FormProvider>
  );
}

function HostDetails({ onReady }: { onReady: (f: UseFormReturn) => void }) {
  const form = useForm();
  React.useEffect(() => {
    onReady(form as unknown as UseFormReturn);
  }, [form, onReady]);
  return (
    <FormProvider {...form}>
      <ConciliationDetailsSection />
    </FormProvider>
  );
}

describe('ConciliationPartiesSection — Dirección y Ciudad del Apoderado del Convocante', () => {
  it('existen DENTRO del fieldset "Apoderado del Convocante", al desplegarlo', async () => {
    render(<HostParties onReady={() => {}} />);

    fireEvent.click(screen.getByText(/Apoderado del Convocante \(opcional\)/i));

    const fieldset = await screen.findByRole('group', {
      name: /Apoderado del Convocante/i,
    });
    const scope = within(fieldset);

    expect(scope.getByLabelText(/Dirección/i)).toBeInTheDocument();
    expect(scope.getByLabelText(/Ciudad/i)).toBeInTheDocument();
  });

  it('escriben en concApoderadoConvocanteDireccion / concApoderadoConvocanteCiudad', async () => {
    let form!: UseFormReturn;
    render(<HostParties onReady={(f) => (form = f)} />);

    fireEvent.click(screen.getByText(/Apoderado del Convocante \(opcional\)/i));
    const fieldset = await screen.findByRole('group', {
      name: /Apoderado del Convocante/i,
    });
    const scope = within(fieldset);

    fireEvent.change(scope.getByLabelText(/Dirección/i), {
      target: { value: 'Calle 10 # 20-30' },
    });
    fireEvent.change(scope.getByLabelText(/Ciudad/i), {
      target: { value: 'Bogotá' },
    });

    expect(form.getValues('concApoderadoConvocanteDireccion')).toBe(
      'Calle 10 # 20-30',
    );
    expect(form.getValues('concApoderadoConvocanteCiudad')).toBe('Bogotá');
  });
});

describe('ConciliationPartiesSection — Solicitante, Fecha de nacimiento', () => {
  it('existe el fieldset con la etiqueta en español', () => {
    render(<HostParties onReady={() => {}} />);

    expect(
      screen.getByText(/Solicitante — Datos Adicionales/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha de nacimiento/i)).toBeInTheDocument();
  });

  it('escribe en concFechaNacimiento como texto libre, no como <input type="date">', () => {
    let form!: UseFormReturn;
    render(<HostParties onReady={(f) => (form = f)} />);

    const campo = screen.getByLabelText(/Fecha de nacimiento/i);
    // No es type="date": la columna es String y el mapper la imprime tal
    // cual, sin formatDate. Un <input type="date"> guardaría "1990-03-15".
    expect(campo).not.toHaveAttribute('type', 'date');

    fireEvent.change(campo, { target: { value: '15 de marzo de 1990' } });

    expect(form.getValues('concFechaNacimiento')).toBe('15 de marzo de 1990');
  });
});

describe('ConciliationDetailsSection — Hora programada de la audiencia', () => {
  it('existe dentro de "Causa de Terminación (anormal)", type="time"', async () => {
    render(<HostDetails onReady={() => {}} />);

    const fieldset = await screen.findByRole('group', {
      name: /Causa de Terminación \(anormal\)/i,
    });
    const campo = within(fieldset).getByLabelText(
      /Hora programada de la audiencia/i,
    );
    expect(campo).toHaveAttribute('type', 'time');
  });

  it('escribe en concHoraProgramada', async () => {
    let form!: UseFormReturn;
    render(<HostDetails onReady={(f) => (form = f)} />);

    const fieldset = await screen.findByRole('group', {
      name: /Causa de Terminación \(anormal\)/i,
    });
    fireEvent.change(
      within(fieldset).getByLabelText(/Hora programada de la audiencia/i),
      { target: { value: '09:00' } },
    );

    expect(form.getValues('concHoraProgramada')).toBe('09:00');
  });
});

describe('ConciliationDetailsSection — Tipo de constancia solicitada', () => {
  it('existe dentro de "Resultado del Informe", como texto libre', async () => {
    render(<HostDetails onReady={() => {}} />);

    const fieldset = await screen.findByRole('group', {
      name: /Resultado del Informe/i,
    });
    expect(
      within(fieldset).getByLabelText(/Tipo de constancia solicitada/i),
    ).toBeInTheDocument();
  });

  it('escribe en concTipoConstanciaSolicitada', async () => {
    let form!: UseFormReturn;
    render(<HostDetails onReady={(f) => (form = f)} />);

    const fieldset = await screen.findByRole('group', {
      name: /Resultado del Informe/i,
    });
    fireEvent.change(
      within(fieldset).getByLabelText(/Tipo de constancia solicitada/i),
      { target: { value: 'constancia de no acuerdo' } },
    );

    expect(form.getValues('concTipoConstanciaSolicitada')).toBe(
      'constancia de no acuerdo',
    );
  });
});
