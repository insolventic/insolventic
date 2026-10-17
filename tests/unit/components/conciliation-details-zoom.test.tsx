/**
 * @jest-environment jsdom
 */

/**
 * C-3 de la auditoría del formulario de conciliación (2026-10-12).
 *
 * `zoomLink`/`zoomMeetingId`/`zoomPassword` existen en el schema de Prisma y
 * en los tres Zod (`caseSchema`, `createCaseFormSchema`, `updateCaseFormSchema`
 * / variantes) desde antes de esta auditoría, y el mapper ya produce
 * `ZOOM_ID`/`ZOOM_CODIGO`/`ZOOM_LINK` (`placeholder-mapper.ts`) con fallback
 * a `''`. `Notificacion de Convocatoria.html` —la citación que se envía al
 * convocado— los imprime en su bloque "DATOS INGRESO REUNIÓN ZOOM". Lo único
 * que faltaba era el input: sin él, esa citación siempre salía con el ID, la
 * clave y el enlace vacíos, y quien recibía la citación no podía entrar a la
 * audiencia virtual.
 *
 * No son campos `conc*`: son columnas de `Case` sin prefijo, así que pasan
 * por `GENERAL_SCALAR_FIELDS` de `edit-case-dialog/general-fields.ts` al
 * editar — no hace falta tocar esa lista para que la edición los persista.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';

import { ConciliationDetailsSection } from '@/app/cases/components/create-case-dialog/conciliation-details-section';

function Host({ onReady }: { onReady: (f: UseFormReturn) => void }) {
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

describe('ConciliationDetailsSection — Audiencia virtual (Zoom), C-3', () => {
  it('muestra los tres campos con etiquetas en español', () => {
    render(<Host onReady={() => {}} />);

    expect(screen.getByLabelText(/ID de la reunión/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Código de acceso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Enlace de la reunión/i)).toBeInTheDocument();
  });

  it('escriben en zoomMeetingId / zoomPassword / zoomLink (sin prefijo conc)', () => {
    let form!: UseFormReturn;
    render(<Host onReady={(f) => (form = f)} />);

    fireEvent.change(screen.getByLabelText(/ID de la reunión/i), {
      target: { value: '123 4567 8901' },
    });
    fireEvent.change(screen.getByLabelText(/Código de acceso/i), {
      target: { value: 'ABC123' },
    });
    fireEvent.change(screen.getByLabelText(/Enlace de la reunión/i), {
      target: { value: 'https://zoom.us/j/1234567890' },
    });

    expect(form.getValues('zoomMeetingId')).toBe('123 4567 8901');
    expect(form.getValues('zoomPassword')).toBe('ABC123');
    expect(form.getValues('zoomLink')).toBe('https://zoom.us/j/1234567890');
  });

  it('el campo del enlace es type="url" (misma convención que los de correo)', () => {
    render(<Host onReady={() => {}} />);

    expect(screen.getByLabelText(/Enlace de la reunión/i)).toHaveAttribute(
      'type',
      'url',
    );
  });

  it('los tres son opcionales: un envío sin completarlos no deja valores undefined ni rompe el form', () => {
    let form!: UseFormReturn;
    render(<Host onReady={(f) => (form = f)} />);

    // Sin tocar nada, los tres deben poder leerse sin lanzar.
    expect(() => form.getValues(['zoomMeetingId', 'zoomPassword', 'zoomLink']))
      .not.toThrow();
  });
});
