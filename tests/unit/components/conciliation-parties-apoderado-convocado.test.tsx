/**
 * @jest-environment jsdom
 */

/**
 * Ítem 6 de la lista verificada de la auditoría transversal: apoderado del
 * convocado, UI faltante en conciliación.
 *
 * El backend ya está completo desde antes: `concApoderadoConvocadoName/
 * TipoId/Id/Correo/Cel/TP` existen en el schema (createCaseSchema,
 * updateCaseSchema), el mapper (`mapConciliationFields`) ya construye
 * `NOMBRE_APODERADO_CONVOCADO`/`HAS_APODERADO_CONVOCADO` y 5 campos más, y
 * `Acta General.html` ya los consume (dos bloques `{{#if
 * HAS_APODERADO_CONVOCADO}}`). Lo único que falta es el formulario:
 * `ConciliationPartiesSection` (compartido por create-case-dialog y
 * edit-case-dialog) tiene el toggle "Apoderado del Convocante" con sus 6
 * campos, pero no existe ningún toggle ni fieldset para el convocado — por
 * eso esos placeholders nunca tuvieron de dónde salir en producción, salvo
 * que alguien edite la base a mano.
 *
 * Como los campos `conc*` ya pasan por el prefijo genérico de
 * `type-specific-fields.ts` (PR #89) tanto al cargar como al enviar, no hace
 * falta tocar ninguna acción de servidor: agregar el fieldset alcanza para
 * que el dato se capture, se guarde y se edite después.
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';

import { ConciliationPartiesSection } from '@/app/cases/components/create-case-dialog/conciliation-parties-section';

function Host({ onReady }: { onReady: (f: UseFormReturn) => void }) {
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

describe('ConciliationPartiesSection — Apoderado del Convocado', () => {
  it('tiene un botón para desplegar "Apoderado del Convocado", igual que el del Convocante', () => {
    render(<Host onReady={() => {}} />);

    expect(screen.getByText(/Apoderado del Convocante/i)).toBeInTheDocument();
    expect(screen.getByText(/Apoderado del Convocado/i)).toBeInTheDocument();
  });

  it('al desplegarlo, los 6 campos existen dentro de su propio fieldset y escriben en concApoderadoConvocado*', async () => {
    let form!: UseFormReturn;
    render(<Host onReady={(f) => (form = f)} />);

    fireEvent.click(screen.getByText(/Apoderado del Convocado/i));

    const fieldset = await screen.findByRole('group', {
      name: /Apoderado del Convocado/i,
    });
    const scope = within(fieldset);

    fireEvent.change(scope.getByLabelText(/nombre completo/i), {
      target: { value: 'Dra. Convocado Apoderada' },
    });
    fireEvent.change(scope.getByLabelText(/número id/i), {
      target: { value: '999888' },
    });
    fireEvent.change(scope.getByLabelText(/tarjeta profesional/i), {
      target: { value: 'TP-999999' },
    });
    fireEvent.change(scope.getByLabelText(/correo/i), {
      target: { value: 'apoderado.convocado@example.com' },
    });
    fireEvent.change(scope.getByLabelText(/celular/i), {
      target: { value: '3009998877' },
    });

    await waitFor(() => {
      expect(form.getValues('concApoderadoConvocadoName')).toBe(
        'Dra. Convocado Apoderada',
      );
      expect(form.getValues('concApoderadoConvocadoId')).toBe('999888');
      expect(form.getValues('concApoderadoConvocadoTP')).toBe('TP-999999');
      expect(form.getValues('concApoderadoConvocadoCorreo')).toBe(
        'apoderado.convocado@example.com',
      );
      expect(form.getValues('concApoderadoConvocadoCel')).toBe('3009998877');
    });
  });
});
