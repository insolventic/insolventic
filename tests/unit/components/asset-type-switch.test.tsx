/**
 * @jest-environment jsdom
 */

/**
 * Bug: los campos específicos de un tipo de bien sobrevivían al cambio de tipo.
 *
 * El formulario muestra los campos específicos en bloques condicionados por
 * `type` (`{assetType === 'INMUEBLE' && ...}`). Al cambiar el tipo el bloque se
 * desmonta, pero react-hook-form NO borra el valor de un campo cuyo input se
 * desmontó (`shouldUnregister` es `false` por defecto). Medido, no supuesto: ver
 * el grupo 1.
 *
 * Consecuencia: se marcaba "Vivienda Familiar" en un inmueble, se corregía el
 * tipo a vehículo, y el bien se guardaba con `isFamilyHome: true` — un vehículo
 * afectado a vivienda familiar. Y no era solo la casilla: la dirección, la
 * matrícula inmobiliaria y el gravamen viajaban igual.
 *
 * Pasa en los DOS formularios de bienes, que usan patrones distintos:
 *  - alta   (`create-case-dialog/assets-section.tsx`): field array, `useWatch`
 *    por índice dentro de un hijo memoizado;
 *  - edición (`edit-case-dialog/assets-tab.tsx`): un solo bien, `watch('type')`.
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
import fs from 'fs';
import path from 'path';
import {
  useForm,
  useFormContext,
  useWatch,
  FormProvider,
  type UseFormReturn,
} from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  REAL_ESTATE_ONLY_FIELDS,
  PERSONAL_PROPERTY_ONLY_FIELDS,
  assetFieldsToClear,
  blankValueFor,
} from '@/features/case/asset-type-fields';
import { AssetsSection } from '@/app/cases/components/create-case-dialog/assets-section';

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('bienes — cambio de tipo', () => {
  describe('1. el mecanismo del bug (medido)', () => {
    it('react-hook-form conserva el valor de un campo cuyo bloque se desmontó', () => {
      // Sin ningún arreglo: el bloque condicional desaparece y el valor queda.
      function SinArreglo() {
        const form = useForm({
          defaultValues: { type: '', address: '', isFamilyHome: false },
        });
        const assetType = form.watch('type');
        return (
          <div>
            <button onClick={() => form.setValue('type', 'INMUEBLE')}>
              a-inmueble
            </button>
            <button onClick={() => form.setValue('type', 'VEHICULO')}>
              a-vehiculo
            </button>
            {assetType === 'INMUEBLE' && (
              <>
                <Input aria-label="direccion" {...form.register('address')} />
                <Checkbox
                  aria-label="vivienda"
                  checked={form.watch('isFamilyHome')}
                  onCheckedChange={(v) => form.setValue('isFamilyHome', !!v)}
                />
              </>
            )}
            <output data-testid="v">{JSON.stringify(form.watch())}</output>
          </div>
        );
      }

      render(<SinArreglo />);
      fireEvent.click(screen.getByText('a-inmueble'));
      fireEvent.click(screen.getByRole('checkbox', { name: 'vivienda' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'direccion' }), {
        target: { value: 'Calle 1 # 2-3' },
      });

      fireEvent.click(screen.getByText('a-vehiculo'));

      // El bloque ya no está en pantalla…
      expect(
        screen.queryByRole('checkbox', { name: 'vivienda' }),
      ).not.toBeInTheDocument();
      // …pero los valores siguen en el formulario, listos para enviarse.
      expect(screen.getByTestId('v')).toHaveTextContent('"isFamilyHome":true');
      expect(screen.getByTestId('v')).toHaveTextContent(
        '"address":"Calle 1 # 2-3"',
      );
    });
  });

  describe('2. la regla', () => {
    it('en INMUEBLE se limpian los campos de bien mueble', () => {
      expect(assetFieldsToClear('INMUEBLE')).toEqual([
        ...PERSONAL_PROPERTY_ONLY_FIELDS,
      ]);
    });

    it('en VEHICULO se limpian los campos de inmueble', () => {
      expect(assetFieldsToClear('VEHICULO')).toEqual([
        ...REAL_ESTATE_ONLY_FIELDS,
      ]);
      expect(assetFieldsToClear('VEHICULO')).toContain('isFamilyHome');
      expect(assetFieldsToClear('VEHICULO')).toContain(
        'isInalienablePatrimony',
      );
    });

    it('en un tipo sin bloque propio se limpian los dos grupos', () => {
      // El caso que pasa desapercibido: al ir de INMUEBLE a JOYA no desaparece
      // ningún campo de la pantalla, así que nada avisa de lo que quedó cargado.
      for (const tipo of ['MUEBLE', 'JOYA', 'DINERO', 'ACCION', 'OTRO']) {
        expect(assetFieldsToClear(tipo)).toEqual([
          ...REAL_ESTATE_ONLY_FIELDS,
          ...PERSONAL_PROPERTY_ONLY_FIELDS,
        ]);
      }
    });

    it('sin tipo elegido no se limpia nada', () => {
      expect(assetFieldsToClear('')).toEqual([]);
      expect(assetFieldsToClear(null)).toEqual([]);
      expect(assetFieldsToClear(undefined)).toEqual([]);
    });

    it('las casillas se limpian a false y el resto a cadena vacía', () => {
      expect(blankValueFor('isFamilyHome')).toBe(false);
      expect(blankValueFor('isInalienablePatrimony')).toBe(false);
      expect(blankValueFor('address')).toBe('');
      expect(blankValueFor('licensePlate')).toBe('');
    });

    it('los dos grupos son disjuntos y no incluyen los campos generales', () => {
      const real = new Set<string>(REAL_ESTATE_ONLY_FIELDS);
      for (const f of PERSONAL_PROPERTY_ONLY_FIELDS) {
        expect(real.has(f)).toBe(false);
      }
      // `description` se muestra para todos los tipos: limpiarla sería un bug
      // nuevo. Igual `name`, `type` y `value`.
      const todos = [
        ...REAL_ESTATE_ONLY_FIELDS,
        ...PERSONAL_PROPERTY_ONLY_FIELDS,
      ] as string[];
      for (const general of ['name', 'type', 'value', 'description']) {
        expect(todos).not.toContain(general);
      }
    });
  });

  describe('3. los dos formularios aplican la regla', () => {
    it('el de alta la aplica sobre su índice del arreglo', () => {
      const source = read(
        'src/app/cases/components/create-case-dialog/assets-section.tsx',
      );
      expect(source).toContain('assetFieldsToClear(assetType)');
      expect(source).toContain(
        'form.setValue(`assets.${index}.${field}`, blankValueFor(field)',
      );
    });

    it('el de edición la aplica sobre su formulario de bien nuevo', () => {
      const source = read(
        'src/app/cases/components/edit-case-dialog/assets-tab.tsx',
      );
      expect(source).toContain('assetFieldsToClear(assetType)');
      expect(source).toContain('newAssetForm.setValue(field');
    });
  });

  describe('4. reproducción con el arreglo puesto', () => {
    /** Aplica la regla igual que los componentes reales. */
    function useClearOnTypeChange(
      form: ReturnType<typeof useForm>,
      assetType: string,
    ) {
      React.useEffect(() => {
        for (const field of assetFieldsToClear(assetType)) {
          form.setValue(field, blankValueFor(field) as never, {
            shouldDirty: false,
          });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [assetType]);
    }

    /** Patrón del formulario de EDICIÓN: un solo bien, `watch('type')`. */
    function EditLike() {
      const form = useForm({
        defaultValues: {
          type: '',
          address: '',
          registrationNumber: '',
          isFamilyHome: false,
          isInalienablePatrimony: false,
          licensePlate: '',
        },
      });
      const assetType = form.watch('type') as string;
      useClearOnTypeChange(form, assetType);

      return (
        <div>
          <button onClick={() => form.setValue('type', 'INMUEBLE')}>
            a-inmueble
          </button>
          <button onClick={() => form.setValue('type', 'VEHICULO')}>
            a-vehiculo
          </button>
          <button onClick={() => form.setValue('type', 'JOYA')}>a-joya</button>
          {assetType === 'INMUEBLE' && (
            <>
              <Input aria-label="direccion" {...form.register('address')} />
              <Input
                aria-label="matricula"
                {...form.register('registrationNumber')}
              />
              <Checkbox
                aria-label="vivienda"
                checked={form.watch('isFamilyHome') as boolean}
                onCheckedChange={(v) => form.setValue('isFamilyHome', !!v)}
              />
              <Checkbox
                aria-label="patrimonio"
                checked={form.watch('isInalienablePatrimony') as boolean}
                onCheckedChange={(v) =>
                  form.setValue('isInalienablePatrimony', !!v)
                }
              />
            </>
          )}
          {assetType === 'VEHICULO' && (
            <Input aria-label="placa" {...form.register('licensePlate')} />
          )}
          <output data-testid="v">{JSON.stringify(form.watch())}</output>
        </div>
      );
    }

    function llenarInmueble() {
      fireEvent.change(screen.getByRole('textbox', { name: 'direccion' }), {
        target: { value: 'Calle 1 # 2-3' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'matricula' }), {
        target: { value: '050-12345' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: 'vivienda' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'patrimonio' }));
    }

    it('INMUEBLE → VEHICULO: no queda nada del inmueble', async () => {
      render(<EditLike />);
      fireEvent.click(screen.getByText('a-inmueble'));
      llenarInmueble();
      expect(screen.getByTestId('v')).toHaveTextContent('"isFamilyHome":true');

      fireEvent.click(screen.getByText('a-vehiculo'));

      await waitFor(() => {
        expect(screen.getByTestId('v')).toHaveTextContent(
          '"isFamilyHome":false',
        );
      });
      expect(screen.getByTestId('v')).toHaveTextContent(
        '"isInalienablePatrimony":false',
      );
      expect(screen.getByTestId('v')).toHaveTextContent('"address":""');
      expect(screen.getByTestId('v')).toHaveTextContent(
        '"registrationNumber":""',
      );
    });

    it('INMUEBLE → JOYA: tampoco, aunque en pantalla no desaparezca nada visible', async () => {
      render(<EditLike />);
      fireEvent.click(screen.getByText('a-inmueble'));
      llenarInmueble();

      fireEvent.click(screen.getByText('a-joya'));

      await waitFor(() => {
        expect(screen.getByTestId('v')).toHaveTextContent(
          '"isFamilyHome":false',
        );
      });
      expect(screen.getByTestId('v')).toHaveTextContent('"address":""');
    });

    it('VEHICULO → INMUEBLE: no queda nada del vehículo', async () => {
      render(<EditLike />);
      fireEvent.click(screen.getByText('a-vehiculo'));
      fireEvent.change(screen.getByRole('textbox', { name: 'placa' }), {
        target: { value: 'ABC123' },
      });
      expect(screen.getByTestId('v')).toHaveTextContent(
        '"licensePlate":"ABC123"',
      );

      fireEvent.click(screen.getByText('a-inmueble'));

      await waitFor(() => {
        expect(screen.getByTestId('v')).toHaveTextContent('"licensePlate":""');
      });
    });

    it('volver a INMUEBLE deja los campos en blanco, no con lo de antes', async () => {
      render(<EditLike />);
      fireEvent.click(screen.getByText('a-inmueble'));
      llenarInmueble();
      fireEvent.click(screen.getByText('a-vehiculo'));
      await waitFor(() => {
        expect(screen.getByTestId('v')).toHaveTextContent('"address":""');
      });

      fireEvent.click(screen.getByText('a-inmueble'));

      // La casilla vuelve a mostrarse, y vacía.
      await waitFor(() => {
        expect(
          screen.getByRole('checkbox', { name: 'vivienda' }),
        ).toHaveAttribute('data-state', 'unchecked');
      });
      expect(
        (screen.getByRole('textbox', { name: 'direccion' }) as HTMLInputElement)
          .value,
      ).toBe('');
    });

    /** Patrón del formulario de ALTA: field array, `useWatch` por índice. */
    function CreateItem({ index }: { index: number }) {
      const form = useFormContext();
      const assetType = useWatch({
        control: form.control,
        name: `assets.${index}.type`,
      }) as string;

      React.useEffect(() => {
        for (const field of assetFieldsToClear(assetType)) {
          form.setValue(`assets.${index}.${field}`, blankValueFor(field), {
            shouldDirty: false,
          });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [assetType, index]);

      return (
        <div>
          <button
            onClick={() => form.setValue(`assets.${index}.type`, 'INMUEBLE')}
          >
            {`c${index}-inmueble`}
          </button>
          <button
            onClick={() => form.setValue(`assets.${index}.type`, 'VEHICULO')}
          >
            {`c${index}-vehiculo`}
          </button>
          {assetType === 'INMUEBLE' && (
            <Checkbox
              aria-label={`c${index}-vivienda`}
              checked={form.watch(`assets.${index}.isFamilyHome`)}
              onCheckedChange={(v) =>
                form.setValue(`assets.${index}.isFamilyHome`, !!v)
              }
            />
          )}
        </div>
      );
    }

    function CreateLike() {
      const form = useForm({
        defaultValues: {
          assets: [
            { type: '', isFamilyHome: false, address: '' },
            { type: '', isFamilyHome: false, address: '' },
          ],
        },
      });
      return (
        <FormProvider {...form}>
          <CreateItem index={0} />
          <CreateItem index={1} />
          <output data-testid="cv">
            {JSON.stringify(form.watch('assets'))}
          </output>
        </FormProvider>
      );
    }

    it('en el alta se limpia el bien que cambió y NO los otros del arreglo', async () => {
      render(<CreateLike />);

      // Dos inmuebles, los dos con la casilla marcada.
      fireEvent.click(screen.getByText('c0-inmueble'));
      fireEvent.click(screen.getByText('c1-inmueble'));
      fireEvent.click(screen.getByRole('checkbox', { name: 'c0-vivienda' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'c1-vivienda' }));

      // Solo el primero pasa a vehículo.
      fireEvent.click(screen.getByText('c0-vehiculo'));

      await waitFor(() => {
        const assets = JSON.parse(
          screen.getByTestId('cv').textContent as string,
        );
        expect(assets[0].isFamilyHome).toBe(false);
        // El segundo sigue siendo un inmueble con su casilla intacta.
        expect(assets[1].isFamilyHome).toBe(true);
      });
    });
  });

  describe('5. el componente real del formulario de alta', () => {
    /**
     * `AssetsSection` solo necesita un `FormProvider`, así que se monta tal cual
     * y se maneja desde afuera con `setValue` — el `<Select>` de Radix no aporta
     * nada a lo que se prueba y abrirlo en jsdom es ruido.
     *
     * Esto cierra el círculo: el grupo 4 prueba que la regla arregla el bug, y
     * acá se prueba que el componente que va a producción la aplica de verdad.
     */
    function Host({ onReady }: { onReady: (f: UseFormReturn) => void }) {
      const form = useForm({
        defaultValues: {
          assets: [
            {
              name: '',
              type: '',
              value: '',
              description: '',
              propertyType: '',
              address: '',
              registrationNumber: '',
              encumbrance: '',
              isFamilyHome: false,
              isInalienablePatrimony: false,
              brand: '',
              model: '',
              licensePlate: '',
            },
          ],
        },
      });
      React.useEffect(() => {
        onReady(form as unknown as UseFormReturn);
      }, [form, onReady]);
      return (
        <FormProvider {...form}>
          <AssetsSection />
        </FormProvider>
      );
    }

    it('al pasar de INMUEBLE a VEHICULO limpia los campos del inmueble', async () => {
      let form!: UseFormReturn;
      render(<Host onReady={(f) => (form = f)} />);

      await act(async () => {
        form.setValue('assets.0.type', 'INMUEBLE');
      });

      // Se llena el inmueble por los inputs reales que el componente renderiza.
      const direccion = screen.getByLabelText('Dirección');
      fireEvent.change(direccion, { target: { value: 'Calle 1 # 2-3' } });
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Vivienda Familiar/i }),
      );

      expect(form.getValues('assets.0.isFamilyHome')).toBe(true);
      expect(form.getValues('assets.0.address')).toBe('Calle 1 # 2-3');

      await act(async () => {
        form.setValue('assets.0.type', 'VEHICULO');
      });

      await waitFor(() => {
        expect(form.getValues('assets.0.isFamilyHome')).toBe(false);
      });
      expect(form.getValues('assets.0.address')).toBe('');
      expect(form.getValues('assets.0.registrationNumber')).toBe('');
    });

    it('al pasar de VEHICULO a INMUEBLE limpia los campos del vehículo', async () => {
      let form!: UseFormReturn;
      render(<Host onReady={(f) => (form = f)} />);

      await act(async () => {
        form.setValue('assets.0.type', 'VEHICULO');
      });

      fireEvent.change(screen.getByPlaceholderText('ABC123'), {
        target: { value: 'ABC123' },
      });
      expect(form.getValues('assets.0.licensePlate')).toBe('ABC123');

      await act(async () => {
        form.setValue('assets.0.type', 'INMUEBLE');
      });

      await waitFor(() => {
        expect(form.getValues('assets.0.licensePlate')).toBe('');
      });
      expect(form.getValues('assets.0.brand')).toBe('');
    });
  });
});
