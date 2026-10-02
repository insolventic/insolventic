/**
 * @jest-environment jsdom
 */

/**
 * Bug: el wizard de alta no tiene ningún campo para `amountOwed` en Servicios
 * Suspendidos, pero el esquema lo exige (`z.string().min(1, ...)`) y la base
 * también (`Decimal` no nulo en `SuspendedService`).
 *
 * Consecuencia medida, no supuesta: `addService()` agrega la fila con
 * `amountOwed: ''` y no hay ningún input que la cambie, así que
 * `createCaseFormSchema` (el que usa `zodResolver` en el formulario real)
 * rechaza el envío completo del caso en cuanto se agrega un servicio
 * suspendido — ver grupo 1. El pestaña de edición (`suspended-services-tab.tsx`)
 * sí tiene el campo; el hueco es solo este componente del wizard de alta.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';

import {
  suspendedServiceSchema,
  type SuspendedServiceData,
} from '@/features/case/schemas';
import { SuspendedServicesSection } from '@/app/cases/components/create-case-dialog/suspended-services-section';

describe('servicios suspendidos (alta) — amountOwed sin campo en el wizard', () => {
  describe('1. el mecanismo del bug (medido)', () => {
    it('amountOwed en blanco (lo que produce addService()) no pasa el esquema del servicio', () => {
      const result = suspendedServiceSchema.safeParse({
        creditorName: 'EPM',
        address: '',
        email: '',
        phone: '',
        suspendedProduct: 'Energía',
        amountOwed: '', // exactamente lo que deja `addService()` sin un input que lo cambie
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path[0] === 'amountOwed',
        );
        expect(issue?.message).toBe('El valor adeudado es requerido');
      }
    });

    it('con amountOwed lleno, el mismo esquema sí valida', () => {
      const result = suspendedServiceSchema.safeParse({
        creditorName: 'EPM',
        suspendedProduct: 'Energía',
        amountOwed: '150000',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('2. el componente real del wizard de alta', () => {
    function Host({ onReady }: { onReady: (f: UseFormReturn) => void }) {
      const form = useForm({
        defaultValues: { suspendedServices: [] as SuspendedServiceData[] },
      });
      React.useEffect(() => {
        onReady(form as unknown as UseFormReturn);
      }, [form, onReady]);
      return (
        <FormProvider {...form}>
          <SuspendedServicesSection />
        </FormProvider>
      );
    }

    it('al agregar un servicio, el campo "Suma Adeudada" existe y se puede completar', async () => {
      let form!: UseFormReturn;
      render(<Host onReady={(f) => (form = f)} />);

      fireEvent.click(screen.getByText('Agregar Servicio'));

      const suma = (await screen.findByLabelText(
        /suma adeudada/i,
      )) as HTMLInputElement;

      fireEvent.change(suma, { target: { value: '150000' } });

      await waitFor(() => {
        expect(form.getValues('suspendedServices.0.amountOwed')).toBe('150000');
      });
    });
  });
});
